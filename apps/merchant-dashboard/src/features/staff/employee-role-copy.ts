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
