'use client';

import Image from 'next/image';
import Link, {
  useStorefrontBasePath,
  useStorefrontSlug,
} from '../components/storefront/storefront-link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Utensils } from 'lucide-react';
import { Button, Card, Input, useLocale } from '@waffarly/ui';
import type { Locale } from '@waffarly/ui';
import type { CustomerSignInRequest, CustomerSignUpRequest } from '@waffarly/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicStorefrontCatalog, StorefrontOrderReceipt } from '@waffarly/contracts';
import { StorefrontProductGrid } from './catalog/storefront-product-grid';
import { useRestaurantFulfillment } from './delivery/restaurant-route-fields';
import { loadStorefrontOrderReceipt } from './orders/storefront-order-receipt-session';
import { formatStorefrontPrice } from '../lib/storefront-format';
import { ApiError } from '@/lib/api-client';
import { useStorefrontStore } from '@/providers/storefront-providers';
import { useStorefrontCustomer } from './account/hooks/use-storefront-customer';
import { storefrontReturnPath } from './account/storefront-sign-in-link';
import {
  isStorefrontCustomerNetworkError,
  isStorefrontCustomerServiceUnavailable,
  loadStorefrontCustomer,
  signInStorefrontCustomer,
  signUpStorefrontCustomer,
  storefrontCustomerSessionKey,
} from '@/features/account/data/storefront-customer-api';

type StorefrontPageCopy = {
  home: string;
  openMenu: string;
  offersTitle: string;
  offersIntro: string;
  filterAll: string;
  branchesTitle: string;
  branchesIntro: string;
  chooseBranch: string;
  aboutTitle: string;
  trackingTitle: string;
  trackingIntro: string;
  trackingSnapshotNote: string;
  accountTitle: string;
  loginTitle: string;
  signIn: string;
  register: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  continueLabel: string;
  loadingAccount: string;
  signedInAs: string;
  signOut: string;
  signingOut: string;
  signInSuccess: string;
  signUpSuccess: string;
  signOutSuccess: string;
  passwordMismatch: string;
  invalidCredentials: string;
  duplicateAccount: string;
  tooManyAttempts: string;
  invalidForm: string;
  authUnavailable: string;
  connectionError: string;
  retry: string;
  noOffers: string;
  localDataNote: string;
  noBranches: string;
  branchesError: string;
  loadingBranches: string;
  noOrderInSession: string;
  orderStatus: string;
  orderDate: string;
  orderTotal: string;
  branch: string;
  orderNumber: string;
  availableForPickup: string;
  availableForDelivery: string;
  branchUnavailable: string;
  selectedBranch: string;
  noDescription: string;
};

