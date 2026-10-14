import type { ReactNode } from 'react';
import { useLocale } from './i18n.js';

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label: string;
  pageLabel: (page: number) => string;
  previousLabel: string;
  nextLabel: string;
  summary?: (start: number, end: number, total: number) => ReactNode;
  disabled?: boolean;
};

/** Controlled pagination; a bounded window keeps large result sets manageable. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label,
  pageLabel,
  previousLabel,
  nextLabel,
  summary,
  disabled = false,
}: PaginationProps) {
  const { formatNumber } = useLocale();
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  const current = Math.min(pages, Math.max(1, page));
  const visible =
    pages <= 7
      ? Array.from({ length: pages }, (_, index) => index + 1)
      : [...new Set([1, pages, current - 1, current, current + 1])]
          .filter((item) => item >= 1 && item <= pages)
          .sort((a, b) => a - b);
  return (
    <div className="wf-pagination">
      {summary && (
        <span className="wf-pagination-summary" role="status">
          {summary(
            total === 0 ? 0 : (current - 1) * pageSize + 1,
            Math.min(current * pageSize, total),
            total,
          )}
        </span>
      )}
      <nav aria-label={label}>
        <button
          type="button"
          disabled={disabled || current === 1}
          aria-label={previousLabel}
          onClick={() => onPageChange(current - 1)}
        >
          ‹
        </button>
        {visible.map((item, index) => (
          <span key={item} className="wf-pagination-item">
            {index > 0 && item - visible[index - 1]! > 1 && (
              <span className="wf-pagination-gap" aria-hidden="true">
                …
              </span>
            )}
            <button
              type="button"
              aria-label={pageLabel(item)}
              aria-current={item === current ? 'page' : undefined}
              disabled={disabled}
              onClick={() => onPageChange(item)}
            >
              {formatNumber(item)}
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={disabled || current === pages}
          aria-label={nextLabel}
          onClick={() => onPageChange(current + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
