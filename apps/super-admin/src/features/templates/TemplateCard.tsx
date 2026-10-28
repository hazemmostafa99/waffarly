import { ArrowUpRight, Check, Pencil, Store } from 'lucide-react';
import type { BusinessActivityKey, StorefrontTemplateSummary } from '@waffarly/contracts';
import { Badge, Button, useLocale } from '@waffarly/ui';
import { BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import { Link } from 'react-router-dom';
import { TemplateArtwork } from './TemplateArtwork.js';

interface TemplateCardProps {
  template: StorefrontTemplateSummary;
  busy: boolean;
  onEdit: (template: StorefrontTemplateSummary) => void;
  onToggleAvailability: (template: StorefrontTemplateSummary) => void;
}

function activityName(activity: BusinessActivityKey | 'general') {
  return activity === 'general' ? 'All business activities' : BUSINESS_ACTIVITY_LABELS[activity];
}

export function TemplateCard({ template, busy, onEdit, onToggleAvailability }: TemplateCardProps) {
  const { t, formatDate } = useLocale();
  const available = template.status === 'available';

  return (
    <article className="admin-panel-flush group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-waffarly-border bg-white shadow-[0_3px_12px_rgba(20,32,62,0.035)] transition-shadow hover:shadow-[0_8px_26px_rgba(20,32,62,0.09)]">
      <Link
        to={`/templates/${template.id}`}
        className="relative block w-full overflow-hidden bg-waffarly-input text-start no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-waffarly-primary"
        aria-label={t('View details for {{name}}', { name: template.name })}
      >
        <TemplateArtwork template={template} />
        <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl border border-white/50 bg-white/90 px-3 py-2 text-[11px] font-bold text-waffarly-ink opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {t('View template details')} <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </Link>

      <div className="admin-section flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={available ? 'success' : 'warning'} className="min-h-6 px-2 text-[10px]">
            <span className={`size-1.5 rounded-full ${available ? 'bg-waffarly-success' : 'bg-waffarly-gold'}`} aria-hidden="true" />
            {available ? t('Available') : t('Draft')}
          </Badge>
          <span className="text-[10px] font-medium text-waffarly-muted">
            {template.layout === 'menu' ? t('Catalog first') : t('Welcome first')}
          </span>
        </div>

        <div className="mt-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="m-0 truncate text-sm font-bold text-waffarly-ink"><Link to={`/templates/${template.id}`} className="text-inherit no-underline hover:text-waffarly-primary">{template.name}</Link></h3>
              <code className="mt-1 block truncate text-[10px] text-waffarly-muted" dir="ltr">/{template.key}</code>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary" aria-hidden="true"><Store size={17} /></span>
          </div>
          <p className="mb-0 mt-2 line-clamp-2 text-xs leading-5 text-waffarly-muted">{template.description || t('A business storefront design.')}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-waffarly-border pt-3">
          <span className="text-[10px] text-waffarly-muted">{t(activityName(template.activity))}</span>
          <span className="text-[10px] text-waffarly-muted">{t('Updated')} {formatDate(template.updatedAt)}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink"
            onClick={() => onEdit(template)}
          >
            <Pencil size={13} aria-hidden="true" /> {t('Edit')}
          </Button>
          <Button
            type="button"
            variant={available ? 'ghost' : 'default'}
            size="sm"
            className={available
              ? 'h-9 flex-1 text-waffarly-muted hover:bg-waffarly-input hover:text-waffarly-ink'
              : 'h-9 flex-1 bg-waffarly-primary text-white hover:bg-waffarly-primary-hover'}
            disabled={busy}
            onClick={() => onToggleAvailability(template)}
            aria-label={t(available ? 'Move {{name}} to drafts' : 'Make {{name}} available', { name: template.name })}
          >
            {available ? <Pencil size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
            {t(available ? 'Move to drafts' : 'Make available')}
          </Button>
        </div>
      </div>
    </article>
  );
}
