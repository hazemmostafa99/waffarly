# Waffarly (وفّرلي) — Restaurant MVP Scope

> **Scope correction — 2026-10-13:** Restaurant-only platform scope has been superseded by the owner's multi-business clarification. This document now represents a restaurant workflow proposal. Clothing stores, supermarkets, and other businesses use the shared merchant foundation; restaurant-specific workflows must not be imposed on them. Their specialized operations remain subject to separate feature decisions.

> **Document status:** Draft v0.1 — **not yet approved as final MVP scope**  
> **Last updated:** 2026-10-13  
> **Parent document:** [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) (working draft v0.2)  
> **Purpose:** Translate the confirmed first-release direction into an explicit, reviewable restaurant MVP scope, feature inventory, release journeys, acceptance criteria, dependencies, exclusions, and decisions still needed.  
> **Scope rule:** Nothing marked **[PROPOSED]** or **[OPEN]** is an agreed product requirement. Do not implement or silently decide it until the product owner approves it.

---

## 1. Reading this document

| Label | Meaning |
| --- | --- |
| **[CONFIRMED]** | Directly agreed with the product owner; a first-release constraint or intended product capability. |
| **[PROPOSED]** | Recommended for the smallest coherent restaurant release, **not yet approved**. |
| **[OPEN]** | Requires a business, user experience, or technical decision before that behavior can be finalized. |
| **[DEFERRED]** | Explicitly excluded from the initial implementation, or a future platform direction that is **not included in this MVP proposal**; see individual reason. |
| **[BASELINE]** | Essential security/data-integrity acceptance expectation if the dependent feature ships; design detail still subject to review. |

**Important distinction:** An idea mentioned in the overall Waffarly vision is **not automatically approved for the MVP**. The MVP definition is considered finalized only after the open launch-blocking questions below have been answered and the candidate features have been accepted or rejected.

## 2. MVP outcome

### 2.1 Confirmed launch direction

Build the first Waffarly release around **restaurants in Egypt**, using a shared multi-tenant platform. A restaurant should be able to present a configurable menu through its public storefront and receive incoming online orders in the **correct branch's cashier/POS experience**. A cashier must **explicitly accept** each incoming online order **before it enters kitchen preparation**.

This section defines the intended product direction, **not** a final agreement that every restaurant workflow listed elsewhere in this document ships on day one.

### 2.2 Confirmed stack and release constraints

| ID | Area | Approved decision |
| --- | --- | --- |
| DEC-001 | First business activity | **Restaurants**. |
| DEC-002 | Backend | **NestJS**, **PostgreSQL**, **Prisma**. |
| DEC-003 | Public merchant storefront | **Next.js**. |
| DEC-004 | Super Admin, Merchant Dashboard, POS | **React**; SPA tooling and POS deployment shape are still open. |
| DEC-005 | Online restaurant orders | Must reach the cashier/POS; **cashier acceptance required before kitchen preparation**. |
| DEC-006 | POS connection | **Online-first**; offline selling/synchronization deferred. |
| DEC-007 | Initial market | **Egypt**; language, tax, local delivery, and checkout rules remain open. |
| DEC-008 | Merchant commercial model | **Monthly subscription** at launch; prices, collection/activation, and lifecycle remain open. |
| DEC-009 | Payment integration | **No payment gateway/provider integration** in the initial release; **no customer payment method is implied**. |
| Plans & Subscriptions PS-D02 | Launch plan catalog | **Multiple monthly subscription plans** for restaurants, confirmed by the owner on 2026-10-13 in [Plans & Subscriptions discovery](docs/features/super-admin/plans-subscriptions/OVERVIEW.md). Exact count, names, differences, prices, currency/tax treatment, and catalog governance remain **[OPEN]**; implementation is not authorized by this decision. |

### 2.3 Explicit non-assumptions

**Implementation update, 2026-10-13 — PS-D04:** The owner authorized documenting and implementing [basic monthly-plan administration](docs/features/super-admin/plans-subscriptions/MONTHLY_PLAN.md). Authenticated create/list/edit is implemented; actual offer names/prices are entered by the administrator. This slice does not finalize merchant assignment, entitlements, collection, or recurring coverage.

