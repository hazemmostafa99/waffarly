'use client';

import Image from 'next/image';
import Link from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ComponentProps } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { Badge, Button, Card, Input, useLocale } from '@waffarly/ui';
import type { Locale } from '@waffarly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import {
  customerSessionKey,
  loadCustomer,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
} from '@/features/account/data/customer-auth-api';

type PreviewCopy = {
  home: string;
  menu: string;
  preview: string;
  disclosureTitle: string;
  disclosure: string;
  localOnly: string;
  openMenu: string;
  offersTitle: string;
  offersIntro: string;
  filterAll: string;
  filterFood: string;
  filterDrinks: string;
  sampleCard: string;
  offerCardOne: string;
  offerCardTwo: string;
  offerCardThree: string;
  offerCardText: string;
  branchesTitle: string;
  branchesIntro: string;
  branchOne: string;
  branchTwo: string;
  branchThree: string;
  chooseBranch: string;
  selectedPreview: string;
  branchDetails: string;
  aboutTitle: string;
  aboutIntro: string;
  storyTitle: string;
  storyText: string;
  infoTitle: string;
  infoText: string;
  hoursTitle: string;
  hoursText: string;
  contactTitle: string;
  contactText: string;
  trackingTitle: string;
  trackingIntro: string;
  trackingNoData: string;
  stepOne: string;
  stepTwo: string;
  stepThree: string;
  stepText: string;
  accountTitle: string;
  loginTitle: string;
  loginIntro: string;
  signIn: string;
  register: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  continueLabel: string;
  formNotice: string;
  noAccount: string;
  haveAccount: string;
  signInLink: string;
  accountNotice: string;
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
};

