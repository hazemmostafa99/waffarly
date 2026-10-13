# Waffarly (وفّرلي)

Waffarly is a multi-merchant commerce and operations platform. The first release targets restaurants in Egypt. Product direction and scope are recorded in [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) and [`MVP_SCOPE.md`](./MVP_SCOPE.md). The first Super Admin implementation slice follows the decisions in [`docs/features/SUPER_ADMIN.md`](docs/features/SUPER_ADMIN.md).

## Requirements

- Node.js 24.11.1 (see `.node-version`)
- pnpm 10.34.5
- Docker Desktop with the Docker Compose plugin

Node 24 LTS is selected because it is supported by the current framework and Prisma toolchain. Node 20.19.0 is installed in the inspected environment and meets several package minimums, but Node 20 reached end of life in 2026; use Node 24 for the project. See [technical decisions](docs/architecture/TECHNICAL_DECISIONS.md) for pinned dependency versions and compatibility notes.

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

The database health endpoint returns HTTP 503 when PostgreSQL cannot be reached. The API itself starts without eagerly connecting to PostgreSQL so liveness can still be checked while the database is unavailable.

## Common commands

```powershell
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:check
```

For detailed local setup and package responsibilities, see [`docs/setup/LOCAL_DEVELOPMENT.md`](docs/setup/LOCAL_DEVELOPMENT.md) and [`docs/architecture/REPOSITORY_STRUCTURE.md`](docs/architecture/REPOSITORY_STRUCTURE.md).

## Implemented first slice

- Super Admin **Activities & modules** provides the restaurant catalog, code-managed merchant profile and storefront design capabilities, editable catalog descriptions, and restaurant applicability. Apply the additive activities/modules migration. Applicability is catalog metadata; existing merchant access rules continue to apply. See the [Business Activities & Modules overview](docs/features/super-admin/activities-modules/OVERVIEW.md).
- Super Admin **Plans** supports creating, listing, and editing monthly offers with name, decimal monthly price, explicitly selected EGP/USD/EUR currency, and optional description. Apply the additive monthly-plans migration; no commercial offers are seeded. See the [Monthly Plan specification](docs/features/super-admin/plans-subscriptions/MONTHLY_PLAN.md).
- A configured Super Admin can sign in, create a restaurant and owner account using the four approved contact fields, and manually activate the first month after confirming collection outside the platform.
- The Super Admin creates the owner username/password and sends them manually after verifying the owner by phone. The UI shows the password only immediately after creation; the backend stores a one-way hash.
- The owner cannot sign in to the Merchant Dashboard before activation. After activation, the dashboard displays the four confirmed restaurant and owner contact fields as a read-only profile.
- No messaging API, payment gateway, renewal/expiry rule, or restaurant configuration workflow is implemented yet. Monthly plan definitions do not assign a merchant plan or activate coverage. This first slice is not a complete recurring subscription system.
