# Waffarly — Plans & Subscriptions Overview

**Document status:** Domain discovery with the initial monthly-plan administration slice authorized and implemented; broader subscription requirements remain open.  
**Last updated:** 2026-10-13  
**Parent:** [Super Admin Overview](../OVERVIEW.md)  
**Related domain:** [Merchant Management](../merchants/OVERVIEW.md)  
**Current phase:** Phase F — initial monthly-plan administration (SA-PS01); remaining subscription features are in discovery.

## 1. Purpose and Scope

Plans & Subscriptions defines Waffarly's commercial offers and administers each merchant's subscription relationship. It owns discovery of pricing, commercial feature/limit entitlements, plan assignment, subscription timing, activation, renewal, expiry, and collection administration. Merchant Management owns onboarding, approval, owner provisioning, and platform suspension/reactivation.

The first release targets restaurants in Egypt, offers multiple monthly subscription plans (PS-D02), and excludes payment gateway/provider integration. The existing first slice records manual first-month activation after a Super Admin confirms external fee collection. The exact plan count, names, differences, prices, billing dates, later-month collection, and operational restrictions remain OPEN.

The product owner selected discovery, then a basic monthly plan first (PS-D03), and explicitly authorized both documentation and app implementation (PS-D04). The [Monthly Plan specification](MONTHLY_PLAN.md) records the implemented create/list/edit slice, its contracts, and reversible validation/persistence choices. This overview preserves discovery of assignment, entitlements, coverage, and collection; those features are not approved by the initial offer administration.

### Sources and Decision Status

- [Merchant Management overview](../merchants/OVERVIEW.md): onboarding boundaries, MER-D01–MER-D03, and subscription dependencies MER-Q04/MER-Q07.
- [Parent overview](../OVERVIEW.md): stable SA-PS feature IDs, domain relationships, and reconciliation SA-R03.
- [Existing Super Admin specification](../../SUPER_ADMIN.md): recorded first-slice rules SA-D03/SA-D05/SA-D06 and questions SA-Q03A/SA-Q06.
- [PROJECT_OVERVIEW.md](../../../../PROJECT_OVERVIEW.md) and [MVP_SCOPE.md](../../../../MVP_SCOPE.md): monthly launch model, no-provider constraint, platform vision, and unresolved release scope.
- [Technical decisions](../../../architecture/TECHNICAL_DECISIONS.md) and inspected source files in section 9: existing implementation, separate from approved requirements.
- Current product-owner direction: “Start the discovery document,” “multiple plans,” “just build a monthly plan for now,” and then “do both” for documentation and implementation.

**CONFIRMED** means explicitly approved within its stated boundary. **PROPOSED** means a candidate awaiting approval. **OPEN** means unresolved. **DEFERRED** means postponed, with proposal-only deferrals qualified. Platform vision, feature delivery, detailed behavior, and implementation evidence are separate facts. Conditional security/integrity baselines do not approve additional features.

## 2. Recorded Decisions and Reconciliation

### 2.1 Current Discovery Direction and Approved Rules

| ID     | Date       | Status                                 | Decision                                                                                | Boundary / affected documents                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------- | -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PS-D01 | 2026-10-13 | CONFIRMED discovery direction          | Start Plans & Subscriptions discovery, using Merchant Management as the related domain. | The owner explicitly selected the discovery document. This overview and the parent entry point record the direction; it does not approve pricing, lifecycle rules, feature delivery, technical design, or implementation.                                                                                                                                                                                                      |
| PS-D02 | 2026-10-13 | CONFIRMED launch scope                 | Offer multiple monthly subscription plans for restaurants at launch.                    | The owner selected “multiple plans” when asked whether launch should offer one monthly plan or multiple plans. This resolves the single-versus-multiple choice only. Exact count, names, differences, prices, currency/tax treatment, catalog governance, assignment, and lifecycle remain OPEN. Affects SA-PS01, PS-Q01/PS-Q02, the parent inventory, PROJECT_OVERVIEW.md, and MVP_SCOPE.md. No implementation is authorized. |
| PS-D03 | 2026-10-13 | CONFIRMED current work focus           | Start with a basic monthly plan now.                                                    | The owner's latest direction is “just build a monthly plan for now.” The [Monthly Plan specification](MONTHLY_PLAN.md) focuses SA-PS01 on the basic offer; tier-difference discussion is postponed for current work. It does not explicitly replace PS-D02 with a single-plan-only launch restriction. Fields, price/currency, edit rules, and requirement approval remain OPEN. No broader subscription behavior is inferred. |
| PS-D04 | 2026-10-13 | CONFIRMED implementation authorization | Document and implement basic monthly-plan administration.                               | The owner answered “do both” when asked to choose documentation or app implementation. SA-PS01 now supports create/list/edit with administrator-entered commercial fields. Concrete choices are recorded in the [Monthly Plan specification](MONTHLY_PLAN.md); no actual price, merchant assignment, entitlement, activation, renewal, expiry, or collection policy is selected by this slice.                                 |

