# Waffarly — Templates & Design Library Overview

**Document status:** Domain discovery draft; feature delivery scope and detailed workflows are not approved.  
**Last updated:** 2026-10-13  
**Parent:** [Super Admin Overview](../OVERVIEW.md)  
**Related domains:** [Merchant Management](../merchants/OVERVIEW.md), [Plans & Subscriptions](../plans-subscriptions/OVERVIEW.md)  
**Current phase:** Phase F — initial Templates & Design Library implementation; merchant selection and storefront publishing discovery remain open.

## 1. Purpose and Scope

Templates & Design Library manages the platform's activity-appropriate storefront presentation options. Super Admin governs the shared library; an authorized merchant configures its own storefront using options made available under approved rules.

The product owner selected this domain for feature discovery documentation, following the Merchant Management overview, then instructed us to start building it. The first slice is a Super Admin library for restaurant presentations. This starts implementation; it does not approve merchant selection, storefront publishing, commercial gating, or a complete template design system.

This overview identifies candidate features, actors, boundaries, journeys, dependencies, security concerns, and focused questions. It records implementation evidence separately from product decisions and remaining requirements.

### Sources and Decision Status

- [PROJECT_OVERVIEW.md](../../../../PROJECT_OVERVIEW.md), sections 3, 4.1, and 4.2: restaurant-first launch, activity-associated design library, merchant visual identity and storefront style, and open customization/publishing rules.
- [MVP_SCOPE.md](../../../../MVP_SCOPE.md), WEB-01/WEB-03 and section 5: proposed storefront/branding scope; the initial two-design count is recorded in TDL-D02; broader release scope and advanced capabilities remain unresolved.
- [Existing Super Admin specification](../../SUPER_ADMIN.md), SA-11: template administration has first-release inclusion OPEN.
- [Parent overview](../OVERVIEW.md): stable feature IDs SA-T01–SA-T04 and dependencies SA-O09 / SA-AM01 / SA-PS02.
- [Merchant Management overview](../merchants/OVERVIEW.md): merchant identity, owner access, onboarding, and lifecycle boundaries.
- [Plans & Subscriptions overview](../plans-subscriptions/OVERVIEW.md): commercial eligibility and subscription responsibilities, separate from design compatibility.
- [Technical decisions](../../../architecture/TECHNICAL_DECISIONS.md) and inspected source files: current implementation evidence, separate from product approval.
- Product-owner direction on 2026-10-13: start Templates & Design Library and explicitly select feature discovery documentation.

**CONFIRMED** means explicitly approved within the stated boundary. **PROPOSED** means a candidate awaiting approval. **OPEN** means unresolved. **DEFERRED** means postponed, with proposal-only deferrals qualified. Platform vision, MVP inclusion, detailed rules, and implementation evidence are separate facts.

## 2. Recorded Decisions and Existing Evidence

### 2.1 Discovery Direction

| ID      | Date       | Status                         | Decision                                                                                                             | Boundary / affected documents                                                                                                                                                                                               |
| ------- | ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TDL-D01 | 2026-10-13 | CONFIRMED discovery direction  | Start Templates & Design Library feature discovery documentation using the merchant domain's documentation approach. | Creates this domain overview and links it from the parent and merchant overviews. No feature delivery, detailed rule, or implementation is approved.                                                                        |
| TDL-D02 | 2026-10-13 | CONFIRMED initial design scope | Build two full restaurant designs and let each owner choose one, add its own logo, and set its accent color.         | Shared definitions are platform-owned; the saved design selection and branding are tenant-owned. This authorizes the first design-choice slice, not public publishing, menu editing, commercial gating, or more activities. |

On 2026-10-13, the owner instructed: “start building it,” then confirmed the initial product choices in TDL-D02. This authorizes a Super Admin library with two restaurant designs and a Merchant Dashboard choice/editor. Public publication, menu editing, commercial gating, and other activities remain OPEN.

### 2.2 Preserved Constraints

