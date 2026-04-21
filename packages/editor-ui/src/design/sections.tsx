// Section components. Each is a small renderer the Design panel dispatches
// to via the role→sections map in role.ts. Shared SectionProps interface so
// the panel can render any section generically.

import type { ReactNode } from 'react';
import type { ToolCall } from '@product/protocol';
import type { Selection } from '../useSelection.js';
import { Scrubber } from './Scrubber.js';
import { ColorPicker } from './ColorPicker.js';
import { SizePicker } from './SizePicker.js';
import { WeightPicker } from './WeightPicker.js';
import { RadiusPicker } from './RadiusPicker.js';
import { LayoutPicker } from './LayoutPicker.js';
import { AlignPicker } from './AlignPicker.js';
import { LabeledField } from './primitives/LabeledField.js';
import { SPACING_SCALE } from './tailwind-palette.js';
import {
  colorGroupPattern,
  findClass,
  FONT_WEIGHT_PATTERN,
  RADIUS_PATTERN,
  replaceGroup,
  spacingGroupPattern,
  TEXT_SIZE_PATTERN,
} from './className-utils.js';

export interface SectionProps {
  selection: Selection;
  classNameDraft: string;
  text: string;
  setText: (value: string) => void;
  setClassNameDraft: (value: string) => void;
  setClassName: (next: string) => void;
  applyText: () => Promise<void> | void;
  onApply: (ops: ToolCall[]) => Promise<void> | void;
  applying: boolean;
}

// -- Element ---------------------------------------------------------------

export const ElementSection = ({ selection }: SectionProps) => (
  <div className="flex h-6 items-center gap-2 text-[11px]">
    <code
      className="rounded-[3px] px-1 py-0.5 font-mono text-[11px]"
      style={{ background: 'var(--ui-bg-input)', color: 'var(--ui-accent)' }}
    >
      &lt;{selection.tag}&gt;
    </code>
    <span className="truncate" style={{ color: 'var(--ui-text-secondary)' }}>
      {shortPath(selection.source.fileName)}:{selection.source.lineNumber}
    </span>
  </div>
);

// -- Content (text editor) -------------------------------------------------

export const ContentSection = ({ selection, text, setText, applying, applyText }: SectionProps) => {
  if (selection.text === null) {
    return (
      <div className="text-[11px]" style={{ color: 'var(--ui-text-tertiary)' }}>
        Contains elements; select an inner leaf to edit text.
      </div>
    );
  }
  const dirty = text !== (selection.text ?? '');
  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-[5px] p-2 text-[11px] leading-[16px] outline-none"
        style={{ background: 'var(--ui-bg-input)', color: 'var(--ui-text)' }}
      />
      <div className="mt-1 flex justify-end">
        <PrimaryButton disabled={applying || !dirty} onClick={() => void applyText()}>
          Apply
        </PrimaryButton>
      </div>
    </>
  );
};

// -- Typography ------------------------------------------------------------

export const TypographySection = ({ classNameDraft, setClassName, applying }: SectionProps) => (
  <>
    <LabeledField label="Size">
      <SizePicker
        current={findClass(classNameDraft, TEXT_SIZE_PATTERN)}
        onPick={(cls) => setClassName(replaceGroup(classNameDraft, TEXT_SIZE_PATTERN, cls))}
        disabled={applying}
      />
    </LabeledField>
    <LabeledField label="Weight">
      <WeightPicker
        current={findClass(classNameDraft, FONT_WEIGHT_PATTERN)}
        onPick={(cls) => setClassName(replaceGroup(classNameDraft, FONT_WEIGHT_PATTERN, cls))}
        disabled={applying}
      />
    </LabeledField>
    <LabeledField label="Color">
      <ColorPicker
        prefix="text"
        currentClass={findClass(classNameDraft, colorGroupPattern('text'))}
        onPick={(cls) => setClassName(replaceGroup(classNameDraft, colorGroupPattern('text'), cls))}
        disabled={applying}
      />
    </LabeledField>
  </>
);

// -- Text align ------------------------------------------------------------

export const TextAlignSection = ({ classNameDraft, setClassName, applying }: SectionProps) => (
  <AlignPicker liveClass={classNameDraft} setClassName={setClassName} disabled={applying} />
);

// -- Fill (background + border) --------------------------------------------

