import { Button, cn, type ButtonProps } from '@waffarly/ui';

export function PosButton({ className, variant = 'outline', ...props }: ButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn(
        'rounded-md',
        variant === 'outline' &&
          'border-border bg-card text-foreground hover:bg-secondary hover:text-foreground',
        variant === 'solid' &&
          'border-primary bg-primary bg-none text-primary-foreground shadow-none hover:bg-primary/90',
        className,
      )}
      {...props}
    />
  );
}
