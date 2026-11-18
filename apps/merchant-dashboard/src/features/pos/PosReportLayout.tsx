import type { ReactNode } from 'react';
import { Button, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import './pos-report-workspace.css';

export function PosReportFilters({
  children,
  footer,
  actions,
}: {
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="report-panel pos-report-filter-panel">
      <div className={`pos-report-filters${actions ? ' pos-report-filters--with-actions' : ''}`}>
        {children}
        {actions && <div className="pos-report-filter-actions-inline">{actions}</div>}
      </div>
      {footer}
    </div>
  );
}

export function PosReportPagination({
  summary,
  loading,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  summary: string;
  loading: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="inventory-pagination pos-report-pagination">
      <span>{summary}</span>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !hasPrevious}
          onClick={onPrevious}
        >
          {locale === 'ar' ? 'السابق' : 'Previous'}
        </Button>
        <Button type="button" variant="outline" disabled={loading || !hasNext} onClick={onNext}>
          {locale === 'ar' ? 'التالي' : 'Next'}
        </Button>
      </div>
    </div>
  );
}

export function PosReportEmptyState({
  title,
  description,
  onReset,
}: {
  title: string;
  description: string;
  onReset?: () => void;
}) {
  const { locale } = useLocale();
  return (
    <div className="pos-report-empty">
      <span className="pos-report-empty-icon" aria-hidden="true">
        <Icon name="receipt" />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {onReset && (
        <Button type="button" variant="outline" onClick={onReset}>
          {locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
        </Button>
      )}
    </div>
  );
}
