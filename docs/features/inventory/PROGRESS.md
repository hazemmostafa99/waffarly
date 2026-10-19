# Inventory, Product Mapping & Recipes — Implementation Progress

## Current state

- Last audited: 2026-10-15.
- Feature contract: [FEATURE.md](FEATURE.md).
- Delivery state: **M1-M5 implemented and hardened; M6a owner recipe lifecycle is complete; M6b staff branch access and the incoming recipe-order POS queue are implemented. Focused M6b API/database checks and targeted browser acceptance pass.**
- Baseline branch/commit: `main` / `264fa1a263b1f04ada4ca3941ece18bb14b7995c`.
- M0 pre-existing worktree change: `apps/storefront/next-env.d.ts`; preserved at that checkpoint.
- Architecture-hardening baseline: clean worktree at `42ec842`; no unrelated changes were present when the fixes started.
- Existing foundation: Product Builder, reusable modifiers, pricing, storefront checkout, owner order actions, and optional variant counters.
- Remaining foundations: purchase returns and remaining stock operations. Walk-in/direct POS sales, employee cancellation, and order completion remain separate workflows.
- M0 baseline verification: 58 API HTTP/unit tests and 2 selected PostgreSQL integration tests passed; API/contracts typechecks passed; schema validation passed; migration status reported 17 migrations up to date before M1. See the exact ledger below for M1 checks.

This document adapts `WAFFARLY_IMPLEMENTATION_PROGRESS.md` and `WAFFARLY_COMMERCE_FEATURE_SPEC.md`, supplied from Downloads. Their initial repository statuses were UNVERIFIED. The M0 audit below records the pre-implementation state of this checkout. The supplied documents' embedded execution prompts were reference material; the user's later “ok go” authorized the scoped M1 implementation.

## Status conventions

| Status                  | Meaning                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| EXISTS                  | Located in source/schema with an evidence reference. Does not by itself claim browser or production verification.                 |
| PARTIAL                 | Reusable implementation exists, but named target behavior is absent.                                                              |
| MISSING                 | No implementation found after inspecting the relevant schema, API modules, contracts, frontends, migrations, and scoped searches. |
| CONFLICT                | Current behavior differs from the supplied target; preserve current behavior until an intentional transition is implemented.      |
| NOT STARTED             | Planned milestone has no implementation changes in this workstream.                                                               |
| IN PROGRESS             | Implementation has started but the milestone exit criteria are not all verified.                                                  |
| DECISION NEEDED         | A named decision gates a specific future slice; it does not block this documentation deliverable.                                 |
| TESTED                  | Only the behavior/suite explicitly executed and reported in the verification ledger.                                              |
| DEFERRED / NOT TARGETED | Business scope, not a claim of implementation or absence.                                                                         |

Keep implementation and test status separate. A baseline test pass does not make a new recipe requirement implemented. Checkboxes track work done in this workstream, not historical product approvals.

## Repository map

| Area            | Actual location / responsibility                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace       | pnpm workspaces; `apps/api`, `apps/merchant-dashboard`, `apps/storefront`, `apps/pos`, `apps/super-admin`. Root scripts use Turbo; no Turbo commands/configuration changed in this task.                                                                                                                                                                                          |
| Runtime/tooling | `.node-version`: Node 24.11.1; pnpm 10.34.5. Manifests pin NestJS 12.1.3, Prisma 7.10.0, TypeScript 5.9.3, React 19.3.0, Vite 8.3.3, Next.js 16.4.0. These are repository declarations, not independently checked latest releases.                                                                                                                                                |
| Backend         | [API architecture](../../architecture/API_ARCHITECTURE.md); feature modules registered in [AppModule](../../../apps/api/src/app.module.ts).                                                                                                                                                                                                                                       |
| Database        | [Prisma schema](../../../packages/database/prisma/schema.prisma), [migrations](../../../packages/database/prisma/migrations), and [database scripts](../../../packages/database/package.json). PostgreSQL; generated client is package-owned.                                                                                                                                     |
| Contracts       | [catalog.ts](../../../packages/contracts/src/catalog.ts) and [root exports](../../../packages/contracts/src/index.ts); all frontends use `@waffarly/contracts`, not database imports.                                                                                                                                                                                             |
| Merchant UI     | [routes.tsx](../../../apps/merchant-dashboard/src/routes.tsx), [ProductBuilderPage.tsx](../../../apps/merchant-dashboard/src/features/catalog/product-builder/ProductBuilderPage.tsx), [StorefrontOrdersPage.tsx](../../../apps/merchant-dashboard/src/StorefrontOrdersPage.tsx), and [EmployeesPage.tsx](../../../apps/merchant-dashboard/src/features/staff/EmployeesPage.tsx). |
| Customer UI     | [customizer](../../../apps/storefront/src/features/catalog/storefront-product-customizer.tsx), [cart state](../../../apps/storefront/src/features/cart/storefront-store.ts), and [checkout](../../../apps/storefront/src/features/checkout/storefront-checkout-page.tsx).                                                                                                         |
| POS             | [POSScreen.tsx](../../../apps/pos/src/POSScreen.tsx) receives persisted branch-scoped recipe orders and shares the Orders lifecycle API. [Login.tsx](../../../apps/pos/src/Login.tsx) authenticates merchant-scoped employees through `/auth/pos/*`.                                                                                                                              |
| Test layout     | API `test/http`, `test/unit`, `test/database`; browser tests under root `tests/ui`. Default API tests exclude database suites.                                                                                                                                                                                                                                                    |
| CI              | [.github/workflows/ci.yml](../../../.github/workflows/ci.yml): Node 24, install, generate, lint/format/typecheck/test/build/validate. No PostgreSQL service or dedicated database suite is configured in this workflow.                                                                                                                                                           |

## Audit evidence index

### E01 — Tenant, authentication, activity, and access

- [owner.guard.ts](../../../apps/api/src/modules/auth/owner.guard.ts), [current-actor.ts](../../../apps/api/src/modules/auth/current-actor.ts), and [auth.service.ts](../../../apps/api/src/modules/auth/auth.service.ts): owner actor carries `merchantId`; active first-month coverage is checked; sessions are opaque hashed tokens.
- At M0, schema had Merchant, OwnerAccount, AuthSession, and platform activity/module metadata, but no persisted Branch domain. M2 later adds persisted branch/warehouse management; there is still no employee membership/role/permission or branch-scoped authorization.
- [capability-registry.ts](../../../apps/api/src/modules/activities/capability-registry.ts) exposes `merchant-profile` and `storefront-design`; neither Inventory nor Catalog is registered as an entitled capability. Metadata is not operational authorization.
- Result: tenant/owner foundation and owner-managed branches/warehouses EXIST; staff/branch permissions, complete entitlements, and activity inventory defaults remain MISSING.

### E02 — Product and variant lifecycle

- [product.service.ts](../../../apps/api/src/modules/catalog/products/product.service.ts), [product.schemas.ts](../../../apps/api/src/modules/catalog/products/product.schemas.ts), and [product.rules.ts](../../../apps/api/src/modules/catalog/products/product.rules.ts): tenant reference checks, positive price, category/image requirements, revisions, archive/restore, order-history deletion protection.
- [product-variants.persistence.ts](../../../apps/api/src/modules/catalog/products/persistence/product-variants.persistence.ts): retained variant IDs update in place; omitted variants may be deleted; structured attribute identities are retained when submitted.
- Variant SKU/barcode/stock are optional. Product writes include no inventory mode, mapping, units, or recipe.
- ProductService blocks variant edits while a pending order has `stockReserved: true`. This is legacy reservation protection, not a general in-flight recipe lock.
- Result: Product Builder foundation EXISTS; inventory-aware configuration is MISSING.

### E03 — Reusable modifiers and selection identity

- Schema: `ModifierGroup`, `ModifierOption`, `ProductModifierGroupAssignment`, and `ProductModifierGroupAssignmentOption` with tenant-safe relations.
- [modifier-group.service.ts](../../../apps/api/src/modules/catalog/modifiers/modifier-group.service.ts): shared edits rejected while assigned. Editing an unused group's option list deletes/recreates those option identities; future recipe references require additional lifecycle design.
- [product-modifiers.persistence.ts](../../../apps/api/src/modules/catalog/products/persistence/product-modifiers.persistence.ts): product-specific constraints, defaults, and prices; retained assignments preserve their IDs; every shared option must appear once in assignment configuration.
- Legacy `modifierGroups` writes remain supported and can recreate groups/options; preferred UI uses `modifierGroupAssignments`.
- Quote selection `groupId` is the **assignment ID**, while shared `modifierGroupId` is separate. Historical selections retain shared group/option IDs, not an assignment relation or recipe.
- Result: reuse and distinct selection limits EXIST; quantity caps, repeated selections, variant availability/prices, and stock effects are MISSING.

### E04 — Authoritative pricing

