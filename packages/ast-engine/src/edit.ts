// Source-coord-preserving AST editor. This is the correctness core of the
// whole product: after applying any edit, every non-edited JSX element's
// {line, column} in the output must match its position in the input. If this
// invariant breaks, __propsToSource goes stale on HMR and click-to-source
// regresses silently.
//
// For attribute and text edits (setJSXProp, updateJSXText) the invariant is
// strict — no other element's coords may change. For structural edits
// (addElement, wrapElement, deleteElement, moveElement) the invariant is
// relaxed: elements that appear *before* the mutation point in source order
// keep their coords. Elements after may shift — HMR regenerates __source and
// the preview-agent re-locks selection from the refreshed map.
//
// We achieve both via recast, which only reprints nodes it detects as
// modified and preserves original source for untouched nodes verbatim.
//
// Batch semantics: every op's target coord is resolved against the AST at the
// start of the batch, *before* any mutation. This lets callers mix structural
// and attribute ops freely — a later op's coords aren't invalidated by an
// earlier op's insertion or deletion.

import { readFile, writeFile } from 'node:fs/promises';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { parse as recastParse, print as recastPrint } from 'recast';
import type {
  ToolCall,
  JSXSource,
  JSXElementDescriptor,
  JSXPosition,
} from '@product/protocol';

