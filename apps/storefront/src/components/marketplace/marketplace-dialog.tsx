'use client';

import { cn } from '@waffarly/ui';

import { useEffect, type ReactNode } from 'react';
import { Dialog } from '@waffarly/ui';

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
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div
      id={id}
      onClickCapture={(event) => {
        if (event.target instanceof HTMLDialogElement) onClose();
      }}
    >
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
        title={title}
        closeLabel="إغلاق"
        className={cn(
          'marketplace-dialog fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(430px,calc(100vw-32px))] rounded-[18px] border-0',
          'bg-card p-0 text-foreground shadow-[var(--shadow)] backdrop:bg-[rgba(20,5,27,.5)] [&_[data-slot=dialog-header]]:items-center [&_[data-slot=dialog-header]]:p-5 [&_[data-slot=dialog-header]_h2]:m-0',
          '[&_[data-slot=dialog-header]_h2]:text-[20px] [&_[data-slot=dialog-header]_h2]:font-bold [&_[data-slot=dialog-header]_button]:size-[38px] [&_[data-slot=dialog-header]_button]:border-0 [&_[data-slot=dialog-header]_button]:rounded-[10px] [&_[data-slot=dialog-header]_button]:text-[21px] [&_[data-slot=dialog-header]_button]:bg-secondary',
        )}
      >
        <div className={'p-4.5 [&_p]:mt-0 [&_p]:leading-[1.8]'}>{children}</div>
      </Dialog>
    </div>
  );
}