- [product-pricing.service.ts](../../../apps/api/src/modules/catalog/pricing/product-pricing.service.ts) validates availability, variant membership, assignment membership, defaults, min/max, and duplicate options. Selected variant price replaces product base price; modifier adjustments come from the product assignment.
- [money.ts](../../../apps/api/src/common/money/money.ts) uses `bigint` cents, with decimal-string HTTP values. [catalog.constants.ts](../../../apps/api/src/modules/catalog/catalog.constants.ts) caps positive base/variant prices at `9999999999.99`; existing modifier adjustments are nonnegative.
- [quote.schemas.ts](../../../apps/api/src/modules/catalog/pricing/quote.schemas.ts) uses `optionIds`, with no per-option quantity or override context.
- [public-storefront.controller.ts](../../../apps/api/src/modules/storefront/public-storefront.controller.ts) scopes public quotes by storefront slug. [product-quote.controller.ts](../../../apps/api/src/modules/catalog/pricing/product-quote.controller.ts) also retains a legacy unscoped quote route; do not copy that pattern into new inventory mutations.
- Result: shared server pricing EXISTS; the supplied pricing extension is PARTIAL. Base-price precedence and EGP precision are already settled in current behavior.

### E05 — Stock reservation and order transitions

- [storefront-orders.service.ts](../../../apps/api/src/modules/orders/storefront-orders.service.ts): obtains quotes before the write transaction, then rechecks tenant product availability/revision inside it. It snapshots sale facts and conditionally decrements tracked `ProductVariant.stockQuantity` with sufficient-quantity predicates.
- Creation and status operations use Serializable transactions; serialization conflicts become HTTP conflict responses. Order creation still uses legacy variant counters rather than the M2 Inventory ledger and has no inventory source-idempotency record.
- Only `pending → accepted/rejected` exists. A repeated terminal action conflicts. Rejection restores reserved legacy variant counters in the same transaction; acceptance has no additional stock effect.
- [storefront-orders.controller.ts](../../../apps/api/src/modules/orders/storefront-orders.controller.ts): public create and owner list/status routes; owner merchant scope, cursor paging, and positive integer line quantity 1–99. No branch routing, staff actor, cancellation/return, preparation event, or cashier deduction endpoint.
- Result: basic order intake/actions EXIST; target restaurant stock lifecycle is PARTIAL/CONFLICT.

### E06 — M0 schema baseline, history, migrations, and fixtures

- At M0, the [schema](../../../packages/database/prisma/schema.prisma) contained optional integer variant counters and immutable sale/attribute/modifier snapshot models, with no Stock Item, Warehouse, Branch, Recipe, stock balance/movement, UOM, invoice/return, stocktake, or merchant inventory-policy model. M1–M3 later add Stock Items/units, locations/policy/ledger, and supplier purchase invoices. Recipes, returns, and stocktakes remain absent.
- [variant migration](../../../packages/database/prisma/migrations/20261014090000_product_variants/migration.sql) has `stockQuantity IS NULL OR stockQuantity >= 0`; merchant Allow Negative cannot be implemented by treating this field as a ledger.
- [configuration migration](../../../packages/database/prisma/migrations/20261014120000_reusable_product_configuration/migration.sql) preserves old product-local group IDs as **assignment IDs**, generates new shared group IDs, and preserves option IDs. Its [follow-up](../../../packages/database/prisma/migrations/20261014123502_reusable_product_configuration/migration.sql) normalizes constraints/indexes. Do not rewrite these applied migrations.
- [catalog seed data](../../../apps/api/src/scripts/catalog-seed-data.ts) targets current catalog/variant/modifier structures. It supplies no warehouse/opening-stock or ingredient mapping evidence. No seed command was run in this audit.
- Configured local database at M0: 17 migrations, up to date by `prisma migrate status`; this checks applied migration history, not a full database drift or deployment-readiness audit. M1–M3 later apply migrations 18–21, as recorded below.

### E07 — M0 UI baseline versus prototype screens

- At M0, [ProductBuilderPage.tsx](../../../apps/merchant-dashboard/src/features/catalog/product-builder/ProductBuilderPage.tsx) provided a real API-backed simple/variant flow, reusable modifier attachment/creation, optional stock/SKU/barcode, attributes, and review, but no item picker, recipe rows, inventory mode, quantity caps, or warehouse controls. M1 adds a separate stock-item management page; Product/Recipe pickers are still absent.
- [StorefrontOrdersPage.tsx](../../../apps/merchant-dashboard/src/StorefrontOrdersPage.tsx): real owner inbox and accept/reject. [api-client.ts](../../../apps/merchant-dashboard/src/lib/api-client.ts) flattens cursor pages for legacy array consumers; that is not a missing response conversion.
- At M0, [BranchesPage.tsx](../../../apps/merchant-dashboard/src/features/inventory/BranchesPage.tsx) used a hardcoded array/local state; M2 replaces it with persisted branch/warehouse management. Other mock order screens do not supersede the routed storefront inbox.
- Storefront customizer/cart/checkout use quote/selection contracts; options are unique IDs, with no independent option quantities. POS has no product or sale workflow.
- Result: M1–M3 deliver owner inventory and purchase screens; branch-specific POS behavior remains MISSING. Source inspection does not establish visual/accessibility acceptance.

### E08 — Tests and reporting

- [catalog-services.test.ts](../../../apps/api/test/unit/catalog-services.test.ts): exact pricing/defaults/variant validation and existing service invariants.
- [catalog.e2e.test.ts](../../../apps/api/test/http/catalog.e2e.test.ts) and [storefront-orders.e2e.test.ts](../../../apps/api/test/http/storefront-orders.e2e.test.ts): HTTP validation/guard forwarding; mostly stubbed providers, not real transaction-race tests.
- [catalog.database.test.ts](../../../apps/api/test/database/catalog.database.test.ts): PostgreSQL reusable configuration, tenant-safe references, and catalog persistence.
- [storefront-orders.database.test.ts](../../../apps/api/test/database/storefront-orders.database.test.ts): snapshots, tracked reservation, pending-reservation edit protection, reject restoration, acceptance, and history after catalog edits. Audit execution passed; fixtures deliberately roll back.
- [product-configuration-report.service.ts](../../../apps/api/src/modules/reports/product-configuration-report.service.ts) uses four SQL aggregate queries for accepted orders. It is **not** an in-memory aggregation service as older architecture text suggests. Repeated option quantities will require snapshot/report updates.
- The M0 baseline did not test concurrency, recipe arithmetic, invoices, UOM, balances, branch authorization, or inventory integration. M1–M3 add quantity, ledger, invoice, tenant, replay, and concurrency tests; recipe arithmetic and branch authorization remain unimplemented.

### M0 missing-domain search scope

This is the original M0 point-in-time search; current implementation status is in the feature gap matrix and delivery log. Reviewed all models in `packages/database/prisma/schema.prisma`, the migration list/relevant SQL, registered API modules, shared catalog contracts, and applicable frontend sources. Scoped `rg` searches for `recipe`, `warehouse`, `stockitem`, `stockmovement`, `purchaseinvoice`, `stocktake`, `writeoff`, `negativeStock`, and `defaultConsumption` found no implementations in the inspected API/contracts/schema/migrations/UI TypeScript/TSX/Prisma/SQL files. Existing stock behavior was found separately through `stockQuantity` / `stockReserved`. Dependencies, generated clients, build output, and `.env` values were excluded from source inspection.

## Feature gap matrix

Source feature IDs are preserved for traceability, not adopted as global project IDs. Evidence keys refer to the audited sections above.

