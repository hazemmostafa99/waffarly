// Sidebar labels and destinations; routes retain their existing public URLs.
export type MerchantNavigationLink = {
  path: string;
  en: string;
  ar: string;
  icon: string;
  aliases?: string[];
};

export type MerchantNavigationGroup = {
  id: string;
  en: string;
  ar: string;
  icon: string;
  links: MerchantNavigationLink[];
};

export const dashboardLink: MerchantNavigationLink = {
  path: '/',
  en: 'Dashboard',
  ar: 'لوحة التحكم',
  icon: 'home',
};
export const settingsLink: MerchantNavigationLink = {
  path: '/settings',
  en: 'Settings',
  ar: 'الإعدادات',
  icon: 'settings',
};

export const merchantNavigationGroups: MerchantNavigationGroup[] = [
  {
    id: 'sales',
    en: 'Sales & customers',
    ar: 'المبيعات والعملاء',
    icon: 'orders',
    links: [
      { path: '/orders', en: 'Orders', ar: 'الطلبات', icon: 'orders' },
      { path: '/customers', en: 'Customers', ar: 'العملاء', icon: 'customers' },
      { path: '/discounts', en: 'Discounts', ar: 'الخصومات', icon: 'discounts' },
    ],
  },
  {
    id: 'catalog',
    en: 'Products',
    ar: 'المنتجات',
    icon: 'box',
    links: [
      {
        path: '/products',
        en: 'Products',
        ar: 'المنتجات',
        icon: 'box',
        aliases: ['/product-builder'],
      },
      { path: '/categories', en: 'Categories', ar: 'التصنيفات', icon: 'grid' },
      { path: '/media', en: 'Media library', ar: 'مكتبة الصور', icon: 'image' },
    ],
  },
  {
    id: 'inventory',
    en: 'Inventory & purchasing',
    ar: 'المخزون والمشتريات',
    icon: 'box',
    links: [
      {
        path: '/inventory',
        en: 'Stock balances',
        ar: 'أرصدة المخزون',
        icon: 'box',
        aliases: [
          '/inventory/health',
          '/inventory/opening',
          '/inventory/waste',
          '/inventory/transfers',
          '/inventory/settings',
          '/inventory/operations',
        ],
      },
      {
        path: '/inventory/items',
        en: 'Stock items & materials',
        ar: 'الأصناف والخامات',
        icon: 'grid',
      },
      { path: '/inventory/purchases', en: 'Purchases', ar: 'المشتريات', icon: 'receipt' },
      {
        path: '/inventory/history',
        en: 'Stock movements',
        ar: 'حركة المخزون',
        icon: 'receipt',
        aliases: ['/inventory/movements'],
      },
    ],
  },
  {
    id: 'hr',
    en: 'Human resources',
    ar: 'الموارد البشرية',
    icon: 'customers',
    links: [
      { path: '/staff', en: 'Employees', ar: 'الموظفون', icon: 'customers' },
      { path: '/staff/attendance', en: 'Attendance', ar: 'الحضور والانصراف', icon: 'receipt' },
      { path: '/staff/payroll', en: 'Payroll', ar: 'المرتبات', icon: 'revenue' },
      { path: '/staff/advances', en: 'Staff advances', ar: 'سلف الموظفين', icon: 'revenue' },
    ],
  },
  {
    id: 'finance',
    en: 'Finance',
    ar: 'المالية',
    icon: 'revenue',
    links: [
      { path: '/staff/expenses', en: 'Operating expenses', ar: 'المصروفات', icon: 'receipt' },
      { path: '/pos-cash', en: 'Cash drawers & safes', ar: 'النقدية والخزائن', icon: 'revenue' },
    ],
  },
  {
    id: 'operations',
    en: 'Operations',
    ar: 'التشغيل',
    icon: 'branches',
    links: [
      { path: '/branches', en: 'Branches', ar: 'الفروع', icon: 'branches' },
      {
        path: '/delivery-couriers',
        en: 'Delivery couriers',
        ar: 'مندوبو التوصيل',
        icon: 'customers',
      },
    ],
  },
  {
    id: 'pos',
    en: 'Point of sale',
    ar: 'نقاط البيع',
    icon: 'store',
    links: [
      { path: '/pos-registers', en: 'POS registers', ar: 'أجهزة نقاط البيع', icon: 'store' },
      {
        path: '/employees',
        en: 'Cashier accounts & permissions',
        ar: 'حسابات وصلاحيات الكاشير',
        icon: 'customers',
      },
      { path: '/pos-tables', en: 'Tables', ar: 'الطاولات', icon: 'grid' },
    ],
  },
  {
    id: 'reports',
    en: 'Reports',
    ar: 'التقارير',
    icon: 'receipt',
    links: [
      { path: '/pos-shift-reports', en: 'Shift reports', ar: 'تقارير الورديات', icon: 'receipt' },
      {
        path: '/pos-item-returns',
        en: 'Returns & waste',
        ar: 'المرتجعات والهالك',
        icon: 'receipt',
      },
      { path: '/pos-operations', en: 'Operations reports', ar: 'تقارير التشغيل', icon: 'revenue' },
      {
        path: '/profitability',
        en: 'Product profitability',
        ar: 'ربحية المنتجات',
        icon: 'revenue',
      },
    ],
  },
];

export function findMerchantNavigationLink(pathname: string): MerchantNavigationLink | undefined {
  const links = [
    dashboardLink,
    settingsLink,
    ...merchantNavigationGroups.flatMap((group) => group.links),
  ];
  // Match the most specific destination, including detail pages and legacy aliases.
  return links
    .flatMap((link) => [link.path, ...(link.aliases ?? [])].map((path) => ({ link, path })))
    .filter(({ path }) => pathname === path || (path !== '/' && pathname.startsWith(path + '/')))
    .sort((a, b) => b.path.length - a.path.length)[0]?.link;
}
