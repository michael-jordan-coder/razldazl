import { describe, it, expect } from 'vitest';
import { applyEdits } from '../edit.js';

const sample = `export const App = () => (
  <div>
    <button className="px-2">Click</button>
    <span>Hello</span>
  </div>
);
`;

describe('applyEdits — setJSXProp', () => {
  it('updates an existing attribute', () => {
    const out = applyEdits(sample, [
      {
        tool: 'setJSXProp',
        args: {
          // columnNumber is 1-indexed (matches React's __source convention).
          source: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 },
          prop: 'className',
          value: 'px-2 text-xl',
        },
      },
    ]);
    expect(out).toContain('className="px-2 text-xl"');
    expect(out).not.toContain('className="px-2"');
  });

  it('adds a missing attribute', () => {
    const out = applyEdits(sample, [
      {
        tool: 'setJSXProp',
        args: {
          source: { fileName: '/x.tsx', lineNumber: 4, columnNumber: 5 },
          prop: 'className',
          value: 'font-bold',
        },
      },
    ]);
    expect(out).toMatch(/<span\s+className="font-bold">Hello<\/span>/);
  });

  it('throws EditError when no JSX element matches the coordinates', () => {
    expect(() =>
      applyEdits(sample, [
        {
          tool: 'setJSXProp',
          args: {
            source: { fileName: '/x.tsx', lineNumber: 99, columnNumber: 0 },
            prop: 'x',
            value: 'y',
          },
        },
      ]),
    ).toThrow(/No JSX element/);
  });
});

describe('applyEdits — updateJSXText', () => {
  it('replaces the text of a JSX element', () => {
    const out = applyEdits(sample, [
      {
        tool: 'updateJSXText',
        args: {
          source: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 },
          text: 'Subscribe',
        },
      },
    ]);
    expect(out).toContain('>Subscribe<');
    expect(out).not.toContain('>Click<');
  });
});

describe('applyEdits — addElement', () => {
  it('appends a child to an existing parent', () => {
    const out = applyEdits(sample, [
      {
        tool: 'addElement',
        args: {
          parent: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
          position: 'end',
          element: { tag: 'p', text: 'footer' },
        },
      },
    ]);
    expect(out).toMatch(/<p>footer<\/p>/);
    // Appended after the span, before </div>.
    expect(out.indexOf('<p>footer')).toBeGreaterThan(out.indexOf('<span>'));
    expect(out.indexOf('<p>footer')).toBeLessThan(out.indexOf('</div>'));
  });

  it('prepends a child at the start of a parent', () => {
    const out = applyEdits(sample, [
      {
        tool: 'addElement',
        args: {
          parent: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
          position: 'start',
          element: { tag: 'h1', props: { className: 'text-xl' }, text: 'Title' },
        },
      },
    ]);
    expect(out).toContain('<h1 className="text-xl">Title</h1>');
    expect(out.indexOf('<h1')).toBeLessThan(out.indexOf('<button'));
  });
});

describe('applyEdits — wrapElement', () => {
  it('wraps a target element in a new parent', () => {
    const out = applyEdits(sample, [
      {
        tool: 'wrapElement',
        args: {
          target: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 },
          wrapper: { tag: 'div', props: { className: 'wrapper' } },
        },
      },
    ]);
    expect(out).toContain('<div className="wrapper">');
    // Wrapper contains the original button as its child.
    expect(out).toMatch(/<div className="wrapper">\s*<button[^>]*>Click<\/button>\s*<\/div>/);
  });
});

describe('applyEdits — deleteElement', () => {
  it('removes a sibling element', () => {
    const out = applyEdits(sample, [
      {
        tool: 'deleteElement',
        args: {
          target: { fileName: '/x.tsx', lineNumber: 4, columnNumber: 5 },
        },
      },
    ]);
    expect(out).not.toContain('<span>Hello</span>');
    expect(out).toContain('<button className="px-2">Click</button>');
  });

  it('rejects deleting the root JSX element of a return', () => {
    const rootReturn = `export const R = () => (\n  <div>hi</div>\n);\n`;
    expect(() =>
      applyEdits(rootReturn, [
        {
          tool: 'deleteElement',
          args: {
            target: { fileName: '/x.tsx', lineNumber: 2, columnNumber: 3 },
          },
        },
      ]),
    ).toThrow(/Cannot delete root JSX element/);
  });
});

describe('applyEdits — moveElement', () => {
  const twoParents = `export const P = () => (
  <section>
    <div id="a">
      <button>move me</button>
    </div>
    <div id="b">
    </div>
  </section>
);
`;

  it('moves an element from one parent to another', () => {
    const out = applyEdits(twoParents, [
      {
        tool: 'moveElement',
        args: {
          // <button> on line 4, col 7
          target: { fileName: '/x.tsx', lineNumber: 4, columnNumber: 7 },
          // <div id="b"> on line 6, col 5
          newParent: { fileName: '/x.tsx', lineNumber: 6, columnNumber: 5 },
          position: 'end',
        },
      },
    ]);
    // Button now inside <div id="b">
    expect(out).toMatch(
      /<div id="b">\s*<button>move me<\/button>\s*<\/div>/,
    );
    // And removed from <div id="a">
    expect(out).toMatch(/<div id="a">\s*<\/div>/);
  });

  it('rejects moving an element into one of its descendants', () => {
    // <div id="outer"> is NOT the root — <main> is. So the target has a real
    // parent (<main>); the rejection comes from the descendant-cycle check.
    const src = `export const R = () => (
  <main>
    <div id="outer">
      <div id="inner">hi</div>
    </div>
  </main>
);
`;
    expect(() =>
      applyEdits(src, [
        {
          tool: 'moveElement',
          args: {
            target: { fileName: '/x.tsx', lineNumber: 3, columnNumber: 5 },
            newParent: { fileName: '/x.tsx', lineNumber: 4, columnNumber: 7 },
            position: 'end',
          },
        },
      ]),
    ).toThrow(/into itself/);
  });
});
