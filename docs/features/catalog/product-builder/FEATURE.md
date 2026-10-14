# Dynamic Product Builder — Feature Contract

## Status

- Document status: Active implementation contract
- Feature area: Catalog, Configurator, Pricing, Orders, and report-ready sales data
- Primary applications: `apps/api`, `apps/merchant-dashboard`, and `apps/storefront`
- Supporting packages: `packages/database` and `packages/contracts`
- POS status: Integration boundary only; the current POS has no catalog or sale workflow
- Last updated: 2026-10-14

## Objective

Evolve Waffarly's existing Product Builder into a production-oriented, tenant-safe, generic configuration system that supports restaurant products now without creating a restaurant-only domain model.

The implementation must support:

- Simple products with no variants or modifiers.
- Optional sellable variants with their own authoritative prices.
- Optional SKU, barcode, and stock fields on variants.
- Structured, generic variant attributes such as Size and Color.
- Reusable tenant-owned modifier groups and options.
- Product-specific modifier-group assignments and selection constraints.
- Product-specific fixed modifier adjustments/defaults stored on assignments; legacy prices move with their old product assignment.
- Authoritative backend configuration validation and pricing.
- Immutable, report-ready order snapshots.
- Parent-product storefront presentation with selectable variants.

This is an implementation contract. `PROGRESS.md` is the step-by-step execution record for this file.

## Non-Negotiable Rules

1. Read this file and `PROGRESS.md` before changing Product Builder code.
2. Follow the root and nested `AGENTS.md` instructions. Read installed framework documentation before changing Turborepo or Next.js configuration or commands.
3. Inspect `git status` before each implementation slice and preserve unrelated user changes, especially the existing storefront worktree changes.
4. Do not create activity-specific product models such as `PizzaProduct`, `BurgerProduct`, or `ClothingProduct`.
5. A product may have no variants, variants only, modifiers only, or both variants and modifiers.
6. A variant never requires SKU, barcode, stock, or inventory tracking.
7. Modifiers customize a configured product. They must not generate variants automatically.
8. Modifier group definitions are tenant-owned and reusable. Product assignment must use a relation rather than copying the definition.
9. The backend owns configuration validity and prices. Client-supplied prices or totals are never authoritative.
10. Every tenant-owned lookup and relationship must be scoped and constrained by merchant identity.
11. Catalog edits must not rewrite or invalidate historical order facts.
12. Stable IDs and structured relationships must be retained for reporting; display-name parsing is not an acceptable reporting model.
13. Do not invent branch pricing, channel pricing, taxes, discounts, delivery fees, option quantities, conditional modifiers, or inventory rules.
14. Do not implement destructive or cross-product shared-group editing semantics until the relevant publishing policy is approved.
15. Do not mark work complete without tests and verification evidence in `PROGRESS.md`.

## Sources of Truth

When sources conflict, use this priority:

1. Explicit product-owner decisions in the Product Builder brief.
2. `PROJECT_OVERVIEW.md`, `MVP_SCOPE.md`, and approved decision documentation after superseded statements are corrected.
3. Database constraints, shared contracts, backend authorization, and existing tests.
4. This feature contract.
5. Existing UI behavior where it does not conflict with the sources above.

The following decision supersedes older statements that variants require stock implications or that reusable modifier groups are deferred:

> Optional Product Variants do not require SKU, Barcode, or Stock. Restaurant product sizes may be represented as Variants. Modifier Groups are reusable across products.

## Pre-Implementation Repository Baseline

This section records the repository state audited before the implementation described by this contract. It is historical context; use the implementation contract and `PROGRESS.md` for the current target/status.

The repository already implements a meaningful first slice:

