# Inventory ownership

| File or folder                       | Responsibility                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `inventory.service.ts`               | Creates, updates and archives stock identities; exposes stock reads and unit conversion. |
| `inventory-locations.service.ts`     | Maintains branches, warehouses and consumption defaults.                                 |
| `policy/inventory-policy.service.ts` | Reads and updates the merchant stock policy.                                             |
| `inventory-visibility.service.ts`    | Saves/deletes reorder thresholds and exposes stock-health reads.                         |
| `inventory-ledger.service.ts`        | Coordinates opening balances and immutable stock posting.                                |
| `items/`                             | Stock queries, edit guards and response/replay mapping.                                  |
| `locations/`                         | Branch/warehouse queries, edit guards and response mapping.                              |
| `policy/`                            | Stock-policy operation and its scoped read.                                              |
| `ledger/`                            | Stock posting helpers, fingerprints, rules, queries and mapping.                         |
| `visibility/`                        | Stock-health reads and scoped threshold access checks.                                   |

Write operations execute directly in their existing application services, which
own validation and the original transaction boundaries. Ordinary functions handle
reads, mapping, calculation and persistence on the supplied transaction. There is
no extra application-service layer forwarding each write to another service.

Creating or editing a stock identity does not add stock. Opening balances and
movements use the ledger. Tenant filters, revision checks, unit immutability,
default-warehouse rules and history protection remain part of the operation.

Controllers for locations, policy, ledger and stock health keep their existing
routes and contracts under `/owner/inventory`.

See [the application standard](../../../../../docs/architecture/API_APPLICATION_STANDARD.md)
and [verification ledger](../../../../../docs/architecture/API_REFACTOR_PROGRESS.md).
