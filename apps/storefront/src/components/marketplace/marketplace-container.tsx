import type { ComponentPropsWithoutRef } from 'react';

export function MarketplaceContainer({
  className = '',
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={`container ${className}`} {...props} />;
}