- `Product` has base price, availability, images, categories, and a piece selling unit.
- `ProductVariant` is optional and already supports independent price plus nullable SKU, barcode, and stock quantity.
- Product-local modifier groups/options support single or multiple selection, minimum/maximum counts, defaults, fixed EGP adjustments, and ordering.
- Catalog quote endpoints validate variants and modifier choices and calculate fixed-precision totals.
- Storefront checkout re-quotes each line and never accepts client prices.
- Orders snapshot product, variant, modifier names, and prices.
- Merchant Product Builder and storefront configurator surfaces already exist.
- Owner order acceptance/rejection exists, but persisted branches and branch-scoped cashier routing do not.
- The POS application is currently a placeholder without catalog or order-sale behavior.

The principal gaps are:

- Modifier groups are owned by one product rather than reusable.
- Variants are flat named records without structured attribute dimensions and values.
- Order modifier snapshots do not retain stable group/option IDs.
- Order variant snapshots do not retain structured attribute values.
- No report query aggregates sales by variant or variant attribute.
- Product edits currently replace modifier and variant children wholesale.
- Documentation still contains superseded statements that reusable modifier groups are deferred.

## Domain Boundaries

### Catalog

Owns mutable merchant catalog definitions:

- Product
- Product Variant
- Variant Attribute Definition
- Variant Attribute Value
- Variant-to-Attribute-Value selection
- Modifier Group
- Modifier Option
- Product Modifier Group Assignment

### Configurator

Validates a requested configuration:

- Product is sellable in the resolved merchant context.
- Required variant selection is present when the product has variants.
- Variant belongs to the product and merchant.
- Attribute selections attached to the variant are internally valid.
- Modifier group is assigned to the product.
- Modifier option belongs to the selected group and merchant.
- Selection constraints and defaults are applied consistently.

### Pricing

Resolves the authoritative unit price from the validated configuration:

```text
effective base price = selected variant price, otherwise product base price
unit price = effective base price + supported modifier adjustments
line total = unit price × item quantity
```

No executable rules engine is authorized. Taxes, discounts, fees, contextual price overrides, option quantities, and conditional rules remain separate future capabilities.

### Orders

Own immutable purchased facts and display snapshots. Order rows may retain catalog IDs for analysis, but historical readability and totals must not depend on mutable catalog rows remaining present.

### Reporting

Reads structured purchased identities and snapshots. This feature provides report-ready storage, aggregation queries/services, and tests. It does not approve a full analytics dashboard.

### Inventory

Remains separate. The existing nullable variant stock counter and storefront reservation behavior may be preserved for compatibility, but variants without stock remain fully valid. No new stock ledger, recipe, or ingredient behavior is part of this feature.

## Target Data Model

Final Prisma names may follow repository conventions, but the responsibilities below are required.

### Product

- Belongs to one merchant.
- Keeps stable product identity and existing core information.
- Retains base price as the price for a simple product.
- May have zero or more variants.
- May have zero or more modifier-group assignments.
- Does not contain activity-specific fields.

### Product Variant

- Belongs to one product and merchant.
- Has stable identity, name, independent authoritative price, availability, and ordering position.
- SKU, barcode, and stock quantity remain nullable.
- May select zero or more structured attribute values.
- Existing flat variants remain readable during migration.
- Is referenced by order-line snapshots for reporting.

### Variant Attribute Definition

- Belongs to one product and merchant in the initial implementation.
- Defines a generic dimension such as Size, Color, or Storage.
- Has a stable ID, merchant-safe product relationship, display name, and position.
- Must not contain special behavior for a dimension named `Size`.

### Variant Attribute Value

- Belongs to one attribute definition, product, and merchant.
- Defines a selectable value such as Small, XL, Black, or 256GB.
- Has a stable ID, display value, and position.

### Variant Attribute Selection

- Joins a persisted variant to an attribute value.
- Prevents duplicate values from the same definition on one variant.
- Enforces product and tenant consistency through database constraints and backend validation.
- Supports multiple dimensions without requiring automatic Cartesian-product generation.

### Modifier Group

- Belongs to one merchant, not one product.
- Has stable identity, name, description, lifecycle state, and options.
- Can be assigned to multiple products owned by the same merchant.
- Cannot be attached across tenant boundaries.

### Modifier Option

