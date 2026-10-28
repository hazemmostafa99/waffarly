# Waffarly (وفّرلي) — Project Overview

> **2026-10-28 subscription update:** Independent EGP prices for 1/3/6/12/24-month terms and merchant subscription administration are implemented. Manual external collection remains required; no provider or automatic renewal is introduced. Current access, expiry and legacy-review rules are in [Merchant subscriptions](docs/features/super-admin/plans-subscriptions/SUBSCRIPTIONS.md), superseding earlier monthly-only/open lifecycle statements below.

> **Scope correction — 2026-10-13:** The product owner clarified that Waffarly serves different business activities, including clothing stores, supermarkets, restaurants, and other businesses. This supersedes earlier restaurant-only launch restrictions in this working draft. Shared merchant registration, profiles, plans, and branding must remain activity-neutral. Restaurant order acceptance and kitchen flows apply to restaurants; specialized operations for other activities still need their own scope decisions.

> **Document status:** Working draft v0.2 — first-release direction and core technology decisions recorded; unresolved requirements remain explicitly marked.
>
> **Last updated:** 2026-10-13  
> **Purpose:** Single starting reference for project discovery, architecture, feature breakdown, planning, and implementation.  
> **Important:** This document is **not** a finalized PRD, a complete MVP feature list, or a final database schema. Confirmed first-release decisions are listed below; anything marked **[OPEN]**, **[PROPOSED]**, or **[FUTURE SCOPE TO CONFIRM]** is not an approved requirement or an implementation decision.

## 1. Decision status legend

| Marker | Meaning |
| --- | --- |
| **[CONFIRMED]** | Explicitly stated or agreed upon in the project discussions. |
| **[PROPOSED]** | Suggested implementation approach; needs approval before being treated as a decision. |
| **[OPEN]** | A question or unresolved product/technical rule. |
| **[FUTURE SCOPE TO CONFIRM]** | Part of the platform vision, but release timing and detail are undefined. |

**Rule for everyone using this file:** Do not infer an implementation detail from a high-level feature. Put unresolved rules into the decision log and ask for clarification before building that feature.

---

## 2. Product vision

**Waffarly** is a **multi-merchant, multi-tenant SaaS commerce and business-operations platform**. It enables merchants in different business activities to operate their own branded digital storefronts and manage products, orders, inventory, employees, point of sale (POS), branches, and business finances through shared platform infrastructure.

The platform is managed centrally by **Waffarly Super Admin**, while each merchant has a logically independent **tenant/workspace** with its own business settings, users, branches, permissions, and operational records.

The platform's distinctive capability is a **configuration-driven, dynamic product builder**: merchants can define different kinds of products, variants, units, options, and customizations from the dashboard rather than requiring a new hard-coded product implementation for every industry.

Waffarly supports several commercial arrangements between the platform and merchants: **subscriptions, commissions on eligible sales, or a hybrid of both**. Specific formulas and financial rules remain open.

### 2.1 High-level goals [CONFIRMED]

- Manage many merchants from one platform.
- Support multiple business activities with activity-specific modules and capabilities.
- Let a merchant configure products and customer-facing offerings with substantial flexibility.
- Provide independent merchant branding, storefront identity, and potentially custom domains.
- Support both online and in-store operations, with shared core commerce data.
- Support staff accounts and granular role-based permissions.
- Gate enabled modules and usage capabilities based on a merchant's commercial plan.
- Provide a central platform administration system for merchant lifecycle and billing configuration.
- Track important operations and changes with auditability.

### 2.2 First-release direction [CONFIRMED]

These decisions were explicitly provided by the project owner on **2026-10-13**. They constrain planning, but **do not** constitute a complete list of MVP features.

| Area | Confirmed decision | Boundary / clarification |
| --- | --- | --- |
| Business activities | **Multiple activities** | Restaurants, clothing stores, supermarkets, and other businesses share the platform foundation. Specialized operational modules are scoped per activity. |
| Initial market | **Egypt** | Currency, tax rules, and delivery/payment mechanics are not yet specified. |
| Backend stack | **NestJS + PostgreSQL + Prisma** | Exact versions, deployment, and infrastructure choices remain open. |
| Public merchant storefronts | **Next.js** | Storefront template count, PWA scope, and domain behavior remain open. |
| Super Admin, merchant dashboard, and POS | **React-based dashboards** | SPA tooling (e.g. Vite) is proposed, not explicitly approved; whether POS is a standalone app is open. |
| Restaurant online orders | **Incoming orders must reach the cashier/POS and be explicitly accepted by a cashier before entering the kitchen preparation flow.** | Rejection/timeout handling and kitchen screen or printer design remain open. |
| POS connectivity | **Online-first; offline POS is deferred from the initial release.** | Offline sales/sync can be evaluated in a later phase. |
| Merchant commercial model | **Monthly subscription for the initial release.** | Plan prices, entitlements, lifecycle, and collection procedure are still open. |
| Payment integrations | **No payment gateway/provider integration is planned for the initial release.** | Customer checkout/payment handling and merchant subscription collection details remain undecided; do not infer cash-on-delivery or any other payment method. |

