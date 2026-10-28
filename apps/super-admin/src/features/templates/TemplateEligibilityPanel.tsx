import { Badge, Card, useLocale } from '@waffarly/ui';
import { Check, ShieldCheck } from 'lucide-react';
import type { BusinessActivityKey, StorefrontTemplateSummary } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';

function activityLabel(activity: StorefrontTemplateSummary['activity']) {
  return activity === 'general' ? 'All business activities' : BUSINESS_ACTIVITY_LABELS[activity as BusinessActivityKey];
}

export function TemplateEligibilityPanel({ template }: { template: StorefrontTemplateSummary }) {
  const { t } = useLocale();
  const available = template.status === 'available';

  return (
    <Card className="admin-panel grid content-start admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]" aria-labelledby="template-eligibility-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true"><ShieldCheck size={17} /></span>
        <div>
          <h2 id="template-eligibility-heading" className="m-0 text-base font-bold">{t('Merchant eligibility')}</h2>
          <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Activity scope and availability determine which merchants can newly select this design.')}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-waffarly-border bg-waffarly-input/45 p-3">
          <p className="m-0 text-[10px] font-semibold text-waffarly-muted">{t('Activity scope')}</p>
          <p className="mb-0 mt-1 text-sm font-bold text-waffarly-ink">{t(activityLabel(template.activity))}</p>
        </div>
        <div className="rounded-xl border border-waffarly-border bg-waffarly-input/45 p-3">
          <p className="m-0 text-[10px] font-semibold text-waffarly-muted">{t('Library status')}</p>
          <Badge variant={available ? 'success' : 'warning'} className="mt-1 min-h-6 px-2 text-[10px]">{available ? t('Available') : t('Draft')}</Badge>
        </div>
      </div>

      <ul className="m-0 grid list-none gap-2 p-0">
        <li className="flex items-start gap-2 text-xs leading-5 text-waffarly-ink"><Check size={14} className="mt-0.5 shrink-0 text-waffarly-success" aria-hidden="true" />{template.activity === 'general' ? t('General designs match every business activity.') : t('This design is scoped to {{activity}} businesses.', { activity: t(activityLabel(template.activity)) })}</li>
        <li className="flex items-start gap-2 text-xs leading-5 text-waffarly-ink"><Check size={14} className="mt-0.5 shrink-0 text-waffarly-success" aria-hidden="true" />{t('Only available designs are offered for new merchant selections.')}</li>
      </ul>

      <div className="rounded-xl border border-waffarly-info/15 bg-waffarly-kpi-blue/45 p-3">
        <p className="m-0 text-[11px] leading-5 text-waffarly-ink">{t('An already-selected design may remain visible to that merchant if it is later moved to drafts.')}</p>
      </div>
    </Card>
  );
}
