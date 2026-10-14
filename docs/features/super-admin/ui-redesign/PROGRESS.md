# Super Admin UI Redesign Progress

## How to Use This File

Update this document after every implementation slice. A checkbox is complete only when the code exists and its listed verification has passed. Record commands and meaningful limitations in the implementation log.

Progress states:

- `[ ]` Not started
- `[~]` In progress or partially implemented
- `[x]` Complete and verified
- `[!]` Blocked by an explicit product, API, or authorization decision

## Current Status

- Overall: Foundation, Arabic support, Tailwind dashboard, merchant pages, plans, first-month access, Business Activities, Modules Matrix, Templates Library, and Template Details implemented; visual/browser review remains in progress.
- Current milestone: Page-by-page migration; Governance and Audit is next but remains blocked by unapproved requirements and missing API support.
- Current page: Template Details at `/templates/:templateId` (reuses the templates list contract; desktop/mobile route and interaction tests pass, visual comparison remains).
- State libraries: TanStack React Query and Zustand are installed in the Super Admin app.
- Visual reference: Supplied Super Admin UI kit.
- Last updated: 2026-10-14.

## Foundation

- [x] Record implementation scope and source-of-truth boundaries.
- [x] Record React Query and Zustand state ownership rules.
- [x] Add TanStack React Query dependency to the Super Admin app.
- [x] Add Zustand dependency to the Super Admin app.
- [x] Create the shared `QueryClient` configuration.
- [x] Create the application provider composition.
- [x] Create typed query-key conventions.
- [x] Create the minimal Zustand UI store.
- [x] Map the supplied Waffarly palette into named Tailwind tokens and shadcn variables.
- [x] Configure Cairo with Arabic-capable local fallbacks.
- [x] Add Arabic translations for the redesigned shell, login, and overview.
- [x] Build the shared UI package so Super Admin consumes the updated Arabic dictionary.
- [ ] Verify RTL and LTR document direction behavior in a browser.
- [x] Replace custom shell/login/overview CSS with Tailwind utilities; retain legacy styles only for pages not yet migrated.
- [ ] Add missing shared UI primitives to `packages/ui`.

## Application Shell

- [x] Build responsive `AdminLayout`.
- [x] Build route-aware `AppSidebar` (right-side in RTL).
- [x] Build mobile navigation sheet with backdrop, Escape handling, and focus trapping.
- [x] Build `AppTopbar`.
- [x] Build reusable `PageHeader`.
- [x] Preserve authentication and deep-link return behavior.
- [x] Add loading and authentication boundaries.
- [x] Add compatibility redirects for existing URLs.
- [ ] Verify keyboard navigation and responsive behavior.

## Pages

### 1. Platform Overview - `/dashboard`

- [x] Confirm available aggregate data from merchant, application, plan, and template APIs.
- [x] Implement page header and contextual actions.
- [x] Implement reusable stat cards.
- [x] Implement supported overview panels.
- [x] Add loading, error, empty, and retry states.
- [ ] Add route and responsive tests.
- [ ] Obtain visual approval before establishing the pattern for later pages.

### 2. Merchants List - `/merchants`

- [x] Move merchant and application fetching into shared React Query hooks.
- [x] Implement URL-backed search and activity/access filters.
- [x] Implement responsive data table and access status badges.
- [x] Implement client-side pagination over the existing full-list response; the API has no server pagination contract.
- [x] Add the supported first-month activation action with explicit external-collection confirmation.
- [ ] Test loading, empty, error, filter, and navigation behavior.

### 3. Create Merchant - `/merchants/new`

- [x] Reuse the approved creation contract and its field bounds.
- [x] Implement structured business and owner-account form sections.
- [x] Implement native accessible validation constraints and an API error summary.
- [x] Implement a React Query create mutation and targeted merchant-list invalidation.
- [x] Preserve approved credential handling: display the password only in the immediate success panel and clear it when dismissed; do not persist it in mutation variables or browser storage.
- [ ] Test success, validation failure, and API failure.

### 4. Merchant Details - `/merchants/:merchantId`

- [x] Confirmed there is no dedicated detail endpoint; reuse the existing merchant-list summary contract and fields.
- [x] Implement business summary/contact/activity and show only supported first-month activation information.
- [x] Implement the approved first-month activation action only.
- [x] Require explicit external-collection confirmation before activation.
- [ ] Test missing, forbidden, loading, and success states.

