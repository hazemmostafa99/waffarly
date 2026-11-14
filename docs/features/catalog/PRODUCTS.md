# CAT-F02 — Products

**Status:** Product core, Product Builder, sellable variants/attributes, reusable modifier assignments, authoritative configuration quote, and order-history deletion protection implemented

**Last updated:** 2026-10-14
**Parent:** [Catalog & Dynamic Product Builder Overview](OVERVIEW.md)  
**Parent feature mapping:** Existing `CAT-01 — Categories and products`  
**Identifier note:** `CAT-F02` is temporary because `CAT-01` through `CAT-03` already identify broader Catalog feature groups.

## 1. Purpose

Products defines the minimum tenant-owned catalog identity used by categories, variants, modifiers, selling units, pricing validation, visibility, storefront, inventory, POS, and order features.

This Products feature is documented for the restaurant MVP while preserving a generic Product Core. It does not add restaurant-specific fields or implement future-industry behavior. A simple product such as bottled water fits without variants or modifiers. Configurable items use optional sellable Variants and reusable tenant-owned Modifier Groups connected by product-specific assignments.

This specification records Product Core behavior. The implementation adds a migration from product-local modifier rows to reusable tenant-owned definitions and product-specific assignments; applying it to a fresh or representative pre-feature database remains a release verification step. The storefront checkout re-quotes configured products and snapshots purchased names, stable IDs, structured variant attributes, and prices; broader Inventory integration, automatic variant-combination generation, POS, and a reporting dashboard remain outside this feature.

## 2. Confirmed Decisions

The product owner confirmed the following on 2026-10-13:

| Decision ID | Status    | Decision                                                                                                                             |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CAT-D001    | CONFIRMED | A product requires a name, base price, and image. Description is optional.                                                           |
| CAT-D002    | CONFIRMED | The initial operational availability states are `Available` and `Unavailable`. A separate draft-to-publish workflow is not required. |
| CAT-D003    | CONFIRMED | After a product has been used in an order, it cannot be deleted and may only be archived.                                            |
| CAT-D004    | CONFIRMED | Category assignment is mandatory for every product.                                                                                  |
| CAT-D005    | CONFIRMED | Only the Merchant Owner manages products in the initial version.                                                                     |
| CAT-D006    | CONFIRMED | Product-authored content is Arabic in the initial version.                                                                           |
| CAT-D007    | CONFIRMED | A product may be linked to multiple categories, while at least one category remains required.                                        |
| CAT-D008    | CONFIRMED | A product has multiple images and exactly one image is designated as its primary image.                                              |
| CAT-D009    | CONFIRMED | The restaurant MVP base price is in EGP and must be greater than zero.                                                               |
| CAT-D010    | CONFIRMED | The Merchant Owner explicitly chooses `Available` or `Unavailable` during creation.                                                  |
| CAT-D011    | CONFIRMED | A product that has never appeared in an order may be permanently deleted.                                                            |
| CAT-D012    | CONFIRMED | An archived product may be restored; restoration always returns it as `Unavailable`.                                                 |
| CAT-D030    | CONFIRMED | If a product's primary image is removed, the system automatically selects another remaining image as primary.                        |
| CAT-D031    | CONFIRMED | Product media must enforce approved maximum count, file size, and format constraints; exact limits remain OPEN.                      |

### 2.1 Qualifications that remain open

- The implementation stores EGP prices at two-decimal precision with a provisional database maximum; the owner has not confirmed a final commercial price ceiling. CAT-D008/CAT-D031 still leave image formats, image storage, ordering, and numeric media limits open.
- CAT-D002 defines operational availability, not a publication workflow, schedule, inventory result, or channel-specific state.
- CAT-D003/CAT-D011 require an authoritative order-use check before permanent deletion. Order-history protection and its serializable concurrency boundary are implemented; related media cleanup remains OPEN.
- CAT-D004/CAT-D007/CAT-D019 require one or more equal category links with no primary category. Display order and reassignment behavior remain OPEN.
- CAT-D005 does not establish a general role model. Staff product management is outside this initial feature.
- CAT-D006 defines the initial authored-content language. It does not decide automatic translation, transliteration, search normalization, or the future multilingual model.
- CAT-D010 requires an explicit availability choice; neither state is silently selected for the owner.
- CAT-D012 settles the restoration state but not whether archived product information can be edited before restoration.
- The current backend uses provisional Media guards of at most 10 product images, 10 MB per asset, and JPEG/PNG/WebP. These defaults are implementation safeguards until the owner confirms final Media limits.

