import { cn } from '@waffarly/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { MarketplaceProviders } from '@/features/marketplace/providers/marketplace-providers';
import '@/styles/marketplace-tokens.css';
import { MarketplaceCart } from '@/features/marketplace/cart/components/marketplace-cart';
import { tajawal } from '@/fonts/storefront-fonts';

export const metadata: Metadata = {
  title: 'وفّرلي | كل اللي محتاجه من أكتر من بائع',
  description: 'وفّرلي — سوق إلكتروني متعدد البائعين للمنتجات والعروض والمتاجر القريبة منك.',
  robots: { index: false, follow: false },
};

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="ar" dir="rtl" className={`${tajawal.variable} marketplace-theme`}>
      <a
        className={cn(
          'marketplace-skip-link rounded-lg bg-card px-4 py-2 text-primary fixed top-2.5',
          'right-[10px] z-[60] p-3 bg-[white] [transform:translateY(-200%)] focus:[transform:none]',
        )}
        href="#marketplace-main"
      >
        الانتقال إلى المحتوى
      </a>
      <MarketplaceProviders>
        {children}
        <MarketplaceCart />
      </MarketplaceProviders>
    </div>
  );
}
