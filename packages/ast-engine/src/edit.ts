// Source-coord-preserving AST editor. This is the correctness core of the
// whole product: after applying any edit, every non-edited JSX element's
// {line, column} in the output must match its position in the input. If this
// invariant breaks, __propsToSource goes stale on HMR and click-to-source
// regresses silently.
//
// We achieve this by using recast, which only reprints nodes it detects as
// modified and preserves original source for untouched nodes verbatim.

import { readFile, writeFile } from 'node:fs/promises';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { parse as recastParse, print as recastPrint } from 'recast';
import type { ToolCall, JSXSource } from '@product/protocol';

// @babel/traverse's default export is CJS-interop-friendly but ships as a
// namespace object under ESM with `.default`. Normalize.
const traverse = (
  (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse
) as typeof _traverse;

export class EditError extends Error {
  constructor(
    message: string,
    readonly code: 'node-not-found' | 'unsupported-value' | 'parse-failed',
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

  for (const op of ops) {
    applyOp(ast, op);
  }

  return recastPrint(ast).code;
}

function applyOp(ast: t.File, op: ToolCall): void {
  switch (op.tool) {
    case 'setJSXProp':
      setJSXProp(ast, op.args.source, op.args.prop, op.args.value);
      return;
    case 'updateJSXText':
      updateJSXText(ast, op.args.source, op.args.text);
      return;
  }
}

function findJSXElement(ast: t.File, source: JSXSource): t.JSXElement {
  let found: t.JSXElement | null = null;
  traverse(ast, {
    JSXElement(path) {
      const loc = path.node.openingElement.loc ?? path.node.loc;
      if (!loc) return;
      if (loc.start.line === source.lineNumber && loc.start.column === source.columnNumber) {
        found = path.node;
        path.stop();
      }
    },
  });
  if (!found) {
    throw new EditError(
      `No JSX element at ${source.fileName}:${source.lineNumber}:${source.columnNumber}`,
      'node-not-found',
    );
  }
  return found;
}

function setJSXProp(ast: t.File, source: JSXSource, prop: string, value: string): void {
  const element = findJSXElement(ast, source);
  const opening = element.openingElement;
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

function updateJSXText(ast: t.File, source: JSXSource, text: string): void {
  const element = findJSXElement(ast, source);
  element.children = [t.jsxText(text)];
  // When only children are text, closing tag is required; ensure it.
  element.openingElement.selfClosing = false;
  if (!element.closingElement) {
    element.closingElement = t.jsxClosingElement(t.cloneNode(element.openingElement.name));
  }
}

// Values are always passed as strings from the AI layer. For now we encode
// them as JSX string literals. An expression-value escape hatch (wrapping in
// {}) can be added later if tool schemas gain it.
function jsxAttributeValue(value: string): t.StringLiteral {
  return t.stringLiteral(value);
}