### 2.2 Preserved Product Constraints and First-Slice Rules

| Source                                                  | Recorded decision                                                                                                                                                   | Qualification / remaining detail                                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PROJECT_OVERVIEW commercial model; MVP_SCOPE DEC-008    | Monthly merchant subscriptions at launch.                                                                                                                           | PS-D02 confirms multiple plans. Exact count, price, currency, tax treatment, feature limits, and the meaning of a subscription month remain OPEN. Source-local DEC numbering must not be treated as a shared identifier. |
| PROJECT_OVERVIEW payment integration; MVP_SCOPE DEC-009 | No payment gateway/provider integration in the initial release.                                                                                                     | Applies to customer and subscription integrations. External collection channel and customer checkout/payment method are separate OPEN decisions.                                                                         |
| Existing specification SA-D03                           | Manual Super Admin creation counts as merchant approval; subscription activation is separate.                                                                       | Does not automatically approve a self-registration application or assign a plan.                                                                                                                                         |
| Existing specification SA-D05                           | Before subscription activation, the owner cannot sign in or configure the restaurant.                                                                               | Does not define post-expiry access, staff/POS/storefront effects, or a pre-activation account-setup exception.                                                                                                           |
| Existing specification SA-D06                           | Super Admin manually activates month one only after confirming that its fee was collected outside the platform.                                                     | Collection channel, evidence, amount validation, effective date, renewal, expiry, and later-month handling remain OPEN.                                                                                                  |
| Merchant Management MER-D01–MER-D03                     | Analyze self-registration alongside manual creation; application-only submission with four required contact fields; owner account provisioning only after approval. | Self-registration delivery remains OPEN. Approval/provisioning does not itself activate a subscription or grant Merchant Dashboard access.                                                                               |

### 2.3 Reconciliation and Discovery Boundaries

[SA-R03](../OVERVIEW.md) preserves the narrow recorded activation rule despite older root-document wording that treats activation/collection as wholly open. Discovery uses SA-D06 for the existing first-month trigger while leaving the broader recurring workflow unresolved. No change to historical rules is approved by PS-D01.

An activation timestamp does not establish an end date, collection amount, plan entitlement, invoice, or renewal. “Monthly” does not choose a rolling calendar month, a fixed calendar billing period, or a fixed number of days. Egypt as the initial market does not itself approve currency, tax rules, or the subscription time zone.

Any approved change to the recorded activation/access rule must identify its impact on this overview, the parent reconciliation register, Merchant Management, the existing specification, root overview/MVP scope, and relevant architecture/setup/README records. Existing-code impact is recorded during discovery; code remains unchanged.

## 3. Domain Boundaries