const copy: Record<'ar' | 'en', PreviewCopy> = {
  ar: {
    home: 'الرئيسية',
    menu: 'قائمة الطعام',
    preview: 'معاينة التصميم',
    disclosureTitle: 'هذه الصفحة للمعاينة فقط',
    disclosure:
      'المحتوى والتفاعلات هنا تجريبية وليست متصلة ببيانات المطعم أو الطلبات. لم يتم إرسال أو حفظ أي بيانات.',
    localOnly: 'اختيار محلي للمعاينة فقط — لن يؤثر في طلب حقيقي.',
    openMenu: 'استكشف القائمة',
    offersTitle: 'العروض',
    offersIntro: 'مساحة العروض جاهزة للتصميم، وستعرض العروض الفعلية بعد ربط الواجهة البرمجية.',
    filterAll: 'الكل',
    filterFood: 'الأطباق',
    filterDrinks: 'المشروبات',
    sampleCard: 'بطاقة تجريبية',
    offerCardOne: 'مساحة عرض للأطباق',
    offerCardTwo: 'مساحة عرض للمشروبات',
    offerCardThree: 'مساحة عرض مميزة',
    offerCardText: 'سيظهر هنا محتوى العرض المعتمد عند توفر بيانات المطعم.',
    branchesTitle: 'فروعنا',
    branchesIntro: 'معاينة لتصميم بطاقات الفروع. تفاصيل المواقع ومواعيد العمل غير متاحة بعد.',
    branchOne: 'معاينة الفرع 1',
    branchTwo: 'معاينة الفرع 2',
    branchThree: 'معاينة الفرع 3',
    chooseBranch: 'اختيار للمعاينة',
    selectedPreview: 'تم الاختيار للمعاينة',
    branchDetails: 'سيتم عرض بيانات هذا الفرع بعد ربط واجهة الفروع.',
    aboutTitle: 'عن المطعم',
    aboutIntro: 'مساحة تعريفية بتصميم متجاوب، بانتظار المحتوى المعتمد من المطعم.',
    storyTitle: 'قصتنا',
    storyText: 'سيظهر هنا تعريف المطعم ومحتواه التحريري بعد توفير بياناته المعتمدة.',
    infoTitle: 'معلومات المطعم',
    infoText: 'التفاصيل ستظهر بعد ربط بيانات المطعم.',
    hoursTitle: 'مواعيد العمل',
    hoursText: 'المواعيد غير متاحة في هذه المعاينة.',
    contactTitle: 'التواصل',
    contactText: 'بيانات التواصل ستظهر بعد ربط الواجهة البرمجية.',
    trackingTitle: 'متابعة الطلب',
    trackingIntro:
      'معاينة لواجهة متابعة الطلبات. لا يتم البحث عن رقم الطلب ولا توجد حالة طلب فعلية هنا.',
    trackingNoData: 'بيانات الطلب غير متصلة بهذه الصفحة.',
    stepOne: 'الخطوة الأولى',
    stepTwo: 'الخطوة الثانية',
    stepThree: 'الخطوة الثالثة',
    stepText: 'سيظهر وصف الحالة هنا بعد اعتماد وربط بيانات الطلبات.',
    accountTitle: 'حسابك',
    loginTitle: 'تسجيل الدخول',
    loginIntro: 'سجّل الدخول أو أنشئ حسابًا لمتابعة تجربتك في المتجر.',
    signIn: 'دخول',
    register: 'حساب جديد',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    continueLabel: 'متابعة',
    formNotice:
      'تُرسل بيانات تسجيل الدخول إلى خدمة الحسابات. البريد والموبايل غير مؤكَّدين حاليًا، واستعادة كلمة المرور غير متاحة.',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب بالفعل؟',
    signInLink: 'سجّل الدخول',
    accountNotice:
      'حساب العميل مشترك بين متاجر وفّرلي. تأكيد البريد والموبايل واستعادة كلمة المرور غير مفعّلين بعد؛ الطلبات والعناوين في صفحات المتجر تظل تجريبية.',
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
    authUnavailable: 'تعذّر الاتصال بخدمة الحسابات. حاول مرة أخرى.',
  },
  en: {
    home: 'Home',
    menu: 'Menu',
    preview: 'Design preview',
    disclosureTitle: 'This page is a preview',
    disclosure:
      'Content and interactions are illustrative and are not connected to restaurant or order data. Nothing is sent or saved.',
    localOnly: 'Local preview selection only — it will not affect a real order.',
    openMenu: 'Explore the menu',
    offersTitle: 'Offers',
    offersIntro:
      'The offers page is ready for its visual design. Live campaigns will appear after the API is connected.',
    filterAll: 'All',
    filterFood: 'Food',
    filterDrinks: 'Drinks',
    sampleCard: 'Sample card',
    offerCardOne: 'Food offer placement',
    offerCardTwo: 'Drinks offer placement',
    offerCardThree: 'Featured offer placement',
    offerCardText: 'Approved offer content will appear here when restaurant data is available.',
    branchesTitle: 'Our branches',
    branchesIntro:
      'A preview of the branch-card layout. Location and opening-hour details are not available yet.',
    branchOne: 'Branch preview 1',
    branchTwo: 'Branch preview 2',
    branchThree: 'Branch preview 3',
    chooseBranch: 'Select preview',
    selectedPreview: 'Selected for preview',
    branchDetails: 'Branch details will appear when the branches API is connected.',
    aboutTitle: 'About the restaurant',
    aboutIntro: 'A responsive introduction page, waiting for approved restaurant content.',
    storyTitle: 'Our story',
    storyText:
      'The restaurant introduction and editorial content will appear here once approved data is available.',
    infoTitle: 'Restaurant information',
    infoText: 'Details will appear after restaurant content is connected.',
    hoursTitle: 'Opening hours',
    hoursText: 'Hours are not available in this preview.',
    contactTitle: 'Contact',
    contactText: 'Contact information will appear after the API is connected.',
    trackingTitle: 'Track an order',
    trackingIntro:
      'A preview of the order-tracking interface. No order lookup is performed and no real order status is shown.',
    trackingNoData: 'Order data is not connected to this page.',
    stepOne: 'First step',
    stepTwo: 'Second step',
    stepThree: 'Third step',
    stepText: 'An approved order update will appear here once order data is connected.',
    accountTitle: 'Your account',
    loginTitle: 'Sign in',
    loginIntro: 'Sign in or create an account to continue in this store.',
    signIn: 'Sign in',
    register: 'Create account',
    fullName: 'Full name',
    email: 'Email address',
    phone: 'Phone number',
    password: 'Password',
    confirmPassword: 'Confirm password',
    continueLabel: 'Continue',
    formNotice:
      'Your details are sent to the account service. Email and phone verification and password recovery are not available yet.',
    noAccount: 'New here?',
    haveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    accountNotice:
      'Your customer account is shared across Waffarly stores. Email/mobile verification and password recovery are not enabled yet; orders and addresses in this store remain previews.',
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
    authUnavailable: 'The account service could not be reached. Try again.',
  },
};