- Belongs to one modifier group and merchant.
- Has stable identity, name, and display position. Fixed price adjustments and default-selection state are stored on the product assignment, not on the shared option definition.
- Does not become a variant merely because it changes price.

### Product Modifier Group Assignment

- Joins a product to a reusable modifier group within the same merchant.
- Owns product-specific position, selection mode, minimum selections, maximum selections, each option's fixed price adjustment, and its default-selection flag.
- Unlinking deletes only the assignment, never the shared group or its other assignments.
- Per-option availability overrides and variant-specific price rules are not implemented; every option in the shared definition remains available to each assignment in V1.

### Order Snapshot Extensions

New orders must preserve:

- Product and optional variant stable IDs already present on the order line.
- Product and variant display-name snapshots.
- Effective base price, modifier total, unit price, quantity, and line total.
- Structured variant attribute definition/value IDs plus display-name snapshots.
- Modifier group and option IDs plus name, position, and price-adjustment snapshots.

Snapshot ID columns must not use destructive foreign-key behavior that prevents catalog cleanup or mutates history. Existing order rows must remain readable; new snapshot identity fields may be nullable for pre-migration records when no reliable backfill exists.

## Migration Strategy

The database migration must preserve existing products and orders.

1. Add reusable modifier group structures and product assignment structures without dropping existing data first.
2. Convert each existing product-local group into a tenant-owned shared definition with one assignment to its original product.
3. Preserve group and option IDs where the migration can do so safely, minimizing broken saved configurations.
4. Move selection constraints and product ordering to the assignment record.
5. Add generic variant attribute tables without forcing artificial attributes onto existing flat variants.
6. Add nullable stable modifier snapshot IDs and structured attribute snapshot storage to order lines/selections.
7. Verify row counts, tenant ownership, assignment counts, option counts, and historical-order readability before removing obsolete columns or constraints.
8. Keep migration SQL deterministic and safe for databases containing existing catalog and order data.

An irreversible drop must not occur in the same logical step as an unverified data transformation unless the migration contains explicit assertions or the repository's migration approach provides an equivalent safety boundary.

## Backend Requirements

### Modifier library

The owner API must support:

- Listing the signed-in merchant's reusable groups with options and assignment counts.
- Creating a group and its options within the signed-in merchant.
- Reading a group without exposing other tenants.
- Assigning an existing owned group to an owned product.
- Updating assignment constraints and position.
- Detaching a group from one product without affecting other assignments.
- Rejecting duplicate assignment and cross-tenant references.

Permanent deletion and edits that change multiple linked products remain governed by the unresolved shared-editing policy. Until approved, the implementation must not silently propagate destructive changes or create copies.

### Product write model

- Product create/update accepts simple products and optional variants.
- Structured attributes and variant selections are validated atomically.
- Assignment IDs are used instead of nested duplicated modifier definitions after migration.
- Revision/concurrency checks remain in force.
- Existing compatible clients receive an intentional migration path; accidental dual write models are not allowed.

### Quote/configuration service

- Public and authenticated channels reuse one backend validation/pricing implementation.
- Variant IDs are checked against product and merchant ownership.
- Group assignments, option ownership, selection bounds, duplicates, and unknown IDs are checked.
- Defaults, if retained, are applied consistently and documented.
- Money remains fixed-precision decimal data and decimal strings at API boundaries.
- Quote responses include resolved stable IDs, product revision, price breakdown, and structured variant attributes.

### Order creation

- Re-quotes every item immediately before persistence.
- Does not accept an authoritative price from the client.
- Persists the expanded immutable snapshots in the same transaction as the order.
- Preserves existing stock reservation compatibility without making stock mandatory.
- Does not alter cashier acceptance states or add unapproved fulfillment states.

### Reporting query

Provide a tenant-scoped service/query that can aggregate at least:

- Quantity sold by product and variant.
- Quantity sold by attribute definition/value where structured snapshots exist.
- Optional modifier selections by stable option ID.
- Date range and merchant scope where supported by the current order data.

