// Role-based Design panel. The selected element is classified into a role
// (text / button / input / image / container / fallback), and we walk the
// role→sections map to render only the sections that matter.

import { useEffect, useState, type ReactNode } from 'react';
import type { ToolCall } from '@product/protocol';
import type { Selection } from './useSelection.js';
import { ROLE_LABEL, ROLE_SECTIONS, roleOf, type SectionId } from './design/role.js';
import {
  ClassesSection,
  ContentSection,
  ElementSection,
  FillSection,
  GapSection,
  LayoutSection,
  PaddingSection,
  ShapeSection,
  TextAlignSection,
  TypographySection,
  type SectionProps,
} from './design/sections.js';

export interface DesignPanelProps {
  selection: Selection | null;
  applying: boolean;
  onApply(ops: ToolCall[]): Promise<void> | void;
}

const SECTION_TITLE: Record<SectionId, string> = {
  element: 'Element',
  content: 'Content',
  typography: 'Typography',
  textAlign: 'Text align',
  fill: 'Fill',
  shape: 'Shape',
  layout: 'Layout',
  padding: 'Padding',
  gap: 'Gap',
  classes: 'Classes',
};

const SECTION_RENDER: Record<SectionId, (props: SectionProps) => ReactNode> = {
  element: ElementSection,
  content: ContentSection,
  typography: TypographySection,
  textAlign: TextAlignSection,
  fill: FillSection,
  shape: ShapeSection,
  layout: LayoutSection,
  padding: PaddingSection,
  gap: GapSection,
  classes: ClassesSection,
};

export const DesignPanel = ({ selection, applying, onApply }: DesignPanelProps) => {
  const [text, setText] = useState<string>('');
  const [classNameDraft, setClassNameDraft] = useState<string>('');

  const selectionKey = selection
    ? `${selection.source.fileName}:${selection.source.lineNumber}:${selection.source.columnNumber}`
    : '';

  useEffect(() => {
    setText(selection?.text ?? '');
    setClassNameDraft(selection?.className ?? '');
  }, [selectionKey]);

  if (!selection) {
    return (
      <aside
        className="flex w-[260px] shrink-0 flex-col border-l"
        style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
      >
        <PanelHeader title="Design" />
        <div className="p-4 text-[11px]" style={{ color: 'var(--ui-text-secondary)' }}>
          Select an element in the preview.
        </div>
      </aside>
    );
  }

  const role = roleOf(selection);

  const setClassName = (next: string) => {
    setClassNameDraft(next);
    void onApply([
      {
        tool: 'setJSXProp',
        args: { source: selection.source, prop: 'className', value: next },
      },
    ]);
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

  const sectionProps: SectionProps = {
    selection,
    classNameDraft,
    text,
    setText,
    setClassNameDraft,
    setClassName,
    applyText,
    onApply,
    applying,
  };

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-l text-[11px] leading-[16px]"
      style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
    >
      <PanelHeader title="Design" subtitle={ROLE_LABEL[role]} />
      {ROLE_SECTIONS[role].map((id) => {
        const Render = SECTION_RENDER[id];
        return (
          <Section key={id} title={SECTION_TITLE[id]} bold={id !== 'classes'}>
            <Render {...sectionProps} />
          </Section>
        );
      })}
    </aside>
  );
};

const PanelHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <header
    className="flex h-[40px] shrink-0 items-center justify-between border-b pl-4 pr-3 text-[13px] font-medium"
    style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text)' }}
  >
    <span>{title}</span>
    {subtitle && (
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: 'var(--ui-text-tertiary)' }}
      >
        {subtitle}
      </span>
    )}
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
    <div className="flex flex-col gap-1.5 pl-4 pr-2">{children}</div>
  </section>
);
