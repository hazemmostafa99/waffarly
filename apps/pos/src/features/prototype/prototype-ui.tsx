import { cn } from '@waffarly/ui';
import { PosButton } from '../../components/pos-button.js';

export { PosButton as PreviewButton };
export function StatusPill({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold',
        warning
          ? 'bg-[var(--pos-note)] text-[var(--pos-note-ink)]'
          : 'bg-[var(--pos-active)] text-[var(--pos-active-ink)]',
      )}
    >
      {children}
    </span>
  );
}
