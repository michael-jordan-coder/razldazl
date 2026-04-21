// The preview agent runs inside the preview iframe and bridges user
// interactions + React state to the editor via postMessage.
//
// Responsibilities:
//   - On click: find source for clicked node, send `selected` to parent.
//   - On `relock` message: re-find the DOM node for the given source, reply
//     with an updated rect.
//   - Render a minimal selection overlay inside the preview.
//   - Report `ready` on startup and `rerendered` after HMR.

import {
  editorToPreviewSchema,
  previewToEditorSchema,
  type EditorToPreview,
  type JSXSource,
  type PreviewToEditor,
} from '@product/protocol';
import { findNodeForSource, findSourceForNode } from './fiber.js';

export interface AgentHandle {
  dispose(): void;
}

const OVERLAY_ID = '__product_agent_overlay';

export function initAgent(): AgentHandle {
  const overlay = ensureOverlay();
  let currentSource: JSXSource | null = null;
  let mode: 'edit' | 'preview' = 'edit';

  const send = (msg: PreviewToEditor) => {
    const parsed = previewToEditorSchema.safeParse(msg);
    if (!parsed.success) return;
    window.parent?.postMessage(parsed.data, '*');
  };

  const onClick = (ev: MouseEvent) => {
    if (mode !== 'edit') return;
    if (!(ev.target instanceof Element)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const source = findSourceForNode(ev.target);
    if (!source) return;
    currentSource = source;
    placeOverlay(overlay, ev.target);
    send(buildSelectedMessage(ev.target, source));
  };

  const onMessage = (ev: MessageEvent) => {
    const parsed = editorToPreviewSchema.safeParse(ev.data);
    if (!parsed.success) return;
    handleInbound(parsed.data);
  };

  const handleInbound = (msg: EditorToPreview) => {
    if (msg.kind === 'clear') {
      currentSource = null;
      hideOverlay(overlay);
      send({ kind: 'cleared' });
      return;
    }
    if (msg.kind === 'mode') {
      mode = msg.mode;
      if (mode === 'preview') {
        // Hide the overlay but keep currentSource so entering edit again
        // can re-lock the last selection.
        hideOverlay(overlay);
      } else if (currentSource) {
        const node = findNodeForSource(currentSource);
        if (node) placeOverlay(overlay, node);
      }
      return;
    }
    if (msg.kind === 'relock') {
      currentSource = msg.source;
      const node = findNodeForSource(msg.source);
      if (!node) {
        hideOverlay(overlay);
        send({ kind: 'cleared' });
        return;
      }
      placeOverlay(overlay, node);
      send(buildSelectedMessage(node, msg.source));
    }
  };

  window.addEventListener('click', onClick, true);
  window.addEventListener('message', onMessage);

  // If Vite HMR is available, re-lock selection after each module update.
  // `import.meta.hot` is provided by Vite; we access it defensively.
  const hot = (import.meta as unknown as { hot?: { on: (e: string, cb: () => void) => void } })
    .hot;
  if (hot) {
    hot.on('vite:afterUpdate', () => {
      if (!currentSource) return;
      // Schedule after React renders.
      queueMicrotask(() => {
        const node = findNodeForSource(currentSource!);
        if (!node) {
          hideOverlay(overlay);
          send({ kind: 'cleared' });
          send({ kind: 'rerendered' });
          return;
        }
        placeOverlay(overlay, node);
        send(buildSelectedMessage(node, currentSource!));
        send({ kind: 'rerendered' });
      });
    });
  }

  send({ kind: 'ready' });

  return {
    dispose() {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('message', onMessage);
      overlay.remove();
    },
  };
}

function buildSelectedMessage(node: Element, source: JSXSource): PreviewToEditor {
  const rect = node.getBoundingClientRect();
  return {
    kind: 'selected',
    source,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    tag: node.tagName.toLowerCase(),
    text: extractTextContent(node),
    className: node.getAttribute('class'),
  };
}

// If every child is a text node, return the concatenated text; otherwise
// null (the element has structural children and text editing would drop them).
function extractTextContent(node: Element): string | null {
  if (node.childNodes.length === 0) return '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]!;
    if (child.nodeType !== Node.TEXT_NODE) return null;
  }
  return node.textContent ?? '';
}

function ensureOverlay(): HTMLDivElement {
  const existing = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  Object.assign(el.style, {
    position: 'fixed',
    pointerEvents: 'none',
    border: '2px solid #7c5cff',
    background: 'rgba(124, 92, 255, 0.12)',
    borderRadius: '2px',
    transition: 'all 120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    zIndex: '2147483647',
    display: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.documentElement.appendChild(el);
  return el;
}

function placeOverlay(overlay: HTMLDivElement, node: Element): void {
  const rect = node.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.left = `${rect.x}px`;
  overlay.style.top = `${rect.y}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function hideOverlay(overlay: HTMLDivElement): void {
  overlay.style.display = 'none';
}
