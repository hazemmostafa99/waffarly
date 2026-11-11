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

import type { PublicStorefrontProduct } from './catalog.js';
export interface PublicRestaurantProfile extends RestaurantSettingsInput, RestaurantOperatingState {
  merchantId: string; name: string; slug: string; revision: number;
  deliveryFeeFrom: string; deliveryFeeTo: string;
  referenceData: { origin?: string; rating?: string; offer?: string; time?: string } | null;
}
export interface MarketplaceMenuProduct extends PublicStorefrontProduct {
  referenceKey: string | null; availability: 'available' | 'unavailable';
  menuSectionId: string | null; displayOrder: number;
}
export interface MarketplaceMenuPage { items: MarketplaceMenuProduct[]; nextCursor: string | null }
