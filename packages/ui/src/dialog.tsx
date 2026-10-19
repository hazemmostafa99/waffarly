import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from './utils.js';

/** Controlled native modal: browser focus containment, Escape and focus restoration. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  className,
  style,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) {
      if (element.open) element.close();
      return;
    }
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      // Conditional dialogs may unmount before the browser can restore their trigger.
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      data-slot="dialog"
      style={style}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        // StrictMode may queue a close event before reopening the same native dialog.
        if (open && dialog.current && !dialog.current.open) onOpenChange(false);
      }}
      className={cn(
        'm-auto max-h-[90dvh] w-[min(560px,calc(100%-32px))] overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/55',
        className,
      )}
    >
      <div
        data-slot="dialog-header"
        className="flex items-start justify-between gap-4 border-b border-border p-6"
      >
        <div>
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {title}
          </h2>
          {description && (
            <p id={`${id}-description`} className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={closeLabel}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-xl hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring print:hidden"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
