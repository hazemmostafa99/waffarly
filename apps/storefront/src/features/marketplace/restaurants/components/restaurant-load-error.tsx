'use client';

import { MarketplaceButton } from '@/components/marketplace/marketplace-button';

export function RestaurantLoadError({ reset }: { reset: () => void }) {
  return <main id="marketplace-main" className="mx-auto max-w-xl px-5 py-16 text-center">
    <h1 className="text-xl font-bold text-primary">تعذر تحميل البيانات من الخادم</h1>
    <p className="text-sm leading-6 text-muted-foreground">حاول مرة تانية. لم يتم استبدال بيانات المطعم ببيانات محلية.</p>
    <MarketplaceButton type="button" tone="gold" onClick={reset} className="min-h-11 rounded-xl px-5 text-sm font-bold">إعادة المحاولة</MarketplaceButton>
  </main>;
}
