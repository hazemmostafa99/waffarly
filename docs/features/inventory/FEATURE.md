# Inventory, Product Mapping & Recipes — Feature Contract

## Status and scope

- Document status: Repository-audited feature contract; M1 registry delivered, later technical designs and delivery slices proposed.
- Feature area: Inventory, Catalog/Product Builder, Recipes/Consumption, Purchasing, and Orders integration.
- Primary applications: `apps/api`, `apps/merchant-dashboard`; later integration with `apps/storefront` and `apps/pos`.
- Supporting packages: `packages/database`, `packages/contracts`.
- Last reviewed: 2026-10-15.
- Companion: [PROGRESS.md](PROGRESS.md), containing repository evidence, gaps, verification, and milestones.
- Current delivery: **M3 Stock Item registry, branch/warehouse scope, policy, balances, opening stock, supplier directory, and purchase invoice receipt are implemented and verified.** Product mappings, recipes, and order consumption remain future slices; details and limits are tracked in `PROGRESS.md`.

Extend the existing shared Product Core with stock identities, warehouse operations, DIRECT mappings, and independent product/variant recipes. Keep pricing and inventory calculations on the backend and reuse the existing order domain.

The restaurant flow is the first integration target. Clothing, supermarket, and electronics examples establish generic modeling needs; they do not approve their complete workflows or first-release scope.

## Sources and decision language

This pair adapts the supplied `WAFFARLY_COMMERCE_FEATURE_SPEC.md` and `WAFFARLY_IMPLEMENTATION_PROGRESS.md` to the repository's existing `FEATURE.md` / `PROGRESS.md` convention. The supplied documents were authored without repository access. Their embedded execution instructions are reference material, not an additional request to implement software in this task.

Repository references:

- [Project Overview](../../../PROJECT_OVERVIEW.md) and [MVP Scope](../../../MVP_SCOPE.md).
- [API implementation rules](../../../apps/api/AGENTS.md) and [API architecture](../../architecture/API_ARCHITECTURE.md).
- [Product Builder contract](../catalog/product-builder/FEATURE.md) and [existing progress](../catalog/product-builder/PROGRESS.md).
- [Catalog overview](../catalog/OVERVIEW.md), [Products](../catalog/PRODUCTS.md), and [technical decisions](../../architecture/TECHNICAL_DECISIONS.md).

| Label            | Meaning                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOURCE-CONFIRMED | Recorded as agreed in the supplied commerce specification; a requirement for this workstream, not evidence of implementation or blanket release approval. |
| EXISTING         | Observed in current source. Runtime/test evidence is recorded separately in `PROGRESS.md`.                                                                |
| PROPOSED         | Technical approach or delivery sequence awaiting detailed design for its slice.                                                                           |
| OPEN             | A decision is needed before the affected behavior is implemented.                                                                                         |
| DEFERRED         | Excluded from this workstream's current implementation target.                                                                                            |

Source IDs such as `INV-01`, `REC-01`, `PB-08`, `F-01`, and `AC-01` retain their meaning **inside the supplied commerce documents**. They are not new global repository IDs: root documents already use some of these IDs differently. Local decision keys below use `IC-Dxx` to avoid that collision.

## Audited starting point

The current system already contains:

- Merchant-owned products, categories, images, availability, archival, revision checks, and optional variants with structured attributes.
- Optional variant SKU, barcode, and integer `stockQuantity`. A null quantity allows a variant without stock tracking.
- Reusable `ModifierGroup` / `ModifierOption` definitions attached through product assignments. Selection limits, fixed option adjustments, and defaults live on the assignment.
- `ProductPricingService`: selected variant price replaces product base price; otherwise use the simple product's base price. Add the selected assignment option adjustments. EGP amounts use decimal strings and integer cents.
- Storefront checkout that validates/re-quotes configurations and persists immutable selection/price snapshots.
- `StorefrontOrdersService`: tracked variant counters decrease at **order creation**; rejecting a pending order restores them. Acceptance currently changes status without a new stock deduction.
- An owner order inbox. Current statuses are only `pending`, `accepted`, and `rejected`.

At the M0 audit there were **no persisted Stock Item, Warehouse, Branch, Recipe, stock ledger, purchase invoice, or general inventory-policy models** in the inspected schema. The subsequent M1–M3 slices added Stock Items and units, persisted branches/warehouses and their ledger, and supplier purchase receipts. Product/Variant mappings and recipes are still absent. POS remains a preparation screen whose expected authentication endpoints are absent; employee permissions and branch-scoped authorization are also missing.

