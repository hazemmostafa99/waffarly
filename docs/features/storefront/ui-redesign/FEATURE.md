# Restaurant Storefront UI Implementation

## Status

- Document status: Active implementation contract
- Target application: `apps/storefront`
- Product surface: Public merchant restaurant storefront
- Visual reference: Supplied `waffarly_restaurant_storefront` responsive UI kit
- Primary route namespace: `/s/[slug]`
- Primary implementation language: TypeScript and React

## Objective

Implement the supplied Arabic RTL restaurant storefront for desktop and mobile in the existing Next.js application. The result must use Tailwind CSS, shadcn/ui-style primitives, typed API contracts, Next.js caching, TanStack React Query where client-side server state is needed, and Zustand for client-only persisted state.

The supplied HTML, CSS, JavaScript, screenshots, tokens, and images define the visual target and intended interactions. They are not production business logic and must not override approved Waffarly contracts, database rules, authorization, or server-side pricing.

## Non-Negotiable Rules

Every implementation change must follow these rules:

1. Read this file and `PROGRESS.md` before changing storefront code.
2. Follow all repository and nested `AGENTS.md` instructions. Read the installed Next.js and Turborepo documentation required by those files before changing framework or task configuration.
3. Do not overwrite or discard unrelated uncommitted work. Inspect the working tree before editing overlapping files.
4. Use TypeScript with strict typing. Do not introduce `any`, untyped API responses, unchecked casts, or duplicated domain interfaces.
5. Use Tailwind CSS 4 utilities for storefront layout and styling. Do not port the prototype stylesheet, add page-specific CSS modules, or create a parallel handcrafted CSS system.
6. Global CSS is limited to Tailwind imports, shared design tokens, font/base rules, and behavior that cannot be expressed safely with utilities. Dynamic merchant values may be exposed through narrowly scoped CSS custom properties.
7. Use shared shadcn/ui-style primitives from `@waffarly/ui`. Add a primitive there only when it is generic and reusable. Storefront compositions remain in `apps/storefront`.
8. Use Lucide icons or an existing shared icon primitive. Do not use emoji, text symbols, or copied inline SVGs as application icons.
9. The storefront must be responsive by design, not by shrinking the desktop page. Verify mobile, tablet, and desktop layouts.
10. Arabic RTL is the primary visual target. LTR support must continue to work without duplicated page implementations.
11. The API is authoritative for availability, modifier validity, prices, totals, and order creation. Never trust a client-calculated total when submitting an order.
12. Do not hardcode prototype products, branches, offers, orders, customer accounts, or operational statuses into production flows.
13. Do not invent an API field, business rule, checkout step, payment method, delivery promise, branch-routing rule, or order status. Record missing capabilities as blockers.
14. Next.js owns cacheable server-rendered public data. TanStack React Query owns client-side server state. Zustand owns client-only state. Do not duplicate the same state between them.
15. URL parameters own shareable state such as category, search, sort, and selected product route. Do not hide shareable navigation state only in Zustand.
16. Persisted client state must be scoped by storefront slug and versioned. Never place credentials, access tokens, customer PII, authoritative prices, or order records in Zustand persistence.
17. Forms require accessible labels, validation, pending state, error state, success feedback, keyboard behavior, and duplicate-submission protection.
18. Every data-driven screen requires loading, empty, unavailable, error, retry, and success behavior where applicable.
19. A task is not complete because it renders locally. It is complete only after the relevant verification commands and visual checks pass and `PROGRESS.md` is updated with evidence.
20. If implementation conflicts with this document, stop and update the approved plan before continuing. Do not silently weaken a rule.

## Sources of Truth

When sources disagree, use this priority:

1. Approved Waffarly product documentation and explicit user decisions.
2. Shared contracts, database constraints, API validation, and authorization rules.
3. Existing automated tests.
4. This feature contract.
5. The supplied storefront screenshots, HTML, CSS, JavaScript, and design tokens for visual direction.
6. Prototype sample content only as local seed/reference data, never as implicit production behavior.

The prototype explicitly leaves customer authentication, final checkout fields, payment, fulfillment, and some tracking transitions unresolved. A visual control in the prototype does not approve its backend behavior.

## Required Technology

- Next.js 16 App Router and React 19.
- TypeScript using the repository's strict configuration.
- Tailwind CSS 4.
- Shared shadcn/ui-style components through `@waffarly/ui`.
- `next/font` for Cairo and Tajawal, with Arabic-capable fallbacks.
- TanStack React Query for interactive client-side server state and mutations.
- Zustand for cart, favorites, selected branch preference, and small client-only state.
- Zod or the repository's approved validation strategy at API boundaries.
- Shared request/response types from `@waffarly/contracts`.
- `next/image` for product, restaurant, and branch imagery unless a documented technical constraint prevents it.

