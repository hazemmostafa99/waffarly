# Restaurant order policy enforcement

Implemented 2026-11-11. The user authorized moving beyond browsing. No tests,
HTTP requests, typecheck, lint or build were run. Manual acceptance remains open.

Storefront exports RestaurantOrderPolicyService through its public entry point.
Orders imports Storefront and assesses restaurant settings on its active
serializable transaction after authoritative product pricing and before saving
the final total. Failed policy checks roll back the order and stock work.

For merchants with a RestaurantProfile, creation rejects unpublished, closed or
paused restaurants, disabled fulfillment methods, delivery below the configured
meal-subtotal minimum, and unsupported/missing areas when area pricing is active.
Pickup uses zero delivery fee and rejects a supplied delivery area. Merchants
without a RestaurantProfile retain their existing storefront rules.

The request accepts optional deliveryAreaId and restaurantSettingsRevision. An
outdated supplied revision is rejected so callers can review settings again.
Configured fees are calculated in integer cents. The immutable order stores
subtotal, deliveryFee, total and a fulfillmentPolicy snapshot containing revision,
area identity/name, minimum, timezone and ETA. Receipt/summary expose optional
subtotal/deliveryFee for compatibility; old orders retain null breakdowns and
their original total. The database checks new breakdown arithmetic.

Migration 20261111170000_restaurant_order_policy was applied to the local database;
Prisma source client was generated. Restart the API dev process if its watcher
has not reloaded the generated client.

Not enabled: real Marketplace checkout, payment or subscription activation.
Seeded demonstration merchants still have no active subscription. Creation
idempotency, a full checkout quote/reconciliation flow and protected customer
order reads remain required before switching the UI to actual order submission.
