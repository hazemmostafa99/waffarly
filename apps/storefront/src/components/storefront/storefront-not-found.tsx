'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@waffarly/ui';
import { notFoundHomeHref } from '../../lib/storefront-address';

export function StorefrontNotFound({
  hostBased = false,
  missingBusiness = false,
  homeHref,
  homeLabel,
  title,
  description,
  mainId = 'main-content',
}: {
  hostBased?: boolean;
  missingBusiness?: boolean;
  homeHref?: string;
  homeLabel?: string;
  title?: string;
  description?: string;
  mainId?: string;
}) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const arabic = locale === 'ar';
  const Arrow = arabic ? ArrowLeft : ArrowRight;
  const destination = homeHref ?? notFoundHomeHref(pathname, hostBased);

  return (
    <main
      id={mainId}
      tabIndex={-1}
      className="grid min-h-screen place-items-center bg-[#f9f7f1] px-5 py-12 text-[#173c32]"
    >
      <div className="w-full max-w-xl rounded-[2rem] border border-[#dce7df] bg-white px-6 py-12 text-center shadow-[0_24px_70px_rgba(23,60,50,0.08)] sm:px-12">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e7f1eb] text-[#28745b]">
          <Compass className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-7 text-sm font-extrabold tracking-[0.2em] text-[#bf8630]">404</p>
        <h1 className="mt-3 font-heading text-3xl font-black sm:text-4xl">
          {title ?? (missingBusiness
            ? arabic ? 'البيزنس ده مش موجود عندنا' : 'This business address was not found'
            : arabic ? 'الصفحة دي مش موجودة' : 'Page not found')}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[#64736c]">
          {description ?? (missingBusiness
            ? arabic
              ? 'العنوان اللي كتبته مش تابع لأي بيزنس على وفّرلي. راجع الرابط أو ارجع لوفّرلي واستكشف المتاجر.'
              : 'This address does not match a business on Wfarly. Check the link or browse Wfarly.'
            : arabic
              ? 'ممكن يكون الرابط اتغيّر أو الصفحة مش متاحة دلوقتي. ارجع للرئيسية وكمّل تصفحك.'
              : 'This link may have changed or the page may be unavailable. Head home to keep browsing.')}
        </p>
        <Link
          href={destination}
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#176b50] px-6 font-bold text-white transition hover:bg-[#10543e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bf8630] focus-visible:ring-offset-2"
        >
          {homeLabel ?? (missingBusiness
            ? arabic ? 'الذهاب إلى وفّرلي' : 'Go to Wfarly'
            : arabic ? 'العودة للرئيسية' : 'Back to home')}
          <Arrow className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
