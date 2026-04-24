import { useState, type CSSProperties } from 'react';
import type { ChatPart } from '@product/protocol';

type FileEditPart = Extract<ChatPart, { kind: 'file-edit' }>;

export const FileEditCard = ({ part }: { part: FileEditPart }) => {
  const [open, setOpen] = useState(false);
  const added = countLines(part.diff, '+');
  const removed = countLines(part.diff, '-');
  const file = part.path.split('/').slice(-1)[0];
  const dir = part.path.slice(0, part.path.length - file.length).replace(/\/$/, '');

  return (
    <div
      className="rounded-[6px] border"
      style={{
        background: 'var(--ui-bg-input)',
        borderColor: 'var(--ui-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <span
          className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center"
          style={{ color: '#3bc876' }}
          aria-hidden
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M6 1H2.5C2.224 1 2 1.224 2 1.5v7c0 .276.224.5.5.5h5c.276 0 .5-.224.5-.5V3L6 1z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <path d="M6 1v2h2" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </span>

        <span
          className="flex-1 truncate font-mono text-[11px] leading-[16px]"
          style={{ color: 'var(--ui-text)' }}
          title={part.path}
        >
          {dir ? (
            <span style={{ color: 'var(--ui-text-tertiary)' }}>{dir}/</span>
          ) : null}
          <span style={{ fontWeight: 500 }}>{file}</span>
        </span>

        <span
          className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums"
          aria-hidden
        >
          {added > 0 ? (
            <span style={{ color: '#3bc876' }}>+{added}</span>
          ) : null}
          {removed > 0 ? (
            <span style={{ color: 'var(--ui-danger)' }}>-{removed}</span>
          ) : null}
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
          className="border-t"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <DiffView diff={part.diff} />
        </div>
      ) : null}
    </div>
  );
};

const DiffView = ({ diff }: { diff: string }) => {
  const lines = diff.split('\n');
  return (
    <pre
      className="overflow-x-auto px-2 py-1.5 font-mono text-[10px] leading-[14px]"
      style={{ color: 'var(--ui-text-secondary)' }}
    >
      {lines.map((line, i) => {
        const first = line.charAt(0);
        let style: CSSProperties = {};
        if (first === '+') {
          style = { background: 'rgba(59, 200, 118, 0.1)', color: '#6ae89a' };
        } else if (first === '-') {
          style = { background: 'rgba(242, 72, 34, 0.1)', color: '#ff8b6f' };
        } else if (first === '@') {
          style = { color: 'var(--ui-text-tertiary)' };
        }
        return (
          <span key={i} style={{ display: 'block', ...style, paddingLeft: 4, paddingRight: 4 }}>
            {line || '\u00a0'}
          </span>
        );
      })}
    </pre>
  );
};

function countLines(diff: string, prefix: '+' | '-'): number {
  let n = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith(prefix) && !line.startsWith(prefix + prefix)) n += 1;
  }
  return n;
}
