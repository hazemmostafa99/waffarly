# Shifts ownership

| File or folder                        | Responsibility                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `shifts.service.ts`                   | Opens/closes shifts and records manual drawer movements. Owns these operation boundaries.            |
| `registers/pos-registers.service.ts`  | Creates and updates registers; lists them for owners and assigned cashiers.                          |
| `cash-custody.service.ts`             | Creates safes, records safe movements and coordinates handoff, receiving and resolution.             |
| `registers/registers.query.ts`        | Reads a merchant's registers with pagination.                                                        |
| `sessions/shift-queries.ts`           | Reads employee registers, current shifts and delivery handover recipients.                           |
| `reconciliation/`                     | Calculates cash/payment facts and previews shift closing.                                            |
| `cash-movements/`                     | Transaction-aware order cash helpers, locks and manual-movement replay rules.                        |
| `custody/`                            | Scoped safe/transfer/drawer reads, access rules and shared cash-write transaction/conflict handling. |
| `reports/`                            | Reads saved close reports.                                                                           |
| `access/`                             | Checks current branch permissions and supervisor approvals.                                          |
| `shift-records.ts`, `shift.mapper.ts` | Saved record selections and response/retry mapping.                                                  |
| `http/owner`, `http/pos`              | Separate owner and cashier HTTP entry points.                                                        |

The existing public services now execute their write operations directly rather
than forwarding them to standalone command functions. Their constructors and
method contracts remain compatible. Related locks, replay checks, snapshots and
financial writes stay together; query, calculation and active-transaction helpers
remain ordinary functions. Cash custody keeps its shared transaction/conflict
helper, with the business callback owned by CashCustodyService.

Functions receiving a transaction must use it rather than switching to the root
client. Public cash-ledger and reconciliation APIs remain available to Orders and
Payments through the module's existing public boundary.

See [the application standard](../../../../../docs/architecture/API_APPLICATION_STANDARD.md)
and [verification ledger](../../../../../docs/architecture/API_REFACTOR_PROGRESS.md).
