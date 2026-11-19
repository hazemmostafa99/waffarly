'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { ArrowUpRight, BadgeCheck, Heart, MapPin, ShoppingBag, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Input, useLocale } from '@waffarly/ui';
import { accountCopy } from './account-copy';
import { AccountShell } from './account-shell';
import { useStorefrontCustomer, useStorefrontSignOut } from './hooks/use-storefront-customer';
import { StorefrontSignInLink } from './storefront-sign-in-link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStorefrontSlug } from '../../components/storefront/storefront-link';
import { ApiError } from '@/lib/api-client';
import {
  isStorefrontCustomerNetworkError,
  isStorefrontCustomerServiceUnavailable,
  storefrontCustomerSessionKey,
  updateStorefrontCustomerProfile,
} from './data/storefront-customer-api';

type AccountFieldProps = {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'email' | 'tel';
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  dir?: 'auto' | 'ltr';
};

function AccountField({
  id,
  label,
  type = 'text',
  inputMode,
  required = false,
  value,
  onChange,
  dir = 'auto',
}: AccountFieldProps) {
  const { locale } = useLocale();
  return (
    <label className="grid gap-1.5 text-storefront-support font-bold text-store-ink" htmlFor={id}>
      {label}
      <Input
        autoComplete="off"
        className="h-11 rounded-xl border-store-border bg-white text-start"
        dir={dir}
        style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
        id={id}
        inputMode={inputMode}
        name={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

export function StorefrontAccountOverviewPage() {
  const { locale } = useLocale();
  const params = useParams<{ slug: string }>();
  const t = accountCopy(locale);
  const session = useStorefrontCustomer();
  const signOut = useStorefrontSignOut();
  const accountError = session.error ?? signOut.error;
  const baseHref = `/s/${encodeURIComponent(params.slug)}`;
  const shortcuts: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `${baseHref}/account/profile`, label: t.profile, icon: UserRound },
    { href: `${baseHref}/account/orders`, label: t.orders, icon: ShoppingBag },
    { href: `${baseHref}/account/addresses`, label: t.addresses, icon: MapPin },
  ];

  return (
    <AccountShell active="overview" title={t.overview} description={t.overviewIntro}>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="grid content-start gap-4 rounded-2xl border border-store-border bg-store-page p-4 sm:p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-store-cream text-store-primary">
            <BadgeCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            {!session.isError && (
              <p className="text-sm font-bold text-store-ink">
                {session.isPending
                  ? t.loadingAccount
                  : session.data
                    ? `${t.signedInAs} ${session.data.name}`
                    : t.guestTitle}
              </p>
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
              <StorefrontSignInLink>{t.signIn}</StorefrontSignInLink>
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
  const slug = useStorefrontSlug();
  const session = useStorefrontCustomer();
  const queryClient = useQueryClient();
  const edited = useRef(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<{
    name: string;
    phone: string;
    email: string;
    currentPassword: string;
  }>({ name: '', phone: '', email: '', currentPassword: '' });
  const saveProfile = useMutation({
    mutationFn: () => {
      if (!session.data) throw new Error(t.sessionError);
      const emailChanged = fields.email.trim().toLowerCase() !== session.data.email;
      const phoneChanged = fields.phone.trim() !== session.data.phone;
      return updateStorefrontCustomerProfile(slug, {
        revision: session.data.revision,
        name: fields.name.trim(),
        ...(emailChanged ? { email: fields.email.trim() } : {}),
        ...(phoneChanged ? { phone: fields.phone.trim() } : {}),
        ...(emailChanged || phoneChanged ? { currentPassword: fields.currentPassword } : {}),
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(storefrontCustomerSessionKey(slug), profile);
      edited.current = false;
      setFields({
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        currentPassword: '',
      });
      setError('');
      setFeedback(t.profileSaved);
    },
    onError: (cause) => {
      setFeedback('');
      setFields((current) => ({ ...current, currentPassword: '' }));
      setError(
        cause instanceof ApiError && cause.statusCode === 409
          ? t.profileConflict
          : cause instanceof ApiError && cause.statusCode === 401
            ? t.invalidCredentials
            : cause instanceof ApiError && cause.statusCode === 400
              ? t.profileInvalid
              : t.sessionConnectionError,
      );
    },
  });

  useEffect(() => {
    if (!session.data || edited.current) return;
    setFields((current) => ({
      ...current,
      name: session.data.name,
      phone: session.data.phone,
      email: session.data.email,
    }));
  }, [session.data]);

  function updateField(key: keyof typeof fields, value: string) {
    edited.current = true;
    setFields((current) => ({ ...current, [key]: value }));
    setFeedback('');
    setError('');
  }

  const contactChanged = Boolean(
    session.data &&
    (fields.email.trim().toLowerCase() !== session.data.email ||
      fields.phone.trim() !== session.data.phone),
  );

  return (
    <AccountShell active="profile" title={t.profile} description={t.profileIntro}>
      <div className="mx-auto grid max-w-3xl gap-5">
        {session.isPending ? (
          <p role="status">{t.loadingAccount}</p>
        ) : session.isError ? (
          <div className="grid gap-3" role="alert">
            <p>
              {isStorefrontCustomerServiceUnavailable(session.error)
                ? t.sessionServiceUnavailable
                : t.sessionConnectionError}
            </p>
            <Button type="button" variant="outline" onClick={() => void session.refetch()}>
              {t.retry}
            </Button>
          </div>
        ) : !session.data ? (
          <div className="grid gap-3">
            <p>{t.guestDescription}</p>
            <Button asChild className="w-fit bg-store-primary text-white">
              <StorefrontSignInLink>{t.signIn}</StorefrontSignInLink>
            </Button>
          </div>
        ) : (
          <>
            <p className="rounded-xl border border-store-gold/40 bg-store-cream px-4 py-3 text-storefront-support leading-5 text-store-secondary">
              {t.profileFieldsNotice}
            </p>

            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveProfile.mutate();
              }}
            >
              <AccountField
                id="profile-name"
                label={t.name}
                required
                value={fields.name}
                onChange={(value) => updateField('name', value)}
              />
              <AccountField
                id="profile-phone"
                inputMode="tel"
                label={t.phone}
                required
                type="tel"
                dir="ltr"
                value={fields.phone}
                onChange={(value) => updateField('phone', value)}
              />
              <div className="sm:col-span-2">
                <AccountField
                  id="profile-email"
                  inputMode="email"
                  label={t.email}
                  required
                  type="email"
                  dir="ltr"
                  value={fields.email}
                  onChange={(value) => updateField('email', value)}
                />
              </div>
              {contactChanged && (
                <div className="sm:col-span-2">
                  <AccountField
                    id="profile-current-password"
                    label={t.currentPassword}
                    type="password"
                    required
                    value={fields.currentPassword}
                    onChange={(value) => updateField('currentPassword', value)}
                    dir="ltr"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                <Button
                  className="min-h-11"
                  onClick={() => {
                    if (session.data)
                      setFields({
                        name: session.data.name,
                        phone: session.data.phone,
                        email: session.data.email,
                        currentPassword: '',
                      });
                    edited.current = false;
                    setError('');
                    setFeedback('');
                    saveProfile.reset();
                  }}
                  type="button"
                  variant="outline"
                >
                  {t.discardChanges}
                </Button>
                <Button
                  className="min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
                  type="submit"
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending
                    ? locale === 'ar'
                      ? 'جارٍ الحفظ…'
                      : 'Saving…'
                    : t.reviewProfile}
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
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </AccountShell>
  );
}
