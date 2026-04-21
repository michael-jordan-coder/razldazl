import { FONT_WEIGHTS } from './tailwind-palette.js';
import { PanelSelect, type PanelSelectItem } from './primitives/Select.js';

export interface WeightPickerProps {
  current: string | null;
  disabled?: boolean;
  onPick: (cls: string) => void;
}

type WeightKey = (typeof FONT_WEIGHTS)[number]['key'];

const items: PanelSelectItem<WeightKey>[] = FONT_WEIGHTS.map((w) => ({
  value: w.key,
  label: <span className="font-mono text-slate-100">{w.key}</span>,
  row: (
    <span className="text-slate-200" style={{ fontWeight: w.value }}>
      Aa
    </span>
  ),
}));

export const WeightPicker = ({ current, disabled, onPick }: WeightPickerProps) => {
  const value = (FONT_WEIGHTS.find((w) => w.key === current)?.key ?? 'font-normal') as WeightKey;
  return (
    <PanelSelect<WeightKey>
      value={value}
      onChange={onPick}
      items={items}
      disabled={disabled}
    />
  );
};
