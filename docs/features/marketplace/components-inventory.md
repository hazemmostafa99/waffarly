# Marketplace components inventory

Current revision: the Marketplace has been migrated to Tailwind component utilities,
shared @waffarly/ui adapters and feature-owned folders. No automated verification
was run for this refactor, per user instruction; earlier checks below are historical.
See [current architecture](marketplace-architecture.md) and [refactor scope](marketplace-tailwind-refactor.md).

Checkout components are grouped under `features/marketplace/checkout/components`: CheckoutPage,
CheckoutContactForm, CheckoutFulfillmentFields, CheckoutReview, CheckoutOrderSummary,
CheckoutConfirmation and `useLocalCheckout` in its hooks folder. UI types/validation live in
`checkout/model/checkout.ts`; the store atomically verifies the basket snapshot, records a
product-only demo order and clears the basket. The orders feature adds OrdersPage,
OrderDetailPage, OrdersEmptyState and OrderStatusBadge. See [local checkout](marketplace-local-checkout.md).

Cart-review additions: CartReviewPage, CartReviewItem, CartSummary and CartEmptyState
are grouped under `features/marketplace/cart/components`. They reuse QuantitySelector,
the shared money/cart helpers and the composed Zustand store. Cart actions are owned
by `cart/state/cart-slice.ts`; drawer footer links to the full review page. Favorites
and orders state live in their owning feature folders, and checkout owns the atomic
cross-feature completion action.

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

| Component                                        | Implemented responsibility                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| MarketplaceHeader                                | Promo, original logo, delivery location, search form, account dropdown, cart actions and scrolling navigation       |
| MarketplaceHero                                  | Original headline, copy, hero asset, deal tags and scroll buttons; trust strip                                      |
| SectionHeading                                   | Shared section headings and reference placeholder links                                                             |
| MarketplaceHome categories                       | 8 extracted categories with active state and keyboard support                                                       |
| MarketplaceRestaurants                           | 12 restaurant cards with original images, offers, ratings, times                                                    |
| MarketplaceProducts / ProductCard                | Home catalog preview, local filtering and add to cart; links to all products                                        |
| MarketplaceOffersSection                         | Separate home grid of up to five discounted products, countdown and all-offers link                                 |
| FavoriteButton                                   | Shared favorite toggle owned by `features/marketplace/favorites`                                                    |
| FavoritesPage / FavoritesEmptyState              | Saved fixture products, favorite removal, add-to-cart and empty state                                               |
| StoreDetailPage / RestaurantDetailPage           | Fixture profiles, matching products and explicitly labeled local restaurant menu samples                            |
| FlashCountdown                                   | Original 05:42:18 countdown, cleaned-up interval lifecycle                                                          |
| MarketplaceStores                                | 6 extracted stores, seller banner and app strip                                                                     |
| MarketplaceStoresIndexPage / StoreCard           | Searchable all-store listing linked to fixture store details                                                        |
| MarketplaceProductListingPage                    | Shared all-products/offers listing composition using reference products and URL-backed filters                      |
| ProductListingFilters / ProductListingPagination | Small catalog controls and query-preserving page navigation                                                         |
| MerchantEntryPage / MerchantApplicationForm      | Marketplace-styled seller page with local validation and an explicit demo confirmation                              |
| MarketplaceFooter                                | Original logo, copy, columns and placeholder links                                                                  |
| MarketplaceCart                                  | Merged quantity lines, unit counts/subtotals, overlay, focus management and Escape close                            |
| OrdersPage / OrderDetailPage / OrderTrackingPage | Session-only order history, detail, interactive local status timeline, reorder-to-cart and empty/unavailable states |
| MarketplaceHome mobile nav                       | Reference mobile navigation; only cart has a handler in original source                                             |
| MarketplaceProviders                             | Per-provider Zustand and QueryClient instances                                                                      |
| AccountPage / AccountDashboard / DemoAddressBook | Demo guest entry, session state, fictional address selection and order/favorites summary                            |
| AuthPageShell / SignInPage / SignUpPage          | Shared branded auth layout with separate local-only sign-in and sign-up form states                                 |
| MarketplaceContainer                             | Reference container dimensions                                                                                      |
| MarketplaceSkeleton                              | Shared animated placeholder primitive with reduced-motion support                                                   |
| MarketplaceHeaderSkeleton                        | Promo, brand/search/actions and navigation placeholders matching the Marketplace header                             |
| MerchantEntrySkeleton                            | Compact hero, form and helper-panel loading layout                                                                  |
| MarketplaceStoresSkeleton                        | Search and responsive store-card loading layout                                                                     |
| MarketplaceProductListingSkeleton                | Responsive product-listing loading layout shared by products and offers                                             |

Data is separated into `apps/storefront/src/features/marketplace/data/reference.json`. Search drafts stay local; submitted category/query state comes from the URL. Account, cart, favorites and orders use feature-owned Zustand slices composed into one provider-scoped store. React Query remains available but unused because the inspected source has no catalog API.

The navigation slice adds MarketplaceSearchForm, MarketplaceNavigationLinks, MarketplaceMenu, MarketplacePendingFeature and shared MarketplaceDialog. Header/menu reuse typed destinations; mobile controls now navigate/focus/open the drawer or show pending-page feedback. Pure URL helpers and navigation/search hooks are separated from presentation. See [navigation implementation](marketplace-navigation.md); interactive browser verification is still pending.

## Current organization

See [component architecture](marketplace-architecture.md) for the current file tree. The old marketplace-sections.tsx module was split into home, catalog and navigation compositions. Category selection and mobile navigation now have named components, and ProductCard/FlashCountdown are separate files. SectionHeading and MarketplaceContainer are shared primitives. All feature-specific providers/state remain inside features/marketplace.