## State Ownership

### Next.js server data and cache

Next.js server components and the server data layer own:

- Public merchant/storefront configuration.
- Categories and initial catalog data.
- Product page initial data.
- Public branches, offers, and restaurant content after APIs exist.
- Metadata and not-found handling.

Public GET requests should use explicit cache behavior, cache tags, and an intentional revalidation policy. Do not use `force-dynamic` by default. Merchant catalog/settings mutations should eventually invalidate the relevant storefront tags.

### TanStack React Query

React Query owns client-side remote operations that benefit from mutation or refresh behavior:

- Product quote requests.
- Order submission.
- Public order tracking/polling after a supported endpoint exists.
- Customer favorites, profile, authentication, and order history after supported APIs exist.

Query keys must include the storefront slug and relevant resource identifier. Mutations must invalidate only the smallest relevant query scope. Do not copy query results into Zustand.

### Zustand

Zustand owns client-only state:

- Cart lines and quantities.
- Selected product options before submission.
- Local favorites until a customer favorites API exists.
- Selected branch preference after branch support exists.
- Non-sensitive checkout draft fields only if explicitly approved.

Cart persistence rules:

- Scope storage by merchant slug.
- Include a schema version.
- Persist product, variant, modifier identifiers and quantity; displayed prices are snapshots only.
- Reconcile persisted entries against the current catalog.
- Requote before order submission.
- Never mix items from different merchants.

### URL and component state

The URL owns product routes, categories, search, sort, and other shareable state. Component-local state remains the default for open dialogs, form inputs, galleries, and one-off UI interactions.

## Caching and Request Rules

- Server reads use a typed API client and explicit Next.js cache configuration.
- Catalog cache keys/tags must include the merchant slug.
- Requests must have a defined error shape and must not swallow backend messages that are safe to display.
- Client code must not directly concatenate unsafe API URLs.
- Product quotes and order mutations are never statically cached.
- Tracking polling, when implemented, runs only for active statuses and stops on terminal states, route exit, or unrecoverable error.
- Avoid duplicate initial catalog requests during hydration. Pass server-fetched data down or hydrate React Query deliberately when client caching is required.
- Monetary values remain decimal strings at API boundaries. Format them for display without converting authoritative calculations to floating-point arithmetic.

## Design Foundation

Use the supplied `design-system.html`, `design-tokens.json`, and screenshots as the visual source of truth for the shared Waffarly design system:

- Primary: `#0F705A`
- Primary dark: `#0A5645`
- Primary deep: `#063D31`
- Accent gold: `#F5B544`
- Muted gold: `#DBA13D`
- Cream background: `#FFF8F0`
- Page background: `#FAF8F4`
- Surface: `#FFFFFF`
- Primary text: `#172330`
- Secondary text: `#5C667A`
- Muted text: `#8A93A6`
- Border: `#EAE6DE`
- Success surface: `#DDF5E8`
- Information surface: `#EAF3FF`
- Error: `#D94C4E`
- Error surface: `#FCE7E7`
- Warning surface: `#FFF0D4`
- Heading font: Cairo
- Body font: Tajawal
- Content width: `1240px`
- Button radius: `14px`; bold primary/accent controls use a `48px` default height.
- Card radius: `26px`; card shadow: `0 12px 38px rgba(30, 38, 36, 0.045)`.
- Reference mobile viewport: `390x844`
- Reference desktop viewport: `1440x900`

Rules for fidelity:

- Preserve the warm, premium, food-first visual character.
- Primary buttons use the deep-green gradient and soft brand shadow; accent buttons use the warm-gold gradient; outline buttons use a white surface, fine green-tinted border, and dark-green text.
- Cards use the white surface, warm border, large card radius, and restrained shadow. Status chips use the defined success, warning, information, and error surfaces with readable semantic foreground colors.
- Apply this Waffarly palette consistently through shared design-system tokens and every storefront route. A catalog-provided merchant `accentColor` must not override these brand tokens; merchant logos and product imagery remain content, not theme colors.
- Map shared shadcn semantic colors and primitives to the Waffarly tokens so default buttons, inputs, focus rings, badges, and cards remain consistent across apps. Feature-level storefront tokens must alias the shared values rather than fork them.
- Use the defined green, gold, cream, page, surface, text, border, and error tokens for storefront UI. Do not introduce Tailwind's unrelated emerald/amber shades for brand decoration or selection states; reserve red/error treatment for actual errors and unavailable states.
- Use the supplied WebP assets without regenerating or visually altering them unless requested.
- Prefer merchant-provided product photos; use a supplied WebP as a presentational fallback only when the API URL identifies a seed/demo placeholder, and never as product or pricing data.
- Use semantic token names rather than repeating raw color values in components.
- Avoid arbitrary Tailwind values when a named token or standard scale value exists.
- Cards, radii, shadows, spacing, image ratios, and typography must be compared against the supplied screenshots.
- Mobile bottom navigation must account for safe-area insets and must not cover content or actions.
- Sticky elements must not overlap dialogs, toasts, keyboard focus, or checkout controls.

