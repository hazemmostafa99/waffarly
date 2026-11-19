'use client';

import { useId } from 'react';
import { useLocale } from '@waffarly/ui';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { useStorefrontStore } from '@/providers/storefront-providers';
import { RestaurantRouteFields, useRestaurantFulfillment } from './restaurant-route-fields';

/** A merchant-scoped preference shared by browsing and checkout; the API confirms the final route. */
export function StorefrontFulfillmentPicker({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const id = useId();
  const options = useRestaurantFulfillment(
    catalog.activity === 'restaurant' ? catalog.slug : undefined,
  );
  const hydrated = useStorefrontStore((state) => state.hasHydrated);
  const fulfillment = useStorefrontStore((state) => state.fulfillmentType);
  const area = useStorefrontStore((state) => state.deliveryAreaId);
  const pickup = useStorefrontStore((state) => state.pickupBranchId);
  const setFulfillment = useStorefrontStore((state) => state.setFulfillmentType);
  const setArea = useStorefrontStore((state) => state.setDeliveryAreaId);
  const setPickup = useStorefrontStore((state) => state.setPickupBranchId);
  if (catalog.activity !== 'restaurant') return null;
  const ar = locale === 'ar';
  return (
    <section
      aria-label={ar ? 'طريقة استلام الطلب' : 'Order fulfillment'}
      className="my-4 grid gap-3 rounded-2xl border border-store-border bg-white p-4 text-sm text-store-ink"
    >
      <fieldset disabled={!hydrated} className="flex flex-wrap gap-2">
        <legend className="mb-2 font-bold">
          {ar ? 'هتستلم طلبك إزاي؟' : 'How would you like your order?'}
        </legend>
        {(['delivery', 'pickup'] as const).map((value) => (
          <label
            key={value}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 ${fulfillment === value ? 'border-store-primary bg-store-primary/5' : 'border-store-border'}`}
          >
            <input
              type="radio"
              name={id}
              value={value}
              checked={fulfillment === value}
              onChange={() => setFulfillment(value)}
              className="accent-store-primary"
            />
            {value === 'delivery' ? (ar ? 'توصيل' : 'Delivery') : ar ? 'استلام من الفرع' : 'Pickup'}
          </label>
        ))}
      </fieldset>
      {options.isPending && (
        <p role="status">
          {ar ? 'جارٍ تحميل الفروع ومناطق التغطية…' : 'Loading branches and coverage…'}
        </p>
      )}
      {options.isError && (
        <p role="alert">
          {ar ? 'تعذّر تحميل خيارات الاستلام.' : 'Could not load fulfillment options.'}{' '}
          <button type="button" className="underline" onClick={() => void options.refetch()}>
            {ar ? 'حاول تاني' : 'Try again'}
          </button>
        </p>
      )}
      {options.data && (
        <fieldset disabled={!hydrated}>
          <RestaurantRouteFields
            settings={options.data}
            fulfillment={fulfillment}
            area={area}
            pickup={pickup}
            locationId={area}
            onLocation={setArea}
            onArea={setArea}
            onPickup={setPickup}
          />
        </fieldset>
      )}
      <p className="text-xs text-store-muted">
        {ar
          ? 'اختيارك هيكمل معاك عند إتمام الطلب. هنأكد الفرع والتوافر والسعر قبل التأكيد.'
          : 'Your selection carries into checkout. Branch, availability and price are confirmed before ordering.'}
      </p>
    </section>
  );
}
