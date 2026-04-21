// A row: fixed-width left label, flex-1 control on the right. Shared across
// every section in the Design panel so spacing and label width stay aligned.

import type { ReactNode } from 'react';

export interface LabeledFieldProps {
  label: string;
  children: ReactNode;
  /** Override label column width in px. Default 64 (matches panel design.) */
  labelWidth?: number;
}

export const LabeledField = ({ label, children, labelWidth = 64 }: LabeledFieldProps) => (
  <div className="flex items-center gap-2">
    <span
      className="shrink-0"
      style={{ width: labelWidth, color: 'var(--ui-text-secondary)' }}
    >
      {label}
    </span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);
