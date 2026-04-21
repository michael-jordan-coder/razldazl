// Edge-case coverage for the four structural ops. The happy paths for each
// are in edit.test.ts; this file focuses on error conditions, batch semantics,
// and the one non-obvious case — wrapping the root element of a component's
// return value.

import { describe, it, expect } from 'vitest';
import { applyEdits, EditError } from '../edit.js';
import type { ToolCall } from '@product/protocol';

describe('addElement edge cases', () => {
  it('rejects when parent is self-closing', () => {
    const src = `export const X = () => (\n  <img src="/a.png" />\n);\n`;
    expect(() =>
      applyEdits(src, [
        {
          tool: 'addElement',
          args: {
            parent: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
            position: 'end',
            element: { tag: 'span', text: 'label' },
          },
        },
      ]),
    ).toThrow(EditError);
  });

  it('builds an element with multiple props and text', () => {
    const src = `export const X = () => (\n  <div>\n  </div>\n);\n`;
    const out = applyEdits(src, [
      {
        tool: 'addElement',
        args: {
          parent: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
          position: 'end',
          element: {
            tag: 'a',
            props: { href: '/home', className: 'text-blue-600' },
            text: 'home',
          },
        },
      },
    ]);
    expect(out).toContain('href="/home"');
    expect(out).toContain('className="text-blue-600"');
    expect(out).toContain('>home</a>');
  });

  it('creates a self-closing child when no text is given', () => {
    const src = `export const X = () => (\n  <div>\n  </div>\n);\n`;
    const out = applyEdits(src, [
      {
        tool: 'addElement',
        args: {
          parent: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
          position: 'end',
          element: { tag: 'hr' },
        },
      },
    ]);
    expect(out).toMatch(/<hr\s*\/>/);
  });
});

describe('wrapElement edge cases', () => {
  it('wraps the root element of a component return', () => {
    const src = `export const R = () => (\n  <div className="inner">hi</div>\n);\n`;
    const out = applyEdits(src, [
      {
        tool: 'wrapElement',
        args: {
          target: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
          wrapper: { tag: 'section', props: { className: 'outer' } },
        },
      },
    ]);
    // Root is now <section className="outer"> containing the original <div>.
    expect(out).toMatch(/<section className="outer">/);
    expect(out).toMatch(/<div className="inner">hi<\/div>/);
    // Section appears before div in the output.
    expect(out.indexOf('<section')).toBeLessThan(out.indexOf('<div'));
  });

  it('preserves the target subtree verbatim', () => {
    const src = `export const P = () => (
  <main>
    <article>
      <h1 className="title">Post</h1>
      <p>body</p>
    </article>
  </main>
);
`;
    const out = applyEdits(src, [
      {
        tool: 'wrapElement',
        args: {
          target: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 },
          wrapper: { tag: 'div', props: { className: 'card' } },
        },
      },
    ]);
    // Children of article are intact.
    expect(out).toContain('<h1 className="title">Post</h1>');
    expect(out).toContain('<p>body</p>');
    // Wrapper is the new direct child of <main>.
    expect(out).toMatch(/<main>\s*<div className="card">/);
  });
});

describe('deleteElement edge cases', () => {
  it('rejects deleting root of an arrow-body return', () => {
    const src = `export const A = () => <div>hi</div>;\n`;
    expect(() =>
      applyEdits(src, [
        {
          tool: 'deleteElement',
          args: { target: { fileName: '/x.tsx', lineNumber: 1, columnNumber: 24 } },
        },
      ]),
    ).toThrow(/Cannot delete root/);
  });
});

describe('moveElement edge cases', () => {
  it('rejects moving the root element', () => {
    const src = `export const R = () => (\n  <div>\n    <span>x</span>\n  </div>\n);\n`;
    expect(() =>
      applyEdits(src, [
        {
          tool: 'moveElement',
          args: {
            target: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
            newParent: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 },
            position: 'end',
          },
        },
      ]),
    ).toThrow(/root JSX element|into itself/);
  });
});

describe('batch semantics', () => {
  // Coords in every op refer to the PRE-batch source. The engine resolves all
  // target node references up front, so a later op's coord arithmetic is not
  // invalidated by an earlier op's structural mutation.
  it('mixes a delete with a subsequent setJSXProp without coord drift', () => {
    const src = `export const M = () => (
  <div>
    <button className="a">A</button>
    <span className="b">B</span>
    <p className="c">C</p>
  </div>
);
`;
    const ops: ToolCall[] = [
      // Delete the <button> on line 3.
      {
        tool: 'deleteElement',
        args: { target: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 } },
      },
      // Then set className on <p> — its pre-batch coord is line 5, col 5.
      // A naive re-resolve after delete would find the <span> at line 5 now.
      {
        tool: 'setJSXProp',
        args: {
          source: { fileName: '/x.tsx', lineNumber: 5, columnNumber: 5 },
          prop: 'className',
          value: 'c updated',
        },
      },
    ];
    const out = applyEdits(src, ops);
    expect(out).not.toContain('<button');
    expect(out).toContain('<span className="b">B</span>');
    expect(out).toContain('<p className="c updated">C</p>');
  });
});