- **No cash-on-delivery or cash-at-pickup default.** Customer checkout/payment handling is **[OPEN]**.
- **No default kitchen interface.** Dedicated KDS, POS kitchen view, ticket printing, and other handoff mechanisms are **[OPEN]**.
- **No automatic subscription renewal or assumed manual settlement.** Subscription administration is **[OPEN]**.
- **No automatic order acceptance or dispatch to kitchen.** This would violate the confirmed cashier-acceptance requirement.
- **No assumed branch count, product limits, role matrix, order statuses, delivery methods, or language support.**
- **No assumption that all activity-specific restaurant features (tables, recipes, ingredient deduction, etc.) must ship immediately.**

---

## 3. Release experience — end-to-end flows

These flows show what needs to be considered together. Only the steps explicitly marked confirmed are already binding.

### Journey J-01 — Restaurant onboarding [PROPOSED flow; rules OPEN]

1. Restaurant account/tenant is created by a mechanism **[OPEN]**.
2. Super Admin or another authorized process approves/activates access by a mechanism **[OPEN]**.
3. The restaurant configures its identity, branch details, and authorized staff **[PROPOSED MVP slice]**.
4. A monthly plan is associated with the restaurant; activation/renewal mechanism **[OPEN]**.
5. Restaurant can access only the capabilities and tenant data it is authorized to use **[BASELINE]**.

### Journey J-02 — Configurable restaurant menu [PROPOSED for MVP; builder capability CONFIRMED vision]

1. Merchant creates an item with name, description, price and other required core data (**fields to finalize**).
2. Merchant optionally configures sizes/variants, modifier groups, and modifier options (e.g. sauces, toppings, additions).
3. Merchant defines allowed choices and any price changes; exact configurable rules **[OPEN]**.
4. The public storefront displays the supported configuration.
5. Backend validates options and calculates authoritative item totals **[BASELINE]**.

### Journey J-03 — Online order to cashier to kitchen [CONFIRMED ordering, details OPEN]

1. Customer browses a restaurant's Next.js storefront and selects configured products.
2. Checkout collects the minimum approved information; **payment and fulfillment details [OPEN]**.
3. Backend stores a valid order and its product/selection/price snapshot **[PROPOSED modeling; BASELINE for historical correctness]**.
4. The order is retrievable and visible to an authorized cashier in the relevant restaurant branch's POS **[CONFIRMED]**.
5. The cashier **explicitly accepts** the online order **[CONFIRMED]**.
6. **Only after acceptance** may the order become available to the kitchen preparation workflow **[CONFIRMED]**.
7. Kitchen handoff type, further statuses, customer notifications and fulfillment are **[OPEN]**.

**Mandatory invariant:** `online order received ≠ kitchen dispatch authorized`. The acceptance action is a server-enforced state transition. A frontend-only check is insufficient.

### Journey J-04 — Walk-in POS sale [PROPOSED MVP; exact rules OPEN]

1. Authorized cashier opens the online POS.
2. Cashier selects menu items and configurations from the same restaurant catalog.
3. Server validates selections and price.
4. Sale and associated stock/accounting effects are recorded under approved rules **[OPEN]**.

**Release decision required:** Is **in-store checkout/sales** mandatory in release one, or is the initial POS primarily an incoming-orders console?

### Journey J-05 — Monthly subscription without gateway [CONFIRMED model; procedure OPEN]

1. Restaurant has a monthly subscription/plan assignment.
2. Platform enforces any approved plan entitlements and state restrictions **[PROPOSED minimum]**.
3. Super Admin handles subscription activation, renewal, expiry, and collection records under a process **[OPEN]**.
4. **No payment-provider integration** is invoked in the initial release **[CONFIRMED]**.

---

## 4. Candidate feature scope (review and approve)

### 4.1 Foundation and administration

| Feature ID | Feature | Proposal / agreed constraint | MVP decision |
| --- | --- | --- | --- |
| CORE-01 | Authentication, accounts, sessions | Login and protected application access; mechanism not yet selected. | **[PROPOSED]** |
| CORE-02 | Tenant lifecycle | Create restaurant tenant and support activation/restriction; registration method open. | **[PROPOSED]** |
| CORE-03 | Tenant isolation | Never expose tenant-owned records cross-tenant. | **[BASELINE]** |
| CORE-04 | Employees and permissions | At minimum distinguish authorized restaurant users and cashier acceptance rights; exact role/branch matrix open. | **[PROPOSED]** |
| CORE-05 | Branches and branch routing | Support routing online orders to the correct branch; selection rules and number of branches open. | **[PROPOSED]** |
| ADMIN-01 | Super Admin merchant management | View/create/approve/suspend/reactivate tenant according to chosen onboarding lifecycle. | **[PROPOSED]** |
| ADMIN-02 | Monthly plan and subscription admin | Assign monthly plan and maintain its approved state; no payment gateway. | **[PROPOSED]** |
| ADMIN-03 | Feature entitlement checks | Control access to approved modules/limits at the API layer. | **[PROPOSED]** |
| OPS-01 | Audit trail | Capture order acceptance and security-sensitive administrative actions. | **[BASELINE]** |

