import { MarketplaceEntityNotFound } from '@/features/marketplace/shared/components/marketplace-entity-not-found';

export default function RestaurantNotFound() {
  return (
    <MarketplaceEntityNotFound
      title="المطعم غير موجود"
      description="الرابط ده مش لمطعم موجود في البيانات المحلية الحالية."
      href="/marketplace#restaurants"
      linkLabel="العودة للمطاعم"
    />
  );
}
