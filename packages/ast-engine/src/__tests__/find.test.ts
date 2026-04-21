import { describe, it, expect } from 'vitest';
import { findJSXElements } from '../find.js';

const sample = `export const App = () => (
  <main className="min-h-screen bg-slate-50">
    <h1 className="text-2xl">Welcome</h1>
    <div className="flex gap-2">
      <button className="bg-slate-900 text-white">Primary</button>
      <button className="border">Secondary</button>
    </div>
  </main>
);
`;

describe('findJSXElements', () => {
  it('returns all elements when no query', () => {
    const out = findJSXElements(sample, '/App.tsx');
    expect(out.map((r) => r.tag)).toEqual(['main', 'h1', 'div', 'button', 'button']);
  });

  it('filters by tag', () => {
    const out = findJSXElements(sample, '/App.tsx', { tag: 'button' });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.tag === 'button')).toBe(true);
  });

  it('filters by textContains (case-insensitive)', () => {
    const out = findJSXElements(sample, '/App.tsx', { textContains: 'primary' });
    expect(out).toHaveLength(1);
    expect(out[0]!.tag).toBe('button');
    expect(out[0]!.text).toBe('Primary');
  });

  it('filters by classContains', () => {
    const out = findJSXElements(sample, '/App.tsx', { classContains: 'bg-slate-900' });
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe('Primary');
  });

  it('reports 1-indexed source coords', () => {
    const out = findJSXElements(sample, '/App.tsx', { tag: 'h1' });
    expect(out[0]!.source).toEqual({
      fileName: '/App.tsx',
      lineNumber: 3,
      columnNumber: 5,
    });
  });
});
