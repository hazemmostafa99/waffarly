# Local product listings

The Marketplace now has separate routes for the full product catalog and discounted
products:

- /products lists all five product records in the current reference
  fixture.
- /offers lists records with a previous price.

Both pages share the same small search, category and sorting controls, plus
URL-backed pagination. Product details preserve which listing the shopper came
from, including the selected category, search term, sort order and page.

The homepage has two distinct product collections: “منتجات السوق” and “عروض
اليوم”. Each displays up to five matching products from the current fixture.
Because all five current fixture products have previous prices, those same items
appear in both collections for now.
The offers collection has its own countdown and “عرض كل العروض” link; the
“عروض اليوم” navigation item and hero CTA also open the all-offers route.
Product detail links return shoppers to the collection they opened.

The listing uses reference.json only. Merchant detail examples remain explicitly
local mock scenarios and are not mixed into the global catalog. No backend,
product fixtures or real catalog records were added. The product-card grid,
filter states, direct links, responsive layout and return path still need manual
browser review; no tests, build or browser checks were run for this change.