**Scope discipline:** Restaurant-first does not automatically approve every restaurant feature (tables, kitchen display, recipes, delivery logistics, etc.) for the MVP. Those require separate scope decisions.

### 2.3 Deferred decisions and non-goals

- **[CONFIRMED deferred for first release]** Offline-capable POS and offline synchronization.
- **[CONFIRMED deferred for first release]** Payment gateway/provider integration, including automated online collection of merchant subscriptions.
- **[OPEN]** Exactly which kitchen features, finance tools, order fulfillment modes, storefront capabilities, and subscription administration actions ship on day one.
- **[FUTURE SCOPE TO CONFIRM]** Clothing, electronics, grocery, marketplace, commission/hybrid monetization, and other capabilities remain part of the platform vision without an approved release schedule.

No permanent platform-level exclusions have been approved. Being outside the initial release does not mean the capability has been rejected.

---

## 3. Platform users and interfaces

| Actor / interface | Responsibility | Status |
| --- | --- | --- |
| **Waffarly Super Admin** | Manage merchants, activation status, activities, modules, plans, templates, subscriptions, and commissions. | [CONFIRMED] |
| **Merchant Owner** | Own and manage a merchant tenant, its storefront, business settings, and staff. | [CONFIRMED] |
| **Branch Manager** | Operate one or more assigned branches within granted permissions. | [CONFIRMED] role concept; exact scope [OPEN] |
| **Cashier** | Use POS, handle in-store sales, and **review/accept incoming restaurant online orders before kitchen preparation**. | [CONFIRMED] acceptance responsibility; detailed rejection/escalation flow [OPEN] |
| **Inventory Manager** | Control/observe inventory based on permissions. | [CONFIRMED] |
| **Accountant** | Access cash, expenses, sales, and finance/reporting features as permitted. | [CONFIRMED] |
| **Customer Service Staff** | Work with customer/order operations as permitted. | [CONFIRMED] |
| **Customer / Buyer** | Browse a merchant storefront, configure products, and place orders. | [CONFIRMED] |
| **Kitchen Staff / KDS** | Receive restaurant orders **only after cashier acceptance**, then support preparation as configured. | [CONFIRMED] workflow ordering; whether an actual KDS app/screen ships first [OPEN] |

A merchant can have multiple employees. **[OPEN]** Whether one global user identity may belong to multiple separate merchant tenants, and whether staff can belong to several branches simultaneously, needs final confirmation.

---

## 4. Major product domains

### 4.1 Platform administration [CONFIRMED]

The Waffarly Super Admin experience includes:

- Merchant application/registration review and merchant lifecycle actions: **approve, reject, suspend, reactivate**.
- Business activity definitions (e.g., clothing, restaurants, electronics, supermarkets).
- Platform module catalog and mapping modules to business activities.
- Design/template library associated with activities.
- Pricing plans, subscription models, commissions, and hybrid commercial models.
- Platform visibility and control over merchant status and available capabilities.

**[OPEN]** Detailed application approval requirements, onboarding verification, trial policies, invoicing, settlement, and dispute processes.

### 4.2 Merchant workspace [CONFIRMED]

Each tenant may configure:

- Business profile and public storefront information.
- Logo, icon, colors, and visual identity.
- Activity-appropriate storefront template/style.
- Storefront URL/subdomain and custom domain capability.
- Branches, contact details, and communication channels.
- Staff accounts, role assignments, and branch access.
- Catalog, product customization, inventory, orders, POS, and financial features that are entitled for the tenant.
- A potentially installable **PWA storefront**.

**[OPEN]** Rules for custom domain verification, supported template customization, publishing workflows, multilingual content, and merchant self-service onboarding.

### 4.3 Commerce core [CONFIRMED]

- Shared catalog/products with images, pricing, variants, and merchant-defined configurations.
- Inventory per relevant branch and tracked stock movements/alerts.
- Customer orders from a merchant's online store, including pickup/delivery concepts.
- In-store sales using the POS against the same underlying commerce and inventory model.
- Returns/refunds support as part of the operations vision.
- Order status management; payment/collection workflows are part of the broader vision but **not yet specified for the initial release**.

**Core principle:** The online storefront and POS are **channels/interfaces**, not separate conflicting product or inventory sources of truth.

### 4.4 POS and branch operations [CONFIRMED vision]

- Direct in-store sales.
- Cashier workflows, **including mandatory acceptance of incoming restaurant online orders before kitchen preparation** (whether/how rejection is supported remains open).
- Shifts and shift-related cash operations.
- Returns.
- Offline selling remains a longer-term platform goal.

**[CONFIRMED first release]** POS is **online-first**; offline sales and synchronization **are not an MVP requirement**.

**[OPEN]** Whether POS is a separate React app or a feature inside the merchant dashboard; first-release receipt printers, kitchen printers, payment devices, barcode scanners, cash drawers, and the precise scope of shifts/returns.

### 4.5 Finance / accounts [CONFIRMED vision]

- Cash accounts/treasury.
- Expenses.
- Profit and business reporting.
- Revenue-related merchant/platform accounting concerns.

**[OPEN]** Whether the platform needs bookkeeping-only summaries or full double-entry accounting, taxes, multi-currency, cost of goods sold, and formal statements.