The existing nullable variant counter is compatibility behavior, not a warehouse inventory system. Its database constraint disallows negative quantities. Do not attempt to implement merchant-wide negative stock by weakening that counter alone.

## Reconciliation with existing behavior

| Topic                    | Existing contract/code                                                                                                               | Direction for this feature                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optional stock           | Variants can have no stock quantity; no inventory dependency is required.                                                            | SOURCE-CONFIRMED target has DIRECT/RECIPE only. Keep existing products valid during a staged transition; decide mapping/completeness and activation rules before enforcing them. Do not create a third `NONE` inventory mode. |
| Inventory timing         | Variant reservation/decrement at checkout; restore on pending rejection.                                                             | Recipe consumption for online restaurant orders occurs at cashier acceptance. Explicitly reconcile old reservations, pending orders, and new ledger effects before enabling deduction.                                        |
| Acceptance               | Tenant owner can accept/reject in Merchant Dashboard.                                                                                | Branch-authorized cashier/POS acceptance is still needed. An owner action does not establish the intended branch/cashier workflow.                                                                                            |
| Base-price precedence    | Variant price replaces product price; simple product uses base price. Positive EGP, two-decimal prices already exist.                | Preserve this baseline. These details are no longer unverified questions from the supplied file. New taxes, discounts, fees, or currencies remain separate scope.                                                             |
| Modifier default price   | Stored per product assignment, not on the shared option.                                                                             | Preserve product-specific prices. PROPOSED: extend that assignment with variant overrides; a shared library default and precedence require IC-D03. Do not overwrite different product prices with one global default.         |
| Modifier quantities      | `optionIds: string[]`; repeated options rejected.                                                                                    | Extend the transport, validation, snapshots, UI, and reports for positive option quantities and caps. Existing selections must continue to mean quantity 1.                                                                   |
| Reusable group editing   | Shared-definition editing blocked while assigned; detach/edit/reattach supported.                                                    | Preserve this established V1 rule. Broader propagation remains OPEN; it does not block the initial stock registry.                                                                                                            |
| Variant identity         | Retained variant IDs are updated; omitted variants can be deleted. Variant edits blocked while a pending tracked reservation exists. | New recipes/mappings must preserve stable IDs, protect in-flight consumption, and define deletion/mode-switch behavior. Existing reservation protection does not protect future recipes automatically.                        |
| History                  | Product/variant/attribute/modifier identities, names, and prices are snapshotted.                                                    | Preserve snapshots and add option quantities when delivered. Recipe version/snapshot remains DEFERRED; decide the waiting-order edge case separately.                                                                         |
| Older feature exclusions | Product Builder V1 deferred inventory, option quantities, and variant-specific modifiers.                                            | This document records their later requested design scope. V1 delivery history remains accurate; this does not mark the extensions implemented or automatically launch-approved.                                               |

Some older documentation still describes Orders inside Catalog, unbounded public catalog loading, or report aggregation in memory. Current source has a separate `orders` module, cursor-paged public collections, and SQL report aggregation. Use the audited paths in `PROGRESS.md` for implementation ownership.

## Vocabulary and ownership

| Concept                        | Responsibility                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sellable Product / Variant     | Catalog identity and customer selection; independent of a counted commodity.                                                                 |
| Attribute                      | Describes or identifies a variant; does not itself add price or consume stock.                                                               |
| Modifier assignment            | A product's use of a reusable group, including existing selection/default/price configuration.                                               |
| Stock Item                     | Merchant-owned inventory identity shared by products, variants, recipes, and modifier effects.                                               |
| Unit of measure                | Base, purchase, or consumption unit with explicit compatible conversion. Product `sellingUnit: piece` is not an inventory conversion system. |
| Warehouse / Branch             | Distinct storage and operating scopes. A branch can use multiple warehouses and has a default recipe-consumption warehouse.                  |
| Condition                      | Available or Non-Sellable physical stock. Catalog product availability is a separate concept.                                                |
| Recipe                         | Complete ingredient requirements for one sellable unit; each variant's recipe is independent.                                                |
| Stock Movement                 | Attributable quantity change linked to its source document/action.                                                                           |
| Purchase Invoice               | Draft/Confirmed supplier document; confirmation itself receives stock.                                                                       |
| Purchase Return / Sales Return | Separate supplier/customer workflows. Return acceptance, inventory restocking, and financial refunds are distinct decisions.                 |

`Recipe` means composition; `Receipt` means a sales/payment document.

### Existing owners and proposed extensions

