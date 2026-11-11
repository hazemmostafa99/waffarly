# Marketplace cleanup audit

Scope: marketplace feature, its documentation, and confirmed redundant root package declarations. Existing tenant storefront/admin/merchant/POS features are retained. No source or asset is deleted solely because it is not imported by the marketplace.

## Removed or consolidated

Follow-up layout cleanup: removed `app/site-chrome.tsx`. WorkspaceChrome is now applied by `app/(business)/layout.tsx` to the moved home and join pages. Root layout no longer reads the pathname to choose a shell. `/`, `/join`, `/marketplace` and `/s/[slug]` keep their existing URLs.

Layout verification: production build and standalone TypeScript passed after route types were regenerated. Production HTTP checks returned 200 for `/`, `/join` and `/marketplace`; the first two include WorkspaceChrome and Marketplace excludes it. Browser visual checks remain pending. The existing Next.js security advisory persists; no dependency upgrade was included in this layout-only change.

| Item                                                 | Reason/evidence                                                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `react-router` direct dependency                | No direct imports found in app/package/test/script sources; router implementation still comes through the dashboards' own react-router-dom dependency |
| Root `react-router-dom` direct dependency            | Imported by super-admin and merchant-dashboard, both of which already declare it in their own package.json; no root consumer                          |
| `mobileMenuOpen` and `setMobileMenuOpen`             | No component or test consumed this speculative store state; menu implementation is planned, not pre-created                                           |
| `features/marketplace/api/query-client.ts`           | One-use factory moved into the feature provider; React Query itself is retained                                                                       |
| `components/marketplace-sections.tsx` catch-all      | Replaced by home, catalog, navigation components and shared SectionHeading; original functions/markup retained                                        |
| Inline category and mobile-navigation markup in Home | Extracted into named catalog/navigation components; event behavior unchanged                                                                          |
| Combined product list/card/countdown file            | Split into list, card and countdown responsibilities                                                                                                  |
| Root-level marketplace provider file                 | Moved under `features/marketplace/providers`; existing tenant provider remains under `src/providers`                                                  |
| Misleading UI-only store names                       | Renamed to MarketplaceState/createMarketplaceStore/useMarketplaceStore because it owns cart and favorites too                                         |
| Historical foundation plan                           | Replaced with a current documentation entry point plus architecture and phased functional roadmap                                                     |

The Marketplace store has since been decomposed into feature-owned Zustand slices:
cart, favorites, orders and checkout actions. `state/create-marketplace-store.ts`
composes those slices into one provider-scoped store so cross-feature checkout
updates remain atomic; feature hooks expose only their own state/action types.

No package version was upgraded. Lockfile regenerated offline with pnpm 10.34.5. Besides root importer removal, pnpm removes an optional react-dom peer binding from react-i18next's snapshot when no root react-dom resolution remains; React/React DOM are still declared by consuming apps. Router package snapshots remain because dashboards use them.

## Retained dependencies

All direct storefront dependencies have active uses:

| Package                                    | Usage                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| next / react / react-dom                   | Existing Next app and React components/runtime                                                          |
| @tanstack/react-query                      | Existing tenant catalog/cart/checkout mutations; Marketplace provider retained for planned server state |
| zustand                                    | Tenant cart/persistence and Marketplace state                                                           |
| lucide-react                               | Existing tenant product/menu/cart/account/checkout components                                           |
| @waffarly/contracts                        | Existing catalog, quote, merchant application and order transport types                                 |
| @waffarly/ui                               | Existing landing/join/tenant routes, localization, theme and shared primitives                          |
| TypeScript, type packages, shared tsconfig | Compile-time tooling and tsconfig extension                                                             |

Root Tailwind/PostCSS/Vite plugins, tw-animate-css, Playwright, tsx, ESLint, Prettier, TypeScript and Turbo remain used by workspace configs, shared CSS, tests and scripts. Dashboard router dependencies are untouched. Local Cairo/Tajawal fonts, restaurant images and old route features remain active in tenant storefronts. No speculative app-wide pruning was performed.

## Reference cleanup

The temporary extraction script and duplicate asset URL JSON were removed after extraction. Neither was a runtime or build dependency. `docs/reference/marketplace/source.html` remains as the original HTML/CSS/JS snapshot for the pending visual comparison. Asset URLs are retained in [assets-manifest.md](assets-manifest.md), and application content remains in `features/marketplace/data/reference.json`. The seven required reports remain at their requested paths. Build output, node_modules and local environment files are ignored operational state, not source cleanup targets.

## Install and validation notes

`pnpm install --lockfile-only --offline --ignore-scripts` succeeded. A full frozen offline install requested replacement of node_modules and aborted without a TTY before deletion; the existing installation was preserved. Manifest/lockfile cleanup is complete, but physical node_modules links have not been synchronized in this session. A normal `pnpm install --frozen-lockfile` with the supported Node version should synchronize them. Do not remove all modules or the shared pnpm cache just to remove two direct declarations.

Post-cleanup verification passed:

- Storefront, super-admin, merchant-dashboard and shared UI TypeScript checks using `node node_modules/typescript/bin/tsc -p <workspace>/tsconfig.json --noEmit`.
- `node --import tsx --test apps/storefront/src/features/marketplace/tests/marketplace.test.ts`: 3 tests passed.
- Production `next build`: passed after the existing-version security-advisory pause/retry.
- Production HTTP smoke test: status 200; 8 categories, 12 restaurants, 5 products, 6 stores, cart drawer and mobile navigation present in SSR HTML.
- Prettier and `git diff --check`: passed.

Source behavior and markup are intended to remain unchanged; pixel equivalence is still unmeasured because browser automation is unavailable. See [limitations](limitations.md).
