'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useLocale } from '@waffarly/ui';
import Link from '../../components/storefront/storefront-link';
import { useStorefrontStore } from '../../providers/storefront-providers';

export function StorefrontCartNotice({ slug }: { slug: string }) {
  const notice = useStorefrontStore((state) => state.cartNotice);
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const { locale } = useLocale();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setDismissedId(notice.id), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {notice && notice.id !== dismissedId && (
        <div className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-store-border bg-white p-3 text-sm text-store-primary shadow-lg lg:bottom-6">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 font-bold">
            {notice.kind === 'updated'
              ? locale === 'ar'
                ? 'اتحفظت تعديلاتك'
                : 'Changes saved'
              : locale === 'ar'
                ? 'اتضاف للسلة'
                : 'Added to basket'}
          </span>
          <Link href={`/s/${slug}/cart`} className="text-xs font-bold underline">
            {locale === 'ar' ? 'شوف السلة' : 'View basket'}
          </Link>
          <button
            type="button"
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
            onClick={() => setDismissedId(notice.id)}
            className="grid size-8 place-items-center rounded-full hover:bg-store-cream"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
