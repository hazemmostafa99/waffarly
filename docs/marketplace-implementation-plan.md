# Marketplace implementation guide

This is the entry point for the current Marketplace architecture, source evidence and remaining work. It replaces the historical foundation-only plan.

## Active user decision: finish the UI before backend integration

Build every Marketplace screen and complete user flow using the existing local
`reference.json` and explicitly labeled local mock scenarios. Do not call backend
APIs, require API/database processes, create mock HTTP servers or change backend
contracts in this phase. Missing endpoints do not block UI completion. Simulated
orders, accounts, payments and tracking must be visibly identified as demos.
Backend integration is deferred until the UI flows are complete and the user
explicitly requests that separate phase. Existing non-Marketplace routes remain
unchanged. This decision supersedes earlier backend-first sequencing.

## Current status

The local page at `/marketplace` reconstructs the public reference homepage from saved HTML/CSS/JS: original purple/gold theme, Tahoma font stack, logo, 8 categories, 12 restaurants, 5 products and 6 stores. Filtering, favorites, duplicate cart lines, removal, totals, drawer and countdown work locally. Reference code was inspected; rendered browser comparison is still pending. No live marketplace catalog/customer/payment API is connected.

The existing Next.js app, business landing `/`, merchant application `/join` and tenant storefront `/s/[slug]` are preserved. There is no new standalone app and no change to API/database/shared contracts in this cleanup.

## Read next

Latest slice: [local cart review](marketplace-cart-review.md), implemented without
automated checks per the user's manual-testing preference. Local checkout is next.

Latest slice: [local product details and quantity-aware cart](marketplace-product-details.md).

Latest local-data slice: [navigation and URL search](marketplace-navigation.md), including
implemented controls, URL rules, verification results and remaining browser checks.

1. [Architecture and component design](marketplace-architecture.md): actual folders, component tree, responsibilities and state ownership.
2. [Functional roadmap](marketplace-roadmap.md): dependency-ordered phases, user journeys, integration inventory, decisions and completion criteria.
3. [Cleanup audit](marketplace-cleanup.md): removed files/state/dependency declarations, retained packages and installation notes.

## Run and verify

Use Node `>=24.11.0 <25` and pnpm `10.34.5` from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @waffarly/storefront dev
pnpm --filter @waffarly/storefront typecheck
pnpm --filter @waffarly/storefront test:marketplace
pnpm --filter @waffarly/storefront build
```

Open `http://localhost:3000/marketplace`. Keep this development route noindex until its production URL, content/data readiness and release checks are agreed. The installed Next.js security advisory needs a separate dependency remediation before publication.

## Source and verification reports

- [Design system](design-system.md)
- [Assets manifest](assets-manifest.md)
- [Components inventory](components-inventory.md)
- [Routes map](routes-map.md)
- [Interactions](interactions.md)
- [Visual comparison](visual-comparison.md)
- [Limitations](limitations.md)

The reference snapshot remains in `docs/reference/marketplace/source.html` for visual validation. The temporary extractor and duplicate asset URL list have been removed; asset sources are documented in [the assets manifest](assets-manifest.md). The original user-provided extraction archive/audit/manifest/script are still absent. Do not equate source inspection, passing tests or successful compilation with pixel-perfect verification.
