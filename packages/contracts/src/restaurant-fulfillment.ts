export interface DeliveryLocation {
  id: string;
  governorate: string;
  locality: string;
  area: string;
}

// Initial service areas. Extend with verified operating areas before onboarding each location.
export const deliveryLocations: readonly DeliveryLocation[] = [
  { id: 'cairo-nasr-first', governorate: 'القاهرة', locality: 'مدينة نصر', area: 'الحي الأول' },
  { id: 'cairo-nasr-seventh', governorate: 'القاهرة', locality: 'مدينة نصر', area: 'الحي السابع' },
  { id: 'cairo-heliopolis-korba', governorate: 'القاهرة', locality: 'مصر الجديدة', area: 'الكوربة' },
  { id: 'dakahlia-mansoura-hay-gamaa', governorate: 'الدقهلية', locality: 'المنصورة', area: 'حي الجامعة' },
  { id: 'dakahlia-mansoura-toreil', governorate: 'الدقهلية', locality: 'المنصورة', area: 'توريل' },
];

export function deliveryLocationLabel(location: DeliveryLocation) {
  return [location.governorate, location.locality, location.area].join('، ');
}

export interface BranchDeliveryArea {
  locationId: string;
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

export function deliveryBranches<T extends RestaurantBranchSettings>(branches: readonly T[], locationId: string) {
  return branches.flatMap((branch) => {
    const area = branch.delivery && branch.areas.find((entry) => entry.locationId === locationId);
    return area ? [{ branch, area }] : [];
  }).sort((a, b) => a.area.priority - b.area.priority || a.branch.branchId.localeCompare(b.branch.branchId));
}
