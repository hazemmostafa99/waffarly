# Waffarly (وفّرلي)

Waffarly is a multi-merchant commerce and operations platform for different business activities, including restaurants, clothing stores, supermarkets, and other businesses. Registration records the business activity; shared profile and branding modules serve all activities, while storefront templates can target one activity or all activities. Product direction and scope are recorded in [`PROJECT_OVERVIEW.md`](docs/product/PROJECT_OVERVIEW.md) and [`MVP_SCOPE.md`](docs/product/MVP_SCOPE.md). Restaurant operations are activity-specific, rather than requirements for every merchant.

## Developer entry point

Start with [CONTRIBUTING.md](CONTRIBUTING.md) for daily commands, code navigation,
complete operation traces, troubleshooting and the isolated database-test workflow.
The [API module guide](docs/architecture/API_MODULE_GUIDE.md) maps business ownership.

## Requirements

- Node.js 24.11.1 (see `.node-version`)
- pnpm 10.34.5
- Docker Desktop with the Docker Compose plugin

Use the versions pinned in `.node-version` and `package.json`. See
[technical decisions](docs/architecture/TECHNICAL_DECISIONS.md) for dependency choices.

## Quick start

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
Copy-Item apps/storefront/.env.example apps/storefront/.env.local
Copy-Item apps/super-admin/.env.example apps/super-admin/.env.local
Copy-Item apps/merchant-dashboard/.env.example apps/merchant-dashboard/.env.local
pnpm --filter @waffarly/api admin:hash-password
# Copy the printed hash into SUPER_ADMIN_PASSWORD_HASH in .env
docker compose --env-file .env -f infrastructure/docker/compose.yaml up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Applications run at:

- Storefront: http://localhost:3000
- Super Admin: http://localhost:5173
- Merchant Dashboard: http://localhost:5174
- POS shell: http://localhost:5175
- API liveness: http://localhost:4000/health
- API database check: http://localhost:4000/health/db

Current application behavior is documented under `docs/features/`; early delivery
notes may describe older UI states. The API checks database connectivity during
startup with bounded retries. Once it is listening, `/health` reports liveness and
`/health/db` reports database readiness. See
[database connections](docs/setup/DATABASE_CONNECTIONS.md).

## Common commands

```powershell
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm check:api
pnpm test:db:prepare
pnpm test:db
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:check
```

For detailed local setup and package responsibilities, see [`docs/setup/LOCAL_DEVELOPMENT.md`](docs/setup/LOCAL_DEVELOPMENT.md) and [`docs/architecture/REPOSITORY_STRUCTURE.md`](docs/architecture/REPOSITORY_STRUCTURE.md).

All four frontends share shadcn/ui components, Tailwind CSS v4, and English/Arabic localization through i18next. Use the language switcher for Arabic and RTL layouts. See [UI and localization](docs/architecture/UI_AND_LOCALIZATION.md) for the shared components and `pnpm test:ui` browser checks.

## Earlier delivery notes

The following records earlier slices. Use the developer guide and current feature
documents for the present behavior.

- Super Admin **Activities & modules** provides the restaurant catalog, code-managed merchant profile and storefront design capabilities, editable catalog descriptions, and restaurant applicability. Apply the additive activities/modules migration. Applicability is catalog metadata; existing merchant access rules continue to apply. See the [Business Activities & Modules overview](docs/features/super-admin/activities-modules/OVERVIEW.md).
- Super Admin **Plans** supports independent EGP prices for 1/3/6/12/24-month terms and offer availability. **Subscriptions** manages assignment, external collection, activation, renewal, immediate/scheduled plan changes, suspension/resume, cancellation and expiry. See [Merchant subscriptions](docs/features/super-admin/plans-subscriptions/SUBSCRIPTIONS.md).
- A configured Super Admin can create a business/owner and assign a plan/duration. Activation is separate and requires confirmation of the reviewed amount collected outside Waffarly. Apply the additive subscriptions migration; existing activated accounts retain legacy access pending review.
- The Super Admin creates the owner username/password and sends them manually after verifying the owner by phone. The UI shows the password only immediately after creation; the backend stores a one-way hash.
- The owner cannot sign in to the Merchant Dashboard before activation. After activation, the dashboard displays the four confirmed restaurant and owner contact fields as a read-only profile.
- No messaging API, payment provider, automatic collection/renewal, or automatic refunds are included. Inactive owners can inspect records and finish existing work; the API blocks new operational writes, including already-open sessions.
