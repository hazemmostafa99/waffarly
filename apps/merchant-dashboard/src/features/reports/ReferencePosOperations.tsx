/** POS overview matches the reference: four KPIs, collection/preparation cards and cashier activity. */
import type { OwnerPosOperationsReport } from '@waffarly/contracts';
import {
  ReferenceMetric,
  ReferencePanel,
  ReferenceFinRow,
  ReferenceTable,
  ReferenceEmpty,
  reportText,
  reportValue,
  type ShowReportDetail,
} from './reference-report-ui.js';
export function ReferencePosOperations({
  report,
  locale,
  showDetail,
}: {
  report: OwnerPosOperationsReport;
  locale: string;
  showDetail: ShowReportDetail;
}) {
  const t = (en: string, ar: string) => reportText(locale, en, ar);
  const duration = (seconds: number | null) =>
    seconds === null
      ? '—'
      : seconds > 0 && seconds < 60
        ? t('Less than a minute', 'أقل من دقيقة')
        : t(`${Math.round(seconds / 60)} min`, `${Math.round(seconds / 60)} دقيقة`);
  return (
    <>
      <div className="overview-grid">
        <ReferenceMetric
          label={t('Orders created', 'الطلبات المنشأة')}
          note={t('All statuses', 'كل الحالات')}
          value={report.orders.placedCount}
          money={false}
          hero
          locale={locale}
        />
        <ReferenceMetric
          label={t('Completed', 'المكتملة')}
          note={t('Completed orders', 'تم تجهيزها')}
          value={report.orders.completedCount}
          money={false}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Order value', 'قيمة الطلبات')}
          note={t('Does not necessarily equal collections', 'غير مساوية للتحصيل بالضرورة')}
          value={report.orders.value}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Net collected', 'صافي التحصيل')}
          note={t('After refunds', 'بعد الاستردادات')}
          value={report.netCollected}
          locale={locale}
        />
      </div>
      <div className="lower-grid">
        <ReferencePanel
          className="reference-pos-card"
          title={t('Collection movement', 'حركة التحصيل')}
          action={
            <button
              type="button"
              className="link"
              onClick={() =>
                showDetail(
                  t('Sales are not collections', 'المبيعات ليست التحصيلات'),
                  <>
                    <p>
                      {t(
                        'Order value, recognized revenue, collected payments and outstanding balances are distinct metrics. Collection dates can differ from sale dates.',
                        'قيمة الطلبات والإيراد المسجل والتحصيل والمتبقي للتحصيل أربعة مقاييس مختلفة. التحصيل النقدي قد يحدث في تاريخ يختلف عن تاريخ تسجيل البيع.',
                      )}
                    </p>
                    <ReferenceFinRow
                      label={t('Cash refunds', 'استردادات نقدية')}
                      value={report.refunds.cash}
                      locale={locale}
                    />
                    <ReferenceFinRow
                      label={t('Terminal refunds', 'استردادات أجهزة الدفع')}
                      value={report.refunds.terminal}
                      locale={locale}
                    />
                    {report.deliveryCash && (
                      <>
                        <h4>{t('Delivery custody', 'عهدة الدليفري')}</h4>
                        <ReferenceFinRow
                          label={t('Customer payments to couriers', 'تحصيلات العملاء مع المندوبين')}
                          value={report.deliveryCash.customerCollections}
                          locale={locale}
                        />
                        <ReferenceFinRow
                          label={t('Courier remittances into drawers', 'توريدات المندوبين للأدراج')}
                          value={report.deliveryCash.drawerReceipts}
                          locale={locale}
                        />
                      </>
                    )}
                  </>,
                )
              }
            >
              {t('Explain the difference', 'شرح الفرق')} ←
            </button>
          }
        >
          <div className="fin-items">
            <ReferenceFinRow
              label={t('Cash collected', 'تحصيل نقدي')}
              value={report.collections.cash}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('Payment terminals', 'أجهزة الدفع')}
              value={report.collections.terminal}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('− Refunds', '− استردادات')}
              value={report.refunds.total}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('Net collected', 'صافي التحصيل')}
              value={report.netCollected}
              locale={locale}
              type="result"
            />
            <ReferenceFinRow
              label={t('Outstanding', 'المتبقي')}
              value={report.orders.outstanding}
              locale={locale}
            />
          </div>
        </ReferencePanel>
        <ReferencePanel
          className="reference-pos-card"
          title={t('Preparation and operations', 'التحضير والتشغيل')}
        >
          <div className="fin-items">
            <ReferenceFinRow
              label={t('Average preparation start', 'متوسط بدء التحضير')}
              value={duration(report.preparation.acceptedToStartSeconds)}
              locale={locale}
              money={false}
            />
            <ReferenceFinRow
              label={t('Average readiness', 'متوسط الجاهزية')}
              value={duration(report.preparation.startToReadySeconds)}
              locale={locale}
              money={false}
            />
            <ReferenceFinRow
              label={t('Cancelled orders', 'الطلبات الملغاة')}
              value={report.orders.cancelledCount}
              money={false}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('Paid orders', 'الطلبات المدفوعة')}
              value={report.orders.paidCount}
              money={false}
              locale={locale}
            />
          </div>
          <div className="card-bottom reference-muted">
            {t('Averages are minutes, not money.', 'المتوسطات بالدقائق، وليست مبالغ مالية.')}
          </div>
        </ReferencePanel>
      </div>
      <ReferencePanel className="reference-spaced" title={t('Cashier activity', 'نشاط الكاشير')}>
        {report.cashierActivity.length ? (
          <ReferenceTable
            headers={[
              t('Cashier', 'الكاشير'),
              t('Orders', 'الطلبات'),
              t('Completed', 'المكتملة'),
              t('Collections', 'التحصيل'),
              t('Refunds', 'الاستردادات'),
            ]}
          >
            {report.cashierActivity.map((row) => (
              <tr key={row.employeeId ?? 'unattributed'}>
                <td>
                  <b>{row.employeeName ?? t('Unattributed', 'غير منسوب')}</b>
                </td>
                <td>{reportValue(row.ordersOpened, locale, false)}</td>
                <td>{reportValue(row.completedOrders, locale, false)}</td>
                <td className="number">{reportValue(row.collections.total, locale)}</td>
                <td className="number">{reportValue(row.refunds.total, locale)}</td>
              </tr>
            ))}
          </ReferenceTable>
        ) : (
          <ReferenceEmpty locale={locale} />
        )}
      </ReferencePanel>
    </>
  );
}
