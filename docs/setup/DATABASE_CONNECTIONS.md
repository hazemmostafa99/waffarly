# Database connections

The API owns one Prisma client and one PostgreSQL pool per process. The shared
`createPostgresAdapter` factory supplies bounded pool defaults; API configuration
can override them using validated environment variables:

| Variable                          | Default | Meaning                                                           |
| --------------------------------- | ------- | ----------------------------------------------------------------- |
| `DATABASE_POOL_MAX`               | `10`    | Maximum connections per process (1–100).                          |
| `DATABASE_CONNECTION_TIMEOUT_MS`  | `3000`  | Connection acquisition/creation timeout (100–60000 ms).           |
| `DATABASE_IDLE_TIMEOUT_MS`        | `30000` | Close unused connections after this idle period (1000–600000 ms). |
| `DATABASE_STARTUP_ATTEMPTS`       | `5`     | Maximum startup probes (1–10).                                    |
| `DATABASE_STARTUP_RETRY_DELAY_MS` | `1000`  | Initial retry delay (100–5000 ms), doubled up to 5000 ms.         |

These settings are passed to the Prisma 7 `pg` adapter, rather than legacy Prisma
URL parameters. They control connections, not execution time for business queries
or transactions. Size the pool against PostgreSQL `max_connections`: multiply the
maximum by the number of API processes and allow capacity for migrations,
administration, scripts and other applications. Raising the maximum is not a
substitute for investigating slow queries or long transactions.

Before opening its HTTP listener, the API runs `SELECT 1`. Failed probes retry
with bounded backoff. Exhaustion disconnects Prisma and fails startup; database
credentials and raw connection errors are excluded from startup messages.
No business operation is automatically retried by this mechanism.

After startup, `/health` reports process liveness and `/health/db` queries the
database and returns 503 while it is unavailable. Use `/health/db` for deployment
readiness checks. A running API stays alive during an outage and the pool can
establish connections for subsequent requests when PostgreSQL returns. Database
connectivity and capacity failures reaching the HTTP exception filter return
503 with `errorCode: DATABASE_UNAVAILABLE`; unrelated failures retain their
existing status. An idle connection error is logged without connection details.
Shutdown disconnects the pool.

For systemd deployments, configure the API unit with `Restart=on-failure` and
`RestartSec=10s`. Check its start-rate limits and allow time for all startup
attempts. `systemctl is-active` alone does not establish database readiness.
Deploy the API/database builds together and restart the API to load changes.
This repository change does not alter live systemd units or production variables.

Verify outages against a disposable database: start without PostgreSQL (listener
must not open), restore it during startup retries, stop it after successful
startup (`/health` 200, `/health/db` 503), then restore it and confirm readiness
returns 200 without restarting the API. Do not stop the production database to
perform this check.