| Source ID | Capability                                                   | Code status        | Evidence and remaining work                                                                                                              |
| --------- | ------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| F-01      | Separate Product and Stock Item                              | EXISTS             | M4 adds tenant-scoped Product/Variant targets and Stock Item component references; legacy products stay unconfigured. E02/E06; M4 below. |
| F-02      | DIRECT mapping, shared item, quantity/unit multiplier        | EXISTS             | M4 persists one item and exact quantity/unit per simple product or variant; shared items are supported. E02/E06.                         |
| F-03      | Activity default / Product override / inherited variant mode | EXISTS             | Restaurant defaults to RECIPE, other activities to DIRECT; Product config overrides and targets inherit the mode. IC-D04 resolved.       |
| F-04      | Independent variant/simple-product recipes                   | EXISTS             | M4 persists independent recipe lines per sellable and calculates exact, aggregated base requirements. E02/E06/E07.                       |
| F-05      | Modifier multi-item effects, overrides, repeated quantities  | MISSING            | Existing modifier price selection is not a stock effect. E03/E04.                                                                        |
| F-06      | Reusable groups, distinct min/max                            | PARTIAL            | Reuse and unique-option bounds exist; repetition/caps absent. Shared editing already has a safe V1 rule. E03/E04.                        |
| F-07      | Variant modifier availability                                | MISSING            | Assignment currently includes every shared option. E03.                                                                                  |
| F-08      | Modifier default / variant price override                    | PARTIAL            | Product-assignment fixed defaults exist; variant overrides absent; reconcile shared-default meaning. E03/E04; IC-D03.                    |
| F-09      | Stock Item picker and inline create                          | PARTIAL            | M4 adds active Stock Item/unit selection; create stays in Inventory and inline item creation is deferred. E07.                           |
| F-10      | Units and conversions                                        | PARTIAL            | M1/M4 use exact base/pack conversion for purchases and configuration; order consumption remains absent. IC-D01.                          |
| F-11      | Branch warehouses / default consumption warehouse            | EXISTS             | M2 persists branches, warehouses, and branch defaults; management remains owner-only. E01/E06/E07; IC-D02.                               |
| F-12      | Warehouse balances, conditions, movement audit               | EXISTS             | M2 adds Available/Non-Sellable balances and attributable append-only movements. E06.                                                     |
| F-13      | Merchant negative-stock policy                               | EXISTS             | M2 adds merchant-wide Allow/Prevent policy for Available debits; legacy counters remain separate. E05/E06.                               |
| F-14      | Draft/Confirmed purchase invoices                            | EXISTS             | M3 adds owner supplier directory, drafts, and exactly-once receipt; costs/tax/settlement are excluded. IC-D10.                           |
| F-15      | Direct warehouse transfers                                   | MISSING            | No warehouses or transfer transaction. E06.                                                                                              |
| F-16      | Reasoned/audited stock adjustment                            | MISSING            | Direct optional counter edits are not an inventory adjustment document. E02/E06.                                                         |
| F-17      | Full/partial stocktaking                                     | MISSING            | Requires reconciliation/concurrency design. E06; IC-D09.                                                                                 |
| F-18      | Condition transfer and Write-Off                             | MISSING            | No condition buckets/source actions. E06.                                                                                                |
| F-19      | Invoice-linked purchase returns                              | MISSING            | M3 invoices exist, but linked returns and cumulative return limits do not. E06; IC-D10.                                                  |
| F-20      | Cashier acceptance triggers restaurant recipe deduction      | PARTIAL / CONFLICT | Owner acceptance exists; current stock decrements at creation; no cashier/branch/recipe. E01/E05/E07.                                    |
| F-21      | Pre-preparation cancellation / optional restoration          | PARTIAL            | Pending rejection restores old reservations. Accepted cancellation and kitchen start do not exist. E05.                                  |
| F-22      | Retail partial return / separate restock choice              | MISSING            | No line-return/restock/refund workflow. E05/E06.                                                                                         |
| F-23      | Unified server validation/pricing                            | PARTIAL            | Baseline EXISTS and TESTED; new quantity/override/consumption validation absent. E04/E08.                                                |
| F-24      | Recipe Snapshot/versioning                                   | DEFERRED           | Existing product/price/selection snapshots must remain; recipe-change policy still needs IC-D06. E06.                                    |
| F-25      | Batch/Expiry/FEFO                                            | DEFERRED           | No implementation found; do not add in this workstream. E06/search.                                                                      |
| F-26      | Goods Receipt / in-transit transfer                          | NOT TARGETED       | Confirmed invoices/direct transfers are the requested workflow.                                                                          |
| F-27      | Prepared-item production inventory                           | DEFERRED           | Raw ingredients first.                                                                                                                   |

## Risks and decisions before implementation

The full decision queue is in [FEATURE.md](FEATURE.md). Resolve only the decisions needed by the next milestone.

| Risk                                               | Why it matters                                                                                                              | Required treatment                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate stock effect at cutover                  | Existing pending orders already reduced a variant counter. New acceptance deductions could charge the same stock again.     | IC-D05/D08: define old/new order handling, opening balances, activation gate, and source idempotency before enabling ledger deductions.                   |
| Recipe/mapping changes while waiting               | No recipe snapshot approved; future recipe orders will initially have no stock reservation marker.                          | M4 blocks changes for pending orders already holding legacy reservations. Define the future recipe-order edit/revalidation policy under IC-D06 before M6. |
| Legacy inventory cutover                           | Existing pending orders already reduced a variant counter, while recipe configuration is not yet consumed.                  | M4 keeps legacy products available without backfill. IC-D08 still requires source idempotency and old/new order handling before ledger deductions.        |
| Default price location changes existing prices     | Shared options can currently have different prices per product assignment.                                                  | IC-D03: retain assignment values, specify any shared default/variant precedence, migrate deliberately.                                                    |
| Branch/cashier foundation absent                   | Owner acceptance is not branch-scoped POS acceptance.                                                                       | IC-D02/D08/D11: implement persisted Branch, scope, cashier identity, and routing before live integration.                                                 |
| Decimal precision and conditions                   | Integer variant counters cannot represent ingredient fractions or multiple warehouses/conditions.                           | IC-D01: exact arithmetic, quantity limits, conversions, policy applicability, and balance constraints.                                                    |
| Quantity changes cross several contracts           | `optionIds` and current snapshots/reporting assume at most one selection per option.                                        | Extend schemas, defaulting, quantity snapshots, customizer/cart/checkout, and SQL reports together.                                                       |
| Historical documentation drift                     | Old docs describe obsolete Catalog-owned Orders, old local modifiers, in-memory reporting, and unresolved price precedence. | Preserve their historical logs; use audited source ownership. Do not copy stale claims into new work.                                                     |
| Broad feature scope mistaken for launch commitment | Supplied docs discuss retail, purchasing, returns, and advanced operations.                                                 | Prioritize reviewed slices; no automatic approval of all first-release features.                                                                          |

## Ordered implementation milestones

### M0 — Repository audit and planning — COMPLETE

- [x] Read supplied documents, root/API instructions, project/MVP references, Product Builder docs, architecture, manifests, and test scripts.
- [x] Record branch, baseline commit, and pre-existing worktree changes without altering them.
- [x] Inspect tenant/auth, activity/capability, Product/Variant/Modifier, pricing, orders, schema/migrations, seed shape, frontend routes, and test coverage.
- [x] Distinguish source-confirmed targets from existing/partial/missing/conflicting implementation.
- [x] Verify feasible baseline checks and record actual results/limits below.
- [x] Produce this progress report and the companion feature contract using repository conventions.
- [x] Name incremental slices, affected areas, migration risks, dependencies, and outstanding decisions.

Exit: these two documents were ready to use for the next implementation task. No inventory feature was marked delivered by M0; implementation progress is recorded below.

### M1 — Stock Item registry and unit model — COMPLETE

Owner-managed, tenant-safe Stock Items with exact base/pack conversions, API-backed list/create/edit/archive/restore, and a Merchant workspace establish reusable stock identities before balance mutations or checkout changes.

- [x] Resolve M1 quantity precision, exact standard-unit conversion, item-specific packs, and no-rounding behavior under IC-D01. Negative-stock policy remains open.
- [x] Add only Stock Item and item-unit tables in an additive migration; existing Products/orders have no backfill or behavior change.
- [x] Add Inventory module, owner controller/service/schemas, cursor-paged list, revision checks, tenant scoping, and idempotent create.
- [x] Add the localized `/inventory` item-management UI and server-side conversion preview. Creation has no opening-stock effect.
- [x] Cover tenant isolation, invalid/incompatible/inexact conversions, idempotent retries, stale edits, pack additions, archive/restore, and exact fractional conversions.
- [x] Validate and apply the migration to the configured local database; run API HTTP/unit regressions and the inventory DB test with rollback fixtures.

Delivered paths include `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20261015160000_stock_item_registry/`, `packages/contracts/src/inventory.ts`, `apps/api/src/modules/inventory/`, `apps/merchant-dashboard/src/features/inventory/StockItemsPage.tsx`, and focused API tests.

Migration: additive and applied as migration 18 to the configured local development database. No backfill or data reset was performed. Do not infer mappings from product names, SKU, or existing nullable variant counters.

Exit: passed for M1 registry scope. Authenticated owners can list/manage their own identities; another tenant cannot access them; item creation creates no balance. Product/Variant pickers and recipe integration are not part of M1.

### M2 — Branch/warehouse scope, policy, balances, and ledger — COMPLETE

Dependencies: M1; IC-D01/D02/D11. The user confirmed one Branch to many Warehouses, one default consumption Warehouse per Branch, merchant-wide Allow Negative by default, and a reviewed opening-stock operation. This remains owner-managed; it does not establish staff RBAC.

- [x] Confirm Branch/Warehouse cardinality and the per-branch default consumption Warehouse.
- [x] Confirm merchant-wide Allow Negative default; apply the policy to Available debits only. Non-Sellable does not supply consumption.
- [x] Confirm an attributable, reviewed opening-stock operation.
- [x] Define the minimum persisted branch/warehouse fields, actor attribution, and safe archive/deactivation restrictions.
- [x] Implement the merchant policy setting and Available/Non-Sellable balances with source-attributed movement records.
- [x] Centralize stock application on the caller's transaction with source-scoped duplicate protection and deterministic insufficient-stock behavior.
- [x] Add paged balance/history APIs and owner views; post opening quantities only after review and confirmation.
- [x] Test concurrent first balance creation, shared-item aggregation, conditional decrements, duplicate commands/different payloads, tenant/warehouse rejection, and rollback.

Delivered paths include the Inventory schema and migrations 19–20, contracts, owner APIs/services, the persisted Merchant Branches/Warehouses screen, Inventory Operations UI, API HTTP/unit/database tests, and architecture documentation.

Exit: passed for M2. Stock changes have a single transactional authority, exact unit conversion, tenant-safe source attribution and replay behavior, and separate Available/Non-Sellable balances. Default policy allows negative Available balances; Prevent is enforced atomically on debits. No checkout mutation is switched. Browser/keyboard/RTL/LTR acceptance remains open.

### M3 — Purchase Invoice stock entry — COMPLETE

Dependencies: M2; purchasing portion of IC-D10.

