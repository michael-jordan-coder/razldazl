// UI3-style select: 24px row, 5px radius, bg-input fill, 11px text.

import * as Select from '@radix-ui/react-select';
import type { ReactNode } from 'react';

export interface PanelSelectItem<V extends string> {
  value: V;
  label: ReactNode;
  row: ReactNode;
}

export interface PanelSelectProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  items: PanelSelectItem<V>[];
  placeholder?: string;
  disabled?: boolean;
}

export function PanelSelect<V extends string>({
  value,
  onChange,
  items,
  placeholder,
  disabled,
}: PanelSelectProps<V>) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as V)} disabled={disabled}>
      <Select.Trigger
        className="flex h-6 w-full items-center justify-between rounded-[5px] px-2 text-[11px] leading-[16px] tracking-[0.055px] disabled:opacity-40 data-[state=open]:ring-1 data-[state=open]:ring-[var(--ui-accent)]"
        style={{
          background: 'var(--ui-bg-input)',
          color: 'var(--ui-text)',
        }}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon style={{ color: 'var(--ui-text-secondary)' }}>
          <Caret />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-80 overflow-hidden rounded-[5px] border shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.06)]"
          style={{
            background: 'var(--ui-bg)',
            borderColor: 'var(--ui-border-strong)',
            minWidth: 'var(--radix-select-trigger-width)',
          }}
        >
          <Select.Viewport className="p-1">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-[11px] leading-[16px] outline-none data-[highlighted]:bg-[var(--ui-bg-hover)] data-[state=checked]:text-[var(--ui-accent)]"
                style={{ color: 'var(--ui-text)' }}
              >
                <Select.ItemText>{item.label}</Select.ItemText>
                <div className="ml-auto pl-3 flex items-center">{item.row}</div>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

const Caret = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
