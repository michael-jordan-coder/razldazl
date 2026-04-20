// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { findSourceForNode } from '../fiber.js';
import type { JSXSource } from '@product/protocol';

declare global {
  interface Window {
    __propsToSource: WeakMap<object, JSXSource>;
  }
}

describe('findSourceForNode', () => {
  beforeEach(() => {
    window.__propsToSource = new WeakMap();
    document.body.innerHTML = '';
  });

  it('returns null when no fiber is present', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(findSourceForNode(el)).toBeNull();
  });

  it('walks up the fiber chain to find the nearest recorded props', () => {
    const source: JSXSource = { fileName: '/App.tsx', lineNumber: 7, columnNumber: 2 };

    const parentProps = { role: 'group' };
    const childProps = { children: 'hi' };
    window.__propsToSource.set(parentProps, source);

    const parentFiber = { return: null, memoizedProps: parentProps, stateNode: null };
    const childFiber = { return: parentFiber, memoizedProps: childProps, stateNode: null };

    const el = document.createElement('span');
    (el as unknown as Record<string, unknown>).__reactFiber$xyz = childFiber;
    document.body.appendChild(el);

    expect(findSourceForNode(el)).toEqual(source);
  });

  it('returns null when no ancestor has a recorded source', () => {
    const fiber = { return: null, memoizedProps: { x: 1 }, stateNode: null };
    const el = document.createElement('span');
    (el as unknown as Record<string, unknown>).__reactFiber$abc = fiber;
    expect(findSourceForNode(el)).toBeNull();
  });
});
