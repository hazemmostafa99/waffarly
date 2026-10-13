# CAT-F01 — Categories

**Status:** Discovery draft; initial business rules confirmed; backend slice implementation in progress  
**Last updated:** 2026-10-13  
**Parent:** [Catalog & Dynamic Product Builder Overview](OVERVIEW.md)  
**Related:** [Products discovery specification](PRODUCTS.md)  
**Parent feature mapping:** Existing `CAT-01 — Categories and products`  
**Identifier note:** `CAT-F01` is temporary because `CAT-01` through `CAT-03` already identify broader Catalog feature groups.

## 1. Purpose

Categories organize a merchant's products for management and later customer/cashier navigation. They are tenant-owned classification records, not product types, pricing rules, inventory groups, subscription entitlements, or activity modules.

The restaurant MVP will use the same generic Category capability intended for ordinary future catalog organization. Restaurant-specific labels such as menu sections are presentation language; they do not justify a separate restaurant category implementation.

Every Product must belong to at least one Category, and a Product may belong to multiple equal Categories. Category availability and lifecycle must not silently change Product price, stock, or historical orders.

This specification documents business behavior only. It does not approve Prisma models, recursive relationships, migrations, APIs, React components, image storage, or implementation.

## 2. Confirmed Decisions

The product owner confirmed the following on 2026-10-13:

| Decision ID | Status    | Decision                                                                                                       |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| CAT-D013    | CONFIRMED | A Category requires a name and may have an optional description.                                               |
| CAT-D014    | CONFIRMED | Categories support main/parent and child/subcategory relationships rather than a flat-only structure.          |
| CAT-D015    | CONFIRMED | A Category requires an image.                                                                                  |
| CAT-D016    | CONFIRMED | A Category has an `Available` or `Unavailable` operational state.                                              |
| CAT-D017    | CONFIRMED | Category management is not restricted to the Merchant Owner.                                                   |
| CAT-D018    | CONFIRMED | A Category linked to one or more Products cannot be deleted and may be archived.                               |
| CAT-D019    | CONFIRMED | When a Product is linked to several Categories, all links are equal; no Category is designated as the primary. |
| CAT-D020    | CONFIRMED | Category hierarchy is limited to two levels: main Category and child Category.                                 |
| CAT-D021    | CONFIRMED | A Product may link to either a main Category or a child Category.                                              |
| CAT-D022    | CONFIRMED | An `Unavailable` main Category hides its child Categories in effective navigation.                             |
| CAT-D023    | CONFIRMED | A main Category with children may be archived; its child Categories are hidden in effective navigation.        |
| CAT-D024    | CONFIRMED | An unlinked Category with no child Categories may be permanently deleted.                                      |
| CAT-D025    | CONFIRMED | An archived Category may be restored and always returns as `Unavailable`.                                      |
| CAT-D026    | CONFIRMED | Category management uses a `Manage Catalog` permission for the Merchant Owner or an authorized employee.       |
| CAT-D027    | CONFIRMED | Merchants do not manually order Categories within a hierarchy level.                                           |
| CAT-D028    | CONFIRMED | Each Category has exactly one image.                                                                           |
| CAT-D029    | CONFIRMED | The same media asset may be reused by more than one Product or Category.                                       |

### 2.1 Qualifications that remain open

- CAT-D013 follows the current Arabic-first Catalog content direction. Length, normalization, duplicate-name, and future localization rules remain OPEN.
- CAT-D014/CAT-D020 confirm a two-level hierarchy. Further nesting is outside this feature.
- CAT-D015/CAT-D028 require exactly one Category image but do not define formats, dimensions, file size, processing, storage, replacement, or cleanup.
- CAT-D016/CAT-D022/CAT-D023 define effective navigation hiding. They do not define storefront publication, scheduling, Product availability, branch availability, or Inventory state.
- CAT-D017/CAT-D026 define `Manage Catalog` as the required capability; the underlying staff/RBAC implementation and assignment workflow remain OPEN.
- CAT-D018/CAT-D024 settle deletion eligibility. Media cleanup, audit history, and concurrency behavior remain OPEN.
- CAT-D019/CAT-D021 remove primary-Category semantics and permit links to either level. Storefront duplication and canonical URL/SEO behavior remain OPEN.
- CAT-D025 settles restoration as `Unavailable`; descendant behavior after restoration follows the parent effective-visibility rule.
- CAT-D027 removes merchant-controlled manual ordering; system ordering and navigation presentation remain OPEN.