- **Catalog** continues to own products, variants, attributes, reusable modifiers, configuration validation, and authoritative pricing. Extend `ProductPricingService`; a separate Pricing module is unnecessary for the initial slice.
- **Inventory** owns stock identities, UOM conversion, policies, warehouse balances/conditions, and all movement application. No inventory owner existed at the M0 audit.
- **Recipes/Consumption (PROPOSED owner)** owns recipe configuration/effects and pure requirement calculation. A dedicated module is reasonable when the calculator/configuration slice is delivered; final boundaries are a slice design task.
- **Purchasing** owns the owner-managed supplier directory and purchase invoices. Confirmed invoice receipts use Inventory's public transactional movement API. Purchase returns remain future scope.
- **Orders** remains the lifecycle/transaction orchestrator for acceptance, deductions, cancellation, and immutable sale facts. Stock helpers must accept its active transaction client.
- **Branches and staff authorization** need real owners/contracts before branch operations are enabled. Their exact scope is not finalized here.
- **POS and Storefront** render shared contracts and invoke the backend. They do not maintain independent pricing or inventory algorithms.

Keep dependencies acyclic. PROPOSED direction: recipe logic may use Inventory's exported types/conversion interface; Catalog configuration may use deliberate Inventory/Recipe APIs; Orders may use Catalog pricing and Inventory/Consumption APIs. Inventory must not import Orders or Catalog application services. Before adding any dependency, update `apps/api/eslint.config.mjs`, module exports, `AppModule`, and architecture documentation together. Do not add empty layers or speculative services.

## Required business behavior

### M1 implementation decisions — 2026-10-15

The user approved quantities up to six decimal places, exact gram/kilogram and millilitre/litre conversions, item-specific packs, and rejection when conversion would require rounding. This resolves the M1 quantity portion of IC-D01; negative-stock policy is still a later decision. The remaining choices below define the delivered M1 slice and are not approval of later inventory behavior.

- Stock quantities and conversion factors use decimal strings, at most 12 integer and 6 fractional digits (`DECIMAL(18,6)` for saved factors). Calculations use scaled integers, reject overflow and sub-micro-unit results, and never round. Positive input quantities are required for the conversion preview. Fractional quantities are supported for all units, including pieces.
- Supported standard base units: `piece`, `g`, `kg`, `ml`, `l`. Only compatible standard units may convert. Standard factors are code-managed; an item-specific pack has a unique lowercase code, display name, and positive factor expressed directly in the item's base unit. Standard unit codes are reserved and cannot be redefined as packs.
- Base units and existing pack codes/factors are immutable in M1. Owners may edit names/descriptions, append pack units, and archive/restore the item. No permanent deletion or conversion replacement is exposed. This preserves meanings for future recipes and movements.
- Inventory owns the new schema, bounded list/detail/create/update/archive/restore and conversion-preview APIs under `/owner/inventory/items`. Authenticated owners manage only their merchant's items. There is no initial stock field or balance mutation.
- Creation uses a tenant-scoped request UUID and normalized payload fingerprint. Identical retries return the existing item; a reused request UUID with different input conflicts. Updates and archive/restore use optimistic revisions. Custom pack additions and item revision changes commit together.
- Lists use cursor pagination, bounded search and active/archived filters. Merchant `/inventory` provides item management and a server-calculated conversion preview in Arabic/English.
- Migration is additive: Stock Item and item-unit tables only. Existing products, variant counters, orders, and snapshot data have no backfill or behavioral change in M1.

Verification targets: exact conversion/precision/overflow; HTTP authentication and tenant injection; cross-tenant item/cursor access; idempotent creation; stale edits; immutable units; transactional pack additions; archive/restore; additive migration; localized UI and existing catalog/order regressions.

Only the quantity precision, exact conversions, item-specific packs, and no-rounding rule above are user-confirmed decisions. Other M1 details describe the implemented slice. The remaining feature behavior elsewhere in this contract keeps its SOURCE-CONFIRMED / PROPOSED / OPEN / DEFERRED labels.

### M2 implementation decisions — 2026-10-15

The user confirmed that each Warehouse belongs to one Branch, a Branch may own multiple Warehouses, and each Branch has one default recipe-consumption Warehouse. The user chose merchant-wide Allow Negative as the default and requested an attributable, reviewed opening-stock entry before purchase invoices exist. These decisions are implemented in M2.

