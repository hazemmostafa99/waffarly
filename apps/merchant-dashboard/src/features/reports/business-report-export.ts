/** Exports exactly the report response, scope and completeness markers displayed on screen. */
import type { BusinessReportBalances, OwnerBusinessReport } from '@waffarly/contracts';
import { downloadReportCsv } from './report-helpers.js';
import { reportSourceLabel } from './business-report-presenter.js';

export function exportBusinessReport(report: OwnerBusinessReport, locale: string) {
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const month = report.current.month;
  const branchId = report.branchId ?? '';
  const selectedBranch = report.branches.find((branch) => branch.id === branchId);
  const balanceLabels: Record<keyof BusinessReportBalances, string> = {
    safeCash: text('Safe cash', 'النقدية في الخزائن'),
    drawerCash: text('Drawer custody', 'عهدة الأدراج'),
    pendingTransfers: text('In transit to safes', 'عهد تحت التسليم للخزائن'),
    courierCash: text('Cash held by couriers', 'نقدية مع المندوبين'),
    supplierDue: text('Suppliers · priced invoices', 'الموردون · الفواتير المعروفة القيمة'),
    supplierCredit: text('Credit with suppliers', 'رصيد دائن عند الموردين'),
    unknownSupplierInvoices: text(
      'Unpriced confirmed supplier invoices',
      'فواتير موردين مؤكدة بدون قيمة معروفة',
    ),
    expenseDue: text('Unpaid operating expenses', 'مصروفات التشغيل المتبقية'),
    payrollDue: text('Unpaid approved salaries', 'المرتبات المعتمدة المتبقية'),
    staffAdvances: text('Outstanding staff advances', 'سلف الموظفين المتبقية'),
    openCheckDue: text('Uncollected check balances', 'متبقي تحصيل الشيكات المسجلة'),
    unverifiedDrops: text('Unverified historical drops', 'تسليمات قديمة غير مؤكدة'),
    unresolvedTransferDifference: text('Unresolved receipt differences', 'فروق استلام لم تُراجع'),
  };
  const rows: Array<Array<string | number | null>> = [
    [text('Business report', 'تقرير البيزنس'), month],
    [text('Branch', 'الفرع'), selectedBranch?.name ?? text('All branches', 'كل الفروع')],
    [text('Timezone', 'المنطقة الزمنية'), report.timezone],
    [text('Currency', 'العملة'), report.currency],
    [text('Generated at', 'وقت إعداد التقرير'), report.generatedAt],
    [text('From', 'من'), report.current.from],
    [text('To', 'إلى'), report.current.to],
    [
      text('Basis', 'أساس التقرير'),
      text(
        'Recorded product operations; latest-purchase cost; current-status cancellations excluded; excludes delivery income, fees, taxes and depreciation.',
        'عمليات المنتجات المسجلة؛ تكلفة آخر شراء؛ الإلغاء حسب الحالة الحالية؛ بدون إيراد التوصيل والعمولات والضرائب والإهلاك.',
      ),
    ],
    [text('Metric', 'المؤشر'), month, report.previous.month],
    ...(
      [
        ['netSales', text('Net product sales', 'صافي مبيعات المنتجات')],
        ['refunds', text('Refund revenue', 'الإيراد المسترد')],
        ['consumedCost', text('Consumed stock cost', 'تكلفة الخامات المستهلكة')],
        ['grossProfit', text('Product gross profit', 'مجمل ربح المنتجات')],
        ['expenses', text('Operating expenses', 'مصروفات التشغيل')],
        [
          'payrollCost',
          text('Staff cost before advance repayments', 'تكلفة الموظفين قبل أقساط السلف'),
        ],
        ['wasteCost', text('Separate stock waste', 'هالك المخزون المستقل')],
        ['operatingResult', text('Recorded operating result', 'نتيجة التشغيل المسجلة')],
      ] as const
    ).map(([key, label]) => [label, report.current[key], report.previous[key]]),
    [
      text('Lines with missing cost', 'بنود بدون تكلفة معروفة'),
      report.current.unknownCostLines,
      report.previous.unknownCostLines,
    ],
    [
      text('Waste movements with missing cost', 'حركات هالك بدون تكلفة معروفة'),
      report.current.unknownWasteMovements,
      report.previous.unknownWasteMovements,
    ],
    [
      text('Payroll coverage', 'اكتمال المرتبات'),
      report.current.payrollComplete
        ? text('Complete', 'مكتملة')
        : text('Incomplete', 'غير مكتملة'),
      report.previous.payrollComplete
        ? text('Complete', 'مكتملة')
        : text('Incomplete', 'غير مكتملة'),
    ],
    [
      text('Unallocated refunds', 'استردادات غير منسوبة لمنتجات'),
      report.current.unallocatedRefunds,
      report.previous.unallocatedRefunds,
    ],
    [],
    [
      text(
        'Current balances (independent of selected month)',
        'الأرصدة الحالية (مستقلة عن الشهر المختار)',
      ),
    ],
    ...(Object.keys(balanceLabels) as Array<keyof BusinessReportBalances>).map((key) => [
      balanceLabels[key],
      report.balances[key],
    ]),
    [],
    [
      text('Day', 'اليوم'),
      text('Net sales', 'صافي المبيعات'),
      text('Consumed cost', 'التكلفة المستهلكة'),
      text('Expenses', 'المصروفات'),
    ],
    ...report.daily.map((day) => [day.date, day.netSales, day.consumedCost, day.expenses]),
    [],
    [text('Expense category', 'تصنيف المصروف'), text('Amount', 'القيمة')],
    ...report.expenseCategories.map((row) => [
      row.id === 'remaining_categories'
        ? text('Remaining categories', 'باقي التصنيفات')
        : row.label,
      row.amount,
    ]),
    [],
    [text('Sales channel', 'قناة البيع'), text('Net sales', 'صافي المبيعات')],
    ...report.sources.map((row) => [reportSourceLabel(row.id, locale), row.amount]),
    [],
    [
      text('Product', 'المنتج'),
      text('Net sales', 'صافي المبيعات'),
      text('Gross profit', 'مجمل الربح'),
    ],
    ...report.products.map((row) => [row.name, row.netSales, row.grossProfit]),
    [
      text('Product row limit reached', 'تم الوصول لحد صفوف المنتجات'),
      report.productsTruncated ? text('Yes', 'نعم') : text('No', 'لا'),
    ],
  ];
  downloadReportCsv(`business-report-${month}-${branchId || 'all'}.csv`, rows);
}
