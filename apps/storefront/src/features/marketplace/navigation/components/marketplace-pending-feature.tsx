import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
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
      <Button
        type="button"
        className={cn(
          'btn btn-gold disabled:cursor-not-allowed disabled:opacity-[0.5] border-0 rounded-[11px] py-[13px] px-5',
          'font-extrabold bg-waffarly-gold text-[#2d1038]',
        )}
        onClick={onClose}
      >
        متابعة التصفح
      </Button>
    </MarketplaceDialog>
  );
}