| Area                             | Plans & Subscriptions responsibility                                                     | Separate responsibility / unresolved boundary                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan definition                  | Commercial offer, approved price/billing period, feature inclusion, and limits.          | Activity/module definitions describe supported software; metadata cannot create functionality. Editable catalog governance is OPEN.                            |
| Merchant subscription            | Merchant association with an offer and approved subscription facts over time.            | Merchant identity, approval, and owner provisioning belong to Merchant Management/shared identity. Assignment timing and cardinality are OPEN.                 |
| Commercial entitlement           | Decide commercial eligibility for a supported capability and approved limits.            | Backend enforcement is shared with operational domains; activity compatibility, person-level permission, and tenant configuration remain distinct.             |
| Activation, renewal, expiry      | Define commercial access conditions and timing.                                          | Effects on owner/staff sessions, storefront, POS, and orders require coordinated operational decisions. No universal restriction is assumed.                   |
| Collection administration        | Define how external fee collection is confirmed and, if approved, evidenced or recorded. | Waffarly does not collect through a provider in this release. Accounting, invoices, tax reporting, reconciliation, and refunds are not automatically included. |
| Merchant suspension/reactivation | Supply applicable subscription eligibility when merchant access is evaluated.            | Merchant Management owns platform restrictions; reactivation does not pay or renew a subscription, and renewal does not remove a platform suspension.          |
| Customer checkout                | No merchant subscription collection rule establishes customer payment behavior.          | Storefront/order domains define approved customer checkout and collection.                                                                                     |
| Future commercial models         | Record dependencies for commission, hybrid, add-ons, or later provider integration.      | Separate future scope decisions; no launch implementation implied.                                                                                             |

**Practical Waffarly example:** Approving a restaurant application establishes an onboarding outcome. Confirming that the owner paid a fee establishes a collection assertion. Assigning an offer establishes a commercial association. Each needs its own approved rule; none automatically publishes the restaurant storefront.

## 4. Actors and Responsibilities

These are responsibilities for discovery, not an approved administrator role hierarchy or permission matrix.

| Actor                                                 | Responsibility                                                                                                      | Permission / policy boundary                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform administrator / Super Admin                  | Perform authorized plan/subscription administration; the recorded first slice includes manual month-one activation. | Who may edit offers, assign plans, confirm collection, renew, correct dates, or view history remains OPEN. All approved actions need backend authorization.          |
| Personnel confirming external collection, if assigned | Verify collection under the approved procedure.                                                                     | No separate finance role, provider connection, bank access, or segregation-of-duties workflow is approved. Evidence and correction authority are OPEN.               |
| Merchant owner                                        | Be associated with an approved offer and use permitted tenant capabilities when access conditions allow.            | Plan selection, self-service changes, subscription visibility, renewal requests, and collection submission are OPEN. No pre-activation dashboard access is approved. |
| Merchant employee / cashier                           | Use entitled capabilities within person-level permissions.                                                          | Commercial eligibility does not grant employee permission; expiry/restriction effects need operational discovery.                                                    |
| Prospective merchant / applicant                      | Participate in the separately approved onboarding route.                                                            | MER-D02 prevents owner account provisioning before self-registration approval. Public plan display or plan selection in the application is not approved.             |

The backend is authoritative for approved subscription and entitlement rules. Human collection confirmation remains an attributable administrative decision, not independently verified payment-provider evidence.

## 5. Feature Inventory

Reuse parent `SA-PS*` IDs. Supporting discovery areas do not automatically become separate launch features. The selected SA-PS01 has a [Monthly Plan specification](MONTHLY_PLAN.md); other feature files are created only when selected.

| Feature ID | Feature                                        | Analysis boundary                                                                                                     | Decision status                                                         | MVP relevance                                                                | Dependencies                                                                       |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| SA-PS01    | Plan definitions and pricing                   | Monthly offer name, exact price, currency, description, and edits.                                                    | CONFIRMED initial implementation PS-D04; commercial offers/prices OPEN. | Create/list/edit implemented; broader governance and offer definitions OPEN. | Admin session; price validation; future assignment/change rules.                   |
| SA-PS02    | Plan feature and limit definitions             | Capability inclusion, limit meaning/counting, dependency validation, and behavior when a limit is reached or reduced. | CONFIRMED platform vision; concrete entitlements OPEN.                  | PROPOSED scope; no launch capability list or quotas approved.                | SA-AM02/SA-AM03; operational domains; SA-X04.                                      |
| SA-PS03    | Merchant plan assignment and visibility        | Association timing, eligible offers, visibility, corrections, and any plan changes.                                   | PROPOSED MVP feature.                                                   | Scope/timing OPEN; absent from the existing slice.                           | Merchant record; SA-PS01; onboarding/access policy.                                |
| SA-PS04    | Manual first-month activation                  | Apply SA-D06; discover prerequisites, collection confirmation, effective date, and retry/concurrency behavior.        | CONFIRMED recorded first-slice rule; SA-R03 reconciliation OPEN.        | Existing narrow activation action; complete month semantics OPEN.            | Merchant approval/identity; admin authority; SA-PS06.                              |
| SA-PS05    | Renewal, expiry, and subscription restrictions | Later-month continuation, due dates, gaps, early/late renewal, and coordinated access effects.                        | OPEN.                                                                   | Needed to define recurring access; absent from the existing slice.           | Approved month semantics; collection policy; MER-Q04/MER-Q07; operational domains. |
| SA-PS06    | Collection evidence and administration         | Confirmation evidence, amount/date association, corrections, visibility, and any approved collection history.         | OPEN beyond the recorded month-one confirmation trigger.                | No evidence/ledger workflow approved.                                        | External collection procedure; admin authority; audit/privacy policy.              |
| SA-PS07    | Provider collection integration                | Automated subscription collection through a payment provider.                                                         | DEFERRED — confirmed.                                                   | Excluded from initial release.                                               | Separate future commercial/provider decision.                                      |
| SA-PS08    | Commission/hybrid administration               | Future transaction-based or mixed commercial models.                                                                  | DEFERRED in MVP proposal.                                               | Monthly subscriptions are the confirmed launch model.                        | Separate sales/commission rules and release approval.                              |

