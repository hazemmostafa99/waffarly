import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone: 'mint' | 'gold' | 'blue' | 'purple';
  loading?: boolean;
}

export function StatCard({ label, value, helper, icon: Icon, tone, loading = false }: StatCardProps) {
  const toneClasses = {
    mint: { surface: 'bg-waffarly-kpi-mint', icon: 'text-waffarly-success' },
    gold: { surface: 'bg-waffarly-kpi-gold', icon: 'text-waffarly-gold' },
    blue: { surface: 'bg-waffarly-kpi-blue', icon: 'text-waffarly-info' },
    purple: { surface: 'bg-waffarly-kpi-purple', icon: 'text-waffarly-ink' },
  }[tone];
  return (
    <article className={`grid min-h-[150px] content-start rounded-2xl border border-waffarly-border p-4 shadow-[0_3px_12px_rgba(20,32,62,0.035)] md:p-5 ${toneClasses.surface}`} aria-busy={loading}>
      <div className={`mb-3 grid size-9 place-items-center rounded-xl bg-white ${toneClasses.icon}`} aria-hidden="true">
        <Icon size={19} strokeWidth={1.9} />
      </div>
      <p className="m-0 text-xs font-semibold text-waffarly-muted">{label}</p>
      <strong className="mt-1 text-[26px] font-extrabold leading-tight text-waffarly-ink">{loading ? <span className="block h-7 w-14 animate-pulse rounded-md bg-waffarly-input" /> : value}</strong>
      <small className="mt-2 text-[11px] leading-4 text-waffarly-muted">{helper}</small>
    </article>
  );
}
