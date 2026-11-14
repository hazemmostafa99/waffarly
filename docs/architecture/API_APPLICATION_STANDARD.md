# API application standard

The API is a feature-oriented modular monolith. Each business feature owns its
HTTP entry points, application services, rules, queries and persistence helpers.
This is the target standard; the existing modules are only partially aligned.

## Responsibility and naming

| Responsibility        | Form and naming                                            | Owns                                                                   |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| HTTP                  | `<subject>.controller.ts`                                  | Route, authenticated actor, transport validation and response contract |
| Application operation | `<business-operation>.service.ts`, injectable Nest service | Authorization, orchestration, transaction and retry boundary           |
| Rules                 | `<subject>.rules.ts`, ordinary functions                   | Decisions and calculations; no hidden database access                  |
| Reads                 | `<subject>.query.ts`, ordinary functions                   | Scoped reads using explicitly supplied dependencies                    |
| Persistence           | `<subject>.persistence.ts`, ordinary functions             | Related database work using the supplied client                        |
| Response mapping      | `<subject>.mapper.ts`, ordinary functions                  | Stored data to explicit response shapes                                |
| Request validation    | `<subject>.schemas.ts`                                     | Request shape and reusable validation                                  |

A cohesive application service may expose a quote and the command it previews.
Do not create a class for every tiny function. Small features can stay flat;
large features group files by business responsibility, with HTTP entry points
under `http/<audience>/` when audience separation helps. Do not force every feature
into empty application/domain/repository directories.

## Dependency and transaction rules

- Nest injects application dependencies through the constructor. Do not pass an
  entire application service as a dependency bag to a new operation function.
- The application operation owns its transaction, retries and replay handling.
  Helpers inside that transaction receive its client and never open another one.
- Direct Prisma use in an application service is allowed. Extract substantial
  queries or writes when it improves understanding; a repository wrapper is not
  required for every Prisma call.
- Public service methods validate business invariants for non-HTTP callers too.
  Controllers handle transport validation; preserving existing error behavior
  takes priority when migrating legacy parsing.
- Cross-feature access uses the owning feature's public `index.ts` and Nest
  exports. Keep tenant scope, branch access, lock order and financial/stock
  snapshots intact.
- Use short purpose comments and numbered comments for significant business
  steps. Explain why a step exists, rather than narrating each assignment.

## Reference operation: cashier sale

[`PosSaleService`](../../apps/api/src/modules/orders/pos-sales/pos-sale.service.ts)
owns quote and sale creation. Nest injects its pricing, stock, shift, dining and
database dependencies. `create` owns the existing transaction and retry loop;
pricing rules and transaction helpers retain their existing responsibility.

Cashier controllers call their operation or query service directly:

| Responsibility                    | Service                        |
| --------------------------------- | ------------------------------ |
| Sale quote/create                 | `PosSaleService`               |
| Kitchen additions                 | `KitchenOrderAmendmentService` |
| Bill payment                      | `CheckPaymentService`          |
| Split an order into checks        | `CheckSplitService`            |
| Legacy website accept/reject      | `StorefrontOrderStatusService` |
| Approved monetary refund          | `CheckRefundService`           |
| Pickup collection preparation     | `PickupCollectionService`      |
| Sales/details/payment-state reads | `PosOrderQueryService`         |
| Receipt lookup/history            | `PosReceiptQueryService`       |

The former `PosOrdersService` forwarding facade has been deleted, including its
Nest registration and all callers. Query services own the scoped read operation;
there is no forwarding service in front of ordinary query functions. Do not
create an extra wrapper solely to call another service or a single query.

Payment and refund services keep their original transaction boundaries. Payments
owns tender recording, Shifts owns cash effects, and receipt issuance remains a
helper using the active payment transaction. Receipt queries read the stored
snapshot. Refund supervisor approval remains in the HTTP entry point.

Do not add a forwarding service just to reach an operation service. A service
calling another service should perform a distinct business responsibility.

## Migration checklist

1. Select one substantial operation and identify its callers and dependencies.
2. Move orchestration into an injectable service and register it in the feature
   module. Preserve its complete transaction and error behavior.
3. Keep calculations, mapping and transaction helpers as ordinary functions.
4. Route callers directly to the operation service. Remove redundant forwarding
   methods and dependencies when migrating those callers.
5. Update fixtures to compose the actual service dependencies, then verify the
   affected behavior using the checks authorized for the task.
6. Document what was aligned and what remains. Passing tests alone does not prove
   architectural consistency.

Subscription administrative commands now execute directly in
`SubscriptionService.command`, which owns their transaction and replay handling.
Read, access, onboarding-transaction and pricing helpers remain ordinary functions.

## Reviewed application services

The following existing services now execute their write operations directly,
without forwarding each command to a standalone operation function:

| Feature   | Services and responsibilities                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shifts    | PosRegistersService: register setup and owner/employee register reads. ShiftsService: shift opening, closing and manual cash. CashCustodyService: safes, cash movements and transfer lifecycle.              |
| Inventory | InventoryService: stock identities. InventoryLocationsService: branches, warehouses and consumption defaults. InventoryPolicyService: merchant stock policy. InventoryVisibilityService: reorder thresholds. |
| Merchants | MerchantService: onboarding, public handle assignment and application decisions.                                                                                                                             |
| Catalog   | ProductService: product configuration, reusable-choice links and availability.                                                                                                                               |

This pass moved 37 operation bodies while preserving the existing constructors
and public method contracts. Read queries, mapping, calculations, access guards
and active-transaction helpers remain ordinary functions. A public cross-feature
service may expose a transaction helper without becoming a redundant application
layer: callers still need that feature-owned API and shared transaction.

Services should be cohesive, not universally split into one class per method.
Keep related lock, replay and transaction steps together. Split a growing service
by an actual business responsibility and update callers directly; do not add
another forwarding facade to shorten a file.

This records the reviewed services, not a claim that every API feature has been
fully audited. Browser/operator acceptance is separate from automated checks.