export const FillSection = ({ classNameDraft, setClassName, applying }: SectionProps) => (
  <>
    <LabeledField label="Background">
      <ColorPicker
        prefix="bg"
        currentClass={findClass(classNameDraft, colorGroupPattern('bg'))}
        onPick={(cls) => setClassName(replaceGroup(classNameDraft, colorGroupPattern('bg'), cls))}
        disabled={applying}
      />
    </LabeledField>
    <LabeledField label="Border">
      <ColorPicker
        prefix="border"
        currentClass={findClass(classNameDraft, colorGroupPattern('border'))}
        onPick={(cls) =>
          setClassName(replaceGroup(classNameDraft, colorGroupPattern('border'), cls))
        }
        disabled={applying}
      />
    </LabeledField>
  </>
);

// -- Shape (radius) --------------------------------------------------------

export const ShapeSection = ({ classNameDraft, setClassName, applying }: SectionProps) => (
  <LabeledField label="Radius">
    <RadiusPicker
      current={findClass(classNameDraft, RADIUS_PATTERN)}
      onPick={(cls) => setClassName(replaceGroup(classNameDraft, RADIUS_PATTERN, cls))}
      disabled={applying}
    />
  </LabeledField>
);

// -- Layout (flex/grid) ----------------------------------------------------

export const LayoutSection = ({ classNameDraft, setClassName, applying }: SectionProps) => (
  <LayoutPicker liveClass={classNameDraft} setClassName={setClassName} disabled={applying} />
);

// -- Padding / Gap ---------------------------------------------------------

const SpacingRow = ({
  iconLabel,
  label,
  prefix,
  classNameDraft,
  setClassName,
  applying,
}: {
  iconLabel: string;
  label: string;
  prefix: string;
  classNameDraft: string;
  setClassName: (next: string) => void;
  applying: boolean;
}) => {
  const pattern = spacingGroupPattern(prefix);
  return (
    <Scrubber
      iconLabel={iconLabel}
      label={label}
      scale={SPACING_SCALE}
      valueIndex={spacingIndex(classNameDraft, pattern)}
      onCommit={(step) => setClassName(replaceGroup(classNameDraft, pattern, `${prefix}-${step}`))}
      disabled={applying}
    />
  );
};

export const PaddingSection = (props: SectionProps) => (
  <div className="grid grid-cols-2 gap-2">
    <SpacingRow iconLabel="X" label="Padding X" prefix="px" {...props} />
    <SpacingRow iconLabel="Y" label="Padding Y" prefix="py" {...props} />
  </div>
);

export const GapSection = (props: SectionProps) => (
  <SpacingRow iconLabel="↔" label="Gap between children" prefix="gap" {...props} />
);

// -- Classes (escape hatch) ------------------------------------------------

export const ClassesSection = ({
  selection,
  classNameDraft,
  setClassNameDraft,
  setClassName,
  applying,
}: SectionProps) => {
  const dirty = classNameDraft !== (selection.className ?? '');
  return (
    <>
      <textarea
        value={classNameDraft}
        onChange={(e) => setClassNameDraft(e.target.value)}
        rows={3}
        spellCheck={false}
        className="w-full resize-none rounded-[5px] p-2 font-mono text-[10px] leading-[14px] outline-none"
        style={{ background: 'var(--ui-bg-input)', color: 'var(--ui-text)' }}
      />
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <button
          type="button"
          onClick={() => setClassNameDraft(selection.className ?? '')}
          style={{ color: 'var(--ui-text-secondary)' }}
          className="hover:underline"
        >
          reset
        </button>
        <PrimaryButton disabled={applying || !dirty} onClick={() => setClassName(classNameDraft)}>
          Apply
        </PrimaryButton>
      </div>
    </>
  );
};

// -- helpers ---------------------------------------------------------------

const PrimaryButton = ({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="h-6 rounded-[5px] px-2 text-[11px] font-medium disabled:opacity-40"
    style={{ background: 'var(--ui-accent)', color: '#fff' }}
  >
    {children}
  </button>
);

function spacingIndex(className: string, pattern: RegExp): number | null {
  const m = findClass(className, pattern);
  if (!m) return null;
  const step = Number(m.split('-').pop());
  if (!Number.isFinite(step)) return null;
  const idx = SPACING_SCALE.indexOf(step as (typeof SPACING_SCALE)[number]);
  return idx < 0 ? null : idx;
}

function shortPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}
