export interface RestaurantImage { src: string; alt: string }
export interface RestaurantPeriod { open: string; close: string }
export interface RestaurantDay { day: number; periods: RestaurantPeriod[] }
export interface RestaurantException { date: string; periods: RestaurantPeriod[] }
export interface RestaurantArea { id: string; name: string; fee: string }
export interface RestaurantSettingsInput {
  description: string;
  cuisines: string[];
  logoImage: RestaurantImage | null;
  coverImage: RestaurantImage | null;
  published: boolean;
  displayOrder: number;
  timezone: string;
  alwaysOpen: boolean;
  openingHours: RestaurantDay[];
  scheduleExceptions: RestaurantException[];
  ordersPaused: boolean;
  pauseReason: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: string;
  minimumDeliveryOrder: string;
  deliveryTimeMinMinutes: number;
  deliveryTimeMaxMinutes: number;
  deliveryAreas: RestaurantArea[];
}
export interface RestaurantOperatingState { isOpen: boolean; acceptingOrders: boolean; reason: 'open' | 'closed' | 'paused' | 'unpublished' }
