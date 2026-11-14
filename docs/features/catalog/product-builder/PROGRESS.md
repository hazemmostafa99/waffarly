# Dynamic Product Builder — Implementation Progress

## Mandatory Tracking Rules

This file is the step-by-step execution ledger for `FEATURE.md` and must be updated after every implementation slice.

- `[ ]` Not started
- `[~]` In progress or implemented but not fully verified
- `[x]` Complete and verified with recorded evidence
- `[!]` Blocked by an explicit product, API, authorization, design, or environment dependency

Rules:

1. Never mark an item `[x]` without implementation and verification evidence.
2. Update Current Status and the Implementation Log before ending each work session.
3. Record exact commands, exit results, and relevant test counts.
4. Record pre-existing failures separately from regressions.
5. Do not delete blocker history; resolve it with a dated decision or leave it visible.
6. Update `FEATURE.md` before implementing an approved architecture or scope change.
7. Recheck the worktree before editing files that overlap existing uncommitted work.
8. A database item requires schema, migration, generated-client validation, and data-preservation evidence.
9. A backend item requires contract, validation, authorization, service, and tests where applicable.
10. A frontend item requires loading, empty, error, validation, pending, success, keyboard, RTL/LTR, and responsive behavior where applicable.
11. Do not treat POS or branch behavior as complete through mocks or hardcoded UI.
12. Do not mark the overall feature complete while any required item remains `[ ]`, `[~]`, or `[!]`.

## Current Status

- Overall: Core product-builder implementation is in place; final verification and a few release-level checks remain.
- Current milestone: M10 — Final verification and handoff.
- Current slice: Further Merchant UX simplification adds progressive disclosure, individual choice rows, direct review edit actions, and clearer typography. Merchant typecheck, lint, and production build pass; browser acceptance and isolated migration-fixture validation remain.
- Last updated: 2026-10-14.
- Baseline commit: `27c6e06d5d25f2c76dd10640c1b321d4e43c8a2e`.
- Worktree: Existing Storefront redesign changes remain present and preserved; feature work overlaps only in two Storefront product/cart presentation components. An additional untracked Storefront preview script and a second migration directory appeared during implementation and were left untouched.
- Primary risks: Node 20.19.0 is below the repository's declared Node 24.11–24.x range; migration application to a fresh/representative pre-feature database was not performed as part of this implementation.
- Next action: Re-run Merchant/Storefront browser acceptance, including keyboard and responsive checks, when the in-app browser is available; use an isolated database fixture to verify migration application before release.

## Known Worktree Constraints

Initial inspection found existing modifications under `apps/storefront`, `pnpm-lock.yaml`, and untracked storefront redesign files/documentation. These changes are presumed user-owned and must be preserved.

During implementation, `apps/storefront/.tmp-menu-preview-api.mjs` and `packages/database/prisma/migrations/20261014123502_reusable_product_configuration/` also appeared as untracked worktree items. They were not modified. The Storefront build changed tracked `next-env.d.ts`; that generated-only change was restored to its prior contents.

- [x] Inspect current `git status` before creating these documents.
- [x] Record the existing storefront overlap risk.
- [x] Capture the exact baseline status and commit hash at the start of implementation.
- [x] Recheck status before the first storefront code edit.

## Decision Gates

These gates distinguish required implementation from unresolved behavior.

- [x] Confirm optional variants with optional SKU, barcode, and stock.
- [x] Confirm restaurant sizes may be variants.
- [x] Confirm reusable tenant-owned modifier groups and relational product assignments.
- [x] Confirm authoritative backend validation and pricing.
- [x] Confirm immutable order snapshots and structured reportability.
- [x] V1 shared-group edit boundary selected: edits are rejected while any product is assigned; detach, edit, then reattach.
- [x] V1 modifier pricing selected: fixed adjustments/defaults live on product assignments.
- [!] Permanent group/option deletion remains unsupported until lifecycle policy is approved.
- [!] Branch-scoped cashier routing cannot be implemented without a persisted Branch domain and routing rules.
- [!] POS configuration cannot be integrated into a sale flow because the POS is currently a placeholder.

