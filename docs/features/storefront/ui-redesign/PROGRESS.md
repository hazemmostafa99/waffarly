# Restaurant Storefront UI Implementation Progress

## Mandatory Tracking Rules

This file must be updated after every implementation slice. It is the execution record for `FEATURE.md`.

- `[ ]` Not started
- `[~]` In progress or implemented but not fully verified
- `[x]` Complete and verified with evidence
- `[!]` Blocked by an explicit API, product, design, authorization, or environment dependency

Strict tracking requirements:

1. Never mark an item `[x]` without code plus verification evidence.
2. Visual completion requires browser comparison at the required viewports.
3. Backend completion requires contract, validation, service/database, and test coverage as applicable.
4. A passing typecheck alone does not complete a page.
5. Record exact commands and outcomes in the implementation log.
6. Record pre-existing failures separately from regressions introduced by the current slice.
7. Do not remove blockers. Resolve them or preserve their history with a dated decision.
8. Do not claim an unsupported prototype interaction is implemented with real data.
9. Update the current milestone, current slice, last verified commit/worktree state, and date before ending implementation work.
10. If scope or architecture changes, update `FEATURE.md` first and record the decision here.

## Current Status

- Overall: Core catalog-to-order pages plus the API-gap route UIs are implemented. The API-gap screens are explicitly preview-only; backend integration remains blocked on approved contracts and real data.
- Current milestone: UI-first coverage of every planned storefront route; keep API-gap integration backlog open.
- Current slice: Responsive preview UIs for order tracking, offers, branches, about, login, and account; localized navigation/footer links.
- Visual reference: Supplied Waffarly Bistro UI kit remains the design source; user-provided Wafarly Marketplace screenshots guide relative typography and density only.
- Target app: `apps/storefront`.
- Primary route namespace: `/s/[slug]`.
- Last updated: 2026-10-15.
- Last verified state: Uncommitted worktree; no commit created. Storefront lint, typecheck, production build, and `git diff --check` passed. The six preview routes returned HTTP 200 in 36 RTL/LTR × mobile/tablet/desktop checks with no horizontal overflow, missing preview disclosures, or page errors. Local offer filtering and login/register switching passed. Screenshots are saved for offers-mobile and branches-desktop. The actual API was unavailable; a temporary isolated catalog-shell fixture was stopped after verification.
- Worktree note: Preserve all pre-existing workspace edits. This slice added the preview route components and route files, linked them in the shared header/footer, updated the feature contract/progress, and saved verification screenshots. Existing number-formatting behavior and unrelated dirty API/workspace files were left untouched.

### 2026-10-15 - API-Gap Pages UI Scope Decision

- The user explicitly approved building every remaining storefront page now, including pages whose APIs do not exist yet, with backend integration to follow.
- Updated `FEATURE.md` first: added a narrow, enforceable preview-only exception for tracking, offers, branches, about, and account/login. Each route must visibly disclose preview state; interactions must stay local; no preview content may affect live catalog, Zustand cart/favorites, checkout, pricing, order state, customer data, or API calls.
- Existing backend gaps remain open integration blockers. This decision does not add endpoints, contracts, seed data, or business rules. Arabic display digits remain Western (`0-9`) in every locale; no number-formatting behavior is changed.
- Scope recorded before implementation: add the missing route pages and reusable preview compositions, then link them from the existing shared navigation/footer. Continue with the existing responsive Waffarly palette, Cairo/Tajawal type, Tailwind, and shared shadcn primitives.
- Status at decision time: approved before implementation; completed evidence is recorded in the following log entry.

## Entry Gates

- [x] Inspect the supplied prototype pages, `app.js`, tokens, products, and image assets.
- [x] Inspect the existing storefront, shared UI package, contracts, catalog API, and order API.
- [x] Record strict implementation and source-of-truth rules in `FEATURE.md`.
- [x] Record state ownership and caching rules.
- [x] Record known API gaps.
- [x] Read the installed Next.js documentation required by `apps/storefront/AGENTS.md` before editing Next.js code.
- [x] Read the installed Turborepo documentation required by the root `AGENTS.md`; no Turbo configuration was changed.
- [x] Recheck `git status` before implementation and identify overlapping user changes.
- [x] Confirm the first implementation slice: reusable responsive storefront shell and supported catalog/cart/checkout foundation.

## Foundation

- [x] Add required storefront dependencies: TanStack React Query, Zustand, Lucide, and approved shadcn peer dependencies.
- [x] Create the storefront provider composition.
- [x] Create the query client and storefront query-key factory.
- [x] Create merchant-scoped, versioned Zustand persistence.
- [x] Map supplied design tokens to shared semantic Tailwind/shadcn variables.
- [x] Configure Cairo and Tajawal through locally hosted `next/font` assets.
- [x] Map the shared workspace semantic colors and legacy Waffarly aliases to the supplied brand palette.
- [x] Style shared buttons, cards, badges, borders, and focus rings with the design-system tokens.
- [x] Provide named compact storefront type-scale tokens while preserving the Bistro font families and palette.
- [x] Copy supplied WebP assets into the storefront public asset directory.
- [x] Reuse the existing shared shadcn/UI primitives and update only the generic shared style defaults needed for design-system alignment.
- [x] Use Tailwind utilities for the migrated storefront routes.
- [x] Establish a typed API client with consistent error handling.
- [x] Define explicit Next.js cache tags and revalidation for public catalog reads.
- [~] Production build passed for the application including unrelated routes; visual regression comparison was not available.