const copy: Record<'ar' | 'en', StorefrontPageCopy> = {
  ar: {
    home: 'الرئيسية',
    openMenu: 'استكشف القائمة',
    offersTitle: 'العروض',
    offersIntro: 'المنتجات التي عليها تخفيض حالي في قائمة المطعم.',
    filterAll: 'الكل',
    branchesTitle: 'فروعنا',
    branchesIntro: 'اختر فرعًا متاحًا للاستلام أو التوصيل.',
    chooseBranch: 'الاستلام من الفرع',
    aboutTitle: 'عن المطعم',
    trackingTitle: 'متابعة الطلب',
    trackingIntro: 'تابع آخر حالة متاحة للطلب في جلسة التصفح الحالية.',
    trackingSnapshotNote: 'هذه آخر حالة وصلت في إيصال الطلب، وقد لا تشمل تحديثات لاحقة.',
    accountTitle: 'حسابك',
    loginTitle: 'تسجيل الدخول',
    signIn: 'تسجيل الدخول',
    register: 'إنشاء حساب جديد',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    continueLabel: 'متابعة',
    loadingAccount: 'جارٍ التحقق من جلسة حسابك…',
    signedInAs: 'تم تسجيل الدخول باسم',
    signOut: 'تسجيل الخروج',
    signingOut: 'جارٍ تسجيل الخروج…',
    signInSuccess: 'تم تسجيل الدخول بنجاح.',
    signUpSuccess: 'تم إنشاء حسابك وتسجيل الدخول بنجاح.',
    signOutSuccess: 'تم تسجيل الخروج.',
    passwordMismatch: 'كلمتا المرور غير متطابقتين.',
    invalidCredentials: 'البريد الإلكتروني أو رقم الموبايل أو كلمة المرور غير صحيحة.',
    duplicateAccount: 'يوجد حساب بهذه البيانات بالفعل. سجّل الدخول بدلًا من إنشاء حساب جديد.',
    tooManyAttempts: 'محاولات كثيرة في وقت قصير. حاول مرة أخرى لاحقًا.',
    invalidForm: 'راجع البريد والموبايل وكلمة المرور، ثم حاول مرة أخرى.',
    authUnavailable: 'خدمة الحسابات غير متاحة حاليًا. حاول مرة أخرى بعد قليل.',
    connectionError: 'تعذّر الاتصال. تحقق من الشبكة وحاول مرة أخرى.',
    retry: 'إعادة المحاولة',
    noOffers: 'لا توجد عروض حالية على القائمة.',
    localDataNote:
      'اختيار فرع هنا يحدد فرع الاستلام لطلبك. للتوصيل، اختار منطقتك من خيارات الاستلام فوق.',
    noBranches: 'لا توجد فروع متاحة حاليًا.',
    branchesError: 'تعذّر تحميل الفروع. حاول مرة أخرى.',
    loadingBranches: 'جارٍ تحميل الفروع…',
    noOrderInSession: 'بيانات الطلب غير موجودة في جلسة التصفح الحالية.',
    orderStatus: 'آخر حالة للطلب',
    orderDate: 'تاريخ الطلب',
    orderTotal: 'إجمالي الطلب',
    branch: 'الفرع',
    orderNumber: 'رقم الطلب',
    availableForPickup: 'استلام',
    availableForDelivery: 'توصيل',
    branchUnavailable: 'غير متاح الآن',
    selectedBranch: 'فرع الاستلام المختار',
    noDescription: 'لم يضف المطعم وصفًا بعد.',
  },
  en: {
    home: 'Home',
    openMenu: 'Explore the menu',
    offersTitle: 'Offers',
    offersIntro: 'Products with an active discount on the restaurant menu.',
    filterAll: 'All',
    branchesTitle: 'Our branches',
    branchesIntro: 'Choose a branch available for pickup or delivery.',
    chooseBranch: 'Pick up from this branch',
    aboutTitle: 'About the restaurant',
    trackingTitle: 'Track an order',
    trackingIntro: 'See the latest order status available in this browsing session.',
    trackingSnapshotNote:
      'This is the latest status saved on the receipt and may not include later updates.',
    accountTitle: 'Your account',
    loginTitle: 'Sign in',
    signIn: 'Sign in',
    register: 'Create account',
    fullName: 'Full name',
    email: 'Email address',
    phone: 'Phone number',
    password: 'Password',
    confirmPassword: 'Confirm password',
    continueLabel: 'Continue',
    loadingAccount: 'Checking your account session…',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signInSuccess: 'You are signed in.',
    signUpSuccess: 'Your account was created and you are signed in.',
    signOutSuccess: 'You are signed out.',
    passwordMismatch: 'The passwords do not match.',
    invalidCredentials: 'The email, mobile number, or password is incorrect.',
    duplicateAccount: 'An account already uses these details. Sign in instead.',
    tooManyAttempts: 'Too many attempts in a short time. Try again later.',
    invalidForm: 'Check your email, mobile number, and password, then try again.',
    authUnavailable: 'The account service is unavailable right now. Try again shortly.',
    connectionError: 'Connection failed. Check your network and try again.',
    retry: 'Try again',
    noOffers: 'There are no current offers on the menu.',
    localDataNote:
      'Selecting a branch sets your pickup preference. For delivery, choose your area in the fulfillment options above.',
    noBranches: 'There are no available branches right now.',
    branchesError: 'Branches could not be loaded. Try again.',
    loadingBranches: 'Loading branches…',
    noOrderInSession: 'This order is not available in the current browsing session.',
    orderStatus: 'Latest order status',
    orderDate: 'Order date',
    orderTotal: 'Order total',
    branch: 'Branch',
    orderNumber: 'Order number',
    availableForPickup: 'Pickup',
    availableForDelivery: 'Delivery',
    branchUnavailable: 'Unavailable now',
    selectedBranch: 'Selected pickup branch',
    noDescription: 'The restaurant has not added a description yet.',
  },
};

