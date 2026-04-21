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
