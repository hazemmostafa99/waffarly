# Complete POS — Feature and Architecture Contract

## Status and authority

- Last reviewed: 2026-10-17.
- Status: M1 partially implemented; an isolated interactive design prototype is available in development at `/prototype`. Live selling/payments/dining remain planned; the existing incoming recipe-order queue is preserved.
- Companion execution ledger: [PROGRESS.md](PROGRESS.md). Read both before each implementation slice.
- UI/UX companion: [UI_UX.md](UI_UX.md). Follow its workspace, interaction, dual-theme and usability requirements for frontend slices.
- Applications: `apps/pos`, `apps/api`, and owner configuration/reporting in `apps/merchant-dashboard`; preserve storefront compatibility.
- Shared packages: `packages/contracts`, `packages/database`, `packages/ui`.
- Follow [root instructions](../../../AGENTS.md), [API instructions](../../../apps/api/AGENTS.md), [API architecture](../../architecture/API_ARCHITECTURE.md), and [UI/localization conventions](../../architecture/UI_AND_LOCALIZATION.md).
- The user requested these references, the frontend stack and the interactive prototype. Implementation and verification evidence live in Progress; the prototype does not establish live commercial behavior or production readiness. Unconfirmed tax rules and hardware remain open.

Use these labels: **EXISTING** means observed in source; **CONFIRMED** records an explicit user choice; **TARGET** is the proposed implementation contract; **OPEN** needs a decision before its affected slice; **DEFERRED** is outside the first release. Update decisions before changing dependent behavior. Later explicit user instructions take precedence over this document.

## Confirmed launch decisions

| ID      | Decision                                                                                                              | Consequence                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| POS-D01 | CONFIRMED: takeaway, delivery, dine-in, tables, and bill splitting are required in the first release.                 | Dining and split checks are release requirements, not follow-up enhancements.                        |
| POS-D02 | CONFIRMED: cash plus manually recorded payments on an external terminal; support multiple tender methods on one bill. | No payment-provider integration or automatic terminal verification in the first release.             |
| POS-D03 | CONFIRMED: online operation with saved drafts and recovery after reconnection.                                        | No offline sale confirmation, stock posting, or settlement.                                          |
| POS-D04 | CONFIRMED: Tailwind CSS, shadcn/ui, Zustand, and TanStack React Query.                                                | Shared UI primitives; explicit separation of client state and server state.                          |
| POS-D13 | CONFIRMED, 2026-10-17: light and dark themes have equal support across POS and kitchen screens.                       | Complete semantic theme tokens, preserved workspace state on switch and verification in both themes. |

Additional confirmed design decisions, 2026-10-17:

- **POS-D14:** merchant-configurable POS accent, orange by default. Preserve equal light/dark support and keep POS appearance scoped; changing this setting does not rebrand other applications.
- **POS-D15:** the supplied screenshots are the design reference. Define missing tokens/components in this repository; no external design-system source/code is currently supplied.
- **POS-D16:** first receipt target is **80mm thermal plus printable/downloadable PDF**. POS-D10 remains partially open for the printer/OS/browser, physical printable width, scanner/drawer needs, terminal policy and PDF implementation. POS-D09 still needs country/fiscal rules.

Target split modes are by selected items/quantities, equal shares, and custom amounts; details and correction policy are POS-D05 below. Hardware models were not supplied. No tax regime, rate, service-charge percentage, or electronic-invoice integration has been selected.

## Outcome and release boundary

A cashier must be able to open a shift, create or receive an order, manage a table, send work to the kitchen, collect one or more payments, issue/reprint a sale document, hand over the order, handle an authorized cancellation/refund, and reconcile the drawer. The kitchen must see the correct work and amendments. Owners must trace every commercial and inventory effect.

First release includes:

- Fast catalog search, existing optional variants/modifiers, quantities, barcode lookup where configured, customer/fulfillment details, notes, suspended carts, server quotes, and permission-controlled discounts.
- Orders from POS and storefront; DIRECT, RECIPE, and mixed-order compatibility with explicit stock handling.
- Dine-in tables, active table sessions, additional rounds, moving a session between available tables, and split checks.
- Cash, external-terminal records, partial payments, split tender, outstanding balances, and supported refunds.
- Kitchen display (KDS), station routing, ticket amendments, item readiness, order readiness, and fulfillment confirmation.
- Immutable sale receipts, print/PDF output, reprints, linked refund/correction documents, shifts, cash movements, permissions, approvals, audit history, and operating reports.
- Arabic/English, RTL/LTR, keyboard/touch operation, recoverable requests, real database integration tests, and an operational pilot.

Deferred: direct payment-gateway/terminal integration, full offline selling, loyalty, gift cards, customer credit/accounts receivable, advanced promotions, reservations, graphical floor-plan editing, driver dispatch/routing, marketplace connectors, full accounting, and jurisdiction-specific fiscal integration. Required legal/fiscal integration must be resolved before launch in a jurisdiction that requires it; deferral is not permission to launch without it.

