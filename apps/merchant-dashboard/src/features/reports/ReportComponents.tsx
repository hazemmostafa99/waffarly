/** Reusable report cards, notices and accessible charts with explicit missing-data states. */
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { reportChange, reportMoney } from './report-helpers.js';

export function ReportPanel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`report-panel ${className}`}>
      <div className="report-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && (
            <details className="report-inline-help">
              <summary>
                <span aria-label={description}>ⓘ</span>
              </summary>
              <p>{description}</p>
            </details>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ReportMetric({
  label,
  value,
  previous,
  locale,
  description,
  to,
  accent = 'mint',
}: {
  label: string;
  value: string | null;
  previous?: string | null;
  locale: string;
  description: string;
  to?: string;
  accent?: 'mint' | 'blue' | 'amber' | 'violet';
}) {
  const change = previous === undefined ? null : reportChange(value, previous);
  return (
    <article className={`report-metric report-accent-${accent}`}>
      <span className="report-metric-label">{label}</span>
      <strong className="report-metric-value">
        <bdi>
          {value === null
            ? locale === 'ar'
              ? 'غير متاح'
              : 'Unavailable'
            : reportMoney(value, locale)}
        </bdi>
      </strong>
      <span className="report-metric-context" title={description}>
        {value === null ? (locale === 'ar' ? 'بيانات ناقصة' : 'Incomplete data') : ''}
      </span>
      {previous !== undefined && change !== null && (
        <span className="report-change">
          <bdi>{change ?? '—'}</bdi>{' '}
          {locale === 'ar' ? 'مقارنة بالشهر السابق' : 'vs. previous month'}
        </span>
      )}
      {to && (
        <Link className="report-metric-link" to={to}>
          {locale === 'ar' ? 'عرض التفاصيل' : 'View details'}
          <span aria-hidden="true">↗</span>
        </Link>
      )}
    </article>
  );
}

export function ReportNotice({
  title,
  children,
  to,
}: {
  title: string;
  children: ReactNode;
  to?: string;
}) {
  return (
    <div className="report-notice">
      <span className="report-notice-icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>{to ? <Link to={to}>{title}</Link> : title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export interface ReportBar {
  id: string;
  label: string;
  amount: string | null;
  to?: string;
}

export function ReportBars({
  rows,
  locale,
  emptyText,
  color = 'mint',
  variant = 'bars',
}: {
  variant?: 'bars' | 'list';
  rows: ReportBar[];
  locale: string;
  emptyText: string;
  color?: 'mint' | 'blue' | 'amber';
}) {
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(Number(row.amount ?? 0))));
  if (!rows.length || rows.every((row) => row.amount === '0.00' || row.amount === '0'))
    return <div className="report-empty">{emptyText}</div>;
  return (
    <ul className={`report-bars report-bars-${color} report-bars-${variant}`}>
      {rows.map((row) => (
        <li key={row.id}>
          <div className="report-bar-label">
            {row.to ? <Link to={row.to}>{row.label}</Link> : <span>{row.label}</span>}
            <strong>
              <bdi>
                {row.amount === null
                  ? locale === 'ar'
                    ? 'غير متاح'
                    : 'Unavailable'
                  : reportMoney(row.amount, locale)}
              </bdi>
            </strong>
          </div>
          {variant === 'bars' && row.amount !== null && (
            <div className="report-bar-track" aria-hidden="true">
              <span
                className={Number(row.amount) < 0 ? 'is-negative' : ''}
                style={{ width: `${(Math.abs(Number(row.amount ?? 0)) / maximum) * 100}%` }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface ReportChartSeries {
  key: string;
  label: string;
  color: string;
}
export interface ReportChartPoint {
  label: string;
  values: Array<string | null>;
}

export function ReportTrendChart({
  points,
  series,
  locale,
  title,
  emptyText,
}: {
  points: ReportChartPoint[];
  series: ReportChartSeries[];
  locale: string;
  title: string;
  emptyText: string;
}) {
  const titleId = useId();
  const values = points.flatMap((point) =>
    point.values.filter((value) => value !== null).map(Number),
  );
  if (!values.some((value) => value !== 0)) return <div className="report-empty">{emptyText}</div>;
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const x = (index: number) => 60 + (index * 660) / Math.max(1, points.length - 1);
  const y = (value: number) => 220 - ((value - low) / (high - low)) * 170;
  return (
    <div className="report-trend" dir="ltr">
      <svg viewBox="0 0 780 265" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{title}</title>
        {[0, 0.5, 1].map((ratio) => {
          const value = low + (high - low) * ratio;
          return (
            <g key={ratio}>
              <line x1="60" x2="720" y1={y(value)} y2={y(value)} className="report-chart-grid" />
              <text x="52" y={y(value) + 4} textAnchor="end" className="report-chart-label">
                {new Intl.NumberFormat('en', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                }).format(value)}
              </text>
            </g>
          );
        })}
        <line x1="60" x2="720" y1={y(0)} y2={y(0)} className="report-chart-zero" />
        {series.map((item, seriesIndex) => {
          // A missing cost breaks the line; it must never draw a fabricated zero.
          let path = '';
          let connected = false;
          points.forEach((point, index) => {
            const value = point.values[seriesIndex];
            if (value === null || value === undefined) {
              connected = false;
              return;
            }
            path += `${connected ? ' L' : ' M'}${x(index)},${y(Number(value))}`;
            connected = true;
          });
          return (
            <g key={item.key}>
              {seriesIndex !== 0 && (
                <path
                  d={path}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {points.map((point, index) => {
                const value = point.values[seriesIndex];
                return value === null || value === undefined ? null : seriesIndex === 0 ? (
                  <rect
                    key={index}
                    x={x(index) - 6}
                    y={Math.min(y(0), y(Number(value)))}
                    width="12"
                    height={Math.max(1, Math.abs(y(0) - y(Number(value))))}
                    rx="2"
                    fill={item.color}
                    opacity=".8"
                  >
                    <title>{`${point.label} · ${item.label}: ${reportMoney(value, locale)}`}</title>
                  </rect>
                ) : (
                  <circle key={index} cx={x(index)} cy={y(Number(value))} r="2" fill={item.color}>
                    <title>{`${point.label} · ${item.label}: ${reportMoney(value, locale)}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
        {points.map((point, index) =>
          index % 5 === 0 || index === points.length - 1 ? (
            <text
              key={index}
              x={x(index)}
              y="250"
              textAnchor="middle"
              className="report-chart-label"
            >
              {point.label.slice(-2)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="report-chart-legend" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <details className="report-chart-data" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <summary>{locale === 'ar' ? 'عرض أرقام الرسم' : 'View chart data'}</summary>
        <div className="report-table-scroll">
          <table>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'اليوم' : 'Day'}</th>
                {series.map((item) => (
                  <th key={item.key}>{item.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.label}>
                  <th scope="row">{point.label}</th>
                  {point.values.map((value, index) => (
                    <td key={index}>
                      <bdi>{reportMoney(value, locale)}</bdi>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
