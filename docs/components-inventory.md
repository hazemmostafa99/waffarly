# Marketplace components inventory

Checkout components are grouped under `components/checkout`: CheckoutPage,
CheckoutContactForm, CheckoutFulfillmentFields, CheckoutReview, CheckoutOrderSummary,
CheckoutConfirmation and useLocalCheckout. UI types/validation live in
`model/checkout.ts`; the store adds atomic unchanged-snapshot basket clearing.
No automated validation was run for this slice; see [local checkout](marketplace-local-checkout.md).

Cart-review additions: CartReviewPage, CartReviewItem, CartSummary and CartEmptyState
are grouped under `features/marketplace/components/cart`. They reuse QuantitySelector,
the shared money/cart helpers and the existing store. Drawer footer now links to
the full review page. This slice is awaiting user manual QA, without automated checks.

Layout follow-up: shared MarketplaceSiteHeader owns full header/menu/mobile
composition on both listing and details; the minimal ProductDetailHeader was
removed. ProductBreadcrumbs and ProductSellerCard are grouped with product details.

Latest product slice: ProductDetailPage, ProductDetailHeader, ProductMedia,
ProductInfo and ProductPurchase are grouped under `components/product-detail`.
ProductPrice/ProductRating/FavoriteButton are reused by cards and details;
QuantitySelector is shared by purchase and cart. The single Cart drawer is mounted
in MarketplaceLayout, and its quantity-aware lines are shared across client route
changes. See [product component responsibilities](marketplace-product-details.md).

Evidence: saved public HTML/CSS/JS; not yet inspected through a rendered browser.

| Component                         | Implemented responsibility                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| MarketplaceHeader                 | Promo, original logo, delivery location, search form, account/cart actions, scrolling navigation |
| MarketplaceHero                   | Original headline, copy, hero asset, deal tags and scroll buttons; trust strip                   |
| SectionHeading                    | Shared section headings and reference placeholder links                                          |
| MarketplaceHome categories        | 8 extracted categories with active state and keyboard support                                    |
| MarketplaceRestaurants            | 12 restaurant cards with original images, offers, ratings, times                                 |
| MarketplaceProducts / ProductCard | 5 products, filtering, favorites and add to cart                                                 |
| FlashCountdown                    | Original 05:42:18 countdown, cleaned-up interval lifecycle                                       |
| MarketplaceStores                 | 6 extracted stores, seller banner and app strip                                                  |
| MarketplaceFooter                 | Original logo, copy, columns and placeholder links                                               |
| MarketplaceCart                   | Merged quantity lines, unit counts/subtotals, overlay, focus management and Escape close         |
| MarketplaceHome mobile nav        | Reference mobile navigation; only cart has a handler in original source                          |
| MarketplaceProviders              | Per-provider Zustand and QueryClient instances                                                   |
| MarketplaceContainer              | Reference container dimensions                                                                   |

Data is separated into `apps/storefront/src/features/marketplace/data/reference.json`. Search drafts stay local; submitted category/query state comes from the URL. Cart/favorites/drawer state uses Zustand. React Query remains available but unused because the inspected source has no catalog API.

The navigation slice adds MarketplaceSearchForm, MarketplaceNavigationLinks, MarketplaceMenu, MarketplacePendingFeature and shared MarketplaceDialog. Header/menu reuse typed destinations; mobile controls now navigate/focus/open the drawer or show pending-page feedback. Pure URL helpers and navigation/search hooks are separated from presentation. See [navigation implementation](marketplace-navigation.md); interactive browser verification is still pending.

## Current organization

See [component architecture](marketplace-architecture.md) for the current file tree. The old marketplace-sections.tsx module was split into home, catalog and navigation compositions. Category selection and mobile navigation now have named components, and ProductCard/FlashCountdown are separate files. SectionHeading and MarketplaceContainer are shared primitives. All feature-specific providers/state remain inside features/marketplace.
