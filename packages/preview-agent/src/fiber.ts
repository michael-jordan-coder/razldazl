// React fiber walk: DOM node → JSXSource via window.__propsToSource.
//
// Each DOM node rendered by React carries a `__reactFiber$<n>` own-property
// linking it to its Fiber. `memoizedProps` on the Fiber is the exact props
// object that @product/jsx-runtime used as a WeakMap key, so we can look up
// the source triple in O(ancestors).

import type { JSXSource } from '@product/protocol';

interface Fiber {
  return: Fiber | null;
  memoizedProps: unknown;
  stateNode: unknown;
}

function getFiber(node: Element): Fiber | null {
  for (const key of Object.keys(node)) {
    if (key.startsWith('__reactFiber$')) {
      return (node as unknown as Record<string, Fiber>)[key] ?? null;
    }
  }
  // Fallback for text-node parents or shadow hosts: inspect own-properties
  // with getOwnPropertyNames — some bundlers mangle key enumeration.
  for (const key of Object.getOwnPropertyNames(node)) {
    if (key.startsWith('__reactFiber$')) {
      return (node as unknown as Record<string, Fiber>)[key] ?? null;
    }
  }
  return null;
}

export function findSourceForNode(node: Element): JSXSource | null {
  const map = (window as Window & { __propsToSource?: WeakMap<object, JSXSource> })
    .__propsToSource;
  if (!map) return null;

  let fiber: Fiber | null = getFiber(node);
  while (fiber) {
    const props = fiber.memoizedProps;
    if (props && typeof props === 'object') {
      const src = map.get(props as object);
      if (src) return src;
    }
    fiber = fiber.return;
  }
  return null;
}

export function findNodeForSource(source: JSXSource): Element | null {
  // Linear scan is fine for the first slice. If hot paths need it, we can
  // maintain a reverse index: source → Set<Element> via a MutationObserver.
  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i] as Element;
    const src = findSourceForNode(el);
    if (
      src &&
      src.fileName === source.fileName &&
      src.lineNumber === source.lineNumber &&
      src.columnNumber === source.columnNumber
    ) {
      return el;
    }
  }
  return null;
}
