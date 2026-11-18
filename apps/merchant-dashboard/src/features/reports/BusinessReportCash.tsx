/** Presents one focused business-report view using the shared report components. */
import type { BusinessReportViewProps } from './business-report-presenter.js';
import { ReportBars, ReportMetric, ReportNotice, ReportPanel } from './ReportComponents.js';
import { reportMoney } from './report-helpers.js';

export function BusinessReportCash({ report, locale }: BusinessReportViewProps) {
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const balances = report.balances;
  const money = (value: string | null) => reportMoney(value, locale);
  const cashLink = '/pos-cash';
  return (
    <>
      <div className="report-section-intro">
        <span className="report-live-dot" />
        <div>
          <h2>{text('Where your money is now', 'الأرصدة الحالية')}</h2>
          <p>
            {text(
              'Current recorded balances across all dates, filtered by branch. These do not follow the selected month.',
              'الأرصدة الحالية لكل التواريخ، حسب الفرع المختار. مش أرصدة نهاية الشهر المختار.',
            )}
          </p>
        </div>
      </div>
      <div className="report-metrics">
        <ReportMetric
          label={text('Safe cash', 'النقدية في الخزائن')}
          value={balances.safeCash}
          locale={locale}
          description={text('Confirmed recorded movements', 'الحركات المسجلة والمؤكدة')}
          to={cashLink}
        />
        <ReportMetric
          label={text('Drawer custody', 'عهدة الأدراج')}
          value={balances.drawerCash}
          locale={locale}
          accent="blue"
          description={text(
            'Open: expected · closed: counted, less handoffs',
            'المفتوح: المتوقع · المقفول: المعدود بعد التسليمات',
          )}
          to={cashLink}
        />
        <ReportMetric
          label={text('In transit to safes', 'عهد تحت التسليم للخزائن')}
          value={balances.pendingTransfers}
          locale={locale}
          accent="amber"
          description={text('Not yet received in a safe', 'لسه ماتأكدش استلامها في الخزنة')}
          to={cashLink}
        />
        <ReportMetric
          label={text('Cash held by couriers', 'نقدية مع المندوبين')}
          value={balances.courierCash}
          locale={locale}
          accent="violet"
          description={text('Collected and not yet remitted', 'متحصلة ولسه ماتوردتش')}
          to="/orders"
        />
      </div>
      {(balances.unverifiedDrops !== '0.00' ||
        balances.unresolvedTransferDifference !== '0.00') && (
        <ReportNotice
          title={text('Cash custody needs review', 'في عهد نقدية محتاجة مراجعة')}
          to={cashLink}
        >
          {text('Unverified historical drops:', 'تسليمات قديمة غير مؤكدة:')}{' '}
          <bdi>{money(balances.unverifiedDrops)}</bdi> ·{' '}
          {text('Unresolved receipt differences:', 'فروق استلام لم تُراجع:')}{' '}
          <bdi>{money(balances.unresolvedTransferDifference)}</bdi>
        </ReportNotice>
      )}
      {balances.unknownSupplierInvoices > 0 && (
        <ReportNotice
          title={text('Supplier balances are incomplete', 'أرصدة الموردين غير مكتملة')}
          to="/inventory/purchases"
        >
          {text(
            `${balances.unknownSupplierInvoices} confirmed invoices have no recorded value. Amounts below cover priced invoices only.`,
            `${balances.unknownSupplierInvoices} فاتورة مؤكدة بدون قيمة مسجلة. الأرقام المعروضة تخص الفواتير المعروفة القيمة فقط.`,
          )}
        </ReportNotice>
      )}
      <div className="report-two-columns">
        <ReportPanel
          title={text('Recorded amounts you owe', 'مبالغ مستحقة عليك')}
          description={text(
            'Outstanding today, not total spending in the selected month.',
            'المتبقي حاليًا، مش إجمالي مصروفات الشهر المختار.',
          )}
        >
          <ReportBars
            variant="list"
            locale={locale}
            color="amber"
            rows={[
              {
                id: 'suppliers',
                label: text('Suppliers · priced invoices', 'الموردون · الفواتير المعروفة القيمة'),
                amount: balances.supplierDue,
                to: '/inventory/purchases',
              },
              {
                id: 'payroll',
                label: text('Approved salaries', 'المرتبات المعتمدة'),
                amount: balances.payrollDue,
                to: '/staff/payroll',
              },
              {
                id: 'expenses',
                label: text('Operating expenses', 'مصروفات التشغيل'),
                amount: balances.expenseDue,
                to: '/staff/expenses',
              },
            ]}
            emptyText={text(
              'No outstanding amounts in these recorded sources.',
              'مفيش مبالغ متبقية في المصادر المسجلة دي.',
            )}
          />
        </ReportPanel>
        <ReportPanel
          title={text('Recorded amounts owed to you', 'مبالغ مستحقة لك')}
          description={text(
            'Open checks and advances are not cash on hand. Supplier credit is not a cash refund.',
            'الشيكات المفتوحة والسلف مش نقدية موجودة. ورصيد المورد الدائن مش استرداد نقدي.',
          )}
        >
          <ReportBars
            variant="list"
            locale={locale}
            color="blue"
            rows={[
              {
                id: 'checks',
                label: text('Uncollected check balances', 'متبقي تحصيل الشيكات المسجلة'),
                amount: balances.openCheckDue,
                to: '/orders',
              },
              {
                id: 'advances',
                label: text('Outstanding staff advances', 'سلف الموظفين المتبقية'),
                amount: balances.staffAdvances,
                to: '/staff/advances',
              },
              {
                id: 'credit',
                label: text('Credit with suppliers', 'رصيد دائن عند الموردين'),
                amount: balances.supplierCredit,
                to: '/inventory/purchases',
              },
            ]}
            emptyText={text(
              'No balances in these recorded sources.',
              'مفيش أرصدة في المصادر المسجلة دي.',
            )}
          />
        </ReportPanel>
      </div>
      <p className="report-footnote">
        {text(
          'Open checks cover orders with recorded bills. This is not a complete customer credit ledger. Cash balances exclude terminal/bank settlements.',
          'الشيكات المفتوحة تخص الطلبات اللي ليها فواتير مسجلة؛ مش دفتر مديونية كامل للعملاء. النقدية لا تشمل تسويات أجهزة الدفع والبنوك.',
        )}
      </p>
    </>
  );
}
