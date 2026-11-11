# API architecture

Restaurant reference preparation (2026-11-11): Storefront owns the additive
RestaurantProfile settings, timezone-aware opening-state derivation, owner settings
and public restaurant projections. Catalog adds ordered Marketplace menu reads
including unavailable items, preserving existing public/POS listing behavior.
The dependency graph is unchanged. Dedicated reference tenants were seeded locally;
existing order creation does not yet enforce the new operating/delivery settings.
See [delivery notes](../marketplace-restaurant-backend-delivery.md).

Direct storefront addresses (2026-11-11): Merchants owns optional immutable public
handles, admin assignment/creation validation and the public identifier-only
resolver. Technical storefront slugs and POS business codes stay unchanged.
The existing module dependency graph is unchanged; Merchants exports its service
to HTTP bootstrap for a development-only, tenant-scoped public-origin check.
See [storefront addresses](../features/storefront-addresses.md). Marketplace
integration is still deferred and its local UI does not call this resolver.

POS selling recovery (2026-10-29): Orders assigns new POS sales an immutable branch/day sequence during the sale transaction, using Cairo calendar dates and a globally assigned branch code. An additive nullable order reference preserves existing historical references and receipt snapshots. Exact sale replay returns the original reference; serializable conflicts are retried within a bounded attempt count. Orders also provides the sell-authorized, assigned-active-branch `GET /pos/orders/active-sales` with active/history modes, server-side reference/customer/table search and cursor pagination. Active mode covers unpaid checks and undispatched dine-in rounds; kitchen and delivery queues remain responsible for their own operational states. POS maintains local drafts and protected recovery commands, while confirmed-order references are a bounded cache recoverable through this endpoint. No module dependency changed. Apply the migration before deploying this API, and deploy the API before the new POS client.

Merchant account (2026-10-28): Merchants owns `/owner/account` profile reads and
revisioned, attributable contact updates; it composes the owner-safe subscription
projection through the existing Subscriptions public service. Subscriptions owns
paid-period history and effective billing state. The dependency graph is unchanged.
See [Merchant account](../features/merchant-account/FEATURE.md).

Subscriptions (2026-10-28) owns merchant subscription accounts, paid period snapshots,
manual collection administration, quotes, lifecycle, history and current eligibility.
It has no Auth dependency. Auth imports Subscriptions for per-request eligibility;
Plans imports Auth and Subscriptions for guarded administration; Merchants imports
Subscriptions for atomic onboarding assignment; Orders imports Subscriptions for
transactional public checkout checks. Existing first-month timestamps are historical
compatibility facts, not access authority. See [Merchant subscriptions](../features/super-admin/plans-subscriptions/SUBSCRIPTIONS.md).

Employee role presets and the available branch-scoped employee workflows are
documented in [Employee roles](../features/employees/FEATURE.md). Auth owns the
permission foundation; Inventory owns employee stock reads and Orders owns queue
and receipt access. Employee roles do not bypass owner authentication.

The API is a NestJS modular monolith. Organize behavior by business feature;
admin, owner, and public controllers belong to the feature they expose. Feature
implementation instructions live in [apps/api/AGENTS.md](../../apps/api/AGENTS.md).

Orders also exposes authenticated `GET /pos/orders/:id` for the selling workspace's confirmed-order recovery. It returns the existing immutable-line order-summary projection, requiring sell permission and filtering by the actor's merchant, POS source and assigned active branch. The frontend keeps only merchant/employee/device-scoped order references in Zustand (workspace version 5, with selected-draft identity and recent-use timestamps); React Query reads current order/payment facts. This is same-browser recovery, not a global unpaid-order index. Local confirmation atomically replaces its pending sale/draft with a reference, retaining the original retry envelope if that local write fails. No schema migration or dependency boundary changed.

## Ownership