### 5. Plans Catalog - `/plans`

- [x] Move plan fetching into a shared React Query hook.
- [x] Implement responsive catalog cards based on the real plan summary shape.
- [x] Omit unapproved mock prices, limits, and entitlements.
- [x] Link to the supported create/edit routes and preserve their API safeguards.
- [ ] Test loading, empty, error, and navigation behavior.

### 6. Plan Editor - `/plans/new`, `/plans/:planId/edit`

- [x] Confirm supported create and update contracts from the monthly plan specification.
- [x] Define the typed form from approved contract fields and validation bounds.
- [x] Implement create/update mutations and targeted plans-query invalidation.
- [x] Protect unsaved drafts from internal navigation and page unload.
- [x] Keep unsupported entitlement, limit, assignment, and lifecycle fields out of the editor.
- [ ] Test create, edit, validation, and failure behavior.

### 7. Merchant Subscriptions - `/subscriptions`

- [x] Confirmed the API exposes only merchant first-month activation records/actions, not a full subscription resource.
- [x] Keep first-month access separate from business creation/approval status.
- [x] Implement search, access-state filters, and the supported manual first-month activation action.
- [x] State that plan assignment, later payments, renewal, and expiry details are not exposed; imply no automated payment behavior.
- [ ] Test all approved states and actions.
- [!] Full subscription lifecycle administration remains blocked by missing API support and unresolved renewal/expiry rules.

### 8. Business Activities - `/activities`

- [x] Confirmed hybrid catalog governance, fixed code-defined keys, and the existing revision-aware edit API.
- [x] Move activity fetching into a shared React Query hook.
- [x] Implement searchable activity cards and show the API's compatible-module links.
- [x] Localize the platform's default activity and module names/descriptions; unknown administrator-entered catalog text remains as authored.
- [x] Align the page with the supplied reference: compact four-card summary, activity overview tiles, and a two-column catalog table/definition panel.
- [x] Migrate the supported name, description, and activity-association editor into the redesigned page with revision-aware saves; keep code-defined activity keys, module support, and dependencies immutable.
- [~] Verify loading, empty, error, search, Arabic/RTL, and responsive behavior in the browser.

### 9. Modules Matrix - `/modules`

- [x] Confirmed hybrid catalog governance and the code-supported versus saved-association fields.
- [x] Keep compatibility, plan entitlement, and user permissions visually distinct.
- [x] Implement the matrix using real catalog data, including mismatch detection.
- [x] Avoid deriving runtime entitlement behavior from the reference image.
- [x] Match the reference composition with compact colored KPI cards, URL-backed activity/relationship filters, a matrix panel, and a module-boundaries side panel.
- [ ] Test matrix accessibility and responsive overflow.

### 10. Templates Library - `/templates`

- [x] Confirmed the existing list/create/update contracts and revision requirement; no delete endpoint is exposed.
- [x] Move template fetching and create/update operations into React Query hooks with targeted cache invalidation.
- [x] Implement URL-backed search, activity, and status filters with responsive preview cards.
- [x] Use restaurant hero/menu images for the corresponding layouts and offers artwork only for offer-related templates; include an image fallback.
- [x] Implement draft/available status changes through the revision-aware update API; availability adds a design to the merchant selection library and does not publish a storefront.
- [~] Verify image fallback, loading, empty, error, Arabic/RTL, and responsive states in the browser.

### 11. Template Details - `/templates/:templateId`

- [x] Confirmed the API has no detail endpoint; resolve deep links from the shared `/admin/templates` React Query list and handle missing IDs.
- [x] Implement preview and saved metadata sections using only the existing template summary fields.
- [x] Explain merchant eligibility accurately: activity scope must match, and `available` designs are offered for new selections; already-selected designs may remain visible after moving to drafts.
- [x] Reuse the revision-aware update API for editing and availability changes, with targeted invalidation of the templates query.
- [x] Implement loading, error, missing, success, and Arabic states.
- [x] Test deep links, revisioned edits, availability changes, unknown IDs, Arabic/RTL, and horizontal fit in desktop and mobile Playwright projects.

