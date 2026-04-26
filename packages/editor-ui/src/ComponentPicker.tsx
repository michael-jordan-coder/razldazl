// Floating component picker — the visual half of the UI library integration
// feature (PRODUCT-ROADMAP/features/ui-library-integration.md, sub-deliverable D).
// Renders as a flyout above the floating bottom toolbar. Click a component
// → the editor inserts it as a child of the currently selected element via
// the existing addElement AST op. v1 ships with the built-in STARTER_COMPONENTS;
// future AI-installed shadcn components will append to the same surface.

import { useEffect, useRef } from 'react';
import type { JSXElementDescriptor } from '@product/protocol';
import { STARTER_COMPONENTS } from './componentLibrary.js';

export interface ComponentPickerProps {
  open: boolean;
  hasSelection: boolean;
  onClose: () => void;
  onInsert: (descriptor: JSXElementDescriptor) => void;
}

export const ComponentPicker = ({
  open,
  hasSelection,
  onClose,
  onInsert,
}: ComponentPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on Esc + outside click. Esc handler scoped to this component so the
  // global V-key handler in App.tsx isn't affected when the picker is closed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      // Don't close if the click is on the toolbar's Components button itself
      // (its onClick will toggle us closed via onClose).
      const toolbar = (e.target as HTMLElement)?.closest('[data-floating-toolbar]');
      if (toolbar) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (descriptor: JSXElementDescriptor) => {
    if (!hasSelection) return;
    onInsert(descriptor);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Component library"
      className="pointer-events-auto absolute bottom-16 left-1/2 z-20 w-[420px] -translate-x-1/2 rounded-[10px] border shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-md"
      style={{
        background: 'rgba(30, 30, 30, 0.96)',
        borderColor: 'var(--ui-border-strong)',
      }}
    >
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium" style={{ color: 'var(--ui-text)' }}>
            Components
          </span>
          <span className="text-[10px]" style={{ color: 'var(--ui-text-tertiary)' }}>
            {STARTER_COMPONENTS.length} starters · click to insert
          </span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-[14px] hover:bg-[var(--ui-bg-hover)]"
          style={{ color: 'var(--ui-text-secondary)' }}
        >
          ×
        </button>
      </header>

      {!hasSelection && (
        <div
          className="border-b px-3 py-2 text-[11px]"
          style={{
            background: 'rgba(13, 153, 255, 0.08)',
            borderColor: 'var(--ui-border)',
            color: 'var(--ui-accent)',
          }}
        >
          Select an element in the preview first — components insert as a child of the selection.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 p-3">
        {STARTER_COMPONENTS.map((c) => (
          <button
            key={c.name}
            type="button"
            disabled={!hasSelection}
            onClick={() => handlePick(c.descriptor)}
            title={c.description}
            className="group flex flex-col items-stretch gap-2 rounded-[6px] border p-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--ui-bg-input)',
              borderColor: 'var(--ui-border)',
            }}
            onMouseEnter={(e) => {
              if (hasSelection) {
                e.currentTarget.style.borderColor = 'var(--ui-accent)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ui-border)';
            }}
          >
            <div className="flex h-10 items-center justify-center">{c.preview()}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--ui-text)' }}>
              {c.name}
            </div>
          </button>
        ))}
      </div>

      <footer
        className="border-t px-3 py-2 text-[10px]"
        style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text-tertiary)' }}
      >
        AI-installed component libraries (shadcn, Radix) coming next.
      </footer>
    </div>
  );
};
