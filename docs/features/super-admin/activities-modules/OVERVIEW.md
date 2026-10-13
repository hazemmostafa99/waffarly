# Business Activities & Modules

**Last updated:** 2026-10-13  
**Status:** Initial hybrid catalog implemented; broader operational module scope remains open.  
**Parent:** [Super Admin overview](../OVERVIEW.md)

## 1. Purpose and decisions

This domain describes supported business activities, software capabilities, and activity/module applicability. It supplies catalog information for future commercial and operational rules. Merchant access continues to follow the existing authentication and first-month activation checks.

On 2026-10-13, the product owner requested implementation and selected: “Hybrid (recommended): restaurant activity and supported modules come from code; admins edit descriptions and restaurant applicability.”

| ID     | Status                        | Decision                                                                                                                                                                                                                                                                                              |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AM-D01 | CONFIRMED                     | Begin implementing Business Activities & Modules using the hybrid governance model. Code defines supported activities and modules; admins maintain descriptions and restaurant applicability.                                                                                                         |
| AM-I01 | Initial implementation choice | Use Restaurants as the sole activity, and expose Merchant profile and Storefront design & branding as the two initial capability boundaries, matching existing owner functionality. Display names are editable; identifiers remain fixed. This does not finalize the future commerce module taxonomy. |