- [x] Finalize minimum supplier/invoice/line fields, document identity, owner permissions, and correction policy.
- [x] Implement editable Draft and atomic confirm-once actual-quantity receipt to the chosen warehouse.
- [x] Keep stock unchanged for Draft; no separate Goods Receipt.
- [x] Build purchase entry/review/confirmation UI with retry/conflict handling.
- [x] Test two simultaneous confirms, replay, different-payload key reuse, invalid/foreign references, and transaction rollback.

Delivered: Purchasing module, Inventory public transaction API, additive schema/contracts, Merchant purchase screen, HTTP and PostgreSQL tests.

Exit: passed. Real stock can be entered safely and the same invoice cannot add it twice. Costs, supplier settlement, and tax treatment remain explicitly out of scope.

### M4 — Product mapping and base recipes — COMPLETE

Dependencies: M1 for configuration; M2/M3 before live consumption. IC-D04 and IC-D05 are resolved for product configuration; IC-D06 remains open for future waiting recipe orders.

- [x] Add restaurant RECIPE / other DIRECT defaults, Product override, and inherited variant mode.
- [x] Keep existing products available without inferred mappings; new products can save unavailable and need complete configuration before becoming available.
- [x] Add one Stock Item mapping with exact quantity/unit for simple and variant DIRECT products.
- [x] Add independent complete recipes for simple products or every variant, without inheritance.
- [x] Add a pure exact requirement calculator that consolidates shared Stock Items and has no stock mutation.
- [x] Extend Product Builder with Stock Item/unit selection and independent recipe rows; inline item creation remains in Inventory.
- [x] Save product, variants, and mappings/recipes atomically; block config or variant changes during pending legacy reservations and prevent archiving a referenced Stock Item.
- [x] Test direct and variant recipe persistence, pack conversions, multiplier aggregation, foreign references, inexact conversion, publish readiness, and legacy readability.

Exit: validated configurations produce inspectable ingredient requirements. M4 does not change the order stock event or post inventory movements for sales.

### M5 — Modifier quantities, availability, overrides, and effects — COMPLETE

Dependencies: M4; IC-D03/D07; retain the current assigned-definition edit restriction unless deliberately changed.

#### Accepted decisions and implementation - 2026-10-15

The user accepted IC-D03 and IC-D07 before implementation:

- Product-assignment prices remain defaults; variant option prices take precedence.
  No shared-library default price is introduced. Selected quantity multiplies the
  effective price.
- Variant effect lists replace the entire default list. Missing lists inherit;
  explicit empty lists disable all effects. Effects are allowed only for RECIPE.
  Final negative ingredient requirements are rejected after aggregation.
- Unavailable default options are ignored for their variant. Saved available
  groups must have enough available distinct options to satisfy their minimum.
  An unavailable group is omitted from that variant's selections.

Implementation extends existing Catalog ownership and transaction boundaries:

- Additive migration `20261015210000_modifier_quantities_variants_effects` adds
  normalized variant restrictions, price overrides, recipe effects, option caps,
  and immutable order selection quantities. Compound merchant/product references
  constrain override/effect ownership. Existing caps and snapshot quantities
  default to one. No prices, availability, or legacy reservation flags are backfilled.
- `pricing/modifier-selections.ts` normalizes quantities and rejects duplicate or
  unselected metadata. `products/persistence/modifier-details.persistence.ts`
  persists overrides/effects and checks the complete saved variant/mode state.
  Referenced active Stock Items are locked in order against archival; unit
  conversions reuse Inventory arithmetic. Assigned shared-definition editing stays
  restricted, and retained assignment/variant identities remain stable.
- Quote selections retain `optionIds` and optionally accept `optionQuantities`
  containing `{ optionId, quantity }`. Unspecified selected IDs mean one. Quantities
  and caps are whole numbers from 1 to 99; group bounds count distinct options.
  Quote responses add resolved `options` with quantity and effective unit price.
- Orders snapshot those resolved quantities/prices under the existing product
  revision check. SQL reports multiply option quantity by line quantity exactly
  once. Recipe requirements aggregate signed effects before rejecting negatives,
  scale both quantities, and remain calculations without new stock movements.
- Merchant Builder keeps override controls inside the extracted Options tab,
  mounts ingredient pickers only when their disclosure opens, and reuses bounded
  Stock Item selection. Storefront filters groups/options by variant, resets
  defaults on variant changes, re-quotes quantities, and distinguishes cart lines
  by quantities. Persisted version-one carts migrate their keys while retaining
  favorites and quantity-one selections.

- [x] Extend product assignments for per-option caps and variant group/option availability.
- [x] Decide effective default/variant price precedence while preserving existing per-product prices.
- [x] Add default and variant multi-item recipe effects using the agreed override/negative-total rules.
- [x] Evolve selection contracts compatibly: old selected IDs mean quantity 1; defaults and duplicate handling cannot bypass bounds.
- [x] Extend quotes, order quantity/price snapshots, and SQL report aggregation for repeated selections.
- [x] Update Merchant Builder and Storefront customizer/cart/checkout using shared contracts and re-quote behavior.
- [x] Test two distinct selections at quantities 3 and 2, caps, unavailable defaults, foreign IDs, multi-item effects, and effective override pricing.

Exit: pricing and requirements use the same validated configuration without conflating price changes and stock changes.

### M6 - Restaurant acceptance and cancellation integration - PARTIAL

#### M6a - Owner-managed recipe lifecycle - COMPLETE

The user accepted delivery through the owner dashboard first, followed later by
staff permissions and POS. IC-D06/IC-D08 are settled for this owner slice; IC-D11
cashier/branch permissions remain a separate follow-up.

Accepted behavior and delivered implementation:

- New configured RECIPE order lines record `recipe_acceptance`; pre-existing
  lines default to `legacy`, and new DIRECT/unconfigured lines stay on that
  existing path. Recipe lines do not reserve or consult variant counters; DIRECT
  reservations and pending rejection remain unchanged. No historical order is
  inferred from today's product mode, and no historical stock is deducted again.
- An owner chooses an active same-tenant branch at acceptance. Its active default
  consumption warehouse is required. Catalog calculates frozen recipe requirements
  from saved variant/option identities and quantities. Inventory applies the
  merchant's accepted Allow/Prevent Negative policy to Available balances.
- Acceptance, every consumption batch, source uniqueness, and the actor's action
  record commit in one serializable transaction. Requirements shared across lines
  are aggregated exactly; more than 100 ingredients use bounded ledger chunks
  within that same transaction. Order/action locks and persisted request IDs
  prevent concurrent or repeated commands from double-deducting.
- While new recipe orders are pending, Catalog blocks recipe/mode changes,
  modifier consumption or selection-rule changes, assignment detach/reattach, and
  variant identity-set changes. Price/name/metadata edits with unchanged consumption
  remain allowed. Price and selection snapshots stay immutable. No recipe version
  or recipe snapshot was introduced.
- Owner preparation start records `preparing`; cancellation is prohibited
  afterward. Before preparation, cancellation requires a reason and an explicit
  restore/no-restore choice. Restoration reverses recorded consumption to its
  original warehouse, even after recipes or defaults change. On mixed orders,
  restoring also releases their original tracked DIRECT reservations. If such a
  variant was removed or made untracked after acceptance, restoration fails
  atomically instead of silently losing the reserved quantity.
- Consumed Stock Items and bound locations cannot be archived while accepted
  recipe orders await preparation. Action replays return their stored result,
  even after a later transition, without consulting changed recipes/warehouses.
  The UI then refreshes current order state. Uncertain browser requests survive
  reload and retry the original payload/request ID.
- Orders exposes owner-only `POST /owner/orders/:id/accept`,
  `POST /owner/orders/:id/start-preparation`, and
  `POST /owner/orders/:id/cancel`. The old status route still handles legacy
  acceptance and pending rejection, but cannot bypass branch acceptance for a
  new recipe order. Controllers obtain merchant/actor from OwnerGuard.
- Owner actions render outside the horizontally scrolling table. The table's
  screen-reader heading is positioned within its header cell so RTL mobile layout
  does not gain an off-screen scroll area that breaks pointer hit testing.
  Reports include accepted/preparing orders and exclude cancelled orders; the
  dashboard also excludes cancelled value and labels both new states.

- [x] Record owner scope, routing, stock policy, mixed orders, and retry behavior.
- [x] Add an explicit cutover marker without rewriting old reservations.
- [x] Freeze pending consumption configuration while retaining metadata edits.
- [x] Atomically accept and deduct from the branch default warehouse.
- [x] Persist preparation start and gate cancellation.
- [x] Record reasoned restore/no-restore cancellation and reverse actual movements.
- [x] Verify tenant boundaries, shortages, replay, concurrent acceptance, and legacy coexistence.

#### M6b - Staff permissions and incoming-order POS - IMPLEMENTED; FOCUSED VERIFICATION PASSED

- Owner-managed employee accounts use a tenant-scoped username, scrypt password
  hash, active flag, optimistic revision, and one or more same-merchant branch
  assignments. The login identity is storefront/business slug plus employee
  username and password. Deactivation or password reset revokes existing POS
  sessions; each request reloads the employee's current active branch grants.
- Employees receive two POS permissions: accept recipe orders and start
  preparation. Rejection, cancellation, and stock restoration remain owner-only.
  No general staff role hierarchy or employee inventory access is introduced.