Trials, grace periods, discounts, add-ons, invoices, refunds, self-service billing, and automated reminders are discovery possibilities with inclusion OPEN. This overview does not defer or approve them by implication.

## 6. Rules, Alternatives, and Unresolved Behavior

### 6.1 Multiple Launch Plans — CONFIRMED; Definitions and Changes OPEN

PS-D02 records multiple monthly plans at launch. PS-D03 narrows current work to a [basic monthly plan specification](MONTHLY_PLAN.md), leaving tier differences for later discussion. The exact catalog count and names remain OPEN; the latest instruction does not explicitly impose a single-plan-only launch restriction. Plans could differ by supported capabilities, usage limits, or both; no differentiation model, tier hierarchy, or specific entitlement is approved yet. Offer changes also need agreed migration/change rules. Seeded offers, administrator-editable definitions, and a hybrid catalog remain alternatives; multiple plans do not by themselves require an editable catalog screen.

Discover price, currency, tax treatment, whether zero-price offers are allowed, and what an offer change does to current subscriptions. Potential approaches include preserving agreed terms, applying changes at renewal, or explicitly migrating merchants. No versioning model, grandfathering policy, price adjustment, or proration is approved.

### 6.2 Monthly Timing — OPEN

Compare a month measured from activation with fixed calendar billing periods. Define start/end boundaries, subscription time zone, end-of-month dates, leap years, and whether access changes at an instant or a business-day boundary. Fixed-day durations must not be adopted solely from the word “monthly.”

Discover whether activation takes effect immediately or at an approved different date, whether backdating/future dating is permitted, and who may correct errors. Early renewal might extend current coverage; late renewal might preserve an earlier billing anchor or start a new period. These alternatives affect fees and access and remain OPEN.

### 6.3 Collection and Activation — RECORDED FIRST-MONTH TRIGGER; DETAIL OPEN

SA-D06 requires external collection confirmation before manual month-one activation. It does not require a receipt upload, bank transfer, cash, invoice, reference number, or collection ledger. Define the minimum acceptable confirmation, who provides it, whether amount/currency must be checked, and how mistakes are corrected.

Later-month renewal must not inherit an unapproved collection mechanism from the initial rule. Partial payment, overpayment, advance payment, duplicate confirmation, reversals, disputes, and refunds require decisions only to the extent their workflows are selected.

### 6.4 Access and Operational Effects — COORDINATED OPEN RULES

Keep merchant approval, owner account provisioning, subscription eligibility, platform suspension, activity compatibility, capability implementation, and employee permissions distinct. Restoring one condition does not establish the others.

SA-D05 supplies the existing pre-activation owner login/configuration gate. It does not define expiry behavior for an existing session, customer browsing, new checkout, POS sales, kitchen work, accepted orders, or retained data. Those effects must be agreed with Merchant Management and the affected operational domains before recurring access is implemented.

### 6.5 Entitlements and Limits — OPEN

