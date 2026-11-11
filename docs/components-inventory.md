# Marketplace components inventory

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
| MarketplaceCart                   | Duplicate cart lines, removal, total, overlay, focus management and Escape close                 |
| MarketplaceHome mobile nav        | Reference mobile navigation; only cart has a handler in original source                          |
| MarketplaceProviders              | Per-provider Zustand and QueryClient instances                                                   |
| MarketplaceContainer              | Reference container dimensions                                                                   |

Data is separated into `apps/storefront/src/features/marketplace/data/reference.json`. Search draft/filter state stays local; cart/favorites/drawer state uses Zustand. React Query remains available but unused because the inspected source has no catalog API.

## Current organization

See [component architecture](marketplace-architecture.md) for the current file tree. The old marketplace-sections.tsx module was split into home, catalog and navigation compositions. Category selection and mobile navigation now have named components, and ProductCard/FlashCountdown are separate files. SectionHeading and MarketplaceContainer are shared primitives. All feature-specific providers/state remain inside features/marketplace.