### 2.2 Approved Product Builder decisions (2026-10-14)

- Modifier Groups are reusable across products belonging to the same merchant. Product-specific selection constraints and ordering belong to the product-to-group assignment.
- `minSelections` and `maxSelections` define required/optional behavior and the allowed selection count. Options may be marked as defaults.
- Variants are optional. Each is an explicitly configured sellable record with its own positive EGP price and stable identity. SKU, barcode, and stock are optional and are not prerequisites for creating a Variant.
- Restaurant sizes may be represented as Variants. Variant Attributes are generic dimensions and values; a size label is not hardcoded into Product or Variant storage.
- Variants are not automatically generated combinations. Products remain sold by the piece in the current restaurant MVP.
- A product with variants requires the customer to select one for quoting. Variant price replaces the product base price; modifier adjustments are added afterward. A tracked quantity of zero or unavailable variant is rejected by quote. Quote alone does not reserve stock; storefront checkout reserves the quoted quantity atomically.
- Fixed modifier adjustments and defaults are product-assignment-specific in V1. This preserves old product prices during migration and lets a shared definition be used with different prices. Variant-specific prices, branch pricing, modifier stock, bundles, and conditional/nested modifiers are deferred.

### 2.3 Backend configuration and quote MVP (2026-10-14)

- The target schema separates tenant-owned modifier definitions/options from product assignments and their price/default configuration. The migration preserves old assignment and option IDs where safe, with new IDs for shared definitions.
- `POST /catalog/products/:id/quote` is the authoritative single-product configuration quote. It only quotes non-archived, available products and only accepts groups/options belonging to that product.
- If a group is omitted from the request, its default options are applied. An explicitly supplied group with an empty `optionIds` array means no options are selected and is still subject to that group's minimum.
- Quotes enforce every assigned group's min/max selection bounds and return the effective EGP base, modifier, and total amounts as fixed two-decimal strings, plus resolved variant/selections and `productRevision`.
- This quote is not an order snapshot and does not include discounts, taxes, fees, branch/channel context, stock reservation, or inventory movement. The MVP selling unit is `piece`.

### 2.4 Configuration report boundary

- `GET /owner/reports/product-configuration?from=YYYY-MM-DD&to=YYYY-MM-DD` aggregates accepted storefront orders by product, variant, attribute value, and modifier option from immutable snapshots.
- Report dates are inclusive UTC calendar days and capped at 366 days. Legacy rows without structured IDs remain grouped by snapshot labels and are counted separately where identifiable.
- This endpoint is not a reporting dashboard and does not include POS sales, rejected orders, taxes, discounts, or branch/channel breakdowns.

### 2.5 Storefront checkout and order MVP (2026-10-14)

- `POST /catalog/stores/:slug/orders` accepts customer name/phone, pickup or delivery (with a required address), and configured product lines. Prices are never accepted from the browser: the API re-quotes every line and checks the product revision again in the transaction.
- Order creation snapshots product/variant/attribute/modifier IDs and names, assignment-level price adjustments, and fixed-precision EGP prices. A serializable transaction creates the order and atomically decrements tracked variant stock; untracked variants remain unreserved.
- `GET /owner/orders` returns the signed-in owner's latest 100 orders. `PATCH /owner/orders/:id/status` allows a pending order to be accepted or rejected; rejection restores any still-existing tracked variant reservation, while acceptance keeps it consumed.
- Products with order lines cannot be permanently deleted. The owner may archive them while the order snapshots remain readable even if catalog definitions later change.
- This is not a general Inventory ledger or fulfillment system. There is no online payment, delivery-fee calculation, tax/discount support, notification, POS order, branch routing, kitchen flow, or later fulfillment-state transition.

## 3. Scope

### 3.1 In scope for product discovery

