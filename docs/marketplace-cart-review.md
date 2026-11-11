# Local cart review page

Follow-up: the checkout CTA is now enabled and links to the separate
`/marketplace/checkout` local demonstration. The pending-checkout statements below
describe the initial cart slice. See [current checkout](marketplace-local-checkout.md).

Route: `/marketplace/cart`. UI-only, using the existing provider-scoped local basket
and fixture products. No backend, new package, persistence, order submission or
payment integration was introduced.

## Components

- `app/marketplace/cart/page.tsx`: metadata and shared header/footer composition.
- `components/cart/cart-review-page.tsx`: basket state, derived products/totals,
  removal feedback and populated/empty composition.
- `cart-review-item.tsx`: original image, seller/title links, unit price, quantity,
  removal and line subtotal.
- `cart-summary.tsx`: product/quantity counts, item subtotal, fee exclusion notice
  and explicitly pending checkout control.
- `cart-empty-state.tsx`: empty basket and browse link.

The existing QuantitySelector, money formatter, product URL helpers, cart selectors
and Zustand actions are reused. Every price uses Western digits `0-9`. The drawer's
new Review Cart link closes the drawer and uses Next Link to keep the local
provider state across navigation. Its keyboard trap now includes that link.

## Current behavior and limits

Quantity changes/removal update the same basket as listing/details/drawer. Removal
has live feedback and returns focus to the page heading. Summary derives unit count,
distinct-product count and item subtotal; shipping/tax/fees are not invented.
Checkout remains disabled with an explanation until its separate local-demo slice.
Reload/new tab starts with an empty basket because persistence is not implemented.
The mobile navigation marks the cart surface as active.

## Verification status

No automated tests, browser automation, typecheck or build were run for this slice,
at the user's explicit request. Manual acceptance is pending; the responsive CSS
is implemented but not claimed to have been visually verified.

Manual review: add items from listing/details, open drawer -> Review Cart, change
quantities, check unit/line/combined totals, remove a product and then the last one,
continue shopping, and check the page on mobile. No real order should be created.
The next planned step is local checkout/contact/fulfillment/review and explicit demo
confirmation, still without backend connectivity.