## Repository baseline — EXISTING, 2026-10-17

| Area         | Observed implementation                                                                                                    | Limit                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS          | `src/Login.tsx`, `POSLayout.tsx`, `POSScreen.tsx`, `routes.tsx`, cookie-based API client                                   | Incoming recipe-order queue; no selling cart, table, tender, shift, or receipt workspace.                                                                |
| Staff        | Auth-owned POS employees and branch assignments; guards reload current grants                                              | Shared permission values are only `accept_recipe_orders` and `start_preparation`; broader roles are not implemented.                                     |
| Orders       | `StorefrontOrdersService`, `OrderLifecycleService`, immutable price/selection snapshots                                    | Current status union: pending, accepted, rejected, preparing, cancelled; no ready/completed transition.                                                  |
| Stock        | Recipe acceptance consumes through Inventory in one transaction; pre-preparation cancellation can reverse original batches | Legacy variant reservations and new recipe handling coexist. Do not deduct both. Current recipe configuration is protected while pending orders need it. |
| POS actions  | Branch-scoped listing, accept, start preparation, saved request IDs, 15-second polling                                     | POS does not expose owner rejection/cancellation; listing is not a complete all-order history.                                                           |
| Styling      | Tailwind v4 Vite plugin, shared theme import, POS `components.json` targeting `@waffarly/ui`                               | Existing POS layout still uses substantial feature CSS; expand shared shadcn primitives deliberately.                                                    |
| State        | Component-local state and sessionStorage for uncertain commands                                                            | POS manifest does not yet declare Zustand or React Query, although the workspace lockfile contains them for other consumers.                             |
| Verification | Existing API/database tests and mocked Playwright POS scenario; historical evidence in inventory progress                  | No fresh runtime tests in this documentation task; mocked browser responses do not establish live integration or production readiness.                   |

Evidence: [POS screen](../../../apps/pos/src/POSScreen.tsx), [POS manifest](../../../apps/pos/package.json), [POS contracts](../../../packages/contracts/src/pos.ts), [order contracts](../../../packages/contracts/src/catalog.ts), [schema](../../../packages/database/prisma/schema.prisma), and [inventory delivery history](../inventory/PROGRESS.md).

## Architecture and dependency boundaries

### Backend ownership

Keep the NestJS modular monolith. POS is an access channel; do not introduce a catch-all backend `pos` module or separate sale rules for owner/storefront/cashier controllers. Extend existing owners first. Introduce only two new business modules for the initial target: `shifts` and `payments`.

| Owner              | Owns                                                                                                                          | Allowed business-module dependencies — TARGET                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `auth`             | Sessions, staff branch grants, operational permissions, supervisor identity/approval authorization                            | Existing dependencies only; no commerce-module import.                                         |
| `catalog`          | Sellable configuration, authoritative pricing, product inventory requirements                                                 | `auth`, `inventory`; never Orders.                                                             |
| `inventory`        | Locations, balances, exact quantities, movement ledger                                                                        | `auth`; never Orders, Payments, or Catalog services.                                           |
| `shifts` — new     | Registers, shift lifecycle, cash journal, closing reconciliation                                                              | `auth`.                                                                                        |
| `payments` — new   | Payment/refund attempts, tenders, allocations, immutable financial records                                                    | `auth`, `shifts`.                                                                              |
| `orders` — extend  | Order/sale orchestration, bills/checks, dining sessions/tables, kitchen work, sale documents, cancellation/return eligibility | `auth`, `catalog`, `inventory`, `shifts`, `payments`.                                          |
| `reports` — extend | Bounded/aggregated operational read models                                                                                    | Existing `auth`; scoped SQL projections over commercial tables, no command-service dependency. |

Additional TARGET ownership from POS-D14: existing `merchants` owns tenant-level POS appearance configuration through authenticated owner settings and a read-only POS appearance query. Owner writes require current authorization, revision checks and validated theme/accent pairs; device light/dark preference remains local UI state. Orders retains issuance/immutable document snapshots. Finalize transport and update current architecture/dependency rules in the implementation slice; do not add a generic Settings module or reverse dependencies into Orders.

Orders is the transaction coordinator. It passes an active transaction and validated immutable facts into exported Payments/Shifts commands. Payments owns amount/allocation invariants and records attributable cash-journal effects through Shifts. Neither module imports Orders services. Compound same-merchant foreign keys may reference order/bill rows without reversing application dependencies. Orders owns order/bill HTTP payment/refund workflows; avoid a second public path that bypasses its locks and eligibility checks.

Kitchen transitions initially remain an Orders subdomain; KDS is a filtered projection of persisted work, not a second order state machine. Sale-document creation also remains within Orders initially. Extract a new module only when independent behavior justifies it and document the resulting dependency graph.

Imports cross module boundaries through `index.ts` only. New exports must be intentional. Register new modules/providers and update `AppModule`, `apps/api/eslint.config.mjs`, and the current architecture document in the implementation slice that introduces them. This plan does not silently change today's allowed imports.

