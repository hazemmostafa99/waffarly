import type { BusinessActivitySummary, PlatformModuleSummary } from '@waffarly/contracts';
import { Building2, Check, ShoppingBasket, Shirt, Utensils } from 'lucide-react';
import { useLocale } from '@waffarly/ui';

const activityIcons = {
  restaurant: Utensils,
  clothing: Shirt,
  supermarket: ShoppingBasket,
  other: Building2,
} as const;

interface ActivityCardProps {
  activity: BusinessActivitySummary;
  modules: PlatformModuleSummary[];
}

export function ActivityCard({ activity, modules }: ActivityCardProps) {
  const { t, locale } = useLocale();
  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn').format(value);
  const Icon = activityIcons[activity.key];
  const compatibleModules = activity.moduleKeys
    .map((key) => modules.find((module) => module.key === key))
    .filter((module) => module !== undefined);

  return (
    <article className="admin-panel flex min-w-0 flex-col rounded-2xl border border-waffarly-border bg-white shadow-[0_3px_12px_rgba(20,32,62,0.035)] transition-shadow hover:shadow-[0_5px_20px_rgba(20,32,62,0.07)]">
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary"
          aria-hidden="true"
        >
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-xs font-bold text-waffarly-ink">{t(activity.name)}</h3>
          <code className="mt-1 block text-[9px] text-waffarly-muted" dir="ltr">
            {activity.key}
          </code>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-waffarly-kpi-mint px-2 py-1 text-[9px] font-bold text-waffarly-primary">
          <Check size={11} aria-hidden="true" />
          {formatCount(compatibleModules.length)} {t('modules')}
        </span>
      </div>
      <p className="mb-0 mt-3 line-clamp-2 min-h-8 text-[11px] leading-4 text-waffarly-muted">
        {t(activity.description)}
      </p>
    </article>
  );
}
