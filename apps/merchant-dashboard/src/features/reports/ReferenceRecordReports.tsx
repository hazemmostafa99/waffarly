import type { ReactNode } from 'react';
/** Cursor-paged shift and return ledgers keep the reference table hierarchy and real record details. */
import type {
  OwnerShiftReportPage,
  CursorPage,
  OwnerPosItemReturnReportRow,
} from '@waffarly/contracts';
import {
  ReferenceMetric,
  ReferencePanel,
  ReferenceTable,
  ReferenceEmpty,
  ReferenceFinRow,
  reportText,
  reportValue,
  type ShowReportDetail,
} from './reference-report-ui.js';
export function reportDateLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Cairo',
  }).format(new Date(date));
}
export function ReferencePagination({
  next,
  previous,
  onNext,
  onPrevious,
  locale,
  count,
}: {
  next: boolean;
  previous: boolean;
  onNext: () => void;
  onPrevious: () => void;
  locale: string;
  count: number;
}) {
  return (
    <div className="pager">
      <span>
        {reportText(locale, `${count} records on this page`, `${count} سجل في الصفحة الحالية`)}
      </span>
      <div>
        <button type="button" className="button" disabled={!previous} onClick={onPrevious}>
          {reportText(locale, 'Previous', 'السابق')}
        </button>{' '}
        <button type="button" className="button" disabled={!next} onClick={onNext}>
          {reportText(locale, 'Next', 'التالي')}
        </button>
      </div>
    </div>
  );
}
export function ReferenceShiftReports({
  report,
  locale,
  showDetail,
  pagination,
}: {
  report: OwnerShiftReportPage;
  locale: string;
  showDetail: ShowReportDetail;
  pagination: ReactNode;
}) {
  const t = (en: string, ar: string) => reportText(locale, en, ar),
    summary = report.summary;
  return (
    <>
      <div className="overview-grid">
        <ReferenceMetric
          label={t('Closed shifts', 'الورديات المغلقة')}
          note={t('During the period', 'خلال الفترة')}
          value={summary?.closedCount}
          hero
          money={false}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Matching shifts', 'الورديات المطابقة')}
          note={t('No differences', 'دون فروق')}
          value={summary?.matchedCount}
          money={false}
          locale={locale}
        />
        <ReferenceMetric
          label={t('With differences', 'بها فروق')}
          note={t('Need review', 'تحتاج مراجعة')}
          value={summary?.varianceCount}
          money={false}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Net count variance', 'صافي فرق الجرد')}
          note={t('Counted − expected', 'المعدود − المتوقع')}
          value={summary?.netVariance}
          locale={locale}
        />
      </div>
      <ReferencePanel
        className="reference-spaced"
        title={t('Shift ledger', 'سجل الورديات')}
        subtitle={t(
          'Differences are identified with text and color',
          'الورديات ذات الفروق مميزة بالنص واللون',
        )}
      >
        {report.items.length ? (
          <ReferenceTable
            headers={[
              t('Shift', 'الوردية'),
              t('Closing', 'الإقفال'),
              t('Cashier', 'الكاشير'),
              t('Expected cash', 'النقد المتوقع'),
              t('Counted cash', 'النقد المعدود'),
              t('Variance', 'الفرق'),
              t('Status', 'الحالة'),
              '',
            ]}
          >
            {report.items.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.shiftId.slice(0, 8)}</b>
                </td>
                <td>{reportDateLabel(row.closedAt, locale)}</td>
                <td>{row.operatorName}</td>
                <td className="number">{reportValue(row.expectedCash, locale)}</td>
                <td className="number">{reportValue(row.countedCash, locale)}</td>
                <td className="number">{reportValue(row.variance, locale)}</td>
                <td>
                  <span className={`status${Number(row.variance) !== 0 ? ' bad' : ''}`}>
                    {Number(row.variance) !== 0
                      ? t('Count variance', 'فرق جرد')
                      : t('Matched', 'مطابقة')}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      showDetail(
                        t('Shift details', 'تفاصيل الوردية'),
                        <>
                          <p>{row.shiftId}</p>
                          <p>
                            {row.branchName} · {row.registerName} · {row.operatorName}
                          </p>
                          <p>
                            {t(
                              'Compare expected cash, counted cash and recorded handoffs. Variance is not automatically revenue or expense.',
                              'قارن النقد المتوقع والمعدود والتسليمات المسجلة. فرق الجرد ليس إيرادًا أو مصروفًا تلقائيًا ويحتاج مراجعة قبل التسوية.',
                            )}
                          </p>
                          <div className="drawer-kpi">
                            <span>{t('Count variance', 'فرق الجرد')}</span>
                            <strong>{reportValue(row.variance, locale)}</strong>
                          </div>
                          {[
                            [t('Opening float', 'رصيد الافتتاح'), row.openingFloat],
                            [t('Cash sales', 'مبيعات نقدية'), row.cashSales],
                            [t('Cash refunds', 'استردادات نقدية'), row.cashRefunds],
                            [t('Cash in', 'إيداعات'), row.cashIn],
                            [t('Cash out', 'سحوبات'), row.cashOut],
                            [t('Cash drops', 'تسليمات نقدية'), row.cashDrop],
                            [t('Expected cash', 'النقد المتوقع'), row.expectedCash],
                            [t('Counted cash', 'النقد المعدود'), row.countedCash],
                            [t('Terminal sales', 'مبيعات أجهزة الدفع'), row.terminalSales],
                            [t('Terminal refunds', 'استردادات أجهزة الدفع'), row.terminalRefunds],
                          ].map(([label, value]) => (
                            <ReferenceFinRow
                              key={label}
                              label={label!}
                              value={value!}
                              locale={locale}
                            />
                          ))}
                          <h4>{t('Approval and reason', 'الاعتماد والسبب')}</h4>
                          <p>
                            {row.approvedByName ??
                              t('No separate approval', 'لا يوجد اعتماد منفصل')}{' '}
                            · {row.reason ?? t('No recorded reason', 'لا يوجد سبب مسجل')}
                          </p>
                          {row.deliveryCashReceived !== undefined && (
                            <ReferenceFinRow
                              label={t(
                                'Courier remittances received',
                                'توريدات المندوبين المستلمة',
                              )}
                              value={row.deliveryCashReceived}
                              locale={locale}
                            />
                          )}
                        </>,
                      )
                    }
                  >
                    {t('Review', 'مراجعة')} ←
                  </button>
                </td>
              </tr>
            ))}
          </ReferenceTable>
        ) : (
          <ReferenceEmpty locale={locale} />
        )}
        {pagination}
      </ReferencePanel>
    </>
  );
}
export function ReferenceItemReturns({
  report,
  locale,
  showDetail,
  pagination,
}: {
  report: CursorPage<OwnerPosItemReturnReportRow>;
  locale: string;
  showDetail: ShowReportDetail;
  pagination: ReactNode;
}) {
  const t = (en: string, ar: string) => reportText(locale, en, ar);
  return (
    <>
      <ReferencePanel
        title={t('Item returns', 'مرتجعات الأصناف')}
        subtitle={t(
          'A physical return does not imply a cash refund or automatic restocking',
          'لا يعني المرتجع الفعلي استردادًا ماليًا أو إعادة مخزون تلقائية',
        )}
      >
        {report.items.length ? (
          <ReferenceTable
            headers={[
              t('Record', 'السجل'),
              t('Date', 'التاريخ'),
              t('Item', 'الصنف'),
              t('Quantity', 'الكمية'),
              t('Reason', 'السبب'),
              t('Status', 'الحالة'),
              '',
            ]}
          >
            {report.items.flatMap((row) =>
              row.lines.map((line, index) => (
                <tr key={`${row.id}-${index}`}>
                  <td>
                    <b>{row.returnNumber}</b>
                  </td>
                  <td>{reportDateLabel(row.issuedAt, locale)}</td>
                  <td>
                    {line.productName}
                    {line.variantName ? ` · ${line.variantName}` : ''}
                  </td>
                  <td>{reportValue(line.quantity, locale, false)}</td>
                  <td>{row.reason}</td>
                  <td>
                    <span className="status">
                      {row.approvedBy ? t('Approved', 'معتمد') : t('Recorded', 'مسجل')}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link"
                      onClick={() =>
                        showDetail(
                          t('Return details', 'تفاصيل المرتجع'),
                          <>
                            <p>
                              {row.returnNumber} · {row.orderReference}
                            </p>
                            <p>
                              {row.branchName} · {reportDateLabel(row.issuedAt, locale)}
                            </p>
                            <h4>{t('Reason', 'السبب')}</h4>
                            <p>{row.reason}</p>
                            {row.lines.map((item, i) => (
                              <div key={i}>
                                <h4>
                                  {item.productName}
                                  {item.variantName ? ` · ${item.variantName}` : ''}
                                </h4>
                                <ReferenceFinRow
                                  label={t('Quantity', 'الكمية')}
                                  value={item.quantity}
                                  money={false}
                                  locale={locale}
                                />
                                <ReferenceFinRow
                                  label={t(
                                    'Reference value, not a refund',
                                    'قيمة استرشادية وليست استردادًا',
                                  )}
                                  value={item.referenceValue}
                                  locale={locale}
                                />
                              </div>
                            ))}
                            <p>
                              {t('Recorded by', 'سجله')}: {row.issuedBy}
                            </p>
                            <p>
                              {t('Approved by', 'اعتمده')}:{' '}
                              {row.approvedBy ??
                                t('No separate approval required', 'لا يحتاج اعتمادًا منفصلًا')}
                            </p>
                            <p>
                              {t(
                                'Physical item returns do not automatically restore food ingredients to stock.',
                                'المرتجع الفعلي ليس بالضرورة استردادًا ماليًا، ولا يعيد مكونات الطعام إلى المخزون تلقائيًا.',
                              )}
                            </p>
                          </>,
                        )
                      }
                    >
                      {t('Details', 'التفاصيل')} ←
                    </button>
                  </td>
                </tr>
              )),
            )}
          </ReferenceTable>
        ) : (
          <ReferenceEmpty locale={locale} />
        )}
        {pagination}
      </ReferencePanel>
      <div className="info-strip">
        {t(
          'Financial refunds reduce revenue; item returns record the physical return; independent waste is a separate stock movement. A cost is not charged twice.',
          'الاسترداد المالي يقلل الإيراد، والمرتجع يسجل رجوع الصنف، والهالك المستقل حركة مخزون منفصلة. لا يتم احتساب تكلفة واحدة مرتين.',
        )}
      </div>
    </>
  );
}
