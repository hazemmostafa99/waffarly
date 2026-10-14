import type { BusinessActivitySummary, PlatformModuleSummary } from '@waffarly/contracts';
import { AlertTriangle, Check, Minus, Pencil } from 'lucide-react';
import { Button } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';

interface ActivityCatalogTableProps {
  activities: BusinessActivitySummary[];
  modules: PlatformModuleSummary[];
  onEdit: (activity: BusinessActivitySummary) => void;
}

function ModuleNames({ modules, emptyLabel, tone }: { modules: PlatformModuleSummary[]; emptyLabel: string; tone: 'blue' | 'mint' }) {
  const { t } = useLocale();
  const toneClasses = tone === 'blue'
    ? 'border-waffarly-info/10 bg-waffarly-kpi-blue text-waffarly-info'
    : 'border-waffarly-success/10 bg-waffarly-kpi-mint text-waffarly-primary';

  if (modules.length === 0) return <span className="text-[11px] text-waffarly-muted">{emptyLabel}</span>;

  return (
    <ul className="m-0 flex flex-wrap gap-1.5 p-0">
      {modules.map((module) => (
        <li key={module.key} className={`list-none rounded-lg border px-2 py-1 text-[10px] font-semibold ${toneClasses}`}>
          {t(module.name)}
        </li>
      ))}
    </ul>
  );
}

export function ActivityCatalogTable({ activities, modules, onEdit }: ActivityCatalogTableProps) {
  const { t } = useLocale();

  return (
    <div className="overflow-x-auto rounded-xl border border-waffarly-border bg-white" role="region" aria-label={t('Business activity catalog table')} tabIndex={0}>
      <table className="w-full min-w-[860px] border-collapse text-start text-sm">
        <caption className="sr-only">{t('Business activity catalog table')}</caption>
        <thead className="bg-waffarly-input text-[10px] font-bold text-waffarly-muted">
          <tr className="border-b border-waffarly-border">
            <th className="min-w-44 px-3 py-3 text-start" scope="col">{t('Business activity')}</th>
            <th className="min-w-48 px-3 py-3 text-start" scope="col">{t('Code-supported modules')}</th>
            <th className="min-w-48 px-3 py-3 text-start" scope="col">{t('Catalog associations')}</th>
            <th className="min-w-36 px-3 py-3 text-start" scope="col">{t('Catalog status')}</th>
            <th className="w-24 px-3 py-3 text-end" scope="col">{t('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => {
            const supportedModules = modules.filter((module) => module.supportedActivities.includes(activity.key));
            const catalogModules = activity.moduleKeys
              .map((key) => modules.find((module) => module.key === key))
              .filter((module) => module !== undefined);
            const mismatch = activity.moduleKeys.some((key) => !supportedModules.some((module) => module.key === key));

            return (
              <tr key={activity.key} className="border-b border-waffarly-border last:border-b-0 align-middle hover:bg-waffarly-kpi-mint/20">
                <th className="px-3 py-3 text-start font-normal" scope="row">
                  <span className="block text-xs font-bold text-waffarly-ink">{t(activity.name)}</span>
                  <code className="mt-1 block text-[9px] text-waffarly-muted" dir="ltr">{activity.key}</code>
                </th>
                <td className="px-3 py-3">
                  <ModuleNames modules={supportedModules} emptyLabel={t('No modules supported')} tone="blue" />
                </td>
                <td className="px-3 py-3">
                  <ModuleNames modules={catalogModules} emptyLabel={t('No modules associated')} tone="mint" />
                </td>
                <td className="px-3 py-3">
                  {mismatch ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-waffarly-danger-bg px-2.5 py-1.5 text-[10px] font-bold text-waffarly-danger">
                      <AlertTriangle size={12} aria-hidden="true" />{t('Catalog mismatch')}
                    </span>
                  ) : catalogModules.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-waffarly-kpi-mint px-2.5 py-1.5 text-[10px] font-bold text-waffarly-primary">
                      <Check size={12} aria-hidden="true" />{t('Valid associations')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-waffarly-input px-2.5 py-1.5 text-[10px] font-medium text-waffarly-muted">
                      <Minus size={12} aria-hidden="true" />{t('No modules associated')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(activity)} aria-label={t('Edit {{name}}', { name: t(activity.name) })}>
                    <Pencil size={13} aria-hidden="true" />
                    {t('Edit')}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
