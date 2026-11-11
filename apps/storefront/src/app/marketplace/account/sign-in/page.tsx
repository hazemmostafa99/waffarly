import type { Metadata } from 'next';
import { SignInPage } from '@/features/marketplace/account/components/auth/sign-in-page';

export const metadata: Metadata = { title: 'تسجيل الدخول | وفّرلي' };

export default function MarketplaceSignInPage() {
  return <SignInPage />;
}
