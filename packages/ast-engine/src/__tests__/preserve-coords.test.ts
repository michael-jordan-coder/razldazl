// THE critical test. For every edit we apply, every JSX element *other than*
// the edited one must keep the same {line, column}. If this ever regresses,
// __propsToSource goes stale on HMR and the whole product breaks silently.
//
// Strategy: parse input, snapshot every JSXElement's loc; apply edit; re-parse
// output; assert loc of every non-edited element is unchanged.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { applyEdits } from '../edit.js';
import type { ToolCall } from '@product/protocol';

const traverse = (
  (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse
) as typeof _traverse;

interface Loc {
  line: number;
  column: number;
  tag: string;
}

function collectJSXLocs(source: string): Loc[] {
  const ast = babelParse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    tokens: true,
  });
  const locs: Loc[] = [];
  traverse(ast, {
    JSXElement(path) {
      const opening = path.node.openingElement;
      const loc = opening.loc ?? path.node.loc;
      if (!loc) return;
      const name = opening.name;
      let tag = '?';
      if (name.type === 'JSXIdentifier') tag = name.name;
      else if (name.type === 'JSXMemberExpression') tag = 'member';
      else if (name.type === 'JSXNamespacedName') tag = 'ns';
      // Report column as 1-indexed to match JSXSource convention used by the
      // edit engine and AI tools.
      locs.push({ line: loc.start.line, column: loc.start.column + 1, tag });
    },
  });
  return locs;
}

const fixtures = [
  `export const A = () => (
  <div>
    <button className="a">one</button>
    <span>two</span>
    <p>three</p>
  </div>
);
`,
  `export const B = () => (
  <section>
    <header className="hdr">
      <h1>Title</h1>
    </header>
    <main>
      <article>
        <p className="leading-6">Paragraph one.</p>
        <p>Paragraph two.</p>
      </article>
    </main>
  </section>
);
`,
  `import { Button } from './Button';
export const C = () => {
  const label = 'x';
  return (
    <div className="grid">
      <Button variant="primary">Save</Button>
      <Button variant="ghost">Cancel</Button>
      <div>
        <span>{label}</span>
      </div>
    </div>
  );
};
`,
];

