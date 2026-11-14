'use client';

import Image from 'next/image';
import Link, { useStorefrontBasePath } from './storefront-link';
import { usePathname } from 'next/navigation';
import { Gift, Heart, House, Menu, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { Button, LanguageSwitcher } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';

function Brand({ catalog }: { catalog: PublicStorefrontCatalog }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {catalog.logoData ? (
        <Image
          src={catalog.logoData}
          alt=""
          aria-hidden="true"
          width={46}
          height={46}
          unoptimized
          className="size-11 rounded-2xl border border-store-border bg-white object-contain p-1"
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-store-gold text-store-primary-deep shadow-sm">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
      )}
      <span className="grid min-w-0 leading-tight">
        <span className="truncate font-heading text-base font-extrabold text-store-primary-deep sm:text-lg">
          {catalog.merchantName}
        </span>
        <span className="mt-1 truncate text-xs font-bold tracking-[0.12em] text-store-gold">
          WAFFARLY BISTRO
        </span>
      </span>
    </span>
  );
}

export function StorefrontHeader({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const cartCount = useStorefrontStore((state) =>
    state.cart.reduce((total, item) => total + item.quantity, 0),
  );
  const homeHref = useStorefrontBasePath(catalog.slug);
  const menuHref = `${homeHref}/menu`;
  const offersHref = `${homeHref}/offers`;
  const aboutHref = `${homeHref}/about`;
  const cartHref = `${homeHref}/cart`;
  const favoritesHref = `${homeHref}/favorites`;
  const accountHref = `${homeHref}/account`;
  const isHome = pathname === (homeHref || '/');
  const isMenu = pathname === menuHref;
  const isAccount = pathname === accountHref || pathname.startsWith(`${accountHref}/`);

  return (
    <>
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

          <nav aria-label={t.menu} className="hidden items-center gap-8 lg:flex">
            <Link
              href={homeHref || '/'}
              aria-current={isHome ? 'page' : undefined}
              className={`text-sm font-bold transition-colors hover:text-store-accent ${isHome ? 'text-store-accent' : 'text-store-ink'}`}
            >
              {t.home}
            </Link>
            <Link
              href={menuHref}
              aria-current={isMenu ? 'page' : undefined}
              className={`text-sm font-bold transition-colors hover:text-store-accent ${isMenu ? 'text-store-accent' : 'text-store-ink'}`}
            >
              {t.menu}
            </Link>
            <Link
              href={offersHref}
              aria-current={pathname === offersHref ? 'page' : undefined}
              className={`text-sm font-bold transition-colors hover:text-store-accent ${pathname === offersHref ? 'text-store-accent' : 'text-store-ink'}`}
            >
              {t.offers}
            </Link>
            <Link
              href={aboutHref}
              aria-current={pathname === aboutHref ? 'page' : undefined}
              className={`text-sm font-bold transition-colors hover:text-store-accent ${pathname === aboutHref ? 'text-store-accent' : 'text-store-ink'}`}
            >
              {t.about}
            </Link>
            <Link
              href={favoritesHref}
              aria-current={pathname === favoritesHref ? 'page' : undefined}
              className={`text-sm font-bold transition-colors hover:text-store-accent ${pathname === favoritesHref ? 'text-store-accent' : 'text-store-ink'}`}
            >
              {t.favorites}
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href={favoritesHref}
              aria-label={t.favorites}
              className="hidden size-11 items-center justify-center rounded-full text-store-ink transition hover:bg-store-page hover:text-store-accent sm:inline-flex"
            >
              <Heart className="size-5" aria-hidden="true" />
            </Link>
            <Link
              href={accountHref}
              aria-label={t.account}
              aria-current={isAccount ? 'page' : undefined}
              className={`inline-flex size-11 items-center justify-center rounded-full transition ${isAccount ? 'bg-store-primary/10 text-store-primary' : 'text-store-ink hover:bg-store-page hover:text-store-primary-deep'}`}
            >
              <UserRound className="size-5" aria-hidden="true" />
            </Link>
            <LanguageSwitcher className="hidden px-2 text-xs sm:flex sm:px-3" />
            <Button
              asChild
              className="relative size-11 rounded-full bg-transparent p-0 text-store-ink hover:bg-store-page hover:text-store-primary-deep"
              variant="ghost"
            >
              <Link href={cartHref} aria-label={`${t.cart} (${cartCount})`}>
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
          { href: cartHref, title: t.cart, icon: ShoppingBag, active: pathname === cartHref },
          {
            href: favoritesHref,
            title: t.favorites,
            icon: Heart,
            active: pathname === favoritesHref,
          },
          { href: accountHref, title: t.account, icon: UserRound, active: isAccount },
        ].map(({ href, title, icon: Icon, active }) => (
          <Link
            href={href}
            key={href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold transition-colors ${active ? 'text-store-accent' : 'text-store-muted hover:text-store-primary'}`}
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