### 4.6 Sales channels [CONFIRMED]

1. **Merchant storefront:** Branded storefront with independent identity and URL.
2. **Waffarly public marketplace:** Optional merchant participation, possibly with additional subscription fees or commissions.
3. **In-store POS:** Shares core catalog/order/inventory services with other channels.

**[OPEN]** Marketplace mechanics: one-merchant checkout vs multi-merchant cart; marketplace-owned checkout; product visibility rules; merchant/branch fulfillment; marketplace fee calculation; and launch phase.

### 4.7 Activity-specific business capabilities [CONFIRMED vision]

| Activity | Relevant concepts |
| --- | --- |
| Clothing | Sizes, colors, product variations, exchanges. |
| Restaurants | Menu, product additions/modifiers, tables, kitchen workflows. |
| Electronics | Serial numbers, warranty, installation. |
| Supermarkets | Weight-based items, expiration dates, barcodes. |

The platform must have a **shared core** plus **specialized modules** where the operational semantics differ. An activity is not intended to force every merchant into a rigid, non-configurable product form.

---

## 5. Dynamic Product Builder — core product capability

### 5.1 Required outcome [CONFIRMED]

A merchant must be able to configure a product with different combinations of capabilities **without developer intervention for ordinary product customization**.

Examples:

- Burger: Small/Medium/Large, sauces, add-ons, optional extra cheese.
- Pizza: sizes, crust choices, toppings.
- T-shirt: sizes and colors, with distinct stock-keeping combinations when relevant.
- Rice or grocery item: quantity measured by weight.
- Bottled water: simple item with no extra choices.
- Appliance: options like installation plus specialized warranty/serial tracking modules.

### 5.2 Product Builder conceptual model [CONFIRMED]

| Concept | Responsibility | Example |
| --- | --- | --- |
| **Product** | Stable catalog identity and public description. | Classic Burger |
| **Variant** | An optional sellable configuration with its own identity and authoritative price. SKU, barcode, and stock are optional. | Large Burger; Black T-Shirt / XL |
| **Variant Attribute** | A generic dimension and value used to describe a variant configuration. | Size: Large; Color: Black |
| **Modifier Group** | A reusable, tenant-owned customer selection group attached to products through a product-specific assignment. | Sauces, toppings, bread type |
| **Modifier Option** | A selectable choice in a shared group; V1 fixed price adjustment/default selection are configured per product assignment. | BBQ sauce, extra cheese |
| **Selling Unit** | Quantity basis. | Piece, kilogram, liter |
| **Product Metadata** | Additional validated flexible characteristics. | Fabric composition, descriptive product details |

**Distinction:** Do not automatically generate a stock-tracked variant for every possible sauce/topping combination. Variants and modifiers serve different purposes and may have different inventory effects.

### 5.3 Product Builder operations [CONFIRMED]

- Merchant creates a product and gives it basic information and imagery.
- Merchant chooses the relevant selling mode and, if applicable, variants.
- Merchant creates reusable named modifier-group definitions and attaches them to products.
- Merchant controls selection constraints, order, defaults, and fixed option adjustments on each product assignment.
- Customer storefront and POS render product choices from the saved product configuration.
- Backend validates selected product/variant/options and calculates authoritative pricing.
- Orders preserve a snapshot of the purchased product configuration and prices, so later catalog edits do not rewrite past orders.

Optional variants do not require SKU, barcode, or stock. Restaurant sizes may be represented as variants with generic attributes. Modifier Groups are reusable across products belonging to the same merchant, while their selection rules/defaults/fixed adjustments are configured per assignment. V1 safely blocks shared-definition edits while a group is attached. The initial storefront presents one parent product with selectable variants beneath it.

**[OPEN]** Conditional option visibility, dependencies between options, defaults, max quantity per option, availability by branch/time, recurring add-ons, bundles/combo meals, tax treatment, and price overrides by branch/channel.

### 5.4 Storage direction [PROPOSED]

PostgreSQL relational tables for entities with strong relationships, stock effects, and commercial significance; PostgreSQL `JSONB` for suitable validated flexible attributes/configuration. Prisma is used for typed database access.

**Do not** place money, stock movement history, serial tracking, financial ledger, or critical order lifecycle exclusively in unconstrained JSON blobs.

**[OPEN]** Final product ERD/schema, product versioning, and cross-activity option reuse.

---

## 6. Order lifecycle and restaurant operations

### 6.1 Unified order principle [PROPOSED implementation; first-release restaurant acceptance rule CONFIRMED]

The system has one **Orders domain** with source/channel context such as online storefront, POS, or marketplace. Different interfaces operate on the same persisted order and its permitted state transitions.

Illustrative sequence for a restaurant:

1. A buyer configures products and places an online order through the merchant storefront.
2. Backend validates merchant, branch, availability, selected configurations, pricing, and applicable checkout requirements (**customer payment handling remains [OPEN]**).
3. Backend persists the order and its line-item configuration snapshots.
4. The **correct restaurant branch's cashier/POS receives and can retrieve the incoming order**.
5. A **cashier explicitly accepts the order**. **It must not proceed to kitchen preparation before that acceptance.**
6. After acceptance, the kitchen-facing workflow receives the order according to the eventual kitchen UI/printing design.
7. Kitchen staff prepare the order; the system records progress.
8. Branch and customer interfaces show the relevant updated statuses.

