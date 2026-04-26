import { useCallback, useEffect, useState } from 'react';
import { PreviewPane } from './PreviewPane.js';
import { Sidebar } from './Sidebar.js';
import { DesignPanel } from './DesignPanel.js';
import { Toolbar, type EditorMode } from './Toolbar.js';
import { FloatingToolbar } from './FloatingToolbar.js';
import { ComponentPicker } from './ComponentPicker.js';
import { useSelection } from './useSelection.js';
import { useWS } from './useWS.js';
import { useUndo } from './useUndo.js';
import type { JSXElementDescriptor, ToolCall } from '@product/protocol';

export const App = () => {
  const selectionApi = useSelection();
  const ws = useWS();
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);

  const undo = useUndo({
    client: ws.client,
    onPart: ws.appendPart,
    subscribeToChat: ws.subscribeToChat,
  });

  // Sync mode to the preview agent whenever it changes OR the preview
  // finishes loading (in case preview reloaded after HMR / refresh).
  useEffect(() => {
    if (!selectionApi.previewReady) return;
    selectionApi.setMode(mode);
  }, [mode, selectionApi.previewReady, selectionApi]);

  useEffect(() => {
    const last = ws.chatParts[ws.chatParts.length - 1];
    if (!last) return;
    if (last.kind === 'file-edit' && selectionApi.selection && mode === 'edit') {
      const t = setTimeout(() => {
        selectionApi.relock(selectionApi.selection!.source);
      }, 150);
      return () => clearTimeout(t);
    }
    return;
  }, [ws.chatParts, selectionApi, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undo.canUndo) void undo.undo();
      } else if (meta && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        if (undo.canRedo) void undo.redo();
      } else if (e.key === 'v' && !meta && !isTypingTarget(e.target)) {
        e.preventDefault();
        setMode((m) => (m === 'edit' ? 'preview' : 'edit'));
      } else if (e.key === 'c' && !meta && !isTypingTarget(e.target)) {
        e.preventDefault();
        setComponentPickerOpen((o) => !o);
      } else if (e.key === 'Escape' && mode === 'preview') {
        setMode('edit');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, mode]);

  const onApplyEdit = useCallback(
    async (ops: ToolCall[]) => {
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
    },
    [ws.client, ws.ready, undo, selectionApi]
  );

  const onInsertComponent = useCallback(
    (descriptor: JSXElementDescriptor) => {
      const selected = selectionApi.selection;
      if (!selected) return;
      void onApplyEdit([
        {
          tool: 'addElement',
          args: {
            parent: selected.source,
            position: 'end',
            element: descriptor,
          },
        },
      ]);
    },
    [selectionApi.selection, onApplyEdit]
  );

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

  const panelsVisible = mode === 'edit';

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
    >
      <Toolbar connected={ws.ready} previewReady={selectionApi.previewReady} />
      <div className="flex flex-1 min-h-0">
        {panelsVisible && (
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
            onClearSelection={selectionApi.clear}
          />
        )}
        <div className="flex-1 relative min-w-0">
          <PreviewPane
            iframeRef={selectionApi.iframeRef}
            selection={mode === 'edit' ? selectionApi.selection : null}
          />
          <FloatingToolbar
            mode={mode}
            onModeChange={setMode}
            componentPickerOpen={componentPickerOpen}
            onToggleComponentPicker={() => setComponentPickerOpen((o) => !o)}
          />
          <ComponentPicker
            open={componentPickerOpen}
            hasSelection={!!selectionApi.selection}
            onClose={() => setComponentPickerOpen(false)}
            onInsert={onInsertComponent}
          />
        </div>
        {panelsVisible && (
          <DesignPanel
            selection={selectionApi.selection}
            applying={applying}
            onApply={onApplyEdit}
          />
        )}
      </div>
    </div>
  );
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
