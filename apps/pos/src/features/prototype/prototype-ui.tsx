import { Button, cn, type ButtonProps } from '@waffarly/ui';

export function PreviewButton({ className, variant = 'outline', ...props }: ButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn(
        'rounded-lg font-semibold',
        variant === 'outline' &&
          'border-border bg-card text-foreground hover:bg-secondary hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
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