Legacy rows with missing structured IDs must be reported as legacy/unclassified rather than inferred by parsing names.

## Contract Requirements

Shared contracts in `@waffarly/contracts` are the only cross-application catalog contract definitions.

Contracts must distinguish:

- Mutable reusable modifier definitions.
- Product modifier assignments and selection constraints.
- Variant attribute definitions and values.
- Persisted sellable variants and their selected attribute values.
- Configuration request selections.
- Authoritative quote responses.
- Order snapshot responses.
- Report aggregation responses if an endpoint is exposed.

Money remains a decimal string. Tenant IDs and authoritative price inputs must not be accepted from public clients.

## Merchant Dashboard Requirements

The existing Product Builder must evolve incrementally and continue using the current design conventions.

Required flow:

1. Basic information: name, description, categories, images, availability, and base price.
2. Selling configuration: simple product or optional variants; initial UI may focus on one dimension such as Size.
3. Modifier groups: create a reusable group, choose an existing group, configure assignment constraints, and detach without deleting.
4. Pricing review: show product/variant prices and supported fixed modifier adjustments without treating the preview as authoritative.
5. Preview: show the parent product, starting price, variant choices, modifier groups, and expected customer structure.

SKU, barcode, and stock inputs must be visibly optional. The primary restaurant workflow must not force merchants to enter them.

Shared-group screens must show usage count or linked products before any future cross-product edit capability is introduced.

## Storefront Requirements

- Continue listing one parent product card.
- Show `Starting from` the lowest available variant price when variants exist.
- Require a valid variant when the product has variants.
- Render variant choices from structured data without hardcoding Size.
- Render only modifier groups assigned to the product.
- Request authoritative quotes after relevant configuration changes.
- Re-quote on checkout and handle stale or invalid saved selections.
- Never submit or trust a client-computed price.

Existing uncommitted storefront redesign work must be preserved and integrated carefully rather than replaced.

## POS Boundary

The POS app currently has no catalog selection or sale workflow. This feature will keep the contracts and configurator channel-neutral, but it will not invent a POS checkout, employee authorization model, branch selection, receipt flow, or cash handling behavior.

POS integration becomes executable after those surfaces and rules exist. This is a documented dependency, not a reason to duplicate catalog logic inside POS.

## Tenancy and Security

- All reusable groups, options, attributes, values, assignments, variants, products, and reports are scoped by merchant.
- Composite unique keys and foreign keys should enforce tenant-safe relationships where Prisma/PostgreSQL support them cleanly.
- Backend services must include merchant criteria in reads and mutations; frontend filtering is never authorization.
- Forged group, option, variant, attribute value, product, or assignment IDs must be rejected without leaking another tenant's data.
- Public quote/order access must resolve the product through the storefront merchant slug.
- Transactions protect multi-record product configuration writes and order snapshots.
- Nullable SKU/barcode uniqueness remains merchant-scoped and must be validated against PostgreSQL null semantics.

## Confirmed Decisions

- Variants are optional.
- Variant SKU, barcode, and stock are optional.
- Restaurant sizes may be variants with independent prices.
- Variants and modifiers have different responsibilities.
- Modifier groups are true reusable merchant-owned definitions.
- A product-group association stores product-specific selection configuration.
- The backend is authoritative for validation and pricing.
- Storefront catalog presentation uses one parent product with choices beneath it.
- Historical order data remains immutable and reportable.
- No automatic generation of every modifier or attribute combination.

## Open Decisions and Safe Boundaries