### Frontend state ownership

| State                                                                                                           | Owner                                                 | Rules                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Session, branch/register permissions, catalog, quotes, orders, tables, KDS, shifts, payments, receipts, reports | TanStack React Query                                  | Server is authoritative; do not mirror entity collections into Zustand.                   |
| Active cart ID, suspended cart drafts, proposed item selections/notes, local workspace preferences              | Feature-scoped Zustand stores                         | Draft data only; no authoritative price, stock, paid flag, permission, or order status.   |
| Order filters, search, selected history item, shareable route context                                           | React Router URL/search params                        | One source of truth; no duplicate store copy.                                             |
| Temporary input, dialog visibility, focus, field validation                                                     | Local React state                                     | Do not globalize transient component state.                                               |
| Uncertain mutation envelope                                                                                     | Dedicated recovery persistence + query reconciliation | Separate from carts and query cache; survives reload, never becomes a client-side ledger. |

Use one QueryClient per authenticated app runtime; query-key factories include merchant, branch, relevant register/station, resource IDs, filters, and pagination. Identity comes from the authenticated session, not editable request tenant fields. Example shape: `['pos', merchantId, branchId, 'orders', filters]`. Session queries use an identity-safe key before tenant context is available.

- Queries flow from feature API functions through query-option/hook files into components. The HTTP client owns transport, credentials, typed errors, abort signals, and response handling; it contains no commercial rules.
- Mutations use explicit hooks and typed contracts. Successful commands reconcile their returned authoritative resource and invalidate affected orders, bills, tables, KDS, shift, receipt, and stock-availability queries as appropriate.
- Do not optimistically finalize payments, refunds, stock, kitchen acceptance, or permission changes. Local cart editing may be immediate.
- Configure refetch/retry by resource. Poll operational queues initially, pause hidden views, refetch on focus/reconnect, and show last-sync/stale/error state. Do not let polling discard loaded pages or late branch responses overwrite the current branch.
- Mutation retries are explicit and reuse the original command key. A Query mutation cache alone is not durable recovery. Never automatically replay financial writes on reconnect.
- Persist only versioned draft fields with a migration/expiry policy. Partition by merchant, employee, branch and device; avoid customer PII in durable drafts by default. No tokens, payment card details, authoritative totals, or permissions in local persistence.
- Branch switching preserves drafts in their original scope and requires reconciliation of pending work. Logout/account switch cancels queries and clears visible caches/stores; unresolved command envelopes remain inaccessible to another identity and recoverable by the same authorized actor. Never replay a revoked actor's command as a new employee.
- Add exact dependencies to `apps/pos/package.json` and update the lockfile in the foundation slice after checking the installed versions/documentation. Other applications need not migrate state management in this workstream.

### Tailwind and shadcn/ui

Use Tailwind v4 utilities, existing theme tokens and `cn`, and the shared adapted shadcn/ui sources under `packages/ui/src`. Extend missing Dialog/AlertDialog, Sheet, Select, Tabs, DropdownMenu, Popover, Tooltip, Toast, and form/table primitives as needed; do not generate duplicate app-local primitives or a second theme. Follow existing package exports and `components.json` aliases. Verify runtime alias resolution when adding `@/` imports; TypeScript paths alone do not configure Vite.

Keep POS business components in the app. Prefer token classes and logical spacing (`ps`, `pe`, `start`, `end`, `text-start`); reserve local CSS for print/page rules or layouts that need it. Shared primitive changes must preserve other apps. Use the existing LocaleProvider and translation catalog, accessible labels, visible focus, semantic statuses beyond color, and at least 44px primary touch targets. Cashier workflows must work without a mouse.

Implement light/dark/system preferences through shared semantic tokens; both themes support the same screens, controls and operational states. Theme/language switching preserves drafts, focus and pending recovery. Follow the UI/UX companion for compact categories, persistent order context, separate kitchen/payment actions and design review gates; styling must not implicitly resolve open commercial policies.

## Target folder structure

These are destinations, not a request to scaffold empty files. Create each file only with the slice that uses it; keep small features flat. Migrate the current entry components incrementally while retaining the existing queue and login behavior.