Shifts provides a bounded employee-scoped delivery-handover recipient list of
active same-branch employees eligible to sell/open shifts, excluding the actor.
POS releases only explicit pre-commit close rejections for editing; ambiguous
outcomes keep the exact durable command. Existing transactional recipient and
supervisor checks remain authoritative.

Cash custody (2026-10-27) remains in Shifts: branch safes, pending handoffs,
independent receipt, receipt differences, statements and post-close custody are
separate from immutable close reports. Accepted same-register carryover allocates
counted cash atomically with opening the next shift. Employee live reconciliation
remains blind. No new cross-module dependency was introduced. See
[Drawer custody and safe receipts](../features/pos/CASH_CUSTODY.md).

Tracked POS delivery (2026-10-26) stays in Orders: dispatch, customer delivery/failure,
responsibility, bounded cross-device queue and partial courier remittance.
Payments adds explicit cash custody. Order-origin shift remains immutable; tracked
delivery can post a drawer payment into an explicit open same-branch receiving
shift. A courier-held customer payment retains source-shift attribution but has no
drawer journal effect; `PosDeliveryRemittance` records its actual receiving shift
and employee. Shifts adds remittances to expected drawer cash separately from cash
sales and permits only explicit named/supervisor-approved delivery handover at
close. The frozen handover snapshot is a dedicated safe owner-report field.
Shifts exports `readDeliveryBalances` deliberately for Orders' bounded queue and
its own reconciliation; no reverse module dependency is added. Compound tenant/
branch foreign keys and a payment same-branch trigger preserve scope after
decoupling payment shift from order-origin shift. Reports count customer payments
once; courier cash receipts are separate event-time and employee metrics. See
[Delivery collections](../features/pos/DELIVERY_COLLECTIONS.md).

EGP is the only supported currency across plans, storefront, POS dining,
payments, receipts, refunds, returns, and shifts. Shared currency fields are
EGP literals; persisted currency columns have EGP-only check constraints.
Receipt mapping and payment recording reject non-EGP values. The EGP migrations
preserve stored amounts and never relabel or convert historical money.

The Orders-owned payment-state response includes optional checkout `context` (the existing frozen order summary and current dining table code) plus check `splitMethod` and `allocations` using the existing check-summary allocation shape. Its tenant/POS/sell filters also exclude archived assigned branches. Context and balances are returned together from the scoped order read; no new persistence schema or write behavior is introduced. POS uses allocations for item checks, while equal/custom checks show full-order items only as reference. Optional metadata preserves compatibility with older responses, which receive an explicit unavailable-context message. Roll out contracts/API before the new UI for complete details.

| Module     | Responsibility                                                                                                                                         | Application dependencies                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| auth       | Owner/Admin/POS employee credentials, sessions, guards, employee records, and branch assignments                                                       | Configuration, database, subscriptions |
| merchants  | Merchant profiles, applications, onboarding plan assignment, and revisioned tenant-level POS accent configuration                                          | Auth, subscriptions |
| plans      | Plan definitions, duration prices and subscription administration controllers                                                                           | Auth, subscriptions                        |
| subscriptions | Merchant paid coverage, manual collections, lifecycle, quotes, history and eligibility                                                              | Database                                   |
| activities | Business activity and capability definitions/metadata                                                                                                  | Auth                                       |
| storefront | Owner design settings, templates, public storefront composition                                                                                        | Auth, catalog                              |
| catalog    | Products, categories, reusable modifiers, authoritative pricing, and product inventory configurations                                                  | Auth, inventory                            |
| inventory  | Merchant-owned Stock Items/units, branches/warehouses, policy, balances, and transactional movement ledger                                             | Auth                                       |
| purchasing | Merchant-owned supplier directory and draft/confirmed purchase invoices                                                                                | Auth, inventory                            |
| orders     | Storefront and POS order submission/snapshots, stock compatibility, dining tables/sessions/checks, tenders, ordinary POS receipts and recipe lifecycle | Auth, catalog, inventory, shifts, payments, subscriptions |
| shifts     | Merchant-owned POS registers, opening shifts, register/branch attribution and cash journal                                                             | Auth                                       |
| payments   | Immutable POS cash/manual-terminal tenders, exact tender/change rules and check balances                                                               | Auth, shifts                               |
| media      | Tenant-owned image metadata and upload orchestration                                                                                                   | Auth, storage adapter                      |
| reports    | Product configuration and owner POS operations aggregates from POS order, tender, refund and employee-attribution records                              | Auth                                       |
| health     | Liveness and database readiness                                                                                                                        | Database                                   |

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
cancellation resolves their restoration eligibility. Reports include accepted,
preparing, ready and completed orders, and exclude cancellation. `AuthModule` owns merchant-scoped POS employee credentials,
current active branch assignments, and the owner employee directory. Employee login
uses the merchant storefront slug with the employee username; Super Admin shows this
slug as the Business Code. Sessions use the same hashed opaque-token store with a
POS-specific cookie and subject kind. Disabling an
employee or resetting a password revokes their POS sessions. The employee guard
reloads current branch assignments on every request.