Blocked decisions must not stop unrelated work. Their affected behavior remains excluded or safely restricted as described in `FEATURE.md`.

## M0 — Baseline and Repository Audit

### Documentation and code audit

- [x] Read the supplied Product Builder brief.
- [x] Inspect `PROJECT_OVERVIEW.md` and `MVP_SCOPE.md`.
- [x] Inspect the Catalog overview and Products specification.
- [x] Inspect the current Prisma Product, Variant, Modifier, and Storefront Order models.
- [x] Inspect existing modifier, variant, and order migrations.
- [x] Inspect shared catalog contracts.
- [x] Inspect catalog product, quote, and storefront-order controllers/services.
- [x] Inspect Merchant Dashboard Product Builder structure.
- [x] Inspect Storefront product configurator structure.
- [x] Confirm the POS has no current catalog or sale surface.
- [x] Confirm Branches are mock dashboard data rather than a persisted backend domain.
- [x] Produce a concise technical audit covering existing behavior, gaps, migration risks, superseded decisions, and open rules in `FEATURE.md`.

### Baseline verification

- [x] Record Node and pnpm versions (`v20.19.0`, `10.34.5`; Node engine mismatch noted).
- [x] Turbo config/commands were not changed; installed Turbo documentation was not needed for this implementation.
- [x] Resolve installed Next.js from `apps/storefront` and read its relevant bundled documentation before Storefront client-component edits.
- [x] Run database validation.
- [x] Run existing contracts/database builds or typechecks.
- [x] Run existing API tests.
- [x] Run existing Merchant Product UI tests (the script completed with zero tests discovered).
- [x] Run relevant Storefront tests/build; baseline build compiled but hit sandbox `spawn EPERM` during TypeScript worker startup.
- [x] Record baseline failures separately from feature regressions in the Implementation Log.

### M0 exit criteria

- [x] Baseline evidence is recorded in the Implementation Log.
- [x] Audit conclusions are reflected in `FEATURE.md` or linked documentation.
- [x] No unresolved discovery question blocks the schema design slice; safe implementation boundaries are defined.

## M1 — Documentation and Contract Alignment

- [x] Update `PROJECT_OVERVIEW.md` with the approved variant/modifier decision.
- [x] Update `MVP_SCOPE.md` to remove the obsolete reusable-modifier deferral.
- [x] Update `docs/features/catalog/OVERVIEW.md` statuses and boundaries.
- [x] Update `docs/features/catalog/PRODUCTS.md` to distinguish variants, attributes, reusable groups, options, and assignments.
- [x] Record shared-edit, assignment-pricing, and deletion boundaries; permanent deletion remains unsupported.
- [x] Ensure no document claims POS, branches, advanced inventory, or analytics UI are implemented.
- [x] Review terminology across documentation for one consistent vocabulary.

### M1 exit criteria

- [x] Confirmed decisions and remaining restrictions are clearly separated.
- [x] Superseded Phase 3 restrictions are removed or explicitly marked superseded.

## M2 — Shared Contracts

### Variant contracts

- [x] Add variant attribute definition contract.
- [x] Add variant attribute value contract.
- [x] Add variant attribute selection contract.
- [x] Extend product variant reads with structured attributes.
- [x] Extend product writes with validated attribute definitions/values and variant selections.
- [x] Preserve optional SKU, barcode, and stock fields.

### Modifier contracts

- [x] Separate reusable modifier-group definition from product assignment.
- [x] Add reusable group list/detail/create/update request and response types required by the approved scope.
- [x] Add product assignment create/update/detach types.
- [x] Add assignment constraints and position to product projections.
- [x] Remove duplicated cross-app interfaces after consumers migrate.

### Quote, order, and reporting contracts

- [x] Extend quote response with resolved structured variant attributes.
- [x] Ensure quote selections use stable assignment/group and option IDs.
- [x] Extend owner order responses with stable snapshot IDs where appropriate.
- [x] Add report aggregation contracts for the exposed report endpoint.
- [x] Confirm every monetary field remains a decimal string.

