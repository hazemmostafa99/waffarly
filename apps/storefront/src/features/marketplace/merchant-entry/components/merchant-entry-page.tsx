'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';
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
  const [submitted, setSubmitted] = useState(false);

  return (
    <MarketplaceProviders>
      <div lang={locale} dir={isArabic ? 'rtl' : 'ltr'} className="marketplace-theme">
        <Suspense fallback={<MarketplaceHeaderSkeleton />}>
          <MarketplaceSiteHeader />
        </Suspense>
        <main id="marketplace-main" tabIndex={-1} className="pb-16">
          <MarketplaceContainer className="max-w-[760px]">
            {!submitted && <div className="flex justify-end pt-3 sm:pt-4">
              <Link href="/" className="inline-flex min-h-9 items-center gap-2 text-sm font-bold text-accent no-underline hover:text-primary">
                <span aria-hidden="true">→</span>
                {isArabic ? 'العودة إلى السوق' : 'Back to marketplace'}
              </Link>
            </div>}

            <Card className="mt-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
              {!submitted && <header className="mb-4 border-b border-border pb-3">
                <h1 className="m-0 text-[21px] font-bold leading-8 text-primary">{isArabic ? 'انضم كتاجر إلى وفّرلي' : 'Sell on Waffarly'}</h1>
                <p className="mb-0 mt-1 text-[12px] leading-6 text-muted-foreground">{isArabic ? 'قدّم بيانات نشاطك ليراجعها فريق وفّرلي.' : 'Submit your business details for review by Waffarly.'}</p>
              </header>}
              <MerchantApplicationForm onSubmitted={() => setSubmitted(true)} />
            </Card>

          </MarketplaceContainer>
        </main>
        <MarketplaceFooter />
        <MarketplaceCart />
      </div>
    </MarketplaceProviders>
  );
}
