import { restaurantPlaceSeed } from './restaurant-place-seed.js';

export interface DeliveryLocation {
  id: string;
  governorate: string;
  locality: string;
  area: string;
}

// Keep the original area IDs for existing branch coverage and saved customer selections.
export const deliveryLocations: readonly DeliveryLocation[] = [
  { id: 'cairo-nasr-first', governorate: 'القاهرة', locality: 'مدينة نصر', area: 'الحي الأول' },
  { id: 'cairo-nasr-seventh', governorate: 'القاهرة', locality: 'مدينة نصر', area: 'الحي السابع' },
  { id: 'cairo-heliopolis-korba', governorate: 'القاهرة', locality: 'مصر الجديدة', area: 'الكوربة' },
  { id: 'dakahlia-mansoura-hay-gamaa', governorate: 'الدقهلية', locality: 'المنصورة', area: 'حي الجامعة' },
  { id: 'dakahlia-mansoura-toreil', governorate: 'الدقهلية', locality: 'المنصورة', area: 'توريل' },
  ...restaurantPlaceSeed.flatMap(([governorateKey, governorate, cities]) =>
    cities.flatMap(([cityKey, locality, areas = []]) => {
      const cityId = `city-${governorateKey}-${cityKey}`;
      return [
        { id: cityId, governorate, locality, area: '' },
        ...areas.map(([key, area]) => ({ id: `${cityId}-area-${key}`, governorate, locality, area })),
      ];
    }),
  ),
];

export function deliveryLocationLabel(location: DeliveryLocation) {
  const city = location.governorate === location.locality
    ? location.locality : `${location.governorate}، ${location.locality}`;
  return location.area ? `${city}، ${location.area}` : city;
}

export interface BranchDeliveryArea {
  locationId: string;
  governorate?: string;
  locality?: string;
  area?: string;
  fee: string;
  minimum: string;
  etaMinutes: number;
  priority: number;
}

export interface RestaurantBranchSettings {
  branchId: string;
  locationId: string;
  paused: boolean;
  pickup: boolean;
  delivery: boolean;
  dailyHours: { open: string; close: string } | null;
  areas: BranchDeliveryArea[];
}

export interface PublicRestaurantBranch extends RestaurantBranchSettings {
  name: string;
  address: string | null;
  acceptingOrders: boolean;
}

const catalogById = new Map(deliveryLocations.map((location) => [location.id, location]));
const catalogCities = new Map(
  deliveryLocations.filter((location) => !location.area)
    .map((location) => [`${location.governorate}/${location.locality}`, location.id]),
);

export function deliveryDestination(area: BranchDeliveryArea): DeliveryLocation | undefined {
  const location = catalogById.get(area.locationId);
  if (location) return location;
  if (area.governorate && area.locality && area.area) {
    return { id: area.locationId, governorate: area.governorate, locality: area.locality, area: area.area };
  }
  return undefined;
}

export function deliveryBranches<T extends RestaurantBranchSettings>(branches: readonly T[], locationId: string) {
  const destination = catalogById.get(locationId);
  const cityId = destination?.area
    ? catalogCities.get(`${destination.governorate}/${destination.locality}`)
    : undefined;
  return branches.flatMap((branch) => {
    if (!branch.delivery) return [];
    const exact = branch.areas.find((entry) => entry.locationId === locationId);
    const area = exact ?? branch.areas.find((entry) => entry.locationId === cityId);
    return area ? [{ branch, area }] : [];
  }).sort((a, b) => a.area.priority - b.area.priority || a.branch.branchId.localeCompare(b.branch.branchId));
}
