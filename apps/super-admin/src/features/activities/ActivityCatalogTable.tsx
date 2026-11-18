import type { BusinessActivitySummary } from '@waffarly/contracts';
import { Pencil } from 'lucide-react';
import { Button, useLocale } from '@waffarly/ui';

interface ActivityCatalogTableProps {
  activities: BusinessActivitySummary[];
  onEdit: (activity: BusinessActivitySummary) => void;
}

export function ActivityCatalogTable({ activities, onEdit }: ActivityCatalogTableProps) {
  const { t, formatDate } = useLocale();

  return (
    <div
      className="overflow-x-auto rounded-xl border border-waffarly-border bg-white"
      role="region"
      aria-label={t('Business activity catalog table')}
      tabIndex={0}
    >
      <table className="admin-table w-full min-w-[680px] border-collapse text-start text-sm">
        <caption className="sr-only">{t('Business activity catalog table')}</caption>
        <thead className="bg-waffarly-input text-[10px] font-bold text-waffarly-muted">
          <tr className="border-b border-waffarly-border">
            <th className="min-w-40 px-3 py-3 text-start" scope="col">
              {t('Business activity')}
            </th>
            <th className="min-w-60 px-3 py-3 text-start" scope="col">
              {t('Description')}
            </th>
            <th className="min-w-40 px-3 py-3 text-start" scope="col">
              {t('Last updated')}
            </th>
            <th className="w-24 px-3 py-3 text-end" scope="col">
              {t('Actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr
              key={activity.key}
              className="border-b border-waffarly-border last:border-b-0 align-middle hover:bg-waffarly-kpi-mint/20"
            >
              <th className="px-3 py-3 text-start font-normal" scope="row">
                <span className="block text-xs font-bold text-waffarly-ink">
                  {t(activity.name)}
                </span>
                <code className="mt-1 block text-[9px] text-waffarly-muted" dir="ltr">
                  {activity.key}
                </code>
              </th>
              <td className="px-3 py-3 text-xs leading-5 text-waffarly-muted">
                {t(activity.description)}
              </td>
              <td className="px-3 py-3 text-xs text-waffarly-muted">
                {activity.updatedAt
                  ? t('Last edited by {{name}} on {{date}}', {
                      name: activity.updatedBy,
                      date: formatDate(activity.updatedAt),
                    })
                  : t('Using the platform defaults.')}
              </td>
              <td className="px-3 py-3 text-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(activity)}
                  aria-label={t('Edit {{name}}', { name: t(activity.name) })}
                >
                  <Pencil size={13} aria-hidden="true" />
                  {t('Edit')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
