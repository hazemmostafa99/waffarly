# Inventory

| Folder        | Responsibility                                                                   |
| ------------- | -------------------------------------------------------------------------------- |
| `items/`      | Stock identity reads, creation/editing, archive rules and unit conversion.       |
| `locations/`  | Branches, warehouses, their edit checks and response mapping.                    |
| `policy/`     | Merchant inventory policy and its owner endpoints.                               |
| `ledger/`     | Existing immutable stock ledger, plus owner balances/movement/opening endpoints. |
| `visibility/` | Stock health reads, replenishment thresholds and their owner endpoints.          |

The existing application services remain entry points for callers. The locations
controller now contains branch/warehouse routes only. Policy, ledger and stock
health controllers own their separate routes under the same `/owner/inventory`
prefix. No URL, request shape or response shape changes are intended.

Creating or editing a stock identity does not add stock. Opening balances and
movements still use the ledger. Preserve tenant filters, revision checks, unit
immutability, default-warehouse rules and the original transaction boundaries.