- Warehouse reads/writes remain owner-only in M2; this does not establish employee, cashier, or branch-scoped RBAC.
- The merchant policy applies to debits from Available balances across its branches/warehouses. Non-Sellable is separate and never supplies sale or recipe consumption. Condition transfer and write-off behavior remains for the later operations slice.
- Opening entries are positive, append-only, attributable, request-idempotent operations with a reason and explicit review before posting. They can initialize either condition; they do not alter Stock Item creation.
- M2 persists owner-managed branches/warehouses, one active default per branch, attributable append-only movements, exact base quantities, source/request idempotency, and name/unit snapshots. Archive is blocked where it would invalidate a default or strand nonzero stock. The M2 UI exposes the negative-stock policy, reviewed opening entries, paged balances, and paged movement history.
- M2 does not change product/variant inventory configuration, purchasing, recipes, or checkout/order consumption. Employee, cashier, or branch-scoped RBAC is not established.

### M3 implementation decisions — 2026-10-15

The user selected an owner-managed supplier directory for M3. The slice also uses the proposed optional supplier invoice number, unique per supplier, and immutable confirmation model. It records physical quantities only; costs, taxes, and supplier payments are outside M3.

- Purchasing owns suppliers and draft/confirmed purchase invoices under owner-authenticated merchant routes. Supplier names are unique within a merchant; supplier invoice numbers are optional and unique within a supplier when present.
- A draft records supplier, destination warehouse, actual received quantity, selected item unit, and Available or Non-Sellable condition. Saving or editing a draft does not change stock.
- Confirming a draft converts each quantity exactly to the Stock Item base unit and posts one attributable `purchase_receipt` batch through Inventory inside the same database transaction. Request and source idempotency plus invoice row locking prevent duplicate stock, including concurrent confirmation.
- Confirmed invoices and their line snapshots cannot be edited. Corrections are separate reviewed inventory movements in a later operations slice. Supplier returns, cost valuation, taxes, and settlement are not included.
- M3 adds the supplier directory and invoices to the Merchant Dashboard. No Product/Variant inventory configuration, recipe calculation, checkout, or order behavior changes; owner-only access does not define staff or branch-scoped permissions.

### Inventory foundation and units

1. Keep sellable and stock identities separate. Several sellable products/variants may consume the same Stock Item and warehouse balance.
2. Restaurant recipes initially consume raw items. Prepared/semi-finished production is DEFERRED.
3. Support base, purchase, and consumption units with conversions. Normalize all balance arithmetic to each item's base unit using exact decimal/fixed-scale quantities. IC-D01 confirms six fractional digits, exact gram/kilogram and millilitre/litre conversions, item-specific packs, and rejection when conversion needs rounding. Saved base units and pack factors stay immutable.
4. Branches and warehouses are distinct. One warehouse belongs to one branch; each branch has one default recipe-consumption warehouse. M2 implements this cardinality and owner-only management. Employee/branch authorization and missing-default behavior for future consumption still need operational integration.
5. Separate Available and Non-Sellable balances. Non-Sellable never supplies normal sale consumption. Condition transfer preserves physical total; write-off reduces it.
6. Configure one Allow/Prevent Negative policy per merchant across its items and warehouses. No per-item/warehouse exceptions. M2 sets Allow Negative by default and applies the policy to Available debits; Non-Sellable stock is separate. Insufficient-stock UX for future consumption remains part of IC-D08.
7. Creating a Stock Item, including inline creation from a builder, creates identity/configuration only. It must not silently create an opening balance. Any opening stock must be attributable through a reviewed stock-entry operation.
8. Stock history must identify merchant, warehouse, item, quantity/unit, condition, source, actor, reason where required, and time. Use append-only movements; confirmed corrections need explicit reversing/correcting actions, not edited history.

### Purchasing and warehouse operations

| Operation                  | Required effect                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchase Invoice Draft     | Editable supplier/warehouse document; no stock effect.                                                                                                                                                     |
| Purchase Invoice Confirmed | Record actual received quantities; state and positive movements persist once, atomically. No separate Goods Receipt.                                                                                       |
| Direct transfer            | Same merchant, distinct valid warehouses; source OUT and destination IN happen together on confirmation, including across branches. No in-transit flow.                                                    |
| Adjustment                 | Authorized signed correction with reason, actor, and movement history.                                                                                                                                     |
| Stocktaking                | Full warehouse or selected items; show counted/system variance; apply differences only on confirmation. Concurrent movements require IC-D09.                                                               |
| Condition transfer         | Available to Non-Sellable or reverse, with reason and authority; physical total unchanged.                                                                                                                 |
| Write-off                  | Permanent physical stock removal with its own source/reason and audit.                                                                                                                                     |
| Purchase Return            | Full/partial quantities linked to original confirmed invoice and lines; remove from Available or Non-Sellable as selected. Bound cumulative returnable quantities. Return states/reversals require IC-D10. |