### 4.2 Restaurant merchant and storefront

| Feature ID | Feature | Proposal / agreed constraint | MVP decision |
| --- | --- | --- | --- |
| MER-01 | Restaurant profile | Name, contact, branding basics; exact fields open. | **[PROPOSED]** |
| MER-02 | Branch profile | Restaurant location/operating data needed for ordering; exact fields open. | **[PROPOSED]** |
| MER-03 | Staff assignment | Invite/create staff, assign branch/permission as approved. | **[PROPOSED]** |
| CAT-01 | Menu/catalog CRUD | Categories, products, pricing and visibility. | **[PROPOSED]** |
| CAT-02 | Dynamic Product Builder | Configurable products, variants/sizes, modifier groups/options; exact supported rules open. | **[PROPOSED MVP]**; **[CONFIRMED platform capability]** |
| CAT-03 | Server-side product validation and pricing | Reject invalid choices; calculate totals from server-owned catalog/prices. | **[BASELINE]** |
| WEB-01 | Public restaurant storefront | Display restaurant menu and configurable products using **Next.js [CONFIRMED]**. | **[PROPOSED MVP]** |
| WEB-02 | Cart and checkout | Capture customer order using approved fulfillment and payment/collection approach. | **[PROPOSED]**, checkout rules **[OPEN]** |
| WEB-03 | Branding and URL | Minimal public restaurant identity/address; exact template, subdomain and branding behavior open. | **[PROPOSED]** |

### 4.3 Orders, POS and restaurant operations

| Feature ID | Feature | Proposal / agreed constraint | MVP decision |
| --- | --- | --- | --- |
| ORD-01 | Unified Orders domain | One authoritative backend order record used by storefront and operational interfaces. | **[PROPOSED architecture]** |
| ORD-02 | Incoming online orders in POS | Correct branch/cashier can retrieve new online orders. | **[CONFIRMED]** |
| ORD-03 | Explicit cashier acceptance | No online restaurant order proceeds to kitchen before authorized cashier accepts it. | **[CONFIRMED]** |
| ORD-04 | Order status/transition history | Persist allowed transitions and who changed them; exact states/permissions open. | **[BASELINE]** |
| ORD-05 | Decline, cancel, expiry and unattended orders | Define rules before shipping; not safe to invent defaults. | **[OPEN]** |
| REST-01 | Kitchen handoff after acceptance | Deliver accepted orders to approved kitchen mechanism; **KDS vs printing vs POS view OPEN**. | **[CONFIRMED ordering]** / mechanism **[OPEN]** |
| POS-01 | POS operational UI | React-based cashier experience, online-first. | **[CONFIRMED technology/connectivity]**; form factor **[OPEN]** |
| POS-02 | Walk-in sales | In-store order entry/checkout against same catalog and rules. | **[PROPOSED]** |
| POS-03 | Shifts and cash drawer | Opening/closing shifts and reconciliation. | **[OPEN for MVP]** |
| OPS-02 | Live order notification/update | Realtime signal and re-fetch/reconnect behavior; transport not yet approved. | **[PROPOSED]** |
| INV-01 | Inventory for restaurants | Product/ingredient tracking model and deduction timing are undecided. | **[OPEN for MVP]** |
| REPORT-01 | Minimal business reporting | Order counts/totals by restaurant/branch and period, subject to agreed financial semantics. | **[PROPOSED]** |

### 4.4 Unapproved for the first MVP proposal

Items below are **not silently included**. Some are explicitly deferred; others need a scope decision. Being here does **not** mean they are permanently excluded from Waffarly.

