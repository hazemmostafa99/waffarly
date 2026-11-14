import type { StorefrontOrderStatus } from './catalog.js';
export interface CustomerOrderView {
 id: string; restaurantName: string; status: StorefrontOrderStatus; createdAt: string;
 total: string; subtotal: string | null; deliveryFee: string | null; fulfillmentType: string; guest: boolean;
 acceptedAt: string | null; preparationStartedAt: string | null; readyAt: string | null; completedAt: string | null; cancelledAt: string | null;
 items: Array<{id: string; productName: string; variantName: string | null; quantity: number; unitPrice: string; lineTotal: string; selections: Array<{groupName: string; optionName: string; quantity: number}>}>;
}
export interface CustomerOrdersPage { items: CustomerOrderView[]; nextCursor: string | null; signedIn: boolean }
