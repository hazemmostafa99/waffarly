# Marketplace interactions

The cart review CTA opens `/checkout`. The local demo validates
contact/address fields, supports pickup/delivery and editing before review, guards
duplicate confirmation, and atomically verifies the basket before it is cleared.
Successful confirmation adds a product-only demo record to the in-memory Zustand
store. Header/menu/footer and confirmation link to `/orders`, with
`/orders/[orderId]` for details. No contact details are recorded and no
real order/payment is sent. Both routes clearly explain that refresh clears history.
No tests, browser runs, typecheck or build were run for this slice, per user instruction.
See [checkout behavior and manual checklist](marketplace-local-checkout.md).

Order detail now links to `/orders/[orderId]/tracking`, where a local
timeline advances one demo stage per click and reflects the new status in order
history. The order detail also supports adding each still-eligible item and its
original quantity back into the current cart; capped or unavailable products are
reported as skipped. These actions remain provider-scoped, reset on reload and do
not claim real shipping or fulfillment. See
[local tracking and reorder](marketplace-order-tracking.md).

The demo account page includes a selectable address book populated only with
fictional sample addresses. The selected sample prefills delivery checkout for an
active demo account; the checkout field remains editable and transient. No address
entry form, customer address, browser persistence or backend request is involved.
See [demo address book](marketplace-address-book.md).

Cart review: the drawer's Review Cart link closes the drawer and navigates to
`/cart`. The page shares quantity/removal state and derived totals with
the drawer, and renders an empty state after the last removal. The checkout CTA
continues through the local demo checkout. See [manual review notes](marketplace-cart-review.md).

Favorites: the product heart toggles an ID in the feature-owned Zustand slice.
`/favorites` resolves those IDs against the fixture catalog; the shared
heart control removes an item from that page. Header, menu and footer links open the
page, and its empty state returns to product browsing. Favorites remain in memory
until refresh. See [favorites flow](marketplace-favorites.md).

Stores and restaurants: their home cards open fixture-backed detail routes. Store
pages show fixture products by seller match plus clearly labeled local sample items.
بيت البرجر has a sample menu with example prices; it is separate from reference data.
Unknown local IDs show not-found pages. See
[store/restaurant details](marketplace-store-and-restaurant-details.md).

The home has distinct products and offers sections; their product links return
to the same section after detail. The products section links to
/products, and the offers section, hero CTA and “عروض اليوم”
navigation item open /offers. Both listings support search, category,
price/discount sorting and pagination;
category, query, sort and page are represented in the URL. Product detail links
preserve the source listing and its selection for the return link. The full
catalog currently contains five records from reference.json; no products or
backend requests were added. Browser review remains pending.

## Current product/cart extension (supersedes duplicate-row behavior below)

Image/title links now open the local product detail route, retaining submitted
search/category for return navigation. Details support a local quantity selector,
shared favorites and add-to-cart. Cart lines now merge by product ID, support
quantity updates and removal, and derive subtotals and badge unit counts. Limits
are UI-only; no stock/fees/backend is inferred. The drawer is shared in the layout.
Checkout is a local-only flow with demo confirmation and session-only order history.
The source behavior table below describes the original reference; implementation
notes are in [product details](marketplace-product-details.md) and
[local checkout](marketplace-local-checkout.md).

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

The source menu, checkout, seller signup, most mobile-nav controls, app badges and href=# links had no handlers. Local navigation now deliberately extends that behavior: the header menu works; the desktop account control opens a dropdown with account, sign-in/sign-up, order and favorites destinations; it closes on Escape, outside pointer, focus leaving the panel, or link selection. Mobile home/categories/search/cart/account have actions. Separate sign-in and sign-up screens validate required fields locally, clear password state after valid submission, and explicitly say no account was authenticated or created. The account page enters/leaves a demo session held only in the provider-scoped Zustand store. It does not persist credentials or profile PII. No real authentication, payment or fulfillment is implied. Cart, favorites, demo account state and demo orders are not persisted across reloads; QueryClient remains provisioned without fake network requests.

## Cleanup boundary

The earlier component/provider cleanup preserved source behavior. The newer [navigation slice](marketplace-navigation.md) explicitly extends it: query/category are URL-owned, category navigation uses the committed search query rather than unsubmitted draft text, and mobile/header controls have deliberate outcomes. Menu/modal state stays local. Native dialog provides keyboard containment, Escape/backdrop dismissal and focus return by implementation; browser confirmation is still pending. Account remains on the local-data roadmap, not a backend prerequisite.
