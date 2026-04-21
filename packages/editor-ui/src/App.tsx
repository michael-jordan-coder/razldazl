import { useEffect, useState } from 'react';
import { PreviewPane } from './PreviewPane.js';
import { Sidebar } from './Sidebar.js';
import { DesignPanel } from './DesignPanel.js';
import { useSelection } from './useSelection.js';
import { useWS } from './useWS.js';
import { useUndo } from './useUndo.js';
import type { ToolCall } from '@product/protocol';

export const App = () => {
  const selectionApi = useSelection();
  const ws = useWS();
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);

  const undo = useUndo({
    client: ws.client,
    onPart: ws.appendPart,
    subscribeToChat: ws.subscribeToChat,
  });

  // After any server-originated file edit, nudge the preview to re-lock the
  // current selection — HMR will have fired by the time this runs.
  useEffect(() => {
    const last = ws.chatParts[ws.chatParts.length - 1];
    if (!last) return;
    if (last.kind === 'file-edit' && selectionApi.selection) {
      const t = setTimeout(() => {
        selectionApi.relock(selectionApi.selection!.source);
      }, 150);
      return () => clearTimeout(t);
    }
    return;
  }, [ws.chatParts, selectionApi]);

  // ⌘Z / ⌘⇧Z hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undo.canUndo) void undo.undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        if (undo.canRedo) void undo.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  const onApplyEdit = async (ops: ToolCall[]) => {
    if (!ws.client || !ws.ready) return;
    setApplying(true);
    try {
      await undo.runAction(async () => {
        await ws.client!.call('astEdit', 'apply', { ops });
      });
      if (selectionApi.selection) {
        setTimeout(() => {
          selectionApi.relock(selectionApi.selection!.source);
        }, 150);
      }
    } finally {
      setApplying(false);
    }
  };

  const onSend = async (message: string) => {
    if (!ws.client || !ws.ready) return;
    setSending(true);
    try {
      ws.appendPart({
        kind: 'text',
        id: `user-${Date.now()}`,
        text: `🧑 ${message}`,
      });
      await undo.runAction(async () => {
        await ws.client!.call('ai', 'runTurn', {
          message,
          context: { selectedSource: selectionApi.selection?.source ?? null },
        });
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex h-full"
      style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
    >
      <Sidebar
        connected={ws.ready}
        previewReady={selectionApi.previewReady}
        selection={selectionApi.selection}
        chatParts={ws.chatParts}
        sending={sending}
        canUndo={undo.canUndo}
        canRedo={undo.canRedo}
        undoCount={undo.stack.length}
        redoCount={undo.redoStack.length}
        onUndo={() => void undo.undo()}
        onRedo={() => void undo.redo()}
        onSend={onSend}
        onClear={() => {
          selectionApi.clear();
          ws.clearChat();
        }}
      />
      <div className="flex-1 relative">
        <PreviewPane iframeRef={selectionApi.iframeRef} selection={selectionApi.selection} />
      </div>
      <DesignPanel
        selection={selectionApi.selection}
        applying={applying}
        onApply={onApplyEdit}
      />
    </div>
  );
};
