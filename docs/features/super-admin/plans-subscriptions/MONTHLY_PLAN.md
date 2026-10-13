# Monthly Plan — Initial Implementation

**Feature:** SA-PS01 — Plan definitions and pricing  
**Status:** Initial plan administration implemented; broader subscription requirements remain open.  
**Last updated:** 2026-10-13  
**Parent:** [Plans & Subscriptions overview](OVERVIEW.md)  
**Authorization:** PS-D04 — the owner answered “do both” to documenting the basic plan and implementing it in the app.

## 1. Overview and Goals

Super Admin can create, list, and edit monthly restaurant plan definitions. Each offer has a name, an administrator-entered monthly price, an explicitly selected currency, and an optional description. The Plans tab follows the existing navigation and visual conventions.

Current work starts with a basic monthly offer (PS-D03). The earlier multiple-plan direction (PS-D02) is preserved: the catalog supports multiple definitions without inventing tier names, feature differences, or usage limits. No actual commercial price is seeded or selected by this implementation.

Merchant assignment, activation, renewal, expiry, collection, and entitlements remain separate features. Defining a plan does not change merchant access or alter the recorded collection-before-first-month-activation rule. No payment-provider integration is invoked.

## 2. Actors and Permissions

| Actor                                      | Implemented access                                                                   | Boundary                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Configured Super Admin                     | List, create, and edit definitions through the existing authenticated admin session. | AdminGuard and backend authority checks protect actions. Granular commercial roles remain future discovery. |
| Merchant owner / employee / public visitor | No plan-definition administration.                                                   | Assignment and tenant-visible commercial facts are separate SA-PS03 work.                                   |

Definitions are platform-owned commercial data. Plan administration does not grant access to merchant operational records or employee permissions.

## 3. Implemented Plan Definition

These are reversible implementation choices for the authorized slice, separate from approving a final commercial pricing policy.

| Field            | Behavior                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name             | Required trimmed text, 1–160 characters. Duplicate display names are permitted; identifiers distinguish records.                                                                        |
| Monthly price    | Required decimal string from `0` to `99999999.99`, with at most two fractional digits; stored as `DECIMAL(10,2)` and returned with two digits. Floating-point JSON prices are rejected. |
| Currency         | Administrator explicitly selects EGP, USD, or EUR; the form has no selected default. This is the initial supported set, not a declaration that all offers use one currency.             |
| Billing interval | Always `monthly`; other intervals are rejected. This does not define merchant coverage dates.                                                                                           |
| Description      | Optional trimmed text up to 1,000 characters; omitted API values become an empty string.                                                                                                |
| Record facts     | UUID identifier, revision, timestamps, and creation/update administrator identifiers.                                                                                                   |

Zero is representable without creating a free offer automatically. Taxes, availability statuses, discounts, capability lists, quotas, add-ons, and public pricing are outside this initial feature.

## 4. Business Rules and Flows

### Create and Inspect

1. The authenticated Super Admin opens **Plans**.
2. The administrator enters a name, monthly price, explicitly selected currency, and optional description.
3. The API validates and normalizes the fields and saves the definition with administrator attribution.
4. The UI displays the offer, amount/currency per month, description, and update date.

The list includes loading, empty, failure, and refresh states. Save errors preserve entered values; success resets the form and updates the list. Controls are disabled while saving.

### Edit

The administrator opens **Edit plan**, modifies the fields, and saves the current revision. Success increments the revision and records the updating administrator. A stale revision produces a conflict; the UI preserves the draft and requires refreshing/reopening before another save.

Edits affect only the offer definition in this slice. Before subscriptions consume mutable prices, agreed-term preservation, price versions, and effective-date rules must be designed under SA-PS03/SA-PS05. No deletion/archive workflow is included.

## 5. Validation, Retry, and Concurrency

