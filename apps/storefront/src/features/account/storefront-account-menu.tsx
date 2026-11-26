'use client';

import { useState } from 'react';
import { ChevronDown, LogIn, LogOut, ShoppingBag, UserRound } from 'lucide-react';
import { Button, Popover, useLocale } from '@waffarly/ui';
import Link, {
  useStorefrontBasePath,
  useStorefrontSlug,
} from '@/components/storefront/storefront-link';
import { useStorefrontCustomer, useStorefrontSignOut } from './hooks/use-storefront-customer';
import { accountCopy } from './account-copy';
import { StorefrontSignInLink } from './storefront-sign-in-link';

export function StorefrontAccountMenu() {
  const { locale } = useLocale();
  const t = accountCopy(locale);
  const slug = useStorefrontSlug();
  const base = useStorefrontBasePath(slug);
  const session = useStorefrontCustomer();
  const signOut = useStorefrontSignOut();
  const [open, setOpen] = useState(false);
  const customer = session.data;
  const iconClass =
    'inline-flex size-11 items-center justify-center rounded-full text-store-ink transition hover:bg-store-page hover:text-store-primary';

  // Guests get the same menu (with sign in instead of sign out) so they can still
  // reach the orders they placed on this browser without being sent to sign in.
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t.accountNavigation}
      className="w-64 border-store-border bg-white p-2 text-store-ink"
      trigger={(props) =>
        !customer ? (
          <button {...props} aria-label={t.accountNavigation} className={iconClass}>
            <UserRound className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            {...props}
            aria-label={`${t.overview}: ${customer.name}`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-store-primary/10 px-3 font-bold text-store-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary"
          >
            <span
              className="grid size-7 place-items-center rounded-full bg-store-primary text-sm text-white"
              aria-hidden="true"
            >
              {Array.from(customer.name.trim())[0] || <UserRound className="size-4" />}
            </span>
            <span className="hidden max-w-24 truncate text-sm sm:inline">{t.overview}</span>
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        )
      }
    >
      <p className="border-b border-store-border px-3 py-3 text-sm font-bold" dir="auto">
        {customer ? customer.name : t.guestTitle}
      </p>
      <nav aria-label={t.accountNavigation} className="grid gap-1 py-1">
        {[
          { path: '/account', label: t.overview, icon: UserRound },
          { path: '/account/orders', label: t.orders, icon: ShoppingBag },
        ].map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            href={`${base}${path}`}
            tabIndex={0}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold hover:bg-store-page"
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      {!customer ? (
        <StorefrontSignInLink
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-store-primary hover:bg-store-page"
        >
          <LogIn className="size-4" aria-hidden="true" />
          {t.signIn}
        </StorefrontSignInLink>
      ) : (
        <Button
          variant="ghost"
          disabled={signOut.isPending}
          className="w-full justify-start gap-2 rounded-lg"
          onClick={() => signOut.mutate(undefined, { onSuccess: () => setOpen(false) })}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signOut.isPending ? t.signingOut : t.signOut}
        </Button>
      )}
      {signOut.isError && (
        <p role="alert" className="px-3 py-2 text-sm text-store-error">
          {t.sessionConnectionError}
        </p>
      )}
    </Popover>
  );
}
