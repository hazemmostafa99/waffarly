import type { SubscriptionStatus } from '@waffarly/contracts';
import { Badge, useLocale, type BadgeProps } from '@waffarly/ui';

const statuses: Record<
  SubscriptionStatus,
  { en: string; ar: string; variant: BadgeProps['variant'] }
> = {
  active: { en: 'Subscription active', ar: 'الاشتراك نشط', variant: 'success' },
  pending: { en: 'Awaiting activation', ar: 'بانتظار التفعيل', variant: 'warning' },
  expired: { en: 'Subscription expired', ar: 'الاشتراك منتهي', variant: 'destructive' },
  suspended: { en: 'Subscription suspended', ar: 'الاشتراك موقوف', variant: 'destructive' },
  cancelled: { en: 'Subscription cancelled', ar: 'الاشتراك ملغي', variant: 'outline' },
  legacy: { en: 'Subscription under review', ar: 'الاشتراك قيد المراجعة', variant: 'info' },
};

export function SubscriptionStatusBadge({ status }: { status?: SubscriptionStatus | undefined }) {
  const { locale } = useLocale();
  const info = status ? statuses[status] : undefined;
  return (
    <Badge
      variant={info?.variant ?? 'outline'}
      className="max-w-full whitespace-normal text-center"
    >
      {info
        ? info[locale]
        : locale === 'ar'
          ? 'حالة الاشتراك غير متاحة'
          : 'Subscription status unavailable'}
    </Badge>
  );
}
