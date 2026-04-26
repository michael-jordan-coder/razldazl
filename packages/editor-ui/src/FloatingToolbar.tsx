// Floating bottom-center tool palette. Always visible, overlays the preview.
//
// Tools (left → right):
//   - Select: toggles edit / preview mode (selection-capture on / off).
//   - Components: opens the component-library picker flyout (rendered by App.tsx
//     as a sibling, not a child, so it floats above this bar).
//
// More tools (zoom, hand, comment) slot in as additional ToolButton rows.

import type { EditorMode } from './Toolbar.js';

export interface FloatingToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  componentPickerOpen: boolean;
  onToggleComponentPicker: () => void;
}

export const FloatingToolbar = ({
  mode,
  onModeChange,
  componentPickerOpen,
  onToggleComponentPicker,
}: FloatingToolbarProps) => {
  const selectActive = mode === 'edit';

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 select-none"
      role="toolbar"
      aria-label="Editor tools"
      data-floating-toolbar
    >
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-[10px] border p-1 shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md"
        style={{
          background: 'rgba(30, 30, 30, 0.92)',
          borderColor: 'var(--ui-border-strong)',
        }}
      >
        <ToolButton
          active={selectActive}
          label="Select"
          shortcut="V"
          onClick={() => onModeChange(selectActive ? 'preview' : 'edit')}
        >
          <CursorIcon />
        </ToolButton>
        <ToolButton
          active={componentPickerOpen}
          label="Components"
          shortcut="C"
          onClick={onToggleComponentPicker}
        >
          <ComponentsIcon />
        </ToolButton>
      </div>
    </div>
  );
};

interface ToolButtonProps {
  active: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolButton = ({ active, label, shortcut, onClick, children }: ToolButtonProps) => (
  <button
    type="button"
    title={shortcut ? `${label} (${shortcut})` : label}
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors"
    style={{
      background: active ? 'var(--ui-accent)' : 'transparent',
      color: active ? '#fff' : 'var(--ui-text-secondary)',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'var(--ui-bg-hover)';
        e.currentTarget.style.color = 'var(--ui-text)';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--ui-text-secondary)';
      }
    }}
  >
    {children}
  </button>
);

const CursorIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />
  </svg>
);

const ComponentsIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
