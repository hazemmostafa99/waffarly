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
    <article className="rounded-2xl border border-waffarly-border bg-white p-2 shadow-[0_3px_12px_rgba(20,32,62,0.035)]" aria-busy={loading}>
      <div className={`flex min-h-[106px] flex-col justify-between rounded-xl p-3.5 ${toneClasses}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="m-0 text-xs font-semibold text-waffarly-muted">{label}</p>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-current" aria-hidden="true">
            <Icon size={17} strokeWidth={1.9} />
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <small className="max-w-[70%] text-[10px] leading-4 text-waffarly-muted">{helper}</small>
          <strong className="text-[25px] font-extrabold leading-none text-waffarly-ink">
            {loading ? <span className="inline-block h-6 w-9 animate-pulse rounded bg-white/80" /> : value}
          </strong>
        </div>
      </div>
    </article>
  );
}
