import type { Metadata } from 'next';
import { AccountPage } from '@/features/marketplace/account/components/account-page';

export const metadata: Metadata = { title: 'حسابي | وفّرلي' };

export default function MarketplaceAccountPage() {
  return <AccountPage />;
}