## Typography System

Typography is part of the visual implementation and must not be left to browser defaults. The storefront uses a two-family Arabic-first system:

- **Cairo** is the display and heading family. Use it for the brand wordmark, hero text, page titles, section titles, product names, prices, badges, and important calls to action.
- **Tajawal** is the interface and reading family. Use it for navigation, descriptions, form controls, helper text, cart details, checkout content, and footer text.
- Fallback order must remain Arabic-capable: `Noto Sans Arabic`, `Segoe UI`, `Tahoma`, then `sans-serif`.
- Register both families through `next/font` and expose them as semantic CSS variables such as `--font-heading` and `--font-body`.
- Do not load fonts with a runtime CSS `@import`, a page-level `<link>`, or a third-party font script. Font loading must be centralized in the storefront layout and optimized by Next.js.
- Load only the weights and character subsets actually used by the UI. The implementation must provide real font files for every used weight and must not rely on synthetic browser bolding.

### Type scale

Use this scale as the default target. Small adjustments are allowed only when screenshot comparison demonstrates that they are necessary, and the resulting value must be recorded as a named typography token rather than repeated as an arbitrary value.

| Role | Mobile | Desktop | Weight | Family | Usage |
| --- | --- | --- | --- | --- | --- |
| Hero display | `40px / 48px` | `72px / 80px` | 800-900 | Cairo | Homepage hero only |
| Page title | `32px / 42px` | `48px / 58px` | 800 | Cairo | One primary `h1` per page |
| Section title | `26px / 36px` | `36px / 46px` | 800 | Cairo | Major homepage/menu sections |
| Subsection title | `21px / 30px` | `24px / 34px` | 700-800 | Cairo | Cards, checkout sections, summaries |
| Product title | `18px / 27px` | `20px / 30px` | 700 | Cairo | Product cards and cart lines |
| Price emphasis | `20px / 28px` | `24px / 32px` | 800 | Cairo | Product and order prices |
| Body large | `18px / 31px` | `18px / 32px` | 400-500 | Tajawal | Hero and section introductions |
| Body | `16px / 28px` | `16px / 28px` | 400-500 | Tajawal | Default reading text and fields |
| UI label | `15px / 22px` | `15px / 22px` | 700 | Tajawal | Buttons, tabs, navigation, labels |
| Supporting text | `14px / 22px` | `14px / 22px` | 400-500 | Tajawal | Descriptions, helper text, metadata |
| Caption | `12px / 18px` | `12px / 18px` | 600-700 | Tajawal | Badges and short secondary metadata only |

### Typography rules

- The root body style uses Tajawal. Heading and display components opt into Cairo through a semantic Tailwind font token.
- Do not set all text in Cairo; the contrast between display and reading families is intentional.
- Do not use font sizes below `12px`. Essential information, form help, prices, and actionable text must never use the caption size.
- Arabic headings use normal letter spacing. Do not apply negative tracking designed for Latin text.
- Avoid wide tracking on Arabic text. Uppercase eyebrow tracking may be used only for short Latin labels such as `WAFFARLY BISTRO`.
- Use `font-semibold` or `font-bold` for interactive labels. Do not use color alone to make actions or headings recognizable.
- Prefer `text-balance` for hero/page/section headings and `text-pretty` for short introductions where supported.
- Keep paragraphs readable at roughly 45-75 characters per line. Long descriptions must use a constrained measure rather than spanning the full desktop container.
- Preserve a clear hierarchy: a card title must not visually compete with the page title, and supporting text must remain quieter without losing contrast.
- Use logical alignment (`text-start` and `text-end`) instead of hardcoded left/right alignment.
- Product names may clamp only in repeated cards, normally to two lines. Full names and descriptions must remain available on the product page and to assistive technology.
- Buttons and inputs must not clip Arabic glyphs at any supported zoom level. Their line height and vertical padding must accommodate Cairo/Tajawal ascenders and descenders.
- Prices must use `bdi` or an equivalent direction-isolation strategy so numbers and `ج.م` render correctly inside RTL text.
- Always render Western/Latin digits (`0-9`) for numbers in every locale, including Arabic. Use `nu-latn` for locale-aware number/date formatting and normalize Arabic-Indic or Persian digits from translated or API-derived display strings; keep surrounding Arabic text and RTL isolation localized.
- Use tabular numerals for quantities, aligned prices, cart summaries, and tracking identifiers when supported by the active font.
- Do not uppercase Arabic text, fake small caps, distort text with transforms, or use decorative script fonts for operational UI.
- Native font scaling and browser zoom up to 200% must not hide content, overlap controls, or require horizontal page scrolling.