| Source                            | Recorded position                                                                                                                | Discovery implication                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROJECT_OVERVIEW sections 3 / 4.1 | Restaurants are the initial activity; Super Admin manages an activity-associated design/template library in the platform vision. | Analyze restaurant requirements first. Future activities do not imply launch templates or activity-management screens.                                                    |
| PROJECT_OVERVIEW section 4.2      | Merchant owners manage visual identity and activity-appropriate storefront style in the platform vision.                         | Separate shared definitions from tenant-owned branding. Exact controls and release inclusion remain OPEN.                                                                 |
| PROJECT_OVERVIEW section 3        | Public storefronts use Next.js.                                                                                                  | Does not decide whether designs are themes, layouts, code components, or editable compositions.                                                                           |
| MVP_SCOPE WEB-03 / existing SA-11 | Minimum branding, template behavior, and first-release template administration remain OPEN.                                      | Confirmed platform vision does not approve a launch library UI or multiple templates.                                                                                     |
| Recorded SA-D05 / SA-D06          | The existing owner dashboard is gated by manual first-month activation after external collection confirmation.                   | New merchant design flows must account for existing access checks. This does not establish public storefront availability, publishing rights, or renewal/expiry behavior. |
| TDL-D02                           | Two full restaurant designs; owner-selected design with its own logo and accent color.                                           | Defines the initial choice/customization scope. Saved settings remain private to the tenant; public publishing is still OPEN.                                             |

No source approves an uploadable executable template, page builder, third-party marketplace, premium template pricing, or automatic migration of live merchant storefronts. These are not inferred from the word “library.”

### 2.3 Implementation Evidence

- [Super Admin App](../../../../apps/super-admin/src/App.tsx) contains sign-in, merchant creation/listing, application review/approval, and first-month activation. It has no template library controls.
- [Storefront home](<../../../../apps/storefront/src/app/(business)/page.tsx>) is a Next.js foundation page with a restaurant application link. It does not resolve or render a merchant-selected template.
- [Merchant Dashboard App](../../../../apps/merchant-dashboard/src/App.tsx) now provides owner login, a contact profile, and a tenant-scoped design and branding editor. It has no public storefront publishing flow.
- [Prisma schema](../../../../packages/database/prisma/schema.prisma) and [shared contracts](../../../../packages/contracts/src/index.ts) include platform templates and per-merchant design settings; public publishing records remain out of scope.

The Super Admin library supports create, search, filter, edit, preview, and availability updates. It starts with two ready-to-select restaurant designs. The API validates writes, requires administrator authentication, and uses revisions to prevent stale updates. The Merchant Dashboard lets an authenticated owner choose an available design, preview it, upload a small logo, set an accent color, and save settings for that tenant. Logo images are stored as small data URLs in PostgreSQL for this initial slice. Availability and tenant selection do not publish a public storefront; public rendering and a publication workflow remain OPEN.

This is static evidence as of the document date. It does not establish runtime readiness, full tenant isolation for future design features, or approval of every existing implementation detail.

## 3. Domain Boundaries and Concepts

These concepts describe responsibilities, not approved entities or persisted records.

| Concept                    | Responsibility in this domain                                             | Boundary                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Template definition        | Describe a supported storefront presentation option and its capabilities. | Visual theme, full layout, or combination is OPEN. Metadata cannot deploy rendering code or business capabilities.                       |
| Library metadata / preview | Help actors understand an option.                                         | Candidate names, descriptions, thumbnails, demo content, and tags need requirements. Preview assets differ from merchant catalog assets. |
| Activity compatibility     | Express which supported activities can use an option.                     | Business Activities & Modules owns activity definitions. Compatibility does not grant modules or entitlement.                            |
| Platform availability      | Govern which designs may be offered for selection.                        | Distinct from current merchant selection and public publication. Withdrawal behavior for existing users is OPEN.                         |
| Merchant selection         | Associate an eligible design with the requesting tenant.                  | Owner selection from available restaurant designs and tenant-specific saved branding are implemented. Public publication remains OPEN.   |
| Merchant customization     | Configure permitted tenant branding or presentation settings.             | Tenant-owned. Changing one merchant's logo must not modify the shared definition or another merchant.                                    |
| Template revision          | Identify a shared design change if versioning is needed.                  | Code release, template revision, and merchant publishing revision differ; their relationship is OPEN.                                    |
| Preview / publication      | Distinguish evaluating a design from making it publicly visible.          | Storefront owns rendering/public behavior. Draft/live separation, approval, and rollback are OPEN.                                       |
| Commercial eligibility     | Consume any approved template entitlement rule.                           | Plans & Subscriptions owns commercial rules. Plan gating and paid design tiers are not approved.                                         |

