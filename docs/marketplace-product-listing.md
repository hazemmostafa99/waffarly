# Local product listings

The Marketplace now has separate routes for the full product catalog and discounted
products:

- /marketplace/products lists all five product records in the current reference
  fixture.
- /marketplace/offers lists records with a previous price.

Both pages share the same small search, category and sorting controls, plus
URL-backed pagination. Product details preserve which listing the shopper came
from, including the selected category, search term, sort order and page.

The homepage product section is labeled “منتجات السوق” and links directly to the
full listing. Its deal label links separately to all offers.

The listing uses reference.json only. Merchant detail examples remain explicitly
local mock scenarios and are not mixed into the global catalog. No backend,
product fixtures or real catalog records were added. The product-card grid,
filter states, direct links, responsive layout and return path still need manual
browser review; no tests, build or browser checks were run for this change.
