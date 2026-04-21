// Session undo/redo for edits. One user action (panel control, AI turn)
// becomes one undo entry, capturing every file touched during that action.
//
// The server emits `file-edit` chat parts with full `before`/`after` contents.
// We listen via `onFileEdit` and accumulate into the currently-open "batch".
// Callers wrap the action in `runAction(fn)` which opens a batch before fn()
// and closes it after, pushing to the stack if anything was captured.
//
// Undo writes the collected `before` snapshots back via files.write (raw
// write, no AST engine, no chat part emission). Redo writes `after` back.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WSClient } from '@product/bridge';
import type { ChatPart } from '@product/protocol';

export interface FileSnapshot {
  path: string;
  before: string;
  after: string;
}

export interface UndoEntry {
  id: string;
  files: FileSnapshot[];
  at: number;
}

export interface UseUndo {
  stack: UndoEntry[];
  redoStack: UndoEntry[];
  runAction<T>(fn: () => Promise<T>): Promise<T>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
}

export interface UseUndoOptions {
  client: WSClient | null;
  onPart: (part: ChatPart) => void;
  subscribeToChat: (handler: (part: ChatPart) => void) => () => void;
}

export function useUndo({ client, onPart, subscribeToChat }: UseUndoOptions): UseUndo {
  const [stack, setStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const openBatch = useRef<FileSnapshot[] | null>(null);

  useEffect(() => {
    return subscribeToChat((part) => {
      if (part.kind !== 'file-edit') return;
      if (!openBatch.current) return;
      if (typeof part.before !== 'string' || typeof part.after !== 'string') return;
      openBatch.current.push({ path: part.path, before: part.before, after: part.after });
    });
  }, [subscribeToChat]);

  const runAction = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    openBatch.current = [];
    try {
      const out = await fn();
      return out;
    } finally {
      const batch = openBatch.current;
      openBatch.current = null;
      if (batch && batch.length > 0) {
        const collapsed = collapseSnapshots(batch);
        if (collapsed.length > 0) {
          setStack((s) => [...s, { id: `u-${Date.now()}`, files: collapsed, at: Date.now() }]);
          setRedoStack([]);
        }
      }
    }
  }, []);

  const undo = useCallback(async () => {
    if (!client) return;
    setStack((s) => {
      const last = s[s.length - 1];
      if (!last) return s;
      void (async () => {
        try {
          await client.call('files', 'write', {
            edits: last.files.map((f) => ({ path: f.path, contents: f.before })),
          });
          setRedoStack((r) => [...r, last]);
          onPart({
            kind: 'text',
            id: `undo-${last.id}`,
            text: `↶ Reverted ${last.files.length === 1 ? last.files[0]!.path : `${last.files.length} files`}.`,
          });
        } catch (err) {
          onPart({
            kind: 'text',
            id: `undo-err-${last.id}`,
            text: `Undo failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      })();
      return s.slice(0, -1);
    });
  }, [client, onPart]);

  const redo = useCallback(async () => {
    if (!client) return;
    setRedoStack((r) => {
      const last = r[r.length - 1];
      if (!last) return r;
      void (async () => {
        try {
          await client.call('files', 'write', {
            edits: last.files.map((f) => ({ path: f.path, contents: f.after })),
          });
          setStack((s) => [...s, last]);
          onPart({
            kind: 'text',
            id: `redo-${last.id}`,
            text: `↷ Redid ${last.files.length === 1 ? last.files[0]!.path : `${last.files.length} files`}.`,
          });
        } catch (err) {
          onPart({
            kind: 'text',
            id: `redo-err-${last.id}`,
            text: `Redo failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      })();
      return r.slice(0, -1);
    });
  }, [client, onPart]);

  return {
    stack,
    redoStack,
    runAction,
    undo,
    redo,
    canUndo: stack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

// When a batch touches the same file multiple times (e.g. two chip clicks
// during a single AI turn), keep the earliest `before` and latest `after` so
// the undo/redo collapses to one round-trip per file.
function collapseSnapshots(snapshots: FileSnapshot[]): FileSnapshot[] {
  const byPath = new Map<string, FileSnapshot>();
  for (const snap of snapshots) {
    const existing = byPath.get(snap.path);
    if (existing) {
      existing.after = snap.after;
    } else {
      byPath.set(snap.path, { ...snap });
    }
  }
  // Drop no-ops (before === after).
  return Array.from(byPath.values()).filter((s) => s.before !== s.after);
}
