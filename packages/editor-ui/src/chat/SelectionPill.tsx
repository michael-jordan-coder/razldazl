import type { Selection } from '../useSelection.js';

interface Props {
  selection: Selection;
  onClear(): void;
}

/**
 * The Razldazl signature: when the user has a DOM element selected in the
 * preview, it appears as a pill above the chat input. Cursor has @-file
 * pills; this is the visual-editor equivalent.
 */
export const SelectionPill = ({ selection, onClear }: Props) => {
  const classSnippet = truncateClassName(selection.className);
  return (
    <div
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]"
      style={{
        background: 'var(--ui-accent-soft)',
        borderColor: 'rgba(13, 153, 255, 0.45)',
        color: '#9bcfff',
      }}
    >
      <span
        className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgba(13, 153, 255, 0.35)' }}
        aria-hidden
      >
        <svg width="8" height="8" viewBox="0 0 8 8">
          <path
            d="M1 1l6 3-2.2.8L4 8 1 1z"
            fill="#9bcfff"
          />
        </svg>
      </span>
      <span
        className="font-mono font-medium"
        style={{ color: '#d4e9ff' }}
      >
        {`<${selection.tag}>`}
      </span>
      {classSnippet ? (
        <span
          className="truncate font-mono"
          style={{ color: '#9bcfff', maxWidth: 160 }}
          title={selection.className ?? undefined}
        >
          {classSnippet}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        title="Clear selection"
        className="ml-0.5 inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{ color: '#9bcfff' }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path
            d="M2 2L6 6M6 2L2 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
};

function truncateClassName(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 28) return trimmed;
  return trimmed.slice(0, 25) + '…';
}
