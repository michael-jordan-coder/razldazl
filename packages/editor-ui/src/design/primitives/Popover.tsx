// UI3-style popover: compact dark panel, 5px radius, 8px shadow, subtle border.

import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';

export interface PanelPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const PanelPopover = ({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  open,
  onOpenChange,
}: PanelPopoverProps) => (
  <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>{trigger}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        align={align}
        side={side}
        sideOffset={4}
        className="z-50 rounded-[5px] border p-2 text-[11px] leading-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.06)] outline-none"
        style={{
          background: 'var(--ui-bg)',
          borderColor: 'var(--ui-border-strong)',
          color: 'var(--ui-text)',
        }}
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);
