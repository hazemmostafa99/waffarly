'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { ArrowUpRight, BadgeCheck, Heart, MapPin, ShoppingBag, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Input, useLocale } from '@waffarly/ui';
import { accountCopy } from './account-copy';
import { AccountPreviewShell } from './account-preview-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerSessionKey, loadCustomer, signOutCustomer } from './data/customer-auth-api';

type AccountFieldProps = {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'email' | 'tel';
};

function AccountField({ id, label, type = 'text', inputMode }: AccountFieldProps) {
  return (
    <label className="grid gap-1.5 text-storefront-support font-bold text-store-ink" htmlFor={id}>
      {label}
      <Input
        autoComplete="off"
        className="h-11 rounded-xl border-store-border bg-white text-start"
        id={id}
        inputMode={inputMode}
        name={id}
        type={type}
      />
    </label>
  );
}

export function StorefrontAccountOverviewPage() {
  const { locale } = useLocale();
  const params = useParams<{ slug: string }>();
  const t = accountCopy(locale);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: customerSessionKey, queryFn: loadCustomer, retry: false });
  const signOut = useMutation({
    mutationFn: signOutCustomer,
    onSuccess: () => queryClient.setQueryData(customerSessionKey, null),
    gcTime: 0,
  });
  const baseHref = `/s/${encodeURIComponent(params.slug)}`;
  const shortcuts: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `${baseHref}/account/profile`, label: t.profile, icon: UserRound },
    { href: `${baseHref}/account/orders`, label: t.orders, icon: ShoppingBag },
    { href: `${baseHref}/account/addresses`, label: t.addresses, icon: MapPin },
  ];

  return (
    <AccountPreviewShell
      active="overview"
      isPreview={!session.data && !session.isPending}
      title={t.overview}
      description={t.overviewIntro}
    >
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="grid content-start gap-4 rounded-2xl border border-store-border bg-store-page p-4 sm:p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-store-cream text-store-primary">
            <BadgeCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-storefront-section font-extrabold text-store-ink">
              {session.isPending
                ? t.loadingAccount
                : session.data
                  ? `${t.signedInAs} ${session.data.displayName ?? session.data.email ?? session.data.phone}`
                  : t.guestTitle}
            </h2>
            <p className="mt-1 text-storefront-support leading-5 text-store-secondary">
              {session.data ? t.connectedAccountNotice : t.guestDescription}
            </p>
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
          ) : (
            <Button
              asChild
              disabled={session.isPending}
              className="w-full bg-store-primary text-white hover:bg-store-primary-dark"
            >
              <Link href={`${baseHref}/login`}>{t.signIn}</Link>
            </Button>
          )}
          {(session.isError || signOut.isError) && (
            <p role="alert" className="text-storefront-support font-bold text-red-700">
              {t.sessionError}
            </p>
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
                {t.previewDescription}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </AccountPreviewShell>
  );
}

export function StorefrontProfilePreviewPage() {
  const { locale } = useLocale();
  const t = accountCopy(locale);
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState('');

  function clearFields() {
    formRef.current?.reset();
    setFeedback('');
  }

  function previewProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.currentTarget.reset();
    setFeedback(t.profileCleared);
  }

  return (
    <AccountPreviewShell active="profile" title={t.profile} description={t.profileIntro}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-store-cream text-store-primary">
            <UserRound className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
              {t.profile}
            </h2>
            <p className="text-storefront-support text-store-muted">{t.profileIntro}</p>
          </div>
        </div>

        <p className="rounded-xl border border-store-gold/40 bg-store-cream px-4 py-3 text-storefront-support leading-5 text-store-secondary">
          {t.profileFieldsNotice}
        </p>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={previewProfile} ref={formRef}>
          <AccountField id="profile-name" label={t.name} />
          <AccountField id="profile-phone" inputMode="tel" label={t.phone} type="tel" />
          <div className="sm:col-span-2">
            <AccountField id="profile-email" inputMode="email" label={t.email} type="email" />
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
    </AccountPreviewShell>
  );
}
