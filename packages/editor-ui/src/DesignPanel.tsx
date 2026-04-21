import { useEffect, useState } from 'react';
import type { ToolCall } from '@product/protocol';
import type { Selection } from './useSelection.js';

export interface DesignPanelProps {
  selection: Selection | null;
  applying: boolean;
  onApply(ops: ToolCall[]): Promise<void> | void;
}

// Curated Tailwind chip sets. These are tokens the panel knows how to toggle
// within the element's className — selecting a chip replaces any same-group
// class already present.
const CHIP_GROUPS: { label: string; classes: readonly string[] }[] = [
  {
    label: 'Text size',
    classes: ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'],
  },
  {
    label: 'Weight',
    classes: ['font-normal', 'font-medium', 'font-semibold', 'font-bold'],
  },
  {
    label: 'Rounded',
    classes: ['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-full'],
  },
  {
    label: 'Padding X',
    classes: ['px-0', 'px-1', 'px-2', 'px-3', 'px-4', 'px-6', 'px-8'],
  },
  {
    label: 'Padding Y',
    classes: ['py-0', 'py-1', 'py-2', 'py-3', 'py-4', 'py-6'],
  },
  {
    label: 'Background',
    classes: [
      'bg-slate-900',
      'bg-slate-700',
      'bg-white',
      'bg-indigo-500',
      'bg-blue-500',
      'bg-emerald-500',
      'bg-rose-500',
      'bg-amber-500',
      'bg-transparent',
    ],
  },
  {
    label: 'Text color',
    classes: [
      'text-slate-900',
      'text-slate-600',
      'text-white',
      'text-indigo-500',
      'text-emerald-500',
      'text-rose-500',
    ],
  },
];

export const DesignPanel = ({ selection, applying, onApply }: DesignPanelProps) => {
  const [text, setText] = useState<string>('');
  const [className, setClassName] = useState<string>('');

  useEffect(() => {
    setText(selection?.text ?? '');
    setClassName(selection?.className ?? '');
  }, [selection?.source.fileName, selection?.source.lineNumber, selection?.source.columnNumber]);

  if (!selection) {
    return (
      <aside className="w-80 flex flex-col border-l border-slate-800 bg-slate-900 text-slate-300">
        <Header title="Design" />
        <div className="p-4 text-sm text-slate-500">
          Select an element in the preview to see its controls.
        </div>
      </aside>
    );
  }

  const applySetClassName = (value: string) =>
    onApply([
      {
        tool: 'setJSXProp',
        args: { source: selection.source, prop: 'className', value },
      },
    ]);

  const applyText = () => {
    if (selection.text === null) return;
    return onApply([
      {
        tool: 'updateJSXText',
        args: { source: selection.source, text },
      },
    ]);
  };

  const toggleChip = (group: readonly string[], chip: string) => {
    const current = className.split(/\s+/).filter(Boolean);
    // Remove any class from this group that's already present, then add chip
    // unless chip was the one already present (toggle off).
    const present = current.find((c) => group.includes(c));
    const withoutGroup = current.filter((c) => !group.includes(c));
    const next = present === chip ? withoutGroup : [...withoutGroup, chip];
    const nextValue = next.join(' ');
    setClassName(nextValue);
    void applySetClassName(nextValue);
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

      <Section label="Classes">
        <textarea
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          rows={3}
          className="w-full resize-none rounded border border-slate-800 bg-slate-950 p-2 font-mono text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          spellCheck={false}
        />
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => {
              setClassName(selection.className ?? '');
            }}
            className="hover:text-slate-300"
          >
            reset
          </button>
          <button
            type="button"
            disabled={applying || className === (selection.className ?? '')}
            onClick={() => void applySetClassName(className)}
            className="rounded bg-indigo-500 px-3 py-1 font-medium text-white disabled:opacity-40"
          >
            {applying ? '…' : 'Apply classes'}
          </button>
        </div>
      </Section>

      {CHIP_GROUPS.map((group) => (
        <Section key={group.label} label={group.label}>
          <div className="flex flex-wrap gap-1">
            {group.classes.map((chip) => {
              const active = className.split(/\s+/).includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  disabled={applying}
                  onClick={() => toggleChip(group.classes, chip)}
                  className={[
                    'rounded-full px-2 py-0.5 text-xs font-mono border transition',
                    active
                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200',
                    applying ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </Section>
      ))}
    </aside>
  );
};

const Header = ({ title }: { title: string }) => (
  <header className="border-b border-slate-800 p-3 text-xs uppercase tracking-wider text-slate-500">
    {title}
  </header>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section className="border-b border-slate-800 p-3">
    <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    {children}
  </section>
);

function short(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}