POS order listing is cursor-paged and accepts a selected assigned branch. The
existing storefront recipe queue remains available; POS orders appear only after
their branch-scoped `PosKitchenTicket` exists, including direct/unmapped products
without recipe lines. Takeaway/delivery ticket creation shares the serializable
POS sale transaction. Dine-in rounds use the idempotent
`POST /pos/orders/:id/kitchen-dispatch` action and remain hidden until a cashier
dispatches that round. One `default` station per branch is lazily ensured, and the
additive migration backfills active historical POS orders as `legacy` tickets.
Ticketed POS lifecycle actions are scoped to the employee's assigned branch; RECIPE
requirements are posted at acceptance, while DIRECT stock is not debited a second
time. POS lifecycle controllers call the same Orders application service and exact
Inventory posting used by owner acceptance. Employees can accept routed orders,
start preparation, and mark a preparing ticket ready through an idempotent
`POST /pos/orders/:id/ready` action that records `readyAt`. Ready tickets remain in
the kitchen queue. A POS employee with `sell` can hand over a ready ticket through
the Orders-owned idempotent `POST /pos/orders/:id/handover` command only after every
check on that order is settled; the queue exposes its eligibility and explains an
unpaid-check block. The transaction rechecks settlement, persists `completedAt`,
and for dine-in locks/re-reads the table session. It releases the table only after
all session rounds are completed or cancelled and every check across those rounds
is settled. POS kitchen tickets persist readiness on each immutable order line;
the Orders lifecycle marks a ticket ready only after every line is ready. Item-ready
commands are branch-scoped, order-locked and replayable by request ID. Owner-only
rejection, cancellation, and stock restoration are not exposed to POS sessions.
Pre-acceptance POS kitchen amendments append immutable lines through the Orders-owned
`POST /pos/orders/:id/kitchen-amendments` action described below. Multi-station readiness
and kitchen cancellation acknowledgements are recorded as idempotent Orders lifecycle actions.
Walk-in POS sales are created through the
Orders-owned POS sale command; payment settlement and order completion remain
separate milestones.

The Shifts module owns branch-scoped POS registers, shift opening/closing, cash-in/out/cash-drop, blind-count previews and immutable close reports. Owner register routes derive merchant identity from the owner session; POS register/shift routes require an assigned active branch and an explicitly assigned cashier/supervisor role. Opening locks the register inside the transaction, reuses an exact request ID for uncertain retries, and is backed by a partial unique index allowing one `open` or `closing` shift per register. Existing POS employee queue permissions are preserved by the role migration; role grants add sell/register/approval capabilities only after owner assignment. POS orders and payments persist shift and operator attribution; cash journal rows record net cash tender/refund effects in the financial transaction. Cashier-facing open-shift APIs expose check status and manual-movement history but withhold expected drawer totals; close preview returns only whether a reason/supervisor approval is required, and close recomputes the ledger under the shift lock before committing a report. Auth verifies current supervisor credentials for cash movements and close variances; credentials are never persisted by POS. Close rejects unresolved checks under POS-D05. Cash drops require a safe-bag reference, reduce expected drawer cash, and remain separately reported from petty-cash payouts. The owner-only `GET /owner/pos/shifts/reports` derives merchant scope from the owner session, validates an optional same-tenant branch and timestamp range capped at 93 days, and returns bounded cursor pages of immutable close-report columns without the internal snapshot; omitting branchId includes all merchant branches. Broader commercial reporting and close/payment/refund race stress coverage remain open M8 work.