- Tenant-owned product identity.
- Required Arabic name.
- Required positive EGP base price as a backend-owned commercial input. Two-decimal storage and basic modifier quote semantics are implemented; contextual pricing rules remain OPEN.
- Optional Arabic description.
- Multiple product images with exactly one primary image; removing the primary automatically selects another remaining image. Media limits and processing remain OPEN.
- One or more mandatory category assignments, consuming the separately documented Categories capability.
- Initial `Available` and `Unavailable` operational states.
- Archival/restoration behavior, deletion of never-ordered products, and the prohibition on deleting a product after it has appeared in an order.
- Merchant Owner product-management authority.
- Explicit sellable variant identity, price, optional SKU/barcode and stock count, per-variant availability, and variant-aware quote validation.
- Tenant isolation, backend validation, concurrency expectations, and future references from other domains.

### 3.2 Explicitly outside this feature

- Category creation, hierarchy, ordering, and visibility rules beyond the dependency that a valid category is required.
- Attribute definitions, automatic variant-combination generation, bundles, and configurable-product rules beyond CAT-F03/CAT-F04.
- Selling units other than piece.
- Discounts, taxes, fees, price schedules, branch/channel prices, and currency conversion. The basic configuration quote MVP is implemented separately below.
- General stock balances, movements, replenishment, recipes, ingredients, batches, and inventory availability. Checkout only reserves the optional per-variant quantity described above.
- Product publishing workflow, scheduled availability, branch availability, storefront/POS channel overrides, and sold-out derivation.
- POS orders, online payments, fees/taxes/discounts, delivery pricing, notifications, kitchen behavior, and a full fulfillment-state lifecycle. The basic storefront basket/checkout, order snapshots, tracked variant reservation, and owner accept/reject flow are implemented in CAT-F09.
- Product reviews, nutrition, allergens, preparation time, SKU, barcode, tax codes, cost price, supplier data, and activity-specific extensions.
- Clothing, supermarket, and electronics operational implementation.
- Staff roles and granular product permissions.
- POS UI, advanced editing, and media-provider selection. The public Storefront checkout MVP is implemented separately.

## 4. Actors and Permissions

| Actor                       | Initial responsibility                                                                                                                | Boundary                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merchant Owner**          | Create, view, edit, change availability, and archive products within their own merchant tenant, subject to the final lifecycle rules. | The existing activated-owner session is the current authentication foundation. Product authorization must be enforced by the backend.              |
| **Merchant staff**          | No product-management permission in the initial version.                                                                              | Future staff roles require separate Identity/Access Control discovery and explicit approval.                                                       |
| **Super Admin**             | No product-content management is granted by this specification.                                                                       | Platform administration does not imply tenant operational access. Any support/impersonation capability requires separate approval and audit rules. |
| **Customer/public visitor** | Later consume an approved public product projection when Storefront is implemented.                                                   | Public read behavior is not part of this feature and must never expose unavailable/archived or administrative information under unapproved rules.  |
| **Cashier/POS user**        | Later consume sellable products through POS.                                                                                          | POS is a channel, not an independent Product source of truth. No POS behavior is included now.                                                     |

Activity compatibility, subscription entitlement, merchant configuration, and user permission remain different concepts. Product access must not be granted solely because Catalog is compatible with the restaurant activity or appears in a plan definition.

## 5. Product Information

### 5.1 Confirmed minimum information

| Information  | Requirement                | Current rule                                                                                                                                                                                                                      |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name         | Required                   | Merchant-authored Arabic content. Blank/whitespace-only values must not be accepted. Exact length and normalization remain OPEN.                                                                                                  |
| Base price   | Required                   | Positive EGP amount. It must be validated and stored/calculated without floating-point ambiguity. Precision and maximum remain OPEN.                                                                                              |
| Description  | Optional                   | Merchant-authored Arabic content. Empty versus absent normalization and maximum length remain OPEN.                                                                                                                               |
| Images       | Required                   | One or more images are required, multiple images are supported, and exactly one is primary. Removing the primary automatically selects another remaining image. Count limits, size, formats, processing, and storage remain OPEN. |
| Categories   | Required                   | Must reference at least one authorized category belonging to the same merchant; multiple equal category links are supported and none is primary. Display behavior remains OPEN.                                                   |
| Availability | Required operational state | The owner explicitly selects `Available` or `Unavailable` during creation.                                                                                                                                                        |

### 5.2 Generic-core constraint

