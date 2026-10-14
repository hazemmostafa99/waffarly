# Catalog & Dynamic Product Builder Overview

**Status:** Discovery baseline; first backend Catalog slice and local-disk image upload MVP implemented

**Last updated:** 2026-10-14
**Scope:** Shared Product Core, restaurant-first implementation, future cross-activity extensibility  
**Sources:** [Project Overview](../../../PROJECT_OVERVIEW.md), [Restaurant MVP Scope](../../../MVP_SCOPE.md), [Technical Decisions](../../architecture/TECHNICAL_DECISIONS.md), and existing feature specifications under `docs/features/`

## 1. Purpose and Current State

The Catalog domain will define the merchant-owned products that Waffarly can present and sell through supported channels. Its central architectural goal is a reusable, configuration-driven Product Core that can represent ordinary product structures across business activities without duplicating Catalog or Pricing for each industry.

The first implementation is intended to focus on restaurants in Egypt. That delivery focus must not introduce restaurant-only fields or assumptions into the shared Product Core. Future activities may reuse the generic capabilities when they fit, and may add separate activity extensions when their operational semantics are genuinely different. Extensibility does not mean that every future industry can be enabled through data configuration alone.

### 1.1 Repository inspection: implemented versus planned

The first backend Catalog slice is now implemented; the following capabilities remain outside it:

- The Catalog NestJS module now exposes owner-scoped Media upload/registration/listing, Category management, and Product management APIs. The basic slice includes tenant-safe references, optimistic revisions, archive/restore management, shared API contracts, bounded EGP/image validation, and configurable local-disk image storage. Variants, modifiers, selling units, pricing, inventory, orders, public product listing, configurator, and POS selection are not implemented.
- The Prisma schema now contains tenant-owned MediaAsset, Category, Product, ProductImage, and ProductCategory models. Pricing, inventory, and order entities remain absent.
- The Merchant Dashboard now exposes the first owner Catalog workspace for Media references, Categories, and Products. Public Storefront and POS projections still render no persisted catalog.
- The public Next.js application is an onboarding/marketing shell. It does not resolve or render a merchant catalog.
- The POS application is a placeholder workspace with no sales or catalog behavior.
- The backend currently provides Super Admin, authentication, merchant application, monthly plan, activity/module metadata, storefront-design behavior, and the first `catalog` module slice. It has no `pricing` module.
- `Merchant` is the implemented tenant boundary. Owner authentication and first-month activation are enforced, but employee roles, granular permissions, branches, plan entitlements, and catalog-specific authorization are not implemented.

The project documentation already confirms the platform vision of configurable products and backend-authoritative validation/pricing. Detailed Catalog rules, feature scope, database relationships, pricing semantics, inventory effects, and publication lifecycle remain unapproved.

## 2. Decision Status and Source Reconciliation

| Status        | Meaning in this document                                                                      |
| ------------- | --------------------------------------------------------------------------------------------- |
| **CONFIRMED** | Explicit product or architectural direction already stated by the owner or source documents.  |
| **PROPOSED**  | Recommended feature or boundary that requires approval before implementation.                 |
| **OPEN**      | A business or architectural decision is required before the affected design can be finalized. |
| **DEFERRED**  | Intentionally outside the restaurant MVP or postponed until a later feature decision.         |

This document records discovery and reconciliation. It does not amend the root source documents. The current backend slice is tracked separately from the deferred UI, Storefront, Pricing, Inventory, and activity extensions.

### 2.1 Conflicts and qualifications found

1. **Feature ID collision.** `PROJECT_OVERVIEW.md` and `MVP_SCOPE.md` already use `CAT-01`, `CAT-02`, and `CAT-03` for broader groups. The eight IDs in the new candidate inventory therefore cannot be adopted unchanged. This overview uses temporary detailed IDs `CAT-F01` through `CAT-F08`; final IDs remain OPEN.
2. **Release scope wording conflicts.** `MVP_SCOPE.md` still identifies restaurants as the first MVP activity, while later scope-correction text and the current implementation recognize several merchant activity keys. For this domain, the governing interpretation is: the Product Core is cross-activity, the first Catalog implementation is restaurant-focused, and future-industry operational features are not included now.
3. **Activity registry documentation is stale.** The Business Activities & Modules specification describes restaurants as the sole implemented activity, while the current code registry includes restaurant, clothing, supermarket, and other. This is an existing documentation/implementation mismatch. It does not mean that Catalog behavior for those future activities exists.
4. **Catalog module registration is absent.** The activity/module registry currently exposes only merchant profile and storefront design. A future Catalog capability must not be inferred as enabled, entitled, or authorized merely because this discovery document exists.
5. **Authorization foundation is incomplete for Catalog.** The current owner session is tenant-scoped, but staff permissions, branch scope, and commercial entitlements remain separate unresolved domains. Initial Catalog analysis must state which actor can perform each action without pretending those systems already exist.

