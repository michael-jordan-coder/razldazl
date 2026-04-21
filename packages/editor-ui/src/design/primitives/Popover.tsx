// Thin wrapper around @radix-ui/react-popover with our dark-theme Tailwind
// defaults. The UI lives in our source tree so we can restyle per-call.

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
        sideOffset={6}
        className="z-50 rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200 shadow-lg shadow-black/40 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);
