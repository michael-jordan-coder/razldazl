// Floating bottom-center tool palette. Always visible, overlays the preview.
// First button: Select tool — toggle that drives the editor's selection-capture
// state. When ON, hovering/clicking elements in the preview locks them as the
// current selection and panels are visible. When OFF, clicks pass through to
// the underlying app and the chat + design panels collapse, giving you a clean
// preview state to actually use the app you're editing.
//
// More tools (zoom, hand, comment, etc.) slot in as additional buttons.

import type { EditorMode } from './Toolbar.js';

export interface FloatingToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

export const FloatingToolbar = ({ mode, onModeChange }: FloatingToolbarProps) => {
  const selectActive = mode === 'edit';

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 select-none"
      role="toolbar"
      aria-label="Editor tools"
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