function getCopy(locale: Locale): StorefrontPageCopy {
  return copy[locale === 'ar' ? 'ar' : 'en'];
}
function useStorefrontRoutes() {
  const { slug } = useParams<{ slug: string }>();
  const home = `/s/${encodeURIComponent(slug)}`;
  return { home, menu: `${home}/menu` };
}

function StorefrontPageShell({
  title,
  intro,
  children,
  compact = false,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const routes = useStorefrontRoutes();
  const HomeArrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <main
      id="main-content"
      className={`mx-auto min-h-[65vh] w-[calc(100%-2rem)] max-w-[1100px] ${compact ? 'pt-3 pb-8' : 'py-6 sm:py-9'}`}
    >
      <nav
        aria-label={locale === 'ar' ? 'مسار التنقل' : 'Breadcrumbs'}
        className={`${compact ? 'mb-2' : 'mb-4'} flex items-center gap-2 text-storefront-caption text-store-muted`}
      >
        <Link
          className="font-bold text-store-primary hover:text-store-primary-deep"
          href={routes.home}
        >
          {t.home}
        </Link>
        <HomeArrow className="size-3.5" aria-hidden="true" />
        <span aria-current="page">{title}</span>
      </nav>
      <header className={compact ? 'sr-only' : 'mb-5 flex flex-col gap-2 sm:mb-6'}>
        <h1 className="font-heading text-storefront-section font-black leading-tight text-store-ink">
          {title}
        </h1>
        {intro && <p className="max-w-2xl text-storefront-body text-store-muted">{intro}</p>}
      </header>
      <div>{children}</div>
    </main>
  );
}

export function StorefrontOffersPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const routes = useStorefrontRoutes();
  const [filter, setFilter] = useState('all');
  const offers = catalog.products.filter(
    (product) => product.promotion || product.promotionalPrice,
  );
  const filters = [
    { id: 'all', label: t.filterAll },
    ...catalog.categories
      .filter((category) =>
        offers.some((product) => product.categories.some((item) => item.id === category.id)),
      )
      .map((category) => ({ id: category.id, label: category.name })),
  ];
  const visibleProducts = offers.filter(
    (product) => filter === 'all' || product.categories.some((category) => category.id === filter),
  );

  return (
    <StorefrontPageShell title={t.offersTitle} intro={t.offersIntro}>
      <div
        className="mb-4 flex flex-wrap gap-2"
        aria-label={locale === 'ar' ? 'تصفية العروض' : 'Filter offers'}
      >
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-11 rounded-full border px-4 text-storefront-support font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary ${filter === item.id ? 'border-store-primary bg-store-primary text-white' : 'border-store-border bg-white text-store-ink hover:border-store-primary/40'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visibleProducts.length ? (
        <StorefrontProductGrid products={visibleProducts} slug={catalog.slug} />
      ) : (
        <Card className="rounded-2xl border-store-border bg-white p-6 text-center text-store-secondary">
          {t.noOffers}
        </Card>
      )}
      <Button asChild className="mt-5 bg-store-primary text-white hover:bg-store-primary-dark">
        <Link href={routes.menu}>
          {t.openMenu}
          <Utensils className="ms-2 size-4" aria-hidden="true" />
        </Link>
      </Button>
    </StorefrontPageShell>
  );
}