```text
apps/pos/src/
  main.tsx
  app/
    providers.tsx                  # locale, QueryClient, existing workspace chrome
    router.tsx
    pos-layout.tsx                 # session, branch/register, shift/connectivity shell
  components/                      # cross-feature POS presentation only
    money-text.tsx
    command-status.tsx
  lib/
    api-client.ts
    query-client.ts
    query-keys.ts
    recovery/                      # scoped/versioned uncertain command envelopes
      command-storage.ts
      command-reconciliation.ts
  features/
    prototype/                     # delivered development-only design preview; no live API client
    auth/                          # login and session query
    workspace/                     # branch/register selection and preferences store
    catalog/                       # sellable search/configurator, server quote queries
    sales/
      sales-page.tsx
      sales.api.ts
      sales.queries.ts
      sales.mutations.ts
      cart.store.ts
      cart.persistence.ts
      cart.types.ts
      components/
        product-grid.tsx
        cart-panel.tsx
        product-configurator.tsx
        suspended-carts.tsx
    orders/                        # list/detail, lifecycle commands, event history
    dining/                        # tables, session detail, split-check workspace
    checkout/                      # tender dialog, balances, payments/refunds
    kitchen/                       # station queue, ticket/detail, ready actions
    shifts/                        # opening, cash movements, count/close
    receipts/                      # immutable document view, print/PDF, reprints
    reports/                       # permission-filtered shift/sales views
  styles/
    pos.css                        # minimal app rules
    print.css

apps/api/src/modules/
  auth/                            # extend existing permissions/approval authorization
  catalog/                         # extend existing POS sellable/quote reads
  inventory/                       # reuse ledger; add only required movement behavior
  shifts/
    shifts.module.ts
    shifts.controller.ts
    shifts.schemas.ts
    shifts.service.ts
    shifts.rules.ts
    shifts.persistence.ts
    index.ts
  payments/
    payments.module.ts
    payments.schemas.ts
    payments.service.ts
    payment.rules.ts
    payment.persistence.ts
    index.ts                       # commands called by Orders; no bypass controller
  orders/
    orders.module.ts
    index.ts
    storefront-orders.*            # retain current compatibility surfaces
    order-lifecycle.*
    order-stock.persistence.ts
    sales/                         # cashier creation/confirmation and amendments
      pos-sales.controller.ts
      sale.schemas.ts
      sale.service.ts
      sale.persistence.ts
    billing/                       # bill allocation, split rules, tender orchestration
    dining/                        # table config, occupancy, session movement
    kitchen/                       # tickets, station routing, item progress
    receipts/                      # immutable sale/correction snapshots, numbering
  reports/                         # scoped SQL aggregates/projections

packages/contracts/src/
  index.ts                         # preserve existing root exports
  pos.ts                           # preserve employee exports
  pos-sales.ts
  pos-dining.ts
  pos-kitchen.ts
  payments.ts
  shifts.ts
  sales-documents.ts
packages/database/prisma/
  schema.prisma
  migrations/<timestamp>_<slice>/migration.sql
packages/ui/src/                   # shared shadcn primitives/theme/localization
apps/merchant-dashboard/src/features/
  staff/                           # extend permission controls
  pos-settings/                    # registers, tables/stations, approved policies
apps/api/test/{http,unit,database,support}/
apps/pos/src/features/<feature>/*.test.ts
tests/ui/pos-*.spec.ts
docs/features/pos/{FEATURE,PROGRESS}.md
```

Within frontend features, use `<feature>.api.ts`, `.queries.ts`, `.mutations.ts`, `.types.ts`, optional `.store.ts`, and `components/` only where needed. Cross-feature imports use a deliberate public entry point; avoid circular imports between Dining, Checkout, and Orders by composing them at route/page level. Reuse transport contracts instead of duplicating server types. Pure draft types stay local. Never import Prisma or API implementations in frontend/contracts.

## Domain model and invariants — TARGET

These are conceptual entities, not final Prisma names. Finalize exact fields, indices and migrations per milestone.

| Owner                          | Entities and facts                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders                         | Existing order aggregate extended with source, branch, operational number, revision, fulfillment details and attributable events; immutable line revisions and preparation notes. |
| Orders / Dining                | DiningTable, DiningSession, table assignment; one active session per occupied table; a session owns one running order/check group for the initial release.                        |
| Orders / Billing               | Bill/Check and item or monetary allocations; multiple checks belong to one order, not duplicate sales.                                                                            |
| Orders / Kitchen               | KitchenStation, Ticket, TicketLine, immutable amendment/cancellation events, actor/time and order revision.                                                                       |
| Payments                       | PaymentAttempt, successful Payment, bill/line allocation, Refund and refund allocation linked to original successful payment.                                                     |
| Shifts                         | Register, Shift, append-only CashMovement/journal and close snapshot. Register is a server identity, not an arbitrary browser device ID.                                          |
| Orders / Documents             | SaleDocument/lines, immutable totals and tax/discount breakdown when enabled, document number, original-document links, reprint audit.                                            |
| Orders / Inventory integration | Frozen consumption requirements/version for new accepted lines, linked original stock batches, return/waste/restoration decisions.                                                |

Core invariants:

