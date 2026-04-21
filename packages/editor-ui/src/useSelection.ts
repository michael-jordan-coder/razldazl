import { useEffect, useRef, useState } from 'react';
import { previewToEditorSchema, type JSXSource } from '@product/protocol';
import { PREVIEW_URL } from './config.js';

export interface Selection {
  source: JSXSource;
  rect: { x: number; y: number; width: number; height: number };
  tag: string;
  text: string | null;
  className: string | null;
}

export function useSelection(): {
  selection: Selection | null;
  previewReady: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  relock(source: JSXSource): void;
  clear(): void;
} {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== new URL(PREVIEW_URL).origin) return;
      const parsed = previewToEditorSchema.safeParse(ev.data);
      if (!parsed.success) return;
      const msg = parsed.data;
      if (msg.kind === 'ready') setPreviewReady(true);
      else if (msg.kind === 'selected')
        setSelection({
          source: msg.source,
          rect: msg.rect,
          tag: msg.tag,
          text: msg.text,
          className: msg.className,
        });
      else if (msg.kind === 'cleared') setSelection(null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return {
    selection,
    previewReady,
    iframeRef,
    relock(source) {
      iframeRef.current?.contentWindow?.postMessage({ kind: 'relock', source }, PREVIEW_URL);
    },
    clear() {
      iframeRef.current?.contentWindow?.postMessage({ kind: 'clear' }, PREVIEW_URL);
    },
  };
}
