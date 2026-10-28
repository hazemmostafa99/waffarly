import type { LucideIcon } from 'lucide-react';

interface CompactStatCardProps {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone: 'mint' | 'gold' | 'blue' | 'purple';
  loading?: boolean;
}

export function CompactStatCard({ label, value, helper, icon: Icon, tone, loading = false }: CompactStatCardProps) {
  const toneClasses = {
    mint: 'bg-waffarly-kpi-mint text-waffarly-success',
    gold: 'bg-waffarly-kpi-gold text-waffarly-gold',
    blue: 'bg-waffarly-kpi-blue text-waffarly-info',
    purple: 'bg-waffarly-kpi-purple text-waffarly-ink',
  }[tone];

  return (
    <article className={`admin-stat border border-waffarly-border ${toneClasses}`} aria-busy={loading}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-current" aria-hidden="true">
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-xs font-semibold text-waffarly-ink">{label}</p>
        <small className="block text-[11px] leading-4 text-waffarly-muted">{helper}</small>
      </div>
      <strong className="admin-stat-value text-waffarly-ink">
        {loading ? <span className="inline-block h-6 w-9 animate-pulse rounded bg-white/80" /> : value}
      </strong>
    </article>
  );
}
