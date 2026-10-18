# API architecture

The API is a NestJS modular monolith. Organize behavior by business feature;
admin, owner, and public controllers belong to the feature they expose. Feature
implementation instructions live in [apps/api/AGENTS.md](../../apps/api/AGENTS.md).

## Ownership

| Module     | Responsibility                                                                                                                  | Application dependencies                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| auth       | Owner/Admin/POS employee credentials, sessions, guards, employee records, and branch assignments                                | Configuration, database                    |
| merchants  | Merchant profiles, applications, first-month activation                                                                         | Auth                                       |
| plans      | Platform monthly plan definitions                                                                                               | Auth                                       |
| activities | Business activity and capability definitions/metadata                                                                           | Auth                                       |
| storefront | Owner design settings, templates, public storefront composition                                                                 | Auth, catalog                              |
| catalog    | Products, categories, reusable modifiers, authoritative pricing, and product inventory configurations                           | Auth, inventory                            |
| inventory  | Merchant-owned Stock Items/units, branches/warehouses, policy, balances, and transactional movement ledger                      | Auth                                       |
| purchasing | Merchant-owned supplier directory and draft/confirmed purchase invoices                                                         | Auth, inventory                            |
| orders     | Storefront and POS order submission/snapshots, stock compatibility, dining tables/sessions/checks, tenders and recipe lifecycle | Auth, catalog, inventory, shifts, payments |
| shifts     | Merchant-owned POS registers, opening shifts, register/branch attribution and cash journal                                      | Auth                                       |
| payments   | Immutable POS cash/manual-terminal tenders, exact tender/change rules and check balances                                        | Auth, shifts                               |
| media      | Tenant-owned image metadata and upload orchestration                                                                            | Auth, storage adapter                      |
| reports    | Product configuration reports from order snapshots                                                                              | Auth                                       |
| health     | Liveness and database readiness                                                                                                 | Database                                   |

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
it does not post sales movements. Orders snapshot resolved option quantities,
effective unit prices, and frozen ingredient requirements. New pending recipe
orders can therefore tolerate later recipe edits without changing expected
consumption. Unsnapshotted legacy recipe orders retain the configuration safeguards
and acceptance fallback needed for existing data. POS DIRECT requirements are
consumed at sale confirmation; new RECIPE requirements are consumed once at kitchen
acceptance; products without an explicit DIRECT/RECIPE mapping keep the legacy
variant reservation path. These effects share Orders' transaction and the Inventory
ledger rather than inferring historical handling from the current catalog.

`ProductConsumptionService` exposes frozen-selection requirement calculation on
the caller's transaction. Quote and acceptance calculations share modifier effect
inheritance and exact aggregation. Catalog blocks recipe changes only while an
unsnapshotted legacy order depends on the current configuration, using scoped
database checks without importing the Orders application module. New pending orders
persist requirements at creation and do not lock subsequent recipe edits.

Orders separates lifecycle commands, POS sale quotes/confirmation, stock
posting/reversal, and response mapping. POS quotes are merchant-scoped and use
Catalog's authoritative pricing. Sale confirmation rechecks product revisions,
locks the active shift, attributes the operator, persists immutable product/option
facts, and writes an idempotent action result in the same serializable transaction.
DIRECT stock is posted immediately; RECIPE requirements are frozen for later
kitchen acceptance; legacy variant reservations remain compatible. Owner storefront
order queries stay filtered to storefront-origin orders so POS tickets do not leak
into customer screens that require contact details.

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
new RECIPE orders are available for routing to their POS order's assigned branch;
accepted and preparing orders are filtered to their saved branch. POS lifecycle controllers call
the same Orders application service and exact Inventory posting used by owner
acceptance. Employees can accept into assigned branches and start preparation for
their routed orders. Owner-only rejection, cancellation, and stock restoration are
not exposed to POS sessions. Walk-in POS sales are created through the Orders-owned POS sale command; payment settlement and order completion remain separate milestones.

The Shifts module owns branch-scoped POS registers, shift opening and cash journal entries. Owner register routes derive merchant identity from the owner session; POS register/shift routes require an assigned active branch and an explicitly assigned cashier/supervisor role. Opening locks the register inside the transaction, reuses an exact request ID for uncertain retries, and is backed by a partial unique index allowing one `open` or `closing` shift per register. Existing POS employee queue permissions are preserved by the role migration; role grants add sell/register/approval capabilities only after owner assignment. POS orders and payments persist shift and operator attribution. The first M5 cash journal stores net cash retained from each cash tender in the payment transaction; shift close and general cash movements remain M8 work. Close must reject unresolved order checks under POS-D05.

Orders also owns POS dining configuration and execution. Owners create/update branch-scoped tables through `/owner/pos/tables`; occupied tables cannot be edited or deactivated. A dine-in sale locks its table in the sale transaction and creates or resumes one open `PosDiningSession`; later sales attached to that table become separate order rounds in the same session. A partial unique index permits only one open session per table. Moving a session locks both table rows in sorted order, checks the expected session revision and requires a free active table at the same branch. Table merging is deferred. Every POS sale receives an initial order check; the Orders-owned split command replaces unpaid checks under the order revision and records an idempotent action. Item splits allocate whole order-line quantities and exact cents; equal splits distribute remainder cents deterministically; custom amounts must sum to the complete order total. Check payment commands lock the shift, order and check in a stable order, call Payments within Orders' transaction, and persist exact idempotent results. Any payment locks check allocation; paid-check correction remains M7 work.

Payments is an application module without public routes. Orders validates sale ownership and coordinates the command; Payments normalizes cash received/applied/change and manually confirmed external-terminal amounts using integer cents, then writes immutable payment rows. Cash tenders create a Shifts-owned net-cash journal row in the same transaction. The Orders-owned `GET /pos/orders/:id/payment-state` provides branch-scoped balances and tender history to the shared cashier checkout UI. The POS stores the exact payment command in its merchant/employee/device-scoped workspace before sending it and retains branch identity; after navigation/reload, the cashier reviews current server state and explicitly replays that same idempotency key. The client never automatically replays financial writes. Ordinary receipt issuance/output remain incomplete M5 work. ETA fiscal integration is deferred by the user and ordinary receipts must not claim fiscal status.

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
