# Local store and restaurant details

The home store and restaurant cards now open local detail routes:

- `/stores/[storeId]`
- `/restaurants/[restaurantId]`

Route IDs are URL-encoded names from the existing fixture records. They are local
navigation identifiers, not extracted production IDs. Invalid IDs use each route's
not-found state.

Store details show the existing store identity and products whose fixture seller
matches that store name. A store without matching products or a labeled sample shows
an empty state. Product cards retain add-to-cart, favorites and detail behavior.

Restaurant details show its existing cover, logo, offer, category text, rating and
delivery-time text. The reference fixture has no restaurant menu or item prices.
For this UI walkthrough only, the separate `data/merchant-detail-scenarios.json`
contains a clearly labeled mock menu for **بيت البرجر**. All items and prices in that
menu are examples and are excluded from the extracted reference data.

The same scenario file adds two sample products to **تك زون**, alongside its one
reference product. The sample catalog is separate from homepage search/category
results, but product cards can open details, be favorited, and enter the local cart.
Mock items are labeled on cards and detail pages; they have no verified rating or
verified-seller claim. Prices use the shared Western-digit formatter.

Example items:

| Location   | Example item              | Demo price |
| ---------- | ------------------------- | ---------: |
| تك زون     | حامل هاتف مكتبي قابل للطي |    249 ج.م |
| تك زون     | كابل شحن USB-C بطول مترين |    149 ج.م |
| بيت البرجر | برجر كلاسيك               |    185 ج.م |
| بيت البرجر | تشيز برجر                 |    215 ج.م |
| بيت البرجر | بطاطس مقرمشة              |     75 ج.م |

These pages are local UI extensions; the public reference does not expose these
detail routes. No API calls or backend integration were added. Manual review should
open تك زون and بيت البرجر, add a sample product to the cart, favorite it, open its
detail, and test unknown IDs; then check links/layout on mobile. No tests or build were run
for this slice, per user instruction.