Define which supported capabilities, if any, are commercially gated. For each approved limit, specify its unit, tenant/branch scope, counting rules, and the behavior at or above the limit. Do not invent branch, employee, product, order, or storage quotas.

If an offer change reduces a limit below existing usage, decide whether existing data remains usable, only new additions are blocked, or another explicit process applies. No deletion, silent data loss, or permission grant follows from a plan change. Actual capability availability also depends on compatible activity and deployed functionality.

## 7. Candidate Journeys

These are analysis narratives, not finalized screens, persisted states, or a lifecycle graph. Candidate steps remain conditional on feature selection and rule approval.

### 7.1 Define an Initial Offer — PROPOSED SA-PS01/SA-PS02

An authorized administrator establishes an approved monthly offer and any approved capability/limit definitions. Supported capability and commercial validation are evaluated; the offer is made available only under agreed governance. Price fields, availability, edit behavior, actor permissions, and any UI remain OPEN.

### 7.2 Assign and Activate for a Manually Created Merchant — MIXED STATUS

Manual creation counts as approval under SA-D03 and does not activate access. If plan assignment is selected, an authorized administrator associates the merchant with an eligible offer at the approved point. After confirming first-month collection outside Waffarly, the Super Admin manually activates month one under SA-D06. The owner can sign in/configure only once the recorded activation condition is satisfied.

Assignment timing, effective dates, evidence, operational availability, and additional activation prerequisites remain OPEN. The existing implementation records activation without an offer, amount, or period end; that is evidence of the narrow slice, not the final subscription design.

### 7.3 Connect Self-Registration to Subscription Access — CONDITIONAL SA-M07/SA-PS03/SA-PS04

If self-registration ships, the applicant submits the four approved contact fields without creating an owner account for that application. Super Admin approval precedes owner account provisioning under MER-D02. Commercial association and subscription activation remain separate decisions. Approval or provisioning alone does not grant Merchant Dashboard access.

Whether collection/assignment occurs before or after provisioning, who coordinates those steps, and whether SA-D06 applies unchanged to this route remain OPEN. No additional required application fields, public pricing flow, or applicant billing account is introduced.

### 7.4 Renew or Reach the End of Coverage — OPEN SA-PS05/SA-PS06

An authorized actor applies the approved renewal and collection policy to an identified merchant subscription. The backend determines coverage using agreed timing and retry/concurrency rules. If coverage ends without renewal, only approved restrictions apply, with operational behavior coordinated across applications.

Renewal authority, automation, evidence, reminders, grace periods, gaps, session effects, and accepted-order handling remain OPEN. No scheduler, cron job, auto-renewal, or blanket shutdown is selected.

### 7.5 Change an Offer or Correct a Commercial Record — OPEN

If selected, an authorized actor changes an offer association or corrects an erroneous commercial fact using agreed effective dates, approval, and history rules. Existing price/limit commitments and current operations must be evaluated. Immediate versus next-renewal changes, proration, refunds, rollback, and correction mechanisms remain OPEN.

## 8. Dependencies, Edge Cases, and Security Concerns

| Concern                  | Required discovery                                                                                                             | Boundary                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant onboarding      | Assignment/collection/activation coordination for manual and any selected self-registration route.                             | Preserve SA-D03/SA-D05/SA-D06 and MER-D02; do not conflate approval with activation.                                                              |
| Administrator authority  | Who may view/edit offers, assign plans, confirm collection, activate/renew, correct dates, and inspect history.                | No new role names, tenant impersonation, or unrestricted operational access.                                                                      |
| Tenant isolation         | Validate merchant/subscription references and restrict tenant-visible commercial information.                                  | Global platform administration requires explicit authority; one tenant cannot access another tenant's subscription.                               |
| Capability applicability | Align entitlements with supported modules, activity compatibility, and approved operational scope.                             | SA-AM02/SA-AM03 and SA-X04 are dependencies, not approval of a module-management UI.                                                              |
| Date boundaries          | Month-end activation, leap years, time-zone boundaries, future/backdated activation, and late renewal.                         | Define business semantics before selecting storage fields or scheduling mechanisms.                                                               |
| Concurrency and retries  | Duplicate activation/renewal, simultaneous plan changes, uncertain responses, and collection reuse if collection records ship. | One confirmed action must not create unintended duplicate coverage; exact transaction/idempotency design is later work.                           |
| Collection errors        | Incorrect amount/merchant/date, partial or duplicate collection, reversal, and correction authority.                           | Analyze selected workflows; no financial ledger, refund integration, or payment channel is assumed.                                               |
| Access consistency       | Enforce approved eligibility across requests and existing sessions, and coordinate expiry with suspension.                     | Backend-owned rules; frontend visibility cannot be the authority. Effects remain OPEN.                                                            |
| Operations in progress   | New orders versus accepted orders, kitchen work, POS, customer visibility, and retained merchant data.                         | Do not infer a universal shutdown or deletion from expiry.                                                                                        |
| Entitlement changes      | Usage above a reduced limit, incompatible capability selection, or changed module dependencies.                                | No silent data deletion or escalation of employee permissions.                                                                                    |
| History and privacy      | Required actor, target, time, effective date, outcome, correction history, viewers, and retention.                             | No passwords, session tokens, or unnecessary personal/financial data in logs or history. Evidence attachment handling is conditional on approval. |