export function StorefrontBranchesPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const selected = useStorefrontStore((state) => state.pickupBranchId);
  const setSelected = useStorefrontStore((state) => state.setPickupBranchId);
  const fulfillmentType = useStorefrontStore((state) => state.fulfillmentType);
  const setFulfillmentType = useStorefrontStore((state) => state.setFulfillmentType);
  const hydrated = useStorefrontStore((state) => state.hasHydrated);
  const isRestaurant = catalog.activity === 'restaurant';
  const fulfillment = useRestaurantFulfillment(isRestaurant ? catalog.slug : undefined);
  const branches = fulfillment.data?.onlineBranches ?? [];

  return (
    <StorefrontPageShell title={t.branchesTitle} intro={t.branchesIntro}>
      {isRestaurant && fulfillment.isPending ? (
        <p role="status" className="rounded-xl bg-white p-4 text-store-muted">
          {t.loadingBranches}
        </p>
      ) : isRestaurant && fulfillment.isError ? (
        <div className="grid gap-3 rounded-xl bg-red-50 p-4 text-store-error" role="alert">
          <p>{t.branchesError}</p>
          <Button type="button" variant="outline" onClick={() => void fulfillment.refetch()}>
            {t.retry}
          </Button>
        </div>
      ) : branches.length === 0 ? (
        <Card className="rounded-2xl border-store-border bg-white p-6 text-center text-store-secondary">
          {t.noBranches}
        </Card>
      ) : (
        <>
          <p className="mb-4 rounded-xl bg-store-primary/5 px-4 py-3 text-storefront-support font-bold text-store-primary-deep">
            {t.localDataNote}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {branches.map((branch) => {
              const isSelected = fulfillmentType === 'pickup' && selected === branch.branchId;
              return (
                <Card
                  key={branch.branchId}
                  className={`rounded-[1.35rem] border bg-white p-0 shadow-[0_12px_32px_rgba(30,38,36,0.045)] ${isSelected ? 'border-store-primary ring-2 ring-store-primary/15' : 'border-store-border'}`}
                >
                  <div className="grid gap-3 p-4">
                    <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                      {branch.name}
                    </h2>
                    {branch.address && (
                      <p className="text-storefront-support leading-5 text-store-muted">
                        {branch.address}
                      </p>
                    )}
                    {!branch.acceptingOrders && (
                      <p className="text-storefront-caption font-bold text-store-error">
                        {t.branchUnavailable}
                      </p>
                    )}
                    {branch.dailyHours && (
                      <p className="text-storefront-caption text-store-muted" dir="ltr">
                        {branch.dailyHours.open} – {branch.dailyHours.close}
                      </p>
                    )}
                    <p className="text-storefront-caption text-store-muted">
                      {[
                        branch.pickup && t.availableForPickup,
                        branch.delivery && t.availableForDelivery,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <Button
                      type="button"
                      variant={isSelected ? 'outline' : 'default'}
                      disabled={!hydrated || !branch.acceptingOrders || !branch.pickup}
                      onClick={() => {
                        setFulfillmentType('pickup');
                        setSelected(branch.branchId);
                      }}
                      className="w-full"
                    >
                      <MapPin className="me-2 size-4" aria-hidden="true" />
                      {isSelected ? t.selectedBranch : t.chooseBranch}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </StorefrontPageShell>
  );
}

export function StorefrontAboutPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = getCopy(locale);

  return (
    <StorefrontPageShell title={t.aboutTitle}>
      <Card className="grid gap-5 rounded-[1.6rem] border-store-border bg-white p-5 shadow-[0_12px_32px_rgba(30,38,36,0.045)] sm:p-8">
        <div className="flex items-center gap-3">
          {catalog.logoData && (
            <Image
              src={catalog.logoData}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="size-14 rounded-xl object-cover"
            />
          )}
          <h2 className="font-heading text-storefront-section font-black text-store-ink">
            {catalog.merchantName}
          </h2>
        </div>
        <p className="max-w-3xl text-storefront-body leading-7 text-store-secondary">
          {catalog.restaurantDescription || t.noDescription}
        </p>
        <div
          className="flex flex-wrap gap-2"
          aria-label={locale === 'ar' ? 'أقسام القائمة' : 'Menu categories'}
        >
          {catalog.categories.map((category) => (
            <span
              className="rounded-full bg-store-cream px-3 py-1 text-storefront-support font-bold text-store-primary-deep"
              key={category.id}
            >
              {category.name}
            </span>
          ))}
        </div>
        <Button asChild className="w-fit bg-store-primary text-white hover:bg-store-primary-dark">
          <Link href={`/s/${encodeURIComponent(catalog.slug)}/menu`}>
            {t.openMenu}
            <Utensils className="ms-2 size-4" aria-hidden="true" />
          </Link>
        </Button>
      </Card>
    </StorefrontPageShell>
  );
}

export function StorefrontOrderTrackingPage() {
  const { locale } = useLocale();
  const { orderId, slug } = useParams<{ orderId: string; slug: string }>();
  const t = getCopy(locale);
  const [receipt, setReceipt] = useState<StorefrontOrderReceipt | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setReceipt(loadStorefrontOrderReceipt(orderId));
    setIsLoaded(true);
  }, [orderId]);
  const statusLabels: Record<StorefrontOrderReceipt['status'], string> = {
    pending: locale === 'ar' ? 'قيد المراجعة' : 'Pending',
    accepted: locale === 'ar' ? 'تم قبول الطلب' : 'Accepted',
    rejected: locale === 'ar' ? 'لم يتم قبول الطلب' : 'Rejected',
    preparing: locale === 'ar' ? 'قيد التحضير' : 'Preparing',
    ready: locale === 'ar' ? 'الطلب جاهز' : 'Ready',
    completed: locale === 'ar' ? 'تم إتمام الطلب' : 'Completed',
    cancelled: locale === 'ar' ? 'تم إلغاء الطلب' : 'Cancelled',
  };

  return (
    <StorefrontPageShell title={t.trackingTitle} intro={t.trackingIntro}>
      <Card className="mx-auto grid max-w-3xl gap-5 rounded-[1.6rem] border-store-border bg-white p-5 shadow-[0_12px_32px_rgba(30,38,36,0.045)] sm:p-7">
        {!isLoaded ? (
          <p role="status" className="text-store-muted">
            {t.loadingAccount}
          </p>
        ) : receipt ? (
          <>
            <p className="rounded-xl bg-store-primary/5 px-4 py-3 text-storefront-support font-bold text-store-primary-deep">
              {t.trackingSnapshotNote}
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <dt className="text-storefront-caption text-store-muted">{t.orderNumber}</dt>
                <dd className="font-heading font-extrabold text-store-ink" dir="ltr">
                  #{receipt.id.slice(0, 8).toUpperCase()}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-storefront-caption text-store-muted">{t.orderStatus}</dt>
                <dd className="font-heading text-storefront-subsection font-extrabold text-store-primary-deep">
                  {statusLabels[receipt.status]}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-storefront-caption text-store-muted">{t.orderDate}</dt>
                <dd className="text-storefront-support text-store-ink">
                  {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(receipt.createdAt))}
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-storefront-caption text-store-muted">{t.orderTotal}</dt>
                <dd className="font-heading font-extrabold text-store-ink">
                  {formatStorefrontPrice(receipt.total, locale)}
                </dd>
              </div>
              {receipt.branchName && (
                <div className="grid gap-1">
                  <dt className="text-storefront-caption text-store-muted">{t.branch}</dt>
                  <dd className="text-storefront-support text-store-ink">{receipt.branchName}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <p
            role="status"
            className="rounded-xl bg-store-cream p-4 text-storefront-support font-bold text-store-secondary"
          >
            {t.noOrderInSession}
          </p>
        )}
        <Button asChild className="w-fit bg-store-primary text-white hover:bg-store-primary-dark">
          <Link href={`/s/${encodeURIComponent(slug)}/menu`}>{t.openMenu}</Link>
        </Button>
      </Card>
    </StorefrontPageShell>
  );
}

export function StorefrontCustomerLoginPage() {
  const { locale } = useLocale();
  const storefrontSlug = useStorefrontSlug();
  const base = useStorefrontBasePath(storefrontSlug);
  const router = useRouter();
  const t = getCopy(locale);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const submitting = useRef(false);
  const isRegister = mode === 'register';
  const session = useStorefrontCustomer({ refreshOnMount: true });
  useEffect(() => {
    if (!session.data || session.isFetching || session.isError) return;
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    router.replace(storefrontReturnPath(returnTo, base));
  }, [session.data, session.isFetching, session.isError, base, router]);
  const signIn = useMutation({
    mutationFn: (data: CustomerSignInRequest) => signInStorefrontCustomer(storefrontSlug, data),
    gcTime: 0,
  });
  const signUp = useMutation({
    mutationFn: (data: CustomerSignUpRequest) => signUpStorefrontCustomer(storefrontSlug, data),
    gcTime: 0,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const read = (name: string) => String(values.get(name) ?? '');
    const password = read('password');
    if (isRegister && password !== read('confirm-password')) {
      setError(t.passwordMismatch);
      const passwordField = form.elements.namedItem('password');
      const confirmationField = form.elements.namedItem('confirm-password');
      if (passwordField instanceof HTMLInputElement) passwordField.value = '';
      if (confirmationField instanceof HTMLInputElement) confirmationField.value = '';
      return;
    }

    submitting.current = true;
    setIsAuthenticating(true);
    try {
      const customer = isRegister
        ? await signUp.mutateAsync({
            name: read('name'),
            email: read('email'),
            phone: read('tel'),
            password,
          })
        : await signIn.mutateAsync({ identifier: read('identifier'), password });
      await queryClient.cancelQueries({ queryKey: storefrontCustomerSessionKey(storefrontSlug) });
      // Confirm the cookie survived before treating the session as persistent.
      const persisted = await loadStorefrontCustomer(storefrontSlug);
      if (!persisted || persisted.id !== customer.id) {
        setError(
          locale === 'ar'
            ? 'تعذّر الاحتفاظ بتسجيل الدخول. اسمح بملفات تعريف الارتباط وحاول تاني.'
            : 'Could not keep you signed in. Allow cookies and try again.',
        );
        return;
      }
      queryClient.setQueryData(storefrontCustomerSessionKey(storefrontSlug), persisted);
      form.reset();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(
          cause.statusCode === 401
            ? t.invalidCredentials
            : cause.statusCode === 409
              ? t.duplicateAccount
              : cause.statusCode === 429
                ? t.tooManyAttempts
                : cause.statusCode === 400
                  ? t.invalidForm
                  : t.authUnavailable,
        );
      } else {
        setError(t.connectionError);
      }
    } finally {
      submitting.current = false;
      setIsAuthenticating(false);
      const passwordField = form.elements.namedItem('password');
      const confirmationField = form.elements.namedItem('confirm-password');
      if (passwordField instanceof HTMLInputElement) passwordField.value = '';
      if (confirmationField instanceof HTMLInputElement) confirmationField.value = '';
    }
  }

  return (
    <StorefrontPageShell title={t.loginTitle} compact>
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-[1.6rem] border border-store-border bg-white shadow-[0_12px_32px_rgba(30,38,36,0.045)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden bg-store-cream lg:block">
          <Image
            src="/storefront-assets/restaurant.webp"
            alt=""
            fill
            sizes="40vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-store-primary-deep/35 to-transparent" />
        </div>
        <div className="p-5 sm:p-8">
          {session.isPending || (session.data && !session.isError) ? (
            <p
              role="status"
              className="mt-5 rounded-xl bg-store-page p-4 text-storefront-support text-store-muted"
            >
              {session.data
                ? locale === 'ar'
                  ? 'جارٍ الرجوع لصفحتك…'
                  : 'Returning to your page…'
                : t.loadingAccount}
            </p>
          ) : (
            <>
              {session.isError && (
                <div className="mt-5 grid gap-3 rounded-xl bg-red-50 p-4">
                  <p role="alert" className="text-storefront-support font-bold text-red-700">
                    {isStorefrontCustomerServiceUnavailable(session.error)
                      ? t.authUnavailable
                      : isStorefrontCustomerNetworkError(session.error)
                        ? t.connectionError
                        : t.authUnavailable}
                  </p>
                  <Button type="button" variant="outline" onClick={() => void session.refetch()}>
                    {t.retry}
                  </Button>
                </div>
              )}
              <div
                role="group"
                aria-label={t.accountTitle}
                className="grid grid-cols-2 rounded-xl bg-store-page p-1"
              >
                {(
                  [
                    { id: 'sign-in', label: t.signIn },
                    { id: 'register', label: t.register },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={isAuthenticating}
                    aria-pressed={mode === tab.id}
                    onClick={() => {
                      setMode(tab.id);
                      setError('');
                    }}
                    className={`min-h-11 rounded-lg px-3 text-storefront-support font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary disabled:cursor-not-allowed disabled:opacity-60 ${mode === tab.id ? 'bg-white text-store-primary-deep shadow-sm' : 'text-store-muted'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => void handleSubmit(event)}
                aria-busy={isAuthenticating}
                className="mt-5 grid gap-3"
              >
                <fieldset disabled={isAuthenticating} className="m-0 grid gap-3 border-0 p-0">
                  {isRegister && (
                    <Field
                      label={t.fullName}
                      name="name"
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  )}
                  {isRegister ? (
                    <Field
                      label={t.email}
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  ) : (
                    <Field
                      label={
                        locale === 'ar'
                          ? 'البريد الإلكتروني أو رقم الهاتف'
                          : 'Email address or mobile number'
                      }
                      name="identifier"
                      autoComplete="username"
                      maxLength={254}
                      required
                    />
                  )}
                  {isRegister && (
                    <Field
                      label={t.phone}
                      name="tel"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={32}
                      required
                    />
                  )}
                  <Field
                    label={t.password}
                    name="password"
                    type="password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    minLength={isRegister ? 6 : 1}
                    maxLength={128}
                    required
                  />
                  {isRegister && (
                    <Field
                      label={t.confirmPassword}
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      maxLength={128}
                      required
                    />
                  )}
                  <Button
                    type="submit"
                    disabled={isAuthenticating}
                    className="mt-1 w-full bg-store-primary text-white hover:bg-store-primary-dark"
                  >
                    {isAuthenticating
                      ? locale === 'ar'
                        ? 'جارٍ الإرسال…'
                        : 'Submitting…'
                      : isRegister
                        ? t.register
                        : t.signIn}
                  </Button>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 px-3 py-2 text-storefront-support font-bold text-red-700"
                    >
                      {error}
                    </p>
                  )}
                </fieldset>
              </form>
            </>
          )}
        </div>
      </div>
    </StorefrontPageShell>
  );
}

function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  required = false,
  inputMode,
  maxLength,
  minLength,
  disabled = false,
}: {
  label: string;
  name: string;
  type?: ComponentProps<'input'>['type'];
  autoComplete?: string;
  required?: boolean;
  inputMode?: 'text' | 'email' | 'tel';
  maxLength?: number;
  minLength?: number;
  disabled?: boolean;
}) {
  const id = `storefront-auth-${name}`;
  return (
    <label htmlFor={id} className="grid gap-1.5 text-storefront-support font-bold text-store-ink">
      {label}
      <Input
        id={id}
        name={name}
        type={type}
        dir={name === 'email' || name === 'tel' || name === 'identifier' ? 'ltr' : 'auto'}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        disabled={disabled}
        required={required}
        className="h-11 rounded-xl border-store-border bg-white text-start"
      />
    </label>
  );
}
