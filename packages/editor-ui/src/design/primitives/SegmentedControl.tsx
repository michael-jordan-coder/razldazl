// UI3-style segmented button row. Extracted from Toolbar's ModeSwitch so
// it can back both the top-bar Edit/Preview toggle and the per-panel
// layout/align pickers. Generic over the item value type.

import type { ReactNode } from 'react';

export interface SegmentedItem<V extends string> {
  value: V;
  label: ReactNode;
  title?: string;
}

export interface SegmentedControlProps<V extends string> {
  value: V | null;
  onChange: (value: V) => void;
  items: SegmentedItem<V>[];
  disabled?: boolean;
  /** Accessible name for the group (maps to aria-label). */
  ariaLabel?: string;
  /** Override per-segment height. Default 22px (matches Toolbar). */
  segmentHeight?: number;
}

export function SegmentedControl<V extends string>({
  value,
  onChange,
  items,
  disabled,
  ariaLabel,
  segmentHeight = 22,
}: SegmentedControlProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex min-w-0 items-center gap-0.5 rounded-[5px] p-[2px]"
      style={{
        background: 'var(--ui-bg-input)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={item.title ?? undefined}
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className="flex min-w-[22px] flex-1 items-center justify-center rounded-[3px] px-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed"
            style={{
              height: segmentHeight,
              background: active ? 'var(--ui-bg)' : 'transparent',
              color: active ? 'var(--ui-text)' : 'var(--ui-text-secondary)',
              boxShadow: active ? '0 0 0 0.5px var(--ui-border-strong)' : 'none',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
