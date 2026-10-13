# SA-M07 — Merchant Self-Registration and Approval

**Status:** Initial implementation specification; implementation remains subject to product owner review.  
**Date:** 2026-10-13  
**Parent overview:** [Merchant Management](OVERVIEW.md)  
**Feature:** [SA-M07 — self-registration and application review](OVERVIEW.md#5-feature-inventory)

## Feature Overview

A restaurant owner submits an application containing four required contact fields. Submission creates an application record only. A Super Admin reviews the application and performs the platform's verification work. After approval, the owner account and merchant tenant are created together. Account setup uses the current recorded administrator-provisioned username and password flow. The new owner remains unable to sign in until the separately controlled first-month activation. If the Super Admin rejects an application, that decision is final for that application; an applicant who wants to try again must submit a new application (MER-D05). The Super Admin must enter a required free-text rejection reason, and the reason must be visible to the applicant (MER-D06/MER-D08). Per MER-D07, decide the reason access/delivery mechanism only after defining application-tracking UX.

## Business Goals

- Let restaurant owners request onboarding without the platform creating their account before approval.
- Let a Super Admin review the submitted contact details, carry out verification independently, and approve eligible requests.
- Keep application submission, merchant approval, owner-account provisioning, and subscription activation distinct.

## Actors and Permissions

| Actor | Responsibility | Authority |
| --- | --- | --- |
| Restaurant owner / applicant | Submit the required application information. | No owner account or Merchant Dashboard access is created by submission. |
| Super Admin | Review the submitted information, perform verification outside the application, and approve by creating merchant/owner records. | Authenticated administrator only. The existing administrator session mechanism is used in this slice. |

## Use Cases and Business Rules

- **Confirmed — application fields:** restaurant name, restaurant contact number, owner name, and owner mobile number, matching the recorded manual route (MER-D03). No additional required field is introduced.
- **Confirmed — application-only submission:** Submission creates an application record. It does not create an owner account, credential, merchant tenant, or dashboard session.
- **Confirmed — approval and provisioning order:** The owner account is not provisioned until Super Admin approval (MER-D02). In this implementation slice, merchant and owner records are created transactionally as part of approval; tenant provisioning timing is an implementation choice, not a separately approved business rule.
- **Confirmed — manual verification boundary:** The Super Admin personally reviews the information and performs any checks they consider necessary (MER-D04). Waffarly does not perform automated phone/contact verification or require a verification checkbox.
- **Confirmed — rejection outcome:** Rejection is final for the submitted application. It cannot be returned for correction or reopened for resubmission. A retry begins with a separate new application (MER-D05).
- **Confirmed — rejection reason:** The Super Admin must provide a reason, and it must be visible to the applicant (MER-D06). Reason format, content rules, and secure access/delivery mechanism remain OPEN.
- **Confirmed — rejection reason input:** The reason is mandatory free text entered by the Super Admin (MER-D08). Length bounds and content restrictions remain OPEN.
- **Confirmed — reapplication:** A new application from the same restaurant or owner contact is accepted as a separate application. If either the restaurant contact number or owner mobile number matches a prior rejected application, the Super Admin can see all its recorded data, including the rejection reason (MER-D09–MER-D11). Phone normalization/equality, multiple-match presentation, permissions, and retention/privacy rules remain OPEN. Reapplication does not reopen the rejected record or guarantee approval.
- **Preserved recorded policy:** Administrator-provisioned username and password remain the current recorded first-release setup route. The app does not store or log the plaintext password. Manual delivery and credential recovery remain subject to the source conflict and existing security questions SA-R02/MER-Q03.
- **Preserved recorded access rule:** Owner login and dashboard profile remain blocked before first-month subscription activation (SA-D05/SA-D06). Approval or account provisioning alone does not activate a subscription.
- **MVP delivery:** Self-registration is a confirmed discovery candidate. Shipping it alongside or instead of manual creation remains OPEN.

Rejection criteria, reason format/content constraints, applicant tracking UX, secure reason access/delivery, prior-application matching/history presentation, phone verification rules, retention, rate limits, and subscription renewal behavior remain OPEN. The owner explicitly left applicant-tracking UX undecided on 2026-10-13. MER-D05/MER-D06/MER-D08/MER-D09 settle the rejection outcome, visibility/input requirements, and reviewer access to prior rejection history on a new application, but do not specify a rejection screen, communication channel, applicant tracking page, matching logic, or record retention. Under MER-D07, do not choose a reason delivery/access channel before defining applicant tracking UX.

## Happy Paths

### Applicant

1. Applicant opens the public “Apply” page.
2. Applicant submits the four contact fields.
3. The application is stored; the applicant sees confirmation that no account or dashboard access has been created.

### Super Admin

1. Super Admin signs in and opens the pending application list.
2. Super Admin reviews the four submitted fields and independently performs any verification they consider necessary.
3. Super Admin supplies an owner username and password, then approves the application.
4. In one database transaction, the application is linked to a newly created merchant and owner account.
5. Merchant is listed as awaiting first-month activation. The Super Admin handles recorded credential delivery manually after successful approval.
6. Owner login remains blocked until an authorized administrator activates the first month under the current recorded subscription rule.

## Alternative and Failure Flows

- Invalid, missing, oversized, or unexpected fields receive a validation error and do not create an application.
- An unauthenticated request cannot list applications or approve one.
- Unknown applications return not-found; a repeated or concurrent approval returns conflict and cannot provision another merchant/account.
- An existing owner username returns a conflict. Application approval and merchant/account creation roll back together, leaving the application available for an administrator to retry with another username.
- If a database error occurs during provisioning, no partially approved request, orphan tenant, or owner is committed.
- A rejected application remains rejected and cannot be corrected/reopened for resubmission; a retry must use a new application (MER-D05). Rejection requires a reason visible to the applicant (MER-D06), but the mechanism and timing are OPEN.
- The current slice implements Super Admin rejection with a mandatory free-text reason, permanent rejection, and authenticated visibility of matching prior rejected applications. Applicant access to the reason and applicant dashboard access remain unimplemented/open. No owner account is created before approval.

## Validation and Security Requirements

- Server-side validation is authoritative. Names are trimmed and limited to the existing 160-character model bounds; contact strings are trimmed and limited to 3–32 characters, matching the existing account-creation contract. Product-owner approval of normalization, country formats, and uniqueness rules remains OPEN.
- Owner username and password are requested only on the authenticated approval action; the existing username character/length limits and 12–128-character password bounds are reused.
- Public submission returns a generic acknowledgement without application identifiers or access credentials. The application list and approval endpoint require an authenticated Super Admin session.
- The owner account is created with the existing scrypt hash helper. Passwords are not stored in the application, returned by the API, or added to application logs.
- Manual verification belongs to Super Admin operations outside the system; there is no automated phone call, message, payment, or verification integration.
- User permission, subscription entitlement, and the pre-activation access gate remain independent backend checks.

## Tenant Boundaries and Dependencies

- Before approval, application data is platform-owned and is not a merchant tenant workspace.
- Approval links the application to exactly one merchant; merchant creation, owner-account creation, and approval recording share a database transaction.
- Depends on Super Admin authentication, existing merchant/owner models, and first-month activation enforcement.
- Does not introduce an administrator permission matrix, subscription entity, expiry rule, general audit framework, or cross-tenant operational access.

## Proposed Data and API Concepts

The implemented slice stores the four submitted fields, submission timestamp, approval timestamp/administrator, rejection timestamp/administrator/reason, and a nullable unique link to its approved merchant. It has no user/account fields before approval. This model is scoped to the feature and does not finalize the overall merchant lifecycle schema.

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `POST /merchant-applications` | Public | Validate and store the four contact fields; return only `{ received: true }`. |
| `GET /admin/merchant-applications` | Super Admin | List submitted applications for human review. |
| `POST /admin/merchant-applications/:id/approve` | Super Admin | Accept `{ username, password }`; atomically approve, create/link merchant, and create owner account. Return the normal merchant summary. |
| `POST /admin/merchant-applications/:id/reject` | Super Admin | Accept a required non-empty `{ reason }`; permanently reject the application and record reviewer/time. |

Requests and responses use shared runtime-independent TypeScript contracts. The rejection endpoint and Super Admin reason/history response are implemented for this slice. No public endpoint exposes a rejection reason; per MER-D07, decide applicant access only after defining application-tracking UX. The API currently matches stored phone strings exactly after submission trimming; broader phone normalization remains OPEN.

## UI Requirements

- The public storefront shell exposes an application link and a form with the four fields, loading/submit state, validation feedback, and a clear receipt confirmation. It does not show a login form or application-tracking link.
- Super Admin shows submitted contact details in an authenticated applications panel, provides username/password inputs for an approval action, and reports validation/conflict/server failures safely.
- The panel provides a required free-text rejection reason and permanent rejection action. Confirmation is shown before rejection. The panel displays prior rejected applications, including all submitted fields and the reason, when either stored phone field matches. Applicant access to the reason remains unimplemented pending tracking UX; reason length/content constraints, phone normalization, and history privacy are OPEN.
- When either the restaurant contact number or owner mobile number matches a prior rejected application, the Super Admin must be able to view all data recorded for that earlier application, including its rejection reason (MER-D09–MER-D11). Phone normalization/equality, multiple-match presentation, and history permissions remain OPEN.
- After successful approval, the new merchant appears in the existing merchant list and credential panel. The existing manual first-month activation action remains distinct.
- The form text does not promise a review deadline, acceptance, or subscription activation.

## Acceptance Criteria

- **AC-01:** A valid public submission persists the four fields without creating a merchant or owner account.
- **AC-02:** Invalid requests do not persist and return a safe validation error.
- **AC-03:** Applicant responses reveal neither the submitted record nor owner credentials.
- **AC-04:** Unauthenticated users cannot enumerate applications or approve an application.
- **AC-05:** Only Super Admin can retrieve submitted contact details and approve an application.
- **AC-06:** Successful approval creates one merchant and one owner account, links them to the application, and records administrator/time atomically.
- **AC-07:** Duplicate/concurrent approvals do not create a second merchant/account.
- **AC-08:** Username collision or transactional failure leaves no partial tenant/account or approved application link.
- **AC-09:** Password is hashed. Owner cannot authenticate or read the Merchant Dashboard profile before first-month activation.
- **AC-10:** Manual verification remains an operator activity without an automated call/message integration.
- **AC-11:** Once rejected, an application cannot be approved later or reopened for corrections/resubmission. Any applicant retry is submitted as a new application.
- **AC-12 (partially implemented):** The Super Admin records a rejection reason. Applicant visibility remains pending the tracking UX and access decision.
- **AC-13:** The rejection action requires a non-empty free-text reason from the Super Admin. Length bounds, formatting, and content restrictions remain OPEN.
- **AC-14:** A reapplication from the same restaurant or owner contact is accepted as a new application. When identified as related, the Super Admin can view the prior rejected application; the earlier record remains rejected and is not reopened.
- **AC-15:** A match on either the restaurant contact number or owner mobile number surfaces every matching prior rejected application to the Super Admin, with all recorded application data and rejection reason. Current matching is exact on trimmed stored strings; broader phone normalization/equality remains OPEN.

## Open Questions

- Is self-registration included alongside the manual route in the MVP?
- Does the applicant need to track application status without an account, and what should that experience expose? This was explicitly left OPEN on 2026-10-13; decide before selecting the reason delivery/access mechanism (MER-D07).
- What rejection criteria, free-text length bounds, and content restrictions apply? The delivery/access question follows the application-tracking decision (MER-D06–MER-D08).
- What phone normalization/equality, multiple-match presentation, administrator permission, and retention/privacy rules apply when either contact phone matches a prior rejected application? MER-D10/MER-D11 confirm match fields and full-data visibility, not comparison or presentation rules.
- What duplicate application/identity policy and contact normalization rules should apply?
- How does the owner receive credentials, and how is a lost or disclosed password replaced?
- Do applicants need submission receipt, corrections, or any way to check progress that does not grant dashboard access?
- Who may review/approve, how long should application personal data be retained, and how should customer-facing language describe review?
- If product requirements later call for tenant provisioning to be delayed after approval, the approval flow and transaction boundary will need to change.
