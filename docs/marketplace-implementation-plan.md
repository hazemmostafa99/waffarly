# Marketplace implementation guide

This is the entry point for the current Marketplace architecture, source evidence and remaining work. It replaces the historical foundation-only plan.

## Current status

The local page at `/marketplace` reconstructs the public reference homepage from saved HTML/CSS/JS: original purple/gold theme, Tahoma font stack, logo, 8 categories, 12 restaurants, 5 products and 6 stores. Filtering, favorites, duplicate cart lines, removal, totals, drawer and countdown work locally. Reference code was inspected; rendered browser comparison is still pending. No live marketplace catalog/customer/payment API is connected.

The existing Next.js app, business landing `/`, merchant application `/join` and tenant storefront `/s/[slug]` are preserved. There is no new standalone app and no change to API/database/shared contracts in this cleanup.

## Read next

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
