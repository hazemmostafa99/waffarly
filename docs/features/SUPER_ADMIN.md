# Super Admin — Feature Discovery and Specification

> **2026-10-28:** [Merchant subscriptions](super-admin/plans-subscriptions/SUBSCRIPTIONS.md) supersedes historical first-month-only activation and unresolved lifecycle statements in this document. Independent duration pricing, assignment, manual collection, renewal, changes, suspension, cancellation and expiry are implemented.

**Status:** DRAFT — the product owner has authorized implementation of the confirmed first slice; remaining proposals and open rules are not approved.
**Scope:** First restaurant release in Egypt, with future platform capabilities identified separately.
**Sources:** PROJECT_OVERVIEW.md, MVP_SCOPE.md, docs/architecture/TECHNICAL_DECISIONS.md, and the Super Admin discovery brief. DECISIONS.md is absent from this repository.
**Latest product decisions:** The product owner confirmed the first-release onboarding route, four required contact fields, administrator-created owner credentials without a mandatory first-login password change, approval by creation, no owner login before subscription activation, manual first-month activation after confirming collection outside the platform, and manual private-message delivery to the owner's mobile number after a verification call. Later subscription rules remain open.

## 1. Module overview

Waffarly's Super Admin is the platform operator's central administration interface. The confirmed platform vision includes merchant oversight, business activities, modules, plans, subscriptions, and other platform controls. The exact first-release screens, operations, and rules are still under discovery. The confirmed first-release commercial model is a monthly merchant subscription with no payment gateway/provider integration.

The Super Admin boundary covers platform-level decisions. Restaurant operations remain in merchant-facing applications. The NestJS backend owns authoritative business and access decisions; the React UI does not connect to PostgreSQL. The first implementation slice uses reversible cookie-session infrastructure and minimal persistence for the confirmed flow. It does not settle the final authentication strategy, recurring subscription policy, or payment collection procedure.

### Decision interpretation

- **CONFIRMED** means explicitly approved in the source documents or by the product owner in this discussion; a confirmed platform direction does not by itself approve an MVP screen.
- **PROPOSED** means a candidate feature or workflow awaiting approval.
- **OPEN** means a material rule or inclusion decision is unresolved.
- **DEFERRED** means outside the first release as recorded in the sources; any qualified proposal is identified as such.
- **BASELINE** in MVP_SCOPE.md is a conditional security/data-integrity expectation if the related feature ships; it is not approval of that feature.

### Decisions confirmed in this discussion

| ID     | Confirmed decision                                                                                                                                                                                                  | Remaining detail                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| SA-D01 | For the first release, only a Super Admin creates restaurant merchant accounts. Merchant self-registration is deferred from the first release.                                                                      | Whether self-registration is added later is undecided.                                                            |
| SA-D02 | The four required creation fields are restaurant name, restaurant contact number, owner's name, and owner's mobile number. Legal/commercial fields are not required at initial creation unless separately approved. | Formats, verification, uniqueness, optional fields, and correction rules are OPEN.                                |
| SA-D03 | Creation by the Super Admin counts as merchant approval; no second approval action is needed for that creation path. Subscription activation remains separate.                                                      | The first-month activation rule is SA-D06; post-expiry access remains OPEN.                                       |
| SA-D04 | The Super Admin creates the owner's username and password and sends those credentials to the owner for the first release.                                                                                           | Username format, recovery, and exposure controls are OPEN. Delivery is specified in SA-D08.                       |
| SA-D05 | The owner cannot sign in or configure the restaurant before subscription activation.                                                                                                                                | First-month activation is defined in SA-D06; renewal, expiry, and restriction behavior are OPEN.                  |
| SA-D06 | For the first month, the Super Admin manually activates the subscription only after confirming that the first month's fee was collected outside the platform.                                                       | Collection method, confirmation evidence, effective date, renewal, expiry, and later-month handling are OPEN.     |
| SA-D07 | The admin-created password remains the owner's password after first login; no mandatory first-login change is required.                                                                                             | Password recovery, voluntary change, and revocation remain OPEN. Delivery is specified in SA-D08.                 |
| SA-D08 | After verifying the owner by phone, the Super Admin manually sends the username and password in a private message to the owner's mobile number.                                                                     | The messaging provider and password recovery procedure are not selected; no messaging API integration is implied. |

## 2. MVP feature inventory

Priorities below are discovery recommendations, not an approved delivery sequence. P0 means needed to define a safe first-release administration path; P1 means useful after its dependencies are decided. "Later" means no first-release commitment.