### M2 verification

- [x] Build/typecheck `@waffarly/contracts`.
- [x] Typecheck all direct contract consumers.
- [x] Record intentional compatibility/migration notes.

## M3 — Prisma Schema and Data Migration

### Schema design

- [x] Add tenant-owned reusable Modifier Group model.
- [x] Keep Modifier Option tenant-safe beneath its shared group.
- [x] Add Product Modifier Group Assignment with product-specific constraints and ordering.
- [x] Add Variant Attribute Definition model.
- [x] Add Variant Attribute Value model.
- [x] Add Variant Attribute Selection join model.
- [x] Add composite tenant-safe keys and indexes.
- [x] Add uniqueness constraints that do not make nullable SKU/barcode mandatory.
- [x] Add order modifier group/option snapshot identity fields.
- [x] Add structured order variant-attribute snapshot storage.

### Migration implementation

- [x] Create migration SQL using repository conventions.
- [x] Migrate each product-local group to one shared group plus one product assignment.
- [x] Preserve existing group/option IDs where safe.
- [x] Preserve current constraints, positions, defaults, and price adjustments.
- [x] Keep existing variants valid without fabricated attributes.
- [x] Preserve every existing order and selection snapshot.
- [x] Add migration validation assertions for transformed counts; composite tenant-safe constraints enforce relationships.
- [x] Review delete/restrict behavior for products, groups, options, assignments, and snapshots.

### M3 verification

- [x] Run Prisma validation and generate Prisma client successfully.
- [!] Apply the migration to a separate empty test database; no disposable database is configured.
- [!] Apply it to a representative pre-feature database fixture; no pre-feature fixture is available. The configured local database reports all 17 migrations, including this migration, up to date.
- [x] Verify product/modifier/variant/order persistence on current migrated PostgreSQL using rollback-only integration fixtures.
- [x] Document forward-fix/recovery strategy; migration guards transformed row counts before dropping legacy tables.

## M4 — Reusable Modifier Backend

### Owner API

- [x] Add tenant-scoped reusable modifier-group controller/routes.
- [x] List groups with ordered options and assignment usage.
- [x] Create a group with validated ordered options.
- [x] Read a single owned group.
- [x] Implement safe update behavior (edits blocked while any product is assigned).
- [x] Assign an owned group to an owned product.
- [x] Update assignment selection constraints and display position through product writes.
- [x] Detach assignment without deleting the group or other assignments.
- [x] Reject duplicate assignments.
- [x] Reject cross-tenant group, option, assignment, and product references.
- [x] Define explicit conflict response for blocked destructive/cross-product edits.

### Validation and concurrency

- [x] Validate names, limits, positions, defaults, and selection-mode rules.
- [x] Enforce tenant-safe lookups inside transactions.
- [x] Preserve revision/concurrency behavior on affected products.
- [x] Prevent partial group/option/assignment writes.
- [x] Keep historical order snapshots independent from catalog edits.

### M4 tests

- [x] Create/read reusable group and exercise owner attach/detach routes.
- [x] Exercise one group assigned to two products and verify detaching one preserves the other; verified against PostgreSQL.
- [x] Reject another tenant's group and invalid/duplicate option/assignment input.
- [x] Verify min/max/single/multiple/default constraints.
- [x] Verify blocked shared-definition edits are explicit and tested.

## M5 — Structured Variants, Configurator, and Pricing

### Product writes

- [x] Create a simple product without variants.
- [x] Create variants without SKU, barcode, or stock.
- [x] Create generic attribute definitions and ordered values.
- [x] Associate variants with structured values.
- [x] Support the restaurant Size UI without a Size-specific database field.
- [x] Validate product/attribute/value/variant tenant consistency.
- [x] Preserve compatible existing flat variants.
- [x] Avoid automatic combination generation.

### Configurator service