## 3. Confirmed Requirements and Architectural Principles

The following requirements govern all future Catalog feature specifications:

1. **CONFIRMED — Shared Product Core.** Products must use one generic core across business activities. Ordinary customization must not require parallel restaurant, apparel, grocery, or electronics product implementations.
2. **CONFIRMED — Configuration-driven modeling.** The core must support product configuration through well-defined concepts such as variants, attributes, modifier groups/options, and selling units rather than activity-specific columns such as `burgerSize` or `shirtColor`.
3. **CONFIRMED — Backend authority.** The backend owns configuration validity, authorization, and authoritative price calculation. A client-provided price or apparently valid option selection is never sufficient authority.
4. **CONFIRMED — Clear concept separation.** Products, variants, attributes, modifiers, selling units, and stock concepts have different meanings and must not be collapsed merely because some examples look similar in a UI.
5. **CONFIRMED — Core plus extensions.** Activity-specific workflows belong in separate modules or extensions. Specialized behavior may require new code without forcing a redesign of ordinary Product Core concepts.
6. **CONFIRMED — Capability is not access.** Activity-module compatibility, subscription entitlement, tenant configuration, and user permission are independent checks. One cannot substitute for another.
7. **CONFIRMED — Restaurant-first delivery.** Restaurant Catalog behavior is the first implementation focus. Clothing stock matrices, grocery weight operations, electronics serials/warranties, and other future workflows are not authorized for implementation by this architecture.
8. **CONFIRMED — No premature schema.** Relationships, cardinalities, storage strategy, and Prisma models remain unfinalized until the feature questions are answered and a feature is explicitly approved.
9. **PROPOSED — Relational commercial core.** Stable identities, tenant ownership, sellable configurations, prices, selection constraints, and relationships should be relational. Validated JSONB may hold genuinely flexible descriptive metadata when its schema, versioning, querying, and migration behavior are defined.
10. **PROPOSED — Historical snapshots.** Orders should preserve the purchased name, configuration, quantity basis, and authoritative price result so later Catalog changes cannot rewrite past orders. The Orders domain owns the historical order record; Catalog/Pricing supplies validated data for that snapshot.

## 4. Generic Core versus Activity-Specific Extensions

### 4.1 Generic Product Core

The Product Core should express reusable commerce concepts:

| Concept                        | Generic responsibility                                                                                                                         | Must not be confused with                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Product**                    | Stable merchant-owned catalog identity and customer-facing information for an offering.                                                        | A stock balance, order line, or every possible customer choice.                                              |
| **Variant**                    | A merchant-defined sellable configuration whose identity may carry its own SKU, price reference, barcode, availability, or stock relationship. | A transient combination of modifiers chosen during ordering.                                                 |
| **Attribute definition/value** | Structured descriptive data or a dimension used to define variants, depending on an approved attribute role.                                   | Automatically stock-tracked inventory or customer-selected extras.                                           |
| **Modifier group**             | A rule-bearing group presented for customer or cashier selection, such as sauces or extras.                                                    | A variant dimension or inventory category.                                                                   |
| **Modifier option**            | A selectable member of a modifier group, potentially affecting configuration validity and price.                                               | A product variant merely because it has a price delta.                                                       |
| **Selling unit**               | The basis by which quantity is expressed and priced, such as piece or kilogram.                                                                | A stock item, package conversion, recipe ingredient, or unit of measure implementation by itself.            |
| **Stock item**                 | An Inventory-owned identity whose balances/movements can be tracked.                                                                           | Product identity. A product or variant may reference stock behavior only after Inventory rules are approved. |
| **Price/quote result**         | A server-calculated monetary result for a valid product configuration and context.                                                             | A client field, Catalog description, or inventory valuation.                                                 |

