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

`PosOrdersService` is a temporary compatibility entry point for its current
callers. It delegates sale quote/create to `PosSaleService`. Other cashier
operations still use the earlier function-based orchestration and remain migration
work. Do not copy that compatibility facade into new features.

## Migration checklist

1. Select one substantial operation and identify its callers and dependencies.
2. Move orchestration into an injectable service and register it in the feature
   module. Preserve its complete transaction and error behavior.
3. Keep calculations, mapping and transaction helpers as ordinary functions.
4. Preserve existing entry points where callers still need them. Remove forwarding
   facades only when their callers can migrate together.
5. Update fixtures to compose the actual service dependencies, then verify the
   affected behavior using the checks authorized for the task.
6. Document what was aligned and what remains. Passing tests alone does not prove
   architectural consistency.

The rest of Orders and the Shifts, Subscriptions, Inventory, Merchants and Catalog
modules still require operation-by-operation review. This reference does not mean
the whole API has been migrated.