- Pending new recipe orders appear to assigned branches so an employee can route
  one to an assigned branch at acceptance. Accepted/preparing orders appear only
  for the branch to which they were routed. The endpoint is cursor-paged and
  tenant-scoped; only new RECIPE orders enter this queue.
- POS acceptance and preparation reuse the existing serializable Orders lifecycle
  and ledger. The API checks employee branch assignments on both actions. Requests
  retain their idempotency IDs in session storage before sending and can be retried
  after an uncertain reply. POS polls persisted data every 15 seconds and refreshes
  when the tab becomes visible.
- Owner Dashboard has an Employees screen to create accounts, assign active
  branches, edit names, reset passwords, and deactivate accounts. Merchant and POS
  screens support Arabic/English and responsive RTL/LTR layouts.
- [x] Define branch assignments and the employee permission boundary.
- [x] Add staff authentication and owner account management.
- [x] Add branch-scoped POS order listing and shared acceptance/preparation actions.
- [x] Verify tenant-scoped queue access, branch denial, owner-only cancellation,
      idempotent acceptance/preparation behavior, and session revocation after
      password reset/deactivation.
- [x] Verify employee setup/login, uncertain acceptance retry after reload using
      the same request ID, and Arabic RTL POS interactions in Playwright. Browser
      API responses are mocked; live browser-to-API integration remains untested.

This slice completes the cashier workflow for incoming RECIPE storefront orders.
Walk-in/direct POS sales, employee rejection/cancellation, payments/refunds,
delivery dispatch, and order completion remain separate workflows. The additive
employee tables are in migration 25; no seed/reset was run.

### M7 — Remaining stock operations and returns — NOT STARTED

Implement these as separate reviewed slices after the stock foundation; they need not all wait for M6 if their own dependencies are satisfied.

- [ ] Direct same-tenant warehouse transfers, including across branches; atomic balanced OUT/IN.
- [ ] Reasoned authorized stock adjustments.
- [ ] Condition transfers in both directions and separate permanent write-offs.
- [ ] Full/partial stocktaking under IC-D09, with no silent overwrite of intervening movements.
- [ ] Invoice-linked full/partial purchase returns from either condition under IC-D10.
- [ ] Retail line-level return approval separate from restock/refund, after sale timing and rollout decisions.
- [ ] Test each source's replay/race/rollback, scopes, cumulative return quantities, and audited physical totals.

Exit: only the operations actually delivered and verified are marked complete. Batch/expiry, production, in-transit, and finance workflows remain deferred.

### M8 — Acceptance, rollout, and handoff — NOT STARTED

- [ ] Verify the supplied AC-01–AC-24 scenarios for the delivered slices, with no claim for deferred workflows.
- [ ] Run API required checks, affected database suites, contracts checks, and impacted frontend checks on Node 24.11.1.
- [ ] Test migrations on isolated empty and representative legacy fixtures, opening-balance reconciliation, and rollback/activation procedure.
- [ ] Complete browser/keyboard/RTL/LTR acceptance for real UI; baseline source inspection is not visual verification.
- [ ] Document operational failures, retries, permissions, compatibility, and residual decisions.
- [ ] Update architecture/feature/root decision references where behavior actually changes; retain historical progress records.
- [ ] Record exact files, commands, results, migration state, and commit/diff for every slice.

## Verification ledger — M0 audit and M1–M6b implementation

Commands ran from the repository root unless a workspace filter selected a package. The Turbo configuration was not changed. Node 24.11.1 was selected through a process-local PATH for builds, tests, and database checks. Test/build/schema engine subprocesses required execution outside the restricted sandbox after `spawn EPERM` in the sandbox. M1–M4 additive migrations were applied to the configured local development database; no reset or seed was run.

| Date       | Command / check                                                                                                                        | Actual result                                                                           | Limit / environment                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-15 | `git status --short --branch`; `git rev-parse HEAD`                                                                                    | `main`, baseline commit above; one pre-existing `apps/storefront/next-env.d.ts` change. | Retained throughout. New docs are not committed.                                                                                 |
| 2026-10-15 | `node --version`; `pnpm --version`                                                                                                     | Default shell Node `v20.19.0`; pnpm `10.34.5`.                                          | Default Node is below repo engine range.                                                                                         |
| 2026-10-15 | `pnpm --filter @waffarly/api test` under default Node 20                                                                               | Failed before tests: Windows literal `test/http/*.test.ts` not found.                   | Environment/runner failure, not an application assertion failure.                                                                |
| 2026-10-15 | `pnpm --filter @waffarly/api typecheck` under Node 20                                                                                  | Passed, with engine warning.                                                            | Repeated below under required Node 24.                                                                                           |
| 2026-10-15 | `pnpm --filter @waffarly/database db:validate` under Node 20                                                                           | Passed: Prisma schema valid.                                                            | Validation only; no migration/data change.                                                                                       |
| 2026-10-15 | Process-local PATH selects installed Node `v24.11.1`                                                                                   | Confirmed version from installed fnm runtime.                                           | `C:\Users\hazem\AppData\Roaming\fnm\node-versions\v24.11.1\installation`; no machine-wide runtime changes.                       |
| 2026-10-15 | API default tests under Node 24, restricted sandbox                                                                                    | Blocked: child test processes hit `spawn EPERM` before assertions.                      | Retried outside sandbox, below.                                                                                                  |
| 2026-10-15 | `pnpm --filter @waffarly/api test` under Node 24, outside sandbox                                                                      | **PASS: 64 tests, 0 failures, 0 skipped.**                                              | HTTP/unit suite, including M1 inventory tests.                                                                                   |
| 2026-10-15 | `pnpm --filter @waffarly/api lint`, `typecheck`, and `build` under Node 24                                                             | **PASS.**                                                                               | Current API source and tests.                                                                                                    |
| 2026-10-15 | `pnpm --filter @waffarly/contracts build`; `pnpm --filter @waffarly/database build` under Node 24                                      | **PASS.**                                                                               | Shared inventory types and generated Prisma client.                                                                              |
| 2026-10-15 | `pnpm --filter @waffarly/database exec prisma validate --config ./prisma.config.ts`                                                    | **PASS.**                                                                               | Prisma schema validation.                                                                                                        |
| 2026-10-15 | `pnpm --filter @waffarly/database exec prisma migrate deploy --config ./prisma.config.ts` under Node 24                                | **PASS: migration 18 applied**, including `20261015160000_stock_item_registry`.         | Configured local PostgreSQL `waffarly` database; additive migration only.                                                        |
| 2026-10-15 | `pnpm --filter @waffarly/api exec tsx --test test/database/inventory.database.test.ts` under Node 24                                   | **PASS: 1 test, 0 failures, 0 skipped.**                                                | Exercises persistence and tenant/lifecycle invariants; all fixture writes roll back.                                             |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard typecheck` and `build` under Node 24                                                       | **PASS.**                                                                               | Production build emitted a 711 kB JS chunk (>500 kB advisory); no baseline bundle comparison was run.                            |
| 2026-10-15 | `pnpm --filter @waffarly/api test` under Node 24, outside sandbox                                                                      | **PASS: 67 tests, 0 failures, 0 skipped.**                                              | Includes M2 HTTP/unit inventory coverage.                                                                                        |
| 2026-10-15 | `pnpm --filter @waffarly/api exec tsx --test test/database/inventory-ledger.database.test.ts` under Node 24                            | **PASS: 3 tests, 0 failures.**                                                          | PostgreSQL inventory ledger, policy, rollback, idempotency, and concurrent balance creation fixtures.                            |
| 2026-10-15 | `pnpm --filter @waffarly/database db:check` under Node 24                                                                              | **PASS: Prisma valid; 20 migrations up to date.**                                       | Applied migrations 19–20 to the configured local development PostgreSQL database.                                                |
| 2026-10-15 | `pnpm --filter @waffarly/api lint`, `typecheck`, and `build` under Node 24                                                             | **PASS.**                                                                               | Includes M2 Inventory API and tests.                                                                                             |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard lint` and `typecheck` under Node 24                                                        | **PASS.**                                                                               | Full Merchant Dashboard ESLint and TypeScript checks.                                                                            |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard build` under Node 24, outside sandbox                                                      | **PASS.**                                                                               | 728 kB JS chunk and 263 kB CSS; Vite reports the JS chunk above its 500 kB advisory threshold.                                   |
| 2026-10-15 | `pnpm --filter @waffarly/api test` under Node 24, outside sandbox                                                                      | **PASS: 70 tests, 0 failures, 0 skipped.**                                              | Includes purchasing HTTP validation and owner-tenant checks.                                                                     |
| 2026-10-15 | `pnpm --filter @waffarly/api test:purchasing-db` under Node 24, outside sandbox                                                        | **PASS: 2 tests, 0 failures.**                                                          | PostgreSQL draft inertness, exact receipt, tenant references, idempotent replay, immutable confirm, and concurrent confirmation. |
| 2026-10-15 | `pnpm --filter @waffarly/api exec tsx --test test/database/inventory.database.test.ts test/database/inventory-ledger.database.test.ts` | **PASS: 3 tests, 0 failures.**                                                          | Rechecked M1/M2 stock identity and ledger behavior after M3.                                                                     |
| 2026-10-15 | `pnpm --filter @waffarly/database db:check` under Node 24, outside sandbox                                                             | **PASS: Prisma valid; 21 migrations up to date.**                                       | Migration 21 `20261015190000_purchasing_invoices` applied to local PostgreSQL.                                                   |
| 2026-10-15 | `pnpm --filter @waffarly/api lint`, `typecheck`, and `build` under Node 24                                                             | **PASS.**                                                                               | Current M3 source and tests.                                                                                                     |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard lint` and `typecheck` under Node 24                                                        | **PASS.**                                                                               | Includes purchase routes, supplier/invoice UI, and Arabic copy.                                                                  |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard build` under Node 24, outside sandbox                                                      | **PASS.**                                                                               | 753.66 kB JS chunk and 262.73 kB CSS; Vite reports the JS chunk above its 500 kB advisory threshold.                             |
| 2026-10-15 | Prettier check on changed M3 source/docs and `git diff --check`                                                                        | **PASS.**                                                                               | Git reports only configured LF/CRLF normalization warnings.                                                                      |
| 2026-10-15 | `pnpm --filter @waffarly/api lint`, `typecheck`, and `build`                                                                           | **PASS.**                                                                               | M4 API source and tests; lint/typecheck used default Node 20 (engine warning), build used Node 24.                               |
| 2026-10-15 | `pnpm --filter @waffarly/contracts typecheck` and `build` under Node 24                                                                | **PASS.**                                                                               | Product inventory configuration contracts and exports.                                                                           |
| 2026-10-15 | `pnpm --filter @waffarly/database build` under Node 24, outside sandbox                                                                | **PASS.**                                                                               | Generated Prisma Client from the M4 schema and compiled the database package.                                                    |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard lint` and `typecheck`                                                                      | **PASS.**                                                                               | M4 builder and inventory tab; checks used default Node 20 (engine warning).                                                      |
| 2026-10-15 | `pnpm --filter @waffarly/merchant-dashboard build` under Node 24, outside sandbox                                                      | **PASS.**                                                                               | 762.60 kB JS chunk and 264.18 kB CSS; Vite reports the JS chunk above its 500 kB advisory threshold.                             |
| 2026-10-15 | `pnpm --filter @waffarly/api test` under Node 24, outside sandbox                                                                      | **PASS: 76 tests, 0 failures, 0 skipped.**                                              | HTTP/unit suite, including product readiness and exact recipe calculator coverage.                                               |
| 2026-10-15 | `pnpm --filter @waffarly/api test:catalog-db` under Node 24, outside sandbox                                                           | **PASS: 4 tests, 0 failures.**                                                          | Includes product mappings/recipes, legacy readability, tenant references, conversion, and readiness.                             |
| 2026-10-15 | `pnpm --filter @waffarly/api test:inventory-db` and `test:storefront-orders-db` under Node 24, outside sandbox                         | **PASS: 4 tests, 0 failures.**                                                          | Rechecks inventory ledger/reference behavior and existing legacy order reservation/restoration.                                  |
| 2026-10-15 | `pnpm --filter @waffarly/database db:check` under Node 24, outside sandbox                                                             | **PASS: Prisma valid; 22 migrations up to date.**                                       | Migration 22 `20261015200000_product_inventory_recipes` applied to local PostgreSQL.                                             |