The same order must remain available after a client disconnects. **Database persistence is authoritative; realtime messages are notifications of changes, not the data store.**

### 6.2 POS vs order management vs kitchen display

- **POS:** In-store checkout and cashier workflows; **must surface incoming online restaurant orders for cashier acceptance in the first release**.
- **Order Management:** Shared operational order lifecycle; it may be surfaced within the POS or another authorized dashboard.
- **Kitchen Display (KDS):** Restaurant-specific preparation screen if included; **any kitchen dispatch must follow cashier acceptance**.

**[CONFIRMED]** Cashier acceptance of each incoming online restaurant order is mandatory before kitchen preparation; automatic kitchen routing without acceptance is **not** the first-release workflow.

**[OPEN]** Whether incoming orders also appear on other dashboards; whether first-release kitchens use KDS, printer tickets, or another view; what happens on rejection, cancellation, cashier absence/timeout, and branch availability.

### 6.3 Realtime updates [PROPOSED]

NestJS realtime gateway (for example WebSocket/Socket.IO) with authenticated tenant/branch channels; initial API loading plus reconnect/refetch behavior; reliable publishing of committed order changes. Specific transport/infrastructure is not yet approved.

### 6.4 Critical order/inventory invariants [REQUIREMENTS TO VALIDATE]

- An actor must not view or act upon another merchant's orders without authorized cross-tenant access.
- All commerce channels use a consistent interpretation of product availability and inventory.
- A buyer-supplied price is never the authority for totals.
- Payment acknowledgement must be idempotent and verify provider status where applicable.
- Order state changes must be explicitly allowed and audited.
- Stock reservation/deduction and order creation must define their transactional consistency boundary.

**[OPEN]** Detailed order statuses, inventory reservation timing, customer payment/checkout handling (no provider integration approved), rejection/cancellation behavior, delivery/pickup rules, tipping/service fees, and return/restock policies.

---

## 7. Tenancy, users, RBAC, and feature entitlements

### 7.1 Tenants [CONFIRMED]

Each merchant is a **Tenant** with logical ownership of its business data. `tenant_id` on tenant-owned operational data is part of the original architectural requirement.

**[PROPOSED]** Begin with shared PostgreSQL infrastructure and tenant-scoped tables where appropriate. Explicitly enforce tenant ownership in queries and relationships; optionally adopt PostgreSQL row-level security as defense-in-depth. This is a deployment/security design proposal, **not** a confirmed isolation strategy.

### 7.2 Roles and permissions [CONFIRMED]

Roles mentioned for merchant workspaces: **Owner, Branch Manager, Cashier, Inventory Manager, Accountant, Customer Service**.

The underlying access model is **RBAC**: users see and perform only what their granted permissions allow. Branch-aware data access may be required.

**[OPEN]** Editable custom roles, user membership in multiple tenants, branch scope rules, owner transfer, and Super Admin impersonation/support access.

### 7.3 Feature entitlements [CONFIRMED]

Separate **permission** from **plan entitlement**:

- **Permission:** May this employee perform this action?
- **Entitlement:** Is this module/feature/usage limit included for the merchant?

Both are enforced server-side. Frontend visibility reflects permissions/entitlements but cannot be the only enforcement mechanism.

---

## 8. Merchant monetization and subscription engine

### 8.1 Commercial models and release boundary

**Implementation update, 2026-10-13 — PS-D04:** The owner authorized both documentation and app implementation of [basic monthly-plan administration](docs/features/super-admin/plans-subscriptions/MONTHLY_PLAN.md). Super Admin can create/list/edit definitions with administrator-entered name, decimal price, currency, and optional description. This does not approve or implement merchant assignment, entitlements, renewal, expiry, or collection.

**[CONFIRMED, 2026-10-13 — PS-D02]:** Launch will offer multiple monthly subscription plans for restaurants. The owner selected “multiple plans” during [Plans & Subscriptions discovery](docs/features/super-admin/plans-subscriptions/OVERVIEW.md). Exact count, names, differences, prices, currency/tax treatment, and catalog governance remain **[OPEN]**. This scope decision does not authorize implementation or finalize subscription lifecycle rules.

- **Monthly subscription — [CONFIRMED first release]:** The first release uses a monthly merchant subscription model. **No payment gateway/provider is integrated initially.** How Super Admin records payment, activates access, and renews/suspends accounts is **[OPEN]**; do not assume manual payment confirmation or automatic renewal.
- **Commission — [FUTURE SCOPE TO CONFIRM]:** Percentage calculated on qualifying sales according to rules to be approved later.
- **Hybrid — [FUTURE SCOPE TO CONFIRM]:** Subscription combined with commission/add-ons.
- **Marketplace participation — [FUTURE SCOPE TO CONFIRM]:** May have a separate commercial model.

**The billing model and the mechanism that actually collects money are different decisions.** Confirming monthly subscription does not approve a gateway, invoice process, fee amount, or subscription state machine.

### 8.2 Rules requiring a business decision [OPEN]