These security/integrity concerns apply to selected features. They do not approve additional integrations, storage models, admin screens, or notification providers.

## 9. Existing Implementation and Gaps

Static inspection of the current working tree confirms:

- [Super Admin UI](../../../../apps/super-admin/src/App.tsx): a per-merchant first-month activation action asks the administrator to confirm external collection. The list shows whether/when first-month activation was recorded.
- [Merchant controller](../../../../apps/api/src/modules/super-admin/merchant.controller.ts): a protected activation endpoint requires `externalCollectionConfirmed: true` and identifies the administrator.
- [Merchant service](../../../../apps/api/src/modules/super-admin/merchant.service.ts): records `firstMonthActivatedAt` and `firstMonthActivatedBy`; a conditional write prevents repeated initial activation and distinguishes a missing merchant from an already activated one.
- [Auth service](../../../../apps/api/src/modules/auth/auth.service.ts): rejects owner login and owner-profile access when the merchant has no first-month activation timestamp.
- [Prisma schema](../../../../packages/database/prisma/schema.prisma) and [activation contracts](../../../../packages/contracts/src/super-admin.ts): retain initial merchant activation facts/request. The new `MonthlyPlan` definition and [plan contracts](../../../../packages/contracts/src/plans.ts) add offer name, exact decimal price, currency, description, and monthly interval; no recurring subscription, collection-evidence, renewal, expiry, or entitlement models are added.
- [Plans UI](../../../../apps/super-admin/src/Plans.tsx), [controller](../../../../apps/api/src/modules/super-admin/plan.controller.ts), and [service](../../../../apps/api/src/modules/super-admin/plan.service.ts): authenticated create/list/edit, strict validation, identical initial-create retries, and stale-edit protection. The [Monthly Plan specification](MONTHLY_PLAN.md) records the actual implemented field limits and supported currencies.

The current working tree also contains in-progress merchant application/provisioning changes. Those changes are implementation evidence only and do not approve a subscription workflow. The linked domain overviews retain their recorded business decisions independently of implementation status.

There is no calculated period end or expiry enforcement: once an activation timestamp exists, the inspected access gate has no monthly time boundary. Plan catalog administration now exists; merchant assignment, recurring administration, collection ledger, granular administrator permissions, and general business audit history remain absent. The activation boolean is an operator assertion, not verified payment-provider collection.

PS-D04 authorizes the initial plan UI/API/schema/contracts and additive migration. Plan API tests cover authorization, price normalization/validation, retry handling, and stale/missing edits; builds/type checks and migration validation supplement them. Browser verification is limited by the unavailable browser connector. These checks do not establish recurring-subscription support or production readiness.

## 10. Focused Discovery Questions

Do not ask again whether subscriptions are monthly, whether launch has one or multiple plans, or whether a gateway is included. PS-D02 resolves the single-versus-multiple part of PS-Q01; its remaining details stay open. Preserve the recorded initial collection-before-activation rule unless the owner explicitly changes it. Questions below refine the selected domain; they are a queue, not a request to answer everything at once.

