# Local development

## Required tools

- Node.js 24.11.1; `.node-version` records the selected version.
- pnpm 10.34.5; Corepack can activate it.
- Docker Desktop with Docker Compose.

Node 24 was selected because Node 20 is end of life and recent Prisma, NestJS, and Vite releases require a current supported Node release. Exact library versions and choices are recorded in [`TECHNICAL_DECISIONS.md`](../architecture/TECHNICAL_DECISIONS.md).

## Install and configure

From the repository root in PowerShell:

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
```

The example credentials are for local development only. Do not put real credentials in the repository. Docker PostgreSQL uses host port `5433` by default to avoid a locally installed PostgreSQL service on `5432`. If you choose another host port, update both `POSTGRES_PORT` and the port in `DATABASE_URL` in `.env`.

Optional frontend-only environment files can be created from the matching samples:

```powershell
Copy-Item apps/storefront/.env.example apps/storefront/.env.local
Copy-Item apps/super-admin/.env.example apps/super-admin/.env.local
Copy-Item apps/merchant-dashboard/.env.example apps/merchant-dashboard/.env.local
Copy-Item apps/pos/.env.example apps/pos/.env.local
```

Those samples point at the local API. Next.js and Vite read environment files from their app directory, so copy the matching sample when using an app's API client. The API and Prisma CLI read the root `.env`. Browser-facing values use the `NEXT_PUBLIC_` and `VITE_` prefixes by framework convention.

## PostgreSQL and Prisma

```powershell
docker compose --env-file .env -f infrastructure/docker/compose.yaml up -d
docker compose --env-file .env -f infrastructure/docker/compose.yaml ps
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm db:check
```

Compose runs a container named `waffarly-postgres` and persists local PostgreSQL data in the named `waffarly-postgres-data` volume. To stop the container while keeping the data, run `docker compose --env-file .env -f infrastructure/docker/compose.yaml down`. The database health check runs `pg_isready`.

`db:migrate` creates/applies the Prisma development migration for the infrastructure marker only. There is no seed script and no business data. `db:check` validates the schema, generates the client, and checks applied migration status; PostgreSQL must be running for the final command.

## Start the workspace

```powershell
pnpm dev
```

Or start a single app:

```powershell
pnpm exec turbo run dev --filter=@waffarly/api
pnpm exec turbo run dev --filter=@waffarly/storefront
pnpm exec turbo run dev --filter=@waffarly/super-admin
pnpm exec turbo run dev --filter=@waffarly/merchant-dashboard
pnpm exec turbo run dev --filter=@waffarly/pos
```

| App                      | Local URL                       |
| ------------------------ | ------------------------------- |
| Storefront               | http://localhost:3000           |
| Super Admin shell        | http://localhost:5173           |
| Merchant Dashboard shell | http://localhost:5174           |
| POS workspace shell      | http://localhost:5175           |
| API liveness             | http://localhost:4000/health    |
| API database health      | http://localhost:4000/health/db |

The API validates `DATABASE_URL`, `PORT`, `NODE_ENV`, and `CORS_ORIGINS` at startup. Its liveness route does not depend on PostgreSQL. The database route executes `SELECT 1` and returns HTTP 503 with `DATABASE_UNAVAILABLE` when that query fails. The API logs structured JSON to stdout/stderr and closes Prisma during Nest shutdown.

## Checks

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm db:validate
pnpm db:generate
pnpm db:check
```

The API endpoint tests run with a test Prisma provider so they do not require a live database. `db:check` and the real `GET /health/db` request do need PostgreSQL running.

## Extending the foundation

### Add an API module

1. Confirm the feature scope and behavior against the decision labels in the product documents.
2. Add `apps/api/src/modules/<domain>/` with its Nest module, controller, and providers.
3. Keep business rules in the backend module; add contracts only after request/response shape is approved.
4. Add module tests for approved behavior and register the module in `AppModule`.
5. Add Prisma schema and migrations only after the ERD/domain rules are approved.

### Add a shared package

Create a package under `packages/` with a unique `@waffarly/*` name, explicit runtime and development dependencies, strict TypeScript settings, and appropriate `build`, `lint`, `typecheck`, and `test` scripts. Link consumers with `workspace:*`. Shared contracts must remain independent of NestJS and Prisma internals; Prisma remains backend-only.