| ID     | Feature                                         | Description                                                                                                                                                     | Actors                       | Priority | Decision status                                                        | Dependencies                                                 |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| SA-01  | Platform administration                         | Central management of merchants and platform configuration is part of the product vision; exact MVP surface is undecided.                                       | Super Admin                  | P0       | CONFIRMED platform direction; MVP scope OPEN                           | Approved MVP boundary                                        |
| SA-02  | Administrator access                            | Protect the admin interface and authorize platform actions. Mechanism and admin role matrix remain open.                                                        | Platform operator            | P0       | PROPOSED MVP feature                                                   | Identity and authorization decisions                         |
| SA-03  | Admin merchant creation                         | A Super Admin creates a restaurant merchant with the four confirmed contact fields.                                                                             | Super Admin                  | P0       | CONFIRMED first-release flow and fields                                | Validation and identity decisions                            |
| SA-03B | Merchant list/detail                            | Locate and inspect merchant metadata.                                                                                                                           | Super Admin                  | P1       | PROPOSED                                                               | Approved fields and platform authorization                   |
| SA-04  | Merchant owner credentials                      | A Super Admin creates the username/password, verifies the owner by call, and sends them privately to the owner's mobile; first login does not require a change. | Super Admin, owner           | P0       | CONFIRMED first-release flow; recovery/security details OPEN           | Identity model and recovery policy                           |
| SA-05  | Approval by creation                            | Admin creation counts as approval; subscription activation is independent.                                                                                      | Super Admin                  | P0       | CONFIRMED first-release rule                                           | Access and subscription policy                               |
| SA-05A | Pre-activation login gate                       | The owner cannot sign in or configure the restaurant before subscription activation.                                                                            | Owner                        | P0       | CONFIRMED first-release rule                                           | Activation condition and authorization enforcement           |
| SA-05B | Suspension and reactivation                     | Restrict or restore merchant access under rules yet to be approved.                                                                                             | Authorized platform operator | P1       | PROPOSED                                                               | Authority, effects, subscription interaction                 |
| SA-06  | Monthly plan administration                     | Use a monthly plan without a gateway; a Super Admin manually activates month one after confirming external collection.                                          | Super Admin                  | P0       | CONFIRMED model and initial activation rule; remaining operations OPEN | Plan definition, confirmation evidence, renewal/expiry rules |
| SA-07  | Entitlement enforcement                         | Apply approved plan features/limits at the backend; UI visibility alone is insufficient.                                                                        | Super Admin, merchant users  | P1       | PROPOSED                                                               | Plan/entitlement definitions, authorization boundary         |
| SA-08  | Sensitive-action audit                          | Record relevant administrative changes without exposing secrets. The MVP draft calls this BASELINE if actions ship.                                             | Platform operator, auditor   | P0       | PROPOSED scope; conditional BASELINE                                   | Event list, retention, viewer access                         |
| SA-09  | Activity and module catalog                     | Manage supported business activities and platform modules in the long-term platform vision.                                                                     | Super Admin                  | Later    | CONFIRMED platform direction; MVP timing OPEN                          | Activity/module governance                                   |
| SA-10  | Branch overview                                 | Possible support visibility into merchant branches without routine access to tenant-owned operations.                                                           | Authorized platform operator | Later    | OPEN                                                                   | Support-access policy, branch requirements                   |
| SA-11  | Design templates and advanced platform controls | Long-term platform capabilities; first-release inclusion has not been approved.                                                                                 | Super Admin                  | Later    | OPEN                                                                   | Product scope decisions                                      |
| SA-12  | Payment gateway/provider integration            | Automated provider collection is outside the first release.                                                                                                     | Platform operator            | Later    | DEFERRED — confirmed for first release                                 | Separate future decision                                     |
| SA-13  | Commission/hybrid administration                | Possible later commercial models; not part of the proposed restaurant MVP.                                                                                      | Platform operator            | Later    | DEFERRED in MVP proposal                                               | Future commercial model decision                             |

The product owner has since authorized building the confirmed first slice. No marketplace administration or advanced analytics is included in this MVP proposal.

## 3. Merchant onboarding

### Confirmed first-release route — Super Admin creation

