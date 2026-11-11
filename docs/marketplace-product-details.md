# Local product details and quantity-aware cart

## Layout follow-up

The minimal detail header has been removed. `MarketplaceSiteHeader` now composes
the same full promo/header/search/navigation/menu/mobile controls on listing and
detail pages. Search/category/section actions from a detail page navigate to the
local listing; listing filters still use native history updates. No backend is used.

ProductBreadcrumbs adds home/category/current-product context and a filtered-results
return link. ProductSellerCard groups only the existing seller/delivery copy; its
initial icon is derived from the seller name, not a fabricated logo or rating.
The detail card is capped at 1240px, media at 480px desktop height, and quantity,
subtotal and CTA are grouped in a soft-surface purchase card. Prices use Western
digits `0-9` throughout. These are local design choices, not extracted detail specs.

TypeScript, 8 existing behavior tests and production build passed. HTTP checks on
listing and details returned 200 with exactly one search form, menu and shared cart;
detail breadcrumbs, seller card and purchase section were present. Browser still
fails at initialization, so actual appearance, responsive layout and interactive
cross-route search/menu behavior are not claimed as verified. No screenshots or
new product facts were introduced. The Next.js security advisory remains unresolved.

## Scope and evidence

UI-only implementation using the existing five products in `reference.json`. No backend calls, route-handler/mock server, real order/payment/stock request or new package. The detail screen extends the purple/gold/Tahoma identity; it was not extracted from a reference product page. No specifications, reviews, images, variants or stock were invented.

## Journey

1. Click a product image/title on `/marketplace`; each links to `/marketplace/products/[productId]`.
2. The URL carries normalized local `category` and `q` context. Return links restore the filtered browse view at `#deals`; arbitrary redirect URLs are ignored.
3. Details show the original single image, name, seller, rating, old/current price, discount and delivery copy. A visible local-data disclosure and delivery label avoid presenting fixture claims as current live facts.
4. Select an integer quantity from 1 to 99. This is a local UI limit, not an inventory assertion. Displayed totals are item subtotals only, excluding any fees; no new delivery-fee or tax policy is inferred.
5. Add opens the shared cart. Repeated additions merge by product ID. The cart supports quantity changes and explicit removal, displays each line subtotal and the combined subtotal, and counts total units in header badges.
6. Invalid quantities/unknown products/overflow do not mutate the cart or report successful addition. Add is disabled at the limit; the detail screen explains a quantity that would exceed it.
7. Checkout is visibly disabled with a local-demo/pending explanation until the next UI slice. No order is implied.

Cart and favorites stay in the provider mounted in the Marketplace layout, so client navigation between listing and details shares their state. Cart drawer is mounted once in that layout. Full reload resets this non-persisted state. Native browser interaction verification remains outstanding.

## Components and functions

| Location                                                                            | Responsibility                                                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `app/marketplace/products/[productId]/page.tsx`                                     | Local lookup, awaited route params, product metadata, normalized back link and notFound |
| Nested `not-found.tsx`                                                              | Arabic missing-product view and return link                                             |
| `components/product-detail/product-detail-page.tsx`                                 | Server composition, no catalog business logic                                           |
| `../navigation/marketplace-site-header.tsx`                                         | Full shared Marketplace header/search/navigation/menu                                   |
| `product-media.tsx`                                                                 | The original single image, discount and reusable favorite control                       |
| `product-info.tsx`                                                                  | Existing product facts and demo disclosure                                              |
| `product-purchase.tsx`                                                              | Local selection, subtotal, quantity-limit feedback and add action                       |
| `components/catalog/product-price.tsx`, `product-rating.tsx`, `favorite-button.tsx` | Reused by product cards and details                                                     |
| `src/components/marketplace/quantity-selector.tsx`                                  | Shared decrement/output/increment controls, labels and bounds                           |
| `model/product-navigation.ts`                                                       | Safe product and back URLs retaining only known browse context                          |
| `model/catalog.ts`                                                                  | Local lookup, quantity validation, unit count and subtotal derivation                   |
| `cart/state/cart-slice.ts` / `favorites/state/favorites-slice.ts`                   | `{productId, quantity}` lines, merged add/update/remove and scoped favorites            |

Changing from duplicate reference cart rows to merged quantity lines is an explicit approved UI extension. There is no persistent schema migration, shared API contract change or stock claim.

## Verification

- TypeScript and production build passed. Build required retry after the existing Next.js security reminder; upgrading that dependency remains a separate task.
- 8 focused tests passed: existing search/favorites cases plus quantity merge/update/removal, per-provider isolation, exact local subtotals/unit counts, invalid IDs/quantities/overflow, and safe product/return URL context.
- Production HTTP: listing 200 with 10 product links (image and title for 5 products), detail IDs 0 and 4 returned 200 with one shared cart, and missing ID returned 404 with the Arabic not-found screen.
- Browser initialization still fails with missing sandboxPolicy. No click, actual state preservation across client navigation, keyboard/focus, console, mobile screenshot or visual comparison result is claimed.

## Next acceptance checks

At 375/390/768/1024/1440 widths, test card-to-detail navigation, back-to-filtered-results, header/cart badge continuity, favorites continuity, add selected quantity, repeated adds, increase/decrease boundaries, removal and focus return. Verify no overlap, overflow, unexpected backend requests or inaccessible controls. The next functional slice can add a local cart-review/checkout journey; backend remains deferred.