- Monthly subscription activation, expiry/renewal, trials, grace period, failed/non-payment handling, and suspension behavior.
- What exactly counts as a commissionable transaction; online, marketplace, POS, or different rules per channel.
- Commission base: gross, net of discount, net of tax/fees, after refunds, etc.
- Customer checkout/payment approach and, in any later payment-integrated phase, whether Waffarly or merchants collect customer funds.
- Any future provider selection, provider fees, settlement/payout process, and whether they are needed at all.
- Limits on staff, branches, products, orders, storage, or other metrics.
- Add-on billing, mid-cycle upgrades/downgrades, proration, and invoices.

Do not implement a provider integration or invent a payment-collection workflow until these rules are confirmed. First-release subscription entitlements may be modeled without a gateway, but activation/renewal rules must still be specified.

---

## 9. Technology decisions

| Area | Technology / direction | Decision status |
| --- | --- | --- |
| Backend | **NestJS** with TypeScript | **[CONFIRMED]** |
| Primary database | **PostgreSQL** | **[CONFIRMED]** |
| ORM | **Prisma** | **[CONFIRMED]** |
| Public storefront frontend | **Next.js** | **[CONFIRMED]** |
| Super Admin dashboard | **React** (SPA) | **[CONFIRMED]** |
| Merchant dashboard | **React** (SPA) | **[CONFIRMED]** |
| POS frontend | **React** (SPA) | **[CONFIRMED]**; standalone app vs embedded feature [OPEN] |
| Dashboard build tooling | Vite candidate for React SPAs | **[PROPOSED]**; not explicitly selected |
| **Frontend styling & UI components** | **Tailwind CSS v4 + shadcn/ui** (all frontends) | **[CONFIRMED]** |
| Initial business activity | Restaurants | **[CONFIRMED]** |
| Initial market | Egypt | **[CONFIRMED]** |
| First-release POS connectivity | Online-first; offline deferred | **[CONFIRMED]** |
| First-release commercial model | Monthly subscription, without automated payment gateway collection | **[CONFIRMED]**; administration details [OPEN] |
| Repository layout | Monorepo | **[PROPOSED]** from earlier architecture discussion |
| Backend deployment topology | Modular monolith first | **[PROPOSED]**; not a final commitment |
| Realtime transport | NestJS WebSocket gateway / Socket.IO candidate | **[PROPOSED]** |
| Cache / jobs | Redis and background queue, if required | **[PROPOSED]** |
| Media storage | Object storage | **[OPEN]** provider and implementation |
| Authentication/session approach | To be selected | **[OPEN]** |
| Payment provider(s) | **No provider integration in first release** | **[CONFIRMED]** deferral; eventual choice [OPEN] |
| Hosting, CI/CD, observability | To be selected | **[OPEN]** |

### 9.1 Frontend framework split [CONFIRMED, with tooling details OPEN]

- **Next.js** for public merchant storefronts.
- **React SPAs** for Super Admin, Merchant Dashboard, and POS.
- **[PROPOSED]** Vite as the React SPA build tooling. Its use has not been explicitly approved.
- **[OPEN]** Whether POS ships as a separate application/deployment or as an embedded experience in Merchant Dashboard.

This is a product/team architecture choice, not a blanket claim that React SPA will always outperform Next.js. Shared UI components and API contracts may be placed in packages if the monorepo is approved.

### 9.2 Version policy [OPEN]

Do not assume exact NestJS, Next.js, React, PostgreSQL, Prisma, or Node.js versions from this document. Pin supported versions after compatibility verification when project setup begins.

---

## 10. Candidate codebase structure [PROPOSED — not yet approved]

A modular monorepo could look like this; apps not required for the first release should not be created prematurely.

```text
waffarly/
├── apps/
│   ├── api/                        # NestJS backend
│   ├── storefront/                 # Next.js public merchant storefronts
│   ├── super-admin/                # React SPA — CONFIRMED; tooling open
│   ├── merchant-dashboard/         # React SPA — CONFIRMED; tooling open
│   ├── pos/                        # React SPA; separate app vs embedded feature OPEN
│   └── marketplace/                # Separate app vs storefront experience — OPEN
├── packages/
│   ├── database/                   # Prisma schemas, migrations, DB client
│   ├── contracts/                  # Shared API DTO/validation contracts
│   ├── ui/                         # Shared components, if useful
│   ├── utils/
│   └── config/
├── infrastructure/                 # Deployment configuration
├── docs/
│   ├── decisions/
│   ├── features/
│   ├── architecture/
│   └── database/
└── scripts/
```

### 10.1 NestJS backend module organization [PROPOSED]

```text
apps/api/src/
├── main.ts
├── app.module.ts
├── common/                        # Shared guards, filters, interceptors, decorators
├── infrastructure/                # Database, storage, queues, realtime adapters
├── modules/
│   ├── identity/                  # Authentication and user identity
│   ├── tenancy/                   # Tenants, memberships, branches
│   ├── access-control/            # RBAC and authorization
│   ├── platform/                  # Activities, registry, plans, subscriptions, entitlements
│   ├── merchant/                  # Profiles, branding, domains, staff
│   ├── catalog/                   # Products, variants, attributes, modifiers, units
│   ├── pricing/                   # Product/option prices and quote calculation
│   ├── inventory/                 # Branch stock, reservations, movements
│   ├── orders/                    # Orders and lifecycle
│   ├── payments/                  # Future/conditional domain; no first-release gateway
│   ├── pos/                       # Sales, shifts, cash operations
│   ├── finance/                   # Expenses, cash accounts, reporting/ledger if approved
│   ├── activities/                # Restaurant, apparel, electronics, grocery extensions
│   ├── marketplace/               # Marketplace business rules
│   ├── notifications/
│   └── audit/
└── workflows/                      # Cross-module use cases; organization may evolve
```

