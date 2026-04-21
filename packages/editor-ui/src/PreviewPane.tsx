import type { RefObject } from 'react';
import { PREVIEW_URL } from './config.js';
import type { Selection } from './useSelection.js';

export interface PreviewPaneProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  selection: Selection | null;
}

export const PreviewPane = ({ iframeRef, selection }: PreviewPaneProps) => {
  return (
    <div className="relative h-full w-full" style={{ background: 'var(--ui-bg-hover)' }}>
      <iframe
        ref={iframeRef}
        src={PREVIEW_URL}
        title="preview"
        className="h-full w-full border-0 bg-white"
      />
      {selection && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: selection.rect.x,
            top: selection.rect.y,
            width: selection.rect.width,
            height: selection.rect.height,
            boxShadow: '0 0 0 1.5px var(--ui-accent)',
            transition: 'all 120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />
      )}
    </div>
  );
};
