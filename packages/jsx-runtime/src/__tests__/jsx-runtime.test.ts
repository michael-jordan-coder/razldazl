// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { jsxDEV, Fragment } from '../jsx-runtime.js';

describe('jsxDEVKeepSource', () => {
  it('populates window.__propsToSource with each element source', async () => {
    const source = { fileName: '/app/Button.tsx', lineNumber: 12, columnNumber: 4 };
    const element = jsxDEV('button', { children: 'Hi' }, undefined, false, source, undefined);

    expect(window.__propsToSource).toBeInstanceOf(WeakMap);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(window.__propsToSource.get((element as any).props)).toEqual(source);
  });

  it('mounts into DOM without throwing and source survives render', async () => {
    const source = { fileName: '/app/App.tsx', lineNumber: 7, columnNumber: 2 };
    const element = jsxDEV('div', { children: 'rendered' }, undefined, false, source, undefined);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(element);
    });

    expect(host.textContent).toBe('rendered');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(window.__propsToSource.get((element as any).props)).toEqual(source);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('handles Fragment with source by wrapping single child into array', () => {
    const source = {
      fileName: '/app/Frag.tsx',
      lineNumber: 3,
      columnNumber: 1,
    };
    const element = jsxDEV(
      Fragment,
      { children: 'only-child' },
      undefined,
      false,
      source,
      undefined,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (element as any).props as { children: unknown };
    expect(Array.isArray(props.children)).toBe(true);
    expect(window.__propsToSource.get(props.children as object)).toEqual(source);
  });
});