The Product definition must not add fields such as restaurant meal size, sauce, topping, recipe, kitchen station, clothing color, grocery weight, or electronics warranty. Those concepts belong to generic configuration capabilities or activity extensions as described in the Catalog Overview.

The required product base price remains the fallback for products without variants. When a variant is selected, its own positive EGP price is authoritative before fixed EGP modifier adjustments. Broader unit and contextual pricing behavior remains deferred.

## 6. Lifecycle Concepts

The concepts below describe behavior and do not prescribe an enum or database fields.

| Concept         | Meaning                                                                                                                   | Confirmed or open behavior                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Available**   | Product is operationally allowed to be selected in applicable channels, subject to all other approved checks.             | CONFIRMED state; public storefront lists it and quote/checkout revalidate state. POS and broader stock behavior remain outside the MVP. |
| **Unavailable** | Product remains managed but is not currently allowed to be selected under the initial manual availability rule.           | CONFIRMED state; hidden from public storefront and rejected by quote/checkout; saved carts are revalidated on submission.               |
| **Archived**    | Product is retired from ordinary active management and cannot be used for new selection under the eventual channel rules. | It may be restored; restoration always returns it as `Unavailable`. Edit/query visibility remains OPEN.                                 |
| **Deleted**     | Product identity is permanently removed.                                                                                  | Allowed only when the product has never appeared in an order; otherwise prohibited.                                                     |

Availability and archival are separate:

- `Unavailable` is an operational sellability choice for a product that remains active in the catalog.
- `Archived` is a lifecycle/retirement choice intended to preserve history and references.
- Restoring an archived product cannot make it immediately sellable; it returns as `Unavailable` and requires a separate availability action.
- Neither state is a substitute for Inventory stock, branch operating state, subscription access, or storefront publication unless separately approved.

### 6.1 Historical-reference invariant

Once an order references a product, permanent deletion is forbidden. Archival preserves the identity needed for administration. Storefront order lines preserve their own immutable purchased-product and price snapshot and do not depend on the mutable current Product record. The owner API enforces the no-delete rule in a serializable transaction; variant configuration cannot be replaced while a pending order holds a tracked-stock reservation.

## 7. Use Cases

### UC-P01 — Create a product

1. An authenticated, activated Merchant Owner starts product creation in their own tenant.
2. The owner supplies an Arabic name, positive EGP base price, one or more images with exactly one primary image, one or more authorized categories, optional Arabic description, and an explicit availability choice.
3. The backend validates tenant ownership, permission, required information, monetary input, media reference, category reference, and availability value.
4. The product is created within the authenticated merchant tenant.
5. The owner receives the resulting current product representation.

Whether product/media creation is atomic and how failed uploads are cleaned up remain OPEN.

### UC-P02 — View and list owned products

1. The authenticated Merchant Owner requests products for their tenant.
2. The backend returns only products the owner is authorized to manage.
3. Active, unavailable, and archived records are distinguished according to approved filtering rules.

Search, sorting, pagination, filter defaults, and archived-product placement remain OPEN.

### UC-P03 — Edit product information

1. The authenticated Merchant Owner opens a product belonging to their tenant.
2. The owner edits allowed core information.
3. The backend validates all resulting required information, references, permission, and concurrency expectation.
4. The update does not rewrite historical order snapshots.

Rules for editing an archived product and price-change effects on carts remain OPEN.

### UC-P04 — Change availability

1. The owner changes a product between `Available` and `Unavailable`.
2. The backend validates ownership, permission, current lifecycle state, and allowed transition.
3. Future channel reads/selections follow the current authoritative state once those channel contracts exist.

Existing order snapshots are immutable; a saved browser cart is revalidated when submitted. Branch/channel overrides and Inventory-derived sold-out state remain OPEN.

### UC-P05 — Archive a product

1. The owner chooses to retire an owned product.
2. The backend validates permission and lifecycle transition.
3. The product becomes archived and unavailable for new selection under eventual channel rules.
4. Existing historical references remain valid.

Which fields remain editable while archived is OPEN.

### UC-P06 — Delete a never-used product

1. The owner requests permanent deletion of a product in their tenant.
2. The backend authoritatively verifies that the product has never appeared in an order and that no other approved rule prevents deletion.
3. If it has appeared in any order, deletion is rejected and archival remains available.
4. If it has never appeared in an order, permanent deletion is allowed under the approved cleanup and concurrency rules.

