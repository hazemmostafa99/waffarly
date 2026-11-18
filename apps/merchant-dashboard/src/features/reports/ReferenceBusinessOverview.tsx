import { recordedBusinessPeriod } from './recorded-report-values.js';
/** Monthly overview reproduces the supplied reference with authoritative API amounts. */
import type { OwnerBusinessReport } from '@waffarly/contracts';
import { ReferenceDailyChart } from './ReferenceDailyChart.js';
import {
  ReferenceMetric,
  ReferencePanel,
  ReferenceFinRow,
  ReferenceDistribution,
  reportText,
  reportValue,
  addAmounts,
  type ShowReportDetail,
} from './reference-report-ui.js';
import { ReportIcon } from './reference-report-icons.js';
import { reportChange } from './report-helpers.js';
import { reportSourceLabel } from './business-report-presenter.js';
export function ReferenceBusinessOverview({
  report,
  locale,
  showDetail,
}: {
  report: OwnerBusinessReport;
  locale: string;
  showDetail: ShowReportDetail;
}) {
  const t = (en: string, ar: string) => reportText(locale, en, ar),
    d = recordedBusinessPeriod(report.current),
    b = report.balances;
  const explain = () =>
    showDetail(
      t('Calculation breakdown', 'تفصيل الحساب'),
      <>
        <p>
          {t(
            'Operating result is a scoped management result, not final accounting net profit.',
            'نتيجة التشغيل هي نتيجة إدارية محددة النطاق، وليست صافي الربح المحاسبي النهائي.',
          )}
        </p>
        <div className="drawer-kpi">
          <span>{t('Gross profit formula', 'معادلة مجمل الربح')}</span>
          <strong>{t('Sales − cost', 'المبيعات − التكلفة')}</strong>
        </div>
        <h4>{t('From gross profit to operating result', 'من مجمل الربح إلى نتيجة التشغيل')}</h4>
        <p>
          {t(
            'Deduct the currently recorded operating expenses, approved staff costs and independent waste.',
            'نخصم مصروفات التشغيل وتكلفة الموظفين والهالك المستقل المسجلين حاليًا.',
          )}
        </p>
        <ul>
          <li>
            {t(
              'Cost is saved at stock consumption using the existing latest confirmed purchase policy.',
              'التكلفة محفوظة عند استهلاك المخزون، وتعتمد سياسة آخر شراء مؤكد.',
            )}
          </li>
          <li>
            {t(
              'Stock purchases are not immediately operating expenses.',
              'شراء الخامات ليس مصروف تشغيل كاملًا بمجرد الشراء.',
            )}
          </li>
          <li>
            {t(
              'Advances and custody transfers do not create new revenue or expense.',
              'صرف السلف وتحويل العُهد لا يخلقان مصروفات أو إيرادات جديدة.',
            )}
          </li>
          <li>
            {t(
              'Taxes, commissions and depreciation are not automatically included.',
              'النتيجة لا تشمل تلقائيًا كل الضرائب والعمولات والإهلاك.',
            )}
          </li>
          <li>
            {t(
              'Historical reports can change after corrections.',
              'التقارير التاريخية قد تتغير مع تصحيحات العمليات.',
            )}
          </li>
        </ul>
      </>,
    );
  const groups = [
    {
      title: t('Recorded cash', 'النقدية المسجلة'),
      icon: 'wallet',
      rows: [
        [t('Safes', 'الخزائن'), b.safeCash],
        [t('Cashier drawers', 'أدراج الكاشير'), b.drawerCash],
        [t('With couriers', 'مع المندوبين'), b.courierCash],
      ],
    },
    {
      title: t('Pending custody', 'عُهد قيد التسليم'),
      icon: 'layers',
      rows: [
        [t('Pending handoffs', 'تسليمات لم تؤكد'), b.pendingTransfers],
        [t('Receipt differences', 'فروق الاستلام'), b.unresolvedTransferDifference],
      ],
      note: t('Not confirmed safe cash', 'ليست رصيد خزنة مؤكدًا'),
    },
    {
      title: t('Amounts payable', 'مستحقات عليك'),
      icon: 'box',
      rows: [
        [t('Suppliers', 'الموردون'), b.supplierDue],
        [t('Expenses', 'المصروفات'), b.expenseDue],
        [t('Payroll', 'المرتبات'), b.payrollDue],
      ],
      note: b.unknownSupplierInvoices
        ? t(
            `${b.unknownSupplierInvoices} invoices have unknown values`,
            `${b.unknownSupplierInvoices} فاتورة مجهولة القيمة`,
          )
        : '',
    },
    {
      title: t('Recorded receivables', 'أرصدة مسجلة لك'),
      icon: 'people',
      rows: [
        [t('Supplier credit', 'دائن للموردين'), b.supplierCredit],
        [t('Staff advances', 'سلف الموظفين'), b.staffAdvances],
        [t('Uncollected checks', 'شيكات قيد التحصيل'), b.openCheckDue],
      ],
      note: t('Not collected cash', 'ليست نقدية محصّلة'),
    },
  ];
  return (
    <>
      <div className="overview-grid">
        <ReferenceMetric
          label={t('Net sales', 'صافي المبيعات')}
          note=""
          value={d.netSales}
          hero
          delta={reportChange(d.netSales, report.previous.netSales)}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Current gross profit', 'الربح الحالي')}
          note=""
          value={d.grossProfit}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Recorded cost of sales', 'التكلفة المسجلة')}
          note=""
          value={d.consumedCost}
          locale={locale}
        />
        <ReferenceMetric
          label={t('Current operating result', 'نتيجة التشغيل الحالية')}
          note=""
          value={d.operatingResult}
          locale={locale}
        />
      </div>
      <div className="analysis">
        <ReferenceDailyChart report={report} locale={locale} />
        <ReferencePanel
          title={t('Operating result statement', 'قائمة نتيجة التشغيل')}
          subtitle={t('Calculation from recorded data', 'ملخص الحساب من واقع البيانات المسجلة')}
          action={
            <button type="button" className="subtle-action" onClick={explain}>
              {t('Calculation explanation', 'شرح الحساب')} ←
            </button>
          }
        >
          <div className="fin-items">
            <ReferenceFinRow
              label={t('Product revenue', 'إيراد المنتجات')}
              value={addAmounts(d.netSales, d.refunds)}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('− Refunds', '− الاستردادات')}
              value={d.refunds}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('Net sales', 'صافي المبيعات')}
              value={d.netSales}
              locale={locale}
              type="subtotal"
            />
            <ReferenceFinRow
              label={t('− Cost of sales', '− تكلفة المبيعات')}
              value={d.consumedCost}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('Current gross profit', 'الربح الحالي')}
              value={d.grossProfit}
              locale={locale}
              type="subtotal"
            />
            <ReferenceFinRow
              label={t('− Operating expenses', '− مصروفات التشغيل')}
              value={d.expenses}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('− Staff cost', '− تكلفة الموظفين')}
              value={d.payrollCost}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('− Independent waste', '− الهالك المستقل')}
              value={d.wasteCost}
              locale={locale}
            />
            <ReferenceFinRow
              label={t('Current operating result', 'نتيجة التشغيل الحالية')}
              value={d.operatingResult}
              locale={locale}
              type="result"
            />
          </div>
          <div className="card-bottom">
            <button type="button" className="link" onClick={explain}>
              {t('How are the numbers calculated?', 'كيف تُحسب الأرقام؟')}{' '}
              <ReportIcon name="arrow" />
            </button>
          </div>
        </ReferencePanel>
      </div>
      <div className="lower-grid">
        <ReferenceDistribution
          title={t('Sales by channel', 'المبيعات حسب القناة')}
          subtitle={t('Recorded net sales per source', 'صافي المبيعات المسجل لكل مصدر')}
          rows={report.sources.map((row) => ({ ...row, label: reportSourceLabel(row.id, locale) }))}
          total={d.netSales}
          locale={locale}
        />
        <ReferenceDistribution
          title={t('Expense distribution', 'توزيع المصروفات')}
          subtitle={t('Largest categories of total expenses', 'أكبر التصنيفات من إجمالي المصروفات')}
          rows={report.expenseCategories.map((row) => ({
            ...row,
            label:
              row.id === 'remaining_categories'
                ? t('Other categories', 'باقي التصنيفات')
                : row.label,
          }))}
          total={d.expenses}
          locale={locale}
        />
      </div>
      <div className="section-heading divider-heading">
        <div>
          <h2>
            {t('Current balances', 'الأرصدة الحالية')}{' '}
            <span className="now-badge">{t('Now', 'الآن')}</span>
          </h2>
        </div>
        <button
          type="button"
          className="link"
          onClick={() =>
            showDetail(
              t('Current balances', 'الأرصدة الحالية'),
              <>
                <p>
                  {t(
                    'These balances are current at report generation across all dates, not at the end of the selected month.',
                    'هذه أرصدة لحظة إعداد التقرير لكل التواريخ، وليست أرصدة نهاية الشهر المختار.',
                  )}
                </p>
                <h4>{t('Cash locations', 'أماكن النقدية')}</h4>
                <p>
                  {t(
                    'Safes, expected drawer custody, courier-held cash and pending handoffs are distinct. Pending handoffs are not confirmed safe cash.',
                    'الخزائن والأدراج والمندوبون والعُهد قيد التسليم أماكن مختلفة. لا يصح دمج المتوقع والمؤكد في رصيد واحد.',
                  )}
                </p>
                <h4>{t('Payables and receivables', 'المستحقات والأرصدة')}</h4>
                <p>
                  {t(
                    'Supplier/payroll obligations and advances are separate from collected cash. Bank balances are not available here.',
                    'مستحقات الموردين والموظفين منفصلة عن النقدية، والسلف ليست تكلفة موظفين إضافية. أرصدة البنوك غير متاحة هنا.',
                  )}
                </p>
                {Number(b.unverifiedDrops) !== 0 && (
                  <p>
                    {t('Unverified historical drops', 'تسليمات قديمة غير مؤكدة')}:{' '}
                    {reportValue(b.unverifiedDrops, locale)}
                  </p>
                )}
              </>,
            )
          }
        >
          {t('Understand balances', 'فهم الأرصدة')} ←
        </button>
      </div>
      <div className="balances">
        {groups.map((group) => (
          <section className="card balance" key={group.title}>
            <div className="balance-title">
              <ReportIcon name={group.icon} />
              {group.title}
            </div>
            {group.rows.map(([label, value]) => (
              <div className="balance-line" key={label}>
                <span>{label}</span>
                <b>{reportValue(value, locale)}</b>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
