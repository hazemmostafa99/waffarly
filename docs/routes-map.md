# Marketplace routes map

## Local order history and detail

- `/orders` lists product-only demo orders created during the current
  mounted session. The header, menu, footer, and checkout confirmation link here.
- `/orders/[orderId]` shows the selected demo order's item snapshot,
  total, local confirmation time and delivery/pickup choice. Unknown or refreshed
  session IDs show an honest unavailable state because this history is in memory.
- `/orders/[orderId]/tracking` shows a local timeline that advances
  only when the shopper presses the demo control. Order details can add eligible
  items from that order back into the current cart.

These are UI-only flows backed by the local Zustand store. They contain no contact
details, account identity, backend request, actual fulfillment, or real order status.

## Local favorites

- `/favorites` lists saved fixture products and supports removing them
  with the shared heart control. The header, navigation menu and footer link here.
- An empty list offers a return link to the marketplace product section.

Favorites use the feature-owned Zustand slice and remain in memory for the current
Marketplace session only. See [favorites flow](marketplace-favorites.md).

## Local store and restaurant details

- `/stores/[storeId]` opens the selected fixture store and its matching
  fixture products. تك زون also shows two labeled mock examples for the UI flow.
- `/restaurants/[restaurantId]` shows fixture restaurant information.
  بيت البرجر also has an explicitly labeled local mock menu for UI walkthroughs.
- Home cards link to both route types; invalid IDs show not-found states.

IDs are URL-encoded fixture names for local navigation. These are UI extensions,
not routes observed on the reference site. See
[store and restaurant details](marketplace-store-and-restaurant-details.md).

## Marketplace discovery and merchant entry

- `/stores` lists the local fixture stores, supports name/activity
  search, and links each card to its existing store detail route.
- `/offers` lists fixture products with a populated previous price;
  it reuses the product cards, cart and favorites interactions. Search, category,
  price/discount sorting and pagination are local and URL-backed; product details
  return to the same offers selection.
- /products lists all five products currently present in the local
  reference fixture. Search, category, price/discount sorting and pagination are
  local and URL-backed; product details return to that same catalog selection.
- The home has a full-products preview and a separate offers section. The
  “عروض اليوم” navigation item, hero CTA and offers-section link open the
  discounted-products route.
- `/account` starts as a guest and supports entering/leaving a demo
  account. Its address book selects a fictional address that prefills local checkout;
  the account view also links to current-session orders and favorites. See
  [demo address book](marketplace-address-book.md).
- `/account/sign-in` and `/account/sign-up` are separate
  styled UI pages. Their local validation messages never authenticate/create a
  real account; password fields are cleared after valid submission.
- Route transitions for merchant entry, all stores, products and offers use
  responsive page-shaped skeletons and a shared Marketplace header skeleton.
- `/join` is linked from the Marketplace merchant CTA and uses the Marketplace
  tokens and shell. Its application form validates locally and shows a demo
  confirmation; it does not call `/merchant-applications` or create an account.

Latest local flow: `/checkout` now hosts details -> review -> explicit
demo confirmation on the same route. Entry is the cart review CTA; empty baskets
link to browsing. No server order/auth/payment routes were added. See
[local checkout](marketplace-local-checkout.md); manual QA remains pending.

## Local cart review

`/cart` now provides a full review of the existing in-memory basket:
quantity updates, removal, item subtotal and empty state. The shared drawer links
to it via Next Link. Checkout uses the local demo flow; no backend integration exists.
Manual QA only for this slice; see [cart review](marketplace-cart-review.md).

## Local product detail extension

`/products/[productId]` resolves local IDs `0` through `4`, with product-specific
metadata and a custom 404 for unknown IDs. Product links preserve their source:
the selected products/offers listing, the home products section, or the home offers
section. These are local UI routes, not extracted original-site routes. See
[product slice](marketplace-product-details.md) for behavior and verification.

Inspected public source URL: https://wafarly-marketplace.rassameldeeb.chatgpt.site/

The downloaded HTML contains one page and fragment links, with no additional page routes exposed. This does not prove the host has no other routes. No speculative route probing was performed.

| Source destination | Local equivalent         | Meaning                                                       |
| ------------------ | ------------------------ | ------------------------------------------------------------- |
| /                  | /                        | Marketplace homepage                                          |
| #categories        | /#categories             | Category section                                              |
| #restaurants       | /#restaurants            | Restaurant section (section ID in markup)                     |
| #deals             | /#deals                  | Product deals                                                 |
| #stores            | /#stores                 | Featured stores                                               |
| #                  | #                        | Reference placeholder; retained without inventing destination |

The Marketplace homepage is `/`, organized under the invisible `(marketplace)` route group. The unused business landing page and its route group have been removed. `/join` remains a separate local merchant-application flow, and `/s/[slug]` remains the tenant storefront route. Development requests to the former `/marketplace` prefix redirect to the matching root-based route. The reference has no product-detail, restaurant-detail, checkout, login or store-detail route linked in its HTML; corresponding local storefront routes are not claimed as reference routes.

## Local navigation extension

See [product listing details](marketplace-product-listing.md) for the shared local
catalog and offers behavior.

Submitted search and category now use `/?q=<text>&category=<local ID>#deals`. Direct URLs render filtered local fixture results. `mobiles` and `electronics` are distinct card IDs sharing the fixture electronics filter. Home resets owned filters; other section links preserve them. No HTTP mock endpoints or backend integration were added. Favorites and order links open local pages. Seller entry, all stores, all products, all offers and the demo account now open local flows. See [URL contract](marketplace-navigation.md).