Inside a NestJS feature, prefer a **feature module** with controllers/providers and an explicit public API. Example:

```text
catalog/products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── products.repository.ts          # Only if the abstraction is useful
├── dto/
├── policies/
└── tests/
```

Keep merchant isolation, permission checks, and entitlement checks on the backend. Modules should not directly reach into another module's private database implementation without an agreed interface. Shared Prisma schema placement is a code organization choice, not an excuse to bypass domain boundaries.

### 10.2 Application integration [PROPOSED]

```text
Merchant Storefront ─┐
Merchant Dashboard ──┼──► NestJS API ──► PostgreSQL / Prisma
Super Admin ─────────┤          │
POS / Kitchen View ──┘          ├──► Realtime delivery (choice open)
                               └──► Jobs / integrations (as needed)
```

The backend is the source of truth for pricing, permissions, order state, and inventory. Frontends do not directly connect to the operational PostgreSQL database.

---

## 11. Data design principles for later ERDs [PROPOSED unless explicitly indicated]

- Use **relational models** for tenants, memberships, branches, products, variants, modifiers, orders, payments, inventory movements, subscriptions, and financial records.
- Use flexible **JSONB** only where it suits configurable data and can still be validated and queried safely.
- Preserve `tenant_id` on tenant-owned operational data, as specified in the initial concept **[CONFIRMED]**.
- Consider composite uniqueness/foreign-key strategies that prevent references across different tenants **[PROPOSED]**.
- Represent prices/money with correct monetary precision rather than floating-point values **[PROPOSED]**.
- Preserve historical order line snapshots, payment state history, and audit events **[PROPOSED]**.
- Define authoritative stock transitions (available, reserved, sold, returned, adjusted) before building inventory **[OPEN]**.
- Specialized activity modules may use dedicated tables for recipes, expiry batches, serials/warranties, or other operational concepts **[PROPOSED]**.

**A physical ERD, migrations, complete enums, pricing rules, and entity ownership will be defined only after relevant open questions are answered.**

---

## 12. Security, reliability, and operational expectations

These are foundational engineering expectations, not a complete security design:

- **Tenant isolation:** Server-validated tenant context and explicit checks on tenant-owned data.
- **Authentication and authorization:** Restrict endpoints, data visibility, roles, and branch scope.
- **Feature entitlement enforcement:** Prevent use of disabled modules on the server.
- **Validation:** Validate user input and product configuration before storage or checkout.
- **Transactional consistency:** Protect critical order, stock, and financial updates.
- **Idempotency:** Protect sensitive operations such as checkout confirmation, payment callbacks, and retried requests against duplication.
- **Audit trails:** Record material changes and sensitive business actions.
- **Operational visibility:** Logging, error handling, backups, monitoring, and incident procedures before production.
- **Privacy/security rules:** Local legal/data-retention requirements are **[OPEN]**, not presumed.

No specific vendor or implementation is approved by this section.

---

## 13. Feature map for decomposition

These are **feature groups**, not implementation tickets or an approved release scope. Each group should later be broken into: requirements, business rules, user stories, permission matrix, data model, API contracts, UI flows, tests, and edge cases.

| ID | Feature group | Dependencies / questions |
| --- | --- | --- |
| CORE-01 | Identity and authentication | Auth/session method open |
| CORE-02 | Tenant registration and lifecycle | Registration approval process open |
| CORE-03 | Memberships, employees, RBAC | Multi-tenant identity, branch scopes open |
| CORE-04 | Merchant branches | Branch routing/stock scope open |
| SAAS-01 | Activities and module registry | Module catalog and activation semantics |
| SAAS-02 | Plans and entitlements | Limits/upgrade rules open |
| SAAS-03 | Monthly merchant subscription for launch; later commission/hybrid models | Gateway deferred; plan activation and renewal rules open |
| MER-01 | Merchant profile and branding | Theme customization scope open |
| MER-02 | Storefront domain and PWA | Domain onboarding and offline/PWA expectations open |
| CAT-01 | Categories and products | Core catalog rules |
| CAT-02 | Dynamic Product Builder | Variants, option groups, units, validation |
| CAT-03 | Product configurator and pricing | Branch/channel pricing, tax open |
| INV-01 | Inventory and movements | Stock reservation and costing open |
| ORD-01 | Cart and checkout | Customer identity, delivery, payment open |
| ORD-02 | Unified orders and order management | State machine, branch routing open |
| ORD-03 | Online restaurant order appears in cashier POS; acceptance before kitchen | Realtime transport, rejection handling, kitchen interface open |
| POS-01 | In-store sales | Payment/receipt/hardware rules open |
| POS-02 | Cashier shifts and returns | Shift close/reconciliation rules open |
| POS-03 | Offline POS [DEFERRED] | Not required in the first release; later sync/conflict policy open |
| FIN-01 | Cash accounts and expenses | Full accounting scope open |
| FIN-02 | Financial reports and profits | Cost methodology, tax, refunds open |
| ACT-01 | Apparel extensions | Exchange/stock variant rules |
| ACT-02 | Restaurant extensions [FIRST ACTIVITY] | Which tables, kitchen UI, recipes, and modifiers ship initially is open |
| ACT-03 | Electronics extensions | Serials, warranty, installation |
| ACT-04 | Grocery extensions | Weighted goods, expiry batches, barcode |
| CH-01 | Merchant storefront | Template selection and publish behavior |
| CH-02 | Public marketplace | Checkout and commission semantics open |
| OPS-01 | Notifications | Channels/triggers/open |
| OPS-02 | Audit logs | Retention, access, critical events open |

