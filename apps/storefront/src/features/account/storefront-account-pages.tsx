'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link, { useStorefrontSlug } from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { ArrowUpRight, BadgeCheck, Heart, MapPin, ShoppingBag, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Input, useLocale } from '@waffarly/ui';
import { accountCopy } from './account-copy';
import { AccountShell } from './account-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  isStorefrontCustomerNetworkError,
  isStorefrontCustomerServiceUnavailable,
  loadStorefrontCustomer,
  signOutStorefrontCustomer,
  storefrontCustomerSessionKey,
} from './data/storefront-customer-api';

type AccountFieldProps = {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'email' | 'tel';
  required?: boolean;
};

function AccountField({ id, label, type = 'text', inputMode, required = false }: AccountFieldProps) {
  return (
    <label className="grid gap-1.5 text-storefront-support font-bold text-store-ink" htmlFor={id}>
      {label}
      <Input
        autoComplete="off"
        className="h-11 rounded-xl border-store-border bg-white text-start"
        id={id}
        inputMode={inputMode}
        name={id}
        required={required}
        type={type}
      />
    </label>
  );
}

export function StorefrontAccountOverviewPage() {
  const { locale } = useLocale();
  const params = useParams<{ slug: string }>();
  const storefrontSlug = useStorefrontSlug();
  const t = accountCopy(locale);
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: storefrontCustomerSessionKey(storefrontSlug),
    queryFn: () => loadStorefrontCustomer(storefrontSlug),
    retry: false,
  });
  const signOut = useMutation({
    mutationFn: () => signOutStorefrontCustomer(storefrontSlug),
    onSuccess: () => queryClient.setQueryData(storefrontCustomerSessionKey(storefrontSlug), null),
    gcTime: 0,
  });
  const accountError = session.error ?? signOut.error;
  const baseHref = `/s/${encodeURIComponent(params.slug)}`;
  const shortcuts: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `${baseHref}/account/profile`, label: t.profile, icon: UserRound },
    { href: `${baseHref}/account/orders`, label: t.orders, icon: ShoppingBag },
    { href: `${baseHref}/account/addresses`, label: t.addresses, icon: MapPin },
  ];

  return (
    <AccountShell
      active="overview"
      title={t.overview}
      description={t.overviewIntro}
    >
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="grid content-start gap-4 rounded-2xl border border-store-border bg-store-page p-4 sm:p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-store-cream text-store-primary">
            <BadgeCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            {!session.isError && (
              <h2 className="font-heading text-storefront-section font-extrabold text-store-ink">
                {session.isPending
                  ? t.loadingAccount
                  : session.data
                    ? `${t.signedInAs} ${session.data.name}`
                    : t.guestTitle}
              </h2>
            )}
            {!session.isError && (
              <p className="mt-1 text-storefront-support leading-5 text-store-secondary">
                {session.data ? t.connectedAccountNotice : t.guestDescription}
              </p>
            )}
          </div>
          {session.data ? (
            <Button
              className="w-full"
              disabled={signOut.isPending}
              variant="outline"
              onClick={() => signOut.mutate()}
            >
              {signOut.isPending ? t.signingOut : t.signOut}
            </Button>
          ) : session.isError ? null : (
            <Button
              asChild
              disabled={session.isPending}
              className="w-full bg-store-primary text-white hover:bg-store-primary-dark"
            >
              <Link href={`${baseHref}/login`}>{t.signIn}</Link>
            </Button>
          )}
          {(session.isError || signOut.isError) && (
            <div className="grid gap-2">
              <p role="alert" className="text-storefront-support font-bold text-red-700">
                {isStorefrontCustomerServiceUnavailable(accountError)
                  ? t.sessionServiceUnavailable
                  : isStorefrontCustomerNetworkError(accountError)
                    ? t.sessionConnectionError
                    : t.sessionError}
              </p>
              {session.isError && (
                <Button type="button" variant="outline" onClick={() => void session.refetch()}>
                  {t.retry}
                </Button>
              )}
            </div>
          )}
          {signOut.isSuccess && (
            <p role="status" className="text-storefront-support text-store-primary-deep">
              {t.signedOut}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link href={`${baseHref}/favorites`}>
                <Heart className="me-2 size-4" aria-hidden="true" />
                {t.favorites}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${baseHref}/cart`}>
                <ShoppingBag className="me-2 size-4" aria-hidden="true" />
                {t.basket}
              </Link>
            </Button>
          </div>
        </section>

        <nav aria-label={t.accountNavigation} className="grid gap-3 sm:grid-cols-3">
          {shortcuts.map(({ href, label, icon: Icon }) => (
            <Link
              className="group grid min-h-36 content-start gap-3 rounded-2xl border border-store-border bg-white p-4 transition hover:border-store-primary/40 hover:bg-store-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary"
              href={href}
              key={href}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-store-cream text-store-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex items-center justify-between gap-2 font-heading text-storefront-subsection font-extrabold text-store-ink">
                {label}
                <ArrowUpRight
                  className="size-4 shrink-0 text-store-muted transition group-hover:text-store-primary"
                  aria-hidden="true"
                />
              </span>
              <span className="text-storefront-support leading-5 text-store-muted">
                {t.quickLinkDescription}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </AccountShell>
  );
}

export function StorefrontProfilePage() {
  const { locale } = useLocale();
  const t = accountCopy(locale);
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState('');
  const [savedProfile, setSavedProfile] = useState<{ name: string; phone: string; email: string } | null>(null);

  function clearFields() {
    formRef.current?.reset();
    setFeedback('');
    setSavedProfile(null);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSavedProfile({
      name: String(values.get('profile-name') ?? '').trim(),
      phone: String(values.get('profile-phone') ?? '').trim(),
      email: String(values.get('profile-email') ?? '').trim(),
    });
    setFeedback(t.profileSaved);
  }

  return (
    <AccountShell active="profile" title={t.profile} description={t.profileIntro}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <p className="rounded-xl border border-store-gold/40 bg-store-cream px-4 py-3 text-storefront-support leading-5 text-store-secondary">
          {t.profileFieldsNotice}
        </p>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile} ref={formRef}>
          <AccountField id="profile-name" label={t.name} required />
          <AccountField id="profile-phone" inputMode="tel" label={t.phone} required type="tel" />
          <div className="sm:col-span-2">
            <AccountField id="profile-email" inputMode="email" label={t.email} required type="email" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" onClick={clearFields} type="button" variant="outline">
              {t.clearFields}
            </Button>
            <Button
              className="min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
              type="submit"
            >
              {t.reviewProfile}
            </Button>
          </div>
        </form>
        {savedProfile && (
          <dl className="grid gap-3 rounded-2xl border border-store-border bg-store-page p-4 sm:grid-cols-3">
            {[
              [t.name, savedProfile.name],
              [t.phone, savedProfile.phone],
              [t.email, savedProfile.email],
            ].map(([label, value]) => (
              <div className="grid gap-1" key={label}>
                <dt className="text-storefront-caption text-store-muted">{label}</dt>
                <dd className="break-words text-storefront-support font-bold text-store-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {feedback && (
          <p
            aria-live="polite"
            className="rounded-xl bg-store-info px-4 py-3 text-storefront-support text-store-primary-deep"
            role="status"
          >
            {feedback}
          </p>
        )}
      </div>
    </AccountShell>
  );
}
