import { recordedProfitValues } from './recorded-report-values.js';
/** Product profitability uses the reference's summary, segmented grouping and table. */
import type { OwnerProductProfitabilityReport } from '@waffarly/contracts';
import {
  ReferenceMetric,
  ReferencePanel,
  ReferenceTable,
  ReferenceEmpty,
  ReferenceFinRow,
  reportText,
  reportValue,
  decimalFromCents,
  type ShowReportDetail,
} from './reference-report-ui.js';
import { reportCents } from './report-helpers.js';
export type ProfitGroup = 'product' | 'category' | 'branch';
export function ReferenceProfitability({
  report,
  locale,
  showDetail,
  group,
  onGroup,
}: {
  report: OwnerProductProfitabilityReport;
  locale: string;
  showDetail: ShowReportDetail;
  group: ProfitGroup;
  onGroup: (group: ProfitGroup) => void;
}) {
  const t = (en: string, ar: string) => reportText(locale, en, ar),
    totals = { ...report.totals, ...recordedProfitValues(report.totals) };
  const rows =
    group === 'product'
      ? report.products.map((row) => ({
          ...row,
          ...recordedProfitValues(row),
          id: row.productId,
          name: row.productName,
        }))
      : (group === 'category' ? report.menuSections : report.branches).map((row) => ({
          ...row,
          ...recordedProfitValues(row),
          id: row.dimensionId,
          name: row.dimensionName,
        }));
  const net = decimalFromCents(reportCents(totals.revenue) - reportCents(totals.refundRevenue));
  return (
    <>
      <div className="overview-grid">
        <ReferenceMetric
          label={t('Net sales', 'صافي المبيعات')}
          note={t('All products', 'كل المنتجات')}
          value={net}
          hero
          locale={locale}
        />
        <ReferenceMetric
          label={t('Recorded cost', 'التكلفة المسجلة')}
          note={t('At consumption time', 'عند وقت الاستهلاك')}
          value={totals.cost}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Current gross profit', 'الربح الحالي')}
          note={t('Before shared expenses', 'قبل المصروفات العامة')}
          value={totals.grossProfit}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Financial refunds', 'المرتجعات المالية')}
          note={t('Refunded amounts', 'مبالغ مستردة')}
          value={totals.refundRevenue}
          locale={locale}
        />
      </div>
      <ReferencePanel
        className="reference-spaced"
        title={t('Profitability details', 'تفاصيل الربحية')}
        subtitle={t('Up to 100 rows per grouping', 'حتى 100 صف لكل تجميع')}
        action={
          <div className="segmented">
            {(
              [
                ['product', t('Product', 'المنتج')],
                ['category', t('Category', 'القسم')],
                ['branch', t('Branch', 'الفرع')],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={group === id ? 'selected' : ''}
                aria-pressed={group === id}
                onClick={() => onGroup(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {rows.length ? (
          <ReferenceTable
            headers={[
              t('Name', 'الاسم'),
              t('Quantity', 'الكمية'),
              t('Revenue', 'الإيراد'),
              t('Cost', 'التكلفة'),
              t('Gross profit', 'مجمل الربح'),
              t('Margin', 'الهامش'),
              t('Review', 'مراجعة'),
            ]}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.name}</b>
                </td>
                <td>{reportValue(row.quantitySold, locale, false)}</td>
                <td className="number">{reportValue(row.revenue, locale)}</td>
                <td className="number">{reportValue(row.cost, locale)}</td>
                <td className="number">{reportValue(row.grossProfit, locale)}</td>
                <td className="number">
                  {row.marginPercent === null ? '—' : `${row.marginPercent.toFixed(1)}%`}
                </td>
                <td>
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      showDetail(
                        row.name,
                        <>
                          <p>
                            {t(
                              'Recorded revenue, refunds, cost and margin for the selected scope.',
                              'الإيراد والاستردادات والتكلفة والهامش المسجلين للنطاق المختار.',
                            )}
                          </p>
                          <div className="drawer-kpi">
                            <span>{t('Gross profit', 'مجمل الربح')}</span>
                            <strong>{reportValue(row.grossProfit, locale)}</strong>
                          </div>
                          <ReferenceFinRow
                            label={t('Revenue', 'الإيراد')}
                            value={row.revenue}
                            locale={locale}
                          />
                          <ReferenceFinRow
                            label={t('Refunds', 'الاستردادات')}
                            value={row.refundRevenue}
                            locale={locale}
                          />
                          <ReferenceFinRow
                            label={t('Consumed cost', 'تكلفة الاستهلاك')}
                            value={row.cost}
                            locale={locale}
                          />
                          <ReferenceFinRow
                            label={t('Quantity sold', 'الكمية المباعة')}
                            value={row.quantitySold}
                            money={false}
                            locale={locale}
                          />
                          <ReferenceFinRow
                            label={t('Quantity refunded', 'الكمية المستردة')}
                            value={row.quantityRefunded}
                            money={false}
                            locale={locale}
                          />
                          <ReferenceFinRow
                            label={t('Unknown-cost lines', 'بنود مجهولة التكلفة')}
                            value={row.unknownCostLines}
                            money={false}
                            locale={locale}
                          />
                        </>,
                      )
                    }
                  >
                    {t('Details', 'التفاصيل')} ←
                  </button>
                </td>
              </tr>
            ))}
          </ReferenceTable>
        ) : (
          <ReferenceEmpty locale={locale} />
        )}
      </ReferencePanel>
      <div className="info-strip">
        {t(
          'Product gross profit excludes shared operating expenses. Unallocated refunds can make report totals differ from displayed rows.',
          'مجمل ربح المنتج لا يتضمن المصروفات العامة. الاستردادات غير المنسوبة قد تجعل إجمالي التقرير مختلفًا عن مجموع الصفوف المعروضة.',
        )}
        {totals.unallocatedRefundCount > 0 && (
          <>
            {' '}
            {t('Unallocated refunds', 'استردادات غير منسوبة')}:{' '}
            {reportValue(totals.unallocatedRefundAmount, locale)}
          </>
        )}
        {report.truncated && (
          <>
            {' '}
            {t(
              'Row limit reached; totals still cover the full scope.',
              'تم الوصول لحد الصفوف؛ الإجماليات تشمل النطاق بالكامل.',
            )}
          </>
        )}
      </div>
    </>
  );
}