Sources: [parent domain boundaries](../OVERVIEW.md#33-business-activities--modules), [platform vision](../../../../PROJECT_OVERVIEW.md), and [restaurant MVP proposal](../../../../MVP_SCOPE.md). Restaurants are the approved initial activity. The Dynamic Product Builder remains confirmed platform vision with restaurant rules open; catalog, orders, POS, inventory, employees, and branches remain discovery topics rather than deployed capabilities in this registry.

## 2. Initial catalog

| Kind     | Permanent key       | Initial meaning                                                                                        |
| -------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| Activity | `restaurant`        | Restaurant merchant businesses.                                                                        |
| Module   | `merchant-profile`  | An activated owner can view restaurant and owner contact information.                                  |
| Module   | `storefront-design` | An activated owner can select an available restaurant design, upload a logo, and save an accent color. |

Both modules support Restaurants and are associated with it by default. Neither declares another catalog module as a dependency. Authentication, tenant scoping, and first-month activation remain application prerequisites.

The [code registry](../../../../apps/api/src/modules/super-admin/capability-registry.ts) owns keys, supported activities, dependency declarations, and initial metadata. Adding supported functionality requires a code release, shared contract updates, validation updates, and a migration extending the allowed database keys. There is no arbitrary create/delete catalog operation or runtime code installation.

## 3. Admin behavior

The **Activities & modules** tab shows business activities and implemented modules. Admins can search module names, descriptions, and keys; inspect their current activity associations and dependencies; refresh the catalog; edit display names/descriptions; and choose the modules associated with Restaurants.

- Names are trimmed, required, and limited to 160 characters. Descriptions are trimmed and limited to 1,000 characters; an empty description is allowed.
- Keys, supported activities, and dependencies are read-only and cannot be changed through metadata requests.
- Applicability may be empty. Duplicate, unsupported, incompatible, and dependency-incomplete selections are rejected.
- Successful edits show confirmation and update the catalog. Loading, failure, no-results, and empty states are represented.
- A failed save preserves the draft. A stale edit blocks another save until the administrator refreshes and reopens the entry.
- The editor records the most recent administrator and edit time. This is attribution metadata, not an immutable audit history.

Applicability edits affect catalog metadata only. For example, removing `storefront-design` from Restaurants removes that association from this screen, while the existing owner design settings remain governed by their current access checks. Entitlement enforcement, plan/module assignment, merchant activity selection, and activity changes require separate implementation decisions. Template compatibility continues to use its existing restaurant constraint.

## 4. API and persistence

All routes require the existing Super Admin session guard. Merchant-owner and anonymous sessions cannot use this catalog API.

| Route                                                   | Behavior                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /admin/activities-modules`                         | Return supported activity/module definitions merged with saved metadata overrides. Reads create no records. |
| `PATCH /admin/activities-modules/activities/restaurant` | Save `name`, `description`, `moduleKeys`, and the expected `revision`.                                      |
| `PATCH /admin/activities-modules/modules/:key`          | Save `name`, `description`, and the expected `revision` for an existing code-managed key.                   |

Strict request validation rejects extra fields, blank names, invalid types/revisions, and unsupported keys with HTTP 400. Invalid admin sessions return 401. Stale revisions return 409.

Defaults have revision `0` and null edit attribution. The first edit creates an override at revision `1`; concurrent first edits compete on the primary key and the loser receives 409. Later edits use a conditional revision update inside a transaction. There is no silent last-write-wins behavior. An uncertain save can be resolved by refreshing and reviewing the entry; a repeated stale request cannot apply twice.

[Prisma models](../../../../packages/database/prisma/schema.prisma) store overrides in `business_activities` and `platform_modules`. The [additive migration](../../../../packages/database/prisma/migrations/20261013060000_activities_modules/migration.sql) constrains supported keys, positive saved revisions, nonblank names, and allowed module association values. No existing merchant, plan, or template record is modified, and no override rows are seeded.

Activity associations use a small array of code-defined keys in this initial restaurant catalog. Dependency validation and duplicate checks occur in the service; future larger catalogs may need explicit relation tables. Registry releases must preserve existing key meaning or provide a deliberate data migration.

## 5. Feature status and next decisions

| Parent feature | Initial status                                                    | Remaining scope                                                                                    |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SA-AM01        | Restaurant activity catalog implemented                           | Additional activities, multiple activities per merchant, and activity changes.                     |
| SA-AM02        | Two implemented merchant capabilities represented                 | Operational module definitions/granularity, including Dynamic Product Builder restaurant behavior. |
| SA-AM03        | Restaurant applicability editor implemented                       | Runtime availability consumption and future compatibility/dependency rules.                        |
| SA-AM04        | Hybrid governance confirmed and implemented                       | Release/versioning policy, broader admin roles, and immutable audit requirements.                  |
| SA-AM05        | Future operational activities remain deferred in the MVP proposal | Separate activity requirements and supported functionality.                                        |

Commercial entitlement belongs to [Plans & Subscriptions](../plans-subscriptions/OVERVIEW.md). Shared presentation definitions belong to [Templates & Design Library](../templates/OVERVIEW.md). Tenant onboarding and lifecycle belong to [Merchant Management](../merchants/OVERVIEW.md). A compatible capability, a purchased entitlement, a person's permission, and a tenant's configuration are distinct concepts.

## 6. Implementation and validation

- [Shared contracts](../../../../packages/contracts/src/activities-modules.ts)
- [Admin view](../../../../apps/super-admin/src/ActivitiesModules.tsx) and [responsive styles](../../../../apps/super-admin/src/activities-modules.css)
- [API controller](../../../../apps/api/src/modules/super-admin/activities-modules.controller.ts) and [catalog service](../../../../apps/api/src/modules/super-admin/activities-modules.service.ts)
- [HTTP tests](../../../../apps/api/test/activities-modules.e2e.test.ts): authentication, default reads, persistence behavior, strict validation, applicability changes, immutable registry fields, and stale initial/subsequent edits.
- [Database verification](../../../../apps/api/test/activities-modules.database.test.ts): real override writes/reads and SQL constraints inside a rolled-back transaction. Run `pnpm --filter @waffarly/api test:activities-db` against a migrated local database.

Validation on 2026-10-13: all 17 API tests and the PostgreSQL verification passed; affected package lint/type checks, Prisma schema validation, and API/Super Admin builds passed. The additive migration was applied to the local development database. Interactive browser verification was unavailable because the browser tool could not initialize its sandbox connection.

Local setup: apply migrations with `pnpm --filter @waffarly/database exec prisma migrate deploy --config ./prisma.config.ts`, rebuild workspace packages, start the applications, and sign in to Super Admin. The catalog tables must exist even before the first override is saved.
