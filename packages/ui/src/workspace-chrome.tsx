'use client';
import type { ReactNode } from 'react';
import { LanguageSwitcher, useLocale } from './i18n.js';

export function WorkspaceChrome({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('Skip to content')}
      </a>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between border-b px-6 py-4 sm:px-12">
        <span className="flex items-center gap-3 font-bold text-primary">
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-primary text-white"
            aria-hidden="true"
          >
            و
          </span>
          {t('Waffarly')}
        </span>
        <LanguageSwitcher />
      </div>
      {children}
    </>
  );
}
