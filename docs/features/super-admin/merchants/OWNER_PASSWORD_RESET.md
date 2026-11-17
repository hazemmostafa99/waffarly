# Super Admin owner password reset

2026-11-17: the user approved resetting a merchant owner's password from the
Super Admin merchant list and details, with separate approval for the data,
backend and UI steps. Source implementation is present; manual acceptance is open.

## Operator flow

1. Open `/merchants`, find the business and select **Reset password**, or open
   its details and use the same action under **Owner account**.
2. Check the displayed business name and username. Enter and confirm a new
   password of 6–128 characters. Spaces are preserved. The operator chooses
   and privately delivers the new password; no message is sent automatically.
3. Confirm once and wait. Inputs, submission and dismissal are blocked while
   the request is pending. Success is shown only after a successful API response.
4. Password fields clear after the request settles or the dialog closes.
   Reopening starts with empty fields. Existing owner sessions are revoked;
   the owner must sign in again. POS employee credentials remain independent.

The dialog uses component state and the existing `apiRequest` transport, without
putting passwords in local/session storage, URLs or React Query mutation caches.
The confirmation field is checked locally and is not sent to the API. Network
errors and server errors explain that the result may be uncertain; no automatic
retry occurs. The operator should try the chosen password before another reset.
Leaving the page cannot undo a request already received by the server.

## API and ownership

`POST /admin/merchants/:merchantId/owner-password/reset` belongs to Auth and is
protected by `AdminGuard`. `CurrentAdmin` provides the actor, `ParseUUIDPipe`
validates the selected merchant, and a strict Zod body accepts only `password`.
The successful no-store response is `{ merchantId, username, passwordResetAt }`;
it never includes a password or password hash. Missing owner accounts return 404.

`AuthService.resetMerchantOwnerPassword` validates the input and computes the
scrypt hash before opening its transaction. It locks the selected owner row,
updates the hash and latest-reset metadata, and deletes only that owner's OWNER
sessions. These writes commit or roll back together. `OwnerAccount.passwordResetAt`
and `passwordResetBy` describe the latest reset, not an immutable audit history.

Owner login verifies the password and then locks the same account row before
creating a session. It rechecks that the verified hash is still current. If login
commits first, the reset revokes its session; if reset commits first, login using
the earlier hash fails. Cookies are emitted only after session creation commits.
Requests already authorized before a reset are not retroactively cancelled.

Row locks use parameterized Prisma `$queryRaw` with PostgreSQL `FOR UPDATE`;
password updates, session writes and transaction management use Prisma's ORM.
The installed generated `findUnique` API has no row-lock option. No new package,
business-module dependency, subscription change or POS reset is introduced.

## Delivery and verification

- Applied only `20261117120000_owner_password_reset_metadata` to the local
  development database after checking unrelated pending migrations were absent.
  Prisma Client generation succeeded. Read-only inspection confirmed both new
  columns are nullable and no reset metadata was recorded during setup.
- A manual anonymous HTTP request to the endpoint returned 401.
- Reviewed the backend and UI source/diffs. No real account reset, authenticated
  reset journey or concurrent login/reset experiment has been performed.
- No automated tests, lint, typecheck, build or browser automation were run,
  following the project's manual-QA preference. Generated source was refreshed;
  compiled shared-package outputs were not rebuilt.

## Manual acceptance still required

Use an agreed local demo owner, such as `merchant1`, and keep its current
password available for comparison. This checklist does not authorize changing
unrelated accounts or submitting financial operations.

- Open the dialog from the list and details in Arabic and English. Check mobile
  layout, labels, keyboard focus, password visibility and Escape/close behavior.
- Cancel without submitting; verify no change. Reopen and check empty inputs.
- Check empty/short/mismatched values and the 6/128-character boundaries.
- Confirm once; check pending state and prevention of repeated submission.
- Verify the chosen account accepts the new password, rejects the old password,
  and its previously open session fails on the next protected request.
- Verify another merchant and POS employee still have their original access.
- Inspect latest-reset actor/time and confirm they identify the signed-in admin.
- Review expired-admin, missing-owner and uncertain-network outcomes. Verify a
  failed transaction leaves both the original hash and sessions intact.
- Exercise concurrent owner login/reset and two resets in an isolated setup;
  verify the described ordering and session revocation before final acceptance.
