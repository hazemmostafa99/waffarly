import type { PosEmployeePermission, PosEmployeeRole } from '@waffarly/contracts';

export const employeeRoleLabels: Record<PosEmployeeRole, [string, string]> = {
  branch_manager: ['Branch manager', 'مدير فرع'],
  cashier: ['Cashier', 'كاشير'],
  inventory_officer: ['Inventory officer', 'مسؤول مخزون'],
  accountant: ['Accountant', 'محاسب'],
  customer_service: ['Customer service', 'خدمة عملاء'],
  kitchen: ['Kitchen / preparation', 'مطبخ / تجهيز'],
  supervisor: ['Supervisor (existing role)', 'مشرف (الدور الحالي)'],
};

export const employeePermissionLabels: Record<PosEmployeePermission, [string, string]> = {
  approve_shift_close: ['Approve shift-close variances', '\u0627\u0639\u062a\u0645\u0627\u062f \u0641\u0631\u0648\u0642 \u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0648\u0631\u062f\u064a\u0629'],
  manage_cash_movements: ['Approve cash-in and cash-out', '\u0627\u0639\u062a\u0645\u0627\u062f \u062d\u0631\u0643\u0627\u062a \u0627\u0644\u0625\u064a\u062f\u0627\u0639 \u0648\u0627\u0644\u0633\u062d\u0628 \u0627\u0644\u0646\u0642\u062f\u064a'],
  view_orders: ['View assigned-branch orders', 'عرض طلبات الفروع المعيّنة'],
  accept_recipe_orders: ['Accept recipe orders', 'قبول طلبات التحضير'],
  start_preparation: ['Start preparation', 'بدء التحضير'],
  open_register_shift: ['Open register shifts', 'فتح ورديات نقاط البيع'],
  sell: ['Create sales and collect payments', 'إنشاء المبيعات وتحصيل المدفوعات'],
  view_receipts: ['View and reprint receipts', 'عرض الإيصالات وإعادة طباعتها'],
  view_inventory: ['View stock balances', 'عرض أرصدة المخزون'],
  approve_discounts: [
    'Discount approval grant (workflow pending)',
    'صلاحية اعتماد الخصومات (مسار الاعتماد قيد التطوير)',
  ],
  approve_voids: [
    'Void approval grant (workflow pending)',
    'صلاحية اعتماد الإلغاء (مسار الاعتماد قيد التطوير)',
  ],
  approve_refunds: [
    'Refund approval grant (workflow pending)',
    'صلاحية اعتماد الاسترجاع (مسار الاعتماد قيد التطوير)',
  ],
};