1. The owner and Waffarly connect through a channel still to be chosen, potentially WhatsApp. This does not imply a WhatsApp API integration.
2. A Super Admin collects restaurant name, restaurant contact number, owner's name, and owner's mobile number. Formats, verification, and duplicate checks are still to be specified.
3. The administrator creates the merchant record and associates the owner identity according to an approved identity/membership model.
4. The Super Admin creates the owner's username and password. After verifying the owner by phone, the administrator sends them manually in a private message to the owner's mobile number. The owner is not required to change the password at first login. Password recovery and exposure controls remain undecided.
5. Creating the merchant counts as its approval. After confirming first-month collection outside the platform, a Super Admin manually activates the subscription. The owner cannot sign in or configure the restaurant before activation.

### Self-registration — deferred from the first release

The owner-started application discussed in earlier documents is not part of the first-release onboarding route. Its later inclusion and review rules remain undecided. No first-release self-registration or application-review flow is implied.

**Required validation to decide:** formats and verification for the four confirmed fields; normalization and uniqueness of contact numbers; duplicate merchant handling; username format and uniqueness; authorized activity and plan selection; owner consent; and who may correct submitted details. Legal/commercial fields are not required at initial creation under SA-D02 unless separately approved.

**Errors and edge cases to specify:** existing owner identity; same owner joining multiple merchants; duplicate restaurant; credential sent to the wrong recipient or intercepted; failed delivery; lost or forgotten password; interrupted creation; transfer of ownership; and inconsistent merchant, approval, and subscription conditions. Declined applications matter only if a future self-registration flow is approved. Surface safe, actionable errors without leaking account existence or secrets.

## 4. Merchant lifecycle

| Possible operation    | Current understanding                                                                                                                    | Decision needed                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Create                | Super Admin creation with the four confirmed fields is the first-release route; creation counts as approval.                             | Validation and owner identity details.                                                   |
| Review/approve/reject | No separate approval or application review applies to the confirmed first-release route.                                                 | Any future self-registration/review rules need separate approval.                        |
| Activate/access       | A Super Admin manually activates month one after confirming external collection; owner sign-in and configuration are blocked beforehand. | Confirmation evidence, effective date, and access after expiry or suspension.            |
| Suspend               | Candidate platform action.                                                                                                               | Reasons, authorized actors, notice, effect on staff/storefront/orders and existing data. |
| Reactivate            | Candidate platform action.                                                                                                               | Preconditions, subscription interactions, audit/notification requirements.               |
| Close/archive/delete  | No approved behavior.                                                                                                                    | Whether needed, retention, restoration, and legal constraints.                           |

No status names, transition graph, automatic triggers, or deletion policy are approved here. Platform suspension and subscription-based restriction should remain distinct concepts until their interaction is defined.

## 5. Subscription administration

**Confirmed:** The first release uses monthly merchant subscriptions and no payment gateway/provider integration. For month one, the Super Admin manually activates the subscription after confirming that its fee was collected outside the platform. Neither the collection channel nor the required proof has been selected.

**Open:** plan catalog/prices and limits; plan assignment timing; first-month collection method and evidence; activation effective date/time zone; renewal method; expiry; grace period; trials; later-month collection/reconciliation; plan changes; refunds; restriction behavior; and what happens to ongoing restaurant operations. No automatic renewal or later-month payment rule is assumed.

**Proposed boundary:** record only approved subscription facts and compute approved entitlements in the backend. Distinguish commercial subscription state from merchant review and identity access. A manual collection record is a possible future workflow, not a requirement.

## 6. Security and authorization

- Only authenticated, appropriately authorized platform personnel may use administrative actions; the session mechanism, admin roles, and permission matrix remain OPEN.
- Tenant-owned data must remain isolated. A platform administrator's access to merchant operational data, impersonation, and support access require explicit policy; no unrestricted access is inferred from the Super Admin label.
- The backend must enforce administrative authority and tenant/entitlement boundaries independently of hidden buttons or frontend routing.
- The approved first-release flow exposes the password to the creating Super Admin, sends it privately after a verification call, and does not require changing it at first login. This leaves a continuing disclosure risk if the administrator or message retains the password. Reset/recovery, voluntary change, and limiting who can view the password remain OPEN. Plaintext passwords must not be stored or logged.
- The backend must reject owner sign-in before subscription activation, regardless of frontend visibility. The policy after expiry or suspension remains OPEN.
- Sensitive operations should have explicit authorization, safe error messages, and auditable actor/target/action/outcome records. The exact event list, retention, and audit access remain OPEN.
- Avoid storing secrets or unnecessary personal data in logs and audit events.