### Typography acceptance checks

- Cairo and Tajawal are visibly applied in the rendered browser and no unexpected fallback is reported for normal Arabic content.
- There is no layout shift caused by late runtime font injection.
- Required weights render distinctly without synthetic bold or faux italic.
- Arabic diacritics, numerals, punctuation, mixed Arabic/Latin text, prices, and phone numbers render without clipping or reversed ordering.
- Heading hierarchy is consistent across homepage, menu, product, cart, checkout, and order screens.
- Mobile and desktop screenshots are compared for font size, weight, line height, wrapping, and vertical rhythm—not only color and spacing.
- Typography remains readable at 200% browser zoom and with the operating system's increased text-size setting.

## Proposed File Structure

```text
apps/storefront/src/
|-- app/
|   `-- s/[slug]/
|       |-- (store)/
|       |   |-- layout.tsx
|       |   |-- page.tsx
|       |   |-- menu/page.tsx
|       |   |-- products/[productId]/page.tsx
|       |   |-- cart/page.tsx
|       |   |-- checkout/page.tsx
|       |   |-- order/[orderId]/page.tsx
|       |   |-- favorites/page.tsx
|       |   |-- offers/page.tsx
|       |   |-- branches/page.tsx
|       |   `-- about/page.tsx
|       |-- error.tsx
|       |-- loading.tsx
|       `-- not-found.tsx
|-- components/
|   `-- storefront/
|-- features/
|   |-- catalog/
|   |-- product/
|   |-- cart/
|   |-- checkout/
|   |-- favorites/
|   `-- orders/
|-- hooks/
|-- lib/
|   |-- api/
|   |-- currency/
|   |-- query/
|   `-- validation/
|-- providers/
`-- stores/
```

File placement rules:

- Route files compose features; they must not contain a complete feature implementation.
- Feature API calls, query keys, schemas, hooks, and components stay together.
- Cross-feature storefront compositions go in `components/storefront`.
- Generic primitives used across applications go in `packages/ui`.
- Shared API shapes go in `packages/contracts`; do not redefine them locally.
- Avoid barrel files that hide circular dependencies or mix server-only and client-only modules.
- Add `'use client'` only at the smallest interactive boundary.

## Shared Component Inventory

### Shared UI primitives

Use or add shadcn/ui-style primitives in `packages/ui`:

- Button
- Input and Textarea
- Select
- Checkbox and Radio Group
- Dialog and AlertDialog
- Sheet
- Tabs
- Badge
- Skeleton
- Separator
- Toast
- Tooltip

### Storefront compositions

- `StorefrontHeader`
- `AnnouncementBar`
- `DesktopNavigation`
- `MobileBottomNavigation`
- `StorefrontFooter`
- `ProductCard`
- `ProductGrid`
- `CategoryNavigation`
- `PriceDisplay`
- `QuantitySelector`
- `ModifierGroup`
- `CartLine`
- `OrderSummary`
- `StorefrontEmptyState`
- `AsyncState`

Do not extract a storefront component merely to reduce line count. Extract it when it is reused, has a clear responsibility, or needs isolated accessibility/testing behavior.

## Routes and Delivery Order

| Order | Route | Screen | Data boundary |
| --- | --- | --- | --- |
| 1 | `/s/[slug]` | Restaurant homepage | Requires catalog plus merchant presentation content. |
| 2 | `/s/[slug]/menu` | Menu/search/filter | Existing public catalog API. |
| 3 | `/s/[slug]/products/[productId]` | Product details/customization | Catalog data plus server quote API. |
| 4 | `/s/[slug]/cart` | Cart | Zustand persistence plus catalog reconciliation. |
| 5 | `/s/[slug]/checkout` | Guest checkout | Existing create-order API, subject to branch gap. |
| 6 | `/s/[slug]/order/[orderId]` | Success/tracking | Requires a safe public order lookup/tracking contract. |
| 7 | `/s/[slug]/favorites` | Favorites | Local Zustand state until a customer API exists. |
| 8 | `/s/[slug]/offers` | Offers | Requires offers content/API. |
| 9 | `/s/[slug]/branches` | Branches | Requires public branch contract and routing support. |
| 10 | `/s/[slug]/about` | About restaurant | Requires public storefront content fields/API. |
| 11 | `/s/[slug]/login` and account routes | Customer account | Blocked until customer auth requirements and API are approved. |

Unsupported routes may use an honest unavailable state, but must not present fictional live data.

## Current API Coverage and Known Gaps

Already supported:

- Public catalog by merchant slug.
- Categories, products, images, variants, and modifier groups.
- Server-authoritative product quotation.
- Guest order creation.
- Merchant order listing and acceptance/rejection.

Not yet represented completely:

- Public branch list and a `branchId` on order creation.
- Offers and promotion rules.
- Homepage hero/editorial content and product badges.
- Restaurant about content and contact/social fields.
- Safe public order receipt/status lookup.
- Customer authentication, profile, server favorites, and order history.
- Final delivery rules, fees, service fees, payment, and expanded tracking statuses.
- Per-item customer notes: quote/create-order contracts do not represent notes, so do not expose the prototype note field until an approved backend contract and persistence path exist.

These gaps must be resolved in contracts, validation, services, database schema, tests, and UI together. Do not solve them only in frontend code.

## Page Delivery Workflow

For every implementation slice:

1. Inspect the current working tree and the files in scope.
2. Read relevant repository documentation, installed framework documentation, contracts, API validation, and tests.
3. Confirm whether the required data and action are supported.
4. Record blockers or decisions in `PROGRESS.md` before inventing a fallback.
5. Identify shared primitives and feature-specific components.
6. Implement typed data access and state ownership according to this document.
7. Implement loading, empty, unavailable, error, retry, success, and responsive states.
8. Verify keyboard behavior, focus, landmarks, labels, RTL, LTR, and reduced motion.
9. Compare at `390x844` and `1440x900`, plus a representative tablet width.
10. Run scoped typecheck and lint, then production build and relevant tests.
11. Update `PROGRESS.md` with exact commands, results, screenshots/observations, limitations, and remaining work.

Do not begin the next page while the current page has an unexplained failing check or an undocumented blocker.

## Accessibility Requirements

- Semantic header, navigation, main, aside, and footer landmarks.
- One meaningful page-level heading.
- Keyboard-accessible navigation, sheets, dialogs, galleries, filters, steppers, and forms.
- Visible focus indicators with adequate contrast.
- Accessible names for icon-only controls.
- Status and validation meaning must not depend on color alone.
- Toasts and asynchronous errors use suitable live regions without stealing focus.
- Product images have meaningful alternative text; decorative imagery uses empty alt text.
- Motion respects `prefers-reduced-motion`.
- Touch targets are at least 44 by 44 CSS pixels where practical.

## Testing Requirements

- Unit tests for cart reducers/actions, persistence migration, currency formatting, and option-selection rules.
- Contract/API tests for every added backend field or endpoint.
- Component tests for modifier constraints, quantity control, error rendering, and submission locks.
- Route tests for direct links, refresh, not-found behavior, and merchant isolation.
- Checkout tests for requoting, API validation errors, duplicate submission, and server-total display.
- Playwright coverage for the primary menu-to-order journey.
- Responsive visual checks at mobile, tablet, and desktop sizes.
- RTL and LTR smoke coverage.
- Existing workspace checks must continue to pass.

## Definition of Done

The storefront redesign is complete only when:

- All approved routes use the supplied responsive design language.
- Tailwind and shared shadcn primitives follow the strict styling rules.
- Public data and mutations use typed real APIs.
- Next.js, React Query, Zustand, URL state, and component state follow the ownership rules.
- Cart data is merchant-scoped, versioned, reconciled, and requoted before ordering.
- No unsupported business behavior is disguised as production functionality.
- RTL, LTR, responsiveness, accessibility, metadata, error handling, and performance have been verified.
- Typecheck, lint, build, relevant API tests, and storefront Playwright tests pass.
- `PROGRESS.md` accurately records the evidence, remaining limitations, decisions, and blockers.

