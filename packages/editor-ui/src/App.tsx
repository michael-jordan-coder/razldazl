import { useEffect, useState } from 'react';
import { PreviewPane } from './PreviewPane.js';
import { Sidebar } from './Sidebar.js';
import { useSelection } from './useSelection.js';
import { useWS } from './useWS.js';
import type { ChatPart } from '@product/protocol';

export const App = () => {
  const selectionApi = useSelection();
  const ws = useWS();
  const [sending, setSending] = useState(false);

  // After a file edit, nudge the preview to re-lock the currently selected
  // element by its source. HMR will normally have fired by the time this
  // runs, so findNodeForSource has the fresh DOM to scan.
  useEffect(() => {
    const last = ws.chatParts[ws.chatParts.length - 1];
    if (!last) return;
    if (last.kind === 'file-edit' && selectionApi.selection) {
      // Give Vite HMR a tick to rebuild.
      const t = setTimeout(() => {
        selectionApi.relock(selectionApi.selection!.source);
      }, 150);
      return () => clearTimeout(t);
    }
    return;
  }, [ws.chatParts, selectionApi]);

  const onSend = async (message: string) => {
    if (!ws.client || !ws.ready) return;
    setSending(true);
    try {
      appendLocalPart(ws, {
        kind: 'text',
        id: `user-${Date.now()}`,
        text: `🧑 ${message}`,
      });
      await ws.client.call('ai', 'runTurn', {
        message,
        context: { selectedSource: selectionApi.selection?.source ?? null },
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100">
      <div className="flex-1 relative">
        <PreviewPane iframeRef={selectionApi.iframeRef} selection={selectionApi.selection} />
      </div>
      <Sidebar
        connected={ws.ready}
        previewReady={selectionApi.previewReady}
        selection={selectionApi.selection}
        chatParts={ws.chatParts}
        sending={sending}
        onSend={onSend}
        onClear={() => {
          selectionApi.clear();
          ws.clearChat();
        }}
      />
    </div>
  );
};

// Local-echo helper — shoves a synthetic part into the chat log so the user
// sees their own message without waiting on the server round-trip.
function appendLocalPart(ws: ReturnType<typeof useWS>, part: ChatPart): void {
  // We don't have a setter exposed; route through the chat event namespace by
  // faking a dispatch. In practice we'd refactor useWS to expose an appender,
  // but keeping the public API minimal for now.
  (ws as unknown as { chatParts: ChatPart[] }).chatParts.push(part);
}
