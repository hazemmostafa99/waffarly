# Marketplace routes map

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