## 7. Proposed architecture

| Boundary                         | Candidate responsibility                                                                                     | Dependency rule                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| apps/super-admin                 | React presentation, forms, tables, API requests, client-side states.                                         | Calls NestJS API only; no Prisma or direct database access.     |
| apps/api platform administration | Approved merchant registry, lifecycle, owner provisioning, plan administration, and authorization use cases. | Owns business rules; modular boundaries chosen after decisions. |
| apps/api shared infrastructure   | Authentication integration, audit plumbing, database access.                                                 | Does not grant blanket tenant access.                           |
| packages/contracts               | Approved request/response contracts when flows are defined.                                                  | No NestJS or Prisma runtime dependency.                         |
| packages/database                | Approved persistence model and migrations later.                                                             | No business schema before ERD and rule approval.                |

These responsibility boundaries guide the confirmed first implementation slice and later work. Avoid circular dependencies and keep subscription, merchant lifecycle, and owner identity rules distinct.

## 8. UI requirements under discovery

| Candidate view or action             | Purpose                                                                                             | Decision status                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Admin sign-in/access-denied state    | Limit access to platform personnel.                                                                 | PROPOSED; mechanism OPEN                         |
| Merchant list/search and detail      | Locate and inspect approved merchant metadata.                                                      | PROPOSED; fields and filters OPEN                |
| Manual merchant creation form        | Collect approved basic restaurant/owner contact information.                                        | CONFIRMED flow; fields and layout OPEN           |
| Owner credential creation/delivery   | Let a Super Admin establish username and password and communicate them under an approved procedure. | CONFIRMED flow; channel and security policy OPEN |
| Review/approval actions              | Possible future application review; no separate action for first-release admin creation.            | DEFERRED from first-release route                |
| Suspension/reactivation controls     | Apply approved platform restrictions.                                                               | PROPOSED; authority/effects OPEN                 |
| Monthly plan/subscription view       | Display and administer approved plan facts.                                                         | PROPOSED; lifecycle OPEN                         |
| Activity/module, branch, audit views | Later or conditional administrative visibility.                                                     | OPEN MVP scope                                   |

Every approved view should define loading, empty, success, validation-error, forbidden, and server-error states; show only authorized actions; and confirm high-impact changes. Exact labels, fields, filters, and navigation are pending decisions.

## 9. Open questions and source conflict

| Priority | ID      | Decision required                                                                                                                     | Why it matters                                                                                         |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| P0       | SA-Q02A | Which of the two contact numbers must be verified, and how should duplicate numbers be handled?                                       | Determines validation and safe account ownership. The four required fields are confirmed.              |
| P0       | SA-Q03A | What happens to login and operations after subscription expiry or merchant suspension?                                                | Determines restriction rules. Pre-activation owner login and first-month activation are decided.       |
| P0       | SA-Q04  | How can a lost or exposed password be replaced, and who may initiate that action?                                                     | Determines credential recovery risk. Private-message delivery after phone verification is decided.     |
| P0       | SA-Q05  | Who may create merchants, suspend/reactivate them, change plans, and inspect audit records?                                           | Determines platform permission model and accountability; no separate creation approval is planned.     |
| P0       | SA-Q06  | What evidence confirms first-month collection, when does that month start, and how are later months renewed, expired, and restricted? | Determines subscription timing and entitlements. The first-month manual activation trigger is decided. |
| P1       | SA-Q07  | Can one owner identity manage multiple merchants, and can ownership transfer?                                                         | Determines identity and membership relationships.                                                      |
| P1       | SA-Q08  | What suspension effects apply to owner/staff access, storefront, existing orders, and retained data?                                  | Determines safe restriction behavior.                                                                  |
| P1       | SA-Q09  | Which actions require audit, who can view it, and how long is it retained?                                                            | Determines event and privacy requirements.                                                             |
| P1       | SA-Q10  | Are activity/module catalog, branch overview, and support access needed at restaurant launch?                                         | Prevents premature platform scope.                                                                     |

**Source reconciliation needed:** PROJECT_OVERVIEW.md's illustrative onboarding journey says a merchant signs up/applies, while its explicit open-decision list asks which route to use. The product owner has now confirmed Super Admin-only creation for the first release (SA-D01). The source documents still contain the older open wording. They were not edited because this discovery brief requires explicit authorization before changing them.