- [x] Use one backend configuration validator/pricer for quotes and storefront-order re-quoting.
- [x] Validate product availability and storefront ownership context.
- [x] Require a variant only when the product has variants.
- [x] Reject variants from another product or tenant.
- [x] Validate modifier assignments rather than product-owned groups.
- [x] Reject unassigned groups, foreign options, duplicates, and invalid counts.
- [x] Resolve documented default-selection behavior consistently.
- [x] Return a typed price breakdown and structured resolved configuration.

### Pricing

- [x] Quote simple product base price.
- [x] Quote selected variant authoritative price.
- [x] Add supported fixed modifier adjustments.
- [x] Keep decimal-safe arithmetic.
- [x] Do not add taxes, discounts, fees, contextual overrides, or option quantities.
- [x] Keep extension points narrow; no rules engine added.

### M5 tests

- [x] Cover simple, variant-only, modifiers-only, and combined product flows across unit/database tests.
- [x] Cover variants with SKU, barcode, and stock omitted.
- [x] Cover structured Size and a second generic attribute dimension through product write, quote, order snapshot, and catalog edit.
- [x] Cover foreign variant and forged modifier selections.
- [x] Cover min/max/single/multiple/default behavior.
- [x] Cover fixed-precision variant-plus-modifier totals.
- [x] Cover rejection of client price manipulation.

## M6 — Orders and Report-Ready Data

### Order persistence

- [x] Re-quote each submitted order item with the shared configurator.
- [x] Persist product and variant identity plus name snapshots.
- [x] Persist structured variant attribute ID/name/value snapshots.
- [x] Persist modifier group/option IDs, names, positions, and adjustments.
- [x] Persist effective base, modifier, unit, quantity, and line totals.
- [x] Keep snapshot writes in the order transaction.
- [x] Preserve optional tracked-stock reservation behavior.
- [x] Verify catalog edits after purchase do not alter stored order name, price, or attribute snapshots.
- [x] Confirm existing accepted/rejected order transitions still work.

### Reporting

- [x] Add tenant-scoped aggregation by product and variant.
- [x] Add aggregation by attribute definition/value.
- [x] Add aggregation by modifier option.
- [x] Add supported date-range filtering.
- [x] Classify legacy rows without IDs as legacy/unclassified.
- [x] Do not parse display strings to infer identifiers.
- [x] Do not create an analytics dashboard.

### M6 tests

- [x] Snapshot variant identity and price.
- [x] Snapshot structured variant attributes.
- [x] Snapshot modifier identities, names, and adjustments.
- [x] Edit catalog definitions after an order and verify the persisted snapshot remains unchanged.
- [x] Aggregate sales by variant correctly.
- [x] Aggregate sales by attribute value correctly.
- [x] Verify report tenant isolation.
- [x] Verify cashier acceptance behavior has no regression in existing owner order transition coverage.

## M7 — Merchant Dashboard Product Builder

### Data layer

- [x] Update the typed API client for modifier library and product assignments.
- [x] Use existing product query/invalidation flow for product edits; add library loading/error/empty states.
- [~] Manual verification of conflict, validation, loading, empty, retry, and stale-revision states remains.

### Builder workflow

- [x] Retain Basic Information step.
- [x] Add explicit Simple Product versus Variants choice.
- [x] Add generic attribute name/value editor, including restaurant Size.
- [x] Create/edit variants with independent price.
- [x] Label SKU, barcode, and stock as optional and keep them non-blocking.
- [x] Add reusable modifier library selection.
- [x] Add new reusable group creation flow.
- [x] Configure assignment-level order, required/optional state, min, max, and mode.
- [x] Detach a group without deleting it.
- [x] Show shared usage count; shared definition editing is not exposed while linked.
- [x] Update pricing review and preview.
- [x] Preserve Arabic RTL and English LTR support in existing conventions.
- [x] Separate reusable-group attachment and group creation into explicit paths; remove the redundant disabled empty-state action.
- [x] Clarify the optional product-choice empty state and highlight the selected product type.
- [x] Strengthen the final review with an image placeholder, availability status, and customer-choice count.

