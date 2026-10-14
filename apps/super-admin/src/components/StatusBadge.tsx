import { Badge } from '@waffarly/ui';

interface StatusBadgeProps {
  children: string;
  tone: 'success' | 'warning' | 'neutral' | 'info';
}

const variants = {
  success: 'outline',
  warning: 'outline',
  neutral: 'outline',
  info: 'outline',
} as const;

export function StatusBadge({ children, tone }: StatusBadgeProps) {
  const toneClass = {
    success: 'border-transparent bg-waffarly-kpi-mint text-waffarly-primary',
    warning: 'border-transparent bg-waffarly-kpi-gold text-waffarly-ink',
    neutral: 'border-waffarly-border bg-waffarly-input text-waffarly-muted',
    info: 'border-transparent bg-waffarly-kpi-blue text-waffarly-info',
  }[tone];
  return <Badge variant={variants[tone]} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${toneClass}`}>{children}</Badge>;
}