## 3. Scope

### 3.1 In scope for Category discovery

- Tenant-owned Category identity.
- Required Category name and optional description under the Arabic-first Catalog direction.
- Required Category image.
- Parent/child Category hierarchy.
- `Available` and `Unavailable` operational states.
- Archival when a Category is linked to Products.
- Product assignment to one or more equal Categories.
- Backend authorization, tenant isolation, hierarchy integrity, concurrency, and lifecycle validation.
- Initial boundary for Merchant Owner and future authorized non-owner management.

### 3.2 Explicitly outside this feature

- Product creation/editing beyond consuming valid Category links.
- Product price, variants, modifiers, selling units, stock, recipes, Orders, and kitchen behavior.
- Category-specific subscription plans, entitlements, taxes, discounts, or inventory policies.
- Automatic classification, AI-generated Categories, global Waffarly taxonomy, or cross-merchant shared Categories.
- Marketplace taxonomy, SEO strategy, URLs, breadcrumbs, and Storefront layout implementation.
- Branch-specific, channel-specific, scheduled, or Inventory-derived Category availability.
- Category analytics, merchandising campaigns, featured collections, tags, filters, and attribute facets.
- Prisma schema, recursive-query strategy, migrations, API contracts, UI implementation, and media-provider selection.

## 4. Category versus Related Concepts

| Concept            | Responsibility                                                               | Boundary                                                                              |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Category**       | Merchant-owned hierarchical grouping used to organize and navigate Products. | Does not define Product structure, price, stock, or entitlement.                      |
| **Product type**   | Potential future definition of structural/validation behavior.               | Not approved; a Category must not become a hidden schema discriminator.               |
| **Attribute**      | Describes a Product or helps define Variants.                                | Not a navigation Category merely because customers may filter by it.                  |
| **Tag/collection** | Potential flexible merchandising grouping.                                   | Not included; do not overload Category behavior before a separate requirement exists. |
| **Activity**       | Describes the merchant's business archetype and compatible modules.          | Platform-owned capability metadata, not a merchant Product Category.                  |
| **Entitlement**    | Commercial permission to use a capability.                                   | Does not classify Products and is not implied by Category availability.               |

The hierarchy remains generic. A restaurant may present “Burgers” and “Chicken Burgers,” while a future clothing merchant may use “Men” and “Shirts.” Those examples use the same Category concept without implementing future activity workflows.

## 5. Actors and Permissions

| Actor                         | Confirmed or candidate responsibility                                             | Boundary                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merchant Owner**            | May manage Categories for their own tenant when granted `Manage Catalog`.         | Owner access is tenant-scoped; the exact action set and branch scope remain open.                                                            |
| **Authorized merchant staff** | Category management may be granted to non-owner personnel with `Manage Catalog`.  | Exact role names, actions, branch scope, and initial release inclusion are OPEN. Current staff/RBAC functionality does not exist.            |
| **Super Admin**               | No tenant Category-management access is granted here.                             | Platform administration does not imply operational tenant access. Any support/impersonation capability requires separate approval and audit. |
| **Customer/public visitor**   | Later sees available Categories through an approved public Storefront projection. | Public visibility/navigation is a separate Storefront responsibility.                                                                        |
| **Cashier/POS user**          | Later consumes Categories for Product navigation if approved.                     | No POS management permission or separate POS taxonomy is implied.                                                                            |

Activity compatibility, subscription entitlement, tenant configuration, and user permission remain separate checks. CAT-D017 means the permission model must be extensible beyond owner-only access; it does not authorize every employee to manage Categories.

## 6. Category Information

| Information   | Requirement                                                 | Current rule                                                                                                                              |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Name          | Required                                                    | Arabic-first merchant-authored content; blank/whitespace-only values are invalid. Length, normalization, and duplicate rules remain OPEN. |
| Description   | Optional                                                    | Arabic-first merchant-authored content. Empty/absent normalization and maximum length remain OPEN.                                        |
| Image         | Exactly one required image                                  | A usable Category image is required. Media format, size, dimensions, processing, storage, replacement, and cleanup remain OPEN.           |
| Parent        | Optional for a main Category; required for a child Category | Parent must be a main Category belonging to the same tenant. The hierarchy has exactly two levels.                                        |
| Availability  | Required operational state                                  | `Available` or `Unavailable`. Creation choice/default remains OPEN.                                                                       |
| Display order | System-defined presentation order                           | Merchants do not manually order Categories; the system ordering strategy remains OPEN.                                                    |

