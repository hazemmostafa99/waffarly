# Marketplace merchant applications

On 2026-11-13 the user explicitly authorized real submission from `/join`.
This supersedes the local-demo policy for this merchant application form only.

The form uses the existing `POST /merchant-applications` contract. Merchants owns
validation and persistence in `MerchantService.submitApplication`. Successful
submission creates an application, not a merchant tenant or an owner account.
The existing Super Admin applications view loads these records through guarded
`GET /admin/merchant-applications`; approval and rejection remain unchanged.

The UI waits for `{ received: true }` before displaying success and clearing
form state. It disables editing and duplicate clicks during submission. It does
not persist contact details in browser storage. Failed submissions retain the
draft; an unconfirmed result asks the applicant to check before resubmitting,
because the existing endpoint does not provide an idempotency key.

Manual verification is pending, per the repository's no-automated-checks
preference. Submit an agreed QA application, confirm it appears in Super Admin,
and check validation, failure feedback, double-click prevention, Arabic/English
directions and phone digits. No QA application was submitted during this change.