Orders also owns POS dining configuration and execution. Owners create/update branch-scoped tables through `/owner/pos/tables`; occupied tables cannot be edited or deactivated. A dine-in sale locks its table in the sale transaction and creates or resumes one open `PosDiningSession`; later sales attached to that table become separate order rounds in the same session. A partial unique index permits only one open session per table. Moving a session locks both table rows in sorted order, checks the expected session revision and requires a free active table at the same branch. Table merging is deferred. POS-D06 assigns one default Kitchen station per branch in the first release: dine-in rounds are dispatched explicitly by the cashier, while takeaway/delivery tickets are created with the confirmed POS order; handover requires all order checks to be settled. Station assignment, durable tickets and dispatch state are Orders-owned and tenant/branch scoped. Every POS sale receives an initial order check; the Orders-owned split command replaces unpaid checks under the order revision and records an idempotent action. Item splits allocate whole order-line quantities and exact cents; equal splits distribute remainder cents deterministically; custom amounts must sum to the complete order total. Check payment commands lock the shift, order and check in a stable order, call Payments within Orders' transaction, and persist exact idempotent results. Any payment locks check allocation; paid-check correction remains M7 work.

POS cancellation is exposed as the Orders-owned `POST /pos/orders/:id/cancel` command, with `POST /pos/orders/:id/cancellation-acknowledgement` for the kitchen stop notice. Cancellation requires a reason and either the cashier's current `approve_voids` grant or a distinct, assigned same-branch supervisor whose current credentials are verified by Auth. Orders rechecks both actors, branch, order state and zero payments while locking the order. Exact retries are idempotent and bind the actor/approver; the atomic transaction restores recorded order stock effects, cancels open checks, updates dining-session eligibility and stores the audit action. Credentials are never persisted by POS recovery.

Paid POS checks use the Orders-owned `POST /pos/orders/:id/checks/:checkId/refunds` command. Auth verifies a distinct, active same-branch supervisor with `approve_refunds` when the cashier lacks that grant; Orders rechecks current operator/approver, order/check scope and original tender rows in a serializable transaction. Every allocation references the exact original payment, cumulative amount is capped per tender, and exact actor/approver/payload retries return the immutable stored refund result. External terminal movement is completed by the operator on the terminal and its reference is recorded; POS does not call a payment processor. Shifts locks an open shift at the order branch and records cash refunds as negative cash movements in the same transaction. The refund receipt snapshot is immutable, separate from the sale/check receipt, and is available again through payment-state history. Refund commands do not change inventory or the original sale receipt. POS removes approval credentials before writing the recoverable request to local storage.

Post-handover POS item returns are tracked separately through Orders-owned `GET/POST /pos/orders/:id/returns`. The request names original order lines, positive integer quantities and a reason. Orders requires a completed POS sale, a current sell grant, active branch assignment and either the actor's current `approve_refunds` grant or Auth-verified credentials for a different active same-branch supervisor. Under an order lock it caps aggregate returned quantity at the sold amount and persists immutable return and line snapshots with a fixed waste disposition. The stored reference value is informational only: item returns do not modify order/check/payment totals, sale receipts, cash journals or inventory. Exact same-actor requests replay their stored result, with an additional request-ID check after the order lock to resolve concurrent retries. The POS receipt flow persists only the exact command in its merchant/employee workspace; approval credentials stay transient. Restock/resale and no-receipt returns remain deferred.

