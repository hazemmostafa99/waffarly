# API architecture

The API is a NestJS modular monolith. Organize behavior by business feature;
admin, owner, and public controllers belong to the feature they expose. Feature
implementation instructions live in [apps/api/AGENTS.md](../../apps/api/AGENTS.md).

## Ownership

| Module     | Responsibility                                                                                             | Application dependencies |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| auth       | Owner/Admin/POS employee credentials, sessions, guards, employee records, and branch assignments           | Configuration, database  |
| merchants  | Merchant profiles, applications, first-month activation                                                    | Auth                     |
| plans      | Platform monthly plan definitions                                                                          | Auth                     |
| activities | Business activity and capability definitions/metadata                                                      | Auth                     |
| storefront | Owner design settings, templates, public storefront composition                                            | Auth, catalog            |
| catalog    | Products, categories, reusable modifiers, authoritative pricing, and product inventory configurations      | Auth, inventory          |
| inventory  | Merchant-owned Stock Items/units, branches/warehouses, policy, balances, and transactional movement ledger | Auth                     |
| purchasing | Merchant-owned supplier directory and draft/confirmed purchase invoices                                    | Auth, inventory          |
| orders     | Order submission/snapshots, legacy reservations, and owner/cashier recipe acceptance and preparation       | Auth, catalog, inventory |
| media      | Tenant-owned image metadata and upload orchestration                                                       | Auth, storage adapter    |
| reports    | Product configuration reports from order snapshots                                                         | Auth                     |
| health     | Liveness and database readiness                                                                            | Database                 |

Modules import other modules through their `index.ts` entry points. Each Nest
module exports only deliberately shared providers. `AppModule` composes features;
configuration and database modules provide the shared technical dependencies.
Import rules are enforced by the API ESLint configuration.

## Inside a feature

Simple features stay flat. Catalog separates products, categories, modifiers, and
pricing. Product configuration rules, transaction persistence helpers, HTTP
schemas, and response mapping have separate files. Keep transaction helpers on
the caller's transaction client; preserve revision and tenant constraints.

Inventory's `ledger/` contains command rules/fingerprints, posting, persistence,
queries, and mapping; `InventoryLedgerService` coordinates these through its public
API. Purchasing separates invoice reference persistence, rules, and mapping from
its application service. Parent records use ordered shared locks during posting;
balance writes remain atomic and ordered by warehouse/item/condition. Exclusive
archive locks still wait for in-flight postings. Opening references and parent
locks are batched rather than queried once per line.

Catalog's public sellable include/mapper excludes inventory configurations and
merchant activity joins. Owner Product detail reads retain complete recipes and
are available at `GET /owner/catalog/products/:id`.

Catalog also owns modifier quantity normalization, variant group/option
availability, effective option prices, and signed ingredient effects. Assignment
defaults stay product-specific; variant prices override them. Variant effect lists
replace defaults completely, with absence inheriting and an empty list disabling
effects. These configurations use normalized tables with compound tenant/product
references. Public sellable mapping exposes prices, availability, and quantity caps
without exposing Stock Item references or effects. Owner detail includes effects.
The requirement calculator aggregates effects before rejecting negative totals;
it does not post sales movements. Orders snapshot resolved option quantities and
effective unit prices, and SQL reports multiply those by ordered line quantities.
Existing variant reservation/rejection behavior remains in Orders for historical
and DIRECT lines. M6a marks new RECIPE lines for consumption at owner or authorized
employee acceptance; it does not infer historical stock handling from current
catalog configuration.

`ProductConsumptionService` exposes frozen-selection requirement calculation on
the caller's transaction. Quote and acceptance calculations share modifier effect
inheritance and exact aggregation. Catalog blocks consumption and identity changes
while recipe orders are pending using scoped database checks, without importing
the Orders application module. Price/name edits with unchanged consumption remain
possible. Recipe snapshots/versioning remain deferred.