| Decision | Current boundary |
| --- | --- |
| Shared-group edit publishing/propagation | V1 rejects definition edits while any product is assigned. Owners may detach assignments, edit an unused definition, then attach it again. Do not implement propagation, copying, or review workflows until approved. |
| Shared option price versus product-specific price | V1 stores the fixed adjustment and default-selection flag on each product assignment. This preserves product-local legacy values while allowing one shared option definition to have different product pricing. Variant-specific overrides remain out of scope. |
| Variant-specific modifier prices | Deferred; no schema or executable rule is required now. |
| Branch/channel price overrides | Deferred. Keep pricing service boundaries extensible. |
| Conditional modifiers and dependencies | Deferred. |
| Option quantities | Deferred. Each option is selected at most once in the current model. |
| Modifier/option permanent deletion | Unlinking is supported. Permanent deletion and historical-reference policy require a final rule; do not cascade through orders. |
| Branch-scoped orders | Blocked by the absence of a persisted Branch domain and branch selection rules. Preserve existing owner acceptance behavior. |
| POS configuration UI | Blocked by the absence of a POS catalog/sale flow. Reuse contracts when that flow is approved. |
| Advanced multidimensional builder UI | Deferred. The relational model supports it; the restaurant UI may start with one dimension. |

The V1 assignment-pricing behavior is an implementation choice made to preserve existing product-specific prices while making definitions reusable. It is surfaced here rather than treated as an approved pricing policy for future pricing modes.

## Explicitly Deferred Capabilities

- Complete clothing, electronics, or supermarket workflows.
- Automatic Cartesian-product variant generation.
- General inventory, recipes, ingredients, batches, expiry, serial numbers, or warranty behavior.
- Weighted checkout and fractional quantity rules.
- Bundles and combos.
- Conditional/nested modifiers.
- Product-, branch-, channel-, or time-specific option prices.
- Taxes, discounts, delivery charges, and payment gateways.
- New order states, kitchen flows, notification infrastructure, or automatic acceptance.
- Full analytics dashboard.
- Event buses, microservices, queues, or a general rules engine.

## Required Test Coverage

### Products and variants

- Create and quote a product with no variants.
- Create and quote a product with Size variants.
- Create variants without SKU, barcode, or stock.
- Reject a missing, unavailable, sold-out tracked, foreign-product, or cross-tenant variant.
- Persist and return structured attribute values.
- Prevent invalid cross-product attribute selections.

### Reusable modifiers

- Create a reusable group and options.
- Assign one group to multiple products in one tenant.
- Detach it from one product without changing the other.
- Reject another tenant's group, option, product, or assignment IDs.
- Reject duplicate assignments and invalid options.
- Validate required/optional, single/multiple, minimum, maximum, duplicate, and default selection behavior.

### Pricing

- Quote a simple product.
- Quote a selected variant.
- Quote variant plus modifier adjustments.
- Verify fixed-precision totals.
- Reject supplied or manipulated prices at order creation.

### Orders and reporting

- Preserve product, variant, attribute, group, and option IDs plus name/price snapshots.
- Confirm catalog edits do not change existing order snapshots or totals.
- Aggregate quantities by variant and attribute value.
- Keep legacy unclassified rows explicit.
- Keep reporting tenant-isolated.

### Compatibility and UI

- Existing products remain readable after migration.
- Existing compatible quote and storefront flows continue to work or are intentionally migrated.
- Product Builder supports simple and variant products with optional identifier/stock fields.
- Storefront parent-product configuration remains responsive and accessible.
- Existing order acceptance behavior remains intact.

## Definition of Done

The feature is complete only when:

1. Schema changes and migrations preserve existing catalog/order data.
2. Prisma validation and generation pass.
3. Shared contracts compile and all consuming applications use them.
4. Backend authorization, configuration validation, pricing, and snapshots meet this contract.
5. Merchant Dashboard and Storefront supported flows are implemented.
6. Report-ready aggregation is implemented and tested.
7. Relevant unit, API, database, UI, typecheck, lint, and build commands pass, with exact evidence recorded in `PROGRESS.md`.
8. Superseded documentation is corrected and unresolved decisions remain explicitly open.
9. No unrelated user changes are overwritten.

## Change Control

If implementation reveals a conflict with this contract:

1. Stop the affected slice.
2. Record the conflict and evidence in `PROGRESS.md`.
3. Update this contract only when the resolution follows an approved product decision.
4. Resume implementation from the first affected checkpoint.

