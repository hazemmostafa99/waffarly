# Business Activities

**Status:** Activity catalog retained; platform-module catalog removed on
2026-11-18.

Business activities classify merchants during onboarding and storefront
discovery. The supported keys and default display names remain code-defined.
Super Admin can edit an activity's display name and description; those edits are
saved with a revision and administrator attribution.

The activity API is protected by the existing administrator session:

| Route | Behavior |
| --- | --- |
| `GET /admin/activities` | Return supported activities with saved display overrides. Reads create no records. |
| `PATCH /admin/activities/:key` | Save the display name and description using the expected revision. |

Activity classification does not grant subscription access or user permissions.
The former module names, compatibility matrix, and activity-to-module links were
metadata only and have been removed from the UI, API, contracts, and database.
The cleanup migration preserves activity name and description overrides while
dropping `moduleKeys` and `platform_modules`.

Implementation: [activity contracts](../../../../packages/contracts/src/activities.ts),
[Super Admin activity screens](../../../../apps/super-admin/src/features/activities),
[API controller](../../../../apps/api/src/modules/activities/activities.controller.ts),
[API service](../../../../apps/api/src/modules/activities/activities.service.ts),
and [database schema](../../../../packages/database/prisma/schema.prisma).
