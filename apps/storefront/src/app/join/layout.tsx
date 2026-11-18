import type { ReactNode } from 'react';
import { tajawal } from '@/fonts/storefront-fonts';
import '@/styles/marketplace-tokens.css';

export default function MerchantEntryLayout({ children }: { children: ReactNode }) {
  return <div className={tajawal.variable}>{children}</div>;
}
