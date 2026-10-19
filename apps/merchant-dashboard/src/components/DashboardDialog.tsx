import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../Icons.js';

export function DashboardDialog({
  title,
  closeLabel,
  onClose,
  children,
  busy = false,
  wide = false,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    dialog?.showModal();
    return () => {
      dialog?.close();
      openerRef.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`products-dialog${wide ? ' inventory-workspace-dialog' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="products-icon-button"
          aria-label={closeLabel}
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