**Credential proposal superseded:** The discovery brief preferred a single-use setup invitation and cautioned against assuming an administrator-created plaintext password. The product owner selected administrator-created credentials (SA-D04), no mandatory first-login change (SA-D07), and private-message delivery after a verification call (SA-D08). The earlier invitation proposal is not approved.

**Source availability:** DECISIONS.md was requested if present, but no such file exists. Approved decisions remain in the existing source documents. This draft does not modify those documents.

## 10. Acceptance criteria

### Confirmed constraints, conditional on an approved administration flow

- **AC-C01:** Any first-release merchant commercial plan represented by this module follows a monthly subscription model.
- **AC-C02:** The first-release flow makes no payment gateway/provider calls for merchant subscription collection.
- **AC-C03:** Tenant-owned data access, if exposed by an approved admin flow, is authorized and isolated by backend checks; the frontend cannot directly access PostgreSQL.
- **AC-C04:** The first-release restaurant merchant creation path is available to Super Admin personnel only; no owner self-registration path is part of that release.
- **AC-C05:** The creation process requires restaurant name, restaurant contact number, owner's name, and owner's mobile number; no legal/commercial field is required at initial creation.
- **AC-C06:** Successful Super Admin creation counts as merchant approval and does not itself activate the monthly subscription.
- **AC-C07:** A Super Admin creates the owner's username and password and sends them to the owner; the delivery procedure remains to be approved.
- **AC-C08:** Before subscription activation, the owner cannot sign in or configure the restaurant.
- **AC-C09:** A Super Admin can activate the first month only after confirming that its fee was collected outside the platform; activation is a separate action from merchant creation and makes no gateway call.
- **AC-C10:** First login does not require the owner to replace the admin-created password.
- **AC-C11:** After a verification call, the Super Admin manually sends credentials in a private message to the owner's mobile number; the platform does not need a messaging API integration for this flow.

These criteria do not approve a password recovery or voluntary-change process, collection channel/evidence, activation effective date, plan screen, or renewal process.

### Proposed criteria — not approved for implementation

- **AC-P01:** Once exact fields and validation rules are approved, duplicate and invalid merchant submissions receive safe errors.
- **AC-P02:** If a password recovery process is approved, it lets the verified owner replace a lost or exposed password without revealing the existing password; password values are never logged or stored in plaintext.
- **AC-P03:** If suspension/reactivation actions are approved, only authorized platform personnel can perform them, and their access effects follow approved rules.
- **AC-P04:** If plan administration is approved, backend entitlement checks follow approved plan and lifecycle rules.
- **AC-P05:** If sensitive actions ship, required audit events identify actor, target, action, and outcome without recording secrets.

## 11. Proposed implementation roadmap

1. **Decision gate:** Resolve the remaining credential, validation, permission, and subscription details in SA-Q02A–SA-Q06 and reconcile older onboarding wording in source documents only with explicit authorization.
2. **Security foundation:** Specify platform administrator identity, permissions, owner setup, tenant access, and audit policy; then design the ERD/contracts.
3. **Merchant registry and onboarding:** Implement only the approved entry route and owner setup path.
4. **Lifecycle:** Add approved access activation, suspension, and reactivation operations with explicit acceptance criteria; no separate approval step for admin-created merchants.
5. **Subscription administration:** Add approved monthly plan facts, lifecycle, and entitlement checks without a gateway.
6. **Later platform capabilities:** Consider activity/module catalog, branch overview, templates, commissions/hybrid, and other features only after separate scope approval.

The product owner's later instruction authorized building the confirmed first slice. This roadmap does not approve implementation of the remaining PROPOSED or OPEN features.

## 12. Current implementation slice

- The NestJS API supports Super Admin sign-in, merchant creation/listing, and one-time first-month activation. Owner sign-in and profile access are rejected until activation.
- Super Admin identity is configured by username and scrypt password hash in local environment variables. Opaque session tokens are held in HTTP-only cookies and stored only as hashes in PostgreSQL. This is an initial technical choice, not a final authentication decision.
- Prisma stores merchants, one owner account per merchant for this first slice, first-month activation time/administrator, and sessions. No full plan, price, payment, renewal, or expiry model is present.
- The Super Admin UI shows newly entered owner credentials until dismissed and instructs the administrator to verify the owner by phone and send them manually in a private message. The API never returns a stored password, and no messaging provider is integrated.
- The Merchant Dashboard gates sign-in on first-month activation and displays the four confirmed restaurant and owner contact fields as a read-only profile. Editing these fields and further restaurant configuration remain future work.