### 12. Governance and Audit - `/governance`

- [!] Await approved governance requirements and API support.
- [ ] Define authorized viewers and actions.
- [ ] Define audit event, filtering, and retention behavior.
- [ ] Implement only after the blockers above are resolved.

## Login and Cross-Cutting Work

- [x] Align login styling with the new design system.
- [x] Preserve protected-route behavior.
- [~] Add translated feedback to the redesigned login and overview; continue the translation audit on legacy pages.
- [ ] Audit all pages for RTL and LTR.
- [ ] Audit all pages at desktop, tablet, and mobile sizes.
- [ ] Audit focus order, keyboard operation, and accessible names.
- [ ] Remove superseded legacy CSS only after its consumers are migrated.
- [ ] Verify no server response data is duplicated in Zustand.

## Verification Checklist

- [x] `pnpm --filter @waffarly/super-admin typecheck`
- [x] `pnpm --filter @waffarly/super-admin lint`
- [x] `pnpm --filter @waffarly/ui typecheck`
- [x] `pnpm --filter @waffarly/ui build`
- [x] `pnpm --filter @waffarly/super-admin build` (ran outside sandbox after Vite hit a Windows process restriction; latest entry chunk is 260.31 kB, below 500 kB.)
- [x] Relevant Super Admin Playwright route tests (Template Details: desktop and mobile)
- [x] Relevant Super Admin interaction tests (revisioned edit and availability change)
- [ ] Desktop visual comparison at 1500 by 1035
- [ ] Tablet visual and interaction check
- [ ] Mobile visual and interaction check

## Implementation Log

### 2026-10-14 - Template Details

- Added the lazy `/templates/:templateId` route and linked template artwork and names from the library to the details page. The Templates navigation item remains active on the detail route.
- Confirmed there is no template-by-ID endpoint; direct links resolve from the shared `/admin/templates` React Query list, with explicit load-failure and missing-template states.
- Added the saved artwork preview, metadata/revision panel, activity-scope and availability explanation, and a revision-aware availability action. The existing editor is reused for edits; all changes invalidate the shared templates query.
- Cross-checked merchant eligibility against `StorefrontService`: new selections require an available template whose activity is `general` or matches the merchant; a currently selected design can remain in that merchant's settings response after being drafted.
- Added Arabic translations and RTL-aware back navigation. No endpoint or compatibility rule was invented.
- Super Admin typecheck/lint, UI-package typecheck/build, and Super Admin production build passed. The details chunk is 16.80 kB (gzip 3.95 kB); the app entry is 261.77 kB (gzip 81.37 kB). Desktop/mobile Playwright route and interaction tests now cover loading the direct route, revisioned editing, availability changes, unknown IDs, Arabic/RTL, and horizontal fit; all 4 project runs passed. Visual comparison against the supplied reference remains open. The host is Node 20.19 while the workspace expects Node >=24.11.

### 2026-10-14 - Template Details Coverage

- Added mocked Playwright coverage for the `/templates/:templateId` deep link, revision-aware editing, availability changes, and unknown template IDs.
- Added Arabic direction and responsive overflow assertions to the loaded details route; both desktop and mobile projects pass.
- `pnpm exec playwright test --config=playwright.routes.config.ts --grep "admin template details"` passed (4 tests across desktop and mobile). The initial run exposed missing timestamps in the mock fixture; adding valid ISO timestamps resolved the fixture error without changing page behavior.

### 2026-10-14 - Templates Library