describe('coordinate preservation', () => {
  for (const [i, fixture] of fixtures.entries()) {
    it(`keeps every non-edited element's line/column stable after setJSXProp (fixture #${i})`, () => {
      const before = collectJSXLocs(fixture);
      expect(before.length).toBeGreaterThan(1);

      // Edit the second element (so there are neighbors on either side)
      const target = before[1]!;
      const op: ToolCall = {
        tool: 'setJSXProp',
        args: {
          source: { fileName: 'x.tsx', lineNumber: target.line, columnNumber: target.column },
          prop: 'data-test',
          value: 'touched',
        },
      };

      const edited = applyEdits(fixture, [op]);
      const after = collectJSXLocs(edited);

      expect(after.length).toBe(before.length);

      for (let idx = 0; idx < before.length; idx++) {
        if (idx === 1) continue; // skip the edited element
        expect({ idx, ...after[idx]! }).toEqual({ idx, ...before[idx]! });
      }
    });

    it(`keeps every non-edited element's line/column stable after updateJSXText (fixture #${i})`, () => {
      const before = collectJSXLocs(fixture);
      // Pick a leaf (no JSXElement children) so the edit doesn't remove other
      // tracked nodes. The last collected element in a post-order walk is
      // reliably a leaf for the fixtures here.
      const leafIndex = before.length - 1;
      const target = before[leafIndex]!;
      const op: ToolCall = {
        tool: 'updateJSXText',
        args: {
          source: { fileName: 'x.tsx', lineNumber: target.line, columnNumber: target.column },
          text: 'NEW',
        },
      };

      const edited = applyEdits(fixture, [op]);
      const after = collectJSXLocs(edited);

      expect(after.length).toBe(before.length);

      for (let idx = 0; idx < before.length; idx++) {
        if (idx === leafIndex) continue;
        expect({ idx, ...after[idx]! }).toEqual({ idx, ...before[idx]! });
      }
    });
  }

  // Property-based: random class-name values across a realistic fixture.
  it('preserves coords for random className values (property-based)', () => {
    const fixture = fixtures[1]!;
    const before = collectJSXLocs(fixture);
    const target = before[2]!;

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => !/[<>"{}\\]/.test(s)),
        (value) => {
          const edited = applyEdits(fixture, [
            {
              tool: 'setJSXProp',
              args: {
                source: {
                  fileName: 'x.tsx',
                  lineNumber: target.line,
                  columnNumber: target.column,
                },
                prop: 'className',
                value,
              },
            },
          ]);
          const after = collectJSXLocs(edited);
          if (after.length !== before.length) return false;
          for (let idx = 0; idx < before.length; idx++) {
            if (idx === 2) continue;
            const a = after[idx]!;
            const b = before[idx]!;
            if (a.line !== b.line || a.column !== b.column) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Weaker invariant for structural edits: elements strictly *before* the
// mutation anchor retain their coords. Elements at or after may shift —
// HMR regenerates __source and the preview-agent re-locks selection from
// the refreshed map, so downstream wiring stays correct.
// ---------------------------------------------------------------------------

function assertAboveAnchorStable(beforeLocs: Loc[], afterLocs: Loc[], anchorLine: number): void {
  // Match elements by source-order index among those at lines < anchorLine.
  const beforeAbove = beforeLocs.filter((l) => l.line < anchorLine);
  const afterAbove = afterLocs.filter((l) => l.line < anchorLine);
  expect(afterAbove.length).toBe(beforeAbove.length);
  for (let i = 0; i < beforeAbove.length; i++) {
    expect({ i, ...afterAbove[i]! }).toEqual({ i, ...beforeAbove[i]! });
  }
}

describe('coordinate preservation — structural ops (above-anchor invariant)', () => {
  const structural = `export const S = () => (
  <section>
    <header>
      <h1>Title</h1>
    </header>
    <main>
      <article>
        <p>body</p>
      </article>
    </main>
  </section>
);
`;

  it('addElement at end of a mid-tree parent preserves coords above the parent', () => {
    const before = collectJSXLocs(structural);
    const parent = before.find((l) => l.tag === 'article')!;
    const edited = applyEdits(structural, [
      {
        tool: 'addElement',
        args: {
          parent: { fileName: 'x.tsx', lineNumber: parent.line, columnNumber: parent.column },
          position: 'end',
          element: { tag: 'footer', text: 'end' },
        },
      },
    ]);
    const after = collectJSXLocs(edited);
    assertAboveAnchorStable(before, after, parent.line);
  });

  it('wrapElement preserves coords above the target', () => {
    const before = collectJSXLocs(structural);
    const target = before.find((l) => l.tag === 'article')!;
    const edited = applyEdits(structural, [
      {
        tool: 'wrapElement',
        args: {
          target: { fileName: 'x.tsx', lineNumber: target.line, columnNumber: target.column },
          wrapper: { tag: 'div', props: { className: 'card' } },
        },
      },
    ]);
    const after = collectJSXLocs(edited);
    assertAboveAnchorStable(before, after, target.line);
  });

  it('deleteElement preserves coords above the target', () => {
    const before = collectJSXLocs(structural);
    const target = before.find((l) => l.tag === 'header')!;
    const edited = applyEdits(structural, [
      {
        tool: 'deleteElement',
        args: {
          target: { fileName: 'x.tsx', lineNumber: target.line, columnNumber: target.column },
        },
      },
    ]);
    const after = collectJSXLocs(edited);
    assertAboveAnchorStable(before, after, target.line);
  });

  it('moveElement preserves coords above the earliest mutation point', () => {
    const before = collectJSXLocs(structural);
    // Move <p> (inside article) to be a child of <header>.
    const target = before.find((l) => l.tag === 'p')!;
    const newParent = before.find((l) => l.tag === 'header')!;
    const edited = applyEdits(structural, [
      {
        tool: 'moveElement',
        args: {
          target: { fileName: 'x.tsx', lineNumber: target.line, columnNumber: target.column },
          newParent: {
            fileName: 'x.tsx',
            lineNumber: newParent.line,
            columnNumber: newParent.column,
          },
          position: 'end',
        },
      },
    ]);
    const after = collectJSXLocs(edited);
    const anchor = Math.min(target.line, newParent.line);
    assertAboveAnchorStable(before, after, anchor);
  });
});
