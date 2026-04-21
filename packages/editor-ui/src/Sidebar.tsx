import { useState, type FormEvent } from 'react';
import type { ChatPart } from '@product/protocol';
import type { Selection } from './useSelection.js';
// Selection source info is already shown in the Design panel on the right,
// so the sidebar drops the "Selected" section to stay focused on chat.

export interface SidebarProps {
  connected: boolean;
  previewReady: boolean;
  selection: Selection | null;
  chatParts: ChatPart[];
  sending: boolean;
  onSend(message: string): Promise<void> | void;
  onClear(): void;
}

export const Sidebar = ({
  connected,
  previewReady,
  selection,
  chatParts,
  sending,
  onSend,
  onClear,
}: SidebarProps) => {
  void selection;
  const [message, setMessage] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    const text = message;
    setMessage('');
    void onSend(text);
  };

  return (
    <aside className="w-96 flex flex-col border-r border-slate-800 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 p-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-rose-400'
            }`}
            aria-label={connected ? 'connected' : 'disconnected'}
          />
          server {connected ? 'connected' : 'offline'}
          <span className="mx-1">·</span>
          preview {previewReady ? 'ready' : 'loading'}
        </div>
        <button
          type="button"
          className="text-slate-500 hover:text-slate-300"
          onClick={onClear}
        >
          clear
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-3 text-sm">
        <ul className="space-y-2">
          {chatParts.map((p, i) => (
            <li key={`${p.kind}-${i}`} className="rounded border border-slate-800 bg-slate-950 p-2">
              <PartView part={p} />
            </li>
          ))}
          {chatParts.length === 0 && (
            <li className="text-xs text-slate-500">No messages yet.</li>
          )}
        </ul>
      </section>

      <form onSubmit={submit} className="border-t border-slate-800 p-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={selection ? 'Describe a change…' : 'Select something first'}
          className="w-full resize-none rounded bg-slate-950 border border-slate-800 p-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          rows={3}
          disabled={sending || !connected}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>⌘/Ctrl + Enter to send</span>
          <button
            type="submit"
            disabled={sending || !connected || !message.trim()}
            className="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {sending ? 'Working…' : 'Send'}
          </button>
        </div>
      </form>
    </aside>
  );
};

const PartView = ({ part }: { part: ChatPart }) => {
  switch (part.kind) {
    case 'text':
      return <div className="whitespace-pre-wrap text-slate-200">{part.text}</div>;
    case 'tool-call':
      return (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-indigo-300">
            tool · {part.tool}{' '}
            <span
              className={
                part.state === 'running'
                  ? 'text-amber-300'
                  : part.state === 'success'
                    ? 'text-emerald-300'
                    : 'text-rose-300'
              }
            >
              {part.state}
            </span>
          </div>
          <pre className="whitespace-pre-wrap text-xs text-slate-400">
            {JSON.stringify(part.args, null, 2)}
          </pre>
          {part.error && <div className="text-xs text-rose-400">{part.error}</div>}
        </div>
      );
    case 'file-edit':
      return (
        <div>
          <div className="text-xs uppercase tracking-wide text-emerald-300">edit · {part.path}</div>
          <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{part.diff}</pre>
        </div>
      );
    case 'app-validation':
      return (
        <div
          className={
            part.ok ? 'text-xs text-emerald-300' : 'text-xs text-rose-300 whitespace-pre-wrap'
          }
        >
          validation {part.ok ? 'passed' : part.errors.join('\n')}
        </div>
      );
  }
};