Invoice confirmation, transfer, stocktake confirmation, return, and write-off must be atomic and protected from duplicate application under retries/races. M3 defines owner-managed suppliers, optional per-supplier invoice numbering, and quantity receipt only; costs/valuation, VAT, and settlement are excluded. Purchase returns, cumulative limits, restock conditions, and reversals remain for focused follow-up under IC-D10.

### Product modes, mappings, and recipes

1. Inventory modes are exactly `DIRECT` and `RECIPE`. Business Activity supplies a default; Product can override it. Activity default values and whether a later default change affects existing products require IC-D04.
2. Every variant inherits its Product mode; no variant-level mode override.
3. A simple DIRECT product or each DIRECT variant maps to **one** Stock Item plus consumption quantity/unit per sellable unit. Different sellables may share that item. Example: three six-packs require 18 bottles; this multiplier does not set the sale price.
4. A simple RECIPE product has its recipe. Products with variants have a complete, independent recipe per variant. No base-recipe inheritance or automatic merge. A future copy action may duplicate rows once; it must not establish inheritance.
5. Embed selection or inline creation of Stock Items in Product/Recipe Builder. Reuse existing product create/edit, category/image requirements, archival, availability, and revision handling.
6. Do not force SKU/barcode entry. Existing products/variants without stock data remain readable during migration. Decide when incomplete DIRECT/RECIPE configurations may save or sell before imposing a non-null schema or publication gate (IC-D05).
7. Map/configuration changes, mode switching, recipe ingredient deletion, variant removal, and warehouse/unit deactivation must not strand pending orders or destroy consumption history. Their edit restrictions require IC-D05/IC-D06.

### Modifiers, prices, and effects

1. Reuse existing tenant-owned groups across products. Variant configuration can restrict both groups and individual options.
2. Group `Min Selections` / `Max Selections` count **distinct options**. Each selected option has a positive integer quantity bounded by its configured maximum. Two options at quantities 3 and 2 count as two selections, not five.
3. Normalize repeated option entries before enforcing distinct counts and caps, or reject ambiguous duplicates consistently. Duplicate arrays must not bypass caps; the exact new transport shape is PROPOSED, not a final contract here.
4. Each option has an effective default sale-price adjustment and can have a variant-specific price override. Retain current per-product assignment prices pending IC-D03. Repeated quantity multiplies the effective modifier price.
5. Price and recipe effect are independent: a free option can consume stock; a priced option can have no stock effect.
6. An option can add/reduce multiple Stock Items, or have no effects. Support default effects and variant-specific overrides. Replacement versus per-item merge, explicit empty overrides, and reductions below zero require IC-D07.
7. A reduction in ingredient consumption must not silently become a physical stock receipt. PROPOSED: reject configurations with negative final ingredient requirements; obtain the final rule before shipping.
8. Preserve existing default-selection behavior unless explicitly changed. Variant restrictions combined with required groups/defaults must have a defined validation outcome. Modifier recipe effects on DIRECT products are OPEN (IC-D07); do not infer a new mixed inventory mode.

### Authoritative calculation

Preserve current EGP precision and base-price precedence:

```text
effectiveBasePrice = selectedVariant.price, otherwise simpleProduct.basePrice
effectiveOptionPrice = selected variant override, otherwise applicable default
unitSalePrice = effectiveBasePrice + sum(effectiveOptionPrice * optionQuantity)
lineTotal = unitSalePrice * orderedLineQuantity
```

The option-quantity/override portion is target behavior; today's implementation selects each option at most once. The API currently requires positive product/variant prices up to `9999999999.99`, accepts nonnegative fixed modifier adjustments, and returns two-decimal EGP strings. Keep `common/money/` arithmetic. Ingredient cost, unit conversions, taxes, discounts, fees, and new currencies must not be inferred from this formula.

```text
RECIPE requirements per sellable unit
  = selected variant's complete recipe (or simple product recipe)
    + sum(effective modifier effects * optionQuantity)

DIRECT requirements per sellable unit
  = mapped Stock Item consumption quantity, normalized to its base unit

order requirements
  = sum(requirements per sellable unit * orderedLineQuantity)
    consolidated by merchant + warehouse + item + condition
```

Backend validation must cover product/variant ownership, assignment and option membership, variant availability, distinct counts, quantity caps, units, final consumption, and authoritative pricing. The existing quote request's `groupId` is a **product assignment ID**; the separate `modifierGroupId` is the shared definition ID. Preserve this distinction across all new contracts and migrations.

The unscoped legacy `/catalog/products/:id/quote` route also exists. Storefront orders and new public flows must use slug-resolved merchant scope; do not model a new stock or mutation API on an unscoped product lookup.

