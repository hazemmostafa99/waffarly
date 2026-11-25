// Sidebar labels and destinations; routes retain their existing public URLs.
import type { ActivityFeatureSettings, ActivityWording } from '@waffarly/contracts';

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

export type MerchantBreadcrumb = {
  en: string;
  ar: string;
  to?: string;
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
      { path: '/reports', en: 'Business reports', ar: 'مركز التقارير', icon: 'revenue' },
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

/** Keep links to switched-off activity features (tables, delivery couriers) out of the sidebar. */
export function navigationGroupsForActivity(
  features: ActivityFeatureSettings,
): MerchantNavigationGroup[] {
  if (features.diningTables && features.delivery) return merchantNavigationGroups;
  return merchantNavigationGroups.map((group) => ({
    ...group,
    links: group.links.filter(
      (link) =>
        (features.diningTables || link.path !== '/pos-tables') &&
        (features.delivery || link.path !== '/delivery-couriers'),
    ),
  }));
}

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

export function getMerchantBreadcrumbs(
  pathname: string,
  search: string,
  wording?: ActivityWording | null,
): MerchantBreadcrumb[] {
  if (pathname === '/settings') {
    const settings = new URLSearchParams(search).get('section') ?? 'identity';
    const branding = { en: 'Identity and appearance', ar: 'الهوية والمظهر' };
    const section = {
      identity: branding,
      design: branding,
      publication: { en: 'Visibility on Wfarly', ar: 'الظهور على وفرلي' },
      hours: { en: 'Opening hours', ar: 'مواعيد العمل' },
      delivery: { en: 'Delivery & pickup', ar: 'التوصيل والاستلام' },
      account: { en: 'Account & subscription', ar: 'الحساب والاشتراك' },
    }[settings];
    return [
      { en: 'Settings', ar: 'الإعدادات', to: '/settings?section=identity' },
      section ?? branding,
    ];
  }

  const current = findMerchantNavigationLink(pathname);
  if (pathname === '/') return [];
  if (pathname === '/account') {
    return [
      { en: 'Dashboard', ar: 'لوحة التحكم', to: '/' },
      { en: 'Account', ar: 'الحساب' },
    ];
  }

  const group = merchantNavigationGroups.find((item) =>
    current ? item.links.includes(current) : false,
  );
  if (group && current) {
    return [{ en: group.en, ar: group.ar }, activityLinkLabel(current, wording)];
  }
  if (current === settingsLink) return [{ en: 'Settings', ar: 'الإعدادات' }];
  return current ? [activityLinkLabel(current, wording)] : [];
}

/**
 * Activity wording can rename a link. Today only the stock items page changes:
 * restaurants see "Stock items & materials"; shops see "Stock items".
 */
export function activityLinkLabel(
  link: Pick<MerchantNavigationLink, 'path' | 'en' | 'ar'>,
  wording?: ActivityWording | null,
): { en: string; ar: string } {
  return wording && link.path === '/inventory/items'
    ? wording.stock.itemsTitle
    : { en: link.en, ar: link.ar };
}