| Capability | Status | Notes |
| --- | --- | --- |
| Offline POS and sync | **[DEFERRED — confirmed]** | Online-first initial POS. |
| Payment gateway/provider integration | **[DEFERRED — confirmed]** | Applies to customer and subscription integrations for initial release. |
| Commission or hybrid merchant billing | **[DEFERRED in MVP proposal]** | Platform vision remains; monthly subscriptions are the launch model. |
| Public Waffarly marketplace | **[DEFERRED in MVP proposal; confirm]** | Marketplace remains in long-term vision. |
| Clothing/electronics/grocery operating modules | **[DEFERRED in MVP proposal]** | Restaurants are first. |
| Full accounting / general ledger | **[NOT APPROVED]** | Requires distinct product decision. |
| Advanced restaurant table management / dine-in workflow | **[OPEN; not assumed included]** | Decide separately. |
| Full KDS with stations/printers | **[OPEN; not assumed included]** | Basic kitchen handoff still needs a chosen mechanism. |
| Recipe/ingredient-level inventory and purchasing | **[OPEN; not assumed included]** | Inventory granularity is an unanswered decision. |
| Delivery partner integrations / dispatching | **[OPEN; not assumed included]** | Customer fulfillment mode remains open. |
| Custom domain, theme marketplace, advanced PWA | **[OPEN; not assumed included]** | Minimal public storefront still needs an approved address/branding decision. |
| Advanced product rules: bundles, conditional modifiers, reusable groups | **[OPEN; not assumed included]** | Decide minimum Builder rules. |

---

## 5. Acceptance criteria

**AC status convention:** Criteria tagged **[CONFIRMED]** must pass for the agreed behavior. **[BASELINE]** criteria apply whenever the related feature ships. **[PROPOSED]** criteria require feature approval first.

### AC-01 — Tenant authorization [BASELINE]

- Authenticated personnel of Restaurant A cannot read or mutate Restaurant B's products, orders, subscription data, employees, or branches without a separately authorized platform capability.
- Switching `tenantId`, order IDs, or branch IDs in a request cannot bypass the authorization scope.
- Backend permission and plan-entitlement checks operate independently of hidden or disabled frontend controls.

### AC-02 — Restaurant product configuration [PROPOSED]

- Merchant can create at least a basic item and a configurable item **once the minimum supported variant/modifier rules have been approved**.
- Invalid modifier IDs, choices belonging to another product, and selections outside configured limits are rejected by the backend.
- The server computes the authoritative item price; a client-supplied amount cannot override it.
- Historical order lines preserve agreed product name/selection/price details after later menu edits.

### AC-03 — Online order visibility and acceptance [CONFIRMED]

- A valid online restaurant order is persisted and is retrievable in the authorized cashier/POS order list for the routed branch.
- An authorized cashier can explicitly accept that order.
- **Before recorded cashier acceptance**, no kitchen preparation handoff/dispatch is allowed.
- After acceptance, the kitchen handoff may occur through the separately approved mechanism.
- Duplicate or concurrent acceptance attempts do not produce contradictory order state or duplicate kitchen dispatch.

### AC-04 — Resilience and branch ownership [BASELINE]

- If the cashier device is temporarily disconnected, persisted incoming orders remain available when the device reconnects or reloads.
- Staff without rights for the relevant branch cannot act on its orders.
- Replayed requests/events cannot create duplicate order records or duplicate acceptance effects where idempotency is required.

### AC-05 — Monthly subscription without payment integration [CONFIRMED constraint; implementation OPEN]

- Merchant plan is monthly; no payment gateway calls are part of the launch flow.
- Once activation, renewal and expiry rules are approved, API access follows those rules and does not depend only on frontend visibility.
- No assumption is made about how subscription fees are collected, recorded, or reconciled.

### AC-06 — Walk-in POS and kitchen [CONDITIONAL — PROPOSED/OPEN]

- If walk-in sales are approved, the POS uses the same authoritative product selection/pricing engine as online ordering.
- If a kitchen view is approved, it receives only orders authorized for kitchen preparation according to the agreed workflow.
- If inventory is approved, all order channels use the same stock policies; double selling is prevented under the agreed reservation/deduction semantics.

---

## 6. Data contracts and architectural boundaries (implementation proposals)

Do **not** mistake these suggested models for a finalized ERD or implementation instructions.

