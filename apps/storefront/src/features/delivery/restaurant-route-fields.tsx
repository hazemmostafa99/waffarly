'use client';

import { deliveryBranches, type PublicRestaurantProfile } from '@waffarly/contracts';
import { DeliveryAreaPicker, useDeliveryArea } from './delivery-area-picker';
import { useQuery } from '@tanstack/react-query';
import { apiGetBrowser } from '@/lib/api-client';

export type RestaurantFulfillmentOptions = Pick<PublicRestaurantProfile, 'onlineBranches' | 'deliveryAreas'>;
export function useRestaurantFulfillment(slug: string | undefined) {
  return useQuery({
    queryKey: ['restaurant-fulfillment', slug],
    enabled: !!slug,
    queryFn: () => apiGetBrowser<RestaurantFulfillmentOptions>(
      `marketplace/restaurants/${encodeURIComponent(slug!)}/fulfillment`,
    ),
  });
}

export function RestaurantRouteFields({ settings, fulfillment, area, pickup, onArea, onPickup }: {
  settings: RestaurantFulfillmentOptions;
  fulfillment: 'delivery' | 'pickup';
  area: string;
  pickup: string;
  onArea: (id: string) => void;
  onPickup: (id: string) => void;
}) {
  const locationId = useDeliveryArea();
  if (settings.onlineBranches !== undefined) {
    if (fulfillment === 'pickup') {
      const branches = settings.onlineBranches.filter((branch) => branch.pickup && branch.acceptingOrders);
      return <label className="grid gap-2">
        فرع الاستلام
        <select className="rounded-lg border border-current/20 bg-white p-2" value={pickup}
          onChange={(event) => onPickup(event.target.value)}>
          <option value="">{branches.length ? 'اختار فرع الاستلام' : 'مفيش فرع متاح للاستلام دلوقتي'}</option>
          {branches.map((branch) => <option key={branch.branchId} value={branch.branchId}>
            {branch.name}{branch.address ? ` — ${branch.address}` : ''}
          </option>)}
        </select>
      </label>;
    }
    const covered = deliveryBranches(settings.onlineBranches, locationId);
    const route = covered.find(({ branch }) => branch.acceptingOrders);
    return <div className="space-y-2">
      <DeliveryAreaPicker onChange={() => onArea('')} />
      {locationId && <p role="status" className="text-sm">
        {route ? `التوصيل من ${route.branch.name} · ${route.area.fee} جنيه · الحد الأدنى ${route.area.minimum} جنيه · حوالي ${route.area.etaMinutes} دقيقة`
          : covered.length ? 'الفروع اللي بتوصل للمنطقة دي مقفولة دلوقتي.'
            : 'التوصيل مش متاح للمنطقة دي. غيّر المنطقة أو اختار الاستلام من الفرع.'}
      </p>}
    </div>;
  }
  if (fulfillment !== 'delivery' || !settings.deliveryAreas.length) return null;
  return <label className="grid gap-2">
    منطقة التوصيل
    <select className="rounded-lg border border-current/20 bg-white p-2" value={area}
      onChange={(event) => onArea(event.target.value)}>
      <option value="">اختار المنطقة</option>
      {settings.deliveryAreas.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
  </label>;
}