## 7. Hierarchy Rules

### 7.1 Confirmed direction

- Categories support exactly two levels: main and child.
- A main Category has no parent.
- A child Category references a main Category within the same merchant tenant.
- The hierarchy has exactly two levels; children cannot have children.
- Hierarchy validation is backend-authoritative.

### 7.2 Baseline integrity requirements if implemented

- A Category cannot be its own parent.
- A child cannot become a parent, so recursive cycles are not permitted by the two-level rule.
- A Category cannot use a parent from another merchant.
- Unknown, deleted, or otherwise ineligible parents must be rejected.
- Moving a Category must preserve all approved hierarchy and availability rules.
- Concurrent moves must not create a cycle or silently lose another accepted update.

### 7.3 Open hierarchy behavior

- Whether a Product may link to both a main Category and one of its child Categories at the same time.
- Whether moving a Category also changes public navigation/URLs and active carts.
- What system ordering should be used now that merchant-controlled ordering is not required.

No closure table, adjacency list, materialized path, recursive query, or Prisma representation is selected by these conceptual rules.

## 8. Availability and Lifecycle Concepts

| Concept         | Meaning                                                                                        | Confirmed or open behavior                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Available**   | Category is operationally eligible for use in approved Catalog/channel contexts.               | CONFIRMED state; public display and Product effects remain OPEN.                                                           |
| **Unavailable** | Category remains managed but is not operationally eligible under later approved channel rules. | An unavailable main Category hides its children in effective navigation; stored child/Product state remains unchanged.     |
| **Archived**    | Category is retired while preserving identity and Product relationships.                       | A main Category may be archived with children; children are hidden in effective navigation. Restore returns `Unavailable`. |
| **Deleted**     | Category identity is permanently removed.                                                      | Allowed only when the Category has no Product links and no child Categories.                                               |

Availability, archival, and Product availability are independent concepts. Marking a Category unavailable or archived must not silently rewrite a linked Product's own state or remove historical order information. Storefront navigation may exclude the Category under future approved rules while Products remain reachable through other equal Categories.

## 9. Use Cases

### UC-C01 — Create a main Category

1. An authenticated authorized actor starts Category creation for their merchant tenant.
2. The actor supplies the required name and image, optional description, and an availability value under the final creation rule.
3. The actor leaves Parent empty to create a main Category.
4. The backend validates tenant context, permission, content, image, and availability.
5. The Category is created within that merchant tenant.

The exact action set for `Manage Catalog` and default/explicit availability behavior remain OPEN.

### UC-C02 — Create a child Category

1. An authenticated authorized actor supplies valid Category information and selects an eligible parent from the same tenant.
2. The backend validates permission, tenant ownership, parent eligibility, depth, and cycle rules.
3. The child Category is created at the allowed level.

The two-level hierarchy rule rejects a child Category as a parent.

### UC-C03 — View and organize Categories

1. An authorized actor lists Categories belonging to their tenant.
2. The system presents hierarchy and lifecycle/availability states.
3. The actor may navigate parent/child relationships and, if permitted, move a Category.

Search, filtering, pagination, system presentation order, move behavior, and archived placement remain OPEN.

### UC-C04 — Edit Category information or parent

1. An authorized actor opens a Category belonging to their tenant.
2. The actor edits allowed information and optionally moves it under another eligible parent.
3. The backend validates the resulting Category, permissions, hierarchy, tenant ownership, image, availability, and concurrency expectation.
4. The change does not rewrite Product identity, pricing, or historical order data.

Effects on Storefront navigation and active Product editing remain OPEN.

### UC-C05 — Change Category availability

1. An authorized actor changes a non-archived Category between `Available` and `Unavailable`.
2. The backend validates permission, lifecycle state, hierarchy rules, and the approved effect on descendants.
3. Later Storefront/POS projections apply the authoritative state under their approved contracts.

Linked Product state remains independent.

