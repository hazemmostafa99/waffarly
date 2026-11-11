import type { CategoryId } from '@/features/marketplace/search/model/search-state';

export type NavigationTarget =
  | { kind: 'category'; category: CategoryId }
  | { kind: 'section'; section: string }
  | { kind: 'route'; href: string }
  | { kind: 'pending'; title: string };

export const marketplaceNavigation: { label: string; target: NavigationTarget }[] = [
  { label: 'الرئيسية', target: { kind: 'section', section: 'marketplace-main' } },
  { label: 'عروض اليوم', target: { kind: 'route', href: '/offers' } },
  { label: 'الأقسام', target: { kind: 'section', section: 'categories' } },
  { label: 'المتاجر', target: { kind: 'section', section: 'stores' } },
  { label: 'الأجهزة', target: { kind: 'category', category: 'electronics' } },
  { label: 'الموبايلات', target: { kind: 'category', category: 'mobiles' } },
  { label: 'الموضة', target: { kind: 'category', category: 'fashion' } },
  { label: 'المنزل والمطبخ', target: { kind: 'category', category: 'home' } },
  { label: 'السوبر ماركت', target: { kind: 'category', category: 'grocery' } },
  { label: 'المطاعم', target: { kind: 'section', section: 'restaurants' } },
  { label: 'بيع على وفّرلي', target: { kind: 'route', href: '/join' } },
];
