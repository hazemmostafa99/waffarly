# Marketplace interactions

The cart review CTA now opens `/marketplace/checkout`. The local demo validates
contact/address fields, supports pickup/delivery and editing before review, guards
duplicate confirmation, detects a basket changed during the local delay, and shows
explicit demo success without personal data. Only an unchanged basket is cleared.
No real order/payment is sent, and no automated checks ran for this slice. See
[checkout behavior and manual checklist](marketplace-local-checkout.md).

Cart review: the drawer's Review Cart link closes the drawer and navigates to
`/marketplace/cart`. The page shares quantity/removal state and derived totals with
the drawer, and renders an empty state after the last removal. Checkout is visibly
disabled pending the next local-only flow. No automated verification was run for
this slice, per user request; see [manual review notes](marketplace-cart-review.md).

## Current product/cart extension (supersedes duplicate-row behavior below)

Image/title links now open the local product detail route, retaining submitted
search/category for return navigation. Details support a local quantity selector,
shared favorites and add-to-cart. Cart lines now merge by product ID, support
quantity updates and removal, and derive subtotals and badge unit counts. Limits
are UI-only; no stock/fees/backend is inferred. The drawer is shared in the layout.
Checkout is visibly disabled pending its own local-only UI slice. The source
behavior table below describes the original reference; current approved changes
and test evidence are in [product details](marketplace-product-details.md).

Evidence level: behavior inferred directly from the downloaded inline JavaScript. It has not been exercised in a browser yet. No original backend is contacted.

| Source behavior                                                                            | Local implementation                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Search on form submit, selected category AND trimmed case-sensitive substring of data-name | Local React filter over extracted searchName/category; typing alone does not filter |
| Category click activates that card, filters using current input text and scrolls to deals  | URL category ID + submitted query; keyboard Enter/Space added                       |
| Each add click appends one cart line, including duplicates                                 | Zustand product ID/quantity lines; repeated additions merge                         |
| Cart count equals line count; total sums item prices                                       | Derived quantity count/subtotals, formatted through Intl ar-EG                      |
| Remove deletes clicked line                                                                | Zustand product ID removal                                                          |
| Favorite toggles outline/filled heart                                                      | Zustand favorites IDs and aria-pressed                                              |
| Cart link/mobile cart opens left drawer; close/overlay closes                              | Zustand cartOpen; original transitions retained                                     |
| Add displays toast for 1800ms                                                              | React timer with cleanup; role=status                                               |
| Countdown begins at 05:42:18 and ticks once per second to zero                             | Local interval, resets on remount, no claim of server deadline                      |
| Hero buttons scroll to deals/stores                                                        | scrollIntoView with smooth behavior                                                 |

Accessibility additions: category keyboard activation, named favorite/remove controls, cart dialog semantics, focus trap, Escape close and focus return. Closed drawer hidden from focus. These are local improvements, not claims about original behavior.

The source menu, checkout, seller signup, most mobile-nav controls, app badges and href=# links had no handlers. Local navigation now deliberately extends that behavior: the header menu works; mobile home/categories/search/cart have actions; header account/orders, mobile account and menu seller entry show pending-page notices. Other checkout/footer/store/banner placeholders remain for later local-only slices. No real authentication, payment or order flow is implied. There is no cart persistence across reloads yet; QueryClient remains provisioned without fake network requests.

## Cleanup boundary

The earlier component/provider cleanup preserved source behavior. The newer [navigation slice](marketplace-navigation.md) explicitly extends it: query/category are URL-owned, category navigation uses the committed search query rather than unsubmitted draft text, and mobile/header controls have deliberate outcomes. Menu/modal state stays local. Native dialog provides keyboard containment, Escape/backdrop dismissal and focus return by implementation; browser confirmation is still pending. Full account/order/checkout flows remain on the local-data roadmap, not backend prerequisites.