Merchant onboarding, approval, owner provisioning, subscription activation, selecting a template, and publishing a storefront are distinct actions. An approved restaurant is not automatically a published storefront. A compatible design does not authorize an employee, activate a subscription, or create working ordering functionality.

**Practical example:** A restaurant could use a shared layout with its own logo and accent color if those controls are approved. Editing that branding would affect its tenant only. Updating the shared layout would require a separately agreed rollout policy for restaurants already using it.

## 4. Actors and Responsibilities

| Actor                                  | Candidate responsibility                                                            | Permission / scope status                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Super Admin                            | Inspect and maintain approved library information, compatibility, and availability. | Platform responsibility confirmed in vision; action permissions, review process, and management UI scope OPEN. |
| Merchant owner                         | Evaluate compatible designs and configure its own storefront where enabled.         | Merchant responsibility confirmed in vision; MVP controls, prerequisites, and publishing authority OPEN.       |
| Merchant employee                      | Perform specifically delegated design tasks if required.                            | No employee design permission inferred; inclusion and delegation OPEN.                                         |
| Platform developer / design maintainer | Supply and validate supported presentation implementations.                         | Governance option, not an approved new application role or code-upload capability.                             |
| Public customer                        | View the merchant's published experience.                                           | No access to tenant drafts/private configuration; public storefront access policy OPEN.                        |

Administrator permission, tenant context, compatibility, commercial entitlement if applicable, and merchant lifecycle access are independent checks. No support impersonation or general cross-tenant editing authority is introduced.

## 5. Feature Inventory and MVP Candidates

Parent IDs remain stable. Capabilities below are discovery topics, not implementation tickets.

| Feature ID | Feature                                      | Decision status                                                       | MVP boundary / questions                                                                                 |
| ---------- | -------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SA-T01     | Storefront template library and metadata     | Two initial designs implemented; broader release scope OPEN           | Shared design update/rollout policy and broader release scope remain OPEN.                               |
| SA-T02     | Template/activity compatibility              | CONFIRMED platform vision; rules OPEN                                 | Restaurant support first. One or multiple activities per design, validation, and governance remain OPEN. |
| SA-T03     | Platform availability and merchant selection | Initial availability and owner selection implemented                  | Public visibility and withdrawal effects remain OPEN.                                                    |
| SA-T04     | Customization, versioning, and activation    | Tenant logo and accent color implemented; publication/versioning OPEN | Shared updates, public storefront publication, switching, and rollback remain OPEN.                      |

### Initial Implemented Slice

**Implemented:** The initial release contains two full restaurant designs and tenant-scoped owner selection, logo, and accent-color settings. Public storefront rendering and publishing remain OPEN.

This proposal does not approve one template as the launch count, automatic defaults, logo/color controls, preview screens, or immediate publication. Each depends on decisions below. A single presentation still needs clear tenant configuration and update behavior.

**Future candidates, timing OPEN:** additional activity designs, richer composition, tenant-specific overrides, broader asset tooling, and commercial design tiers. Custom domains, PWA behavior, and a theme marketplace require separate scope decisions; none is assumed included or newly marked deferred.

## 6. Candidate Journeys

These are discussion flows with unresolved steps, not final workflows or acceptance criteria.

### 6.1 Platform Library Management

1. An authorized administrator inspects supported presentation options and their compatibility.
2. Under the chosen governance model, a maintainer supplies a design implementation and approved metadata.
3. The design is checked against supported restaurant content, tenant boundaries, and presentation requirements.
4. An authorized actor makes it available through the agreed release or administrative process.
5. Changes or withdrawal follow the agreed policy for future selections and existing storefronts.