| ID     | Decision needed                                                                                                                                                      | Impact / existing reference                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PS-Q01 | With multiple launch plans confirmed, what exact count, names, prices, currency/tax treatment, and catalog governance are needed?                                    | PARTIALLY RESOLVED by PS-D02: multiple plans. Remaining details OPEN; SA-PS01; parent SA-O07. Avoid invented tiers/prices or an unnecessary editable catalog. |
| PS-Q02 | Which supported capabilities and limits belong to each offer, how are limits counted, and what happens when usage exceeds a limit?                                   | SA-PS02; SA-AM02/SA-AM03; SA-X04.                                                                                                                             |
| PS-Q03 | When is a merchant associated with an offer, who assigns it, and what subscription visibility is needed for administrators/owners?                                   | SA-PS03; MER-Q04. Does not add plan fields to the approved application.                                                                                       |
| PS-Q04 | What evidence is sufficient for first-month external collection confirmation, who confirms it, and what amount/date/correction facts must be retained, if any?       | SA-PS04/SA-PS06; existing SA-Q06; SA-R03. Trigger is recorded; channel and evidence are OPEN.                                                                 |
| PS-Q05 | When does month one start/end, what does “month” mean, which time zone applies, and are backdated/future dates allowed?                                              | SA-PS04/SA-PS05; parent SA-O05; MVP-Q06.                                                                                                                      |
| PS-Q06 | How are later months renewed, including early/late renewal and gaps; is continuation manual or automated, and what collection prerequisite applies?                  | SA-PS05/SA-PS06; SA-Q06; MVP-Q06. No automatic renewal or later-month manual settlement assumed.                                                              |
| PS-Q07 | What happens at expiry to owner/staff sessions, configuration, storefront browsing/checkout, POS, and accepted orders, and how does suspension interact?             | SA-PS05; MER-Q04/MER-Q07; SA-Q03A; parent SA-O06.                                                                                                             |
| PS-Q08 | Are trials, grace periods, discounts, add-ons, plan changes, or refunds needed at launch? If selected, what effective-date and price/limit preservation rules apply? | Inclusion OPEN; SA-PS01/SA-PS03/SA-PS05. Separate immediate versus next-period changes.                                                                       |
| PS-Q09 | Who may perform each commercial action, correct mistakes, view evidence/history, and what audit events/retention are needed?                                         | SA-X02/SA-X05; MER-Q06; parent SA-O04/SA-O10.                                                                                                                 |
| PS-Q10 | Which initial administration views/actions are essential, and which SA-PS feature should receive a dedicated specification first?                                    | Defines launch inclusion and the next discovery/specification step without creating implementation tickets.                                                   |

**Current slice — PS-D03/PS-D04:** Basic [Monthly Plan administration](MONTHLY_PLAN.md) is implemented. Actual commercial prices/names remain administrator-entered; tier differences under PS-Q02 are later discussion. Assignment, collection, coverage, and operational access remain separate SA-PS03–SA-PS06 work. Questions already answered in later decisions must be removed from the active queue or marked resolved.

## 11. Documentation and Discovery Roadmap

1. Record explicit answers with date, source, rationale, affected SA-PS IDs, and remaining questions. Maintain this overview and the parent inventory without converting proposals into confirmed requirements.
2. Coordinate onboarding/access answers with Merchant Management, particularly MER-Q04/MER-Q07. Preserve post-approval owner provisioning and the distinction between platform restrictions and subscription eligibility.
3. Select an individual feature for specification. Only then create its dedicated document using the parent template: goals, actors/permissions, rules, flows, edge cases, validation/security, tenant boundaries, dependencies, proposed data/API concepts, UI requirements, acceptance criteria, and open questions.
4. Resolve essential business rules and approve requirements before technical design. Note impact on existing first-month activation/authentication without extending the timestamp gate into an invented lifecycle.
5. Reconcile historical/root/architecture/setup records when decisions change their rules. The [Monthly Plan implementation](MONTHLY_PLAN.md) is authorized under PS-D04; broader features still need their own requirements and authorization. Initial plan administration does not finalize recurring subscription rules.

PS-D01 establishes discovery; PS-D02 records multiple launch plans; PS-D03 focuses on a basic monthly offer first; PS-D04 authorizes its documentation and implementation. Commercial offers/prices, monthly coverage timing, renewal, operational restrictions, and other delivery scope remain open for focused discussion.
