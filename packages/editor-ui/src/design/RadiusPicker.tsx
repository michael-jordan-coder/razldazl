import { RADIUS_SCALE } from './tailwind-palette.js';
import { PanelSelect, type PanelSelectItem } from './primitives/Select.js';

export interface RadiusPickerProps {
  current: string | null;
  disabled?: boolean;
  onPick: (cls: string) => void;
}

type RadiusKey = (typeof RADIUS_SCALE)[number]['key'];

const PX: Record<RadiusKey, number> = {
  'rounded-none': 0,
  'rounded-sm': 2,
  rounded: 4,
  'rounded-md': 6,
  'rounded-lg': 8,
  'rounded-xl': 12,
  'rounded-2xl': 16,
  'rounded-3xl': 24,
  'rounded-full': 9999,
};

const items: PanelSelectItem<RadiusKey>[] = RADIUS_SCALE.map((r) => ({
  value: r.key,
  label: <span className="font-mono text-slate-100">{r.key}</span>,
  row: (
    <span
      className="inline-block h-5 w-10 border border-slate-400"
      style={{ borderRadius: PX[r.key as RadiusKey] }}
    />
  ),
}));

export const RadiusPicker = ({ current, disabled, onPick }: RadiusPickerProps) => {
  const value = (RADIUS_SCALE.find((r) => r.key === current)?.key ?? 'rounded') as RadiusKey;
  return (
    <PanelSelect<RadiusKey>
      value={value}
      onChange={onPick}
      items={items}
      disabled={disabled}
    />
  );
};
