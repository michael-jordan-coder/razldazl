import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToolCall } from '@product/protocol';
import type { Selection } from './useSelection.js';
import { Scrubber } from './design/Scrubber.js';
import { ColorPicker } from './design/ColorPicker.js';
import { SizePicker } from './design/SizePicker.js';
import { WeightPicker } from './design/WeightPicker.js';
import { RadiusPicker } from './design/RadiusPicker.js';
import { SPACING_SCALE } from './design/tailwind-palette.js';
import {
  colorGroupPattern,
  findClass,
  radiusPattern,
  replaceGroup,
  spacingGroupPattern,
  textSizePattern,
  fontWeightPattern,
} from './design/className-utils.js';

export interface DesignPanelProps {
  selection: Selection | null;
  applying: boolean;
  onApply(ops: ToolCall[]): Promise<void> | void;
}

export const DesignPanel = ({ selection, applying, onApply }: DesignPanelProps) => {
  const [text, setText] = useState<string>('');
  const [classNameDraft, setClassNameDraft] = useState<string>('');

  const selectionKey = selection
    ? `${selection.source.fileName}:${selection.source.lineNumber}:${selection.source.columnNumber}`
    : '';

  useEffect(() => {
    setText(selection?.text ?? '');
    setClassNameDraft(selection?.className ?? '');
  }, [selectionKey, selection?.className, selection?.text]);

  if (!selection) {
    return (
      <aside
        className="flex w-[260px] shrink-0 flex-col border-l"
        style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
      >
        <PanelHeader title="Design" />
        <EmptyState />
      </aside>
    );
  }

  const liveClass = classNameDraft;

  const setClassName = (next: string) => {
    setClassNameDraft(next);
    void onApply([
      {
        tool: 'setJSXProp',
        args: { source: selection.source, prop: 'className', value: next },
      },
    ]);
  };

  const replaceSpacing = (prefix: string, step: number) => {
    setClassName(replaceGroup(liveClass, spacingGroupPattern(prefix), `${prefix}-${step}`));
  };

  const replaceColor = (prefix: 'bg' | 'text' | 'border', cls: string | null) => {
    setClassName(replaceGroup(liveClass, colorGroupPattern(prefix), cls));
  };

  const replaceToken = (pattern: RegExp, cls: string) => {
    setClassName(replaceGroup(liveClass, pattern, cls));
  };

  const applyText = () => {
    if (selection.text === null) return;
    return onApply([
      {
        tool: 'updateJSXText',
        args: { source: selection.source, text },
      },
    ]);
  };

  const spacingIndex = (prefix: string): number | null => {
    const m = findClass(liveClass, spacingGroupPattern(prefix));
    if (!m) return null;
    const step = Number(m.split('-').pop());
    if (!Number.isFinite(step)) return null;
    const idx = SPACING_SCALE.indexOf(step as (typeof SPACING_SCALE)[number]);
    return idx < 0 ? null : idx;
  };

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-l text-[11px] leading-[16px]"
      style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
    >
      <PanelHeader title="Design" />

      <Section title="Element" bold>
        <Row>
          <code
            className="rounded-[3px] px-1 py-0.5 font-mono text-[11px]"
            style={{ background: 'var(--ui-bg-input)', color: 'var(--ui-accent)' }}
          >
            &lt;{selection.tag}&gt;
          </code>
          <span className="truncate" style={{ color: 'var(--ui-text-secondary)' }}>
            {short(selection.source.fileName)}:{selection.source.lineNumber}
          </span>
        </Row>
      </Section>

      {selection.text !== null && (
        <Section title="Text" bold>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-[5px] p-2 text-[11px] leading-[16px] outline-none"
            style={{
              background: 'var(--ui-bg-input)',
              color: 'var(--ui-text)',
            }}
          />
          <div className="mt-1 flex justify-end">
            <PrimaryButton
              disabled={applying || text === (selection.text ?? '')}
              onClick={() => void applyText()}
            >
              Apply
            </PrimaryButton>
          </div>
        </Section>
      )}

      <Section title="Typography" bold>
        <Field label="Size">
          <SizePicker
            current={findClass(liveClass, textSizePattern())}
            onPick={(cls) => replaceToken(textSizePattern(), cls)}
            disabled={applying}
          />
        </Field>
        <Field label="Weight">
          <WeightPicker
            current={findClass(liveClass, fontWeightPattern())}
            onPick={(cls) => replaceToken(fontWeightPattern(), cls)}
            disabled={applying}
          />
        </Field>
        <Field label="Color">
          <ColorPicker
            prefix="text"
            currentClass={findClass(liveClass, colorGroupPattern('text'))}
            onPick={(cls) => replaceColor('text', cls)}
            disabled={applying}
          />
        </Field>
      </Section>

      <Section title="Fill" bold>
        <Field label="Background">
          <ColorPicker
            prefix="bg"
            currentClass={findClass(liveClass, colorGroupPattern('bg'))}
            onPick={(cls) => replaceColor('bg', cls)}
            disabled={applying}
          />
        </Field>
        <Field label="Border">
          <ColorPicker
            prefix="border"
            currentClass={findClass(liveClass, colorGroupPattern('border'))}
            onPick={(cls) => replaceColor('border', cls)}
            disabled={applying}
          />
        </Field>
      </Section>

      <Section title="Shape" bold>
        <Field label="Radius">
          <RadiusPicker
            current={findClass(liveClass, radiusPattern())}
            onPick={(cls) => replaceToken(radiusPattern(), cls)}
            disabled={applying}
          />
        </Field>
      </Section>

      <Section title="Spacing" bold>
        <TwoCol>
          <Scrubber
            iconLabel="X"
            label="Padding X"
            scale={SPACING_SCALE}
            valueIndex={spacingIndex('px')}
            onCommit={(step) => replaceSpacing('px', step)}
            disabled={applying}
          />
          <Scrubber
            iconLabel="Y"
            label="Padding Y"
            scale={SPACING_SCALE}
            valueIndex={spacingIndex('py')}
            onCommit={(step) => replaceSpacing('py', step)}
            disabled={applying}
          />
        </TwoCol>
        <Scrubber
          iconLabel="↔"
          label="Gap between children"
          scale={SPACING_SCALE}
          valueIndex={spacingIndex('gap')}
          onCommit={(step) => replaceSpacing('gap', step)}
          disabled={applying}
        />
      </Section>

      <Section title="Classes" bold>
        <textarea
          value={classNameDraft}
          onChange={(e) => setClassNameDraft(e.target.value)}
          rows={3}
          spellCheck={false}
          className="w-full resize-none rounded-[5px] p-2 font-mono text-[10px] leading-[14px] outline-none"
          style={{
            background: 'var(--ui-bg-input)',
            color: 'var(--ui-text)',
          }}
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
          <PrimaryButton
            disabled={applying || classNameDraft === (selection.className ?? '')}
            onClick={() => setClassName(classNameDraft)}
          >
            Apply
          </PrimaryButton>
        </div>
      </Section>
    </aside>
  );
};