### 13.1 First-release guardrails [CONFIRMED]

- **Restaurant-first**; do not infer support for other business activities at launch.
- **Online restaurant orders must be visible in POS and explicitly accepted by the cashier before kitchen dispatch.**
- **Online-first POS:** no offline sale/sync requirement for the first release.
- **Monthly merchant subscription:** no gateway/provider integration for first-release subscription collection.
- **No initial payment-provider integration:** the customer's checkout and payment method are not yet decided.
- **Frontends:** Next.js storefront and React SPA dashboards/POS; standalone POS deployment and React tooling remain open.

**Not yet approved as MVP scope:** Full KDS, table management, ingredient/recipe deduction, delivery integration, online payment methods, invoicing, accounting depth, and marketplace. Their status must be settled in feature specs rather than presumed included or excluded permanently.

### 13.2 Suggested order of architectural discovery [PROPOSED]

1. Tenant lifecycle, identity, membership, branch roles, and data isolation.
2. Activity/module registry, plan entitlement rules, and subscription boundaries.
3. Dynamic Product Builder model and product validation/pricing.
4. Inventory ownership/stock transitions.
5. Online checkout, unified orders, and branch order distribution.
6. POS and restaurant operational workflows.
7. Finance/settlement details and marketplace-specific workflows.

**No detailed release sequence or delivery date has been approved.** The first activity, frontend split, cashier acceptance, POS connectivity, initial market, and monthly subscription model are now confirmed; specific first-release features and operational rules still need approval.

---

## 14. Representative end-to-end user journeys

### Journey A — Merchant onboarding

Super Admin defines supported activities and plans → merchant signs up/applies → platform approves/activates merchant → merchant configures branding/branches/staff → merchant gains access to modules included in its plan.

**Unresolved:** Automation vs manual approval, immediate access during review, plan/trial/payment timing.

### Journey B — Merchant creates a custom product

Merchant creates product → selects unit/variants → defines arbitrary modifier groups and choices → sets prices and applicable selection rules → saves/publishes → storefront and POS display the appropriate configuration → server validates actual customer selections.

**Unresolved:** Draft/publish lifecycle, conditional options, branch-specific pricing/stock, availability schedules.

### Journey C — Restaurant online order

Customer browses restaurant storefront → chooses meal options → completes a checkout flow **whose payment method is still [OPEN]** → order persists in the unified order system → correct branch cashier sees the online order in POS → **cashier explicitly accepts the order** → kitchen preparation workflow receives the accepted order through a delivery mechanism **[OPEN]** → customer/merchant receive state changes.

**Unresolved:** Checkout/payment method, rejection/timeout, order statuses, kitchen interface, pickup/delivery operations.

### Journey D — In-store POS sale

Cashier uses the authorized POS interface (shift requirements **[OPEN]**) → selects products and configurations → server validates totals and stock → in-store sale is recorded according to checkout/payment rules **[OPEN]** → branch stock and reporting reflect the sale.

**Unresolved:** POS behavior when connection is lost (offline sales are not supported initially), receipt hardware, cash close, payment collection method and return handling.

### Journey E — Waffarly subscription/commission

In the **first release**, a merchant is associated with a **monthly subscription plan** → its feature entitlements are enforced → the administrative activation/renewal process (manual or otherwise) will be specified separately → **no payment gateway/provider integration** is performed.

**Unresolved:** How subscription status/payment is recorded, plan pricing, renewals, grace periods, suspension policies; later commission/hybrid fee rules and settlement.

---

## 15. Open decisions — questions to answer before finalizing this overview

### Confirmed answers — do not ask again

1. **Initial business activity:** Restaurants.
2. **Frontends:** Next.js for merchant storefronts; React for Super Admin, Merchant Dashboard, and POS.
3. **Restaurant order acceptance:** A cashier must explicitly approve each incoming online order **before it enters kitchen preparation**; incoming orders must appear in POS.
4. **POS offline support:** Deferred; initial POS is online-first.
5. **Initial market:** Egypt.
6. **Payment gateway/provider:** Not in initial-release scope; provider selection and customer payment method remain open.
7. **Initial merchant pricing model:** Monthly subscription without a payment gateway integration; operational subscription handling remains open.