// @babel/traverse's default export is CJS-interop-friendly but ships as a
// namespace object under ESM with `.default`. Normalize.
const traverse = (
  (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse
) as typeof _traverse;

export type EditErrorCode =
  | 'node-not-found'
  | 'unsupported-value'
  | 'parse-failed'
  | 'parent-self-closing'
  | 'cannot-delete-root'
  | 'invalid-move'
  | 'invalid-parent';

export class EditError extends Error {
  constructor(
    message: string,
    readonly code: EditErrorCode,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

export interface EditResult {
  before: string;
  after: string;
  ops: ToolCall[];
}

export async function editFile(path: string, ops: ToolCall[]): Promise<EditResult> {
  const before = await readFile(path, 'utf8');
  const after = applyEdits(before, ops);
  if (after !== before) {
    await writeFile(path, after, 'utf8');
  }
  return { before, after, ops };
}

export function applyEdits(source: string, ops: ToolCall[]): string {
  let ast: ReturnType<typeof recastParse>;
  try {
    ast = recastParse(source, {
      parser: {
        parse: (input: string) =>
          babelParse(input, {
            sourceType: 'module',
            allowReturnOutsideFunction: true,
            plugins: ['typescript', 'jsx'],
            tokens: true,
          }),
      },
    });
  } catch (err) {
    throw new EditError(`Failed to parse source: ${(err as Error).message}`, 'parse-failed');
  }

  // Resolve pass: walk once, build a map keyed by source triple → element
  // node (plus its parent, needed for structural ops). Every op's targets are
  // looked up from this map before any mutation runs.
  const targets = buildTargetMap(ast);
  for (let i = 0; i < ops.length; i++) {
    applyOp(ops[i]!, i, targets);
  }

  return recastPrint(ast).code;
}

// ---------------------------------------------------------------------------
// Target resolution.
// ---------------------------------------------------------------------------

interface ResolvedTarget {
  node: t.JSXElement;
  parent: t.Node;
}

function buildTargetMap(ast: t.File): Map<string, ResolvedTarget> {
  const map = new Map<string, ResolvedTarget>();
  traverse(ast, {
    JSXElement(path) {
      const loc = path.node.openingElement.loc ?? path.node.loc;
      if (!loc) return;
      // Key uses 1-indexed column to match JSXSource (React's __source
      // convention is column0 + 1).
      const key = coordKey(loc.start.line, loc.start.column + 1);
      map.set(key, { node: path.node, parent: path.parent });
    },
  });
  return map;
}

function coordKey(line: number, column1: number): string {
  return `${line}:${column1}`;
}

function lookupTarget(
  map: Map<string, ResolvedTarget>,
  source: JSXSource,
  opIndex: number,
  opTool: string,
): ResolvedTarget {
  const key = coordKey(source.lineNumber, source.columnNumber);
  const target = map.get(key);
  if (!target) {
    throw new EditError(
      `No JSX element at ${source.fileName}:${source.lineNumber}:${source.columnNumber} ` +
        `(op #${opIndex}, ${opTool})`,
      'node-not-found',
    );
  }
  return target;
}

// ---------------------------------------------------------------------------
// Op dispatch.
// ---------------------------------------------------------------------------

function applyOp(op: ToolCall, i: number, map: Map<string, ResolvedTarget>): void {
  switch (op.tool) {
    case 'setJSXProp': {
      const target = lookupTarget(map, op.args.source, i, op.tool);
      applySetJSXProp(target, op.args.prop, op.args.value);
      return;
    }
    case 'updateJSXText': {
      const target = lookupTarget(map, op.args.source, i, op.tool);
      applyUpdateJSXText(target, op.args.text);
      return;
    }
    case 'addElement': {
      const parent = lookupTarget(map, op.args.parent, i, op.tool);
      applyAddElement(parent, op.args.position, op.args.element);
      return;
    }
    case 'wrapElement': {
      const target = lookupTarget(map, op.args.target, i, op.tool);
      applyWrapElement(target, op.args.wrapper);
      return;
    }
    case 'deleteElement': {
      const target = lookupTarget(map, op.args.target, i, op.tool);
      applyDeleteElement(target);
      return;
    }
    case 'moveElement': {
      const target = lookupTarget(map, op.args.target, i, op.tool);
      const newParent = lookupTarget(map, op.args.newParent, i, op.tool);
      applyMoveElement(target, newParent, op.args.position);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Mutators.
// ---------------------------------------------------------------------------

function applySetJSXProp(target: ResolvedTarget, prop: string, value: string): void {
  const opening = target.node.openingElement;
  const existing = opening.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === prop,
  );

  const nextValue = jsxAttributeValue(value);
  if (existing) {
    existing.value = nextValue;
  } else {
    opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(prop), nextValue));
  }
}

function applyUpdateJSXText(target: ResolvedTarget, text: string): void {
  target.node.children = [t.jsxText(text)];
  // When only children are text, closing tag is required; ensure it.
  target.node.openingElement.selfClosing = false;
  if (!target.node.closingElement) {
    target.node.closingElement = t.jsxClosingElement(
      t.cloneNode(target.node.openingElement.name),
    );
  }
}

function applyAddElement(
  parent: ResolvedTarget,
  position: JSXPosition,
  descriptor: JSXElementDescriptor,
): void {
  const parentEl = parent.node;
  if (parentEl.openingElement.selfClosing) {
    throw new EditError(
      `Cannot add child to self-closing element <${tagName(parentEl)} />`,
      'parent-self-closing',
    );
  }
  const child = buildJSXElement(descriptor);
  if (position === 'start') {
    parentEl.children.unshift(child);
  } else {
    parentEl.children.push(child);
  }
  ensureClosingElement(parentEl);
}

function applyWrapElement(
  target: ResolvedTarget,
  descriptor: Omit<JSXElementDescriptor, 'text'>,
): void {
  const wrapper = buildJSXElement(
    { tag: descriptor.tag, props: descriptor.props },
    [target.node],
  );
  replaceInParent(target, wrapper);
}

function applyDeleteElement(target: ResolvedTarget): void {
  if (!isChildContainer(target.parent)) {
    throw new EditError(
      `Cannot delete root JSX element (parent is ${target.parent.type})`,
      'cannot-delete-root',
    );
  }
  const children = (target.parent as t.JSXElement | t.JSXFragment).children;
  const idx = children.indexOf(target.node);
  if (idx >= 0) {
    children.splice(idx, 1);
  }
}

function applyMoveElement(
  target: ResolvedTarget,
  newParent: ResolvedTarget,
  position: JSXPosition,
): void {
  if (!isChildContainer(target.parent)) {
    throw new EditError(
      `Cannot move root JSX element (parent is ${target.parent.type})`,
      'invalid-move',
    );
  }
  if (newParent.node.openingElement.selfClosing) {
    throw new EditError(
      `Cannot move into self-closing element <${tagName(newParent.node)} />`,
      'parent-self-closing',
    );
  }
  if (containsNode(target.node, newParent.node)) {
    throw new EditError(
      `Cannot move an element into itself or one of its descendants`,
      'invalid-move',
    );
  }
  // Clone the subtree so the node identity of the original is never attached
  // in two places — avoids recast path invalidation when the same node is
  // removed and re-inserted elsewhere.
  const cloned = t.cloneNode(target.node, /* deep */ true) as t.JSXElement;
  const oldChildren = (target.parent as t.JSXElement | t.JSXFragment).children;
  const oldIdx = oldChildren.indexOf(target.node);
  if (oldIdx >= 0) oldChildren.splice(oldIdx, 1);
  if (position === 'start') {
    newParent.node.children.unshift(cloned);
  } else {
    newParent.node.children.push(cloned);
  }
  ensureClosingElement(newParent.node);
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function buildJSXElement(
  desc: JSXElementDescriptor,
  extraChildren: t.JSXElement[] = [],
): t.JSXElement {
  const attrs: t.JSXAttribute[] = [];
  if (desc.props) {
    for (const [key, value] of Object.entries(desc.props)) {
      attrs.push(t.jsxAttribute(t.jsxIdentifier(key), t.stringLiteral(value)));
    }
  }
  const children: Array<t.JSXText | t.JSXElement> = [];
  if (desc.text) children.push(t.jsxText(desc.text));
  children.push(...extraChildren);

  const hasChildren = children.length > 0;
  const opening = t.jsxOpeningElement(t.jsxIdentifier(desc.tag), attrs, !hasChildren);
  const closing = hasChildren ? t.jsxClosingElement(t.jsxIdentifier(desc.tag)) : null;
  return t.jsxElement(opening, closing, children, !hasChildren);
}

function replaceInParent(target: ResolvedTarget, replacement: t.JSXElement): void {
  const parent = target.parent;
  if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
    const idx = parent.children.indexOf(target.node);
    if (idx >= 0) {
      parent.children[idx] = replacement;
      return;
    }
  }
  // Root-like parents (ReturnStatement.argument, ArrowFunctionExpression.body,
  // VariableDeclarator.init, ParenthesizedExpression.expression,
  // ConditionalExpression.{consequent,alternate}, LogicalExpression.right,
  // etc.). Scan own enumerable props for the reference and swap.
  const asRecord = parent as unknown as Record<string, unknown>;
  for (const key of Object.keys(asRecord)) {
    if (asRecord[key] === target.node) {
      asRecord[key] = replacement;
      return;
    }
  }
  throw new EditError(
    `Could not locate element within parent (${parent.type}) for replacement`,
    'invalid-parent',
  );
}

function ensureClosingElement(element: t.JSXElement): void {
  if (element.openingElement.selfClosing) {
    element.openingElement.selfClosing = false;
    element.selfClosing = false;
  }
  if (!element.closingElement) {
    element.closingElement = t.jsxClosingElement(
      t.cloneNode(element.openingElement.name),
    );
  }
}

function isChildContainer(parent: t.Node): parent is t.JSXElement | t.JSXFragment {
  return t.isJSXElement(parent) || t.isJSXFragment(parent);
}

function containsNode(ancestor: t.JSXElement, candidate: t.Node): boolean {
  if ((ancestor as t.Node) === candidate) return true;
  for (const child of ancestor.children) {
    if (t.isJSXElement(child) && containsNode(child, candidate)) return true;
    if (t.isJSXFragment(child)) {
      for (const inner of child.children) {
        if (t.isJSXElement(inner) && containsNode(inner, candidate)) return true;
      }
    }
  }
  return false;
}

function tagName(el: t.JSXElement): string {
  const name = el.openingElement.name;
  if (t.isJSXIdentifier(name)) return name.name;
  return '?';
}

// Values are always passed as strings from the AI layer. For now we encode
// them as JSX string literals. An expression-value escape hatch (wrapping in
// {}) can be added later if tool schemas gain it.
function jsxAttributeValue(value: string): t.StringLiteral {
  return t.stringLiteral(value);
}