- Replaced the legacy CSS template route with a dedicated lazy-loaded `/templates` feature folder: query/mutation hooks, reusable preview artwork/card components, an editor panel, and separated form defaults.
- Added API-backed create/edit flows with optimistic revision handling, direct draft/available status actions, and targeted React Query cache invalidation. No delete operation was added because the API does not provide one.
- Added URL-backed name/key/description/activity search and status/activity filters, summary cards, loading/error/empty/no-results states, and an image fallback.
- Copied the three supplied restaurant reference assets into the Super Admin public assets. Preview selection uses hero/menu images by layout and offers art only when the template refers to offers.
- Added Arabic translations and retained the distinction between library availability and storefront publication.
- `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, `pnpm --filter @waffarly/ui typecheck`, and `pnpm --filter @waffarly/super-admin build` passed. The Templates page chunk is 25.74 kB (gzip: 6.81 kB). The host reports Node 20.19 against the workspace's Node 24.11 requirement; the production build needed to run outside the sandbox because of the Windows Tailwind native-module spawn restriction. The app test script completed but found zero tests.
- The local preview server started on port 5174, but the in-app browser bridge rejected its sandbox metadata before the page could be inspected. Browser visual/interaction checks remain open.

### 2026-10-14 - Modules Matrix

- Added the lazy `/modules` route and sidebar navigation item, with a feature-specific matrix component and the shared activity/module React Query catalog hook.
- Built the matrix from the two distinct API fields: immutable `module.supportedActivities` support and each activity's saved `moduleKeys` association. Cells separately identify associated, supported-but-unassociated, unsupported, and inconsistent catalog pairs.
- Added URL-backed module search, Arabic translations for the platform defaults, Arabic-formatted counts, legends, summary cards, horizontal-scroll accessibility, and loading/error/empty/no-results states.
- Kept plan entitlement, subscription state, merchant access, and user permission out of the compatibility model and stated that boundary on the page.
- The activity/module feature specification confirms hybrid catalog governance. The previous progress note was corrected: the existing name/description/activity-association editor is approved by its API contract but still needs to be migrated into the redesigned `/activities` page.
- `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, and `pnpm --filter @waffarly/super-admin build` passed. Vite needed to run outside the sandbox because of the Windows Tailwind native-module spawn restriction; the matrix page chunk is 13.02 kB (gzip: 3.82 kB), and the app entry is 261.03 kB (gzip: 81.10 kB).
- Route/interaction tests and browser visual review were not run. The host reports Node 20.19, below the workspace's Node 24.11 requirement.

### 2026-10-14 - Modules Matrix Visual Alignment

- Reworked `/modules` from a loose KPI strip and full-width table into the reference's compact summary-card, filter-bar, matrix, and side-explainer composition.
- Added a small reusable `ModuleSummaryCard`, compact accessible matrix states, activity/relationship filters persisted in route query parameters, and Arabic translations for the new copy.
- Kept module and activity counts sourced from `/admin/activities-modules`; the page links to activity management instead of showing a non-functional “add module” action because modules are code-defined.
- `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, and `pnpm --filter @waffarly/super-admin build` passed. Vite/Tailwind needed to run outside the sandbox because of the Windows native-module spawn restriction. The Modules page chunk is 19.66 kB (gzip: 5.17 kB); the entry bundle is 261.03 kB (gzip: 81.11 kB).
- In-app browser visual inspection could not start because the browser bridge rejected its sandbox metadata; responsive screenshots remain unverified. The host reports Node 20.19 against the repository requirement of Node 24.11.

### 2026-10-14 - Plan Editor

- Added `/plans/new` and `/plans/:planId/edit` as lazy-loaded editor routes. The catalog now links to these routes instead of embedding the form.
- Reused the approved monthly-plan contract and field bounds. Edit details load from the existing plans list query because the API has no separate plan-detail endpoint.
- Added create/update mutations with targeted query invalidation. Unchanged create retries reuse their request ID; edits submit the revision snapshot from when the form was opened.
- Stale edits preserve the draft and disable saving until the administrator explicitly reloads the latest values; reloading warns before discarding a changed draft.
- Added internal navigation and page-unload guards for unsaved changes, including a keyboard-accessible native confirmation dialog.
- Added loading, retry, missing-plan, mutation-error, and success-feedback states, plus Arabic translations and RTL-aware back navigation.
- `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, `pnpm --filter @waffarly/super-admin typecheck`, scoped ESLint for the changed plan files, and `pnpm --filter @waffarly/super-admin build` passed. Full app lint currently reports an unused `Phone` import in the separate Merchant Details page. The host uses Node 20.19 against the repository's Node 24.11 requirement.
- Route/interaction tests and browser visual checks have not been run for this slice.

### 2026-10-14 - Business Activities Catalog

