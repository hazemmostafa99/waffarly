'use client';

import { StorefrontCartNotice } from '../../features/cart/storefront-cart-notice';
import Image from 'next/image';
import Link, { useStorefrontBasePath } from './storefront-link';
import { useParams, usePathname } from 'next/navigation';
import { storefrontHref } from '../../lib/storefront-address';
import { Gift, Heart, House, Menu, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { Button } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { StorefrontAccountMenu } from '../../features/account/storefront-account-menu';

function Brand({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const logoSize = {
    small: 'size-9',
    medium: 'size-11',
    large: 'size-14',
  }[catalog.logoScale];
  return (
    <span className="flex min-w-0 items-center gap-3">
      {catalog.logoData ? (
        <Image
          src={catalog.logoData}
          alt=""
          aria-hidden="true"
          width={56}
          height={56}
          unoptimized
          className={
            logoSize + ' rounded-2xl border border-store-border bg-white object-contain p-1'
          }
        />
      ) : (
        <span
          className={
            'grid ' +
            logoSize +
            ' shrink-0 place-items-center rounded-2xl bg-store-gold text-store-primary-deep shadow-sm'
          }
        >
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
      )}
      <span className="grid min-w-0 leading-tight">
        <span className="truncate font-heading text-base font-extrabold text-store-primary-deep sm:text-lg">
          {catalog.merchantName}
        </span>
      </span>
    </span>
  );
}

export function StorefrontHeader({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const pathname = usePathname();
  const { slug: routeSlug } = useParams<{ slug: string }>();
  // Rewrites may expose either the public URL or the internal /s/[slug] route.
  const currentPath =
    storefrontHref(storefrontHref(pathname, catalog.slug, true), routeSlug, true).replace(
      /\/+$/,
      '',
    ) || '/';
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const cartCount = useStorefrontStore((state) =>
    state.cart.reduce((total, item) => total + item.quantity, 0),
  );
  const homeHref = useStorefrontBasePath(catalog.slug);
  const menuHref = `${homeHref}/menu`;
  const offersHref = `${homeHref}/offers`;
  const cartHref = `${homeHref}/cart`;
  const favoritesHref = `${homeHref}/favorites`;
  const accountHref = `${homeHref}/account`;
  const isHome = currentPath === '/';
  const isMenu = currentPath === '/menu' || currentPath.startsWith('/products/');
  const isOffers = currentPath === '/offers';
  const isFavorites = currentPath === '/favorites';
  const isCart = currentPath === '/cart' || currentPath === '/checkout';
  const isAccount = currentPath === '/account' || currentPath.startsWith('/account/');
  const desktopLinks = [
    { href: homeHref || '/', label: t.home, active: isHome },
    { href: menuHref, label: t.menu, active: isMenu },
    { href: offersHref, label: t.offers, active: isOffers },
    { href: favoritesHref, label: t.favorites, active: isFavorites },
  ];

  return (
    <>
      <StorefrontCartNotice slug={catalog.slug} />
      <div className="bg-store-primary-deep px-4 py-3 text-center text-xs font-bold leading-[18px] text-white sm:py-[13px] sm:text-sm">
        <Gift className="me-1 inline size-4 text-store-gold" aria-hidden="true" />
        <span className="inline-block max-w-[260px] align-middle leading-[18px] sm:max-w-none">
          {t.announcement.replace('{{name}}', catalog.merchantName)}
        </span>
      </div>
      <header className="sticky top-0 z-40 border-b border-store-border bg-white/95 shadow-[0_4px_22px_rgba(16,45,35,0.04)] backdrop-blur-md">
        <div className="mx-auto flex h-[66px] w-[calc(100%-2rem)] max-w-[1240px] items-center justify-between gap-4 lg:h-[86px]">
          <Link href={homeHref || '/'} aria-label={catalog.merchantName} className="min-w-0">
            <Brand catalog={catalog} />
          </Link>

          <nav aria-label={t.menu} className="hidden items-center gap-1 lg:flex xl:gap-2">
            {desktopLinks.map(({ href, label, active }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-2 text-sm font-bold transition-colors ${
                  active
                    ? 'text-[var(--storefront-gold)]'
                    : 'text-store-ink hover:text-[var(--storefront-gold)]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href={favoritesHref}
              aria-label={t.favorites}
              aria-current={isFavorites ? 'page' : undefined}
              className={`hidden size-11 items-center justify-center rounded-full transition sm:inline-flex ${isFavorites ? 'text-[var(--storefront-gold)]' : 'text-store-ink hover:text-[var(--storefront-gold)]'}`}
            >
              <Heart className="size-5" aria-hidden="true" />
            </Link>
            <StorefrontAccountMenu />
            <Button
              asChild
              className={`relative size-11 rounded-full bg-transparent p-0 hover:bg-transparent hover:text-[var(--storefront-gold)] ${isCart ? 'text-[var(--storefront-gold)]' : 'bg-transparent text-store-ink'}`}
              variant="ghost"
            >
              <Link
                href={cartHref}
                aria-label={`${t.cart} (${cartCount})`}
                aria-current={isCart ? 'page' : undefined}
              >
                <ShoppingBag className="size-5" aria-hidden="true" />
                <span className="absolute -end-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-store-gold px-1 text-xs font-extrabold text-store-primary-deep tabular-nums">
                  {cartCount}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <nav
        aria-label={t.mobileNavigation}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-store-border bg-white/95 px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-8px_28px_rgba(16,45,35,0.08)] backdrop-blur-md lg:hidden"
      >
        {[
          { href: homeHref || '/', title: t.home, icon: House, active: isHome },
          { href: menuHref, title: t.menu, icon: Menu, active: isMenu },
          { href: cartHref, title: t.cart, icon: ShoppingBag, active: isCart },
          {
            href: favoritesHref,
            title: t.favorites,
            icon: Heart,
            active: isFavorites,
          },
          { href: accountHref, title: t.account, icon: UserRound, active: isAccount },
        ].map(({ href, title, icon: Icon, active }) => (
          <Link
            href={href}
            key={href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold transition-colors ${active ? 'text-[var(--storefront-gold)]' : 'text-store-muted hover:text-[var(--storefront-gold)]'}`}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden="true" />
              {href === cartHref && cartCount > 0 && (
                <span className="absolute -end-2 -top-2 grid size-5 place-items-center rounded-full bg-store-gold text-xs font-extrabold text-store-primary-deep">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </span>
            {title}
          </Link>
        ))}
      </nav>
    </>
  );
}
