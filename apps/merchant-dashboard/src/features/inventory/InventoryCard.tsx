import { DashboardCard, cn, type DashboardCardProps } from '@waffarly/ui';

/** Inventory uses the same dashboard card as Products. */
export function InventoryCard({
  title,
  description,
  action,
  children,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <DashboardCard
      className={cn('inventory-card', className)}
      title={title}
      description={description}
      action={action}
      {...props}
    >
      {children}
    </DashboardCard>
  );
}
