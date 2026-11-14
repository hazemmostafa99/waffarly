import type { ReactNode } from 'react';
import { Businesses } from '../Businesses.js';
import { useLocale } from '@waffarly/ui';
import { PageHeader } from './PageHeader.js';

function LegacyPage({ children }: { children: ReactNode }) {
  return (
    <div className="shell mx-auto w-full max-w-none px-4 py-6 md:px-6 xl:px-8">{children}</div>
  );
}

export function BusinessesCompatibilityPage() {
  const { t } = useLocale();
  return (
    <LegacyPage>
      <PageHeader title={t('Businesses')} />
      <Businesses />
    </LegacyPage>
  );
}
