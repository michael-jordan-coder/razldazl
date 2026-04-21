// Figma-style numeric scrubber: drag horizontally on the label to step
// through a fixed scale. The value commits on release (one edit per drag).
// Click focus + arrow keys to step with the keyboard. Double-click the value
// to type it directly (typing is scale-free — snaps to nearest step).

import { useEffect, useRef, useState } from 'react';

export interface ScrubberProps {
  label: string;
  /** Step values in ascending order. */
  scale: readonly number[];
  /** Current index into scale, or null when the value is unset. */
  valueIndex: number | null;
  /** How the panel displays the value in the value slot (e.g. "2 · 8px"). */
  formatValue: (step: number) => string;
  /** Committed value — fires on release, arrow key, or typed commit. */
  onCommit: (step: number) => void;
  disabled?: boolean;
  /** Pixels of horizontal drag per step. Default 6. */
  pxPerStep?: number;
}

export const Scrubber = ({
  label,
  scale,
  valueIndex,
  formatValue,
  onCommit,
  disabled,
  pxPerStep = 6,
}: ScrubberProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragFrom, setDragFrom] = useState<{ x: number; startIndex: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [typing, setTyping] = useState<string | null>(null);

  const displayIndex = typing !== null ? valueIndex : (dragIndex ?? valueIndex);

  useEffect(() => {
    if (!dragFrom) return;
    const onMove = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - dragFrom.x) / pxPerStep);
      const next = clamp(dragFrom.startIndex + delta, 0, scale.length - 1);
      setDragIndex(next);
    };
    const onUp = () => {
      if (dragIndex !== null && dragIndex !== dragFrom.startIndex) {
        const v = scale[dragIndex];
        if (v !== undefined) onCommit(v);
      }
      setDragFrom(null);
      setDragIndex(null);
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragFrom, dragIndex, onCommit, pxPerStep, scale]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const startIndex = valueIndex ?? 0;
    setDragFrom({ x: e.clientX, startIndex });
    setDragIndex(startIndex);
    document.body.style.cursor = 'ew-resize';
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const cur = valueIndex ?? 0;
    const next = clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, scale.length - 1);
    const v = scale[next];
    if (v !== undefined) onCommit(v);
  };

  const commitTyped = () => {
    if (typing === null) return;
    const n = Number(typing);
    setTyping(null);
    if (!Number.isFinite(n)) return;
    const idx = nearestIndex(scale, n);
    const v = scale[idx];
    if (v !== undefined) onCommit(v);
  };

  return (
    <div
      ref={rootRef}
      className="flex items-center justify-between gap-2 text-xs"
      data-disabled={disabled ? 'true' : undefined}
    >
      <button
        type="button"
        className="flex-1 cursor-ew-resize select-none text-left text-slate-400 hover:text-slate-200 focus:outline-none focus:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        disabled={disabled}
        tabIndex={0}
      >
        {label}
      </button>
      {typing !== null ? (
        <input
          autoFocus
          value={typing}
          onChange={(e) => setTyping(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTyped();
            } else if (e.key === 'Escape') {
              setTyping(null);
            }
          }}
          className="w-16 rounded border border-indigo-500 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-slate-100 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          className="w-20 rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-right font-mono text-slate-200 hover:border-slate-700 disabled:opacity-40"
          disabled={disabled}
          onDoubleClick={() => {
            setTyping(
              displayIndex !== null ? String(scale[displayIndex] ?? '') : '',
            );
          }}
        >
          {displayIndex !== null ? formatValue(scale[displayIndex]!) : '—'}
        </button>
      )}
    </div>
  );
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function nearestIndex(scale: readonly number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < scale.length; i++) {
    const diff = Math.abs(scale[i]! - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}
