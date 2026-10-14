import type { ReactNode } from 'react';
import { useLocale } from '@waffarly/ui';

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  const { locale } = useLocale();
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className={`mb-2 text-[11px] font-bold text-waffarly-primary ${locale === 'ar' ? '' : 'uppercase tracking-[0.12em]'}`}>{eyebrow}</p>}
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-waffarly-ink md:text-[26px]">{title}</h1>
        <p className="mb-0 mt-2 max-w-3xl text-sm leading-6 text-waffarly-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