### M7 verification

- [!] No Merchant Dashboard component tests are configured; current `test` script discovers zero tests.
- [ ] Add/update Playwright merchant-product coverage.
- [ ] Manually verify keyboard and screen-reader form behavior.
- [ ] Manually verify mobile, tablet, and desktop layouts.
- [ ] Manually verify simple, variants-only, modifiers-only, and combined save flows.
- [ ] Manually verify optional variant fields can remain blank.
- [x] Verify API attach/detach and shared reuse flow through PostgreSQL integration tests.

## M8 — Storefront Integration

### Safety gate

- [x] Recheck `git status` and identify overlap with the existing storefront redesign before editing.
- [x] Read installed Next.js documentation required by `apps/storefront/AGENTS.md`.
- [x] Preserve the current storefront architecture, design system, and uncommitted user work.

### Catalog/configurator

- [x] Consume structured variant and assignment contracts.
- [x] Keep one parent product listing card.
- [x] Show the lowest available variant price as the starting price.
- [x] Render generic variant choices without hardcoded Size logic.
- [x] Render only assigned reusable modifier groups.
- [x] Request authoritative quotes for supported configuration changes.
- [x] Reconcile persisted cart selections against current IDs.
- [x] Re-quote at checkout and surface stale/invalid selection errors.
- [x] Avoid trusting browser totals.

### M8 verification

- [!] No Storefront unit/component tests are configured; current `test` script discovers zero tests.
- [ ] Add/update end-to-end product configuration coverage.
- [ ] Manually verify parent listing, product detail, cart, and checkout flows.
- [ ] Manually verify loading, unavailable, error, retry, and stale-cart states.
- [ ] Manually verify Arabic RTL and English LTR at required viewports.
- [x] Run production build; HTTP/browser smoke checks remain.

## M9 — Compatibility Boundaries

- [x] Preserve legacy Product API writes while documenting the preferred assignment API and migration.
- [x] Verify product, variant, modifier, and order persistence on the current migrated database.
- [x] Preserve owner order inbox and accept/reject behavior in API/integration coverage.
- [x] Confirm no new mandatory inventory dependency was introduced.
- [x] Confirm no product-specific restaurant field exists.
- [x] Confirm no variant is generated from modifier combinations.
- [x] Confirm group definitions are related through assignments, not duplicated.
- [x] Confirm frontend quote/order paths use server-authoritative prices.
- [x] Confirm tenant-scoped references are validated and constrained.
- [x] Document the POS integration boundary without implementing fake sales.
- [x] Document the Branch routing dependency without weakening cashier acceptance.

## M10 — Final Verification and Handoff

### Required commands

- [x] Prisma validate/generate; formatting was not run to avoid broad reformatting.
- [x] Read-only database migration status reports 17 migrations and schema up to date.
- [x] Contracts build/typecheck.
- [x] API lint/typecheck/tests/build.
- [x] Merchant Dashboard lint/typecheck/tests/build; test script discovers zero tests.
- [x] Storefront lint/typecheck/tests/build; test script discovers zero tests.
- [ ] Relevant Playwright suites (not run).
- [ ] Root-level lint, typecheck, test, and build where practical (package-level checks were run instead).
- [x] Final `git diff --check` (rerun after documentation updates).
- [x] Final `git status --short` review (rerun before handoff).

### Documentation and deliverables

- [x] Update implementation statuses honestly.
- [x] Record architecture summary.
- [x] Record confirmed V1 boundaries and unresolved lifecycle questions.
- [x] Record database and migration changes.
- [x] Record backend and contract changes.
- [x] Record frontend changes.
- [x] Record order and reporting changes.
- [x] Record exact verification results and environment caveats.
- [x] List important changed files.
- [x] List deliberately deferred capabilities.
- [x] List remaining acceptance work as next steps.

### Completion gate

- [ ] Every required milestone is complete and verified; browser acceptance and disposable migration fixture checks remain.
- [x] Remaining `[!]` items are explicit environment or product-scope boundaries.
- [x] No unverified claim remains in feature documentation.
- [x] No unrelated user work was overwritten.