Architecture hardening verification (2026-10-15, Node 24.11.1):

| Check                                                                                                                  | Actual result                                        | Scope / limit                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API lint, typecheck, build, and `test`                                                                                 | PASS; 86 HTTP/unit tests, no failures/skips          | Includes owner-scoped detail routes, public query shape, command direction, and branch-name conflicts.                                                                                                                                           |
| `test:catalog-db`, `test:inventory-db`, `test:purchasing-db`, `test:storefront-orders-db`, `test:activities-db`        | PASS; 11 PostgreSQL tests                            | Includes renamed-supplier receipt replay, historical receipt reasons, disjoint simultaneous posting, same-balance increments, archive exclusion, and foreign references. Fixtures use rollback or isolated IDs with cleanup, depending on suite. |
| Contracts and shared UI lint/typecheck/build; dashboard lint/typecheck/build                                           | PASS                                                 | Shared UI lint retains one existing Fast Refresh warning in `badge.tsx`; dashboard build retains its bundle-size advisory (762.07 kB JS).                                                                                                        |
| `pnpm exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-inventory.spec.ts --reporter=line` | PASS; 12 desktop/mobile cases                        | Mocked HTTP responses; English/Arabic RTL inventory editing, bounded search/paging, selected unit preservation, metadata-only edits, purchase drafts, opening retries, and new opening entry across a language switch.                           |
| Scoped changed-file Prettier and `git diff --check`                                                                    | PASS                                                 | Full repository Prettier check still reports existing formatting debt in untouched files. No bulk formatting cleanup was included.                                                                                                               |
| CI configuration                                                                                                       | PostgreSQL and merchant browser regression job added | Job is independent of existing `verify` so unrelated format failures do not suppress feature regressions. GitHub Actions execution itself was not run locally.                                                                                   |

Not run: comprehensive keyboard/accessibility acceptance, unrelated UI suites, GitHub Actions execution, legacy upgrade/drift rehearsals, load benchmarks, and production rollout checks. The focused browser scenarios above passed. All 22 existing migrations and all 11 database tests also passed on a fresh disposable database under Node 24; that database was dropped afterward. No schema change or new migration was needed for hardening. Product/Variant mappings and base recipes are implemented; order consumption, modifier effects, purchase returns, and recipe/order integration remain unimplemented. Legacy catalog overview/category/media consumers still use the compatibility client's full-page draining behavior; inventory/purchasing selectors and Product detail editing no longer do.

Document formatting, relative-link checks, source-ID coverage, and final diff/worktree checks are recorded in the documentation handoff entry below.

## Change log

### 2026-10-15 — M0 repository audit and adapted feature documents

- Scope: review supplied commerce documents, inspect existing Products/Inventory/Recipes-related code, and create two repository-native planning files.
- Files: `docs/features/inventory/FEATURE.md` and `docs/features/inventory/PROGRESS.md`.
- Status before → after: external handoff UNVERIFIED → source-backed gap report, tested existing baseline, and proposed M1–M8 delivery plan. M1 was NOT STARTED at this historical checkpoint.
- Reuse identified: Catalog/Product Builder, assignment-based modifiers, Catalog pricing, Orders, exact money, owner guards, tenant constraints, existing UI/contracts, SQL reports, and test organization.
- Migration/backfill at M0: none applied or created; 17 existing migrations reported current. Staged future cutover/backfill risks documented.
- API/behavior changes: none. Recipe-on-acceptance is a target, not today's behavior.
- Verification: results in the ledger above; document checks below passed after final review.
- Decisions: IC-D01–IC-D11 in the companion contract; existing price precedence/shared-edit restrictions reconciled, new unresolved semantics retained.
- Diff reference at M0: two new uncommitted Markdown files relative to baseline commit above; no commit/PR created.
- Next implementation task at M0: M1 Stock Item registry/unit model after resolving its focused IC-D01 design details. Do not begin by rebuilding Products or moving stock deduction globally.

### 2026-10-15 — M1 Stock Item registry and exact units

- Scope: implement the first owner-facing inventory slice after the user approved proceeding and confirmed exact six-decimal quantities and no-rounding conversions.
- Files: contracts, Prisma schema/migration, Inventory API/module, Merchant `/inventory` UI/localization, API unit/HTTP/database tests, and both inventory feature documents.
- Status before → after: M1 NOT STARTED → COMPLETE for registry and conversion preview only. Product mappings, stock balances, recipes, and order deductions remain NOT STARTED.
- Compatibility: no edits to Product, Variant, checkout, order, or snapshot semantics; no inferred stock, balance, or recipe backfill.
- Migration: additive migration 18 applied to local PostgreSQL; inventory DB test transaction rolled back its fixtures.
- Verification: API lint/typecheck/build and 64 HTTP/unit tests pass; inventory DB test passes; contracts/database builds, Prisma validation, dashboard typecheck/build pass. Browser acceptance remains open.
- Diff reference: work remains uncommitted; the user's pre-existing `apps/storefront/next-env.d.ts` change was preserved.
- Next slice at that checkpoint: M2 branch/warehouse, balances, policy, and ledger. Product/Variant mapping and recipe design/integration require their own scoped decisions and tests.

### 2026-10-15 — M2 branch/warehouse balances and opening ledger

- Scope: implement the confirmed owner-managed warehouse foundation, Available/Non-Sellable balances, merchant-wide negative policy, and reviewed opening stock.
- Files: Prisma schema/migrations, Inventory contracts/API, Branches and Warehouses UI, Inventory Operations UI/localization, tests, and architecture/feature/progress documents.
- Status before → after: M2 NOT STARTED → COMPLETE for locations, policy, balance ledger, and opening stock only. Product mapping, recipes, purchases, and order deduction remain NOT STARTED.
- Compatibility: no checkout/order stock behavior was changed; inventory operations do not grant employee or branch-scoped permissions.
- Migration: additive migrations 19 and 20 applied to configured local PostgreSQL. Migration 20 corrects snapshot-column placement before M2 had ledger data; no reset/seed was run.
- Verification: API lint/typecheck/build and 67 HTTP/unit tests pass; inventory ledger database tests pass (3); all 20 migrations report current. Merchant Dashboard lint/typecheck/build pass. Browser acceptance remains open.
- Next slice: M3 purchase invoices, then M4 Product/Variant mappings and recipe configuration/calculation before any order-consumption integration.