The Orders-owned owner report `GET /owner/pos/returns/reports` derives merchant scope from the authenticated owner, validates an optional branch against that merchant, and bounds required timestamp filters to 93 days. It returns stable cursor pages ordered by immutable issue time and ID from stored return and line records, including frozen item/disposition and operator labels but excluding the JSON snapshot and customer data. A merchant/issue-time/ID index supports this access path. The merchant dashboard's **POS Returns & Waste** screen is read-only and labels the frozen return value as informational, not a monetary refund; it does not change receipt, payment or stock state.

The Orders-owned `POST /pos/orders/:id/kitchen-amendments` appends new priced line snapshots to an already-ticketed POS order only while it is still pending, has exactly one open whole check, and has no payment or split allocation. It locks the open shift and order, requires the caller's expected order revision and current product revisions/quote, and stores an actor-bound exact action result in the same serializable transaction as order/check totals and applicable inventory effects. It does not update original lines or create a second sale/check/ticket. The additive action-kind migration is required before this route is enabled. POS clients persist the exact request before sending and replay only that request after an uncertain response.

Payments is an application module without public routes. Orders validates sale ownership and coordinates the command; Payments normalizes cash received/applied/change and manually confirmed external-terminal amounts using integer cents, then writes immutable payment rows. Cash tenders create a Shifts-owned net-cash journal row in the same transaction. When a check becomes fully settled, Orders writes one immutable `PosCheckReceipt` snapshot in that same transaction, including frozen merchant/branch/operator/register, check lines or split-share amount, and committed tender totals. `GET /pos/orders/:id/checks/:checkId/receipt` retrieves the saved snapshot, while branch-assigned employees can use the bounded cursor-paged `GET /pos/receipts` history to reopen it after navigation or reload. The UI prints the 80mm layout through the browser print dialog, where an operator can select a printer or Save as PDF; physical printer/browser acceptance and a direct one-click PDF download remain open. The Orders-owned `GET /pos/orders/:id/payment-state` provides branch-scoped balances and tender history to the shared cashier checkout UI. The POS stores the exact payment command in its merchant/employee/device-scoped workspace before sending it and retains branch identity; after navigation/reload, the cashier reviews current server state and explicitly replays that same idempotency key. The client never automatically replays financial writes. ETA fiscal integration is deferred by the user; ordinary receipts do not claim fiscal status.

Merchant UI code lives under `features/inventory`, `features/purchasing`,
`features/catalog/product-builder`, `features/staff`, and `features/pos`. POS owner
pages cover register/table configuration, immutable shift-close reports and the
read-only item-return/waste audit. Product tabs and purchase editors have their
own components. Inventory shares unit choices, opening retry storage, and scoped
item/warehouse selectors; cursor controls and bounded selectors live in
`components/`. Selected identities are hydrated through tenant-scoped detail
routes, and selectors request one 25-row search page at a time. In-flight lookup
reads are shared per merchant without keeping a full-directory cache.

`common/` owns shared HTTP validation, logging, and exact money arithmetic.
`infrastructure/` owns Prisma and storage adapters. Shared technical code must not
depend on feature modules. The database package owns schema/client/migrations;
contracts own framework-independent HTTP types. Neither contains API use cases.

Inventory visibility remains inside the Inventory module. `InventoryVisibilityService`
provides tenant-scoped movement detail, the bounded `GET /owner/inventory/health`
view, and revisioned per-warehouse reorder-threshold updates/removals. Health rows
and aggregate counts include active configured item/warehouse pairs only, compare
Available balances against thresholds in the Stock Item base unit, and treat a
missing balance as zero. Summary counts apply the selected filters across the full
result scope, independently of the cursor page. The additive
`StockReorderThreshold` table uses compound merchant/location/item references and
does not create stock ledger entries.

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
