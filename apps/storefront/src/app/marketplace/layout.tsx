import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { MarketplaceProviders } from '@/features/marketplace/providers/marketplace-providers';
import '@/styles/marketplace.css';
import { MarketplaceCart } from '@/features/marketplace/components/cart/marketplace-cart';

export const metadata: Metadata = {
  title: 'وفّرلي | كل اللي محتاجه من أكتر من بائع',
  description: 'وفّرلي — سوق إلكتروني متعدد البائعين للمنتجات والعروض والمتاجر القريبة منك.',
  robots: { index: false, follow: false },
};

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="ar" dir="rtl" className="marketplace-theme font-marketplace">
      <a
        className="marketplace-skip-link rounded-lg bg-marketplace-surface px-4 py-2 text-marketplace-primary"
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