1. Merchant comes from the actor. Every order, bill, payment, table, station, shift, warehouse and nested reference is merchant-scoped; branch and register grants are additional constraints. Use compound database relationships and test foreign-tenant references.
2. Order execution, payment summary, kitchen progress and dining occupancy are separate facts. Derive payment balances from successful immutable allocations and refunds; a cached summary is updated transactionally, never trusted from the client.
3. Prices and totals are decimal strings at HTTP boundaries, integer arithmetic internally using existing money helpers. Use the current currency precision, reject mixed currencies, and define deterministic cent allocation for equal splits/discounts. No float-based settlement.
4. Requote cart changes on the server. Quotes carry expiry/revision/fingerprint context; confirmation revalidates it. Changed prices or unavailable choices require cashier review, never silent repricing of a confirmed sale.
5. Every command has a merchant-scoped request key and payload fingerprint. Replay returns its recorded result; reuse with another payload conflicts. Resource revisions protect edits. A timeout is unknown, not a failed sale.
6. Historical product names, modifiers, prices, approved discounts, charge/tax breakdowns and stock-consumption facts remain stable after catalog edits. New snapshot policy must be introduced explicitly; do not infer missing facts on old orders.
7. Financial and inventory records are append-only. Corrections are attributable linked compensating actions, not deletion or overwriting of history.
8. Operational/document numbering is uniquely allocated under concurrency in a defined merchant/branch series; never use `MAX + 1`. Confirm numbering/legal requirements before fiscal issuance.

### Orders, tables and split bills

Execution target: `pending -> accepted -> preparing -> ready -> completed`, plus explicit reject/cancel paths. Instant-fulfillment products may use a documented no-preparation path; do not fake kitchen events. Existing statuses and legacy routes remain compatible during additive migration.

| Command                        | Required execution state                          | Result / separate obligations                                                                                            |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Accept                         | Pending                                           | Accepted; selected branch and stock effects recorded atomically.                                                         |
| Reject                         | Pending                                           | Rejected; release only the original eligible reservations.                                                               |
| Start preparation              | Accepted                                          | Preparing; preserve previously frozen requirements.                                                                      |
| Mark ready                     | Preparing, or the documented no-preparation path  | Ready only when all required uncancelled station work is ready.                                                          |
| Complete / hand over           | Ready, or the documented instant-fulfillment path | Completed; enforce the fulfillment type's payment policy.                                                                |
| Cancel remaining work          | Accepted, preparing or ready                      | Cancelled or a recorded partial-line amendment; stage-specific waste/restoration and refund obligations remain explicit. |
| Return / refund completed sale | Completed                                         | Linked return/refund records; preserve the original completed-sale history.                                              |

Whole-order cancellation cannot hide completed/served portions. For partial fulfillment, cancel eligible remaining quantities through line amendments and calculate payment/refund obligations from the retained and cancelled quantities. No normal command reopens a rejected/cancelled/completed order; corrections need their own audited operation.

- Takeaway customer identity is optional unless operational policy requires it; delivery needs contact/address and a defined fee policy. Dine-in links a table session. Do not invent placeholder phone numbers to satisfy the current storefront schema: add a channel-specific contract.
- Suspended local carts are not accepted kitchen orders. Active dining sessions and rounds are server-persisted and visible to authorized staff on another device.
- Add rounds as immutable new line revisions under the same session/order; send only the new work and post only the new stock delta. Prior paid/prepared lines cannot be silently edited.
- Table occupancy is database-enforced under simultaneous assignment. Moving a session locks origin/destination in a stable order, requires an available same-branch destination, and preserves its bills and kitchen history. Multi-table joining and merging independent paid orders are deferred unless explicitly required.
- Split by items/quantities: allocate original sale-line quantities, modifiers included, without creating new stock-bearing orders. Proposed first-release quantity unit is the existing whole-item quantity; monetary shares handle splitting the cost of one item.
- Split by equal/custom amounts: allocate exact cents; deterministic remainder distribution; no duplicated tax/discount/fee amounts. Validate conservation: allocated checks plus any explicitly unallocated balance equal the order amount. Settlement requires zero unallocated balance.
- First release proposes one split basis per order at a time; mixed item/amount allocation and changing a paid split require an explicit later policy. Unpaid checks may be reorganized at the current revision; settled allocations are immutable and corrected through approved adjustments/refunds.
- Split bill and split tender are different: one check may be paid with cash plus external terminal; multiple checks still reference the same order. Payment/refund caps include all checks and previous actions.
- Session closure requires fulfilled or explicitly cancelled work and all balances/refunds resolved; a busy table does not become free merely because one check was paid. Authorized early table release, if desired, needs a separate recorded policy.

### Payments, cancellation and returns

Payment attempt target: pending, succeeded, failed, or reconciliation-required. Bill summary derives unpaid, partially-paid, paid, partially-refunded or refunded; unresolved attempts are shown separately. A refund does not reopen a cancelled order's debt automatically.

