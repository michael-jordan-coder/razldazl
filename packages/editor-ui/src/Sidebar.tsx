import { useState, type FormEvent, type ReactNode } from 'react';
import type { ChatPart } from '@product/protocol';
import type { Selection } from './useSelection.js';

export interface SidebarProps {
  connected: boolean;
  previewReady: boolean;
  selection: Selection | null;
  chatParts: ChatPart[];
  sending: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  onUndo(): void;
  onRedo(): void;
  onSend(message: string): Promise<void> | void;
  onClear(): void;
}

export const Sidebar = ({
  connected,
  previewReady,
  selection,
  chatParts,
  sending,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
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
    <aside
      className="flex w-[300px] shrink-0 flex-col border-r text-[11px] leading-[16px]"
      style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
    >
      <header
        className="flex h-[40px] shrink-0 items-center justify-between border-b pl-4 pr-2 text-[13px] font-medium"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <span>Chat</span>
        <div className="flex items-center gap-0.5">
          <IconButton
            title="Undo (⌘Z)"
            disabled={!canUndo}
            onClick={onUndo}
            label={`↶${undoCount > 0 ? ` ${undoCount}` : ''}`}
          />
          <IconButton
            title="Redo (⌘⇧Z)"
            disabled={!canRedo}
            onClick={onRedo}
            label={`↷${redoCount > 0 ? ` ${redoCount}` : ''}`}
          />
          <IconButton title="Clear" onClick={onClear} label="×" />
        </div>
      </header>

      <div
        className="flex items-center gap-3 border-b px-4 py-2 text-[10px] tracking-[0.055px]"
        style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Dot ok={connected} />
          {connected ? 'server' : 'offline'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Dot ok={previewReady} />
          {previewReady ? 'preview' : 'loading'}
        </span>
      </div>

      <section
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ background: 'var(--ui-bg)' }}
      >
        {chatParts.length === 0 ? (
          <div className="text-[11px]" style={{ color: 'var(--ui-text-tertiary)' }}>
            Describe a change. Select an element first, or let me find it.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {chatParts.map((p, i) => (
              <li key={`${p.kind}-${i}`}>
                <PartView part={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={submit}
        className="border-t p-2"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe a change…"
          className="w-full resize-none rounded-[5px] p-2 text-[11px] leading-[16px] outline-none placeholder:text-[var(--ui-text-tertiary)]"
          style={{
            background: 'var(--ui-bg-input)',
            color: 'var(--ui-text)',
          }}
          rows={3}
          disabled={sending || !connected}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
        />
        <div
          className="mt-1 flex items-center justify-between text-[10px]"
          style={{ color: 'var(--ui-text-tertiary)' }}
        >
          <span>⌘↵ to send</span>
          <button
            type="submit"
            disabled={sending || !connected || !message.trim()}
            className="h-6 rounded-[5px] px-2.5 text-[11px] font-medium disabled:opacity-40"
            style={{ background: 'var(--ui-accent)', color: '#fff' }}
          >
            {sending ? 'Working…' : 'Send'}
          </button>
        </div>
      </form>
    </aside>
  );
};

const IconButton = ({
  label,
  title,
  onClick,
  disabled,
}: {
  label: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className="inline-flex h-6 min-w-6 items-center justify-center rounded-[3px] px-1.5 text-[11px] hover:bg-[var(--ui-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
    style={{ color: 'var(--ui-text-secondary)' }}
  >
    {label}
  </button>
);

const Dot = ({ ok }: { ok: boolean }) => (
  <span
    className="inline-block h-1.5 w-1.5 rounded-full"
    style={{ background: ok ? '#3bc876' : '#f24822' }}
  />
);

const PartView = ({ part }: { part: ChatPart }) => {
  switch (part.kind) {
    case 'text':
      return (
        <div
          className="whitespace-pre-wrap rounded-[5px] px-2 py-1.5 text-[11px]"
          style={{ background: 'var(--ui-bg-input)', color: 'var(--ui-text)' }}
        >
          {part.text}
        </div>
      );
    case 'tool-call':
      return (
        <div
          className="rounded-[5px] px-2 py-1.5 text-[10px]"
          style={{
            background: 'var(--ui-bg-input)',
            color: 'var(--ui-text-secondary)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--ui-accent)' }}>{part.tool}</span>
            <span
              style={{
                color:
                  part.state === 'running'
                    ? '#f5a524'
                    : part.state === 'success'
                      ? '#3bc876'
                      : 'var(--ui-danger)',
              }}
            >
              · {part.state}
            </span>
          </div>
          {part.error && (
            <div className="mt-1 text-[10px]" style={{ color: 'var(--ui-danger)' }}>
              {part.error}
            </div>
          )}
        </div>
      );
    case 'file-edit':
      return (
        <div
          className="rounded-[5px] px-2 py-1.5 text-[10px]"
          style={{ background: 'var(--ui-bg-input)' }}
        >
          <div style={{ color: '#3bc876' }}>edit · {part.path}</div>
          <pre
            className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-[14px]"
            style={{ color: 'var(--ui-text-secondary)' }}
          >
            {part.diff}
          </pre>
        </div>
      );
    case 'app-validation':
      return (
        <div
          className="rounded-[5px] px-2 py-1.5 text-[10px]"
          style={{
            background: 'var(--ui-bg-input)',
            color: part.ok ? '#3bc876' : 'var(--ui-danger)',
          }}
        >
          validation {part.ok ? 'passed' : part.errors.join('\n')}
        </div>
      );
  }
};