### UC-C06 — Archive a linked Category

1. An authorized actor chooses to retire a Category that is linked to one or more Products.
2. Permanent deletion is rejected.
3. If hierarchy rules permit the transition, the Category becomes archived while Product links and historical references are preserved.

If the archived Category is a main Category, its children remain stored but are hidden in effective navigation. Product links and historical references are preserved.

### UC-C07 — Delete an unlinked Category

1. An authorized actor chooses a Category with no Product links and no child Categories.
2. The backend verifies tenant ownership, `Manage Catalog`, deletion eligibility, and concurrency expectations.
3. The Category may be permanently deleted. A Category with Product links or child Categories is rejected and remains eligible for archival.

Image cleanup, audit history, and concurrent Product assignment remain open implementation details.

## 10. Validation and Business Rules

### 10.1 Confirmed rules

- A Category is owned by one merchant tenant.
- Name and image are required; description is optional.
- Categories support exactly two levels: main and child.
- Categories have `Available` and `Unavailable` operational states.
- Category management requires `Manage Catalog` for the Merchant Owner or an authorized employee.
- A Category linked to any Product cannot be deleted and may be archived.
- A Product must have one or more equal Category links, may link to either level, and has no primary Category.
- An unavailable or archived main Category hides its child Categories in effective navigation without changing stored child state.
- Merchants do not manually order Categories within a hierarchy level.
- Category media may reuse an existing tenant-authorized asset; the same asset may be referenced by other Products or Categories.

### 10.2 Baseline rules if implemented

- Tenant context and permission are derived and verified by the backend.
- Parent Category, Product links, and media references must belong to the same merchant tenant.
- Required text cannot be blank after approved normalization.
- The two-level rule prevents child-of-child relationships and cycles.
- Invalid input cannot leave a partial Category or orphan required image association.
- Concurrent hierarchy/lifecycle changes cannot silently create invalid state.
- Client-provided tenant IDs, permissions, link counts, or deletion eligibility are never authoritative.
- Category changes do not mutate Product price, stock, or historical order snapshots.

### 10.3 Rules still requiring decisions

- Exact actions covered by `Manage Catalog` and their staff/branch scope.
- Whether a Product may link to both a main Category and one of its child Categories simultaneously.
- Arabic-script validation, length, normalization, and duplicate names.
- Image/media rules.
- Explicit versus default availability at creation.
- System ordering and navigation presentation.
- Archival restoration and editing details.
- Safe concurrency between Product assignment and Category deletion/archive.

## 11. Edge and Failure Cases

- Blank or oversized name/description.
- Duplicate sibling names or the same name at different hierarchy levels.
- Missing, invalid, cross-tenant, or concurrently removed image.
- Cross-tenant parent selection.
- Self-parenting or moving a Category beneath its own descendant.
- Attempting to make a child Category the parent of another Category.
- Parent is unavailable or archived while a child is created/moved.
- Parent availability/archive changes while children or linked Products exist.
- Category archive/delete races with Product assignment.
- Two authorized users concurrently move the same Category.
- A Product appears under several equal Categories, one of which becomes archived.
- An archived Category is referenced by Product management or historical reporting.
- Merchant access/subscription changes during mutation.

## 12. Conceptual Data and Architecture

No physical entities, fields, indexes, foreign keys, deletion actions, or recursive strategy are approved. A future design will likely need to express:

- Tenant-owned Category identity.
- Arabic-first Category content.
- Exactly one required Category media association; reusable media assets are permitted.
- Optional parent relationship with hierarchy integrity.
- Operational availability and archival lifecycle.
- Equal Product/Category associations supporting one or more Categories per Product.
- Concurrency/version information.
- Creation/update attribution and any approved audit events.

Tenant ownership, hierarchy, Product relationships, media association, and lifecycle state should be relational. No current requirement justifies storing the Category hierarchy or Product links in JSONB.

### 12.1 Candidate backend boundary

Categories belongs inside the future Catalog module boundary. It would expose validated Category behavior to Products and later channel projections. Categories must not directly own Product pricing, stock, or order behavior.

This boundary does not approve classes, routes, repository abstractions, or a database representation.

### 12.2 Candidate frontend responsibility

The Merchant Dashboard would eventually present hierarchy, image, content, availability, lifecycle, and permitted management actions. It must render backend errors and cannot decide tenant ownership, hierarchy validity, link existence, deletion eligibility, or permission.

