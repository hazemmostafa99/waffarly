'use client';

import { deliveryBranches, deliveryLocationLabel } from '@waffarly/contracts';
import { DeliveryAreaPicker, useDeliveryArea } from './delivery-area-picker';
import { restaurantDeliveryLocations, useRestaurantFulfillment } from './restaurant-route-fields';

export function RestaurantDeliveryAreaSelector({ slug }: { slug: string }) {
  const options = useRestaurantFulfillment(slug);
  const areaId = useDeliveryArea();
  const branches = options.data?.onlineBranches;
  if (!branches) return null;
  const coverage = deliveryBranches(branches, areaId);
  const available = coverage.find(({ branch }) => branch.acceptingOrders);
  const locations = restaurantDeliveryLocations(branches);
  const location = locations.find((entry) => entry.id === areaId);
  return <details className="mx-auto my-3 max-w-[1100px] rounded-xl border border-current/20 bg-white p-3 text-sm">
    <summary className="cursor-pointer font-bold">{location
      ? `التوصيل إلى ${deliveryLocationLabel(location)}` : 'اختار منطقة التوصيل'}</summary>
    <div className="mt-3 grid gap-2">
      <DeliveryAreaPicker locations={locations} />
      {areaId && <p role="status">{available
        ? `التوصيل من ${available.branch.name} · ${available.area.fee} جنيه · حوالي ${available.area.etaMinutes} دقيقة`
        : coverage.length ? 'الفروع اللي بتوصل للمنطقة دي مقفولة دلوقتي.'
          : 'التوصيل مش متاح للمنطقة دي. تقدر تختار الاستلام عند إتمام الطلب لو متاح.'}
      </p>}
    </div>
  </details>;
}

export const RestaurantDeliveryPreview = RestaurantDeliveryAreaSelector;