## Implementation Log

### 2026-10-14 — Feature planning documents

- Created `FEATURE.md` as the Product Builder implementation contract.
- Created this progress tracker with ordered milestones, exit criteria, decision gates, and verification requirements.
- Audit evidence inspected during planning:
  - Project overview and MVP scope.
  - Catalog overview and Products specification.
  - Prisma schema and Product Variant, Modifier Group, and Storefront Order migrations.
  - Shared Catalog contracts.
  - Product/quote/order services and controllers.
  - Merchant Product Builder, Storefront configurator, POS placeholder, and mock Branch dashboard.
- Current findings:
  - Optional priced variants and authoritative quote/order pricing already exist.
  - Modifier groups are currently product-local and replaced during product update.
  - Stable modifier IDs and structured variant attributes are missing from order snapshots.
  - POS and persisted Branch capabilities do not yet exist.
- Verification performed: documentation/code inspection only. No build, test, lint, typecheck, Prisma validation, or migration command has been run for this feature yet.
- Worktree warning: pre-existing storefront modifications and untracked storefront redesign files must be preserved.

### 2026-10-14 — Core implementation

- Added tenant-owned reusable modifier definitions and separate product assignments. Assignment rows hold selection rules, option fixed adjustments, defaults, and display positions; definition edits are blocked while assigned, and no permanent-delete route is exposed.
- Added generic product variant attribute definitions, values, and selections, plus stable modifier/attribute order snapshots and price-breakdown fields.
- Added a data migration that preserves legacy modifier group/option IDs, converts each old product-local group into a shared definition plus its original assignment, retains assignment-specific option prices/defaults, and asserts migrated counts before dropping legacy tables.
- Extended shared contracts and Product API writes/reads/quotes. Kept a compatibility path for existing product-local write payloads; the Merchant Builder uses reusable assignments.
- Added owner modifier-library list/detail/create/update routes, product attach/detach routes, safe revision checks, tenant validation, and `GET /owner/reports/product-configuration` aggregation over accepted-order snapshots.
- Updated order creation to re-quote and persist stable modifier/variant-attribute identities, names, positions, effective base/modifier totals, and existing price snapshots in the order transaction.
- Updated Merchant Product Builder with simple/variants mode, optional variant identifiers/stock, generic attribute rows, reusable group selection/creation, assignment constraints, and detach behavior.
- Integrated structured variant labels into the existing Storefront configurator/cart presentation while preserving the user's pre-existing Storefront redesign files and architecture.
- Updated project/MVP/catalog documentation and this tracker. No POS sale flow, branch routing, analytics dashboard, option quantity, conditional rules, or new inventory model was added.
- Known release follow-ups: manual/Playwright Merchant/Storefront acceptance and migration application against isolated empty/pre-feature database fixtures. The configured local database reports all 17 migrations up to date; this implementation did not apply a migration.
- Browser smoke check was attempted using the required Browser skill workflow, but the in-app browser session could not be connected; no alternate browser-control path was used.

### 2026-10-14 - Merchant options and review UI/UX refinement

- Reorganized option-group setup into two explicit paths: attach a saved reusable group or create a new group. The entry flow explains reuse and product-specific pricing/selection rules, reports available-group/choice counts, and replaces the disabled empty-state button with clear optional guidance.
- Highlighted the selected simple-versus-variants choice and shortened the information banner to the distinction between variants and add-ons, including the optional SKU/barcode/stock reminder.
- Improved the final review with a no-image placeholder, clear sale-availability status, and a count/empty state for customer choices. Added responsive styles while preserving RTL/LTR layout conventions.
- Verification: Merchant typecheck and lint passed. Production build passed after retrying outside the restricted sandbox; it compiled 109 modules and retained the existing large-chunk warning. The Node 20 versus Node 24 engine mismatch remains.
- The in-app browser connection remained unavailable, so visual viewport, keyboard, and screen-reader acceptance has not been completed. Existing Playwright/manual acceptance checklist items remain open.