### Restaurant acceptance and cancellation

1. Persist an online order and its existing configuration/price snapshots. New recipe deduction must not occur at submission or kitchen start.
2. Route it to the correct branch and permit an authorized cashier to explicitly accept it. POS must reload persisted orders after reconnect; realtime is optional signaling.
3. Resolve that branch's valid Default Consumption Warehouse. Apply merchant stock policy to consolidated requirements.
4. Commit acceptance and recipe movements in one transaction exactly once. Missing warehouse, denied access, or insufficient stock must produce a defined failure with no partial acceptance/deduction.
5. Kitchen preparation is permitted only after acceptance. A persisted preparation-start event/transition is required before enforcing the no-cancel-after-start rule; today's `accepted` status does not mean preparation started.
6. Before preparation, an authorized employee decides whether eligible cancellation restores deducted stock. Record actor, decision, and movements; restore from **actual original deductions**, never recompute from a later edited recipe. Repeated restoration cannot add stock twice.
7. Once kitchen preparation starts, restaurant cancellation is prohibited under the supplied requirement. Rejection of a pending order is different from cancellation of an accepted order.
8. DIRECT restaurant items, mixed DIRECT/RECIPE orders, walk-in POS, and retail sale timing require IC-D08. Do not apply the restaurant recipe event to every sale without a decision.

Recipe snapshots/versioning are DEFERRED. Existing sale price/selection snapshots remain mandatory. If recipe, mapping, assignment, or option identities change between placement and acceptance, the consumed configuration and permitted edit rules require IC-D06. Snapshot deferral does not authorize choosing current recipes silently.

### Returns

Retail sales returns can accept/reject lines and quantities independently. Accepted return and restocking into Available are separate choices; returned goods may be Non-Sellable. Link quantities to original sales and previous returns. Financial refunds, restock/no-restock physical handling, approval stages, and supported rollout require IC-D10. Do not disguise returns as free-form stock adjustments.

## Actors, contracts, and transaction safeguards

Current authorization is Owner/Admin sessions with tenant-scoped owner guards. Reuse `OwnerGuard` / `CurrentOwner`; derive merchant identity from the actor. Current activity metadata and first-month activation are not staff RBAC or full commercial entitlements.

An owner-managed registry can be designed before staff permissions. Cashier acceptance, branch stock access, and employee inventory operations cannot ship until their real authorization rules exist. Do not invent role names or bypass branch scope to complete the UI.

New contracts belong in `packages/contracts/src`, with root exports retained; no NestJS/Prisma dependencies. Decide paths and payloads per slice rather than treating conceptual entities as a fixed endpoint list. Required operation families are item/UOM configuration, warehouses/policy, balances/history, purchases, product mappings/recipes, consumption calculation, and later inventory operations/order actions.

Every mutation must scope IDs and relations by merchant; branch/warehouse access is additional. Use composite tenant constraints, exact quantity arithmetic, bounded lists/cursor pagination, revision checks for editable configuration, attributable writes, and source-scoped idempotency. Reusing an operation key with a different payload must fail. Order stock helpers receive the active transaction; no nested independent commits. Explicitly test concurrent first-balance creation, duplicate source actions, shortages, rollback, and consolidated shared-item requirements.

## Migration and compatibility plan — PROPOSED

1. Add stock foundations without changing existing product/quote/order behavior. Use new migrations; never rewrite an applied migration.
2. Agree unit precision, warehouse ownership, merchant policy default, inventory mode/completeness, and migration mapping before imposing constraints.
3. Do not infer a Stock Item, quantity, warehouse, or recipe from product names, attributes, SKU, or null stock. Existing variant counters do not reveal received stock or ingredient composition.
4. Inventory activation needs an explicit cutover plan for pending legacy reservations. The counter is already reduced by those reservations; copying it as an unquestioned opening balance can lose or duplicate stock. Inventory ledger and legacy counter must not both deduct one sale.
5. Preserve product/variant/assignment/option identities. Legacy modifier writes and option replacement can recreate identities; future recipe effects and waiting orders need deliberate handling.
6. Extend option quantity/override transport compatibly; old selections mean quantity 1. Persist quantity and effective prices/effects needed by the relevant history, and update SQL report aggregation to account for repeated selections.
7. Preserve historical order snapshots, null legacy breakdown/identity fields, and deletion protections. No recipe snapshot table is approved by this plan.
8. Test additive migrations on disposable empty and representative pre-feature databases. Reconcile opening balances, pending orders, backfills, rollout gates, and rollback behavior before enabling new deduction. Never reset the configured development database for this work.

