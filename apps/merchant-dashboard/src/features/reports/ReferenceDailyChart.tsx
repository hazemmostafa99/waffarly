/** Daily chart geometry and controls match the supplied reference; points come from the report API. */
import { useState } from 'react';
import type { OwnerBusinessReport } from '@waffarly/contracts';
import { ReferencePanel, ReferenceTable, reportText, reportValue } from './reference-report-ui.js';
import { cairoToday } from './reference-report-dates.js';
export function ReferenceDailyChart({
  report,
  locale,
}: {
  report: OwnerBusinessReport;
  locale: string;
}) {
  const [table, setTable] = useState(false),
    [cost, setCost] = useState(true),
    [expenses, setExpenses] = useState(false);
  const data = report.daily
    .filter((day) => day.date <= cairoToday())
    .map((day) => ({ ...day, consumedCost: day.consumedCost ?? day.recordedConsumedCost ?? null }));
  const values = data.flatMap((day) => [
    Number(day.netSales),
    ...(cost && day.consumedCost !== null ? [Number(day.consumedCost)] : []),
    ...(expenses ? [Number(day.expenses)] : []),
  ]);
  const W = 780,
    H = 263,
    L = 50,
    R = 15,
    T = 17,
    B = 33,
    X = W - L - R,
    Y = H - T - B,
    min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    pad = (max - min) * 0.17,
    low = min < 0 ? min - pad : 0,
    high = max + pad;
  const y = (value: number) => T + ((high - value) / (high - low)) * Y,
    base = y(0),
    step = X / Math.max(1, data.length),
    bar = Math.max(4, Math.min(16, step * 0.5));
  const line = (key: 'consumedCost' | 'expenses') => {
    let connected = false,
      path = '';
    data.forEach((day, index) => {
      const value = day[key];
      if (value === null) {
        connected = false;
        return;
      }
      path += `${connected ? 'L' : 'M'}${L + (index + 0.5) * step},${y(Number(value))} `;
      connected = true;
    });
    return path;
  };
  const t = (en: string, ar: string) => reportText(locale, en, ar);
  return (
    <ReferencePanel
      title={t('Daily performance trend', 'اتجاه الأداء اليومي')}
      subtitle={t(
        'Sales and consumed cost during the month',
        'حركة المبيعات وتكلفة الاستهلاك خلال الشهر',
      )}
      action={
        <div className="segmented">
          <button
            type="button"
            className={!table ? 'selected' : ''}
            aria-pressed={!table}
            onClick={() => setTable(false)}
          >
            {t('Daily', 'يومي')}
          </button>
          <button
            type="button"
            className={table ? 'selected' : ''}
            aria-pressed={table}
            onClick={() => setTable(true)}
          >
            {t('Table', 'جدول')}
          </button>
        </div>
      }
    >
      <div className="legend">
        <button type="button">
          <span className="swatch" />
          {t('Net sales', 'صافي المبيعات')}
        </button>
        <button
          type="button"
          className={!cost ? 'off' : ''}
          aria-pressed={cost}
          onClick={() => setCost(!cost)}
        >
          <span className="swatch cost" />
          {t('Cost', 'التكلفة')}
        </button>
        <button
          type="button"
          className={!expenses ? 'off' : ''}
          aria-pressed={expenses}
          onClick={() => setExpenses(!expenses)}
        >
          <span className="swatch expense" />
          {t('Expenses', 'المصروفات')}
        </button>
      </div>
      {table ? (
        <div className="table-scroll">
          <ReferenceTable
            headers={[
              t('Day', 'اليوم'),
              t('Sales', 'المبيعات'),
              t('Cost', 'التكلفة'),
              t('Expenses', 'المصروفات'),
            ]}
          >
            {data.map((day) => (
              <tr key={day.date}>
                <td>{day.date.slice(-2)}</td>
                <td>{reportValue(day.netSales, locale)}</td>
                <td>{reportValue(day.consumedCost, locale)}</td>
                <td>{reportValue(day.expenses, locale)}</td>
              </tr>
            ))}
          </ReferenceTable>
        </div>
      ) : (
        <div className="chart" dir="ltr">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={t(
              'Daily sales, costs and expenses',
              'المبيعات اليومية وتكلفة المبيعات والمصروفات',
            )}
          >
            {Array.from({ length: 5 }, (_, index) => {
              const value = low + ((high - low) * index) / 4,
                yy = y(value);
              return (
                <g key={index}>
                  <line x1={L} x2={W - R} y1={yy} y2={yy} stroke="var(--line)" />
                  <text
                    x={L - 9}
                    y={yy + 3}
                    fill="var(--muted)"
                    fontFamily="system-ui"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {Math.abs(value) > 999 ? `${(value / 1000).toFixed(0)}k` : Math.round(value)}
                  </text>
                </g>
              );
            })}
            <line x1={L} x2={W - R} y1={base} y2={base} stroke="var(--muted)" />
            {data.map((day, index) => {
              const x = L + (index + 0.5) * step,
                yy = y(Number(day.netSales));
              return (
                <g key={day.date}>
                  <rect
                    x={x - bar / 2}
                    y={Math.min(base, yy)}
                    width={bar}
                    height={Math.max(1, Math.abs(base - yy))}
                    rx="2.5"
                    fill={Number(day.netSales) < 0 ? 'var(--red)' : 'var(--blue)'}
                  >
                    <title>{`${day.date}: ${reportValue(day.netSales, locale)}`}</title>
                  </rect>
                  {(index === 0 || (index + 1) % Math.ceil(data.length / 7) === 0) && (
                    <text
                      x={x}
                      y={H - 9}
                      fill="var(--muted)"
                      fontFamily="system-ui"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {Number(day.date.slice(-2))}
                    </text>
                  )}
                </g>
              );
            })}
            {cost && (
              <path
                d={line('consumedCost')}
                stroke="var(--emerald)"
                strokeWidth="2.3"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {expenses && (
              <path
                d={line('expenses')}
                stroke="var(--amber)"
                strokeWidth="2.3"
                strokeDasharray="5 5"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      )}
      <div className="chart-foot">
        <button type="button" onClick={() => setTable(!table)}>
          {table ? t('Show chart', 'عرض الرسم') : t('Detailed values', 'القيم التفصيلية')} ←
        </button>
      </div>
    </ReferencePanel>
  );
}
