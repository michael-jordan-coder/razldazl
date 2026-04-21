// Top toolbar: 40px row spanning the full editor width. Left side shows
// connection/preview status dots, center holds the Edit/Preview segmented
// control (primary mode switch), right side is room for zoom / device presets
// in future slices.

import { SegmentedControl } from './design/primitives/SegmentedControl.js';

export type EditorMode = 'edit' | 'preview';

export interface ToolbarProps {
  connected: boolean;
  previewReady: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

export const Toolbar = ({ connected, previewReady, mode, onModeChange }: ToolbarProps) => (
  <header
    className="flex h-[40px] shrink-0 items-center justify-between border-b px-3 text-[11px] leading-[16px] tracking-[0.055px]"
    style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-border)' }}
  >
    <div className="flex items-center gap-3" style={{ color: 'var(--ui-text-secondary)' }}>
      <StatusChip ok={connected} label={connected ? 'Connected' : 'Offline'} />
      <StatusChip ok={previewReady} label={previewReady ? 'Preview' : 'Loading'} />
    </div>

    <ModeSwitch mode={mode} onChange={onModeChange} />

    <div className="w-[120px] text-right text-[11px]" style={{ color: 'var(--ui-text-tertiary)' }}>
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

const ModeSwitch = ({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (m: EditorMode) => void;
}) => (
  <SegmentedControl<EditorMode>
    ariaLabel="Editor mode"
    value={mode}
    onChange={onChange}
    items={[
      { value: 'edit', label: 'Edit' },
      { value: 'preview', label: 'Preview' },
    ]}
  />
);
