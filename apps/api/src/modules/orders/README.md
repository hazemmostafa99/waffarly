# Orders: where each responsibility lives

Orders remains one Nest business module. HTTP entry points are grouped by the
application using them; business operations are grouped by what they do. Disk
paths do not change HTTP URLs, request/response contracts or order source values.

| Folder             | Responsibility                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `http/storefront`  | Public storefront quote and order submission, including the existing identity-aware Marketplace checkout endpoint. |
| `http/marketplace` | Customer/guest order session, history, details and explicit claim.                                                 |
| `http/pos`         | Cashier sales, order operations, dining, delivery and saved receipt endpoints.                                     |
| `http/owner`       | Owner order operations, customer association and return reports.                                                   |
| `checkout`         | Storefront checkout validation, quote, submission, saved items and checkout discount/branch rules.                 |
| `pos-sales`        | Cashier quote/create, active-sale/detail/payment-state reads and immutable sale references.                        |
| `fulfillment`      | Acceptance, preparation, readiness, handover, cancellation and branch operation queues.                            |
| `kitchen`          | Kitchen dispatch, additional items and cancellation acknowledgement.                                               |
| `dining`           | Table configuration, table sessions, attachment and moving sessions.                                               |
| `billing`          | Check allocation, pickup collection preparation, payment and monetary refund commands.                             |
| `receipts`         | Immutable check receipt issuance, saved snapshot parsing and receipt history.                                      |
| `delivery`         | Merchant courier directory, POS delivery queue, dispatch attempts, performance and courier remittance.               |
| `returns`          | Physical item returns and their informational waste reports.                                                       |
| `customers`        | Customer/guest ownership and access; separately, merchant-local customer associations.                             |
| `stock`            | Frozen stock requirements, inventory consumption and restoration.                                                  |
| `mapping`          | Existing order receipt/summary transport projections.                                                              |

The shared `/pos/orders` route prefix is split into HTTP controllers by cashier
task. `pos-orders.controller.ts` owns sale creation, order reads and the main
accept/handover/cancel actions. `pos-order-kitchen.controller.ts` owns dispatch,
amendments and preparation. `pos-order-billing.controller.ts` owns payment state,
pickup collection, tenders, refunds and check receipt lookup.
`pos-order-returns.controller.ts` owns physical return reads and recording.
These controllers call the existing operation services directly; their routes
and contracts stay unchanged.

## Merchant order inbox

The Merchant inbox reads `GET /owner/orders/inbox` across all saved order
sources: Waffarly, storefront and POS, with optional source, status, fulfillment,
date and text filters. Date-only bounds use Cairo calendar days. The endpoint
returns a bounded cursor page and includes only item counts and a line preview.
Filtered totals and status counts are database aggregates; callers that only need
the latest rows can pass `includeStats=false` to skip that aggregate query.
Dashboard report requests also return source, date, fulfillment and product
aggregates for the selected date window. The all-source date/order traversal is
backed by a merchant, created-at and ID index; source-filtered traversal has its
own matching index.
`GET /owner/orders/:id` supplies full line details when the Merchant opens a
row. The older `GET /owner/orders` response remains available to existing
callers.

## How an operation runs

Storefront submission goes through `http/storefront` to `StorefrontOrdersService`.
Marketplace submission uses the existing `/customer` checkout variant, resolves
account/guest identity, and uses the same checkout transaction. Marketplace does
not have a duplicate order engine. That identity-aware route records source
`waffarly`; regular storefront submission records `storefront`; cashier-created
orders record `pos`. Fulfillment and payment actions keep this origin unchanged.

Cashier HTTP routes call the service responsible for the requested work directly:

| Responsibility                                | Service                        |
| --------------------------------------------- | ------------------------------ |
| Quote and create a sale                       | `PosSaleService`               |
| Add kitchen items                             | `KitchenOrderAmendmentService` |
| Record payment                                | `CheckPaymentService`          |
| Split an order into checks                    | `CheckSplitService`            |
| Accept or reject a legacy website order       | `StorefrontOrderStatusService` |
| Record an approved refund                     | `CheckRefundService`           |
| Prepare a ready website pickup for collection | `PickupCollectionService`      |
| Read active sales, details and payment state  | `PosOrderQueryService`         |
| Reopen a receipt or browse receipt history    | `PosReceiptQueryService`       |

The former `PosOrdersService` forwarding facade has been removed. Services own
operation dependencies and transaction boundaries; no extra service sits between
these controllers and their responsible service. Supervisor approval remains in
the refund HTTP entry point. Physical item returns remain separate.

Receipt issuance is an ordinary helper that receives the payment transaction, so
settlement and its immutable receipt commit together. Reading a receipt uses its
stored snapshot rather than recreating it. The dining HTTP entry point calls `CheckSplitService` directly; storefront lists delegate to
`fulfillment/order-queue.query.ts`.

