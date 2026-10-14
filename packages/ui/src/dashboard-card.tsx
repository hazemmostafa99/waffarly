import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from './utils.js';

export type DashboardCardProps = Omit<ComponentProps<'section'>, 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function DashboardCard({
  title,
  description,
  action,
  children,
  className,
  ...props
}: DashboardCardProps) {
  const headingId = useId();
  return (
    <section className={cn('wf-dashboard-card', className)} aria-labelledby={headingId} {...props}>
      <header className="wf-card-heading">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export type SummaryCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  detail?: ReactNode;
  tone?: 'cream' | 'mint' | 'blue' | 'rose';
  className?: string;
};

export function SummaryCard({
  label,
  value,
  icon,
  detail,
  tone = 'mint',
  className,
}: SummaryCardProps) {
  return (
    <article className={cn('wf-summary-card', className)}>
      <div className={`wf-summary-inner wf-tone-${tone}`}>
        <div className="wf-summary-copy">
          <span>{label}</span>
          <strong>{value}</strong>
          {detail && <small>{detail}</small>}
        </div>
        {icon && (
          <span className="wf-summary-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
    </article>
  );
}
