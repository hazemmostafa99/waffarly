import type { CustomerChannel } from '@waffarly/contracts';

export function channelLabel(channel: CustomerChannel | string, locale: string): string {
  const labels: Record<string, [string, string]> = {
    marketplace: ['Waffarly marketplace', 'سوق وفرلي'],
    storefront: ['Storefront', 'متجر التاجر'],
    pos: ['POS / branch', 'الكاشير / الفرع'],
    manual: ['Manual entry', 'إضافة يدوية'],
  };
  return labels[channel]?.[locale === 'ar' ? 1 : 0] ?? channel;
}

export function orderStatusLabel(status: string, locale: string): string {
  const labels: Record<string, string> = {
    pending: 'قيد الانتظار',
    accepted: 'مقبول',
    preparing: 'قيد التحضير',
    ready: 'جاهز',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    rejected: 'مرفوض',
  };
  return locale === 'ar' ? (labels[status] ?? status) : status;
}