No UI is approved by this specification.

## 13. Dependencies

| Dependency              | Need                                                                         | Current state                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Merchant/Tenancy        | Authenticated merchant ownership and isolation.                              | Merchant tenant and activated Owner session exist; staff membership/RBAC is absent. |
| Identity/Access Control | Allow approved owner and non-owner Category managers.                        | Only owner/admin session concepts exist; exact Category roles remain OPEN.          |
| Product Media           | Required Category image lifecycle.                                           | Not implemented or selected. Existing logo storage is not a Category-image design.  |
| Products                | Mandatory one-or-more equal Category associations.                           | Product associations are implemented in the first backend slice.                    |
| Availability/Storefront | Meaning of Category availability for navigation and Product discoverability. | Not implemented; channel effects OPEN.                                              |
| Audit                   | Attribution/history if required for hierarchy/lifecycle changes.             | No general audit domain; scope OPEN.                                                |

The backend slice requires a registered reusable Media reference and the existing Owner session. Employee `Manage Catalog` roles, binary upload, and channel projections remain deferred.

## 14. Acceptance Criteria

These criteria describe confirmed direction and baseline expectations for the backend slice. They do not authorize deferred UI or channel projections.

### AC-C01 — Tenant isolation and permission

- An authorized actor can manage only Categories belonging to their merchant tenant.
- Changing a Category, parent, Product, or image identifier cannot create a cross-tenant relationship.
- Category management is capable of supporting authorized non-owner actors without granting access to every employee.
- Super Admin status, activity compatibility, or plan metadata alone does not grant tenant Category-management permission.

### AC-C02 — Required information

- Creation is rejected without a nonblank Category name, valid required image, and valid availability value under the final creation rule.
- Description may be omitted.
- Invalid input creates no partial Category state.

### AC-C03 — Hierarchy integrity

- An eligible main Category can be created without a parent.
- An eligible child Category can reference an authorized parent in the same tenant.
- Self-parenting, cross-tenant parents, cycles, and child-of-child relationships are rejected by the backend.
- Concurrent changes cannot commit an invalid hierarchy.

### AC-C04 — Product relationships

- A Product may link to several Categories and all links are equal.
- A Product may link to either a main or child Category.
- No primary Category is required or inferred.
- A Product cannot be left with zero Categories by a Category/Product update.
- Category changes do not change Product price or historical order facts.

### AC-C05 — Availability and lifecycle

- An authorized actor can set an eligible Category to `Available` or `Unavailable` under the approved transition rules.
- A Category linked to any Product cannot be deleted.
- An unlinked Category with no child Categories may be permanently deleted.
- A Category with children may be archived; an unavailable or archived main Category hides its children in effective navigation without mutating their stored state.
- An archived Category restores as `Unavailable`.
- Unknown state values and invalid transitions are rejected by the backend.

### AC-C06 — Generic core

- The hierarchy can represent restaurant menu organization without restaurant-specific Category fields.
- The same concept can later organize ordinary clothing, supermarket, or electronics Products without duplicating Catalog.
- Specialized industry workflows are not implemented or embedded in Category data.

## 15. Remaining Focused Questions

1. May a Product link to both a main Category and one of its child Categories, or should that redundant combination be rejected?
2. What system ordering should present Categories now that merchants do not manually order them?
3. Does Category creation require an explicit availability choice, or should the backend apply a default?
4. Which actions and branch scope are included in `Manage Catalog` for the first release?
5. What format, dimension, file-size, processing, storage, and cleanup rules apply to the single Category image?
6. What should happen to active Storefront navigation and carts when a parent Category becomes hidden or archived?

Image limits and media behavior will be handled in the Product Media discovery rather than decided implicitly here.

## 16. Documentation and Approval Path

1. Record answers to the remaining focused questions and update the parent decision record.
2. Complete minimal Product Media discovery because Category and Product images are required.
3. Reconcile Products with approved Category lifecycle and assignment behavior.
4. Seek explicit approval before designing Prisma models, NestJS APIs, React UI, or tests.
5. Seek separate explicit authorization before implementing any approved design.

**Current authorization boundary:** tenant-scoped owner APIs and relational backend behavior for Categories, with reusable Media references.