### 2026-10-15 — M3 suppliers and purchase invoice receipt

- Scope: owner-managed supplier directory; draft purchase invoices; exact quantity receipt into a selected warehouse after explicit confirmation.
- Status before → after: M3 NOT STARTED → COMPLETE for supplier records and purchase receipt only. Product/Variant mappings, recipes, returns, valuation, taxes, supplier payments, and order consumption remain NOT STARTED or outside this slice.
- Decisions: user selected a supplier directory and accepted optional supplier invoice numbers unique per supplier, immutable confirmation, and reviewed movement correction later. M3 does not calculate costs/tax or settle supplier balances.
- Changed paths: purchasing contracts/module/schema/migration, Inventory ledger public conversion API, Merchant `/inventory/purchases` UI and navigation/localization, HTTP and PostgreSQL tests, API architecture and this feature contract.
- Transaction and tenant boundary: only the authenticated owner merchant scopes supplier, warehouse, and Stock Item references; confirmation locks the invoice and commits its immutable snapshots together with exactly converted `purchase_receipt` movements.
- Idempotency/concurrency: supplier and invoice create requests are fingerprinted; receipt uses the Inventory request/source idempotency keys; concurrent invoice confirmation is serialized and posts one batch.
- Migration: additive migration 21 applied to the configured local PostgreSQL database. No existing rows were rewritten and no seed/reset ran.
- Verification: API lint/typecheck/build and 70 HTTP/unit tests pass; purchasing DB tests pass (2); schema validation and all 21 migrations current; Merchant Dashboard lint/typecheck/build pass. Browser/keyboard/RTL acceptance remains open.
- Compatibility: no Product Builder, checkout, or order behavior changed. Confirmed invoices are immutable; correction requires a later reviewed stock movement.
- Next slice: M4 Product/Variant inventory mappings and independent recipe configuration/calculation; defer order consumption until those rules and transaction cases are designed.

### 2026-10-15 — M4 Product mappings and base recipes

- Scope: configure direct Stock Item requirements or independent base recipes for each simple Product or sellable Variant, calculate exact ingredient requirements, and gate new Product availability on complete setup.
- Status before → after: M4 NOT STARTED → COMPLETE for mapping, recipe persistence/calculation, and publish readiness. M5 and order consumption were excluded from that slice.
- Decisions: restaurants default to RECIPE and other activities to DIRECT; Product may override its activity default and Variants inherit the Product mode. Existing Products remain available without inferred setup; new Products may be saved unavailable and need full configuration before publication.
- Changed paths: Product inventory contracts, schema and additive migration, Catalog persistence/calculator/service/mapper, inventory archive protection, Product Builder inventory tab, API architecture, feature/progress documents, and API unit/PostgreSQL tests.
- Transaction and tenant boundary: Product, Variants, targets, and components save atomically. Every target and Stock Item is checked under the authenticated merchant; referenced Stock Items cannot be archived.
- Quantity behavior: supports exact six-decimal inputs, standard weight/volume conversions and Stock Item pack conversions; shared recipe ingredients aggregate with integer arithmetic and reject inexact conversions/overflow. Recipe configuration itself does not mutate stock.
- Migration: additive migration 22 applied to configured local PostgreSQL. Existing Product rows were not inferred/backfilled; no reset or seed ran.
- Verification: API lint/typecheck/build and 76 HTTP/unit tests pass; Catalog DB tests pass (4); inventory and storefront-order DB tests pass (4); Prisma validates and all 22 migrations are current; contracts build/typecheck and dashboard lint/typecheck/build pass. Dashboard bundle-size advisory remains; browser/keyboard/RTL acceptance remains open.
- Compatibility: no order deduction or reservation behavior was changed. Existing products keep their prior availability; the new inventory configuration is not yet consumed by order acceptance.
- Next slice: M5 modifier quantities, availability, overrides, and effects; design recipe consumption and pending recipe-order behavior before M6.

### 2026-10-15 — M1-M4 architecture hardening

- Scope: implement the approved review fixes before extending the inventory feature. M5 and M6 were not started.
- Correctness: receipt confirmation uses one supplier snapshot and reuses historical batch reasons on retry; duplicate branch rename returns Conflict; movement kinds and credit/debit directions are validated before persistence.
- Data access: owner-scoped Product, supplier, and warehouse detail routes support selected-identity hydration. Public sellable queries omit recipe/merchant joins. Inventory/purchasing selectors fetch bounded searchable pages and never drain entire directories.
- Concurrency: opening references are fetched in a batch; branch/item/warehouse parent locks use ordered shared batches while balance mutations retain atomic predicates/upserts. PostgreSQL regressions prove independent postings complete while another balance is held, concurrent increments are retained, and item archival remains excluded.
- Structure: Inventory ledger posting, query, persistence, mapping, and rules have separate files; Purchasing reference persistence/rules/mapping are extracted. Merchant Inventory, Purchasing, and Product Builder live in feature folders, with extracted tabs/editors and shared cursor/picker components.
- Reuse: compatible unit choices and selected-item caches are shared; contracts define quantity transport validation, Inventory owns exact conversion/arithmetic and its range limit. Locale helpers retain stable identities so loading effects do not restart on every render.
- Compatibility: Product availability/default decisions, negative-stock policy, and order reservation/deduction behavior are retained. Existing configured products can save metadata without loading their inventory picker. Historical receipts remain retryable. No schema change or new migration was needed; no reset, seed command, or migration was applied to the development database. The existing migration chain was rehearsed in disposable databases and each database was dropped afterward.
- Verification: 86 API HTTP/unit tests, 11 database tests, and 12 browser cases pass; affected lint/typecheck/build checks pass. See the ledger above for warnings and checks not run.
- CI: dedicated PostgreSQL/merchant regression job, independent of existing repository-wide verification; browser tests use a merchant-only Playwright configuration.
- Remaining limits: legacy catalog overview/library pagination, representative query/throughput profiling, comprehensive keyboard acceptance, and repository-wide formatting debt. These are not evidence of production capacity or a completed order-consumption cutover.

### 2026-10-15 - M5 modifier quantities, variant overrides, and recipe effects

- Status: COMPLETE. IC-D03/IC-D07 were accepted before implementation; the M5
  checklist above records the delivered behavior and ownership.
- Compatibility: legacy selected IDs mean quantity one; historical order selection
  quantities and existing option caps default to one. Existing product prices and
  optional variant stock reservation/rejection behavior remain unchanged.
  Version-one persisted carts retain favorites and migrate to quantity-aware keys.
- API verification: lint, typecheck, build, and all **89 HTTP/unit tests pass**.
  Coverage includes HTTP quantity validation, duplicate/unselected metadata,
  quantities 3 and 2 as two distinct options, caps, variant pricing/availability,
  exact signed aggregation, zero consumption, and negative-final rejection.
- PostgreSQL verification: all **12 tests pass** across Catalog (5), Inventory (3),
  Purchasing (2), Orders (1), and Activities (1). M5 checks real override persistence,
  exact kg/g effects, whole-list replacement and empty overrides, foreign Stock
  Items/variant IDs, impossible selection bounds, RECIPE-only effects, effect-only
  item archival protection, immutable order prices/quantities, and report totals.
- Migration: all **23 migrations** applied successfully on a disposable empty
  PostgreSQL database before the suites ran. That database was removed afterward.
  The new additive M5 migration was then applied successfully to the configured
  local development database. No database reset or seed was run. An initial
  disposable rehearsal caught a migration ordering mistake; the new migration
  was renamed to follow M4 before its successful application anywhere persistent.
- Frontend verification: Merchant and Storefront lint/typecheck/build pass;
  Contracts lint/typecheck/build pass. **18 browser cases pass**: 14 Merchant
  inventory cases and 4 Storefront modifier/cart cases across desktop/mobile.
  They cover cap/price/empty-effect editing, quantity-aware cart identities,
  reload, variant restrictions, and legacy-cart migration preserving favorites.
  Browser fixtures mock API responses; PostgreSQL tests independently verify
  authoritative calculations and snapshots. Comprehensive accessibility/RTL
  acceptance and throughput profiling remain outside these checks.
- CI: the existing isolated regression job runs the expanded Catalog database
  suite and both Merchant inventory and Storefront modifier browser configurations.
  The Storefront configuration uses a local read-only catalog fixture for SSR.
- Remaining limits: the existing Merchant bundle-size advisory, older catalog
  directory consumers, and repository-wide formatting debt remain. No new recipe
  snapshot/version policy, restaurant acceptance deduction, POS behavior, or stock
  ledger sale movement was introduced. M6 remains NOT STARTED and requires its
  pending-order/cashier/warehouse/cutover decisions before implementation.

### 2026-10-15 - M6a owner-managed recipe lifecycle

- Scope/status: owner slice COMPLETE under the accepted routing, pending recipe
  freeze, preparation gate, and explicit restoration rules. M6 remains PARTIAL;
  staff permissions and POS are deferred to M6b by the user's decision.
- Ownership: Orders orchestrates serializable actions and stock reversal; Catalog
  owns frozen-selection requirement calculation and pending-configuration guards;
  Inventory owns exact posting and negative-stock policy. Orders now imports the
  public Inventory module. Catalog does not import Orders application code.
