'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-[680px] content-center justify-items-center px-5 py-16 text-center" role="alert">
      <span className="grid size-16 place-items-center rounded-2xl bg-store-error/5 text-store-error">
        <RefreshCw className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 font-heading text-storefront-page font-extrabold text-store-ink">
        {isArabic ? 'تعذر تحميل المتجر' : 'We could not load this storefront'}
      </h1>
      <p className="mt-2 text-storefront-body text-store-muted">
        {isArabic ? 'تحقق من اتصالك وحاول مرة أخرى.' : 'Check your connection and try again.'}
      </p>
      <Button onClick={reset} className="mt-7 rounded-xl bg-store-primary px-6 font-bold hover:bg-store-primary-dark">
        {isArabic ? 'حاول مرة أخرى' : 'Try again'}
      </Button>
    </main>
  );
}