## Frontend delivery boundaries

- **Merchant Dashboard:** extend `ProductBuilderPage.tsx`; add mode selection, DIRECT mapping, recipe ingredient rows, item/unit selection and inline creation, variant-specific controls, and a review of effective consumption. Inline item creation must preserve the product draft on failure/cancel and explain that no stock was received.
- **Inventory workspace:** item/warehouse setup, balances/history, and M3 purchase entry/confirmation are implemented. Remaining operational actions and detailed future screens follow later slices; do not use mock operational balances.
- **Storefront:** extend the existing customizer/cart/checkout for variant availability and repeated modifier quantity, backend re-quoting, stale configurations, and acceptance shortages. Do not expose internal recipe editing or trusted inventory totals in customer payloads.
- **POS:** build on the existing shell only after branch/staff authorization and order routing exist. Cashier acceptance uses Orders and shared consumption/pricing, not local state as stock authority.
- Follow shared UI, Arabic/English localization, RTL/LTR, loading/error/empty states, keyboard access, and revision-conflict recovery.

## Decision queue

Resolve decisions when the next slice depends on them; documentation and the source audit are complete without deciding all later workflows.

| Key    | Decision needed                                                                                                            | Existing fact / proposed handling                                                                                                                                                                        | Gates                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| IC-D01 | Quantity scale, conversion precision/dimensions, pack factors, policy default and condition applicability                  | M1 confirms six decimal places, exact g/kg and ml/l conversions, item packs, and no rounding; M2 sets Allow Negative default for Available debits, with Non-Sellable separate.                           | Recipe/movement integration.                     |
| IC-D02 | Warehouse/branch relationships, minimum Branch scope, default warehouse validity, access and deactivation                  | M2 sets one branch per warehouse and one default consumption warehouse per branch; owner-only management is implemented. Staff/branch rights and future missing-default handling remain open.            | Staff authorization and consumption integration. |
| IC-D03 | Meaning/location of modifier Default Price; shared default versus product assignment precedence; override editing          | Preserve current assignment prices. Propose product-assignment defaults plus variant overrides; shared defaults remain undecided.                                                                        | Modifier pricing extension.                      |
| IC-D04 | Activity mode defaults, editor authority, future default changes                                                           | Activity metadata has no inventory defaults. Do not guess values or retroactively convert products.                                                                                                      | Mode configuration/backfill.                     |
| IC-D05 | Legacy/null stock mapping, incomplete configuration saving/selling, mode switches and deletion                             | Existing simple products and untracked variants are valid. Inventory mode is distinct from readiness; no `NONE`.                                                                                         | Product inventory activation.                    |
| IC-D06 | Recipe/configuration changes while order waits; retained identities and failure/revalidation                               | Recipe snapshot deferred. Compare edit locks, explicit conflict/review, or another agreed rule before acceptance integration. Preserve historical sale prices.                                           | Live recipe deduction.                           |
| IC-D07 | Effect override merge/replace, empty override, negative totals, DIRECT modifier effects, restricted defaults               | No existing effects. Explain alternatives before implementing; reductions cannot silently create stock.                                                                                                  | Modifier consumption.                            |
| IC-D08 | DIRECT/walk-in timing, mixed orders, shortages/retry UX, acceptance/preparation/cancel states and actor scope              | Only recipe-on-restaurant-acceptance is supplied as settled. Existing pending reject restores old counters.                                                                                              | Order/POS integration.                           |
| IC-D09 | Stocktake concurrency and stale counts                                                                                     | No stocktake exists. Choose locking, cutoff/reconciliation, or explicit conflict/recount.                                                                                                                | Stocktaking.                                     |
| IC-D10 | Purchasing fields/suppliers, return stages and cumulative quantities, restock conditions, reversal/refund responsibilities | M3 resolves the supplier directory, optional supplier invoice number, immutable quantity receipt, and excludes costs/tax/settlement. Return stages, limits, restock, and correction details remain open. | Returns/corrections.                             |
| IC-D11 | Employee permission matrix and branch/warehouse rights; capability versus entitlement                                      | Only owner/admin authorization exists. An owner-only management slice must be explicit; cashier release still depends on staff scope.                                                                    | Operational permissions and POS.                 |

Broader shared-definition propagation, taxes, discounts, cost valuation, channel pricing, refunds, and launch packaging remain separate decisions. Base price precedence, EGP two-decimal arithmetic, reusable assignments, and the existing shared-edit restriction do not need to be rediscovered as OPEN.

## Acceptance scenarios

