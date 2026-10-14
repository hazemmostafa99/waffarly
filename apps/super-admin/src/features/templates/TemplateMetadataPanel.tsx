import { CalendarDays, Hash, Palette, UserRound } from 'lucide-react';
import type { BusinessActivityKey, StorefrontTemplateSummary } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import { Card, useLocale } from '@waffarly/ui';

function activityLabel(activity: StorefrontTemplateSummary['activity']) {
  return activity === 'general' ? 'All business activities' : BUSINESS_ACTIVITY_LABELS[activity as BusinessActivityKey];
}

export function TemplateMetadataPanel({ template }: { template: StorefrontTemplateSummary }) {
  const { t, locale, formatDate } = useLocale();
  const formatCount = (value: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn').format(value);

  return (
    <Card className="grid content-start gap-4 rounded-2xl border-waffarly-border bg-white p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5" aria-labelledby="template-metadata-heading">
      <div>
        <h2 id="template-metadata-heading" className="m-0 text-base font-bold">{t('Design metadata')}</h2>
        <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Saved design settings and revision history.')}</p>
      </div>

      <dl className="m-0 grid divide-y divide-waffarly-border">
        <div className="flex items-start justify-between gap-4 py-3 first:pt-0">
          <dt className="inline-flex items-center gap-2 text-xs font-semibold text-waffarly-muted"><Hash size={14} aria-hidden="true" />{t('Library key')}</dt>
          <dd className="m-0 max-w-[65%] break-all text-end font-mono text-xs font-semibold text-waffarly-ink" dir="ltr">{template.key}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="text-xs font-semibold text-waffarly-muted">{t('Business activity')}</dt>
          <dd className="m-0 text-end text-xs font-semibold text-waffarly-ink">{t(activityLabel(template.activity))}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="text-xs font-semibold text-waffarly-muted">{t('Business layout')}</dt>
          <dd className="m-0 text-end text-xs font-semibold text-waffarly-ink">{t(template.layout === 'menu' ? 'Catalog first' : 'Welcome first')}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="inline-flex items-center gap-2 text-xs font-semibold text-waffarly-muted"><Palette size={14} aria-hidden="true" />{t('Accent color')}</dt>
          <dd className="m-0 inline-flex items-center gap-2 font-mono text-xs font-semibold text-waffarly-ink" dir="ltr">
            <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: template.accentColor }} aria-hidden="true" />
            {template.accentColor.toUpperCase()}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="text-xs font-semibold text-waffarly-muted">{t('Revision')}</dt>
          <dd className="m-0 text-xs font-semibold text-waffarly-ink">{formatCount(template.revision)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="inline-flex items-center gap-2 text-xs font-semibold text-waffarly-muted"><CalendarDays size={14} aria-hidden="true" />{t('Created')}</dt>
          <dd className="m-0 text-end text-xs text-waffarly-ink">{formatDate(template.createdAt)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="text-xs font-semibold text-waffarly-muted">{t('Updated')}</dt>
          <dd className="m-0 text-end text-xs text-waffarly-ink">{formatDate(template.updatedAt)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3 last:pb-0">
          <dt className="inline-flex items-center gap-2 text-xs font-semibold text-waffarly-muted"><UserRound size={14} aria-hidden="true" />{t('Updated by')}</dt>
          <dd className="m-0 max-w-[65%] break-words text-end text-xs text-waffarly-ink">{template.updatedBy}</dd>
        </div>
      </dl>
    </Card>
  );
}
