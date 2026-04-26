// Top toolbar: 40px row spanning the full editor width. Connection +
// preview status on the left, zoom indicator on the right. The mode
// switcher (Edit / Preview) used to live here — it's now driven by the
// `Select` tool button in the floating bottom toolbar (`FloatingToolbar`),
// which is the single canonical control surface for tool selection.

export type EditorMode = 'edit' | 'preview';

export interface ToolbarProps {
  connected: boolean;
  previewReady: boolean;
}

export const Toolbar = ({ connected, previewReady }: ToolbarProps) => (
  <header
    className="flex h-[40px] shrink-0 items-center justify-between border-b px-3 text-[11px] leading-[16px] tracking-[0.055px]"
    style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
  >
    <div className="flex items-center gap-3" style={{ color: 'var(--ui-text-secondary)' }}>
      <StatusChip ok={connected} label={connected ? 'Connected' : 'Offline'} />
      <StatusChip ok={previewReady} label={previewReady ? 'Preview' : 'Loading'} />
    </div>

    <div className="text-[11px]" style={{ color: 'var(--ui-text-tertiary)' }}>
      100%
    </div>
  </header>
);

const StatusChip = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: ok ? '#3bc876' : '#f24822' }}
    />
    <span>{label}</span>
  </span>
);
