import { useEffect, useState } from 'react';
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
  spacingLabel,
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
      <aside className="w-80 flex flex-col border-l border-slate-800 bg-slate-900 text-slate-300">
        <Header title="Design" />
        <div className="p-4 text-sm text-slate-500">
          Select an element in the preview.
        </div>
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
    const next = replaceGroup(liveClass, spacingGroupPattern(prefix), `${prefix}-${step}`);
    setClassName(next);
  };

  const replaceColor = (prefix: 'bg' | 'text' | 'border', cls: string | null) => {
    const next = replaceGroup(liveClass, colorGroupPattern(prefix), cls);
    setClassName(next);
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
    <aside className="w-80 flex flex-col border-l border-slate-800 bg-slate-900 text-slate-200 overflow-y-auto">
      <Header title="Design" />

      <Section label="Element">
        <div className="flex items-center gap-2 text-sm">
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-indigo-300">
            {'<'}
            {selection.tag}
            {'>'}
          </code>
          <span className="text-xs text-slate-500 truncate">
            {short(selection.source.fileName)}:{selection.source.lineNumber}
          </span>
        </div>
      </Section>

      {selection.text !== null && (
        <Section label="Text">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={applying || text === (selection.text ?? '')}
              onClick={() => void applyText()}
              className="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {applying ? '…' : 'Apply text'}
            </button>
          </div>
        </Section>
      )}

      <Section label="Typography">
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
            label=""
            prefix="text"
            currentClass={findClass(liveClass, colorGroupPattern('text'))}
            onPick={(cls) => replaceColor('text', cls)}
            disabled={applying}
          />
        </Field>
      </Section>

      <Section label="Fill">
        <ColorPicker
          label="Background"
          prefix="bg"
          currentClass={findClass(liveClass, colorGroupPattern('bg'))}
          onPick={(cls) => replaceColor('bg', cls)}
          disabled={applying}
        />
        <ColorPicker
          label="Border"
          prefix="border"
          currentClass={findClass(liveClass, colorGroupPattern('border'))}
          onPick={(cls) => replaceColor('border', cls)}
          disabled={applying}
        />
      </Section>

      <Section label="Shape">
        <Field label="Radius">
          <RadiusPicker
            current={findClass(liveClass, radiusPattern())}
            onPick={(cls) => replaceToken(radiusPattern(), cls)}
            disabled={applying}
          />
        </Field>
      </Section>

      <Section label="Spacing">
        <Scrubber
          label="px (horizontal padding)"
          scale={SPACING_SCALE}
          valueIndex={spacingIndex('px')}
          formatValue={spacingLabel}
          onCommit={(step) => replaceSpacing('px', step)}
          disabled={applying}
        />
        <Scrubber
          label="py (vertical padding)"
          scale={SPACING_SCALE}
          valueIndex={spacingIndex('py')}
          formatValue={spacingLabel}
          onCommit={(step) => replaceSpacing('py', step)}
          disabled={applying}
        />
        <Scrubber
          label="gap (children)"
          scale={SPACING_SCALE}
          valueIndex={spacingIndex('gap')}
          formatValue={spacingLabel}
          onCommit={(step) => replaceSpacing('gap', step)}
          disabled={applying}
        />
      </Section>

      <Section label="Classes">
        <textarea
          value={classNameDraft}
          onChange={(e) => setClassNameDraft(e.target.value)}
          rows={3}
          spellCheck={false}
          className="w-full resize-none rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
        />
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setClassNameDraft(selection.className ?? '')}
            className="hover:text-slate-300"
          >
            reset
          </button>
          <button
            type="button"
            disabled={applying || classNameDraft === (selection.className ?? '')}
            onClick={() => setClassName(classNameDraft)}
            className="rounded bg-indigo-500 px-3 py-1 font-medium text-white disabled:opacity-40"
          >
            {applying ? '…' : 'Apply classes'}
          </button>
        </div>
      </Section>
    </aside>
  );
};

const Header = ({ title }: { title: string }) => (
  <header className="border-b border-slate-800 p-3 text-xs uppercase tracking-wider text-slate-500">
    {title}
  </header>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section className="border-b border-slate-800 p-3 space-y-2">
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    {children}
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <span className="w-20 shrink-0 text-slate-400">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);

function short(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}
