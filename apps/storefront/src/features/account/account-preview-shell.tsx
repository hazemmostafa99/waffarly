'use client';

import type { ReactNode } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { Info } from 'lucide-react';
import { Card, useLocale } from '@waffarly/ui';
import { accountCopy } from './account-copy';

export type AccountPreviewSection = 'overview' | 'profile' | 'orders' | 'addresses';

export function AccountPreviewDisclosure() {
  const { locale } = useLocale();
  const t = accountCopy(locale);

  return (
    <aside
      aria-label={t.previewTitle}
      className="mb-5 flex items-start gap-3 rounded-2xl border border-store-gold/40 bg-store-cream px-4 py-3 text-store-ink"
      role="note"
    >
      <Info className="mt-0.5 size-5 shrink-0 text-store-primary" aria-hidden="true" />
      <div>
        <p className="text-storefront-body font-bold">{t.previewTitle}</p>
        <p className="mt-0.5 text-storefront-support leading-5 text-store-secondary">
          {t.previewDescription}
        </p>
      </div>
    </aside>
  );
}

export function AccountPreviewShell({
  active,
  title,
  description,
  isPreview = true,
  children,
}: {
  active: AccountPreviewSection;
  title: string;
  description: string;
  isPreview?: boolean;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const params = useParams<{ slug: string }>();
  const t = accountCopy(locale);
  const baseHref = `/s/${encodeURIComponent(params.slug)}/account`;
  const links = [
    { key: 'overview', href: baseHref, label: t.overview },
    { key: 'profile', href: `${baseHref}/profile`, label: t.profile },
    { key: 'orders', href: `${baseHref}/orders`, label: t.orders },
    { key: 'addresses', href: `${baseHref}/addresses`, label: t.addresses },
  ] as const;

  return (
    <main className="mx-auto w-[calc(100%-2rem)] max-w-[1240px] py-6 sm:py-9 lg:py-11">
      {isPreview && <AccountPreviewDisclosure />}
      <header className="mb-5 flex flex-col gap-1.5 sm:mb-6">
        <h1 className="font-heading text-storefront-page font-extrabold text-store-ink">{title}</h1>
        <p className="max-w-2xl text-storefront-body leading-6 text-store-secondary">
          {description}
        </p>
      </header>

      <nav
        aria-label={t.accountNavigation}
        className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {links.map(({ key, href, label }) => (
          <Link
            aria-current={active === key ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-storefront-support font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary ${active === key ? 'border-store-primary bg-store-primary text-white' : 'border-store-border bg-white text-store-primary-dark hover:bg-store-cream'}`}
            href={href}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Card className="rounded-[1.35rem] border-store-border bg-white p-4 shadow-[0_12px_32px_rgba(30,38,36,0.045)] sm:p-6">
        {children}
      </Card>
    </main>
  );
}