function getCopy(locale: Locale): PreviewCopy {
  return copy[locale === 'ar' ? 'ar' : 'en'];
}
function useStorefrontPreviewRoutes() {
  const { slug } = useParams<{ slug: string }>();
  const home = `/s/${encodeURIComponent(slug)}`;
  return {
    home,
    menu: `${home}/menu`,
    login: `${home}/login`,
    favorites: `${home}/favorites`,
    cart: `${home}/cart`,
  };
}

function PreviewDisclosure({ title, children }: { title: string; children: string }) {
  return (
    <aside
      role="note"
      className="flex gap-3 rounded-2xl border border-store-gold/40 bg-store-cream px-4 py-3 text-start"
    >
      <Info className="mt-0.5 size-5 shrink-0 text-store-primary" aria-hidden="true" />
      <p className="text-storefront-support leading-5 text-store-ink">
        <strong className="me-1 font-extrabold">{title}</strong>
        {children}
      </p>
    </aside>
  );
}

function PreviewPage({
  title,
  intro,
  children,
  isPreview = true,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  isPreview?: boolean;
}) {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const routes = useStorefrontPreviewRoutes();
  const HomeArrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <main
      id="main-content"
      className="mx-auto min-h-[65vh] w-[calc(100%-2rem)] max-w-[1100px] py-6 sm:py-9"
    >
      <nav
        aria-label={locale === 'ar' ? 'مسار التنقل' : 'Breadcrumbs'}
        className="mb-4 flex items-center gap-2 text-storefront-caption text-store-muted"
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
      <header className="mb-5 flex flex-col gap-2 sm:mb-6">
        {isPreview && (
          <Badge className="w-fit border border-store-gold/40 bg-store-cream px-3 py-1 font-bold text-store-primary-deep">
            <Sparkles className="me-1 size-3.5" aria-hidden="true" />
            {t.preview}
          </Badge>
        )}
        <h1 className="font-heading text-storefront-section font-black leading-tight text-store-ink">
          {title}
        </h1>
        <p className="max-w-2xl text-storefront-body text-store-muted">{intro}</p>
      </header>
      {isPreview ? (
        <PreviewDisclosure title={t.disclosureTitle}>{t.disclosure}</PreviewDisclosure>
      ) : (
        <PreviewDisclosure title={t.accountTitle}>{t.accountNotice}</PreviewDisclosure>
      )}
      <div className="mt-5 sm:mt-6">{children}</div>
    </main>
  );
}

const offerCards = [
  { id: 'food', image: '/storefront-assets/burger.webp', titleKey: 'offerCardOne' },
  { id: 'drink', image: '/storefront-assets/shake.webp', titleKey: 'offerCardTwo' },
  { id: 'featured', image: '/storefront-assets/waffle.webp', titleKey: 'offerCardThree' },
] as const;