| Boundary | Suggested concepts | Must decide before final schema |
| --- | --- | --- |
| Identity / Tenancy | User, Tenant, Membership, Branch, Role, Permission | Registration, multi-tenant membership, branch scopes. |
| Catalog | Product, Variant, ModifierGroup, ModifierOption, Category | Attribute definitions, constraints, availability, published vs draft. |
| Orders | Order, OrderLineSnapshot, OrderEvent/StatusHistory | Status machine, routing, fulfillment, checkout/payment semantics. |
| Restaurant | KitchenTicket or preparation dispatch abstraction | Actual kitchen display/printing, preparation statuses. |
| POS | Cashier workspace; Sale and/or Order channel | Walk-in sale inclusion, shift and receipt behavior. |
| Subscription | Plan, Subscription, Entitlement | Plan limits, activation/renewal/expiry and collection handling. |
| Inventory | StockBalance, StockMovement; potentially Recipe/Ingredient | Whether and how inventory is required for first release. |

**Data rules if built:**

- `tenant_id` on tenant-owned operational data **[CONFIRMED platform requirement]**; global identity/catalog tables must be classified explicitly.
- Tenant-safe references and uniqueness; no cross-tenant relationship can be accepted by mistake **[BASELINE]**.
- Monetary values use a decimal/fixed-precision representation **[PROPOSED]**.
- Keep product choice/price snapshots on order lines **[PROPOSED]**.
- Persist order creation and acceptance authoritatively; realtime updates do not replace database persistence **[BASELINE]**.
- Protect race-prone order/stock updates with appropriately scoped database transactions and idempotency **[BASELINE]**.

### 6.1 Candidate NestJS module boundaries [PROPOSED]

```text
apps/api/src/modules/
  identity/              # Authentication, users
  tenancy/               # Restaurant tenants, memberships, branches
  access-control/        # RBAC, branch authorization
  platform/              # Merchant lifecycle, plans, subscriptions, entitlements
  merchant/              # Profile, branding, staff
  catalog/               # Categories, products, variants, modifiers
  pricing/               # Server-side configurator and pricing
  orders/                # Unified order state and history
  pos/                   # Incoming cashier orders and optional walk-in sales
  restaurants/           # Kitchen/preparation handoff if approved
  inventory/             # Only after scope/rules approval
  audit/                 # Sensitive operational events
```

**Confirmed applications:** NestJS API, Next.js public restaurant storefront, React-based Super Admin, React-based merchant dashboard, React-based POS. **Unconfirmed:** monorepo tooling, Vite, whether POS is independently deployed, realtime technology, hosting and job-queue selection.

---

## 7. Delivery slices and dependencies [PROPOSED sequence — not dates]

| Slice | Goal | Exit evidence | Depends on |
| --- | --- | --- | --- |
| S0. Decisions & contracts | Approve launch blockers and define user/order states | Signed-off decisions, basic user journeys | Product owner decisions |
| S1. Identity & tenancy | Isolated restaurant spaces, staff/auth context | Tenant isolation and permissions tests | Onboarding/RBAC choices |
| S2. Restaurant catalog | Configurable menu built by merchant | Builder and server-side pricing tests | Minimum Builder rule set |
| S3. Public storefront | Browse/configure and place order | Customer flow creates valid order | Fulfillment/checkout decision |
| S4. Cashier order intake | Online order visible in correct POS; explicit acceptance | Acceptance and no-pre-acceptance dispatch tests | Branch routing/order states |
| S5. Kitchen handoff | Accepted order reaches kitchen in approved form | Accepted vs unaccepted handoff tests | KDS/printing/view decision |
| S6. Subscription administration | Monthly plan state and entitlements | Entitlement and renewal rule tests | Subscription lifecycle decision |
| S7. Walk-in/stock/reporting | **Only approved extras** | Feature-specific acceptance tests | POS and inventory scope decisions |
| S8. Release validation | Security, UAT, logging, backup/recovery checks | Approved launch checklist | All in-scope slices |

The sequence is a planning suggestion, **not** a promise of duration, budget, team size, or feature completion. Related slices may be developed in parallel only after their dependencies are resolved.

---

## 8. Launch-blocking decisions — product owner input needed

The following questions must be answered before this scope can be treated as complete. **No defaults are selected.**

