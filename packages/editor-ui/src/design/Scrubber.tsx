// UI3-style numeric input with a letter-icon prefix on the left and the
// value right-aligned. The WHOLE row is a drag surface — horizontal pointer
// drag scrubs through the scale. Double-click the value to type. Arrow keys
// step.
//
// Pointer-down on the value <input> is excluded from drag so typing works.

import { useEffect, useRef, useState } from 'react';

export interface ScrubberProps {
  /** Letter or short glyph rendered in the 24×24 prefix slot. */
  iconLabel: string;
  /** Accessible name, shown as tooltip/title. */
  label: string;
  scale: readonly number[];
  valueIndex: number | null;
  /** Suffix appended after the value, e.g. "px". */
  unit?: string;
  onCommit: (step: number) => void;
  disabled?: boolean;
  pxPerStep?: number;
}

export const Scrubber = ({
  iconLabel,
  label,
  scale,
  valueIndex,
  unit,
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

  const onRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Let the typing input receive clicks normally.
    if ((e.target as HTMLElement).closest('input')) return;
    e.preventDefault();
    const startIndex = valueIndex ?? 0;
    setDragFrom({ x: e.clientX, startIndex });
    setDragIndex(startIndex);
    document.body.style.cursor = 'ew-resize';
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown'
    )
      return;
    e.preventDefault();
    const cur = valueIndex ?? 0;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
    const next = clamp(cur + dir, 0, scale.length - 1);
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

  const value = displayIndex !== null ? scale[displayIndex] : null;
  const valueText = value === null ? '—' : unit ? `${value}${unit}` : String(value);

  return (
    <div
      ref={rootRef}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value ?? undefined}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onRowPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        if (disabled) return;
        setTyping(value !== null ? String(value) : '');
      }}
      className="flex h-6 w-full cursor-ew-resize items-center rounded-[5px] text-[11px] leading-[16px] tracking-[0.055px] select-none"
      style={{
        background: 'var(--ui-bg-input)',
        color: 'var(--ui-text)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'ew-resize',
      }}
      title={label}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center"
        style={{ color: 'var(--ui-text-secondary)' }}
      >
        {iconLabel}
      </span>
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
          className="h-6 flex-1 bg-transparent pr-2 text-right text-[11px] outline-none"
          style={{ color: 'var(--ui-text)' }}
        />
      ) : (
        <span className="flex-1 truncate pr-2 text-right font-medium">{valueText}</span>
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
