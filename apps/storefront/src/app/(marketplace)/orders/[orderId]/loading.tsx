import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { CustomerOrdersSkeleton } from '@/features/marketplace/orders/components/customer-order-shared';

export default function LoadingOrders() {
  return (
    <main id="marketplace-main" className="min-h-[65vh] py-10">
      <MarketplaceContainer>
        <div className="mx-auto w-full max-w-[1120px]">
          <div
            className="mb-7 h-8 w-48 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <CustomerOrdersSkeleton detail />
        </div>
      </MarketplaceContainer>
    </main>
  );
}
