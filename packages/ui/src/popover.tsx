import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './utils.js';

export interface PopoverTriggerProps {
  ref: (node: HTMLButtonElement | null) => void;
  type: 'button';
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': 'dialog';
  onClick: () => void;
}

/** Small non-modal popover with outside dismissal, Escape handling and trigger focus. */
export function Popover({
  open,
  onOpenChange,
  label,
  trigger,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLElement>('[data-slot="popover"]')
        ?.querySelector<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )
        ?.focus();
    });
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        onOpenChangeRef.current(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChangeRef.current(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex">
      {trigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        type: 'button',
        'aria-expanded': open,
        'aria-controls': id,
        'aria-haspopup': 'dialog',
        onClick: () => onOpenChange(!open),
      })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          data-slot="popover"
          className={cn(
            'absolute end-0 top-full z-50 mt-2 max-h-[min(80dvh,620px)] w-[min(440px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-border bg-card text-foreground shadow-2xl',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