export function StorefrontOffersPreviewPage() {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const routes = useStorefrontPreviewRoutes();
  const [filter, setFilter] = useState<'all' | 'food' | 'drink'>('all');
  const filters = [
    { id: 'all', label: t.filterAll },
    { id: 'food', label: t.filterFood },
    { id: 'drink', label: t.filterDrinks },
  ] as const;
  const visibleCards = offerCards.filter((card) => filter === 'all' || card.id === filter);

  return (
    <PreviewPage title={t.offersTitle} intro={t.offersIntro}>
      <div
        className="mb-4 flex flex-wrap gap-2"
        aria-label={locale === 'ar' ? 'تصفية البطاقات التجريبية' : 'Filter preview cards'}
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
      <p className="mb-3 text-storefront-caption text-store-muted">{t.localOnly}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <Card
            key={card.id}
            className="overflow-hidden rounded-[1.35rem] border-store-border bg-white p-0 shadow-[0_12px_32px_rgba(30,38,36,0.045)]"
          >
            <div className="relative h-40 bg-store-cream">
              <Image
                src={card.image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover"
              />
              <Badge className="absolute start-3 top-3 border-0 bg-store-gold text-store-primary-deep">
                {t.sampleCard}
              </Badge>
            </div>
            <div className="grid gap-2 p-4">
              <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                {t[card.titleKey]}
              </h2>
              <p className="text-storefront-support leading-5 text-store-muted">
                {t.offerCardText}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <Button asChild className="mt-5 bg-store-primary text-white hover:bg-store-primary-dark">
        <Link href={routes.menu}>
          {t.openMenu}
          <Utensils className="ms-2 size-4" aria-hidden="true" />
        </Link>
      </Button>
    </PreviewPage>
  );
}

const branchCards = [
  { id: 'branch-one', image: '/storefront-assets/branch-1.webp', titleKey: 'branchOne' },
  { id: 'branch-two', image: '/storefront-assets/branch-2.webp', titleKey: 'branchTwo' },
  { id: 'branch-three', image: '/storefront-assets/branch-3.webp', titleKey: 'branchThree' },
] as const;

export function StorefrontBranchesPreviewPage() {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <PreviewPage title={t.branchesTitle} intro={t.branchesIntro}>
      <p className="mb-4 rounded-xl bg-store-primary/5 px-4 py-3 text-storefront-support font-bold text-store-primary-deep">
        {t.localOnly}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {branchCards.map((branch) => {
          const isSelected = selected === branch.id;
          return (
            <Card
              key={branch.id}
              className={`overflow-hidden rounded-[1.35rem] border bg-white p-0 shadow-[0_12px_32px_rgba(30,38,36,0.045)] ${isSelected ? 'border-store-primary ring-2 ring-store-primary/15' : 'border-store-border'}`}
            >
              <div className="relative h-40 bg-store-cream">
                <Image
                  src={branch.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-3 p-4">
                <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                  {t[branch.titleKey]}
                </h2>
                <p className="text-storefront-support leading-5 text-store-muted">
                  {t.branchDetails}
                </p>
                <Button
                  type="button"
                  variant={isSelected ? 'outline' : 'default'}
                  onClick={() => setSelected(branch.id)}
                  className="w-full"
                >
                  <MapPin className="me-2 size-4" aria-hidden="true" />
                  {isSelected ? t.selectedPreview : t.chooseBranch}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </PreviewPage>
  );
}

export function StorefrontAboutPreviewPage() {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const information = [
    { icon: Info, title: t.infoTitle, body: t.infoText },
    { icon: Clock3, title: t.hoursTitle, body: t.hoursText },
    { icon: MapPin, title: t.contactTitle, body: t.contactText },
  ];

  return (
    <PreviewPage title={t.aboutTitle} intro={t.aboutIntro}>
      <section className="grid overflow-hidden rounded-[1.6rem] border border-store-border bg-white shadow-[0_12px_32px_rgba(30,38,36,0.045)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative min-h-56 bg-store-cream sm:min-h-72">
          <Image
            src="/storefront-assets/restaurant.webp"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="grid content-center gap-3 p-5 sm:p-8">
          <Badge className="w-fit bg-store-gold text-store-primary-deep">{t.preview}</Badge>
          <h2 className="font-heading text-storefront-section font-black text-store-ink">
            {t.storyTitle}
          </h2>
          <p className="max-w-prose text-storefront-body leading-6 text-store-muted">
            {t.storyText}
          </p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {information.map(({ icon: Icon, title, body }) => (
          <Card
            key={title}
            className="grid content-start gap-2 rounded-2xl border-store-border bg-white p-4"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-store-primary/10 text-store-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
              {title}
            </h3>
            <p className="text-storefront-support leading-5 text-store-muted">{body}</p>
          </Card>
        ))}
      </div>
    </PreviewPage>
  );
}

export function StorefrontOrderTrackingPreviewPage() {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const steps = [t.stepOne, t.stepTwo, t.stepThree];

  return (
    <PreviewPage title={t.trackingTitle} intro={t.trackingIntro}>
      <Card className="mx-auto max-w-3xl rounded-[1.6rem] border-store-border bg-white p-5 shadow-[0_12px_32px_rgba(30,38,36,0.045)] sm:p-7">
        <div className="flex items-start gap-3 rounded-xl bg-store-cream p-4 text-store-primary-deep">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-storefront-support font-bold leading-5">{t.trackingNoData}</p>
        </div>
        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="relative grid content-start gap-2">
              <span className="grid size-10 place-items-center rounded-full border-2 border-store-gold bg-store-cream font-heading text-base font-extrabold text-store-primary-deep tabular-nums">
                {index + 1}
              </span>
              <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                {step}
              </h2>
              <p className="text-storefront-support leading-5 text-store-muted">{t.stepText}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 border-t border-store-border pt-4 text-storefront-caption text-store-muted">
          {t.localOnly}
        </p>
      </Card>
    </PreviewPage>
  );
}

export function StorefrontCustomerLoginPage() {
  const { locale } = useLocale();
  const t = getCopy(locale);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const isRegister = mode === 'register';
  const session = useQuery({
    queryKey: customerSessionKey,
    queryFn: loadCustomer,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const signIn = useMutation({ mutationFn: signInCustomer, gcTime: 0 });
  const signUp = useMutation({ mutationFn: signUpCustomer, gcTime: 0 });
  const signOut = useMutation({ mutationFn: signOutCustomer, gcTime: 0 });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setNotice('');
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
    try {
      const customer = isRegister
        ? await signUp.mutateAsync({
            name: read('name'),
            email: read('email'),
            phone: read('tel'),
            password,
          })
        : await signIn.mutateAsync({ identifier: read('identifier'), password });
      queryClient.setQueryData(customerSessionKey, customer);
      setNotice(isRegister ? t.signUpSuccess : t.signInSuccess);
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
        setError(t.authUnavailable);
      }
    } finally {
      submitting.current = false;
      const passwordField = form.elements.namedItem('password');
      const confirmationField = form.elements.namedItem('confirm-password');
      if (passwordField instanceof HTMLInputElement) passwordField.value = '';
      if (confirmationField instanceof HTMLInputElement) confirmationField.value = '';
    }
  }

  return (
    <PreviewPage isPreview={false} title={t.loginTitle} intro={t.loginIntro}>
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-[1.6rem] border border-store-border bg-white shadow-[0_12px_32px_rgba(30,38,36,0.045)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[500px] bg-store-cream lg:block">
          <Image
            src="/storefront-assets/restaurant.webp"
            alt=""
            fill
            sizes="40vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-store-primary-deep/80 to-transparent" />
          <div className="absolute inset-x-6 bottom-6 text-white">
            <Sparkles className="size-6 text-store-gold" aria-hidden="true" />
            <p className="mt-2 font-heading text-xl font-extrabold">{t.accountTitle}</p>
          </div>
        </div>
        <div className="p-5 sm:p-8">
          {!session.data && (
            <PreviewDisclosure title={t.accountTitle}>{t.formNotice}</PreviewDisclosure>
          )}
          {session.isPending ? (
            <p
              role="status"
              className="mt-5 rounded-xl bg-store-page p-4 text-storefront-support text-store-muted"
            >
              {t.loadingAccount}
            </p>
          ) : session.data ? (
            <div className="mt-5 grid gap-3 rounded-xl bg-store-cream p-4">
              <p
                role="status"
                className="text-storefront-support font-bold text-store-primary-deep"
              >
                {t.signedInAs}{' '}
                {session.data.displayName ?? session.data.email ?? session.data.phone}
              </p>
              {notice && (
                <p className="text-storefront-support text-store-primary-deep">{notice}</p>
              )}
              <Button
                type="button"
                disabled={signOut.isPending}
                variant="outline"
                onClick={async () => {
                  setError('');
                  try {
                    await signOut.mutateAsync();
                    queryClient.setQueryData(customerSessionKey, null);
                    setNotice(t.signOutSuccess);
                  } catch {
                    setError(t.authUnavailable);
                  }
                }}
              >
                {signOut.isPending ? t.signingOut : t.signOut}
              </Button>
              {error && (
                <p role="alert" className="text-storefront-support font-bold text-red-700">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <>
              <div
                role="group"
                aria-label={t.accountTitle}
                className="mt-5 grid grid-cols-2 rounded-xl bg-store-page p-1"
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
                    disabled={signIn.isPending || signUp.isPending}
                    aria-pressed={mode === tab.id}
                    onClick={() => {
                      setMode(tab.id);
                      setNotice('');
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
                aria-busy={submitting.current || signIn.isPending || signUp.isPending}
                className="mt-5 grid gap-3"
              >
                <fieldset
                  disabled={submitting.current || signIn.isPending || signUp.isPending}
                  className="m-0 grid gap-3 border-0 p-0"
                >
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
                    minLength={isRegister ? 8 : 1}
                    maxLength={128}
                    required
                  />
                  {isRegister && (
                    <Field
                      label={t.confirmPassword}
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  )}
                  <p className="text-storefront-caption text-store-muted">{t.formNotice}</p>
                  {session.isError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 px-3 py-2 text-storefront-support font-bold text-red-700"
                    >
                      {t.authUnavailable}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={signIn.isPending || signUp.isPending}
                    className="mt-1 w-full bg-store-primary text-white hover:bg-store-primary-dark"
                  >
                    {signIn.isPending || signUp.isPending
                      ? locale === 'ar'
                        ? 'جارٍ الإرسال…'
                        : 'Submitting…'
                      : t.continueLabel}
                  </Button>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 px-3 py-2 text-storefront-support font-bold text-red-700"
                    >
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p
                      role="status"
                      className="rounded-lg bg-store-primary/10 px-3 py-2 text-storefront-support font-bold text-store-primary-deep"
                    >
                      {notice}
                    </p>
                  )}
                </fieldset>
              </form>
              <p className="mt-4 text-center text-storefront-support text-store-muted">
                {isRegister ? t.haveAccount : t.noAccount}{' '}
                <button
                  type="button"
                  className="font-extrabold text-store-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode(isRegister ? 'sign-in' : 'register');
                    setNotice('');
                  }}
                >
                  {isRegister ? t.signInLink : t.register}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </PreviewPage>
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
  const id = `preview-${name}`;
  return (
    <label htmlFor={id} className="grid gap-1.5 text-storefront-support font-bold text-store-ink">
      {label}
      <Input
        id={id}
        name={name}
        type={type}
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