### Priority A — remaining first-release decisions [OPEN]

1. **Restaurant MVP boundary:** Which of menu, dynamic product builder, order intake, kitchen screen/printing, POS walk-in sales, shifts, inventory/ingredients, tables, pickup, delivery, and reporting must exist on day one?
2. **Merchant onboarding:** Merchant self-registration with Super Admin approval vs admin-created/invited accounts? When may a merchant start operating?
3. **POS form factor:** Separate React app or module/route inside Merchant Dashboard? Will more than one device/branch receive incoming orders?
4. **Cashier acceptance details:** Who can accept/reject? What happens when rejected, unattended, or the cashier disconnects? How are orders routed to a branch?
5. **Kitchen handoff:** Dedicated KDS React view, a POS kitchen view, printed tickets, or another approach? What statuses are required?
6. **Customer checkout without an integrated provider:** What checkout/confirmation flow should be supported (if any payment method is expected)? **No default method has been chosen.** This can remain unresolved until checkout implementation.
7. **Subscription administration:** How does Super Admin assign/activate a monthly plan, record fulfillment/collection, renew it, and handle expiry when there is no gateway? Prices and limits also remain open.
8. **Tenant and staff access:** Can one user belong to multiple merchants? Multiple branches? Does the shared-database proposal meet project needs?

### Priority B — product behavior and future expansion [OPEN]

9. **Product Builder specifics:** Which advanced rules are essential initially: conditional options, option quantities, bundles, weight pricing, and branch-specific availability? Reusable option groups and assignment-level fixed pricing are resolved for V1.
10. **Inventory:** When is stock reserved/deducted? Is negative stock allowed? Will restaurants initially track finished items, ingredients/recipes, or both?
11. **Storefront scope:** PWA installation, custom domains, template count, Arabic/English support, visual customization, and release priorities?
12. **Marketplace:** When does Waffarly's marketplace launch? One-merchant checkout or cross-merchant cart?
13. **Finance:** Basic reports/expenses or full accounting? Tax, supplier purchasing, cost of goods sold?
14. **Delivery:** Restaurant-operated delivery, third-party delivery, pickup, or a combination? Areas and fees?
15. **Customer accounts:** Guest checkout vs mandatory signup; platform-wide vs restaurant-specific accounts?
16. **Notifications and audit:** In-app, push, email, SMS/WhatsApp; mandatory audit events?
17. **Hosting/operations:** Hosting, CI/CD, repository provider, required region, privacy/security regulations?
18. **Tooling:** Vite for React SPAs? pnpm/Turborepo monorepo? Modular monolith deployment?

**Decision tracking template:**

```md
### DEC-XXX — Decision title
- Status: Proposed / Approved / Rejected / Deferred
- Question:
- Final answer:
- Rationale:
- Impacted modules:
- Date:
```

---

### Recorded decisions (2026-10-13)

| ID | Decision | Status |
| --- | --- | --- |
| DEC-001 | Multiple business activities share the platform foundation: restaurants, clothing stores, supermarkets, and other businesses. | Approved — corrected 2026-10-13 |
| DEC-002 | Next.js for public storefronts; React for Super Admin, Merchant Dashboard, and POS. | Approved |
| DEC-003 | Restaurant online orders must reach POS; cashier acceptance is required before kitchen preparation. | Approved |
| DEC-004 | POS offline mode is deferred beyond the first release. | Approved |
| DEC-005 | Egypt is the initial launch market. | Approved |
| DEC-006 | No payment gateway/provider integration in the initial release. | Approved |
| DEC-007 | Monthly subscription is the initial merchant commercial model, without integrated gateway collection. | Approved |
| Plans & Subscriptions PS-D02 | Multiple monthly subscription plans for restaurants at launch; exact count, names, differences, prices, and governance remain open. | Approved scope decision; no implementation authorization |
| Plans & Subscriptions PS-D04 | Document and implement basic monthly-plan administration; actual commercial offers and recurring subscription rules remain open. | Authorized initial implementation |

---

## 16. How this document should be used

1. Read the **[CONFIRMED]** sections as the currently known product vision.
2. Respect the recorded **first-release decisions**, then resolve the **remaining Priority A** questions before declaring a complete MVP scope and architecture.
3. Promote approved **[PROPOSED]** options into explicit decisions with date and rationale.
4. Create an individual feature specification for each feature being implemented, including flows, data ownership, permissions, API contracts, edge cases, and acceptance tests.
5. Maintain this overview as a high-level source of truth; keep detailed ERDs, API specifications, feature specs, and ADRs in separate files when development starts.
6. Update this document whenever scope/architecture changes; do not rely on undocumented chat decisions.

---

## 17. Technical references (informational only)

These references support the **candidate** technical organization and do not impose product decisions:

- NestJS modules: https://docs.nestjs.com/modules
- NestJS + Prisma: https://docs.nestjs.com/recipes/prisma
- Next.js and SPA patterns: https://nextjs.org/docs/app/guides/single-page-applications
- Vite with React: https://vite.dev/guide/

---

**Document owner:** Waffarly project team  
**Approval status:** **First-release direction confirmed; detailed MVP specification and remaining open decisions await approval.**