See the [application standard](../../../../../docs/architecture/API_APPLICATION_STANDARD.md).
This completes replacement of the cashier forwarding facade; the whole Orders
module and the rest of the API still require review against that standard.

`OrderLifecycleService` keeps the common transaction and routes the requested
change to `accept-order.ts`, `prepare-order.ts`, `handover-order.ts` or
`cancel-order.ts`. `order-transition-access.ts` checks branch/operator access
after the original locks and before saved-result replay. These helpers receive
the active transaction and do not open their own transactions.

`save-checkout-line.ts` saves one checkout item, holds its available stock and
freezes its ingredient needs. `checkout-policy.ts` owns checkout discount and
receiving-branch decisions. The older website accept/reject action lives in
`fulfillment/storefront-order-status.service.ts` and is called directly by its
owner controller, separately from checkout submission.

Customer access separates browser/session identity (`customer-order-session.ts`
and `order-identity.rules.ts`), scoped reads (`customer-orders.query.ts`) and the
customer-visible response (`customer-order.mapper.ts`). The service still
coordinates explicit guest claims. Guest identity caching remains per request;
account and guest access are not inferred from contact details.

Delivery separates the merchant courier directory and its owner/POS entry points
from work-list reads (`delivery-queue.query.ts`), employee/custodian checks
(`delivery-access.rules.ts`) and the existing command transaction. Dispatch,
failure and completion remain in one transaction so the current delivery state,
attempt history and exact replay result cannot diverge.
Item returns separate read/report queries (`item-return.queries.ts`) and response
mapping (`item-return.mapper.ts`) from the write command. Dining table setup lives
in `dining-tables.ts`; its owner routes live under `http/owner`.

## Rules for future edits

- Put HTTP parsing and actor extraction in controllers. Keep database access in
  the operation/service. Request schemas remain in the owning feature folder.
- Name files after a business operation and functions after the action performed.
  Avoid adding unrelated behavior to a general order service or a utilities file.
- Keep calculations and replay readers beside the operation they support. Share
  only an actual common business rule, not superficially similar workflows.
- Keep command-specific replay checks, error shapes, tenant and branch predicates,
  revision checks, isolation levels and lock order intact.
- Nested persistence helpers use the supplied transaction. Never silently start
  another transaction or use the root client for part of an atomic command.
- Payments owns tender recording; Shifts owns shifts/cash journals; Inventory
  owns its ledger; Catalog owns product pricing. Orders coordinates their public
  APIs. Cross-module imports continue through each module's `index.ts`.
- Use short English comments for significant steps and reasons, especially
  transaction/lock/replay constraints. Do not narrate every assignment.
- Do not rename Prisma models or shared transport contracts as part of folder
  cleanup. `StorefrontOrder` currently stores both storefront and POS orders.

## Reading the files

Every TypeScript file in this module begins with a short plain-English description
of its purpose. Significant multi-step writes also have short numbered comments.
Read the description first, then the named operation; the comments explain the
business steps and why related writes stay together.

This is a structural refactor, not a change in order behavior. Transaction
coordinators deliberately keep their common locks, replay handling and commit
boundaries together. Further extraction should target a concrete independent
responsibility, rather than splitting a transaction just to meet a line limit.

## Manual acceptance

Automated checks cover formatting, typecheck, lint, HTTP/unit tests, build and
isolated database behavior; they do not replace browser/operator acceptance or
real financial review. No real financial actions were performed. Use a disposable
local merchant and known fixtures for manual acceptance:

1. Quote and submit storefront and Marketplace orders. Retry the exact request;
   confirm one order and the original receipt. Try a changed payload with that
   request ID; confirm rejection.
2. Confirm subscription, operating-hour, fulfillment, unavailable-stock and
   reviewed-price rejection behavior remains visible. Check the receiving branch.
3. Create a cashier sale, reopen it, dispatch and amend its kitchen ticket, then
   follow acceptance/preparation/readiness/handover. Check quantities and stock.
4. Attach a dining sale, move the session, and split its check. Confirm exact
   totals and rejection of allocation changes after payment begins.
5. With an authorized test shift, prepare a ready web pickup for collection;
   confirm its source remains storefront. Record an explicitly authorized test
   payment, inspect the saved receipt, and retry that exact command only.
6. Exercise authorized test refunds and separate item returns; confirm refunds
   affect cash/payment history while item returns retain informational waste value.
7. Check POS delivery queues/remittance, branch restrictions, and owner queues.
8. Check customer/guest history, details and explicit claim. Confirm a different
   customer or merchant cannot read or claim an unrelated order.

Financial and inventory outcomes remain manually unverified until these flows
are reviewed by the operator.
