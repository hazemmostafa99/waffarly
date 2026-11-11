import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  BUSINESS_ACTIVITY_LABELS,
  type MerchantAccountOverview,
  type MerchantAccountProfile,
  type OwnerSubscriptionHistory,
  type SubscriptionPeriodSummary,
  type UpdateMerchantAccountRequest,
} from '@waffarly/contracts';
import { Badge, Button, Card, Dialog, Input, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { ApiError, apiRequest, apiRequestSingle } from '../../lib/api-client.js';
import type { MerchantOutletContext } from '../../lib/merchant-context.js';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge.js';

import { storefrontUrl as buildStorefrontUrl } from '../../lib/storefront-url.js';
const supportPhone = (import.meta.env.VITE_SUPPORT_WHATSAPP || '201044280822').replace(/\D/g, '');
const supportUrl = `https://wa.me/${supportPhone}`;

function Detail({
  label,
  children,
  ltr = false,
}: {
  label: string;
  children: ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="m-0 break-words text-start text-sm font-semibold text-foreground">
        {ltr ? <bdi dir="ltr">{children}</bdi> : children}
      </dd>
    </div>
  );
}

export function AccountPage() {
  const { locale, t, formatNumber, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const { updateProfile } = useOutletContext<MerchantOutletContext>();
  const [account, setAccount] = useState<MerchantAccountOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<'saved' | 'copied' | ''>('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UpdateMerchantAccountRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState<OwnerSubscriptionHistory | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    void apiRequest<MerchantAccountOverview>('/owner/account')
      .then((data) => {
        if (!current) return;
        setAccount(data);
        setClock(Date.now());
        updateProfile({
          merchantName: data.profile.merchantName,
          ownerName: data.profile.ownerName,
          contactPhone: data.profile.contactPhone,
          ownerMobile: data.profile.ownerMobile,
          subscriptionStatus: data.subscription.status,
        });
        setHistory(null);
        setHistoryOpen(false);
      })
      .catch((cause: unknown) => {
        if (current) setError(cause instanceof Error ? cause.message : 'Could not load account.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reload, updateProfile]);

  useEffect(() => {
    // Refresh eligibility and dates after returning to a page left open across expiry.
    const refresh = () => {
      if (document.visibilityState === 'visible') setReload((value) => value + 1);
    };
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const currentCoverageEnd = account?.subscription.currentPeriod?.coverageEndsAt;
  useEffect(() => {
    // Resolve expiry or a prepaid plan transition from the server, even if the tab stays open.
    if (!editing && currentCoverageEnd && new Date(currentCoverageEnd).getTime() <= clock)
      setReload((value) => value + 1);
  }, [clock, currentCoverageEnd, editing]);

  const date = (value: string | null | undefined) =>
    value
      ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
          dateStyle: 'medium',
          timeZone: 'Africa/Cairo',
        }).format(new Date(value))
      : text('Not recorded', 'غير مسجل');
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Cairo',
    }).format(new Date(value));
  // Preserve decimal strings from the API; do not calculate money using floating point.
  const money = (value: string) => {
    const [whole, fraction] = value.split('.');
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction ?? '00'} ${text('EGP', 'ج.م')}`;
  };
  const duration = (months: number) =>
    `${formatNumber(months)} ${text(months === 1 ? 'month' : 'months', months === 1 || months > 10 ? 'شهر' : 'أشهر')}`;

  function edit() {
    if (!account) return;
    const p = account.profile;
    setDraft({
      merchantName: p.merchantName,
      ownerName: p.ownerName,
      contactPhone: p.contactPhone,
      ownerMobile: p.ownerMobile,
      revision: p.revision,
    });
    setSaveError('');
    setConflict(false);
    setNotice('');
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await apiRequest<MerchantAccountProfile>('/owner/account', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setAccount((current) => (current ? { ...current, profile: saved } : current));
      updateProfile({
        merchantName: saved.merchantName,
        ownerName: saved.ownerName,
        contactPhone: saved.contactPhone,
        ownerMobile: saved.ownerMobile,
      });
      setEditing(false);
      setNotice('saved');
    } catch (cause) {
      setConflict(cause instanceof ApiError && cause.statusCode === 409);
      setSaveError(cause instanceof Error ? cause.message : 'Could not save account.');
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('copied');
      setError('');
    } catch {
      setError('Could not copy. Select and copy the text manually.');
    }
  }

  async function loadHistory() {
    if (historyLoading) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const cursor = history?.nextCursor;
      const result = await apiRequestSingle<OwnerSubscriptionHistory>(
        `/owner/account/subscription/periods${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setHistory((current) => ({
        items: cursor && current ? [...current.items, ...result.items] : result.items,
        nextCursor: result.nextCursor,
      }));
    } catch (cause) {
      setHistoryError(
        cause instanceof Error ? cause.message : 'Could not load subscription history.',
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  function periodDetails(period: SubscriptionPeriodSummary) {
    return (
      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
        <Detail label={text('Duration', 'المدة')}>{duration(period.months)}</Detail>
        <Detail label={text('Period price', 'سعر الفترة')}>{money(period.price)}</Detail>
        <Detail label={text('Recorded collection', 'المبلغ المسجل تحصيله')}>
          {money(period.collected)}
        </Detail>
        <Detail label={text('Starts on', 'بداية الفترة')}>{date(period.startsAt)}</Detail>
        <Detail label={text('Coverage ends', 'نهاية التغطية')}>
          {dateTime(period.coverageEndsAt)}
        </Detail>
        {period.credit !== '0.00' && (
          <Detail label={text('Applied credit', 'الرصيد المستخدم')}>{money(period.credit)}</Detail>
        )}
        {period.endsAt !== period.coverageEndsAt && (
          <Detail label={text('Original end date', 'نهاية الفترة الأصلية')}>
            {date(period.endsAt)}
          </Detail>
        )}
      </dl>
    );
  }

  if (loading)
    return (
      <div
        className="mx-auto max-w-6xl space-y-5 text-foreground"
        role="status"
        aria-label={text('Loading account', 'جارٍ تحميل الحساب')}
      >
        <div className="h-9 w-40 animate-pulse rounded-lg bg-border" />
        <Card className="h-40 animate-pulse bg-card" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="h-72 animate-pulse bg-card" />
          <Card className="h-72 animate-pulse bg-card" />
        </div>
      </div>
    );

  if (!account)
    return (
      <Card className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="m-0 text-2xl font-bold">{text('My account', 'حسابي')}</h1>
        <p className="m-0 max-w-none text-sm text-destructive" role="alert">
          {errorText(error)}
        </p>
        <Button onClick={() => setReload((value) => value + 1)}>
          {text('Try again', 'حاول مرة أخرى')}
        </Button>
      </Card>
    );

  const { profile, subscription } = account;
  const current = subscription.currentPeriod;
  const displayedPeriod = current ?? subscription.latestPeriod;
  const canEdit = subscription.status === 'active' || subscription.status === 'legacy';
  const storefrontUrl = buildStorefrontUrl(profile.storefrontSlug, profile.storefrontHandle);
  const remainingMs = subscription.coverageEndsAt
    ? new Date(subscription.coverageEndsAt).getTime() - clock
    : 0;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86_400_000));
  const expiring = subscription.status === 'active' && remainingMs > 0 && daysLeft <= 7;

  return (
    <div className="mx-auto max-w-6xl space-y-4 text-foreground" data-testid="merchant-account">
      <div className="flex flex-wrap items-start justify-end gap-4">
        <h1 className="sr-only">{text('My account', 'حسابي')}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNotice('');
            setReload((value) => value + 1);
          }}
        >
          <Icon name="calendar" />
          {text('Refresh details', 'تحديث البيانات')}
        </Button>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-primary/20 bg-waffarly-success-bg px-4 py-3 text-sm text-primary"
        >
          {notice === 'saved'
            ? text('Account details saved.', 'تم حفظ بيانات الحساب.')
            : text('Copied to clipboard.', 'تم النسخ.')}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-waffarly-danger-bg p-4 text-sm text-destructive"
        >
          {errorText(error)}
        </div>
      )}

      <Card
        className="relative overflow-hidden p-5 sm:p-7"
        aria-label={text('Account overview', 'ملخص الحساب')}
      >
        <div className="absolute inset-y-0 start-0 w-1 bg-primary" aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-primary/5 text-2xl font-bold text-primary">
              {profile.logoData ? (
                <img
                  className="size-full object-contain p-2"
                  src={profile.logoData}
                  alt={text('Store logo', 'شعار المتجر')}
                />
              ) : (
                profile.merchantName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h2 className="m-0 break-words text-xl font-bold text-foreground">
                {profile.merchantName}
              </h2>
              <p className="m-0 max-w-none break-words text-sm text-muted-foreground">
                {profile.ownerName} · {t(BUSINESS_ACTIVITY_LABELS[profile.activity])}
              </p>
              <span className="text-xs text-muted-foreground">
                {text('Member since', 'تاريخ الانضمام')} {date(profile.createdAt)}
              </span>
            </div>
          </div>
          <SubscriptionStatusBadge status={subscription.status} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Icon name="shield" />
            <span>{text('Account reference', 'الرقم المرجعي للحساب')}</span>
            <bdi className="break-all font-mono text-foreground">{profile.merchantId}</bdi>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void copy(profile.merchantId)}>
            <Icon name="copy" />
            {text('Copy reference', 'نسخ الرقم المرجعي')}
          </Button>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6" aria-labelledby="account-details-heading">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <Icon name="customers" />
                </span>
                <h2 id="account-details-heading" className="m-0 text-lg font-bold">
                  {text('Business & owner', 'النشاط وصاحب الحساب')}
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={edit} disabled={!canEdit}>
                {text('Edit details', 'تعديل البيانات')}
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Detail label={text('Business name', 'اسم النشاط')}>{profile.merchantName}</Detail>
              <Detail label={text('Business activity', 'نوع النشاط')}>
                {t(BUSINESS_ACTIVITY_LABELS[profile.activity])}
              </Detail>
              <Detail label={text('Business phone', 'رقم تواصل المحل')} ltr>
                {profile.contactPhone}
              </Detail>
              <Detail label={text('Owner name', 'اسم صاحب الحساب')}>{profile.ownerName}</Detail>
              <Detail label={text('Owner mobile', 'موبايل صاحب الحساب')} ltr>
                {profile.ownerMobile}
              </Detail>
              <Detail label={text('Username', 'اسم المستخدم')} ltr>
                {profile.username}
              </Detail>
            </dl>
            <p className="mb-0 mt-6 max-w-none rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
              {text(
                'Your business name and business phone are visible to customers. Your owner mobile is for account contact.',
                'اسم النشاط ورقم المحل بيظهروا للعملاء. موبايل صاحب الحساب مخصص للتواصل بخصوص الحساب.',
              )}
            </p>
            {!canEdit && (
              <p className="mb-0 mt-3 text-xs text-muted-foreground">
                {text(
                  'Contact Waffarly to reactivate your subscription before editing details.',
                  'تواصل مع وفّرلي لإعادة تفعيل الاشتراك قبل تعديل البيانات.',
                )}
              </p>
            )}
            {profile.updatedAt && (
              <p className="mb-0 mt-3 text-xs text-muted-foreground">
                {text('Last updated', 'آخر تعديل')}: {dateTime(profile.updatedAt)}
              </p>
            )}
          </Card>

          <Card className="space-y-5 p-5 sm:p-6" aria-labelledby="account-storefront-heading">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <Icon name="store" />
              </span>
              <div>
                <h2 id="account-storefront-heading" className="m-0 text-lg font-bold">
                  {text('Your online store', 'متجرك الإلكتروني')}
                </h2>
                <p className="m-0 mt-1 text-xs text-muted-foreground">
                  {text('Share this link with your customers.', 'شارك الرابط ده مع عملائك.')}
                </p>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-background p-4">
              <span className="text-xs text-muted-foreground">
                {text('Storefront slug / POS business code', 'الـslug / كود النشاط لنقاط البيع')}
              </span>
              <div className="break-all font-mono text-sm font-semibold" dir="ltr">
                {profile.storefrontSlug}
              </div>
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sm text-primary underline decoration-primary/30 underline-offset-4"
                dir="ltr"
              >
                {storefrontUrl}
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" size="sm" asChild>
                <a href={storefrontUrl} target="_blank" rel="noreferrer">
                  <Icon name="store" />
                  {text('Open store', 'فتح المتجر')}
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copy(storefrontUrl)}>
                <Icon name="copy" />
                {text('Copy link', 'نسخ الرابط')}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/settings#settings-identity">{text('Store design', 'تصميم المتجر')}</Link>
              </Button>
            </div>
            <p className="m-0 max-w-none text-xs text-muted-foreground">
              {text(
                'This code is also used by employees to sign in to POS. Contact support if it needs changing.',
                'الكود ده بيستخدمه الموظفون كمان للدخول لنقاط البيع. لو محتاج تغييره، تواصل مع الدعم.',
              )}
            </p>
          </Card>
        </div>

        <Card
          className="min-w-0 overflow-hidden p-0"
          aria-labelledby="account-subscription-heading"
        >
          <div className="space-y-4 border-b border-border bg-primary/5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-primary">
                <Icon name="receipt" />
                <h2 id="account-subscription-heading" className="m-0 text-lg font-bold">
                  {text('Your subscription', 'اشتراكك')}
                </h2>
              </div>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                {current
                  ? text('Current plan', 'الباقة الحالية')
                  : displayedPeriod
                    ? text('Last paid plan', 'آخر باقة مدفوعة')
                    : text('Assigned plan', 'الباقة المحددة')}
              </span>
              <h3 className="m-0 mt-1 break-words text-2xl font-bold text-foreground">
                {displayedPeriod?.planName ??
                  subscription.assignedPlanName ??
                  text('No plan assigned', 'لم يتم تحديد باقة')}
              </h3>
            </div>
            {subscription.status === 'active' && subscription.coverageEndsAt && (
              <div className="flex items-end gap-2">
                <strong className="text-4xl font-bold tracking-tight text-primary">
                  {formatNumber(daysLeft)}
                </strong>
                <span className="pb-1 text-sm text-muted-foreground">
                  {text('days of paid coverage left', 'يوم متبقي في التغطية المدفوعة')}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-6 p-5 sm:p-6">
            {expiring && (
              <div
                role="status"
                className="rounded-xl bg-waffarly-warning-bg p-3 text-sm text-waffarly-gold-ink"
              >
                {text(
                  'Your subscription ends soon. Contact us to arrange renewal.',
                  'اشتراكك قرب ينتهي. تواصل معانا لترتيب التجديد.',
                )}
              </div>
            )}
            {subscription.status === 'legacy' && (
              <p className="m-0 max-w-none rounded-xl bg-waffarly-info-bg p-4 text-sm text-waffarly-info">
                {text(
                  'Your existing account remains available. Waffarly is reviewing its subscription details; no expiry or payment amount has been assumed.',
                  'حسابك الحالي متاح. وفّرلي بتراجع تفاصيل الاشتراك؛ مفيش تاريخ انتهاء أو مبلغ مفترض.',
                )}
              </p>
            )}
            {subscription.status === 'pending' && (
              <p className="m-0 max-w-none text-sm text-muted-foreground">
                {text(
                  'Your subscription is awaiting activation. An assigned plan does not confirm payment or activate access.',
                  'اشتراكك في انتظار التفعيل. تحديد الباقة وحده مش تأكيد للدفع أو تفعيل للاشتراك.',
                )}
              </p>
            )}
            {subscription.status === 'suspended' && (
              <p className="m-0 max-w-none text-sm text-destructive">
                {text(
                  'Your subscription is suspended. Time continues to run. Contact Waffarly to restore access.',
                  'اشتراكك موقوف والمدة مستمرة. تواصل مع وفّرلي لإعادة التفعيل.',
                )}
              </p>
            )}
            {(subscription.status === 'expired' || subscription.status === 'cancelled') && (
              <p className="m-0 max-w-none text-sm text-destructive">
                {text(
                  'New operations are unavailable. You can review records and finish existing work. Contact us to renew or reactivate.',
                  'العمليات الجديدة غير متاحة. تقدر تراجع السجلات وتكمّل الشغل القائم. تواصل معانا للتجديد أو إعادة التفعيل.',
                )}
              </p>
            )}
            {displayedPeriod
              ? periodDetails(displayedPeriod)
              : subscription.assignedMonths && (
                  <dl>
                    <Detail label={text('Assigned duration', 'المدة المحددة')}>
                      {duration(subscription.assignedMonths)}
                    </Detail>
                  </dl>
                )}
            {subscription.coverageEndsAt && (
              <div className="rounded-xl border border-border p-4">
                <span className="text-xs text-muted-foreground">
                  {text('Paid coverage through', 'التغطية المدفوعة حتى')}
                </span>
                <div className="mt-1 text-sm font-semibold">
                  {dateTime(subscription.coverageEndsAt)}
                </div>
                <p className="m-0 mt-2 max-w-none text-xs text-muted-foreground">
                  {text(
                    'All dates and times use Cairo time.',
                    'كل التواريخ والمواعيد بتوقيت القاهرة.',
                  )}
                </p>
              </div>
            )}
            {subscription.nextPeriod && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <Badge variant="success">{text('Prepaid next period', 'فترة قادمة مدفوعة')}</Badge>
                <div className="break-words text-sm font-bold">
                  {subscription.nextPeriod.planName} · {duration(subscription.nextPeriod.months)}
                </div>
                <p className="m-0 max-w-none text-xs text-muted-foreground">
                  {dateTime(subscription.nextPeriod.startsAt)} —{' '}
                  {dateTime(subscription.nextPeriod.coverageEndsAt)}
                </p>
              </div>
            )}
            {subscription.cancelAtEnd && (
              <p className="m-0 max-w-none rounded-xl bg-waffarly-warning-bg p-3 text-sm text-waffarly-gold-ink">
                {text(
                  'Cancellation is scheduled at the end of paid coverage. Additional renewal is disabled.',
                  'تم تحديد الإلغاء بنهاية التغطية المدفوعة. التجديد الإضافي متوقف.',
                )}
              </p>
            )}
            <div className="space-y-3 border-t border-border pt-5">
              <Button variant="solid" asChild className="w-full whitespace-normal">
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  <Icon name="phone" />
                  {text('Renew or change plan on WhatsApp', 'تجديد أو تغيير الباقة عبر واتساب')}
                </a>
              </Button>
              <p className="m-0 max-w-none text-center text-xs text-muted-foreground">
                {text(
                  'Renewal and collection are arranged manually with Waffarly. No automatic charge.',
                  'التجديد والتحصيل بيتموا مع وفّرلي يدويًا. مفيش خصم تلقائي.',
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6" aria-labelledby="account-history-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="account-history-heading" className="m-0 text-lg font-bold">
              {text('Subscription history', 'سجل الاشتراك')}
            </h2>
            <p className="m-0 mt-1 max-w-none text-sm text-muted-foreground">
              {text(
                'Your recorded subscription periods and collections.',
                'فترات اشتراكك والمبالغ المسجل تحصيلها.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={historyOpen}
            aria-controls="account-history"
            onClick={() => {
              setHistoryOpen(!historyOpen);
              if (!historyOpen && !history) void loadHistory();
            }}
          >
            {historyOpen ? text('Hide history', 'إخفاء السجل') : text('View history', 'عرض السجل')}
          </Button>
        </div>
        {historyOpen && (
          <div id="account-history" className="mt-5 space-y-4 border-t border-border pt-5">
            {history?.items.map((period) => (
              <article key={period.id} className="space-y-4 rounded-xl border border-border p-4">
                <h3 className="m-0 text-base font-bold">{period.planName}</h3>
                {periodDetails(period)}
              </article>
            ))}
            {history?.items.length === 0 && (
              <p className="m-0 text-sm text-muted-foreground">
                {text(
                  'No paid subscription periods are recorded yet.',
                  'لا توجد فترات اشتراك مدفوعة مسجلة حتى الآن.',
                )}
              </p>
            )}
            {historyLoading && (
              <p role="status" className="m-0 text-sm text-muted-foreground">
                {text('Loading history…', 'جارٍ تحميل السجل…')}
              </p>
            )}
            {historyError && (
              <div role="alert" className="space-y-3">
                <p className="m-0 text-sm text-destructive">{errorText(historyError)}</p>
                <Button
                  variant="outline"
                  onClick={() => void loadHistory()}
                  disabled={historyLoading}
                >
                  {text('Try again', 'حاول مرة أخرى')}
                </Button>
              </div>
            )}
            {history?.nextCursor && !historyError && (
              <Button
                variant="outline"
                onClick={() => void loadHistory()}
                disabled={historyLoading}
              >
                {text('Load older periods', 'عرض فترات أقدم')}
              </Button>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-primary">
            <Icon name="help" />
          </span>
          <div>
            <strong>{text('Need a hand with your account?', 'محتاج مساعدة في حسابك؟')}</strong>
            <p className="m-0 mt-1 max-w-none text-xs text-muted-foreground">
              {text(
                'Keep your account reference handy when contacting support.',
                'احتفظ بالرقم المرجعي لحسابك عند التواصل مع الدعم.',
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <a href={supportUrl} target="_blank" rel="noreferrer">
            {text('WhatsApp support', 'دعم واتساب')}
          </a>
        </Button>
      </div>

      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!saving) setEditing(open);
        }}
        title={text('Edit account details', 'تعديل بيانات الحساب')}
        description={text(
          'Keep your business and owner contact details up to date.',
          'حدّث بيانات نشاطك والتواصل مع صاحب الحساب.',
        )}
        closeLabel={text('Close', 'إغلاق')}
      >
        {draft && (
          <form onSubmit={(event) => void save(event)} className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['merchantName', text('Business name', 'اسم النشاط'), 'text', 160],
                  ['ownerName', text('Owner name', 'اسم صاحب الحساب'), 'text', 160],
                  ['contactPhone', text('Business phone', 'رقم تواصل المحل'), 'tel', 32],
                  ['ownerMobile', text('Owner mobile', 'موبايل صاحب الحساب'), 'tel', 32],
                ] as const
              ).map(([key, label, type, maxLength]) => (
                <label key={key} className="space-y-2 text-sm font-medium">
                  <span>{label}</span>
                  <Input
                    autoComplete={
                      key === 'merchantName' ? 'organization' : key === 'ownerName' ? 'name' : 'tel'
                    }
                    type={type}
                    dir={type === 'tel' ? 'ltr' : undefined}
                    className={locale === 'ar' ? 'text-right' : 'text-left'}
                    minLength={type === 'tel' ? 3 : 1}
                    maxLength={maxLength}
                    required
                    disabled={saving}
                    value={draft[key]}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  />
                </label>
              ))}
            </div>
            {saveError && (
              <p
                role="alert"
                className="m-0 max-w-none rounded-xl bg-waffarly-danger-bg p-3 text-sm text-destructive"
              >
                {conflict
                  ? text(
                      'These details changed in another session. Refresh the account before editing again. Your draft has not been saved.',
                      'البيانات اتغيرت في جلسة تانية. حدّث الحساب قبل التعديل مرة تانية. المسودة لم تُحفظ.',
                    )
                  : errorText(saveError)}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                {text('Cancel', 'إلغاء')}
              </Button>
              {conflict ? (
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setReload((value) => value + 1);
                  }}
                >
                  {text('Refresh account', 'تحديث الحساب')}
                </Button>
              ) : (
                <Button type="submit" variant="solid" disabled={saving}>
                  {saving ? text('Saving…', 'جارٍ الحفظ…') : text('Save changes', 'حفظ التغييرات')}
                </Button>
              )}
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
