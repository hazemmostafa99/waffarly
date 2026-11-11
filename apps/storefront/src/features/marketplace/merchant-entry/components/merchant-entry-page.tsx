'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useLocale } from '@waffarly/ui';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceProviders } from '@/features/marketplace/providers/marketplace-providers';
import { MarketplaceCart } from '@/features/marketplace/cart/components/marketplace-cart';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MerchantApplicationForm } from '@/features/marketplace/merchant-entry/components/merchant-application-form';

export function MerchantEntryPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <MarketplaceProviders>
      <div lang={locale} dir={isArabic ? 'rtl' : 'ltr'} className="marketplace-theme">
        <Suspense fallback={<MarketplaceHeaderSkeleton />}>
          <MarketplaceSiteHeader />
        </Suspense>
        <main id="marketplace-main" tabIndex={-1} className="pb-16">
          <MarketplaceContainer>
            <div className="flex justify-end pt-3 sm:pt-4">
              <Link href="/" className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-accent no-underline hover:text-primary">
                <span aria-hidden="true">→</span>
                {isArabic ? 'العودة إلى السوق' : 'Back to marketplace'}
              </Link>
            </div>

            <section className="relative mt-2 overflow-hidden rounded-2xl bg-[linear-gradient(115deg,_var(--purple-950),_var(--purple-700))] px-4 py-4 text-white shadow-[var(--shadow)] sm:px-6 sm:py-5">
              <div className="pointer-events-none absolute -end-8 -top-12 size-32 rounded-full border-[18px] border-[rgba(245,189,25,0.12)] sm:size-40" aria-hidden="true" />
              <div className="relative max-w-3xl">
                <span className="inline-flex rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[11px] font-bold text-waffarly-gold">
                  {isArabic ? 'لأصحاب المتاجر والمطاعم' : 'For stores and restaurants'}
                </span>
                <h1 className="sr-only">
                  {isArabic ? 'ابدأ البيع على وفّرلي' : 'Start selling on Waffarly'}
                </h1>
                <p className="mb-0 mt-1.5 max-w-2xl text-xs leading-6 text-[#e4d8e9] sm:text-sm">
                  {isArabic
                    ? 'عرّفنا بنشاطك التجاري، وخلي فريق وفّرلي يتعرّف على متجرك.'
                    : 'Tell us about your business so the Waffarly team can learn more about your store.'}
                </p>
              </div>
            </section>

            <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.36fr)] sm:mt-4 sm:gap-4">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)] sm:p-6">
                <header className="mb-4 border-b border-border pb-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="m-0 text-sm font-extrabold text-accent">
                      {isArabic ? 'طلب الانضمام' : 'Merchant application'}
                    </p>
                    <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">
                      {isArabic ? 'بيانات النشاط' : 'Business details'}
                    </span>
                  </div>
                  <h2 className="m-0 text-lg font-black text-primary sm:text-xl">
                    {isArabic ? 'بيانات المتجر والتواصل' : 'Store and contact details'}
                  </h2>
                  <p className="mb-0 mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                    {isArabic ? 'املأ الحقول دي عشان تكمل تجربة تقديم طلب التاجر.' : 'Complete these fields to try the merchant application flow.'}
                  </p>
                </header>
                <MerchantApplicationForm />
              </section>

              <aside className="rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)] sm:p-5">
                <h2 className="m-0 text-base font-black text-primary">
                  {isArabic ? 'الخطوات ببساطة' : 'A simple process'}
                </h2>
                <ol className="mt-3 grid gap-2.5 p-0">
                  {[
                    isArabic ? 'اختار نوع نشاطك التجاري.' : 'Choose your business activity.',
                    isArabic ? 'اكتب بيانات المتجر وصاحب النشاط.' : 'Add your store and owner details.',
                    isArabic ? 'أرسل النموذج وشوف التأكيد التجريبي.' : 'Submit and see the demo confirmation.',
                  ].map((step, index) => (
                    <li key={step} className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-black text-primary">{index + 1}</span>
                      <span className="pt-1">{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 rounded-xl border border-[rgba(245,189,25,0.45)] bg-[rgba(245,189,25,0.12)] p-3">
                  <p className="m-0 text-xs font-extrabold text-primary">
                    {isArabic ? 'تجربة محلية' : 'Local demo'}
                  </p>
                  <p className="mb-0 mt-1 text-[11px] leading-5 text-muted-foreground">
                    {isArabic
                      ? 'البيانات لا تغادر المتصفح، والتقديم الفعلي هيتضاف بعد اكتمال واجهات السوق.'
                      : 'Your information stays in the browser. Live submission will be added after the Marketplace UI is complete.'}
                  </p>
                </div>
              </aside>
            </div>
          </MarketplaceContainer>
        </main>
        <MarketplaceFooter />
        <MarketplaceCart />
      </div>
    </MarketplaceProviders>
  );
}
