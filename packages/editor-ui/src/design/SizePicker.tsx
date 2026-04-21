// Text-size picker rendered as a Radix select. Each dropdown row previews
// the glyph "Aa" at its actual px size so the user sees the scale visually.

import { TEXT_SIZES } from './tailwind-palette.js';
import { PanelSelect, type PanelSelectItem } from './primitives/Select.js';

export interface SizePickerProps {
  current: string | null;
  disabled?: boolean;
  onPick: (cls: string) => void;
}

type SizeKey = (typeof TEXT_SIZES)[number]['key'];

const items: PanelSelectItem<SizeKey>[] = TEXT_SIZES.map((t) => ({
  value: t.key,
  label: <span className="font-mono text-slate-100">{t.key}</span>,
  row: (
    <span
      className="font-semibold text-slate-200"
      style={{ fontSize: t.px, lineHeight: `${t.lineHeight}px` }}
    >
      Aa
    </span>
  ),
}));

export const SizePicker = ({ current, disabled, onPick }: SizePickerProps) => {
  const value = (TEXT_SIZES.find((t) => t.key === current)?.key ?? 'text-base') as SizeKey;
  return (
    <PanelSelect<SizeKey>
      value={value}
      onChange={onPick}
      items={items}
      disabled={disabled}
    />
  );
};