- Backend validation rejects blank names, unsupported currencies/intervals, negative/oversized prices, numeric JSON prices, exponent notation, excessive precision, invalid UUIDs/revisions, and unexpected request fields.
- Database constraints also enforce nonnegative price, supported currency, monthly interval, nonblank name, and positive revision.
- Creates carry a UUID `requestId`. An identical retry returns the existing initial record. Reuse with different settings, another administrator, or an already edited record returns HTTP 409.
- The browser retains the identifier for unchanged-input retries. Editing input starts a new creation attempt; navigating away/reloading does not persist an unfinished identifier.
- Updates use a conditional revision write inside a transaction. A missing target returns 404; a stale revision returns 409.
- Safe validation/conflict messages appear without exposing secrets or database internals.

Creation/update attribution is metadata, not an immutable audit history. Historical prices, event retention, and granular roles remain future requirements.

## 6. API Contracts and Persistence

[Shared contracts](../../../../packages/contracts/src/plans.ts) define decimal price strings and the fixed monthly interval.

| Route                    | Behavior                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/plans`       | Return summaries ordered by creation date descending then identifier.                                                                                                                          |
| `POST /admin/plans`      | Create with `requestId`, `name`, `monthlyPrice`, `currency`, `billingInterval`, and optional `description`; return 201 and the summary. Identical initial retries return the existing summary. |
| `PATCH /admin/plans/:id` | Update settings with the expected `revision`; return 200 and the new summary.                                                                                                                  |

All routes require an admin session. Invalid input returns 400, invalid sessions 401, missing edit targets 404, and conflicting request/revision use 409. Prices are returned as strings such as `250.00`, distinct from collection amounts.

The [Prisma schema](../../../../packages/database/prisma/schema.prisma) defines `MonthlyPlan`, mapped to `monthly_plans`. The [additive migration](../../../../packages/database/prisma/migrations/20261013040000_monthly_plans/migration.sql) creates the table and constraints. It adds no merchant relationships or coverage fields and seeds no offers.

## 7. UI and Implementation References

- [Plans view](../../../../apps/super-admin/src/Plans.tsx) and [styles](../../../../apps/super-admin/src/plans.css): responsive create/edit form and catalog, with no preset price/currency.
- [Super Admin app](../../../../apps/super-admin/src/App.tsx): Plans navigation alongside Restaurants and Design library.
- [Controller](../../../../apps/api/src/modules/super-admin/plan.controller.ts): authenticated routes, strict input validation, and normalization.
- [Service](../../../../apps/api/src/modules/super-admin/plan.service.ts): list/create/edit, replay handling, and revision checks.

## 8. Acceptance and Validation

- An authenticated Super Admin can create, inspect, and edit a monthly definition.
- Exact price strings survive normalization/persistence without floating-point calculation.
- Unauthorized callers cannot administer offers; invalid fields and intervals are rejected server-side.
- Identical creation retries do not duplicate offers; stale edits do not silently overwrite them.
- Plan writes do not mutate merchant approval, owner provisioning, activation, collection, or coverage.
- No payment-provider call is part of administration.

[API tests](../../../../apps/api/test/plans.e2e.test.ts) cover authorization, price normalization/bounds, validation, optional descriptions, retries, missing targets, and stale revisions with a test database provider. All nine API/health tests passed. A live PostgreSQL check also verified exact price persistence, revision conflicts, and rollback of its temporary data. Builds, type checks, lint, schema validation, and migration checks supplement them. Interactive browser verification is limited by the unavailable browser session connector in this environment and is not claimed as passed.

## 9. Running the Feature

Apply the migration, generate/build shared packages, and run API/Super Admin using the [local setup](../../../setup/LOCAL_DEVELOPMENT.md). Sign in and open **Plans**. Enter the commercial amount/currency when creating an offer; no sample plan is installed.

## 10. Remaining Subscription Decisions

Basic offer administration is implemented. Merchant assignment, agreed-price preservation, feature differences, limits, monthly coverage boundaries, renewal, expiry, operational restrictions, and collection evidence remain separate discovery work. This is not a complete recurring subscription system.
