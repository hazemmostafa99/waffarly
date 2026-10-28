import { useMemo, useState, type ReactNode } from 'react';
import { useLocale } from '@waffarly/ui';
import { useMatches } from 'react-router-dom';
import { PageTitleContext } from '../lib/page-title-context.js';

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const matches = useMatches();
  const [pageTitle, setTitle] = useState<string | null>(null);
  const handle = matches.at(-1)?.handle as { title?: string } | undefined;
  const title = pageTitle ?? t(handle?.title ?? 'Administration workspace');
  const value = useMemo(() => ({ title, setTitle }), [title]);

  return <PageTitleContext value={value}>{children}</PageTitleContext>;
}
