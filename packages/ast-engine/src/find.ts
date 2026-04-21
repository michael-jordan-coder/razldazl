// JSX element search — used by the AI's `findJSXElement` tool and by any
// caller that needs to locate editable coordinates without a selection.

import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { JSXSource } from '@product/protocol';

const traverse = (
  (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse
) as typeof _traverse;

export interface JSXElementInfo {
  source: JSXSource;
  tag: string;
  text: string | null;
  className: string | null;
}

export interface FindJSXQuery {
  tag?: string;
  textContains?: string;
  classContains?: string;
}

export function findJSXElements(
  source: string,
  fileName: string,
  query: FindJSXQuery = {},
): JSXElementInfo[] {
  let ast: t.File;
  try {
    ast = babelParse(source, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    return [];
  }

  const results: JSXElementInfo[] = [];
  const tagQ = query.tag?.toLowerCase();
  const textQ = query.textContains?.toLowerCase();
  const classQ = query.classContains?.toLowerCase();

  traverse(ast, {
    JSXElement(path) {
      const opening = path.node.openingElement;
      const loc = opening.loc;
      if (!loc) return;
      const name = opening.name;
      if (name.type !== 'JSXIdentifier') return;
      const tag = name.name;

      if (tagQ && tag.toLowerCase() !== tagQ) return;

      let className: string | null = null;
      for (const attr of opening.attributes) {
        if (
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name) &&
          attr.name.name === 'className' &&
          attr.value &&
          t.isStringLiteral(attr.value)
        ) {
          className = attr.value.value;
          break;
        }
      }
      if (classQ && !(className ?? '').toLowerCase().includes(classQ)) return;

      const children = path.node.children;
      const textOnly = children.length > 0 && children.every((c) => t.isJSXText(c));
      const text = textOnly
        ? children
            .map((c) => (c as t.JSXText).value)
            .join('')
            .trim()
        : null;
      if (textQ && !(text ?? '').toLowerCase().includes(textQ)) return;

      results.push({
        source: {
          fileName,
          lineNumber: loc.start.line,
          columnNumber: loc.start.column + 1,
        },
        tag,
        text,
        className,
      });
    },
  });

  return results;
}
