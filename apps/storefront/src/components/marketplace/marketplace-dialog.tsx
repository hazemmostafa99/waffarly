'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function MarketplaceDialog({
  open,
  onClose,
  title,
  id,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  id?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      id={id}
      className="marketplace-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="marketplace-dialog-panel">
        <div className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="close" aria-label="إغلاق" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="marketplace-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
