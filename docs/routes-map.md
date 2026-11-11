# Marketplace routes map

## Local order history and detail

- `/marketplace/orders` lists product-only demo orders created during the current
  mounted session. The header, menu, footer, and checkout confirmation link here.
- `/marketplace/orders/[orderId]` shows the selected demo order's item snapshot,
  total, local confirmation time and delivery/pickup choice. Unknown or refreshed
  session IDs show an honest unavailable state because this history is in memory.

These are UI-only flows backed by the local Zustand store. They contain no contact
details, account identity, backend request, actual fulfillment, or real order status.

## Local favorites

- `/marketplace/favorites` lists saved fixture products and supports removing them
  with the shared heart control. The header, navigation menu and footer link here.
- An empty list offers a return link to the marketplace product section.

Favorites use the feature-owned Zustand slice and remain in memory for the current
Marketplace session only. See [favorites flow](marketplace-favorites.md).

## Local store and restaurant details

- `/marketplace/stores/[storeId]` opens the selected fixture store and its matching
  fixture products. تك زون also shows two labeled mock examples for the UI flow.
- `/marketplace/restaurants/[restaurantId]` shows fixture restaurant information.
  بيت البرجر also has an explicitly labeled local mock menu for UI walkthroughs.
- Home cards link to both route types; invalid IDs show not-found states.

IDs are URL-encoded fixture names for local navigation. These are UI extensions,
not routes observed on the reference site. See
[store and restaurant details](marketplace-store-and-restaurant-details.md).

## Marketplace discovery and merchant entry

- `/marketplace/stores` lists the local fixture stores, supports name/activity
  search, and links each card to its existing store detail route.
- `/marketplace/offers` lists fixture products with a populated previous price;
  it reuses the product cards, cart and favorites interactions.
- `/join` is linked from the Marketplace merchant CTA and uses the Marketplace
  tokens and shell. Its application form validates locally and shows a demo
  confirmation; it does not call `/merchant-applications` or create an account.

Latest local flow: `/marketplace/checkout` now hosts details -> review -> explicit
demo confirmation on the same route. Entry is the cart review CTA; empty baskets
link to browsing. No server order/auth/payment routes were added. See
[local checkout](marketplace-local-checkout.md); manual QA remains pending.

## Local cart review

`/marketplace/cart` now provides a full review of the existing in-memory basket:
quantity updates, removal, item subtotal and empty state. The shared drawer links
to it via Next Link. Checkout uses the local demo flow; no backend integration exists.
Manual QA only for this slice; see [cart review](marketplace-cart-review.md).

## Local product detail extension

`/marketplace/products/[productId]` now resolves existing local IDs `0` through `4`,
with product-specific metadata and a custom 404 for unknown IDs. Image/title links
retain normalized `q` and `category`; return links restore `/marketplace?...#deals`.
This route is an approved local UI extension, not an extracted original-site route.
See [product slice](marketplace-product-details.md) for behavior and verification.

Inspected public source URL: https://wafarly-marketplace.rassameldeeb.chatgpt.site/

The downloaded HTML contains one page and fragment links, with no additional page routes exposed. This does not prove the host has no other routes. No speculative route probing was performed.

| Source destination | Local equivalent         | Meaning                                                       |
| ------------------ | ------------------------ | ------------------------------------------------------------- |
| /                  | /marketplace             | Marketplace homepage                                          |
| #categories        | /marketplace#categories  | Category section                                              |
| #restaurants       | /marketplace#restaurants | Restaurant section (section ID in markup)                     |
| #deals             | /marketplace#deals       | Product deals                                                 |
| #stores            | /marketplace#stores      | Featured stores                                               |
| #                  | #                        | Reference placeholder; retained without inventing destination |

Existing local `/`, `/join` and `/s/[slug]` routes are preserved. Marketplace is temporarily served at `/marketplace` and marked noindex. The reference has no product-detail, restaurant-detail, checkout, login or store-detail route linked in its HTML; corresponding local storefront routes are not claimed as reference routes.

## Local navigation extension

Submitted search and category now use `/marketplace?q=<text>&category=<local ID>#deals`. Direct URLs render filtered local fixture results. `mobiles` and `electronics` are distinct card IDs sharing the fixture electronics filter. Home resets owned filters; other section links preserve them. No HTTP mock endpoints or backend integration were added. Favorites and order links open local pages. Seller entry, all stores and all offers now open local pages; account remains pending. See [URL contract](marketplace-navigation.md).