- Replaced the legacy `/activities` editor route with a dedicated, lazy-loaded catalog page. The feature spec confirms hybrid catalog governance and an existing revision-aware edit contract; porting that editor into the redesigned page remains follow-up work.
- Added a shared React Query hook for the existing `/admin/activities-modules` response and a small reusable activity card component.
- Added URL-backed search across activity names, keys, descriptions, and compatible module metadata, plus live summary counts and loading, retryable error, empty, and no-results states.
- Localized the platform's default activity/module names and descriptions for Arabic; administrator-authored custom catalog text remains unchanged when no translation is available.
- Made the compatibility boundary explicit: the relationships shown here do not grant subscription, merchant access, plan entitlement, or user permissions.
- Updated the sidebar label to “Business activities”; the Modules Matrix now has its own route and navigation entry.
- `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, and `pnpm --filter @waffarly/super-admin build` passed. The Vite build needed to run outside the sandbox because the Windows Tailwind native module cannot spawn within it; the activity page chunk is 11.35 kB (gzip: 3.49 kB), and the app entry is 260.31 kB (gzip: 80.91 kB).
- The host uses Node 20.19 against the workspace Node 24.11 requirement. Route/interaction tests and browser visual review were not run.

### 2026-10-14 - Business Activities Visual Alignment

- Reworked `/activities` to follow the supplied reference's compact metric cards, activity tiles, searchable catalog table, and standard-definition side panel. The former full-width warning and two-card layout no longer dominate the page.
- Extracted `CompactStatCard` as a small shared Tailwind component and reused it on both Activities and Modules for consistent KPI proportions and colors.
- The table separately shows code-supported modules and saved catalog associations, with mismatch detection; all four real API activity types remain visible rather than substituting the reference's illustrative “Electronics” category.
- Kept the refresh action instead of adding an “Add activity” control: the API has a fixed activity-key set and no create-new-type operation.
- `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/super-admin lint`, `pnpm --filter @waffarly/ui build`, and `pnpm --filter @waffarly/super-admin build` passed. The Activities page chunk is 16.64 kB (gzip: 4.27 kB); the entry is 261.02 kB (gzip: 81.10 kB).
- In-app browser verification could not connect because the browser bridge rejected the sandbox metadata; a visual screenshot check remains open. The host still reports Node 20.19 against the repository requirement of Node 24.11.

### 2026-10-14 - Business Activity Editor

- Migrated the legacy activity editor into the `/activities` side panel, with editable display name and description plus checkboxes limited to modules whose code definitions support that activity.
- Added a React Query mutation with targeted catalog invalidation. Saves send the activity's revision snapshot; a `409` preserves the draft, disables repeat submission, and tells the administrator to close, refresh, and reopen the latest entry.
- Added per-row edit actions, focus management, pending/error/success states, last-updated metadata, Arabic translations, and a clear note that activity/module compatibility does not grant access.
- Verification: `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, and `pnpm --filter @waffarly/super-admin build` passed. The Activities page chunk is 22.36 kB (gzip: 5.59 kB); the app entry is 261.06 kB (gzip: 81.13 kB). The app's `test` script ran successfully but found zero tests.
- Browser visual/interaction verification remains unavailable because the in-app browser bridge rejected the sandbox metadata; Node 20.19 also remains below the workspace's Node 24.11 requirement.

### 2026-10-14 - First-month Access Records