## Shared Design System

- [x] Centralize the supplied colors as shared semantic tokens: primary, dark/deep greens, gold/muted gold, cream/page/surface, text, border, and status colors.
- [x] Prevent public catalog `accentColor` from replacing the supplied Waffarly brand palette.
- [x] Map shared shadcn semantic colors and legacy Waffarly Tailwind aliases to the design-system tokens.
- [x] Apply shared button variants (green primary, gold accent, cream secondary, green-tinted outline), compact 44px default sizing, and shared card geometry/shadows.
- [x] Apply semantic success, warning, information, and error colors to shared status chips.
- [x] Rebuild the merchant Design System preview around the supplied color swatches, buttons/chips, typography, product card, and inputs.
- [x] Align the reusable storefront product card with the reference's square image, warm card surface, deep-green price, and gold add action.
- [~] Visually compare the merchant preview and affected storefront routes against the reference at desktop and mobile widths; homepage/footer were checked this slice, while the merchant Design System preview and non-home routes remain pending.

## Compact Sizing Pass

- [x] Replace the prior oversized type scale with named hero, page, section, subsection, product, price, body, supporting, and caption tokens.
- [x] Set shared default buttons to 44px and large actions to 48px while keeping small action targets usable.
- [x] Reduce homepage and menu hero height, section spacing, product-card image height/padding, and widen the desktop menu grid at extra-large widths.
- [x] Apply the compact type scale and denser card/form spacing consistently to product, cart, favorites, checkout, and customizer screens without changing the Bistro colors or content structure.
- [~] Capture and compare updated mobile, tablet, and desktop screenshots; homepage screenshots now exist at all three widths, but visual rechecks for menu, product, cart, checkout, and favorites remain pending.

## Application Shell

- [~] Build the route-scoped storefront layout under `/s/[slug]`.
- [~] Build the announcement bar.
- [~] Build the responsive header and desktop navigation.
- [~] Build the mobile bottom navigation with safe-area support.
- [x] Build and visually check the shared footer against the supplied deep-green, four-column RTL reference at mobile, tablet, and desktop widths.
- [~] Implement merchant name/accent handling; logo/template configuration remains limited by current public merchant fields.
- [~] Add route-aware active navigation.
- [ ] Verify keyboard navigation and visible focus.
- [x] Verify RTL and LTR shell behavior at mobile, tablet, and desktop widths; LTR/RTL smoke passed without horizontal overflow.
- [x] Recheck mobile, tablet, and desktop homepage shell layout after compact sizing changes; LTR/RTL document width matched each viewport.

## Pages

### 1. Restaurant Homepage - `/s/[slug]`

- [x] Confirm which hero, editorial, featured-product, offer, and branch fields are supported; only catalog-backed presentation is implemented.
- [~] Implement the food-first hero using real catalog data and supplied image fallback.
- [~] Implement category discovery.
- [~] Implement catalog-backed product cards without inventing ranking data.
- [~] Keep unsupported promotion/branch/about content out of the page rather than fabricating it.
- [~] Add loading, empty, unavailable, error, and retry states.
- [~] Add metadata based on merchant/catalog data.
- [x] Recompare homepage at mobile, tablet, and desktop after the compact sizing pass; RTL/LTR shell, category dimensions, locale-updating copy, and footer were visually checked. The API database was unavailable, so catalog data was not treated as live verification.

### 2. Menu - `/s/[slug]/menu`

- [~] Replaced the prior single-client catalog component with server-loaded catalog data and reusable responsive product cards.
- [~] Move initial catalog rendering to the intended server/client boundary.
- [~] Add URL-backed search, category, and sort state.
- [~] Build reusable responsive product cards.
- [~] Handle unavailable products and missing images.
- [~] Add loading skeleton, empty catalog, no-results, API error, and retry states.
- [~] Recompare mobile and desktop after the compact sizing pass; saved menu screenshots predate this slice.
- [ ] Add route/filter interaction tests.

### 3. Product Details - `/s/[slug]/products/[productId]`

- [x] Added a dedicated product route and responsive product-detail/customizer component.
- [x] Implement product gallery and responsive product information layout.
- [x] Implement variants and modifier groups from the live catalog contract.
- [~] Enforce min/max and single/multiple selection rules; required/default selection and option interaction were browser-checked, exhaustive boundary cases remain untested.
- [x] Use the server quote response for displayed configured price.
- [x] Add quantity behavior according to approved order fields.
- [!] Per-item notes are blocked: quote/create-order contracts and strict request validation do not accept a line-note field.
- [x] Add the configured item to the merchant-scoped cart.
- [~] Handle unavailable, invalid, missing, and quote-error states.
- [~] Recheck native keyboard variant selection and responsive RTL layouts after the compact sizing pass; prior screenshots predate this slice.
- [ ] Add modifier and quote tests.

### 4. Cart - `/s/[slug]/cart`

