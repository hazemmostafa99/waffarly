'use client';

import { Suspense } from 'react';
import { useCustomerSession } from '../hooks/use-customer-session';
import { CustomerAccountPanel } from './customer-account-panel';
import Link from 'next/link';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { useAccountStore } from '@/features/marketplace/account/hooks/use-account-store';
import { demoAddresses } from '@/features/marketplace/account/model/demo-addresses';
import { useFavoritesStore } from '@/features/marketplace/favorites/hooks/use-favorites-store';
import { useOrdersStore } from '@/features/marketplace/orders/hooks/use-orders-store';
import { money } from '@/features/marketplace/shared/lib/format-money';
import {
  demoOrderTotal,
  formatDemoOrderDate,
} from '@/features/marketplace/orders/model/demo-order';

function AccountEntry() {
  const enterDemoAccount = useAccountStore((state) => state.enterDemoAccount);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow)]">
      <div className="bg-[linear-gradient(115deg,_var(--purple-950),_var(--purple-700))] px-5 py-6 text-white sm:px-8 sm:py-8">
        <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-waffarly-gold">
          حساب وفّرلي
        </span>
        <h1 className="sr-only">أهلاً بيك في حسابك</h1>
        <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-white/80">
          تابع طلباتك والمنتجات اللي حفظتها في مكان واحد.
        </p>
      </div>
      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.55fr)] lg:items-center">
        <div>
          <h2 className="m-0 text-lg font-black text-primary">جرّب حساب وفّرلي</h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
            ادخل كضيف تجريبي من غير كلمة مرور أو بيانات شخصية. تقدر ترجع لحالة الزائر بتسجيل الخروج.
          </p>
        </div>
        <div className="grid gap-3 rounded-2xl bg-secondary/70 p-4 sm:p-5">
          <div className="flex items-center gap-3 text-sm font-bold text-primary">
            <span
              className="grid size-9 place-items-center rounded-xl bg-white text-accent"
              aria-hidden="true"
            >
              ✓
            </span>
            طلباتك التجريبية
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-primary">
            <span
              className="grid size-9 place-items-center rounded-xl bg-white text-accent"
              aria-hidden="true"
            >
              ♡
            </span>
            المنتجات المفضلة
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-primary">
            <span
              className="grid size-9 place-items-center rounded-xl bg-white text-accent"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                <circle cx="12" cy="10" r="2.25" />
              </svg>
            </span>
            عناوين تجريبية للتوصيل
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/account/sign-in"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-waffarly-gold px-4 text-sm font-black text-primary no-underline transition-colors hover:bg-[#ffd353]"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/account/sign-up"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-bold text-primary no-underline transition-colors hover:bg-secondary"
            >
              إنشاء حساب
            </Link>
          </div>
          <MarketplaceButton
            type="button"
            onClick={enterDemoAccount}
            className="min-h-10 rounded-lg px-4 text-xs font-bold text-accent underline-offset-4 hover:underline"
          >
            متابعة كضيف تجريبي
          </MarketplaceButton>
        </div>
      </div>
      <p className="m-0 border-t border-border px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-8">
        تسجيل الدخول وإنشاء الحساب متصلان بالخادم. متابعة الضيف تفتح تجربة محلية منفصلة.
      </p>
    </section>
  );
}