The same attribute label can play different roles. For example, “color” may be descriptive only for one product and variant-defining for another. That role must be explicit; storing arbitrary key/value pairs does not create correct variant semantics.

### 4.2 Activity-specific extensions

Extensions should own behavior that is not ordinary product description or configuration:

- Restaurant recipes, ingredients, preparation stations, kitchen routing, table service, and preparation instructions.
- Clothing exchange policies or specialized size-guide behavior beyond generic attributes/variants.
- Supermarket weighed-item capture, scale/barcode integrations, package conversions, batch expiry, and catch-weight reconciliation.
- Electronics serial-number lifecycle, warranty registration, compatibility rules, and installation workflows.

An extension may reference a Product, Variant, Modifier Option, or Stock Item through an explicit interface once approved. It should not fork the Product entity or create a second pricing engine. If a new requirement changes the meaning of quantity, price, or sellability for every channel, it may justify a Product Core or Pricing enhancement. If it affects only an activity workflow, it belongs in an extension.

## 5. Proposed Detailed Feature Inventory

The temporary IDs below avoid conflicts with the existing parent groups:

| Temporary ID | Feature                            | Status                                                                       | Responsibility and boundary                                                                                                                                                                                                                         |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CAT-F01**  | Categories                         | **Discovery selected; initial rules CONFIRMED**                              | Tenant-owned hierarchical organization and navigation of products. Exactly one required image, availability, archival, ordering, depth, and permission details are documented in the feature specification. Categories do not own price or stock.   |
| **CAT-F02**  | Products                           | **PROPOSED MVP candidate**; shared Product Core outcome **CONFIRMED**        | Product identity, basic merchant-authored content, and lifecycle entry point. Required fields, multi-image handling, draft/publication rules, deletion/archive semantics, and uniqueness are documented or remain OPEN.                             |
| **CAT-F03**  | Variants & Attributes              | **CONFIRMED platform capability**; restaurant MVP inclusion **OPEN**         | Represent variant-defining dimensions and descriptive properties without equating every attribute combination with a variant. SKU/barcode/price/stock implications remain OPEN.                                                                     |
| **CAT-F04**  | Modifier Groups & Options          | **CONFIRMED platform capability**; minimum restaurant rules **OPEN**         | Customer/cashier-selected configuration, including possible single/multiple selection and price effects. Defaults, min/max, quantities, reuse, dependencies, and inventory effects remain OPEN.                                                     |
| **CAT-F05**  | Selling Units                      | **CONFIRMED platform capability**; restaurant MVP inclusion **OPEN**         | Express quantity basis used by selling and pricing. Fractional quantities, precision, unit catalog governance, conversions, packaging, and measured-at-sale workflows remain OPEN.                                                                  |
| **CAT-F06**  | Pricing & Configuration Validation | Backend authority **CONFIRMED**; domain boundary and detailed rules **OPEN** | Validate a requested configuration and calculate an authoritative result. Pricing may become a separate backend domain; Catalog supplies definitions and constraints but must not duplicate quote logic across channels.                            |
| **CAT-F07**  | Product Availability & Visibility  | **PROPOSED**                                                                 | Determine whether products/configurations may be discovered or selected. Draft/publication, branch/channel/time availability, sold-out behavior, and Inventory interaction are OPEN. Visibility is not equivalent to stock availability.            |
| **CAT-F08**  | Storefront Product Configurator    | **PROPOSED MVP candidate**                                                   | Next.js customer experience driven by Catalog APIs and server validation. It renders definitions and selection errors but does not own configuration rules or price authority. POS may consume the same backend capabilities through a separate UI. |

### 5.1 Mapping to existing parent IDs

