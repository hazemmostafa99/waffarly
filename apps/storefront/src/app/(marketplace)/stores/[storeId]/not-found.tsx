import { MarketplaceEntityNotFound } from '@/features/marketplace/shared/components/marketplace-entity-not-found';

export default function StoreNotFound() {
  return (
    <MarketplaceEntityNotFound
      title="المتجر غير موجود"
      description="الرابط ده مش لمتجر موجود في البيانات المحلية الحالية."
      href="/#stores"
      linkLabel="العودة للمتاجر"
    />
  );
}