- [~] Migrated basket state to merchant-scoped, versioned Zustand persistence.
- [~] Implement merchant-scoped, versioned cart persistence.
- [~] Reconcile stored product/variant/modifier identifiers with current catalog.
- [~] Implement quantity update and removal.
- [~] Preserve line-level selections and supported notes.
- [~] Clearly distinguish displayed snapshots from authoritative server prices.
- [~] Implement empty and invalid/stale-cart states.
- [~] Implement responsive order summary.
- [ ] Add store, migration, reconciliation, and interaction tests.
- [ ] Verify mobile and desktop layouts.

### 5. Checkout - `/s/[slug]/checkout`

- [~] Added a dedicated guest checkout route using the current create-order contract.
- [x] Confirm final approved checkout fields from the current contract.
- [!] Branch selection/order routing remains blocked until the API provides `branchId`.
- [~] Implement accessible customer and fulfillment form.
- [~] Requote/revalidate every line before final order submission.
- [~] Submit only identifiers, quantities, selections, and approved customer fields.
- [~] Display totals returned or confirmed by the server.
- [~] Prevent duplicate submissions.
- [~] Handle validation, availability, conflict, network, and unknown errors.
- [ ] Do not add payment behavior without an approved contract.
- [ ] Add checkout API and end-to-end tests.
- [ ] Verify mobile and desktop layouts.

### 6. Order Success and Tracking - `/s/[slug]/order/[orderId]`

- [!] Define a safe public receipt/tracking lookup contract; no such public endpoint currently exists.
- [!] Ensure access cannot leak another customer's PII or order details; requires the missing lookup authorization design.
- [~] Display an order success receipt from the immediate create-order response in checkout.
- [!] Implement tracking only after approved public lookup/status contract exists.
- [x] Build a clearly disclosed UI-only tracking preview with neutral milestone placeholders; never look up, poll, or display the route order ID.
- [x] Check this preview at mobile/tablet/desktop in RTL and LTR; it returns 200 without overflow and does not expose the supplied path ID.
- [ ] Stop polling on terminal status, route exit, or unrecoverable error.
- [ ] Add missing, expired, unauthorized, error, and retry states.
- [ ] Add API authorization/privacy and UI polling tests.
- [ ] Verify mobile and desktop layouts.

### 7. Favorites - `/s/[slug]/favorites`

- [~] Implement merchant-scoped local favorites until a customer API exists.
- [~] Reconcile favorite identifiers with the current catalog.
- [~] Implement empty, unavailable-product, and error states.
- [~] Keep local favorites clearly separate from a future authenticated account API.
- [ ] Add persistence and interaction tests.
- [ ] Verify mobile and desktop layouts.

### 8. Offers - `/s/[slug]/offers`

- [!] Blocked by missing public offers/promotion contract and rules.
- [x] Build responsive preview cards and locally interactive category filters, visibly labeled as sample UI; no fabricated discount values and no effect on prices/cart.
- [x] Check this preview at mobile/tablet/desktop in RTL and LTR; mobile screenshot saved.
- [ ] Define offer fields, eligibility, validity, ordering, and price-authority behavior.
- [ ] Add backend, contract, and test support.
- [ ] Implement responsive offer cards and states using real data.
- [ ] Verify mobile and desktop layouts.

### 9. Branches - `/s/[slug]/branches`

- [!] Blocked by missing public branch contract and `branchId` in order creation.
- [x] Build responsive branch-card layout using supplied branch imagery and local-only selection; no addresses, hours, persistence, or checkout routing.
- [x] Check this preview at mobile/tablet/desktop in RTL and LTR; desktop screenshot saved.
- [ ] Define public branch fields, availability, hours, contact, and location behavior.
- [ ] Add branch selection and order-routing support end to end.
- [ ] Implement responsive branch cards and selection states.
- [ ] Add API and routing tests.
- [ ] Verify mobile and desktop layouts.

### 10. About - `/s/[slug]/about`

- [!] Blocked by missing public merchant about/editorial fields.
- [x] Build responsive about and information sections with explicit neutral placeholders; no merchant claims or contact/hours/location values are invented.
- [x] Check this preview at mobile/tablet/desktop in RTL and LTR.
- [ ] Define about, contact, social, and restaurant image fields.
- [ ] Add API/contract support and validation.
- [ ] Implement the supplied responsive design using real content.
- [ ] Add missing-content and error states.
- [ ] Verify mobile and desktop layouts.

### 11. Customer Authentication and Account

- [!] Blocked by unresolved customer identity requirements and missing public customer API.
- [x] Build preview-only login/register form states and account dashboard shell; no authentication call, customer-data persistence, or fake success.
- [x] Check both pages at mobile/tablet/desktop in RTL and LTR; registration view switches locally.
- [ ] Approve login/sign-up/session behavior.
- [ ] Approve customer profile fields and order-history access rules.
- [ ] Define authentication, authorization, privacy, and recovery contracts.
- [ ] Implement only after backend and security requirements are approved.

## API and Contract Work

- [x] Public catalog contract exists.
- [x] Product quote contract and endpoint exist.
- [x] Guest order create contract and endpoint exist.
- [x] Merchant order list and accept/reject behavior exist in the current worktree.
- [ ] Add public branch representation and selected branch to order creation.
- [ ] Add public storefront presentation/content fields.
- [ ] Add offers/promotion support if approved for MVP.
- [ ] Add privacy-safe public receipt/tracking support.
- [ ] Add customer identity/account APIs only after product approval.
- [~] Add cache tags for public catalog reads; mutation-side invalidation after merchant catalog/settings changes remains outside the public storefront API.

