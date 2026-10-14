import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Locale } from '@waffarly/ui';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { storefrontCopy } from '../../lib/storefront-copy';

export function StorefrontFooter({
  catalog,
  locale,
}: {
  catalog: PublicStorefrontCatalog;
  locale: Locale;
}) {
  const t = storefrontCopy(locale);

  return (
    <footer className="mt-20 bg-store-primary-deep text-white">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr] lg:py-16">
        <div>
          <p className="font-heading text-2xl font-extrabold">{catalog.merchantName}</p>
          <p className="mt-3 max-w-sm text-sm leading-7 text-white/70">{t.footerNote}</p>
        </div>
        <div className="grid content-start gap-3 text-sm">
          <p className="font-heading font-bold text-white">{t.menu}</p>
          <Link className="text-white/70 transition hover:text-store-gold" href={`/s/${catalog.slug}/menu`}>
            {t.footerMenu}
          </Link>
          <Link className="text-white/70 transition hover:text-store-gold" href={`/s/${catalog.slug}/favorites`}>
            {t.footerFavorites}
          </Link>
        </div>
        <div className="flex items-end justify-between gap-4 text-xs text-white/55 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-start lg:justify-end">
          <span>© {catalog.merchantName}</span>
          <span className="inline-flex items-center gap-2 font-bold text-white/75">
            Waffarly <ArrowUpRight className="size-4 rtl:rotate-[-45deg]" aria-hidden="true" />
          </span>
        </div>
      </div>
    </footer>
  );
}
