// Thin wrapper around @radix-ui/react-select with dark-theme Tailwind styling
// and an API that lets each item render its own preview content.

import * as Select from '@radix-ui/react-select';
import type { ReactNode } from 'react';

export interface PanelSelectItem<V extends string> {
  value: V;
  /** Label shown in the trigger when selected. */
  label: ReactNode;
  /** Row content in the dropdown — can include a rendered preview. */
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
        className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="ml-2 text-slate-500">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-80 overflow-hidden rounded-md border border-slate-700 bg-slate-900 text-slate-200 shadow-lg shadow-black/40"
        >
          <Select.Viewport className="p-1">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="flex cursor-pointer items-center rounded px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-indigo-500/20 data-[state=checked]:text-indigo-200"
              >
                <Select.ItemText>{item.label}</Select.ItemText>
                <div className="ml-auto pl-3">{item.row}</div>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