Related image cleanup, future configuration dependencies, audit behavior, and a race between deletion and order creation remain OPEN.

### UC-P07 — Restore an archived product

1. The owner requests restoration of an archived product in their tenant.
2. The backend validates ownership, permission, and transition eligibility.
3. The product is restored as `Unavailable`, regardless of its availability before archival.
4. Making it `Available` requires a separate explicit owner action and normal validation.

## 8. Validation and Business Rules

### 8.1 Confirmed rules

- A product belongs to exactly one authenticated merchant tenant at the ownership level.
- Only the Merchant Owner can perform initial product-management actions.
- Name, positive EGP base price, at least one image, and at least one category assignment are required.
- Multiple images are supported and exactly one must be primary.
- If the primary image is removed, the system automatically selects another remaining image as primary.
- A tenant-authorized media asset may be reused by more than one Product or Category.
- Multiple category links are supported.
- Description is optional.
- Initial authored content is Arabic.
- The owner explicitly chooses `Available` or `Unavailable` at creation.
- A product used in an order cannot be deleted; archival is the retirement mechanism.
- A never-ordered product may be permanently deleted after an authoritative check.
- An archived product may be restored and always returns as `Unavailable`.
- Backend validation and authorization are authoritative.

### 8.2 Baseline rules if implemented

- A category, image/media reference, or future related entity from another tenant must be rejected even if its ID exists.
- Unknown, archived, unauthorized, or otherwise invalid references must not be accepted under rules defined by their owning features.
- Client-supplied tenant ownership, price totals, timestamps, order-use claims, or authorization flags are never authoritative.
- Monetary input must use EGP, must be greater than zero, must avoid binary floating-point storage/calculation, and must follow the later approved precision policy.
- Blank required text after normalization must be rejected.
- Media count, file size, and format limits must be enforced by the backend once their numeric and format policy is approved.
- Validation failures must not leave a partially created product or orphan required image association.
- Concurrent edits must not silently overwrite one another once the concurrency strategy is approved.
- Archival and availability changes must not mutate historical order facts.

### 8.3 Rules still requiring decisions

- Arabic-script enforcement versus simply providing an Arabic content field and UX.
- Name and description length, whitespace, punctuation, emoji, and duplicate-name rules.
- Decimal scale and maximum price.
- Image validation, asset lifecycle, and automatic primary replacement.
- Display semantics and behavior when a linked category is archived.
- Allowed availability and lifecycle transitions beyond the confirmed creation/restoration behavior.
- Deletion cleanup and concurrency with order creation.
- Edit behavior for archived products.
- Cart/configuration revalidation after changes.

## 9. Edge and Failure Cases

- The owner submits an empty or whitespace-only name.
- The owner supplies malformed, negative, zero, excessive, or over-precision price input; zero and negative values are invalid.
- The required image upload/reference fails after other product information is entered.
- The image belongs to another merchant, is missing, fails scanning/processing, or was removed concurrently.
- The required category belongs to another merchant, is archived, or changes concurrently.
- Two products have the same Arabic name; duplicate policy is still OPEN.
- Two owner sessions edit the same product concurrently.
- Availability is changed while a customer has the product in a cart.
- Price or category changes while a customer configures the product.
- An archive request races with order creation.
- A delete request is attempted after the product appears in an order.
- An archived product is referenced by old orders or administrative reports.
- Merchant access/subscription changes while a product mutation is in progress.
- Future configuration records exist when a product is archived or considered for deletion.

The current checkout defines the minimum order snapshot/reservation path. Future full Orders, Pricing, Media, Categories, and Availability capabilities must define their additional cross-domain consistency behavior before those paths expand.

## 10. Conceptual Data and Architecture

The current restaurant MVP uses explicit Product, ProductImage, ProductCategory, ProductVariant, ProductModifierGroup, and ProductModifierOption records. StorefrontOrder, order-line, and selection records separately snapshot customer purchases. Variant stock is a simple optional count used for checkout reservation; this does not settle general Inventory integration, branch pricing, or attribute-defined variant combinations:

- Tenant-owned Product identity.
- Arabic product content for the initial version.
- Required base-price input linked to the authoritative pricing boundary.
- Required product media associations with exactly one primary image.
- One or more required category associations.
- Operational availability.
- Lifecycle/archival facts.
- Concurrency/version information.
- Creation/update attribution and any approved audit events.
- A safe indication or relationship that prevents deletion after order use, coordinated with Orders.

Strong tenant ownership, commercial relationships, lifecycle state, category/media association, and monetary inputs should not exist only inside unstructured JSON. JSONB may later hold validated flexible descriptive metadata if a concrete use case justifies it; this feature has not yet identified such a need.

### 10.1 Candidate backend boundary

The current implementation lives under `apps/api/src/modules/catalog/`. Owner product writes enforce authenticated tenant context; quote and storefront-order services are initially colocated in Catalog. A separate Orders boundary may be extracted when fulfillment, payments, or POS workflows expand.

This does not approve module files or service decomposition. A modular-monolith boundary is sufficient; no separate Catalog microservice is proposed.

### 10.2 Candidate frontend responsibility

The Merchant Dashboard now provides the first owner product-management workspace. It collects content, price input, Media references, category links, and availability, then displays backend validation results and lifecycle state. It must not decide authorization, cross-tenant validity, deletion eligibility, or authoritative pricing.

The customer Storefront and checkout MVP are implemented separately; POS UI and advanced product editing remain outside this slice.

## 11. Dependencies

| Dependency             | Need                                                                   | Current status                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Merchant/Tenancy       | Authenticated merchant ownership and isolation.                        | Merchant tenant and activated Owner session implemented; broader tenancy/access model incomplete.                                                                        |
| Categories (CAT-F01)   | One or more valid categories are mandatory at product creation/update. | Implemented with tenant-safe references, a two-level hierarchy, lifecycle actions, and multiple equal Product links.                                                     |
| Media                  | A valid image is mandatory.                                            | Reusable tenant-owned Media and owner image upload to configurable server disk are implemented; processing, cleanup, and external-provider lifecycle remain deferred.    |
| Pricing (CAT-F06)      | Positive EGP base-price validation and a configuration quote.          | Basic product/modifier quote and fixed-precision response are implemented; discounts, taxes, context pricing, and a separate Pricing domain remain deferred.             |
| Availability (CAT-F07) | Channel/public meaning of Available/Unavailable and Archived.          | Public catalog filters unavailable/archived products; quote and checkout validate current availability. Broader channel rules remain open.                               |
| Orders                 | Deletion prohibition after order use and historical snapshot.          | Pickup/delivery checkout, immutable lines, tracked-variant reservation, owner accept/reject, and deletion protection are implemented; full fulfillment remains deferred. |
| Activities & Modules   | Catalog compatibility metadata when capability is implemented.         | Registry exists; Catalog capability absent. Compatibility does not grant access.                                                                                         |
| Plans/Entitlements     | Commercial access if Catalog becomes plan-gated.                       | Plan definitions exist; assignment/entitlements absent and rules OPEN.                                                                                                   |
| Audit                  | Attribution/history for sensitive changes if required.                 | No general audit domain exists; scope OPEN.                                                                                                                              |

The mandatory category and image decisions are implemented through the minimal Categories and reusable Media boundaries. The dashboard supports product descriptions, explicit primary-image selection, archived views, restoration, and JPEG/PNG/WebP upload to configurable server disk. Image processing, durable deployment storage configuration, Storefront rendering, and channel behavior remain future work.

## 12. Acceptance Criteria

These criteria describe the currently confirmed behavior and baseline expectations for the backend slice. They do not authorize deferred UI or channel behavior.

### AC-P01 — Tenant and permission isolation

- An authenticated Merchant Owner can manage only products owned by their merchant tenant.
- A Merchant Owner cannot read or mutate another merchant's product by changing an identifier or request field.
- Merchant staff, public visitors, and ordinary merchant sessions without approved authority cannot use product-management actions.
- Activity compatibility or subscription metadata alone does not grant product permission.

### AC-P02 — Required information

- Creation is rejected unless a nonblank Arabic product name, positive EGP base price, one or more valid images with exactly one primary image, one or more valid categories, and an explicit availability choice are supplied.
- Description may be omitted without inventing placeholder content.
- All related references are validated by the backend for the authenticated tenant.
- Invalid input creates no partial Product state.

