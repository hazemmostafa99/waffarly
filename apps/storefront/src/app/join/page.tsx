import type { Metadata } from 'next';
import { MerchantEntryPage } from '@/features/marketplace/merchant-entry/components/merchant-entry-page';

export const metadata: Metadata = {
  title: 'سجّل كتاجر | وفّرلي',
  description: 'قدّم بيانات متجرك أو مطعمك للانضمام إلى وفّرلي.',
};

export default function JoinPage() {
  return <MerchantEntryPage />;
}