**OPEN:** code-managed versus dashboard-managed definitions, metadata/assets, review authority, availability lifecycle, and release/withdrawal effects. A metadata entry cannot make missing storefront functionality available.

### 6.2 Merchant Design Setup

1. An owner enters an authorized tenant context and satisfies the agreed access prerequisites.
2. The system presents compatible available options, if selection is included, or explains the assigned presentation.
3. The owner chooses a design and applies permitted tenant branding settings.
4. If preview is included, the owner evaluates settings without exposing private content.
5. The system applies or publishes under the agreed behavior and reports the outcome.

**OPEN:** default timing, selection rights, branding fields, preview scope, draft/live separation, publication timing, and storefront completeness prerequisites. The recorded pre-activation dashboard gate is not silently changed.

### 6.3 Switching or Updating a Design

1. An authorized actor requests a merchant switch or proposes a shared design update.
2. The system evaluates compatibility and whether existing settings can be retained or require correction.
3. The actor follows the approved preview, confirmation, and rollout policy.
4. The change succeeds consistently or reports failure without claiming publication succeeded.

**OPEN:** automatic versus opt-in shared updates, pinned revisions, settings preservation/mapping, concurrent edits, rollback, and impact on customers with active carts. Presentation changes must not decide catalog pricing or order transitions.

## 7. Edge Cases and Failure Questions

| Situation                                             | Required analysis / unresolved behavior                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| No available compatible design                        | Decide whether setup is blocked, a supported default exists, or administrative correction is needed. Do not invent a fallback.      |
| Design becomes unavailable before selection completes | Validate eligibility when applying the change; define conflict feedback and retain consistent tenant configuration.                 |
| Withdrawal of a design already used by merchants      | Decide whether current storefronts continue or require migration. Do not infer forced switching or automatic unpublishing.          |
| Unsupported branding settings                         | Enforce approved schema/limits on the backend and define correction behavior. Arbitrary executable markup is not assumed supported. |
| Shared update incompatible with saved settings        | Define validation, migration, merchant communication, and recovery before changing live configurations.                             |
| Concurrent edits or publication                       | Define conflict detection and retry behavior; avoid silently overwriting another actor's changes.                                   |
| Preview contains real merchant content                | Keep private content and drafts tenant-scoped; decide synthetic versus approved public demo data.                                   |
| Merchant suspended or subscription restricted         | Consume approved access rules; do not independently decide public availability, active-order handling, or restoration.              |
| Missing images, empty menu, or long content           | Define presentation fallbacks/content bounds without changing catalog semantics.                                                    |
| Arabic/English content or different screen sizes      | Decide language/RTL requirements and validate responsive behavior. Egypt alone does not approve a bilingual launch.                 |

## 8. Security, Tenant Isolation, and Quality Concerns

These are conditional requirements for selected features, not approval of additional scope.

- **Backend authority:** Validate requested designs, supported settings, compatibility, availability, and approved access/entitlement conditions when applying changes. Client filtering alone is insufficient.
- **Tenant ownership:** Resolve merchant context from trusted authorization and validate tenant-owned configuration/asset references. Preview and publication must not expose another tenant's private data.
- **Shared versus tenant data:** Separate shared definitions from tenant overrides. Tenant edits must not mutate shared defaults for other merchants.
- **Content safety:** Treat text, URLs, images, and configuration as untrusted input. Arbitrary merchant HTML, JavaScript, CSS, and executable template uploads are not assumed supported. Upload/source limits need approval if assets are included.
- **Consistency:** Define the change boundary and recovery for selection, settings, and publication. Do not report a live update before it succeeds. Caching/invalidation belongs in later technical design.
- **Audit:** Discover library, compatibility, availability, tenant-selection, and publication actions needing actor/target/outcome/time history. Retention and viewers remain OPEN; avoid secrets/unnecessary tenant content in logs.
- **Presentation quality:** Specify keyboard access, readability, contrast, responsiveness, image behavior, and supported content/language cases. Performance targets and a formal accessibility standard remain OPEN.
- **Commerce separation:** Templates present approved catalog, pricing, checkout, and order behavior. Design settings cannot bypass validation, entitlement checks, or cashier acceptance rules.

