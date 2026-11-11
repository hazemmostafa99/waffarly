import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';

export function MarketplacePendingFeature({
  feature,
  onClose,
}: {
  feature: string;
  onClose: () => void;
}) {
  const title = feature === 'account' ? 'حسابي' : feature === 'orders' ? 'طلباتي' : feature;
  return (
    <MarketplaceDialog open={Boolean(feature)} onClose={onClose} title={title || 'قريبًا'}>
      <p>الصفحة دي لسه قيد التجهيز. تقدر تكمّل تصفّح المنتجات والمتاجر دلوقتي.</p>
      <button type="button" className="btn btn-gold" onClick={onClose}>
        متابعة التصفح
      </button>
    </MarketplaceDialog>
  );
}
