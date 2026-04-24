import { useState } from 'react';
import type { ChatPart } from '@product/protocol';
import { humanizeTool } from './toolHumanize.js';

type ToolCallPart = Extract<ChatPart, { kind: 'tool-call' }>;

const STATE_COLOR: Record<ToolCallPart['state'], string> = {
  running: '#f5a524',
  success: '#3bc876',
  error: 'var(--ui-danger)',
};

const STATE_LABEL: Record<ToolCallPart['state'], string> = {
  running: 'Running',
  success: 'Done',
  error: 'Failed',
};

export const ToolCallCard = ({ part }: { part: ToolCallPart }) => {
  const [open, setOpen] = useState(false);
  const { title, detail, fileHint } = humanizeTool(part.tool, part.args);
  const color = STATE_COLOR[part.state];
  const stateLabel = STATE_LABEL[part.state];

  return (
    <div
      className="rounded-[6px] border transition-colors"
      style={{
        background: 'var(--ui-bg-input)',
        borderColor: 'var(--ui-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
        style={{ color: 'var(--ui-text)' }}
      >
        <span
          className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center"
          aria-hidden
        >
          {part.state === 'running' ? (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: color,
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
          ) : part.state === 'success' ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M2 5.5L4 7.5L8 3"
                stroke={color}
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M3 3L7 7M7 3L3 7"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>

        <span
          className="flex-1 truncate text-[11px] leading-[16px]"
          style={{
            color: part.state === 'error' ? 'var(--ui-danger)' : 'var(--ui-text)',
            fontWeight: 500,
          }}
        >
          {title}
        </span>

        {fileHint ? (
          <span
            className="truncate font-mono text-[10px]"
            style={{ color: 'var(--ui-text-tertiary)', maxWidth: 120 }}
            title={fileHint}
          >
            {fileHint.split('/').slice(-1)[0]}
          </span>
        ) : null}

        <span
          className="text-[10px]"
          style={{ color: 'var(--ui-text-tertiary)' }}
        >
          {stateLabel}
        </span>

        <span
          className="text-[10px] transition-transform"
          style={{
            color: 'var(--ui-text-tertiary)',
            transform: open ? 'rotate(90deg)' : 'none',
          }}
          aria-hidden
        >
          ›
        </span>
      </button>

      {open ? (
        <div
          className="border-t px-2.5 py-1.5"
          style={{
            borderColor: 'var(--ui-border)',
            color: 'var(--ui-text-secondary)',
          }}
        >
          <div className="mb-1 text-[10px] uppercase tracking-[0.05em]" style={{ color: 'var(--ui-text-tertiary)' }}>
            {part.tool}
          </div>
          {detail ? (
            <div className="mb-1 text-[10px]" style={{ color: 'var(--ui-text-secondary)' }}>
              {detail}
            </div>
          ) : null}
          <pre
            className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-[14px]"
            style={{ color: 'var(--ui-text-tertiary)' }}
          >
            {safeStringify(part.args)}
          </pre>
          {part.error ? (
            <div
              className="mt-1.5 rounded-[4px] px-1.5 py-1 text-[10px]"
              style={{
                background: 'rgba(242, 72, 34, 0.08)',
                color: 'var(--ui-danger)',
                border: '1px solid rgba(242, 72, 34, 0.25)',
              }}
            >
              {part.error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