## 9. Dependencies and Ownership

| Area                          | Dependency                                                                | Responsibility boundary                                                                               |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Merchant Management           | Trusted merchant identity, owner association, onboarding/lifecycle facts. | Templates consume facts; selection does not approve or activate a merchant.                           |
| Business Activities & Modules | Supported activity identity and capabilities.                             | Owns definitions. Restaurant-only launch does not require editable multi-activity administration.     |
| Plans & Subscriptions         | Any approved design eligibility/restriction policy.                       | Gating is conditional; this domain does not create premium tiers or renewal rules.                    |
| Merchant Dashboard            | Tenant selection/customization and user permissions.                      | Tenant-scoped configuration; platform library governance stays with Super Admin.                      |
| Storefront                    | Rendering, public access, preview/publication, and change propagation.    | Next.js is confirmed; loading, renderer architecture, caches, and routing remain technical decisions. |
| Catalog / checkout / orders   | Real content and supported customer interactions.                         | Templates do not create capabilities or change authoritative prices/order transitions.                |
| Identity / assets / audit     | Authorized actors, asset ownership where needed, and history.             | Do not invent final platform RBAC, storage, or audit architecture.                                    |

This dependency map does not select database entities, endpoints, a runtime plugin system, or deployment topology.

## 10. Focused Discovery Questions

Ask only the next questions needed for a selected feature. TDL-D01, TDL-D02, and the restaurant-first constraint need no reconfirmation.

| ID      | Decision needed                                                                                                     | Impact / reference                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TDL-Q04 | Are definitions code-managed, editable in Super Admin, or managed through a hybrid approach?                        | Need for management screens and who supplies rendering behavior; SA-T01 / SA-T02.    |
| TDL-Q05 | Who may manage availability, select designs, edit settings, preview, and publish, under which access prerequisites? | Permissions, activation gate, tenant scope; SA-T03 / SA-X02 / SA-M06.                |
| TDL-Q06 | Is a default assigned, when, and are designs restricted by plan or only by activity/availability?                   | Assignment timing and conditional entitlements; no defaults/premium gating inferred. |
| TDL-Q07 | Do changes become public immediately or through a draft/preview/publish step?                                       | Visibility, failures, rollback, and expectations; SA-T04.                            |
| TDL-Q08 | How do shared updates, switches, and withdrawal affect existing storefronts and saved settings?                     | Revision/rollout, retention, operational continuity; SA-T03 / SA-T04.                |
| TDL-Q09 | Which language, RTL, responsive, accessibility, and content cases must launch designs support?                      | Quality requirements; multilingual launch remains OPEN.                              |
| TDL-Q10 | Which changes need audit history, who can inspect it, and for how long?                                             | Accountability and privacy; SA-X05.                                                  |

TDL-D02 resolves the initial design meaning/count and tenant branding fields. The next discussion can focus on public storefront availability and its publication flow.

## 11. Documentation and Discovery Roadmap

1. Continue from TDL-D02's initial definition (two full restaurant design choices with tenant logo and accent color) and resolve the remaining governance questions.
2. Discuss tenant customization and boundaries between shared presentation, branding, and authoritative commerce data.
3. Analyze the selected feature's actors, journeys, access checks, preview/publication, switching/updates, and dependencies. Keep unanswered rules OPEN.
4. Record decisions with date/source, rationale, affected IDs, remaining questions, and document/code impact. Update this overview and parent inventory. Reconcile historical/root records when a later decision changes their scope/rules.
5. Create a dedicated specification when selected. Include goals, permissions, use cases, rules, flows, edge cases, security/validation, tenant boundaries, dependencies, proposed data/API concepts, UI requirements, acceptance criteria, and open questions.
6. Proceed to technical design after requirements approval and implementation when explicitly authorized for the feature.

No detailed feature files or implementation tickets are created by this overview. The initial library is implemented; merchant selection, tenant branding persistence, storefront resolution, and publishing requirements remain OPEN.
