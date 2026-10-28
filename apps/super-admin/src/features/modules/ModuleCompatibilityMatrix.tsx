import type { BusinessActivitySummary, PlatformModuleSummary } from '@waffarly/contracts';
import { AlertTriangle, Check, Minus } from 'lucide-react';
import { useLocale } from '@waffarly/ui';

interface ModuleCompatibilityMatrixProps {
  activities: BusinessActivitySummary[];
  modules: PlatformModuleSummary[];
}

function CompatibilityCell({
  supported,
  associated,
}: {
  supported: boolean;
  associated: boolean;
}) {
  const { t } = useLocale();

  if (associated && !supported) {
    return (
      <span className="mx-auto grid size-7 place-items-center rounded-lg bg-waffarly-danger-bg text-waffarly-danger" title={t('Catalog mismatch')} aria-label={t('Catalog mismatch')}>
        <AlertTriangle size={14} aria-hidden="true" />
      </span>
    );
  }

  if (associated) {
    return (
      <span className="mx-auto grid size-7 place-items-center rounded-lg bg-waffarly-kpi-mint text-waffarly-success" title={t('Associated in catalog')} aria-label={t('Associated in catalog')}>
        <Check size={15} aria-hidden="true" />
      </span>
    );
  }

  if (supported) {
    return (
      <span className="mx-auto grid size-7 place-items-center rounded-lg bg-waffarly-kpi-blue text-waffarly-info" title={t('Supported by code, not associated')} aria-label={t('Supported by code, not associated')}>
        <Check size={15} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="mx-auto grid size-7 place-items-center rounded-lg bg-waffarly-input text-waffarly-muted" title={t('Not supported')} aria-label={t('Not supported')}>
      <Minus size={14} aria-hidden="true" />
    </span>
  );
}

export function ModuleCompatibilityMatrix({ activities, modules }: ModuleCompatibilityMatrixProps) {
  const { t } = useLocale();

  return (
    <div className="overflow-x-auto rounded-xl border border-waffarly-border bg-white" role="region" aria-label={t('Module and activity compatibility matrix')} tabIndex={0}>
      <table className="admin-table w-full min-w-[620px] border-collapse text-start text-sm">
        <caption className="sr-only">{t('Module and activity compatibility matrix')}</caption>
        <thead className="bg-waffarly-input text-waffarly-muted">
          <tr className="border-b border-waffarly-border">
            <th className="w-[220px] px-3 py-3 text-start text-[10px] font-bold uppercase tracking-wide" scope="col">{t('Platform module')}</th>
            {activities.map((activity) => (
              <th key={activity.key} className="min-w-24 px-2 py-3 text-center" scope="col">
                <span className="block text-[11px] font-bold normal-case tracking-normal text-waffarly-ink">{t(activity.name)}</span>
                <code className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal" dir="ltr">{activity.key}</code>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module.key} className="border-b border-waffarly-border last:border-b-0 align-middle hover:bg-waffarly-kpi-mint/20">
              <th className="px-3 py-3 text-start font-normal" scope="row">
                <h3 className="m-0 text-xs font-bold text-waffarly-ink">{t(module.name)}</h3>
                <code className="mt-1 block text-[9px] text-waffarly-muted" dir="ltr">{module.key}</code>
                <p className="mb-0 mt-1 line-clamp-2 text-[10px] leading-4 text-waffarly-muted">{t(module.description)}</p>
                {module.dependencies.length > 0 && (
                  <p className="mb-0 mt-1 text-[9px] text-waffarly-muted">
                    <span className="font-semibold text-waffarly-ink">{t('Dependencies')}:</span>{' '}
                    {module.dependencies.map((dependency) => t(modules.find((candidate) => candidate.key === dependency)?.name ?? dependency)).join(', ')}
                  </p>
                )}
              </th>
              {activities.map((activity) => (
                <td key={activity.key} className="px-2 py-3 text-center">
                  <CompatibilityCell
                    supported={module.supportedActivities.includes(activity.key)}
                    associated={activity.moduleKeys.includes(module.key)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
