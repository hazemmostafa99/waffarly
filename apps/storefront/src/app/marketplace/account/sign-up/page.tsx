import type { Metadata } from 'next';
import { SignUpPage } from '@/features/marketplace/account/components/auth/sign-up-page';

export const metadata: Metadata = { title: 'إنشاء حساب | وفّرلي' };

export default function MarketplaceSignUpPage() {
  return <SignUpPage />;
}