| Existing parent ID                                       | Detailed candidates                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CAT-01 — Categories and products` / `Menu/catalog CRUD` | CAT-F01, CAT-F02, and part of CAT-F07                                    |
| `CAT-02 — Dynamic Product Builder`                       | CAT-F03, CAT-F04, CAT-F05, and configuration constraints used by CAT-F06 |
| `CAT-03 — Product configurator and pricing`              | CAT-F06, CAT-F08, and contextual aspects of CAT-F07                      |

These mappings preserve existing references while allowing one independently documented feature at a time. They do not approve the new IDs.

## 6. Feature Responsibilities and Domain Boundaries

| Concern                   | Owning or candidate boundary         | Catalog interaction                                                                                                                                      |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant/tenant identity  | Merchant/Tenancy                     | Supplies authenticated tenant context. Catalog records are never selected solely by a client-provided merchant ID.                                       |
| Activity compatibility    | Activities & Modules                 | Declares whether an implemented Catalog capability is compatible with an activity. It does not grant a subscription or user access.                      |
| Commercial access         | Plans & Subscriptions / Entitlements | Determines whether a merchant is entitled to use a capability or limit. Catalog must enforce approved checks through backend integration.                |
| User authorization        | Identity / Access Control            | Determines which owner/staff actor may view, create, edit, publish, or archive Catalog data.                                                             |
| Product definitions       | Catalog                              | Owns product identity, content, categories, configuration definitions, and Catalog lifecycle once specified.                                             |
| Authoritative quotes      | Pricing candidate domain             | Validates selections in context and calculates amounts. Whether simple base-price storage remains in Catalog is OPEN.                                    |
| Stock balances/movements  | Inventory                            | Owns stock identities, balances, reservations, and movements. Catalog may reference stock policy/identity but must not invent deductions.                |
| Order history             | Orders                               | Persists ordered configuration and pricing snapshots; does not depend on mutable Catalog data to reconstruct history.                                    |
| Public presentation       | Storefront                           | Reads public Catalog projections and renders configuration. It cannot publish hidden data or override backend validation.                                |
| Cashier product selection | POS                                  | Uses the same Product Core and authoritative pricing path, subject to channel/branch rules.                                                              |
| Images/files              | Media/storage boundary               | Owner image upload currently stores JPEG/PNG/WebP files on configurable server disk; final limits, processing, external provider, and deletion are OPEN. |

## 7. Restaurant MVP Boundary versus Future Capability

### 7.1 Restaurant-first MVP direction

The smallest coherent restaurant Catalog slice should be decided through individual feature specifications. Candidate restaurant needs include basic products, categories, a price, visibility, and a minimal modifier model. Sizes may be variants, modifiers, or neither depending on the approved business meaning. That choice must be made from SKU/price/stock identity, not the word “size.”

The following are not approved merely by this overview:

- Conditional modifiers, bundles/combo meals, reusable global modifier libraries, modifier stock deduction, nested groups, recipes, ingredients, nutrition, preparation stations, availability schedules, branch prices, channel prices, taxes, discounts, multilingual product content, or advanced media management.
- Full Inventory, Orders, checkout, kitchen, POS sales, or marketplace behavior.
- Any clothing, supermarket, or electronics operational UI/API.

### 7.2 Future capability boundary

Future activity examples validate that the concepts do not force a core rewrite. They do not approve corresponding features. A future activity may add an extension, policy, adapter, or new core capability after its requirements are documented. “Configuration-driven” should reduce unnecessary code for ordinary configuration; it should not hide specialized business rules inside opaque JSON or a universal rules engine.

## 8. Conceptual Relationships

The following is a vocabulary map, not an ERD, cardinality decision, or Prisma design:

```text
Merchant tenant
  └─ Catalog
      ├─ Categories ── organize ── Products
      └─ Product
          ├─ descriptive attributes
          ├─ explicitly defined Variants
          ├─ Modifier Groups ── contain ── Modifier Options
          └─ Selling Unit / quantity policy

Requested configuration + context
  └─ backend validation
      └─ authoritative price/quote result

Product or Variant
  └─ may reference Inventory-owned stock concepts after approval

Accepted quote/configuration
  └─ Orders-owned immutable purchase snapshot after order creation