- Added the lazy-loaded `/subscriptions` route and sidebar navigation entry.
- The API has no subscription list, plan assignment, renewal, payment-history, or expiry endpoint; the page uses only the existing merchant first-month activation timestamp and supported activation endpoint.
- Added URL-backed search and access-state filtering, summary cards, loading/error/empty states, links to merchant details, and explicit out-of-platform collection confirmation before activation.
- Added prominent copy separating business creation from first-month access and disclosing unavailable plan/lifecycle/payment information.
- Added Arabic translations and reused the shared React Query merchant query and activation mutation.
- `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, and `pnpm --filter @waffarly/super-admin build` passed. Vite ran outside the sandbox because its Windows Tailwind native module requires process spawning; the page chunk is 10.60 kB (gzip: 3.29 kB), and the app entry is 260.25 kB (gzip: 80.87 kB).
- Route/interaction tests and browser visual review were not run; the environment still warns that Node 20.19 is below the repository's Node 24.11 requirement.

### 2026-10-14 - Plans Catalog

- Replaced the legacy `/plans` route content with a responsive Tailwind catalog using the approved monthly plan fields.
- Moved `/admin/plans` fetching into a feature hook and reused it on the dashboard so both pages share the React Query cache.
- Kept administrator-entered prices/currencies and actual descriptions from API data; added no sample offers, entitlements, limits, or availability states.
- Linked to the dedicated plan editor routes while retaining supported currency/price presentation and live plan data.
- Added loading skeletons, retryable load errors, empty state, mutation feedback, Arabic translations, and an explicit note that plan definitions do not change merchant access or payments.
- `pnpm --filter @waffarly/super-admin typecheck`, scoped ESLint for the changed route/catalog/dashboard files, and `pnpm --filter @waffarly/super-admin build` passed. Full app lint also passes after removing the unused icon import from Merchant Details. The current host uses Node 20.19, so pnpm reports the repository's Node 24.11 engine requirement.
- Automated route/interaction tests and browser visual checks have not been run for this slice.

### 2026-10-14 - Merchants List

- Added the dedicated `/merchants` page with a responsive Tailwind table, current access-state summary cards, search, business-activity and first-month-access filters, and URL-backed pagination.
- Added shared React Query hooks for merchant and application lists and reused them on the dashboard.
- Preserved `/` as the existing business-management compatibility flow; create and application-review links remain pointed there until those routes are migrated.
- Kept the first-month activation action within the existing contract and confirmation rule. No merchant detail, suspension, or new lifecycle state was added.
- The merchant endpoint returns the full list without server pagination, so pagination is client-side only; no API contract was invented.
- Added Arabic labels for the new merchant list, filters, empty states, and pagination.
- `pnpm --filter @waffarly/ui typecheck` and `pnpm --filter @waffarly/ui build` passed.
- `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, and `pnpm --filter @waffarly/super-admin build` passed.
- The final entry bundle is 250.64 kB (gzip: 78.28 kB). The host's Node 20.19 continues to print the workspace Node 24.11 engine warning.
- Automated merchant route/interaction tests and browser screenshots were not run in this slice.

### 2026-10-14 - Create Merchant

- Added the lazy-loaded `/merchants/new` route and connected the Merchants List create action to it. The root compatibility page remains available.
- Built a responsive, Tailwind-styled form with structured business details and owner account sections, plus a compact approval/access explanation panel.
- Reused the approved `CreateMerchantRequest` contract and matched its name, phone, username, and password bounds. Browser-native constraints handle local validation; API failures appear in an accessible alert summary.
- Added the create operation with TanStack React Query and targeted invalidation of the merchant list query.
- Kept the submitted password out of React Query mutation variables and browser storage. It is held in component memory only for the immediate success panel, which is dismissible; the form clears on success and clears the password after an API failure.
- Preserved the product rules: creating approves the business, first-month access is still inactive, owner verification is manual, and credential delivery remains private/manual.
- Added Arabic translations for all new page copy and described field hints for phone, username, and password constraints.
- `pnpm --filter @waffarly/ui typecheck`, `pnpm --filter @waffarly/ui build`, `pnpm --filter @waffarly/super-admin typecheck`, and `pnpm --filter @waffarly/super-admin lint` passed.
- `pnpm --filter @waffarly/super-admin build` passed outside the sandbox after the in-sandbox Vite/Tailwind native binary load hit a Windows `spawn EPERM` restriction. The new lazy chunk is 11.40 kB (gzip: 3.19 kB); the entry is 352.30 kB (gzip: 110.75 kB).
- Route/interaction tests and browser visual comparison were not run; the host still reports Node 20.19 against the repository's Node 24.11 engine requirement.

### 2026-10-14 - Merchant Details

- Added the lazy-loaded `/merchants/:merchantId` route and linked merchant names from the list to their details.
- The API exposes no merchant-by-id endpoint, so the page reads the existing full merchant summary query and handles loading, unavailable, missing-record, and stale-data states without inventing a new API contract.
- Added business/contact/activity, owner contact/login name, creation time, and the single supported first-month access fact. No plan, price, expiry, renewal, password, or unsupported lifecycle controls are shown.
- Reused the explicit external-collection confirmation for first-month activation and extracted the shared React Query activation mutation/invalidation hook for list and details pages.
- Added Arabic labels and helper copy for the details route.
- `pnpm --filter @waffarly/super-admin typecheck`, `pnpm --filter @waffarly/super-admin lint`, and `pnpm --filter @waffarly/ui typecheck` passed after removing the unused icon import.
- `pnpm --filter @waffarly/ui build` and `pnpm --filter @waffarly/super-admin build` passed. Vite needed to run outside the sandbox because loading its native Tailwind binary hit a Windows `spawn EPERM` restriction; the details page chunk is 7.50 kB (gzip: 2.26 kB), and the app entry is 349.40 kB (gzip: 110.20 kB).
- Page-level route/interaction tests and browser visual review have not been run.