## Verification Matrix

Each completed page must record evidence for all applicable checks.

| Check | Status | Latest evidence |
| --- | --- | --- |
| Storefront typecheck | Passed | `pnpm --filter @waffarly/storefront typecheck` passed on 2026-10-15 (Node 20.19.0 emitted the package's Node >=24.11 <25 engine warning) |
| Storefront lint | Passed | `pnpm --filter @waffarly/storefront lint` passed on 2026-10-15 (same engine warning) |
| Storefront production build | Passed | `pnpm --filter @waffarly/storefront build` passed on 2026-10-15; all current app routes compiled (same engine warning) |
| Contracts typecheck/build | Not run | Outside this UI slice |
| API typecheck/lint/tests | Not run | Outside this UI slice |
| Shared UI lint | Passed | `pnpm --filter @waffarly/ui lint`; one existing `react-refresh/only-export-components` warning in `badge.tsx` |
| Shared UI typecheck/build | Passed | `pnpm --filter @waffarly/ui typecheck` and `pnpm --filter @waffarly/ui build` |
| Shared UI tests | Passed (no tests present) | `pnpm --filter @waffarly/ui test` exited successfully with zero tests |
| Merchant dashboard lint/typecheck | Passed | `pnpm --filter @waffarly/merchant-dashboard lint` and `pnpm --filter @waffarly/merchant-dashboard typecheck` |
| Merchant dashboard production build | Passed | `pnpm --filter @waffarly/merchant-dashboard build`; Vite emitted the existing >500 kB chunk-size advisory (Node 20.19.0 engine warning; sandboxed native-module/helper spawn needed approved escalation) |
| Playwright primary journey | Not implemented | No primary journey test added in this slice |
| HTTP smoke | Passed (live catalog) | Product route `/s/test-a5d13b8340d34e1fb85341be51ca4528/products/15533a31-d61a-4440-9707-63bedd525870` returned 200 from the production Next server at `localhost:3000` |
| Runtime recovery | Passed | Fresh production product route returned 200 with no page errors or failed requests; the reported RSC module-factory error did not recur |
| API connectivity | Unavailable today | Started the local API on 2026-10-15; `/health/db` returned 503 `DATABASE_UNAVAILABLE` and the catalog read returned 500. The API process was stopped; no seed or database write was made. The 2026-10-14 live catalog check previously returned 12 products and 8 categories |
| Live store-route smoke | Previously passed; unavailable today | The 2026-10-14 user-provided slug resolved to a live catalog. Current screenshots are layout-only because today's API database check failed; no order was submitted and no API/database data was changed |
| Live quote-to-basket flow | Passed | Changed to Brioche + extra cheddar; API quote returned `195.00` EGP and the configured item was added to local Zustand basket state |
| Mobile visual comparison (`390x844`) | Passed (homepage shell) | Arabic and English homepage screenshots captured; `document.documentElement.scrollWidth` matched 390px. See `screenshots/homepage-rtl-2026-10-15-mobile.png`; catalog data is not live-verified |
| Category card dimensions/type | Passed (runtime and screenshot) | At 390x844, 768x1024, and 1440x900: card `175x150px`, image `70x70px`, title `12px`, metadata `10px`; no document horizontal overflow |
| Footer layout (`390x844` / `1440x900`) | Passed (homepage shell) | Arabic/English footer layout checked at 390x844, 768x1024, and 1440x900. Scoped legacy paragraph color leakage so the copyright row now renders with the intended light text token; catalog data is not live-verified |
| Menu visual comparison (`390x844` / `1440x900`) | Pending recheck | Prior `screenshots/menu-mobile.png` and `screenshots/menu-desktop.png` predate updated title, hero, and grid sizing |
| Product detail visual comparison (`390x844` / `1440x900`) | Pending recheck | Prior product screenshots predate the compact title, image aspect, and card-spacing changes |
| Tablet responsive check | Partial (homepage shell) | Arabic/English homepage shell checked at 768x1024; `document.documentElement.scrollWidth` matched 768px. Menu/product responsive checks remain pending |
| Desktop visual comparison (`1440x900`) | Partial (homepage shell) | Arabic/English homepage and footer checked at 1440x900; `document.documentElement.scrollWidth` matched 1440px. Other routes remain pending |
| RTL smoke check | Passed (homepage shell) | At 390x844, 768x1024, and 1440x900 `dir=rtl`, document width equaled viewport width, and homepage/footer copy updated after changing the locale |
| LTR smoke check | Passed | Homepage at `390x844` and menu at `768x1024` rendered with `dir=ltr`; no horizontal overflow |
| Keyboard/accessibility check | Passed (focused smoke) | Native radio arrow-key navigation moved to the next available live variant; this is not a full WCAG audit |

## Implementation Log

### 2026-10-14 - Planning and Baseline

- Reviewed the supplied static prototype, page inventory, interactions, design tokens, product sample data, and image assets.
- Reviewed the existing Next.js storefront, shared UI package, public catalog contracts, product quote endpoint, and guest order endpoint.
- Confirmed the repository already has a Next.js 16 storefront and shadcn configuration, but the storefront does not yet depend on TanStack React Query, Zustand, or Lucide.
- Confirmed existing storefront work is concentrated in `/s/[slug]` and a large client component; it will be migrated incrementally to avoid discarding active user changes.
- Recorded strict styling, component, state ownership, API authority, caching, accessibility, testing, and progress rules in `FEATURE.md`.
- Expanded `FEATURE.md` with the required Cairo/Tajawal font roles, responsive type scale, Arabic typography rules, numeric/currency handling, font-loading constraints, and typography acceptance checks.
- Recorded blockers for branches, offers, public tracking, storefront editorial content, and customer authentication.
- No application source files were changed and no verification commands were required for this documentation-only slice.

### 2026-10-14 - Storefront Implementation and Runtime Recovery

- Implemented the route-scoped responsive storefront foundation, catalog homepage/menu, product detail/customizer, cart, checkout, and local favorites using Tailwind utilities and existing shadcn primitives.
- Added TanStack Query, Zustand merchant-scoped persistence, typed API/cache helpers, Cairo/Tajawal local font files, reusable UI components, and the supplied WebP assets.
- Added `/s/[slug]` route shell, metadata, loading/error states, and route-aware responsive navigation. Catalog, quotes, and order creation remain API-authoritative; no fake offers/branches/tracking were introduced.
- Diagnosed the reported RSC runtime failure as a stale dev module graph after starting Next before new package links were present; the log also showed missing TanStack module resolution. Reinstalled from the local pnpm store, stopped the stale process, and cleared only the verified generated `.next/dev` cache.
- Started a fresh Turbopack dev server successfully; root returned 200 and the unseeded test merchant returned 404. No RSC module-factory error recurred. Stopped the temporary server as requested.
- Verification passed: `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront build`, and `git diff --check`.
- Environment caveat: the workspace uses Node 20.19.0 while the package requires Node `>=24.11.0 <25`; commands completed successfully but emitted engine warnings. Use a supported Node version for ongoing development.
- Browser-based visual verification could not initialize because the in-app browser integration returned `missing field sandboxPolicy`; no screenshot, RTL/LTR, viewport, keyboard, or end-to-end acceptance is claimed.
- `apps/storefront/next-env.d.ts` was updated by the Next production build as a generated file; it was not manually edited.

### 2026-10-14 - Homepage Visual Slice

- Compared `apps/storefront` production screenshots with the supplied `mobile_index_firstfold.png` and `desktop_index_firstfold.png` references at `390x844` and `1440x900`.
- Fixed Tailwind token generation: storefront color/font tokens now live beside the workspace Tailwind import in `packages/ui/src/theme.css`; the previous split stylesheet left custom color utilities undefined in the browser.
- Tuned the route header, mobile announcement wrapping, first-fold hero dimensions/crop/content, feature ribbon, and six-card desktop category grid using Tailwind utilities and the supplied assets. Hero copy avoids the prototype's unapproved delivery promise; the secondary CTA points to supported category discovery.
- Stored production-only visual evidence in `screenshots/homepage-mobile.png` and `screenshots/homepage-desktop.png`. The screenshots used a temporary localhost API fixture derived from the supplied prototype product JSON solely to render the real API-shaped UI; no fixture server or catalog data is part of the app.
- Production browser checks: mobile (`390x844`), tablet (`768x1024`), desktop (`1440x900`) in RTL; mobile LTR smoke. All routes returned 200, there were no page errors, and no viewport had horizontal overflow. Tablet was a responsive smoke check, not a screenshot comparison.
- Exact checks passed after this slice: `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront build`, and `git diff --check`.
- Browser-session integration did not initialize, so local headless Chrome was used for the browser checks. Production build and visual page render succeeded.
- The production build generated `apps/storefront/next-env.d.ts`; it was not manually changed. The local Node 20.19.0 vs required Node `>=24.11.0 <25` mismatch remains and is reported by pnpm.
- Rechecked the reported Turbopack module-factory runtime error: `apps/storefront/src/app/error.tsx` is a client boundary, the generated `apps/storefront/.next` cache was cleared after verifying the exact target, and a fresh dev server reached Ready with `/` returning HTTP 200. The reported module-factory error did not recur. A prefetched `/s/.../cart` route returned 500 only because the configured local API (`localhost:4000`) was unavailable; this is a separate dev prerequisite. The temporary server was stopped.

### 2026-10-14 - Menu Visual Slice (in progress)

- Compared the existing menu composition with the supplied `mobile_menu_firstfold.png` and `desktop_menu_firstfold.png` references.
- Confirmed `localhost:4000/health` returns 200. The checked slugs `cairo-cafe`, `cairo-kitchen`, `waffarly-bistro`, and `supermarket-demo` return 404; no database writes or seed changes will be made to obtain screenshot data.
- Keep production menu data on the typed public catalog endpoint; derive category thumbnails only from matching catalog product images because the public category contract has no image field.
- Built the menu hero, breadcrumb, mobile category chips, desktop category sidebar, search/sort controls, product count, and responsive menu product grid from shared copy, shadcn-style inputs, Tailwind utilities, and the supplied WebP imagery.
- Visually checked the fixture-backed menu in Edge at `390x844`, `768x1024`, and `1440x900`. RTL rendered at all three sizes without horizontal overflow; LTR was checked at tablet width. The mobile hero measured x=16, y=191, 358x228px; desktop hero measured x=100, y=192, 1240x266px. Saved the mobile and desktop captures in `screenshots/menu-mobile.png` and `screenshots/menu-desktop.png`.
- Exercised URL-backed filtering/sorting with `?category=reference-category-1&sort=price-asc`; the sort remained selected, one matching product rendered, and the query stayed in the URL. This fixture ID validates UI state only and is not a production category.
- Used a temporary preview server on port 4001 with a catalog shape generated from the supplied prototype product JSON because neither tested merchant slug exists in the live API. Removed the temporary server and fixture after the check. Port 4000 remained untouched, and no database was seeded or changed.
- `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront lint`, and `pnpm --filter @waffarly/storefront build` passed; the build compiled all storefront routes. `git diff --check` passed (Git also emitted line-ending warnings for existing dirty-worktree files). The workspace Node 20.19.0 continues to emit the package's Node >=24.11 <25 engine warning.
- The in-app browser integration was unavailable, so installed Edge was used for visual capture. A browser-extension-injected `cz-shortcut-listen` attribute caused a dev-only hydration attribute warning; no storefront React Server Component module-factory error recurred.

### 2026-10-14 - Product Detail and Live Quote Slice

- Used the user-provided merchant slug `test-a5d13b8340d34e1fb85341be51ca4528`; the catalog returned 12 products and 8 categories. Selected the configurable Classic Beef Burger (`15533a31-d61a-4440-9707-63bedd525870`) with real variants and modifier groups.
- Reworked the product detail first fold to match the supplied Arabic RTL reference geometry: desktop gallery on the right at `1440x900`, mobile gallery at `390x844`, breadcrumb, product data, price, live variant/modifier groups, quantity, and add-to-basket action.
- Reused the same configurator for product-card quick-add and the inline product-detail flow. The browser quote is requested before the item enters Zustand; the API remains authoritative for configured unit pricing. No order was submitted.
- Mapped the supplied burger/chicken/fries/pizza/waffle/shake images only when catalog image URLs identify `/media/seed/` placeholders; valid merchant image URLs remain preferred.
- Checked the production app in Edge at mobile, tablet, and desktop widths. Product route returned 200, `dir=rtl`, no horizontal overflow, no page errors or failed requests. ArrowDown moved keyboard focus/selection to the next available variant.
- Changed the live selection to Brioche + extra cheddar; the quote returned `195.00` EGP and the UI showed the basket confirmation. No API/database mutation occurred.
- Saved clean production first-fold captures to `screenshots/product-mobile.png` and `screenshots/product-desktop.png`.
- `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront lint`, and `pnpm --filter @waffarly/storefront build` passed. Node 20.19.0 still emits the package's Node >=24.11 <25 engine warning.
- The in-app browser integration remained unavailable; the installed local browser was used for screenshots and interaction checks. The verified production storefront is running at `localhost:3000`; the configured API is `localhost:4000`.

### 2026-10-14 - Storefront Palette Consistency

- Applied the FEATURE.md palette in the shared Tailwind theme and scoped shadcn semantic variables to `.storefront-theme`, preserving other workspace app themes.
- Removed the route wrapper's dynamic `catalog.accentColor` override so home, menu, product, cart, checkout, favorites, navigation, default shadcn controls, and focus states use the supplied Waffarly colors.
- Replaced off-palette emerald/amber/red decoration and selection/status styles in homepage, menu, product customization, cart, checkout, favorites, and route error states with shared green, gold, and error tokens. Favorite selection now uses muted gold.
- Verified the live `localhost:3000/s/test-a5d13b8340d34e1fb85341be51ca4528` route returned HTTP 200 and its served CSS included the exact primary, gold, cream, and page values plus `.bg-store-accent { background-color: var(--storefront-primary) }`.
- `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront lint`, and `git diff --check` passed. The first sandboxed production build compiled but its TypeScript worker hit `spawn EPERM`; rerunning `pnpm --filter @waffarly/storefront build` with the required permission passed all compilation, TypeScript, static generation, and route output steps.
- Browser verification remains incomplete: in-app browser setup returned `missing field sandboxPolicy`; the local headless Edge fallback was unable to save a capture, so no screenshot comparison or visual completion is claimed. The workspace continues to emit the existing Node 20.19.0 vs required Node `>=24.11.0 <25` engine warning.

### 2026-10-14 - Shared Design System Alignment

- Updated the shared Tailwind/shadcn theme to use the supplied Waffarly design-system palette across the workspace; legacy `waffarly-*` utility names now alias semantic brand tokens instead of retaining the previous green/blue colors.
- Updated reusable shared Button variants (green primary, gold accent, cream secondary, tinted outline), shared Card radius/surface/shadow, and status Badge colors to match the design-system reference.
- Rebuilt the merchant dashboard Design System preview to show the reference color tokens, buttons/chips, Arabic typography, product card, and inputs. Reused the existing burger WebP asset for the card sample.
- Refined the storefront's reusable product card to use the warm surface/border, square product image, deep-green price, and gold add action from the same system.
- Verification passed: `pnpm --filter @waffarly/ui lint`, `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, and `pnpm --filter @waffarly/ui test` (zero tests present); `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront typecheck`, and `pnpm --filter @waffarly/storefront build`; `pnpm --filter @waffarly/merchant-dashboard lint`, `pnpm --filter @waffarly/merchant-dashboard typecheck`, and `pnpm --filter @waffarly/merchant-dashboard build`; `git diff --check`.
- Build notes: storefront and merchant builds needed approved permission because their worker/helper spawns failed with `EPERM` inside the sandbox. Merchant Vite build passed and emitted a chunk-size advisory for a >500 kB JS bundle. All pnpm commands continue to warn that Node 20.19.0 is below the required `>=24.11.0 <25` range.
- Browser visual comparison remains pending; the in-app browser initialization returned `missing field sandboxPolicy`, so this slice is not marked visually complete.
- The user's unrelated number-formatting edits and other dirty workspace changes were preserved; no number-formatting source was changed in this slice.

### 2026-10-14 - Compact Storefront Sizing

- Used the user-provided Wafarly Marketplace screenshots strictly as a scale/density reference. Kept the Waffarly Bistro colors, imagery, font families, content, RTL behavior, and page structure.
- Replaced oversized heading/body values with named compact typography tokens in the shared Tailwind theme. Shared default buttons are now 44px high and large actions 48px high; the shared brand colors and design remain unchanged.
- Reduced homepage/menu hero heights and padding, brought section spacing and category/product-card text down, changed storefront product imagery to a shorter 4:3 card ratio, and added a fourth menu product column only at extra-large desktop widths.
- Reduced typography and excess padding across product details/customizer, cart, favorites, checkout, empty states, and footer while retaining 44px actions and 12px minimum supporting captions.
- Verification passed: `pnpm --filter @waffarly/ui lint`, `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`; `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront typecheck`, and `pnpm --filter @waffarly/storefront build`; `pnpm --filter @waffarly/merchant-dashboard build`.
- The merchant dashboard build completed with its existing >500 kB bundle advisory. Node 20.19.0 continues to emit the workspace's Node `>=24.11.0 <25` engine warning. The shared UI lint has one existing Fast Refresh warning in `badge.tsx`; there are no shared UI tests.
- New screenshots are still needed. The provided site URL was inaccessible to the web viewer and the in-app browser failed to connect (`missing field sandboxPolicy`); the attached screenshots informed sizing, but I do not claim screenshot verification of the revised local UI.
- Existing number-formatting edits were left untouched.

### 2026-10-14 - Compact Category Tiles

- Matched the homepage category tiles to the supplied sizing: `175x150px` card, `70x70px` circular image, `12px` title, and `10px` product-count metadata. Kept the row horizontally scrollable on narrow screens and retained the Waffarly Bistro palette and imagery.
- Extracted a reusable `StorefrontCategoryCard` feature component and added named shared Tailwind tokens for its fixed dimensions and type sizes. `FEATURE.md` now records the narrow 10px exception for nonessential category counts only; number formatting and other text sizes were not changed.
- Verification passed: `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront typecheck`, and `pnpm --filter @waffarly/storefront build`. Built CSS confirms `175px` width, `150px` height, `70px` image, `12px` title, and `10px` metadata.
- Browser screenshot comparison remains pending because the in-app browser connection again returned `missing field sandboxPolicy`; no visual screenshot verification is claimed. Node 20.19.0 continues to warn that the workspace requires Node `>=24.11.0 <25`.
- Existing number-formatting work and other uncommitted changes were preserved.

### 2026-10-14 - Reference Footer

- Rebuilt the shared footer to follow the supplied deep-green four-column composition: merchant brand lockup and description, discover links, order-help links, and restaurant/home/category links, followed by a thin divider and two-sided copyright row.
- Localized the footer headings and link labels in Arabic and English. Links point only to implemented menu, favorites, basket, checkout, home, and catalog-category routes; no unsupported offers, tracking, branches, or account pages were added.
- Added safe-area/bottom-navigation clearance on mobile and kept the existing Waffarly deep-green/gold palette.
- Verification passed: `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront build`, and `git diff --check`. Node 20.19.0 continues to warn that the workspace requires Node `>=24.11.0 <25`.
- Rendered screenshot comparison remains pending because the in-app browser connection returns `missing field sandboxPolicy`; no visual screenshot verification is claimed.

### 2026-10-15 - Responsive Homepage and Footer Verification

- Rechecked the homepage shell in Arabic and English at `390x844`, `768x1024`, and `1440x900` after compact sizing. Runtime checks confirmed `dir=rtl` and `document.documentElement.scrollWidth` equal to the viewport at each size.
- Verified the category card dimensions at all three widths: `175x150px` card, `70x70px` image, `12px` title, and `10px` metadata.
- Compared the deep-green footer at mobile, tablet, and desktop. A legacy generic paragraph color rule overrode the footer's Tailwind white-opacity text color; scoped that old rule to `.storefront-shell p`, restoring the intended footer contrast.
- Fixed homepage and footer locale responsiveness: both now read the shared locale state, so the language switcher updates the hero, section labels, and footer copy without reloading. Number formatting was not changed.
- Saved Arabic responsive captures as `screenshots/homepage-rtl-2026-10-15-mobile.png`, `screenshots/homepage-rtl-2026-10-15-tablet.png`, and `screenshots/homepage-rtl-2026-10-15-desktop.png`.
- The in-app browser connection was unavailable, so local headless Edge was used for captures. Started the local API only for a read-only check: `/health/db` returned 503 `DATABASE_UNAVAILABLE` and catalog reads returned 500. The screenshots verify layout only; the rendered catalog may be cached and is not treated as live data. No seed, order, or database mutation was performed. Temporary API and storefront servers were stopped.
- Verification passed: `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront typecheck`, and `pnpm --filter @waffarly/storefront build`. Node 20.19.0 continues to emit the existing Node `>=24.11.0 <25` engine warning.
- Existing number-formatting work and other uncommitted workspace changes were preserved.

### 2026-10-15 - API-Gap Route UI Slice

- Added `/s/[slug]/offers`, `/branches`, `/about`, `/login`, `/account`, and `/order/[orderId]` using the isolated `features/preview/storefront-preview-pages.tsx` composition. Each route uses Waffarly tokens, shared shadcn-style Badge/Button/Card/Input primitives, Cairo/Tajawal fonts, responsive Tailwind utilities, and Arabic/English copy.
- Added a prominent accessible preview disclosure on every route. Offers only filter sample placements locally and contain no prices/discounts. Branch cards use the provided branch imagery and local selection only; they contain no real location/hours and do not connect to checkout. About details remain neutral placeholders. Login/register never call auth or persist fields and explicitly warn that the form is not connected. Account data remains unpopulated. Tracking displays generic milestone placeholders only, makes no request, and never echoes the route order ID.
- Added offers/about links to the desktop header and added offers, branches, about, login, and account links to the existing four-column footer. Existing cart/catalog/checkout state and Western-digit formatting were not changed.
- Browser verification used an isolated temporary API-shaped catalog-shell fixture on port 4001; the real API on port 4000 was unavailable and was not modified. All six routes returned 200 in 36 checks (Arabic/English × `390x844`, `768x1024`, and `1440x900`), with correct `dir`, no horizontal overflow, a visible preview disclosure, and no browser page errors. Offer filter and register-view toggle passed. Tracking path ID was not present in visible text. Temporary storefront and fixture servers were stopped.
- Captures: `screenshots/api-gap-offers-mobile.png` and `screenshots/api-gap-branches-desktop.png`.
- Final mobile-footer refinement: let the brand block span both mobile grid columns so the Waffarly Bistro wordmark is not truncated. Recaptured the offers page at `390x844`; the complete brand name is visible and the page still has no horizontal overflow. The desktop four-column layout is unchanged.
- Verification passed after final code changes: `pnpm --filter @waffarly/storefront typecheck`, `pnpm --filter @waffarly/storefront lint`, `pnpm --filter @waffarly/storefront build`, and `git diff --check`. The final build was rerun without the temporary test API override; its generated runtime uses the normal `localhost:4000` API configuration. The workspace still warns that Node 20.19.0 is below the package requirement `>=24.11.0 <25`.
- Backend integration remains pending for branches/order routing, promotions, merchant editorial/contact data, privacy-safe public tracking, and customer authentication/account APIs. All pre-existing unrelated workspace edits and number-formatting work were preserved.

## Decisions and Blockers

| Date | Area | Decision or blocker | Status |
| --- | --- | --- | --- |
| 2026-10-14 | Visual reference | Use the supplied kit for presentation and interaction intent, not as production business logic. | Decided |
| 2026-10-14 | Styling | Use Tailwind CSS 4 and shared shadcn primitives; do not port the prototype stylesheet. | Decided |
| 2026-10-14 | Server data | Use Next.js server rendering and explicit cache tags for cacheable public reads. | Decided |
| 2026-10-14 | Client server state | Use React Query for quotes, mutations, and supported tracking. | Decided |
| 2026-10-14 | Client state | Use merchant-scoped Zustand persistence for cart/favorites/preferences only. | Decided |
| 2026-10-14 | Pricing | Backend quotes and order creation remain authoritative. | Decided |
| 2026-10-14 | Branches | Public branch data and order `branchId` are absent. | Blocked |
| 2026-10-14 | Offers | Public offer data and promotion rules are absent. | Blocked |
| 2026-10-14 | Tracking | No privacy-safe public order lookup endpoint is defined. | Blocked |
| 2026-10-14 | Customer account | Authentication, profile, favorites sync, and history contracts are unresolved. | Blocked |
| 2026-10-15 | API-gap route UI | User approved implementing missing storefront route UIs with isolated, visibly disclosed local preview behavior; backend gaps remain blocked and preview state cannot enter real flows. | Decided |
| 2026-10-14 | Runtime recovery | Reinstall deps from local store, stop stale dev graph, and clear verified generated `.next/dev` cache; clean dev startup no longer reproduced module-factory error. | Resolved |
| 2026-10-14 | Local API for dev smoke | User-provided slug `test-a5d13b8340d34e1fb85341be51ca4528` returns a public catalog at `localhost:4000`; keep read/write rules unchanged. | Resolved |
| 2026-10-14 | Menu visual data | Live catalog now available for product `15533a31-d61a-4440-9707-63bedd525870`; continue rendering through the public catalog contract. | Verified |
| 2026-10-14 | Product item notes | The prototype contains an optional note field, but the quote/create-order contracts and strict API schema do not accept notes. Keep it out of the production UI pending an approved end-to-end contract. | Blocked by API capability |