### 2026-10-14 - Further Merchant UI and workflow simplification

- Variants show name and price first; optional identifiers, stock, and availability are in an expandable section. Help text is expandable, and switching to a simple product prompts before discarding entered variants.
- New groups use individual, labelled choice inputs with add/remove controls instead of a multiline textarea. Empty libraries default to creation. Assigned groups have a required-choice checkbox, expandable selection limits, display names instead of read-only inputs, and an action to clear defaults (including single-choice defaults).
- Added direct section-edit actions on review, descriptive next-step buttons, keyboard arrow/Home/End navigation for the step tabs, and step subtitles. Navigation no longer displays completion checks solely because a later tab was opened.
- Increased field/control readability and touch target sizes, applied the existing admin font, reduced preview width, and improved price hierarchy. Responsive layouts retain RTL/LTR support.
- Verified with `pnpm --filter @waffarly/merchant-dashboard typecheck` and `lint` (exit 0), and the approved elevated local `build` (exit 0, 109 modules). Existing Node engine and chunk-size warnings remain. `git diff --check` reports no whitespace errors.
- Browser connection was attempted again but remains unavailable. Visual, keyboard, screen-reader, create/edit-save, and viewport acceptance remain unverified; no automated UI tests are configured.

## Baseline and Verification Results

Record commands in chronological order. Do not replace old results; append new dated entries.