Orders separates lifecycle commands, stock posting/reversal, and response mapping.
Owner acceptance locks the order, validates its selected branch/default warehouse,
and posts all ingredient batches and an attributable action in one serializable
transaction. Batches remain bounded to 100 movements; a larger requirement set
uses multiple chunks inside that same transaction. Merchant-scoped action request
IDs store immutable results for safe replay across later order transitions.
Cancellation before preparation reverses the actual linked batches, rather than
recalculating recipes or consulting a new default warehouse. Accepted orders also
protect their consumed items and locations from archival until preparation or
cancellation resolves their restoration eligibility. Reports include preparation
and exclude cancellation. `AuthModule` owns merchant-scoped POS employee credentials,
current active branch assignments, and the owner employee directory. Employee login
uses the merchant storefront slug with the employee username; sessions use the same
hashed opaque-token store with a POS-specific cookie and subject kind. Disabling an
employee or resetting a password revokes their POS sessions. The employee guard
reloads current branch assignments on every request.

POS order listing is cursor-paged and accepts a selected assigned branch. Pending
new RECIPE orders are available for routing to an assigned branch; accepted and
preparing orders are filtered to their saved branch. POS lifecycle controllers call
the same Orders application service and exact Inventory posting used by owner
acceptance. Employees can accept into assigned branches and start preparation for
their routed orders. Owner-only rejection, cancellation, and stock restoration are
not exposed to POS sessions. Walk-in sales and order completion remain separate.

Merchant UI code lives under `features/inventory`, `features/purchasing`,
`features/catalog/product-builder`, and `features/staff`. Product tabs and purchase editors have their
own components. Inventory shares unit choices, opening retry storage, and scoped
item/warehouse selectors; cursor controls and bounded selectors live in
`components/`. Selected identities are hydrated through tenant-scoped detail
routes, and selectors request one 25-row search page at a time. In-flight lookup
reads are shared per merchant without keeping a full-directory cache.

`common/` owns shared HTTP validation, logging, and exact money arithmetic.
`infrastructure/` owns Prisma and storage adapters. Shared technical code must not
depend on feature modules. The database package owns schema/client/migrations;
contracts own framework-independent HTTP types. Neither contains API use cases.

## Compatibility and verification

Structural changes preserve existing routes (including `/auth/owner/storefront`),
cookie/session behavior, validation error formats, decimal-string money values,
revision conflicts, and order snapshots. Routes do not need to mirror disk paths.
No database migration is needed for module reorganization.

Tests live under `apps/api/test/http`, `test/unit`, and `test/database`.
HTTP tests mostly replace persistence or application providers; they do not prove
PostgreSQL concurrency behavior. Dedicated database suites exercise real queries,
tenant references, and transaction behavior against a migrated database.
CI starts PostgreSQL 17, applies migrations to its disposable database, and runs
the dedicated Catalog, Inventory, Purchasing, Orders, and Activities database
suites. Merchant inventory browser regressions run with
`pnpm exec playwright test --config playwright.merchant.config.ts tests/ui/merchant-inventory.spec.ts`
after building UI/contracts and Merchant Dashboard.

## Growth work separate from structural refactoring

- Public catalog pages contain at most 40 products or 100 categories. Inventory
  and Purchasing tables and selectors use bounded pages. The legacy `apiRequest`
  compatibility adapter still drains pages for older screens, including catalog
  category/media libraries; migrate those consumers deliberately rather than
  changing the adapter's response shape globally.
- Configuration reports already use four SQL aggregation queries. Profile their
  plans with representative accepted-order volumes before introducing caches.
- Local image storage is the initial adapter. Shared/object storage and delivery
  configuration are needed before running API replicas on separate filesystems.
- Profile query plans and indexes with representative data before adding caches,
  queues, or independent services. Modular code alone does not establish capacity.

Track completed structural changes and remaining work in
[API_REFACTOR_PROGRESS.md](API_REFACTOR_PROGRESS.md).