```

Unresolved cardinalities include product-category membership, attribute definition reuse, variant dimensions/combinations, group reuse, option reuse, selling-unit alternatives per product, and stock references. None is finalized here.

## 9. Cross-Activity Conceptual Validation

These scenarios are mandatory review cases before approving the Product Core schema.

| Scenario                                              | Generic capabilities                                                                                                                                                                                                                                                                                       | Deliberately unimplemented now                                                                                                                                                                   | Structural-change assessment                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restaurant: burger with sizes, sauces, and extras** | Product represents the burger. A size can be an explicitly defined Variant when it has sellable identity/price/stock significance; sauces and extras use Modifier Groups/Options with selection constraints and possible price effects. Backend validates selections and produces the authoritative quote. | Exact size semantics, min/max/default rules, multiple option quantities, modifier availability/stock, recipes, ingredient deductions, kitchen routing, taxes, and branch/channel pricing.        | Ordinary sizes and modifiers should require no Product Core restructuring. Recipes or kitchen routing are legitimate restaurant extension requirements. Modifier-driven ingredient stock may require an approved integration between Catalog and Inventory, not restaurant fields on Product.                                         |
| **Clothing: T-shirt with color and size variants**    | Product represents the T-shirt. Color and size are variant-defining Attributes; merchant-defined Variant combinations represent sellable SKUs. Generic variant identity can later connect to stock and pricing.                                                                                            | Apparel UI, combination generation, SKU/barcode policy, stock per variant, images per color, size charts, exchanges, and clothing launch support.                                                | Explicit variants should fit without a core structural change. Size charts and exchange behavior are legitimate apparel extensions. If variant-specific media is broadly useful across activities, it may justify a generic media-association enhancement after discovery.                                                            |
| **Supermarket: rice sold by weight**                  | Product represents rice. Selling Unit expresses a weight basis and quantity precision; backend validates quantity and calculates a quote from authoritative unit pricing once those rules are approved.                                                                                                    | Fractional precision, minimum/increment, scale integration, barcode encoding, price-at-weigh time, packages/conversions, stock measurement, expiry batches, tax, and supermarket launch support. | A simple known quantity priced per weight should fit the generic unit/quantity model. Catch weight, scale integration, batch expiry, and conversion semantics are legitimate grocery/POS/Inventory requirements and may require new modules or an approved generic measurement capability. They must not be simulated with modifiers. |
| **Simple product: bottled water**                     | Product plus a piece Selling Unit and authoritative price; no Variants or Modifier Groups are required.                                                                                                                                                                                                    | Stock behavior, barcode, deposit, packs, tax, and channel availability.                                                                                                                          | No structural change should be required. Optional configuration relationships must remain optional so the simple case stays simple.                                                                                                                                                                                                   |

### 9.1 Validation rule

A proposed schema fails this review if it requires restaurant-specific product fields for the burger, forces sauces into variants, forces every color/size combination to be generated without merchant intent, models weighted quantity as a modifier, or requires dummy configuration records for bottled water.

If one of the four scenarios later requires a core change, the feature specification must explain whether it introduces a broadly reusable commerce concept or an activity-specific workflow. Broadly reusable quantity or configuration semantics may extend the core; kitchen, expiry-batch, warranty, scale-device, or exchange workflows normally belong outside it.

## 10. Tenant Isolation and Security Considerations

- Every tenant-owned Catalog operation must derive merchant scope from authenticated server context. Object IDs alone must never authorize access.
- Reads and writes must prevent cross-tenant category, product, variant, modifier, media, price, or stock references. Tenant-safe constraints and query patterns must be designed before implementation.
- Public APIs must return only approved public projections for the resolved merchant/storefront; administrative fields and drafts must not leak.
- Backend permissions must protect create, edit, publish, archive, pricing, and any bulk actions independently of UI controls.
- Activity compatibility, subscription entitlement, merchant configuration, and actor permission must be evaluated as separate concerns where each applies.
- Configuration requests must use server-owned definitions. IDs from another product, merchant, hidden option, or invalid version must be rejected.
- Authoritative calculations must use fixed-precision monetary rules once approved. Client totals are display/input context only.
- Concurrency rules are needed for competing edits, publication, and configuration during Catalog changes. Revisioning/version behavior remains OPEN.
- Material Catalog and price changes may require attributable audit events. Exact audit scope and retention remain OPEN.
- JSONB, if used, requires server validation, bounded size/depth, an explicit schema/version strategy, and a rule forbidding critical money, stock history, tenant ownership, or authorization state from living only in unstructured data.

## 11. Open Decisions Required Before Prisma Schema Design

No Product Core Prisma design should be approved until the decisions relevant to the selected feature are resolved.

### Product identity and lifecycle

1. What length, normalization, and duplicate-name rules apply to the confirmed Arabic name and optional description?
2. Which fields may be edited while a product is archived, and how are archived products presented in merchant management?
3. Does Arabic-first content require Arabic-script validation, or may brand/product names contain Latin characters?
4. How should equal Product/Category links affect storefront grouping, and how many hierarchy levels are needed initially?

### Variants and attributes

5. Which condition makes a choice a Variant: independent SKU, price, barcode, stock, image, or explicit merchant designation?
6. Must the MVP generate combinations from dimensions, or will merchants create only the sellable Variants they need?
7. Are descriptive attributes required in the restaurant MVP, or should they remain outside the first implementation?

### Modifiers

8. Does the restaurant MVP require single-choice and multiple-choice groups, and which min/max/default rules are essential?
9. Can an option be selected more than once? Can groups/options be reused across products, or should the first version keep them product-local?
10. Are conditional/nested modifiers, bundles, and modifier stock effects explicitly deferred?

### Selling units and quantity

11. Is the restaurant MVP piece-only, or must it support another selling unit immediately?
12. Who governs allowed unit definitions, precision, minimum quantity, and increments?

### Pricing boundary

13. Is the first price model `base price + variant adjustment + modifier adjustments`, or do variants/options carry independent prices under another rule?
14. Are prices merchant-wide in the first slice, or can they vary by branch/channel? Taxes, discounts, service fees, and time-based pricing remain separate unless approved.
15. Should Catalog store price inputs while a distinct Pricing service/module owns quote calculation, or should the first modular-monolith slice expose pricing through a Catalog-owned application service with a deliberately extractable boundary?

### Availability, inventory, and channels

16. What are the minimum lifecycle/visibility states, and is storefront visibility separate from POS visibility?
17. Is availability only a manual Catalog flag initially, or must branch, time, or Inventory state affect it?
18. Is Inventory entirely outside the first Catalog slice? If not, are finished products, variants, modifiers, or ingredients stock-relevant?

### Authorization, media, and consistency

19. When staff management is later introduced, which roles may edit products or prices? The initial Products feature remains owner-only.
20. What maximum image count, formats, size limits, storage provider, ordering, replacement, and deletion behavior apply to the confirmed multi-image gallery?
21. What happens to an in-progress cart/configuration when the product or price changes? Are version tokens or revalidation at checkout sufficient for the first release?
22. Which Catalog changes require audit history, and what concurrency behavior should editors see?

## 12. Dependencies

| Dependency               | Current state                                                                                                               | Catalog need                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenancy / Merchant**   | Merchant is the implemented tenant boundary; activated Owner sessions exist.                                                | Authenticated merchant scoping and tenant-safe references. Staff/membership model remains OPEN.                                                |
| **Activities & Modules** | Code-managed registry exists, but Catalog is not registered.                                                                | Future Catalog capability definition and compatibility only after implementation is authorized.                                                |
| **Plans / Entitlements** | Monthly plan definitions exist; assignment and entitlements do not.                                                         | Do not equate an available Catalog module with paid access. Decide enforcement timing separately.                                              |
| **Branches**             | Not implemented.                                                                                                            | Branch-aware pricing, availability, and stock must remain outside the first slice unless Branches is approved.                                 |
| **Pricing**              | Not implemented.                                                                                                            | Server-owned configuration validation and quote calculation are mandatory; ownership boundary is OPEN.                                         |
| **Inventory**            | Not implemented.                                                                                                            | Stock identity/movements remain Inventory-owned; no inferred deduction behavior.                                                               |
| **Orders**               | Not implemented.                                                                                                            | Needs immutable configuration/price snapshots and revalidation contract when Orders is analyzed.                                               |
| **Storefront**           | Next.js shell and design previews exist; no merchant catalog route.                                                         | Public Catalog projection and configurator only after Catalog behavior is approved.                                                            |
| **POS**                  | React placeholder exists.                                                                                                   | Later consumes the same product/configuration/pricing APIs; no separate POS catalog source of truth.                                           |
| **Media storage**        | The Catalog slice stores reusable tenant-owned Media metadata and supports image uploads to configurable local server disk. | Local disk needs a persistent deployment volume; image processing, deletion/cleanup, and migration to an external provider remain future work. |

## 13. Risks of Overengineering and Underdesign

| Risk                                                                    | Guardrail                                                                                                            |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Building a universal rules engine before the restaurant rules are known | Implement only approved constraints with explicit extension points and backend validation.                           |
| Treating JSONB as the whole Product Builder                             | Keep commercial identities and relationships explicit; use validated JSONB only for justified flexible metadata.     |
| Generating every theoretical variant combination                        | Persist merchant-intended sellable Variants under approved rules. Do not confuse a Cartesian product with a catalog. |
| Making modifiers solve variants, units, recipes, or stock               | Preserve semantic boundaries and add domain integration when justified.                                              |
| Designing every future industry now                                     | Use the four scenarios as conceptual validation only; defer their UI, workflows, and integrations.                   |
| Hardcoding restaurant fields for speed                                  | Keep the shared core generic and put kitchen/recipe behavior in restaurant extensions.                               |
| Splitting into services prematurely                                     | Preserve module boundaries inside the current modular monolith; extraction is not required for ownership clarity.    |
| Abstracting Pricing with no approved rule set                           | Define a stable backend boundary and start with the minimum approved calculation behavior.                           |
| Assuming category trees, translations, branches, taxes, or inventory    | Keep each unapproved capability OPEN and absent from the first schema.                                               |
| Equating registry compatibility, plan entitlement, and permission       | Model and enforce these checks independently as their domains become available.                                      |

## 14. Proposed Feature Development Sequence

This is a discovery and implementation sequence. The first backend slice covers only the currently approved core boundaries:

1. **CAT-F02 — Products:** define basic product identity, ownership, lifecycle, actors, required restaurant fields, and security boundaries.
2. **CAT-F01 — Categories:** define organization after the product boundary is understood; category decisions should not block a minimal standalone product unless the owner makes categories mandatory.
3. **CAT-F04 — Modifier Groups & Options:** settle the minimum restaurant configuration behavior.
4. **CAT-F06 — Pricing & Configuration Validation:** approve calculation semantics and backend contract alongside the modifier model.
5. **CAT-F07 — Product Availability & Visibility:** define draft/public and manual availability rules needed to expose products safely.
6. **CAT-F08 — Storefront Product Configurator:** render approved public products and configurations through the Next.js storefront.
7. **CAT-F03 — Variants & Attributes:** move earlier if restaurant sizes are confirmed to require variant identity; otherwise document after the minimal modifier flow.
8. **CAT-F05 — Selling Units:** keep the restaurant MVP piece-only if approved; analyze broader units before any weighted-product implementation.

Inventory, Orders, POS sales, restaurant preparation extensions, branch-specific rules, and future-activity features follow their own discovery and approval tracks.

## 15. Documentation Roadmap

Create one feature specification only after that feature is selected for analysis. Do not create all files in advance.

The first selected feature document is:

```text
docs/features/catalog/PRODUCTS.md
```

The [Products discovery specification](PRODUCTS.md) records approved business rules for product information and lifecycle. The [Categories discovery specification](CATEGORIES.md) records the selected hierarchical classification behavior. The current implementation adds backend models, owner APIs, and a minimal Merchant Dashboard workspace for Products, Categories, and reusable Media references, including server-disk image uploads; public channel projections remain deferred.

Subsequent filenames and IDs should be chosen only when their feature is selected, preserving the mapping to existing parent CAT IDs.

## 16. Recommendation

Analyze **CAT-F02 — Products** first. Product identity and lifecycle establish the anchor used by categories, variants, modifiers, units, visibility, pricing, storefront rendering, inventory references, and order snapshots. Starting with Categories would force decisions about organization before defining what is being organized; starting with modifiers or pricing would lack a stable aggregate and authorization boundary.

The first analysis should remain deliberately small: tenant-owned restaurant product identity, minimum content, lifecycle, permissions, and boundaries. It should test the simple bottled-water case and leave configurable behavior to its own follow-up features.

## 17. Catalog Decision Record

| ID       | Date       | Status    | Decision                                                                                                                                  |
| -------- | ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-D001 | 2026-10-13 | CONFIRMED | A product requires a name, base price, and image; description is optional.                                                                |
| CAT-D002 | 2026-10-13 | CONFIRMED | The initial operational availability choice is `Available` or `Unavailable`; a separate draft/publication workflow is not selected.       |
| CAT-D003 | 2026-10-13 | CONFIRMED | A product that has been used in an order cannot be deleted; it may be archived.                                                           |
| CAT-D004 | 2026-10-13 | CONFIRMED | Every product must be assigned to at least one category.                                                                                  |
| CAT-D005 | 2026-10-13 | CONFIRMED | Only the Merchant Owner manages products in the initial version.                                                                          |
| CAT-D006 | 2026-10-13 | CONFIRMED | Initial product-authored content is Arabic. Multilingual product content is outside this first Products slice unless separately approved. |
| CAT-D007 | 2026-10-13 | CONFIRMED | A product may be linked to multiple categories, while at least one category remains required.                                             |
| CAT-D008 | 2026-10-13 | CONFIRMED | A product supports multiple images and exactly one image is designated as the primary image.                                              |
| CAT-D009 | 2026-10-13 | CONFIRMED | The restaurant MVP base price uses EGP and must be greater than zero.                                                                     |
| CAT-D010 | 2026-10-13 | CONFIRMED | The Merchant Owner explicitly chooses `Available` or `Unavailable` during product creation.                                               |
| CAT-D011 | 2026-10-13 | CONFIRMED | A product that has never appeared in an order may be permanently deleted.                                                                 |
| CAT-D012 | 2026-10-13 | CONFIRMED | An archived product may be restored and always returns as `Unavailable`.                                                                  |
| CAT-D013 | 2026-10-13 | CONFIRMED | A category requires a name and may have an optional description.                                                                          |
| CAT-D014 | 2026-10-13 | CONFIRMED | Categories support parent and child relationships rather than a flat-only structure.                                                      |
| CAT-D015 | 2026-10-13 | CONFIRMED | A category requires an image.                                                                                                             |
| CAT-D016 | 2026-10-13 | CONFIRMED | A category has an `Available` or `Unavailable` operational state.                                                                         |
| CAT-D017 | 2026-10-13 | CONFIRMED | Category management is not restricted to the Merchant Owner; exact authorized non-owner roles remain OPEN.                                |
| CAT-D018 | 2026-10-13 | CONFIRMED | A category linked to any product cannot be deleted and may be archived.                                                                   |
| CAT-D019 | 2026-10-13 | CONFIRMED | All category links on a product are equal; there is no primary product category.                                                          |
| CAT-D020 | 2026-10-13 | CONFIRMED | Category hierarchy is limited to two levels: main Category and child Category.                                                            |
| CAT-D021 | 2026-10-13 | CONFIRMED | A Product may link to either a main Category or a child Category.                                                                         |
| CAT-D022 | 2026-10-13 | CONFIRMED | When a main Category is `Unavailable`, its child Categories are hidden in effective navigation.                                           |
| CAT-D023 | 2026-10-13 | CONFIRMED | A main Category with children may be archived; its child Categories are hidden in effective navigation.                                   |
| CAT-D024 | 2026-10-13 | CONFIRMED | An unlinked Category with no child Categories may be permanently deleted.                                                                 |
| CAT-D025 | 2026-10-13 | CONFIRMED | An archived Category may be restored and always returns as `Unavailable`.                                                                 |
| CAT-D026 | 2026-10-13 | CONFIRMED | Category management uses a `Manage Catalog` permission for the Merchant Owner or an authorized employee.                                  |
| CAT-D027 | 2026-10-13 | CONFIRMED | Merchants do not manually order Categories within a hierarchy level.                                                                      |
| CAT-D028 | 2026-10-13 | CONFIRMED | Each Category has exactly one image.                                                                                                      |
| CAT-D029 | 2026-10-13 | CONFIRMED | The same media asset may be reused by more than one Product or Category.                                                                  |
| CAT-D030 | 2026-10-13 | CONFIRMED | If a product's primary image is removed, the system automatically selects another remaining image as primary.                             |
| CAT-D031 | 2026-10-13 | CONFIRMED | Product media must enforce approved maximum count, file size, and format constraints; exact limits remain OPEN.                           |

These decisions approve the documented business behavior. They do not authorize deferred Variants, Modifiers, Pricing, Inventory, Storefront, POS, or future-activity implementations.