- Record cash received, applied amount, and change separately; only applied amount settles debt. Reject over-allocation; require an open authorized register shift for financial actions. Successful cash refund/movements affect the current shift while retaining the original sale/payment link.
- External-terminal tender is a cashier-confirmed external payment record with method, amount, actor, terminal/reference when available, and confirmation time. Do not imply provider verification. Recover an uncertain recording by checking its command result, not by asking the customer to pay again.
- Partial payment keeps the balance visible; multiple simultaneous tenders cannot exceed it. New funds need a new command; retrying an old tender reuses its key.
- Before preparation: authorized rejection/cancellation can release reservations or restore original consumed batches according to explicit handling. After preparation: cancellation stops remaining work but consumed ingredients normally remain consumed and are linked to waste; never restore ingredients solely because money was refunded.
- Refund amount/quantity cannot exceed original settled amounts/returnable quantities net of prior successful or reserved in-progress refunds. Partial line returns include proportional original discounts/tax under the approved policy.
- Cancellation, physical return/restocking, waste, and financial refund are separate recorded decisions. Restock to sellable/non-sellable requires supported item handling and permission; prepared food cannot be reverse-manufactured automatically.
- Every sensitive action needs a reason and current permission; supervisor approval is bound to actor, exact action payload/revision, threshold and expiry. Revalidate at execution and log both identities; never share a supervisor session or accept an arbitrary PIN as authorization.

### Kitchen and inventory

- Route confirmed lines to configured same-branch stations, displaying table/order number, age, fulfillment type, variants/modifiers and notes. Kitchen data excludes unnecessary customer/payment details.
- Kitchen line progress supports queued/preparing/ready/cancelled, station completion and whole-order readiness. Avoid duplicate tickets on retry. Record acknowledgement of amendments/cancellations; never silently remove already displayed work.
- Dispatch timing is branch policy pending POS-D06: confirmed versus paid orders. Acceptance/stock posting and kitchen dispatch must have one unambiguous event per line; prepayment policy must not prevent configured dine-in rounds.
- New DIRECT stock integration uses Catalog's mapping and Inventory's ledger. Preserve legacy tracked-variant reservations until an explicit cutover marks a line's handler. Never consult current product mode to guess historical posting.
- Recipe handling initially preserves the current acceptance deduction point. Any later timing change needs its own decision, migration and regression coverage. Freeze the accepted line's requirements so later preparation, cancellation, amendments or refunds do not recalculate old recipes.
- Snapshotting pending recipe requirements versus retaining today's pending-edit protection is an explicit M3 migration decision. Do not remove those protections until replacement behavior is verified.
- Stock shortage follows the merchant's configured policy. Failure leaves no partial order acceptance, tender allocation or stock movement. Void/return of DIRECT goods and recipe waste use distinct handling.

### Sale documents, shifts and reporting

- A pre-payment bill is labeled as a bill; a payment acknowledgement is distinguishable from a final sale receipt. Final documents freeze commercial facts and settled allocations. For split checks, issue a document per settled check and a clearly labeled order summary; reports must not count both as revenue.
- Support thermal print layout and downloadable PDF, plus searchable/reprintable history after reload. Browser printing is the initial adapter candidate, subject to hardware confirmation; silent printing, drawer pulses and physical success acknowledgement are not promised by browser print completion.
- Keep number issuance/snapshot creation in the sale transaction; rendering and printer I/O happen after commit. A printer failure never creates another sale. Reprints retain the original number and are audited as copies.
- Shift target: open -> closing -> closed. Enforce one open shift per register; confirm shared-drawer versus employee ownership before implementation. Opening float, cash sale, refund, paid-in, paid-out and cash drops have distinct signed journal entries/reasons.
- Closing records a blind declared count, expected cash, variance, actor and approval where needed. Cash received minus change is net cash tender. Exclude external-terminal payments from drawer cash, report them separately, and show refunds occurring in later shifts correctly.
- A close locks the shift against new tenders, resolves pending attempts, computes a consistent journal snapshot and persists it. No ordinary posting into a closed shift; late corrections are linked entries in an open shift under approval.
- Proposed unpaid-table policy, to confirm in POS-D07: open dining orders survive shift close and can be settled in a subsequent authorized shift. Outstanding balances remain visible separately from drawer cash; prior payments keep their original shift attribution.
- Reports use successful payments/documents and explicit adjustments, not the existing accepted/preparing-order totals alone. Distinguish sales, collected money, refunds, outstanding balances, waste and cash variance. Aggregate in scoped SQL with bounded detail queries.

## Transactions, transport and recovery

### Atomic command boundary

For a combined online sale/round confirmation, Orders validates actor and grant, locks affected register/shift and order resources, requotes, persists immutable lines/bill allocations, invokes Inventory and Payments/Shifts exports as needed, creates sale documents and kitchen work, and records the command result in one database transaction. Only effects applicable to that command occur; accepting an unpaid dine-in round does not invent a payment.

Use caller-owned transaction clients; no nested independent commits. Define and test one global lock order: affected shifts/registers in stable ID order, then orders/dining tables in a documented stable sequence, then bills/payment records, then Inventory's existing ordered resource locks. Commands using a subset must preserve that order. Shift close and tender must serialize on the same shift lock. Bound transaction size and retry serialization conflicts with the same command identity.

