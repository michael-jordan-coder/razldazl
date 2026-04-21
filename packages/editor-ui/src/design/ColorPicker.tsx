// UI3-style color input: [swatch] value-label [×-button] — single 24px row
// with bg-input fill. Clicking the row opens a popover grid of Tailwind
// shades. Swatches rendered with inline hex (see tailwind-palette).

import { useState } from 'react';
import { HUES, SHADES, PALETTE, type Hue, type Shade } from './tailwind-palette.js';
import { PanelPopover } from './primitives/Popover.js';

export type ColorPrefix = 'bg' | 'text' | 'border';

export interface ColorPickerProps {
  prefix: ColorPrefix;
  currentClass: string | null;
  disabled?: boolean;
  onPick: (cls: string | null) => void;
}

export const ColorPicker = ({ prefix, currentClass, disabled, onPick }: ColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const parsed = parseColorClass(currentClass);
  const currentHex = parsed ? (PALETTE[parsed.hue]?.[parsed.shade] ?? null) : null;

  return (
    <PanelPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      trigger={
        <button
          type="button"
          disabled={disabled}
          className="flex h-6 w-full items-center gap-2 rounded-[5px] px-1.5 text-left text-[11px] leading-[16px] tracking-[0.055px] disabled:opacity-40 data-[state=open]:ring-1 data-[state=open]:ring-[var(--ui-accent)]"
          style={{
            background: 'var(--ui-bg-input)',
            color: 'var(--ui-text)',
          }}
        >
          <Swatch hex={currentHex} />
          <span className="flex-1 truncate font-medium">
            {parsed ? `${parsed.hue}-${parsed.shade}` : '—'}
          </span>
          {parsed && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onPick(null);
              }}
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-[var(--ui-border-strong)]"
              style={{ color: 'var(--ui-text-secondary)' }}
              title="Clear"
            >
              ×
            </span>
          )}
        </button>
      }
    >
      <div className="flex flex-col gap-1" style={{ width: '264px' }}>
        <div
          className="flex items-center justify-between px-0.5 pb-1 text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--ui-text-tertiary)' }}
        >
          <span>{prefix}-*</span>
          <span>Tailwind</span>
        </div>
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${SHADES.length}, 1fr)` }}
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
  );
};

const Swatch = ({ hex }: { hex: string | null }) => (
  <span
    className="inline-block h-[14px] w-[14px] shrink-0 rounded-[2px]"
    style={{
      background: hex ?? 'transparent',
      boxShadow: 'inset 0 0 0 0.5px var(--ui-border-strong)',
    }}
  />
);

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
          className="h-5 w-5 rounded-[2px] transition-transform hover:scale-110"
          style={{
            background: hex,
            boxShadow: active
              ? '0 0 0 1.5px #fff, 0 0 0 2.5px var(--ui-accent)'
              : 'inset 0 0 0 0.5px rgba(0,0,0,0.25)',
          }}
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
