/** React equivalents of the supplied HTML's cards, tables, notices and drawer. */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { reportMoney, reportCents } from './report-helpers.js';
import { ReportIcon } from './reference-report-icons.js';
export type ShowReportDetail = (title: string, content: ReactNode) => void;
export const reportText = (locale: string, en: string, ar: string) => (locale === 'ar' ? ar : en);
export function reportValue(
  value: string | number | null | undefined,
  locale: string,
  money = true,
) {
  if (value === null || value === undefined) return '—';
  if (!money && !Number.isFinite(Number(value))) return String(value);
  return money
    ? reportMoney(String(value), locale).replace('.00 ', ' ')
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value));
}
export function decimalFromCents(cents: bigint) {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
export function addAmounts(a: string, b: string) {
  return decimalFromCents(reportCents(a) + reportCents(b));
}
export function ReferenceMetric({
  label,
  note,
  value,
  hero = false,
  delta,
  locale,
  money = true,
}: {
  label: string;
  note: string;
  value: string | number | null | undefined;
  hero?: boolean;
  delta?: string | null;
  locale: string;
  money?: boolean;
}) {
  const negative = value !== null && value !== undefined && Number(value) < 0;
  const formatted = reportValue(value, locale, false);
  return (
    <article className={`metric${hero ? ' hero' : ''}`}>
      <div className="metric-head">
        {label}
        <ReportIcon name="info" />
      </div>
      <div className="metric-num">
        {value == null ? (
          <span className="missing">{'—'}</span>
        ) : (
          <>
            <strong className={negative ? 'red' : ''}>{formatted}</strong>
            {money && <em>{locale === 'ar' ? 'ج.م' : 'EGP'}</em>}
          </>
        )}
      </div>
      {(note || delta) && (
        <div className="metric-footer">
          {delta && <span className={`delta${delta.startsWith('−') ? ' down' : ''}`}>{delta}</span>}
          {note && <span>{note}</span>}
        </div>
      )}
    </article>
  );
}
export function ReferencePanel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-header">
        <div>
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ReferenceFinRow({
  label,
  value,
  locale,
  type = '',
  money = true,
}: {
  label: string;
  value: string | number | null | undefined;
  locale: string;
  type?: string;
  money?: boolean;
}) {
  return (
    <div className={`finrow ${type}`}>
      <span>{label}</span>
      <strong className={value != null && Number(value) < 0 ? 'negative' : ''}>
        {reportValue(value, locale, money)}
      </strong>
    </div>
  );
}
export function ReferenceTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {headers.map((heading, index) => (
              <th key={index} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function ReferenceEmpty({ locale }: { locale: string }) {
  return (
    <div className="state-empty">
      <div className="empty-symbol">
        <ReportIcon name="box" />
      </div>
      <h3>{reportText(locale, 'No activity in this period', 'لا توجد حركة خلال هذه الفترة')}</h3>
      <p>{reportText(locale, 'Try another month or branch.', 'جرّب شهرًا أو فرعًا آخر.')}</p>
    </div>
  );
}
export function ReferenceDistribution({
  title,
  subtitle,
  rows,
  total,
  locale,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ id: string; label: string; amount: string | null }>;
  total: string;
  locale: string;
}) {
  return (
    <ReferencePanel title={title} subtitle={subtitle}>
      <div className="distribution">
        {!rows.length ? (
          <ReferenceEmpty locale={locale} />
        ) : (
          rows.map((row) => (
            <div className="barrow" key={row.id}>
              <div className="barrow-head">
                <b>{row.label}</b>
                <span>{reportValue(row.amount, locale)}</span>
              </div>
              {row.amount !== null && Number(row.amount) >= 0 && Number(total) > 0 && (
                <div className="track">
                  <span
                    style={{
                      width: `${Math.min(100, (Number(row.amount) / Number(total)) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ReferencePanel>
  );
}
export function ReferenceDrawer({
  title,
  children,
  onClose,
  locale,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  locale: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      ref.current?.close();
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  return (
    <dialog
      className="overlay"
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="drawer">
        <div className="drawer-header">
          <h3 id={id}>{title}</h3>
          <button type="button" aria-label={reportText(locale, 'Close', 'إغلاق')} onClick={onClose}>
            <ReportIcon name="close" />
          </button>
        </div>
        <div className="drawer-content">{children}</div>
      </div>
    </dialog>
  );
}
export function ReferenceNotice({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="notice">
      <ReportIcon name="alert" />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action && (
        <button type="button" onClick={onClick}>
          {action} ←
        </button>
      )}
    </div>
  );
}
