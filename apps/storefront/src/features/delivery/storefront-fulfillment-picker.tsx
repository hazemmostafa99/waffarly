'use client';

import { useState } from 'react';
import { useLocale } from '@waffarly/ui';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { useStorefrontStore } from '@/providers/storefront-providers';
import { RestaurantRouteFields, useRestaurantFulfillment } from './restaurant-route-fields';

/** A merchant-scoped preference shared by browsing and checkout; the API confirms the final route. */
export function StorefrontFulfillmentPicker({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const options = useRestaurantFulfillment(open ? catalog.slug : undefined);
  const hydrated = useStorefrontStore((state) => state.hasHydrated);
  const area = useStorefrontStore((state) => state.deliveryAreaId);
  const setArea = useStorefrontStore((state) => state.setDeliveryAreaId);
  if (catalog.activity !== 'restaurant') return null;
  const ar = locale === 'ar';
  const legacyArea = options.data?.onlineBranches === undefined
    ? options.data?.deliveryAreas.find((entry) => entry.id === area)
    : undefined;
  return (
    <details
      className="my-2 text-sm text-store-ink"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="w-fit cursor-pointer py-2 font-bold text-store-primary">
        {ar ? 'بنوصل لمنطقتك؟' : 'Do we deliver to your area?'}
      </summary>
      {open && (
        <div className="grid gap-3 rounded-2xl border border-store-border bg-white p-4">
          {options.isPending && (
            <p role="status">
              {ar ? 'جارٍ تحميل الفروع ومناطق التغطية…' : 'Loading branches and coverage…'}
            </p>
          )}
          {options.isError && (
            <p role="alert">
              {ar ? 'تعذّر تحميل مناطق التوصيل.' : 'Could not load delivery areas.'}{' '}
              <button type="button" className="underline" onClick={() => void options.refetch()}>
                {ar ? 'حاول تاني' : 'Try again'}
              </button>
            </p>
          )}
          {options.data && (
            <fieldset disabled={!hydrated}>
              <RestaurantRouteFields
                settings={options.data}
                fulfillment="delivery"
                area={area}
                pickup=""
                locationId={area}
                onLocation={setArea}
                onArea={setArea}
                onPickup={() => {}}
              />
            </fieldset>
          )}
          {legacyArea && (
            <p role="status">
              {ar ? `رسوم التوصيل: ${legacyArea.fee} جنيه` : `Delivery fee: EGP ${legacyArea.fee}`}
            </p>
          )}
          {options.data?.onlineBranches === undefined &&
            options.data?.deliveryAreas.length === 0 && (
              <p>{ar ? 'مناطق التوصيل هتتأكد عند إتمام الطلب.' : 'Delivery coverage is confirmed at checkout.'}</p>
            )}
        </div>
      )}
    </details>
  );
}
