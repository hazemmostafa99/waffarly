# Marketplace routes map

## Local cart review

`/marketplace/cart` now provides a full review of the existing in-memory basket:
quantity updates, removal, item subtotal and empty state. The shared drawer links
to it via Next Link. Checkout is visibly pending, with no new backend integration.
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

Submitted search and category now use `/marketplace?q=<text>&category=<local ID>#deals`. Direct URLs render filtered local fixture results. `mobiles` and `electronics` are distinct card IDs sharing the fixture electronics filter. Home resets owned filters; other section links preserve them. No new page routes, HTTP mock endpoints or backend integration were added. Header/mobile account/order controls and the menu seller entry show pending-page feedback rather than call real services. Footer/store/section-heading placeholders remain outside this slice. See [URL contract](marketplace-navigation.md).
