import { cn } from '@waffarly/ui';

export function MarketplaceSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-purple-100/80 motion-reduce:animate-none',
        className,
      )}
    />
  );
}