- Migration: `20261015220000_recipe_order_lifecycle` adds explicit line handling,
  routing/preparation/cancellation fields, attributable idempotent actions, and
  linked stock batches, and extends the existing order-status check constraint.
  All **24 migrations** and **14 database tests** passed on a disposable PostgreSQL
  database, which was removed afterward. The verified migration was then applied
  successfully to the configured development database. No reset or seed was run.
- Database coverage: Orders (3), Catalog (5), Inventory (3), Purchasing (2),
  Activities (1). New checks cover legacy recipe orders without inferred deduction,
  tracked DIRECT lines alongside recipe lines, recipe counters at zero, missing or
  foreign branches, metadata/price edits while consumption stays frozen, recipe
  and selection edit rejection, actor attribution, immutable action replay after
  later transitions, original-movement restoration after recipe edits, no-restock
  cancellation, preparation gating, Allow/Prevent Negative policies, concurrent
  acceptance, shared-ingredient shortages, and rollback without partial acceptance.
- API verification: lint/typecheck/build pass; **92 HTTP/unit tests pass**. Owner
  authorization/actor forwarding and restoration direction/condition are covered.
- Frontend verification: Merchant lint/typecheck/build, Storefront typecheck/build,
  Contracts lint/typecheck/build, and shared UI build/lint pass. Shared UI retains
  its existing Fast Refresh warning; Merchant retains its bundle-size advisory.
  **26 scoped browser cases pass**: Merchant inventory (14), owner lifecycle and
  status dashboard regression (8), Storefront modifiers/cart (4), on desktop/mobile.
  Lifecycle cases include Arabic interaction, a strict configured-viewport width
  check, explicit restoration choice, and a lost reply followed by reload/replay.
- Broadened browser check: **4 cases in `merchant-dashboard.spec.ts` fail** because
  the legacy suite expects fixed demo totals/five demo orders and does not provide
  the live orders API fixture. These checks are not reported as passing. The new
  targeted dashboard test uses real response shapes and verifies preparing/cancelled
  labels and exclusion of cancelled value. No baseline execution of the legacy
  suite was performed before these changes. Updating its older demo expectations
  remains outside this owner-lifecycle slice.
- Browser debugging also corrected an explicit stock-decision accessible label
  and a screen-reader heading escaping the table's positioned context in RTL.
  Owner commands now sit outside the horizontal table. Intermediate failed runs
  and overlapping test artifacts are excluded from the final scoped pass counts.
- CI: the isolated regression job runs the expanded Orders database script and
  owner lifecycle browser cases alongside existing inventory/modifier cases.
  Remote GitHub Actions execution was not performed.
- Limits: cashier authorization, staff branch grants, and POS incoming-order UI
  were deferred to M6b below. Financial refund, dispatch, and completion remain
  separate. Recipe versions remain deferred. Representative load testing,
  comprehensive accessibility acceptance, legacy dashboard fixture updates, and
  repository formatting debt remain separate work.

### 2026-10-15 - M6b staff branch permissions and incoming-order POS

- Scope/status: M6b implemented for authenticated staff processing new RECIPE
  storefront orders. Focused API/database verification and targeted browser
  acceptance pass.
- Decisions: employees use business/storefront slug + tenant-unique username +
  password; owner assigns active branches. Staff may accept into an assigned branch
  and start preparation for routed orders. Pending rejection, accepted cancellation,
  and stock restoration remain owner-only. Walk-in/direct sales are outside scope.
- Changed paths: additive migration 25 and Prisma models; contracts; Auth employee
  login/session/guard and owner employee-management endpoints; Orders branch-scoped
  POS listing and lifecycle controllers; Merchant Employees screen; POS login,
  branch queue, retry persistence and Arabic/English UI; architecture/feature docs.
- Tenant/access boundary: `PosEmployee` username is unique within merchant;
  employee-branch assignments have compound same-merchant foreign keys. POS sessions
  are revalidated against account status, merchant activation, and current active
  branch assignments on every request. POS mutation routes constrain acceptance
  and preparation to those assigned branches.
- Compatibility: existing orders and DIRECT lines keep legacy handling. Only lines
  already marked `recipe_acceptance` enter the POS queue. POS uses existing Orders
  transactions and Inventory ledger; no price or stock algorithm runs in the client.
- Database: migration `20261015230000_pos_employee_branch_access` applied to the
  configured local `waffarly` PostgreSQL database. All 25 migrations report current.
  No reset, seed, or data backfill ran.
- Verification: API lint/typecheck/build pass; Merchant and POS lint/typecheck/build
  pass; Contracts lint/build and UI build pass; Prisma schema validation passes.
  Focused M6b tests pass: 3 HTTP tests cover owner management, login normalization,
  branch authorization, staff accept/preparation routes, and owner-only cancel; 3
  database tests cover tenant-scoped order listing, branch assignment, idempotent
  acceptance, preparation, concurrent stock changes, and POS session revocation
  after password reset/deactivation. The targeted Playwright scenario
  `tests/ui/pos-employees.spec.ts` passes against local Vite dev servers with mocked
  API routes, covering owner employee creation/branch assignment, employee login,
  queue rendering, uncertain acceptance retry after reload with the same request
  ID, preparation, and Arabic RTL interactions. This verifies browser behavior;
  API/database behavior is covered separately above. Screenshots are captured for
  employee creation, accepted order, preparation, and Arabic RTL under Playwright's
  ignored `test-results/` output. Merchant Vite retains the existing >500 kB JS
  advisory.
- Remaining validation: live browser-to-API integration and production deployment
  acceptance were not performed. Employee POS use beyond local development still
  needs normal release rollout and operational validation.

### M0 documentation handoff checks (historical)

- [x] `pnpm exec prettier --check docs/features/inventory/FEATURE.md docs/features/inventory/PROGRESS.md` passed after formatting only these two files.
- [x] Validated all 62 relative local links; no missing targets. Confirmed all 27 source feature rows and 24 acceptance scenarios are represented. The coverage matcher was adjusted for Prettier's padded table cells before the successful check.
- [x] `git diff --check` and `git diff --no-index --check -- NUL <new-file>` for each untracked document found no whitespace errors; Git emitted LF/CRLF conversion warnings only.
- [x] Final M0 worktree review: only the two new Markdown files were added alongside the preserved `apps/storefront/next-env.d.ts` modification. No application code, contracts, schema, or migrations were edited at that checkpoint.

### 2026-10-19 — Inventory visibility

- Status: Visibility slice delivered; operations and purchasing expansion remain open.
- Decisions: A reorder threshold belongs to one active Stock Item/warehouse pair
  and is entered in the item's base unit. Health compares only Available stock;
  missing balances count as zero. Counts cover configured pairs in the selected
  filter scope, not just the displayed cursor page. Health does not add unlike
  units or post movements.
- Changed paths: Inventory contracts, Prisma schema and additive migration
  `20261019090000_inventory_visibility`, Inventory visibility service/controller,
  HTTP and database tests, Merchant Dashboard detail/health routes and source links,
  Arabic copy, inventory UI documentation, and architecture notes.
- API/UI behavior: Added tenant-scoped movement detail and health reads, cursor
  pagination, full-scope summary aggregation, optimistic reorder-point save/clear,
  stock item detail with balances/history, movement source links, and health access
  from overview/item pages.
- Tenant/concurrency boundary: Owner merchant ID comes only from the authenticated
  session. Threshold references are protected by compound tenant relations; active
  branch/warehouse/item rows are locked before creation. Revision checks reject
  stale updates; duplicate same-value retries are idempotent.
- Migration: Applied the additive migration to the configured local `waffarly`
  database. `prisma migrate status` reports all 37 migrations current. No reset,
  seed, or backfill ran.
- Verification: Node 24.11.1 API lint/typecheck/build passed; API HTTP/unit suite
  passed (140); Inventory database suite passed (4); Merchant Dashboard lint,
  typecheck, and build passed; Contracts build and Prisma validation passed. All
  14 focused visibility/overview browser cases passed on desktop/mobile in
  Arabic/English, including the 8 new details/health cases.
- Broader browser status: A full 46-case inventory run completed with 26 passing
  and 20 failing. Failures were in existing catalog-builder and purchase/editor
  expectations. Two inventory assertions were refreshed for the health summary
  card and current branch/warehouse empty state; all 6 desktop/mobile/locale cases
  for those assertions passed in the focused rerun. Unrelated catalog and
  purchase/editor failures were not rerun after those updates.
  Browser tests use mocked API responses. Contracts lint also reports the existing
  `no-empty-object-type` error in `packages/contracts/src/pos-dining.ts`.
- Remaining work: Atomic transfers, reviewed adjustments, condition changes,
  write-offs, stocktakes, supplier returns, and inventory quantity reports remain
  separate slices.

## Future implementation log template

```md
### YYYY-MM-DD — <delivered slice>

- Milestone / source feature IDs:
- Status before → after:
- Decisions resolved / compatibility behavior:
- Existing code reused:
- Changed paths:
- Schema migration / opening balance or data backfill:
- API and UI behavior:
- Tenant / branch / permission / transaction boundary:
- Idempotency and concurrency evidence:
- Commands run + actual results + not-run checks:
- Remaining limitations / blockers:
- Commit / PR / diff:
- Next action:
```