No printer, PDF renderer, network provider, or notification I/O inside a database transaction. Persist required durable kitchen/print/notification intent with the transaction when asynchronous delivery is needed; handlers must deduplicate and re-read committed state. Initial KDS polling reads committed database tickets without introducing a broker. Add a transactional outbox worker when external delivery is introduced, not an in-memory event bus as the only delivery guarantee. External payment integration later requires a separate reconciliation design and cannot be made atomic by holding a DB transaction open.

### Planned HTTP families

Route names are targets to finalize with contracts; retain existing routes during migration.

| Family                            | Owner / behavior                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/auth/pos/*`                     | Existing Auth login/session; extend effective permissions.                                      |
| `/pos/catalog/*`, `/pos/quotes`   | Catalog-owned scoped sellable reads and authoritative quotes.                                   |
| `/pos/registers`, `/pos/shifts/*` | Shifts-owned assignment, open, cash movements, count/close.                                     |
| `/pos/orders/*`                   | Orders list/detail/create, confirm/rounds/amendments, lifecycle and history.                    |
| `/pos/orders/:id/bills/*`         | Orders split/check commands; payment/refund workflows coordinate Payments.                      |
| `/pos/dining/*`                   | Orders-owned table/session reads, assignment/move/close.                                        |
| `/pos/kitchen/*`                  | Orders-owned station projections and ticket progress.                                           |
| `/pos/sales-documents/*`          | Orders-owned issued document reads, PDF/print data and reprint audit.                           |
| `/owner/pos-settings/*`           | Owning module controllers for register/table/station/policy setup; no duplicate business logic. |
| `/owner/reports/pos/*`            | Reports-owned scoped aggregates/export.                                                         |

Each mutation contract documents request ID, target revision if editable, actor/grants, bounded payload, response and allowed transitions. Lists use bounded cursor pagination and explicit filters. Shared contracts expose decimal strings and framework-independent values only; preserve root exports. Keep existing error shapes compatible while adding stable error codes for invalid input, forbidden action, stale revision, shortage, payment conflict and reconciliation-required outcomes. Do not encode business decisions by matching English error text.

### Online interruption behavior

Persist the command ID and exact payload before sending a commercial mutation. If safe persistence is unavailable, block that mutation with a recoverable explanation. Network timeout leaves the envelope unresolved; query its authenticated recorded result or replay the same idempotent command. Never generate a new key to bypass uncertainty. Clear the envelope only after a definitive response or explicitly recorded resolution.

When disconnected, show a persistent connection state, allow draft editing, and disable sale confirmation, tender, refund, kitchen and table mutations. Reconnect refetches authoritative state before actions resume. No background sync of financial commands. Preserve existing uncertain accept/preparation requests during migration of sessionStorage to the new recovery mechanism; document compatibility/expiry handling rather than dropping them.

## Permissions and audit — TARGET

Define server-enforced capabilities for sell/confirm, accept, prepare, mark-ready, handover, manage-tables, split-bills, collect-payment, discount within limit, reject/cancel by stage, refund, restock, cash movement, open/close shift, reprint and view reports. Role presets (cashier, kitchen, supervisor, owner) compose permissions; branch/station/register assignments constrain them. UI visibility is not authorization. Do not auto-grant new money-moving capabilities to existing employees during migration.

Audit commands include actor ID, supervisor if applicable, merchant/branch/register/shift, request key, order revision, reason, timestamp, linked document/payment/movement and outcome. Log structured IDs without passwords, session tokens, card data or unnecessary customer PII. Effective deactivation/grant changes apply on the next request.

## Delivery milestones and dependencies

Every row is required for the complete first release unless explicitly marked deferred. Ship vertical slices behind controlled enablement; none alone proves production readiness.

| ID  | Slice                                                      | Depends on           | Exit condition                                                                                                     |
| --- | ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| M0  | Source audit, feature/progress contract, decision register | —                    | Baseline and confirmed/open decisions recorded.                                                                    |
| M1  | POS frontend foundation                                    | M0                   | QueryClient, scoped stores/recovery, shared UI, router shell; existing queue/login retained and verified.          |
| M2  | Register, shift, permissions foundation                    | M1; D07              | Authorized staff can select register/open shift; uniqueness and grant enforcement proven.                          |
| M3  | Cashier sales and stock compatibility                      | M2; D08              | Server quote, carts/suspend, sale confirmation, DIRECT/RECIPE/mixed handling, immutable facts and retry safety.    |
| M4  | Dining sessions and split checks                           | M3; D05              | Table assignment/move, rounds, item/equal/custom splits conserve quantity/money under concurrency.                 |
| M5  | Tenders and sale documents                                 | M3, M4; D09, D10     | Cash/external terminal, split tender, partial payment, issuance/reprint/PDF and unknown-result recovery.           |
| M6  | Kitchen and fulfillment                                    | M3, M4; D06          | Stations, amended tickets, item/whole-order readiness, handover; integration with M5 policy verified.              |
| M7  | Cancellation, refunds, returns and approvals               | M5, M6; D11          | Before/after preparation, partial refunds, caps, waste/restock and supervisor attribution verified.                |
| M8  | Shift close, reports and owner configuration               | M2, M5, M7           | Complete drawer reconciliation, reporting, settings and audit; opening-only M2 is insufficient.                    |
| M9  | Release hardening and pilot                                | M1–M8; D09, D10, D12 | Live integration, contention/recovery, actual devices, operational monitoring/backup restore and pilot acceptance. |

## Open decisions and implementation defaults

These do not block writing the plan or independent foundation work. Resolve each before its dependent slice; do not repeatedly ask for already confirmed D01–D04 or D13–D16. A TARGET default is a proposal, not a user answer. POS-D16 settles 80mm/PDF output; the remaining POS-D10 hardware/adapter details stay open.

| ID      | OPEN decision                                                                                                                        | Proposed default / dependency                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POS-D05 | Exact bill split/correction rules, shared-item quantities, and moving/merging tables                                                 | Target item/equal/custom split with whole-item quantities and one basis per order; move sessions, defer joining/merging. Resolve before M4.                |
| POS-D06 | Kitchen dispatch and payment-before-handover policy per fulfillment type; station setup                                              | Confirmed rounds dispatch for dine-in; configurable prepayment for takeaway/delivery. Resolve before M6 and final tender/fulfillment integration.          |
| POS-D07 | Shared drawer vs employee-owned shift; role presets, discount/approval thresholds                                                    | One open shift per register, individually attributable authorized operators; no implicit shared credentials. Resolve before M2.                            |
| POS-D08 | DIRECT/legacy stock cutover and pending recipe snapshot policy                                                                       | Preserve explicit legacy handling; new mapped sales use ledger; preserve recipe acceptance timing. Resolve before M3 migrations.                           |
| POS-D09 | Operating country, tax-inclusive/exclusive policy, charges/delivery fees, invoice identity/numbering and required fiscal integration | No invented rates; explicit disabled configuration pending decision. Resolve before M5 financial/document rules and launch.                                |
| POS-D10 | Remaining printer/OS/browser, physical printable width, PDF adapter, drawer/scanner needs and terminal reference policy              | 80mm thermal + printable/downloadable PDF confirmed under D16. Browser print is a candidate; physical device/adapter acceptance remains open before M5/M9. |
| POS-D11 | Cancellation/refund permissions, prepared-item waste, physical-return eligibility, no-receipt returns, correction policy             | Reason plus privilege/approval; original-sale-linked refunds; no automatic ingredient restoration. Resolve before M7.                                      |
| POS-D12 | Deployment topology, register/device provisioning, business-day timezone, retention, expected load and performance budget            | Keep POS as existing app; merchant/branch timezone and realistic peak-load fixtures must be explicit. Resolve before M9.                                   |

## Verification and release gates

Required scenarios (track individually in Progress):

1. Open shift, sell configured DIRECT/RECIPE/mixed products, record exact payment/change, issue receipt, kitchen readiness/handover, close shift and reconcile.
2. Occupy a table from two terminals; exactly one conflicting assignment succeeds. Add rounds; move table; split checks by items/equal/custom amounts; combine tenders; settle all checks and close the session without duplicate stock/revenue.
3. Concurrent tenders/refunds cannot exceed balances or quantities. Concurrent split edits conflict by revision. Tender racing shift close either posts in the closing snapshot or is rejected without partial effects.
4. Timeout before/after database commit, reload, reconnect, same-key replay, changed-payload conflict, revoked permission, branch/account switch and unavailable local storage. Exactly one commercial result is retained.
5. Cancellation before/after kitchen start, partial preparation, paid cancellation, partial refund, original-batch restoration and waste/restock remain distinct, with valid approvals.
6. Catalog/recipe/price edits preserve historical checks, requirements, sale documents and linked refunds. Existing storefront/legacy reservations remain correct through migration.
7. Printer unavailable/PDF failure and repeated reprint do not recreate sale/payment. Arabic RTL, keyboard-only, touchscreen, translated errors and narrow-screen overflow are checked on actual target viewports.
8. Foreign-tenant/branch/register/station references and disabled employees are rejected on reads and commands. Kitchen permissions do not expose financial/customer details unnecessarily.
9. Fresh and representative additive migrations, rollback/feature-disable procedure, monitored failure/latency metrics, restore rehearsal and representative peak-volume queries are verified. No database reset to make tests pass.

Use focused pure-rule tests, HTTP authorization/contracts, real PostgreSQL transaction/race tests, and Playwright scenarios. Keep mocked UI checks distinct from live browser -> API -> migrated database tests. Run affected package typecheck/lint/build/tests and the API checklist, including affected database suites. Future new suites must be wired into package scripts and CI when introduced. Follow `.node-version`; use filtered package commands, and read bundled Turbo documentation before changing Turbo behavior.

Production acceptance requires M1–M9 completed with evidence, all mandatory decisions resolved, and a real pilot reconciled by the operator. Document any measured limits. No performance or production-ready claim follows from source review, a successful build, or mocked UI tests alone.