function DemoAddressBook() {
  const selectedAddressId = useAccountStore((state) => state.selectedDemoAddressId);
  const selectDemoAddress = useAccountStore((state) => state.selectDemoAddress);

  return (
    <section
      className="rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow)] sm:p-7"
      aria-labelledby="demo-addresses-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="demo-addresses-title" className="m-0 text-lg font-black text-primary">
            عناوين التوصيل التجريبية
          </h2>
          <p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">
            اختار عنوانًا توضيحيًا عشان يظهر تلقائيًا في إتمام الطلب.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-accent">
          بيانات مثال
        </span>
      </div>
      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">العنوان المستخدم في تجربة التوصيل</legend>
        {demoAddresses.map((address) => {
          const selected = address.id === selectedAddressId;

          return (
            <label
              key={address.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                selected
                  ? 'border-accent bg-secondary/60'
                  : 'border-border bg-white hover:border-accent/60'
              }`}
            >
              <input
                type="radio"
                name="demo-address"
                value={address.id}
                checked={selected}
                onChange={() => selectDemoAddress(address.id)}
                className="mt-1 shrink-0 accent-primary"
              />
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-primary">{address.label}</strong>
                  {selected && (
                    <span className="text-[11px] font-bold text-accent">محدد للتجربة</span>
                  )}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">{address.address}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mb-0 mt-4 text-[11px] leading-5 text-muted-foreground">
        العناوين خيالية ومحفوظة في ذاكرة الجلسة فقط. لا تدخل عنوانك الحقيقي.
      </p>
    </section>
  );
}

function AccountDashboard() {
  const leaveDemoAccount = useAccountStore((state) => state.leaveDemoAccount);
  const orders = useOrdersStore((state) => state.orders);
  const favoriteCount = useFavoritesStore((state) => state.favorites.length);
  const recentOrders = orders.slice(0, 3);

  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-xl font-black text-primary"
              aria-hidden="true"
            >
              و
            </span>
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-accent">
                حساب تجريبي
              </span>
              <h1 className="sr-only">أهلاً بيك، ضيف وفّرلي</h1>
            </div>
          </div>
          <MarketplaceButton
            type="button"
            onClick={leaveDemoAccount}
            className="min-h-10 rounded-lg border border-border bg-white px-4 text-sm font-bold text-primary hover:bg-secondary"
          >
            تسجيل الخروج
          </MarketplaceButton>
        </div>
        <p className="mb-0 mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          كل البيانات المعروضة تجريبية ومؤقتة، وتُمسح عند تحديث الصفحة أو إغلاق الجلسة.
        </p>
      </section>

      <section aria-label="ملخص الحساب" className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/orders"
          className="group rounded-2xl border border-border bg-white p-5 text-inherit no-underline shadow-[var(--shadow)] transition-colors hover:border-accent"
        >
          <span className="text-xs font-bold text-muted-foreground">طلباتي</span>
          <span className="mt-2 flex items-end justify-between gap-3">
            <strong className="text-3xl font-black text-primary">{orders.length}</strong>
            <span className="text-sm font-bold text-accent group-hover:text-primary">
              عرض الطلبات ←
            </span>
          </span>
        </Link>
        <Link
          href="/favorites"
          className="group rounded-2xl border border-border bg-white p-5 text-inherit no-underline shadow-[var(--shadow)] transition-colors hover:border-accent"
        >
          <span className="text-xs font-bold text-muted-foreground">المفضلة</span>
          <span className="mt-2 flex items-end justify-between gap-3">
            <strong className="text-3xl font-black text-primary">{favoriteCount}</strong>
            <span className="text-sm font-bold text-accent group-hover:text-primary">
              عرض المفضلة ←
            </span>
          </span>
        </Link>
      </section>

      <DemoAddressBook />

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[var(--shadow)] sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-black text-primary">أحدث الطلبات</h2>
            <p className="mb-0 mt-1 text-xs text-muted-foreground">
              طلبات تجريبية من الجلسة الحالية.
            </p>
          </div>
          {orders.length > 0 && (
            <Link href="/orders" className="text-sm font-bold text-accent no-underline">
              كل الطلبات ←
            </Link>
          )}
        </div>
        {recentOrders.length > 0 ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-inherit no-underline hover:bg-secondary/50"
                >
                  <span>
                    <strong className="block text-sm text-primary">
                      طلب #{order.id.slice(-6)}
                    </strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatDemoOrderDate(order.createdAt)}
                    </span>
                  </span>
                  <strong className="text-sm text-primary">{money(demoOrderTotal(order))}</strong>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl bg-secondary/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
            لسه مفيش طلبات في الجلسة دي. لما تكمل طلب تجريبي، هتلاقيه هنا.
          </div>
        )}
      </section>
    </div>
  );
}

export function AccountPage() {
  const session = useCustomerSession();
  const isDemoAccountActive = useAccountStore((state) => state.isDemoAccountActive);

  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <main id="marketplace-main" tabIndex={-1} className="min-h-[60vh] pb-16 pt-5 sm:pt-7">
        <MarketplaceContainer className={session.data ? 'max-w-[1200px]' : undefined}>
          <nav
            aria-label="مسار التنقل"
            className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link href="/" className="text-accent no-underline">
              الرئيسية
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">حسابي</span>
          </nav>
          {session.isPending ? (
            <p role="status">جارٍ تحميل حسابك…</p>
          ) : session.isError ? (
            <section className="rounded-3xl border border-border bg-white p-5">
              <p role="alert">تعذّر تحميل الحساب. تحقق من الاتصال وحاول مرة أخرى.</p>
              <MarketplaceButton type="button" onClick={() => void session.refetch()}>
                إعادة المحاولة
              </MarketplaceButton>
              <Link href="/account/sign-in" className="mx-4 text-accent">
                تسجيل الدخول
              </Link>
            </section>
          ) : session.data ? (
            <CustomerAccountPanel customer={session.data} />
          ) : isDemoAccountActive ? (
            <AccountDashboard />
          ) : (
            <AccountEntry />
          )}
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