const PanelHeader = ({ title }: { title: string }) => (
  <header
    className="flex h-[40px] shrink-0 items-center border-b pl-4 pr-2 text-[13px] font-medium"
    style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text)' }}
  >
    {title}
  </header>
);

const Section = ({
  title,
  bold,
  children,
}: {
  title: string;
  bold?: boolean;
  children: ReactNode;
}) => (
  <section className="flex flex-col border-b pb-2" style={{ borderColor: 'var(--ui-border)' }}>
    <div
      className="flex h-[40px] shrink-0 items-center pl-4 pr-2 text-[11px] tracking-[0.055px]"
      style={{
        color: 'var(--ui-text)',
        fontWeight: bold ? 550 : 450,
      }}
    >
      {title}
    </div>
    <div className="flex flex-col gap-1 pl-4 pr-2">{children}</div>
  </section>
);

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex h-6 items-center gap-2 text-[11px]">{children}</div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-2">
    <span className="w-16 shrink-0" style={{ color: 'var(--ui-text-secondary)' }}>
      {label}
    </span>
    <div className="flex-1">{children}</div>
  </div>
);

const TwoCol = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
);

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

const EmptyState = () => (
  <div className="p-4 text-[11px]" style={{ color: 'var(--ui-text-secondary)' }}>
    Select an element in the preview.
  </div>
);

function short(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}