Arabic validation details, price precision/bounds, image validity/limits, and category lifecycle/display semantics must be refined after the corresponding open decisions.

### AC-P03 — Availability

- The owner can set an owned, non-archived product to `Available` or `Unavailable` through the eventual approved action.
- Unknown state values and invalid transitions are rejected by the backend.
- Availability does not override archival, permission, entitlement, or future stock/channel restrictions.

### AC-P04 — Historical safety and archival

- A product that has appeared in an order cannot be permanently deleted.
- A product that has never appeared in an order may be permanently deleted after the backend verifies eligibility.
- The owner can archive that product under the approved lifecycle rules.
- The owner can restore an archived product, and the restored product is always `Unavailable`.
- Archival prevents future selection under later approved Storefront/POS rules without breaking historical references.
- Editing, unavailability, or archival never rewrites historical order snapshots.

### AC-P05 — Generic Product Core

- A simple product such as bottled water can be represented with the required core information and without dummy variants or modifiers.
- No restaurant-only product field is required by the core Product definition.
- Simple products need no variants or modifier groups. Explicit sellable variants have their own quote price; SKU, barcode, and stock remain optional. Variant Attributes are generic dimensions and values. Modifier Groups are reusable tenant-owned definitions connected by product-specific assignments. Automatic attribute-combination generation, broader selling units, Inventory, and activity extensions remain deferred.

### AC-P06 — Backend authority

- Frontend values cannot override tenant ownership, permission, deletion eligibility, or authoritative monetary validation.
- Invalid cross-product or cross-tenant future configuration references are rejected when those capabilities are introduced.

## 13. Risks and Guardrails

- **Required-image dependency:** Treating image upload as a trivial Product field would couple Product transactions to an unselected storage mechanism. Define Media behavior before implementation.
- **Category dependency cycle:** Products is the first conceptual analysis, but mandatory category assignment requires a minimal Categories specification before Products can be built.
- **Availability ambiguity:** `Available` must not accidentally mean published, in stock, branch-open, entitled, or visible in every channel.
- **Archive ambiguity:** Restoration is confirmed as `Unavailable`, but archived edit/query behavior still needs a decision; archival cannot be implemented as physical deletion.
- **Arabic-content ambiguity:** Arabic-first content should not lead to irreversible field design before future localization strategy is understood.
- **Premature price design:** A required base price does not approve taxes, discounts, price overrides, or a full Pricing implementation.
- **Restaurant coupling:** Menu-specific terminology and kitchen/recipe fields must stay out of Product Core.

## 14. Remaining Product Questions

The primary Product decisions from the first two rounds are confirmed. The following details remain open and should be resolved with Categories, Media, Pricing, and Product lifecycle discovery:

1. How do equal category links affect storefront grouping/order, especially when a product appears in several categories?
2. What numeric maximum image count, file size, and accepted formats should Media enforce, and which dimensions, storage, processing, and cleanup rules apply?
3. What decimal precision and maximum EGP base price are allowed?
4. Are duplicate product names allowed within one merchant, and what text length/normalization rules apply?
5. Does “Arabic content” require Arabic-script validation, or does it define the initial content field/UX without rejecting names such as brands written in Latin characters?
6. Which fields can be edited while a product is archived?
7. What atomicity/concurrency rule prevents an order from being created while a never-ordered product is being permanently deleted?
8. What happens to active carts/configurations after product content, price, availability, categories, or images change?

Categories and reusable Media references are implemented in the first backend slice, including initial local-disk image upload; processing, cleanup, external storage, and remaining Product behavior still require focused discovery before expansion.

## 15. Documentation and Approval Path

1. Analyze minimal Categories because one or more category assignments are mandatory.
2. Analyze minimal Product Media because one or more images and exactly one primary image are mandatory.
3. Return to Products to close remaining validation, lifecycle, and dependency behavior.
4. Validate the backend and Merchant Dashboard slice, then seek approval before adding Storefront/POS projections or deferred domain features.
5. Keep additional implementation behind the documented feature sequence.

**Current authorization boundary:** minimal backend models, owner APIs, Merchant Dashboard management UI, and automated validation for Products, Categories, and reusable Media references.
