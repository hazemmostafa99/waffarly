import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from './utils.js';
import { useLocale } from './i18n.js';

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
  const { formatDigits } = useLocale();
  return (
    <section className={cn('wf-dashboard-card', className)} aria-labelledby={headingId} {...props}>
      <header className="wf-card-heading">
        <div>
          <h2 id={headingId}>{typeof title === 'string' ? formatDigits(title) : title}</h2>
          {description && <p>{typeof description === 'string' ? formatDigits(description) : description}</p>}
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
  const { formatNumber, formatDigits } = useLocale();
  return (
    <article className={cn('wf-summary-card', className)}>
      <div className={`wf-summary-inner wf-tone-${tone}`}>
        <div className="wf-summary-copy">
          <span>{label}</span>
          <strong>{typeof value === 'number' ? formatNumber(value) : typeof value === 'string' ? formatDigits(value) : value}</strong>
          {detail && <small>{typeof detail === 'string' ? formatDigits(detail) : detail}</small>}
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
