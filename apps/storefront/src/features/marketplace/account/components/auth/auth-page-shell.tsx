'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
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
      <main id="marketplace-main" tabIndex={-1} className="pb-14 pt-4 sm:pb-16 sm:pt-4">
        <MarketplaceContainer className="max-w-[1000px]">
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
          <section className="grid overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow)] md:grid-cols-[minmax(0,1fr)_320px]">
            <aside className="relative order-2 hidden min-w-0 flex-col justify-between gap-8 overflow-hidden bg-[linear-gradient(155deg,#210b30_0%,#351048_60%,#4a185e_100%)] p-6 text-white md:flex">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <img
                  src="/marketplace-assets/wafarly-logo.png"
                  alt="وفّرلي"
                  className="block h-9 w-28 object-contain"
                />
                <span className="size-2 rounded-full bg-waffarly-gold" aria-hidden="true" />
              </div>
              <div>
                <span
                  className="mb-4 block h-1 w-8 rounded-full bg-waffarly-gold"
                  aria-hidden="true"
                />
                <h2 className="m-0 text-[26px] font-bold leading-[1.65]">
                  حساب واحد،
                  <br />
                  وتجربة أسهل.
                </h2>
                <p className="mb-0 mt-3 text-[13px] leading-6 text-white/65">
                  كل اللي بتحبه على وفّرلي، أقرب ليك.
                </p>
              </div>
              <div className="grid gap-2.5">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-waffarly-gold">
                    <Heart size={18} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="m-0 text-[13px] font-medium">مفضلاتك قريبة منك</p>
                    <p className="m-0 text-[11px] leading-5 text-white/60">
                      ارجع لاختياراتك بسهولة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-waffarly-gold">
                    <ShoppingBag size={18} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="m-0 text-[13px] font-medium">كمّل تسوّقك براحتك</p>
                    <p className="m-0 text-[11px] leading-5 text-white/60">
                      اكتشف المتاجر والمطاعم على وفّرلي
                    </p>
                  </div>
                </div>
              </div>
            </aside>
            <div className="order-2 min-w-0 p-5 md:order-1 md:p-7">
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium text-accent">{eyebrow}</p>
                <h1 className="m-0 text-[24px] font-bold leading-9 text-primary">{title}</h1>
                <p className="mb-0 mt-1 text-[13px] leading-6 text-muted-foreground">
                  {description}
                </p>
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