| Date       | Scope          | Command                                                                       | Result                   | Notes                                                                                                                                                                                                                                              |
| ---------- | -------------- | ----------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14 | Planning       | Repository and documentation inspection                                       | PASS                     | Read-only audit; not a build or automated test.                                                                                                                                                                                                    |
| 2026-10-14 | Baseline       | `node --version`; `pnpm --version`; `git rev-parse HEAD`                      | PASS                     | Node `v20.19.0`, pnpm `10.34.5`, baseline commit `27c6e06d5d25f2c76dd10640c1b321d4e43c8a2e`; current Node is below repo engine range `>=24.11.0 <25`.                                                                                              |
| 2026-10-14 | Baseline       | Existing API suite                                                            | PASS                     | 46 passed before feature work; run outside sandbox because Node worker spawning returned `EPERM`.                                                                                                                                                  |
| 2026-10-14 | Baseline       | Database/contracts/API/Merchant/Storefront typechecks and database validation | PASS                     | Storefront production build compiled but its TypeScript worker hit sandbox `spawn EPERM`; Merchant test command discovered zero tests.                                                                                                             |
| 2026-10-14 | Implementation | `pnpm --filter @waffarly/contracts build`                                     | PASS                     | Shared contracts compile.                                                                                                                                                                                                                          |
| 2026-10-14 | Implementation | `pnpm --filter @waffarly/database db:validate`; `db:generate`                 | PASS                     | Prisma schema valid; client generated from Prisma 7.10.0.                                                                                                                                                                                          |
| 2026-10-14 | Implementation | `pnpm --filter @waffarly/database db:check`                                   | PASS                     | Read-only status: 17 migrations found; configured local PostgreSQL reports schema up to date. No migration was applied during this run.                                                                                                            |
| 2026-10-14 | Implementation | `pnpm --filter @waffarly/api test`                                            | PASS                     | 51 passed, 0 failed. Requires elevated execution in this environment due Node test-worker `spawn EPERM`.                                                                                                                                           |
| 2026-10-14 | Implementation | `pnpm --filter @waffarly/api test:catalog-db`                                 | PASS                     | 2 PostgreSQL integration tests passed, including legacy modifier migration behavior and attach/reuse/detach. Test fixtures roll back.                                                                                                              |
| 2026-10-14 | Implementation | `pnpm --filter @waffarly/api test:storefront-orders-db`                       | PASS                     | 1 PostgreSQL integration test passed, including stable modifier and structured attribute snapshots. Test fixtures roll back.                                                                                                                       |
| 2026-10-14 | Implementation | API lint/typecheck/build                                                      | PASS                     | All package commands completed successfully.                                                                                                                                                                                                       |
| 2026-10-14 | Implementation | Merchant lint/typecheck/build                                                 | PASS                     | Build warns that one JavaScript chunk exceeds 500 kB. Test script discovers 0 tests.                                                                                                                                                               |
| 2026-10-14 | UI refinement  | `pnpm --filter @waffarly/merchant-dashboard typecheck`                        | PASS                     | TypeScript check after options/review UI changes; Node engine warning remains (`v20.19.0`, expected `>=24.11.0 <25`).                                                                                                                              |
| 2026-10-14 | UI refinement  | `pnpm --filter @waffarly/merchant-dashboard lint`                             | PASS                     | ESLint completed without findings.                                                                                                                                                                                                                 |
| 2026-10-14 | UI refinement  | `pnpm --filter @waffarly/merchant-dashboard build`                            | PASS after sandbox retry | Initial restricted run hit Windows `spawn EPERM`; elevated local build compiled 109 modules. Existing >500 kB JavaScript chunk warning and Node engine warning remain.                                                                             |
| 2026-10-14 | UI refinement  | `pnpm --filter @waffarly/merchant-dashboard test`                             | PASS / NO TESTS          | `node --test` completed successfully but discovered 0 tests.                                                                                                                                                                                       |
| 2026-10-14 | UI refinement  | In-app browser/manual viewport acceptance                                     | NOT RUN                  | Browser connection remained unavailable; no visual, keyboard, screen-reader, or responsive claim is made.                                                                                                                                          |
| 2026-10-14 | Implementation | Storefront lint/typecheck/build                                               | PASS                     | Production build succeeds when run outside sandbox. Test script discovers 0 tests.                                                                                                                                                                 |
| 2026-10-14 | Implementation | Playwright/manual browser checks                                              | NOT RUN                  | Merchant/Storefront UX acceptance remains a handoff item.                                                                                                                                                                                          |
| 2026-10-14 | Implementation | Browser-skill local UI smoke check                                            | BLOCKED                  | Required in-app browser session could not be connected in this workspace; no alternate browser-control path was used.                                                                                                                              |
| 2026-10-14 | Implementation | Empty/pre-feature migration fixture                                           | NOT RUN                  | No disposable database or representative pre-feature fixture was configured; do not run destructive migration checks against a real database.                                                                                                      |
| 2026-10-14 | Implementation | `git diff --check`                                                            | PASS                     | Only line-ending warnings were reported for existing CRLF-configured files; no whitespace errors.                                                                                                                                                  |
| 2026-10-14 | Implementation | Final package-check batch                                                     | INFRASTRUCTURE FAILURE   | Twelve concurrent checks exceeded available Windows memory/process capacity. Key package checks had already passed individually; Storefront build passed again in the batch, and API build/typecheck were rerun sequentially afterward and passed. |

## Blocker and Decision History

| Date       | Area               | Status          | Detail                                                                                                          | Resolution required                                            |
| ---------- | ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-10-14 | Shared editing     | RESOLVED FOR V1 | Shared definition edits are rejected while assigned; detach, edit, and reattach is the only supported workflow. | Revisit only if a cross-product publishing policy is approved. |
| 2026-10-14 | Modifier pricing   | RESOLVED FOR V1 | Fixed price adjustments and defaults are assignment-specific, preserving product-local legacy behavior.         | Variant-specific/contextual pricing remains deferred.          |
| 2026-10-14 | Permanent deletion | RESTRICTED      | No permanent group/option delete endpoint is exposed.                                                           | Approve lifecycle/history policy before adding deletion.       |
| 2026-10-14 | Branch routing     | BLOCKED         | There is no persisted Branch domain or order branch ID.                                                         | Separate Branch and routing implementation/approval.           |
| 2026-10-14 | POS integration    | BLOCKED         | POS contains only a placeholder workspace.                                                                      | Approved POS catalog/sale workflow and authorization context.  |