| Priority | Decision ID | Question | Direct impact |
| --- | --- | --- | --- |
| P0 | MVP-Q01 | What **must** the first restaurant launch support: online ordering only, or also walk-in POS checkout? | POS scope, sales data, release acceptance |
| P0 | MVP-Q02 | Without a gateway, how does a **customer complete or confirm an order**? Which order types are allowed (pickup, delivery, dine-in)? | Checkout, order validity, fulfillment |
| P0 | MVP-Q03 | After cashier acceptance, **how exactly does the kitchen receive orders**: KDS, POS kitchen view, printer ticket, or something else? | Kitchen app, hardware, events |
| P0 | MVP-Q04 | Can a cashier **reject** an incoming order? What happens if nobody responds or the branch is unavailable? | Order state machine, customer messages |
| P0 | MVP-Q05 | How is the **correct branch chosen** for an online order? One branch, customer selection, location/rules, or another mechanism? | Tenant/branch routing, checkout |
| P0 | MVP-Q06 | How are monthly plans **assigned, activated, renewed and expired**, with no payment provider? | Subscription and entitlement logic |
| P1 | MVP-Q07 | How do restaurants join: self-registration + admin approval, invitation, or admin creation? | Identity, onboarding, admin flows |
| P1 | MVP-Q08 | What is the minimum Product Builder at launch: sizes/variants, configurable single/multi-choice modifiers, min/max, stock effects? | Catalog ERD, frontend builder |
| P1 | MVP-Q09 | Is restaurant inventory required at launch? If yes, finished items, ingredients/recipes, or both? | Stock and purchase operations |
| P1 | MVP-Q10 | Is POS a separate React app or part of merchant dashboard? How many active cashier devices may see branch orders? | Frontend deployments, sessions, realtime |
| P1 | MVP-Q11 | Which languages, restaurant URLs, branding controls, and customer account model are required? | Storefront design and SEO |
| P1 | MVP-Q12 | Which employee roles/branch access rules and minimum reports are mandatory? | Authorization and dashboards |

Other unresolved decisions from the overview (tables, delivery pricing, taxes, service fees, notifications, custom domains, marketplace, accounting depth, infrastructure) remain open; move them to feature specs when prioritizing their release.

### 8.1 Product-owner decision record template

```md
### MVP-QXX — Question title
- Status: Open / Approved / Deferred
- Decision:
- Accepted behaviors:
- Excluded behaviors:
- Affected feature IDs:
- Date:
```

---

## 9. Suggested feature-spec template

Create `docs/features/<FEATURE-ID>-<slug>.md` for each **approved** feature, with:

```md
# FEATURE-ID — Feature name
- Status: Draft / Approved / In development / Done
- Owner:
- Business goal:
- Actors and permissions:
- Preconditions:
- Happy path:
- Alternative / failure paths:
- Validation and business rules:
- Tenant/branch ownership:
- Data entities and migration impacts:
- API/events/contracts:
- Frontend screens and components:
- Dependencies:
- Acceptance tests:
- Explicitly out of scope:
- Open questions:
```

Do not convert a **[PROPOSED]** table row into development work without approving its business rules and acceptance conditions.

## 10. Definition of Done and launch checks [PROPOSED]

For every approved feature:

- Business behavior and permissions are documented and reviewed.
- Schema/migrations and API contracts are reviewed against tenant boundaries.
- Success, validation, access denial, concurrency and retry paths have appropriate automated tests.
- Server is the authority on product/option prices and order transitions.
- User interface includes loading, empty, permission-denied and failure states as appropriate.
- Important changes are observable/auditable; sensitive data is not logged indiscriminately.
- Documentation and the decision log are updated when the implementation differs from the proposal.

For production launch, additionally agree on and verify backups, recovery, monitoring, security reviews, data/privacy rules, and operational ownership. These operational details are **not yet selected**.

---

## 11. Approval checklist

- [x] First business activity is restaurants.
- [x] Backend is NestJS + PostgreSQL + Prisma.
- [x] Public storefront is Next.js; dashboards/POS are React.
- [x] Incoming restaurant online orders appear in POS.
- [x] Explicit cashier acceptance is required before kitchen preparation.
- [x] POS is online-first; offline is deferred.
- [x] Initial market is Egypt.
- [x] Initial merchant commercial model is monthly subscription.
- [x] No payment gateway/provider integration is included initially.
- [ ] Product owner chooses which **[PROPOSED]** features are in release one.
- [ ] Launch-blocking checkout, kitchen, routing, rejection, and subscription questions answered.
- [ ] Initial Product Builder rules and merchant authorization scope approved.
- [ ] Final acceptance criteria and first release backlog approved.

**MVP approval status:** **Not yet approved**. All original confirmed decisions are preserved; unconfirmed details are intentionally still open.

---

**Document owner:** Waffarly project team  
**Change policy:** Keep this document and `PROJECT_OVERVIEW.md` aligned. Add approved decisions here, then update the overview decision log. Do not silently turn a recommendation into an agreed requirement.