### 2026-10-14 - Sidebar Visual Cleanup

- Refined the sidebar brand/header alignment, navigation spacing, active/inactive contrast, and footer layout using Tailwind utilities.
- Made the collapsed desktop state a deliberate 72px icon rail with centered branding, a visible expand control, and translated tooltips instead of labels that clip.
- Corrected the sidebar toggle glyph to depict the actual sidebar edge in each locale: left-panel icons for LTR and right-panel icons for RTL, without a misleading CSS flip.
- Explicitly centered the SVG inside the toggle button and removed browser-default button padding.
- Kept the responsive drawer state independent from desktop collapse state, including RTL/LTR off-canvas behavior and viewport transitions.
- `pnpm --filter @waffarly/super-admin typecheck` passed.
- `pnpm --filter @waffarly/super-admin lint` passed.
- `pnpm --filter @waffarly/super-admin build` passed; Node 20.19 still prints the repository's Node 24.11 engine warning.
- Browser visual comparison remains unverified because the in-app browser connection did not initialize.

### 2026-10-14 - Foundation and Platform Overview

- Added TanStack React Query, Zustand, and Lucide icons to `apps/super-admin`.
- Added a shared query client, admin query keys, and a Zustand store for sidebar and mobile navigation state.
- Replaced the old application wrapper with a protected RTL-aware shell, route-driven sidebar, topbar, and redesigned login page.
- Added `/dashboard` as the post-login start page while retaining `/` for the current business-management screen and adding `/merchants` as its named route.
- Rechecked the supplied token sheet and replaced drifted shell colors with exact named Tailwind palette tokens.
- Added Arabic copy for the shell, login, navigation, and overview, including RTL-aware spacing and Arabic-friendly tracking.
- Replaced the redesigned shell, login, and overview BEM stylesheet with Tailwind utilities; the remaining stylesheet is retained for pages still on the legacy UI.
- Fixed the RTL desktop sidebar transform and aligned its mobile/tablet breakpoint with the menu trigger.
- Rebuilt `@waffarly/ui` after localization changes so the new Arabic strings are present in the package output.
- Built the Platform Overview using live merchant, application, plan, and storefront template APIs. It shows registered businesses, pending applications, first-month access activation, and available storefronts.
- Reused shared `Button`, `Card`, `Badge`, and `Input` components; added small Super Admin compositions for page headers, metric cards, status badges, navigation, and route framing.
- `pnpm --filter @waffarly/super-admin typecheck` passed.
- Added route-level lazy loading; the latest production build's entry chunk is 250.64 kB (gzip: 78.28 kB).
- `pnpm --filter @waffarly/super-admin typecheck` and `pnpm --filter @waffarly/super-admin lint` passed after the final changes.
- `pnpm --filter @waffarly/super-admin build` passed. The current host uses Node 20.19, so pnpm still prints the repository requirement warning for Node 24.11.
- Local browser visual review was attempted, but the in-app browser connection did not initialize. Desktop/tablet/mobile visual checks remain open.
- No automated tests were added or run in this slice.

## Decisions and Blockers

| Date | Area | Decision or blocker | Status |
| --- | --- | --- | --- |
| 2026-10-14 | Visual reference | Use the supplied kit for presentation, not for business rules. | Decided |
| 2026-10-14 | Server state | TanStack React Query owns API data and mutations. | Decided |
| 2026-10-14 | Client state | Zustand owns only small client-side UI state. | Decided |
| 2026-10-14 | Shareable state | Routes and query parameters own shareable navigation, filters, sorting, and pagination. | Decided |
| 2026-10-14 | Governance | Requirements, viewer policy, event policy, retention, and API remain unresolved. | Blocked |

