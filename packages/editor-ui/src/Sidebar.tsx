import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChatPart } from '@product/protocol';
import type { Selection } from './useSelection.js';
import { ToolCallCard } from './chat/ToolCallCard.js';
import { FileEditCard } from './chat/FileEditCard.js';
import { SelectionPill } from './chat/SelectionPill.js';
import { EmptyState } from './chat/EmptyState.js';
import { ThinkingIndicator } from './chat/ThinkingIndicator.js';

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
  onClearSelection(): void;
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
  onClearSelection,
}: SidebarProps) => {
  const [message, setMessage] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || sending) return;
    const text = message;
    setMessage('');
    void onSend(text);
  };

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatParts.length, sending]);

  const pickSuggestion = (text: string) => {
    setMessage(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const lastPart = chatParts[chatParts.length - 1];
  const lastIsFromUser = lastPart?.kind === 'text' && /^🧑/.test(lastPart.text);
  const showThinking = sending && (!lastPart || lastIsFromUser);

  return (
    <aside
      className="flex w-[320px] shrink-0 flex-col border-r text-[11px] leading-[16px]"
      style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
    >
      <header
        className="flex h-[40px] shrink-0 items-center justify-between gap-2 border-b pl-3 pr-2 text-[13px] font-medium"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div style={{ color: 'var(--ui-text)' }}>Chat</div>
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
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ background: 'var(--ui-bg)' }}
      >
        {chatParts.length === 0 && !sending ? (
          <EmptyState hasSelection={!!selection} onPick={pickSuggestion} />
        ) : (
          <ul className="flex flex-col gap-2">
            {chatParts.map((p, i) => (
              <li key={`${p.kind}-${i}`}>
                <PartView part={p} />
              </li>
            ))}
            {showThinking ? (
              <li>
                <ThinkingIndicator />
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <form
        onSubmit={submit}
        className="flex flex-col gap-1.5 border-t p-2"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        {selection ? (
          <SelectionPill selection={selection} onClear={onClearSelection} />
        ) : null}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={selection ? 'Modify this element…' : 'Describe a change…'}
          className="w-full resize-none rounded-[5px] p-2 text-[11px] leading-[16px] outline-none placeholder:text-[var(--ui-text-tertiary)]"
          style={{
            background: 'var(--ui-bg-input)',
            color: 'var(--ui-text)',
          }}
          rows={3}
          disabled={sending || !connected}
          onKeyDown={(e) => {
            const composing = e.nativeEvent.isComposing || e.keyCode === 229;
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.metaKey &&
              !e.ctrlKey &&
              !composing
            ) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div
          className="flex items-center justify-between text-[10px]"
          style={{ color: 'var(--ui-text-tertiary)' }}
        >
          <span>↵ to send · ⇧↵ for newline</span>
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
    case 'text': {
      const isUser = /^🧑/.test(part.text);
      const body = isUser ? part.text.replace(/^🧑\s?/, '') : part.text;
      return (
        <div
          className="rounded-[6px] px-2.5 py-1.5 text-[11px] leading-[17px]"
          style={{
            background: isUser ? 'var(--ui-accent-soft)' : 'var(--ui-bg-input)',
            color: 'var(--ui-text)',
            border: isUser ? '1px solid rgba(13,153,255,0.25)' : '1px solid var(--ui-border)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {body}
        </div>
      );
    }
    case 'tool-call':
      return <ToolCallCard part={part} />;
    case 'file-edit':
      return <FileEditCard part={part} />;
    case 'app-validation':
      return (
        <div
          className="rounded-[6px] border px-2.5 py-1.5 text-[10px]"
          style={{
            background: part.ok
              ? 'rgba(59, 200, 118, 0.06)'
              : 'rgba(242, 72, 34, 0.06)',
            borderColor: part.ok
              ? 'rgba(59, 200, 118, 0.28)'
              : 'rgba(242, 72, 34, 0.32)',
            color: part.ok ? '#6ae89a' : 'var(--ui-danger)',
          }}
        >
          {part.ok ? '✓ Validation passed' : `✗ ${part.errors.join('\n')}`}
        </div>
      );
  }
};
