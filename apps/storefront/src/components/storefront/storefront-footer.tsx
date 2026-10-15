'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useLocale } from '@waffarly/ui';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { storefrontCopy } from '../../lib/storefront-copy';

export function StorefrontFooter({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const homeHref = `/s/${catalog.slug}`;
  const menuHref = `${homeHref}/menu`;
  const footerLinkClass = 'text-sm text-white/75 transition-colors hover:text-store-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold';

  return (
    <footer className="mt-14 bg-store-primary-deep text-white sm:mt-20">
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-2 gap-x-8 gap-y-9 px-5 pt-10 pb-8 sm:px-8 sm:pt-12 lg:grid-cols-[1.15fr_1fr_1fr_0.9fr] lg:gap-12 lg:pt-11 lg:pb-9">
        <section className="col-span-2 grid content-start gap-4 text-start lg:col-span-1">
          <div className="flex items-center gap-3">
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-store-gold text-store-primary-deep">
              {catalog.logoData ? (
                <Image src={catalog.logoData} alt="" fill sizes="48px" className="object-contain p-2" unoptimized />
              ) : (
                <Sparkles className="size-5" aria-hidden="true" />
              )}
            </span>
            <span className="grid min-w-0 leading-tight">
              <span className="truncate font-heading text-xl font-extrabold sm:text-2xl">{catalog.merchantName}</span>
              <span className="mt-1 text-xs font-bold tracking-[0.12em] text-store-gold">WAFFARLY BISTRO</span>
            </span>
          </div>
          <p className="max-w-sm text-sm leading-6 text-white/70">{t.footerNote}</p>
        </section>

        <nav aria-label={t.footerExplore} className="grid content-start justify-items-start gap-3 text-start">
          <h2 className="mb-1 font-heading text-sm font-extrabold text-white">{t.footerExplore}</h2>
          <Link className={footerLinkClass} href={menuHref}>{t.footerMenu}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/offers`}>{locale === 'ar' ? 'العروض' : 'Offers'}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/favorites`}>{t.footerFavorites}</Link>
        </nav>

        <nav aria-label={t.footerOrder} className="grid content-start justify-items-start gap-3 text-start">
          <h2 className="mb-1 font-heading text-sm font-extrabold text-white">{t.footerOrder}</h2>
          <Link className={footerLinkClass} href={`${homeHref}/cart`}>{t.footerCart}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/checkout`}>{t.footerCheckout}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/login`}>{locale === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/account`}>{locale === 'ar' ? 'حسابك' : 'Account'}</Link>
        </nav>

        <nav aria-label={t.footerRestaurant} className="grid content-start justify-items-start gap-3 text-start">
          <h2 className="mb-1 font-heading text-sm font-extrabold text-white">{t.footerRestaurant}</h2>
          <Link className={footerLinkClass} href={homeHref}>{t.footerHome}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/about`}>{t.about}</Link>
          <Link className={footerLinkClass} href={`${homeHref}/branches`}>{locale === 'ar' ? 'الفروع' : 'Branches'}</Link>
          {catalog.categories.slice(0, 2).map((category) => (
            <Link
              key={category.id}
              className={footerLinkClass}
              href={`${menuHref}?category=${encodeURIComponent(category.id)}`}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 border-t border-white/15 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:pb-5">
        <p>
          <bdi dir="auto">{catalog.merchantName}</bdi>
          <span aria-hidden="true"> · </span>
          <bdi dir="ltr">© {new Date().getFullYear()}</bdi>
        </p>
        <p>{t.footerCredit}</p>
      </div>
    </footer>
  );
}
