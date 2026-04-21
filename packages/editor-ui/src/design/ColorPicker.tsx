// Tailwind color-grid picker in a popover. Rows = hues, cols = shades. The
// swatch that's currently applied is ringed. Click a cell to apply.
//
// Swatches are rendered with inline hex (from tailwind-palette.ts) so we don't
// need to safelist ~200 bg-* classes in the editor-ui's own CSS. The class
// we *write* to the user's demo-app is a Tailwind utility — its Tailwind
// build will generate the CSS.

import { useState } from 'react';
import { HUES, SHADES, PALETTE, type Hue, type Shade } from './tailwind-palette.js';
import { PanelPopover } from './primitives/Popover.js';

export type ColorPrefix = 'bg' | 'text' | 'border';

export interface ColorPickerProps {
  label: string;
  prefix: ColorPrefix;
  currentClass: string | null;
  disabled?: boolean;
  onPick: (cls: string | null) => void;
}

export const ColorPicker = ({
  label,
  prefix,
  currentClass,
  disabled,
  onPick,
}: ColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const parsed = parseColorClass(currentClass);
  const currentHex = parsed ? (PALETTE[parsed.hue]?.[parsed.shade] ?? null) : null;

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <PanelPopover
        open={open}
        onOpenChange={setOpen}
        align="end"
        trigger={
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 hover:border-slate-700 disabled:opacity-40"
          >
            <span
              className="inline-block h-4 w-4 rounded border border-slate-700"
              style={currentHex ? { background: currentHex } : { background: 'transparent' }}
            />
            <span className="font-mono text-slate-200">{parsed ? `${parsed.hue}-${parsed.shade}` : '—'}</span>
          </button>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1 pb-1 text-[10px] uppercase tracking-wider text-slate-500">
            <span>{prefix}-*</span>
            {parsed && (
              <button
                type="button"
                className="text-slate-500 hover:text-slate-300"
                onClick={() => {
                  onPick(null);
                  setOpen(false);
                }}
              >
                clear
              </button>
            )}
          </div>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${SHADES.length}, 1.25rem)` }}
          >
            {HUES.map((hue) => (
              <Row
                key={hue}
                hue={hue}
                selectedShade={parsed?.hue === hue ? parsed.shade : null}
                onPick={(shade) => {
                  onPick(`${prefix}-${hue}-${shade}`);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      </PanelPopover>
    </div>
  );
};

const Row = ({
  hue,
  selectedShade,
  onPick,
}: {
  hue: Hue;
  selectedShade: Shade | null;
  onPick: (shade: Shade) => void;
}) => (
  <>
    {SHADES.map((shade) => {
      const hex = PALETTE[hue][shade];
      const active = selectedShade === shade;
      return (
        <button
          key={`${hue}-${shade}`}
          type="button"
          title={`${hue}-${shade}`}
          onClick={() => onPick(shade)}
          className={[
            'h-5 w-5 rounded-sm border transition',
            active
              ? 'border-white ring-2 ring-white/40'
              : 'border-black/20 hover:scale-110',
          ].join(' ')}
          style={{ background: hex }}
        />
      );
    })}
  </>
);

function parseColorClass(cls: string | null): { hue: Hue; shade: Shade } | null {
  if (!cls) return null;
  const m = /^(?:bg|text|border)-([a-z]+)-(\d+)$/.exec(cls);
  if (!m) return null;
  const hue = m[1] as Hue;
  const shade = Number(m[2]) as Shade;
  if (!(HUES as readonly string[]).includes(hue)) return null;
  if (!(SHADES as readonly number[]).includes(shade)) return null;
  return { hue, shade };
}
