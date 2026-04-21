// Text alignment picker — one row of four segments: left / center / right
// / justify.

import { SegmentedControl } from './primitives/SegmentedControl.js';
import { TEXT_ALIGNS } from './tailwind-palette.js';
import { findClass, replaceGroup, TEXT_ALIGN_PATTERN } from './className-utils.js';

type AlignKey = (typeof TEXT_ALIGNS)[number]['value'];

export interface AlignPickerProps {
  liveClass: string;
  disabled?: boolean;
  setClassName: (next: string) => void;
}

export const AlignPicker = ({ liveClass, disabled, setClassName }: AlignPickerProps) => {
  const current = findClass(liveClass, TEXT_ALIGN_PATTERN) as AlignKey | null;
  return (
    <SegmentedControl<AlignKey>
      ariaLabel="Text align"
      value={current}
      onChange={(value) => setClassName(replaceGroup(liveClass, TEXT_ALIGN_PATTERN, value))}
      items={TEXT_ALIGNS}
      disabled={disabled}
    />
  );
};
