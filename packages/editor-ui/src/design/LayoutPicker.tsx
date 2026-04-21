// Flex/Grid layout controls for container elements. Top-level toggle:
// [Flex] [Grid] [Off]. Once a mode is picked, Direction (flex only) / Align /
// Justify rows appear. Mutations go through the existing replaceGroup path
// so undo still catches them as one action per click.

import { SegmentedControl } from './primitives/SegmentedControl.js';
import { LabeledField } from './primitives/LabeledField.js';
import {
  ALIGN_ITEMS,
  DISPLAY_MODES,
  FLEX_DIRECTIONS,
  JUSTIFY_CONTENT,
} from './tailwind-palette.js';
import {
  ALIGN_ITEMS_PATTERN,
  classList,
  displayMode,
  findClass,
  FLEX_DIRECTION_PATTERN,
  JUSTIFY_CONTENT_PATTERN,
  replaceGroup,
} from './className-utils.js';

type DirectionKey = (typeof FLEX_DIRECTIONS)[number]['value'];
type AlignKey = (typeof ALIGN_ITEMS)[number]['value'];
type JustifyKey = (typeof JUSTIFY_CONTENT)[number]['value'];
type DisplayMode = (typeof DISPLAY_MODES)[number]['value'];

export interface LayoutPickerProps {
  liveClass: string;
  disabled?: boolean;
  setClassName: (next: string) => void;
}

export const LayoutPicker = ({ liveClass, disabled, setClassName }: LayoutPickerProps) => {
  const mode: DisplayMode = displayMode(liveClass) ?? 'block';

  const setMode = (next: DisplayMode) => {
    // Strip flex/grid first, plus direction (which only applies to flex).
    let out = classList(liveClass).filter((c) => c !== 'flex' && c !== 'grid');
    if (next === 'flex') out = [...out, 'flex'];
    else if (next === 'grid') out = [...out, 'grid'];
    // If switching to grid, flex-direction classes no longer make sense.
    if (next !== 'flex') {
      out = out.filter((c) => !FLEX_DIRECTION_PATTERN.test(c));
    }
    // If going block, strip align/justify too so the element cleanly returns.
    if (next === 'block') {
      out = out.filter(
        (c) => !ALIGN_ITEMS_PATTERN.test(c) && !JUSTIFY_CONTENT_PATTERN.test(c),
      );
    }
    setClassName(out.join(' '));
  };

  const direction = findClass(liveClass, FLEX_DIRECTION_PATTERN) as DirectionKey | null;
  const align = findClass(liveClass, ALIGN_ITEMS_PATTERN) as AlignKey | null;
  const justify = findClass(liveClass, JUSTIFY_CONTENT_PATTERN) as JustifyKey | null;

  const pickDirection = (value: DirectionKey) =>
    setClassName(replaceGroup(liveClass, FLEX_DIRECTION_PATTERN, value));
  const pickAlign = (value: AlignKey) =>
    setClassName(replaceGroup(liveClass, ALIGN_ITEMS_PATTERN, value));
  const pickJustify = (value: JustifyKey) =>
    setClassName(replaceGroup(liveClass, JUSTIFY_CONTENT_PATTERN, value));

  return (
    <div className="flex flex-col gap-1.5">
      <SegmentedControl<DisplayMode>
        ariaLabel="Display mode"
        value={mode}
        onChange={setMode}
        items={DISPLAY_MODES}
        disabled={disabled}
      />
      {mode === 'flex' && (
        <LabeledField label="Direction">
          <SegmentedControl<DirectionKey>
            ariaLabel="Flex direction"
            value={direction}
            onChange={pickDirection}
            items={FLEX_DIRECTIONS}
            disabled={disabled}
          />
        </LabeledField>
      )}
      {mode !== 'block' && (
        <>
          <LabeledField label="Align">
            <SegmentedControl<AlignKey>
              ariaLabel="Align items"
              value={align}
              onChange={pickAlign}
              items={ALIGN_ITEMS}
              disabled={disabled}
            />
          </LabeledField>
          <LabeledField label="Justify">
            <SegmentedControl<JustifyKey>
              ariaLabel="Justify content"
              value={justify}
              onChange={pickJustify}
              items={JUSTIFY_CONTENT}
              disabled={disabled}
            />
          </LabeledField>
        </>
      )}
    </div>
  );
};
