# Local order tracking and reorder

Route: `/marketplace/orders/[orderId]/tracking`, linked from the local order detail.
This is an interactive UI demonstration over the current provider-scoped Zustand
store. It does not represent an actual merchant, shipment, pickup location or
fulfillment update.

## Tracking behavior

- New demo orders start at `demo-confirmed`.
- The shopper advances one simulated status at a time from the tracking page.
- Delivery orders follow confirmed -> preparing -> in transit -> demo complete.
- Pickup orders follow confirmed -> preparing -> ready for pickup -> demo complete.
- The orders list and detail badge reflect the selected demo status.
- No automatic timers or estimated arrival times are shown. The current session's
  order creation time is the only displayed timestamp.
- Statuses and order history reset when the Marketplace provider is remounted or
  the page is refreshed.

## Reorder behavior

The order detail's **إعادة المنتجات إلى السلة** action tries to add each snapshot
item with its original quantity to the current cart. The cart's existing quantity
limit and local product lookup remain authoritative. The page reports how many
product lines were added or skipped and links to cart review when at least one line
was added. Reordering does not submit another order.

## Files and ownership

- `features/marketplace/orders/model/demo-order.ts` defines demo statuses and the
  delivery/pickup step sequences.
- `features/marketplace/orders/state/orders-slice.ts` advances the status locally.
- `features/marketplace/orders/components/order-tracking-page.tsx` renders the
  accessible timeline and manual progression control.
- `features/marketplace/orders/components/order-detail-page.tsx` owns reorder
  feedback and uses the cart feature's existing `addToCart` action.
- `app/marketplace/orders/[orderId]/tracking/page.tsx` composes the shared header,
  tracking page and footer.

## Manual acceptance still pending

Create a demo order using both delivery and pickup, open tracking, advance each
stage and confirm the matching status appears in the orders list and detail page.
Try reordering into an empty cart, a partially filled cart and a cart near its
quantity limit. Confirm partial additions are reported honestly and that refresh
clears demo history. No automated tests, typecheck, build or browser review were run
for this change, per the user's instruction.