These retain the supplied specification's `AC-xx` mapping. They are future acceptance targets; the audit tests in `PROGRESS.md` prove only existing behavior.

| Source ID | Scenario and expected outcome                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| AC-01     | Three DIRECT six-packs sharing a bottle Stock Item require 18 bottles.                                                  |
| AC-02     | Black/L consumes its mapping; Black/M is unaffected.                                                                    |
| AC-03     | Two products sharing one item affect the same warehouse balance.                                                        |
| AC-04     | Variant recipe plus Extra Cheese ×2 scales correctly by ordered line quantity.                                          |
| AC-05     | One modifier effect touching two items includes both requirements.                                                      |
| AC-06     | Variant-specific recipe effects follow the decided override rule, including explicit empty overrides.                   |
| AC-07     | Effective variant modifier price is multiplied by option quantity; baseline variant base price remains authoritative.   |
| AC-08     | Options A ×3 and B ×2 satisfy a two-distinct-option maximum when individual caps allow them.                            |
| AC-09     | Foreign/inapplicable group, option, product, variant, or unit references fail server validation.                        |
| AC-10     | Saving/editing a Draft invoice leaves stock unchanged.                                                                  |
| AC-11     | Replayed/concurrent invoice confirmation increases stock exactly once.                                                  |
| AC-12     | A direct transfer commits balanced OUT/IN once; partial failure rolls back both.                                        |
| AC-13     | Cross-tenant item linking/warehouse transfer makes no mutation.                                                         |
| AC-14     | Full/partial stocktake changes only its confirmed scope under the agreed concurrency rule.                              |
| AC-15     | Available ↔ Non-Sellable preserves total physical stock.                                                                |
| AC-16     | Write-off removes physical stock once and preserves provenance.                                                         |
| AC-17     | Partial supplier return removes the selected condition and retains original invoice/line linkage and cumulative bounds. |
| AC-18     | Merchant Allow/Prevent Negative applies consistently under the approved operation/condition policy.                     |
| AC-19     | Pending restaurant order triggers no new recipe deduction or kitchen authorization.                                     |
| AC-20     | Authorized branch cashier acceptance deducts consolidated recipe requirements once from the default warehouse.          |
| AC-21     | Eligible authorized cancellation restores actual deducted quantities at most once when requested.                       |
| AC-22     | Restaurant preparation-start state prevents cancellation.                                                               |
| AC-23     | Retail return approval is per line; resale restocking and refunds remain separate.                                      |
| AC-24     | Tenant/branch permissions and backend-derived prices cannot be bypassed by forged input.                                |

Additional regression cases: fractional conversions without drift; shared-item aggregation across lines; invalid/zero quantities; duplicate option payloads; concurrent sells/transfers; idempotency payload mismatch; current revision conflicts; missing/default foreign warehouse; no automatic opening stock; incomplete legacy data; mode-switch/pending-order safety; option quantity snapshots/reporting; catalog edits after sale; no double deduction across cutover. Real concurrent database tests are required: the existing rollback integration fixtures do not prove independent-transaction races.

## Deferred and excluded behavior

- Batch/Lot/Expiry/FEFO: explicitly withdrawn from this iteration, including the supplied earlier `INV-22` decision.
- Recipe snapshots/versioning and prepared/semi-finished production inventory.
- Base-recipe inheritance, variant inventory-mode overrides, and a `NONE` mode.
- Separate Goods Receipt and in-transit transfer workflows.
- Offline POS, payment gateway integration, full accounting/cost valuation, supplier financial settlement.
- Full KDS, printing/hardware, delivery dispatch, marketplace, serial/IMEI, weighted retail checkout, and complete future-industry flows.
- Automatic variant combination generation, bundles, and generic executable rules engines.

## Definition of done for an implementation slice

1. Extend the audited owner/module and record the exact supported behavior and relevant IC decisions.
2. Finalize the contract, tenant/branch boundary, transaction/idempotency strategy, migration/backfill, and UI scope before critical persistence changes.
3. Verify meaningful calculation, permission, invalid-reference, race/rollback, and compatibility cases at the appropriate layer.
4. Follow API rules for affected lint/typecheck/build/default tests and database suites; use repository Node 24.11.1. Follow installed Turbo/Next documentation if their commands/configuration are changed.
5. Check Arabic/English builder and order journeys, browser acceptance, and failure/retry behavior where UI is delivered.
6. Record actual files, migration state, commands/results, remaining limitations, and diff/commit evidence in [PROGRESS.md](PROGRESS.md). Do not mark a requirement TESTED because a baseline test or a document exists.
