# Waffarly (وفّرلي)

Waffarly is a multi-merchant commerce and operations platform. The first release targets restaurants in Egypt. Product direction and scope are recorded in [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) and [`MVP_SCOPE.md`](./MVP_SCOPE.md); labels in those documents remain authoritative. This repository is the runnable technical foundation only.

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
docker compose --env-file .env -f infrastructure/docker/compose.yaml up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Applications run at:

- Storefront: http://localhost:3000
- Super Admin shell: http://localhost:5173
- Merchant Dashboard shell: http://localhost:5174
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

## Scope boundary

No authentication, tenant resolution/isolation mechanism, business tables, catalog, orders, payments, subscription behavior, offline POS, or deployment decision for the POS has been implemented. The only Prisma model is an explicitly documented infrastructure marker used to validate generation and migrations.
