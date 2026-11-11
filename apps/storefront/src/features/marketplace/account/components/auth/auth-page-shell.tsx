'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <main id="marketplace-main" tabIndex={-1} className="pb-14 pt-4 sm:pb-16 sm:pt-6">
        <MarketplaceContainer>
          <nav
            aria-label="مسار التنقل"
            className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link href="/" className="text-accent no-underline hover:text-primary">
              الرئيسية
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/account" className="text-accent no-underline hover:text-primary">
              حسابي
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{eyebrow}</span>
          </nav>
          <section className="grid overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
            <aside className="relative order-2 overflow-hidden bg-[linear-gradient(145deg,_var(--purple-950),_var(--purple-700))] p-5 text-white sm:p-7 lg:order-2 lg:p-8">
              <div
                className="pointer-events-none absolute -end-10 -top-16 size-44 rounded-full border-[22px] border-[rgba(245,189,25,0.12)]"
                aria-hidden="true"
              />
              <div className="relative">
                <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-waffarly-gold">
                  وفّرلي
                </span>
                <h2 className="mb-0 mt-5 max-w-md text-xl font-black leading-snug sm:text-2xl">
                  تسوّقك وطلباتك ومفضلاتك في مكان واحد
                </h2>
                <p className="mb-0 mt-2 max-w-md text-sm leading-6 text-white/75">
                  حسابك على وفّرلي بالبريد والموبايل وكلمة المرور. التطبيق لا يخزن كلمة المرور
                  محليًا.
                </p>
                <ul className="mt-5 grid gap-2.5 p-0 text-xs font-bold leading-5 text-white/90 sm:text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-waffarly-gold" aria-hidden="true">
                      ✓
                    </span>
                    ادخل بالبريد الإلكتروني أو الموبايل
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-waffarly-gold" aria-hidden="true">
                      ✓
                    </span>
                    احتفظ بجلسة حسابك عند تحديث الصفحة
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-waffarly-gold" aria-hidden="true">
                      ✓
                    </span>
                    الطلبات والعناوين التجريبية تظل منفصلة عن حسابك
                  </li>
                </ul>
              </div>
            </aside>
            <div className="order-1 min-w-0 p-5 sm:p-7 lg:order-1 lg:p-9">
              <div className="mb-5">
                <p className="mb-1.5 text-xs font-extrabold text-accent">{eyebrow}</p>
                <h1 className="m-0 text-2xl font-black leading-tight text-primary sm:text-3xl">
                  {title}
                </h1>
                <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
              {children}
            </div>
          </section>
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
