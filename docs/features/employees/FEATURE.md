# Employee roles

Employees owns employee record configuration, role assignment and active branch
assignments. Auth owns sign-in, sessions, permission resolution and supervisor
credential verification. Employees imports Auth; Auth does not import Employees.
Owners manage employees at `/owner/employees`; the
employee/POS workspace provides employee operations. Owner dashboard routes remain
owner-only. Employee roles cannot confer account ownership or subscription access.

## Available presets

| Preset              | Available access                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `branch_manager`    | Incoming recipe orders, acceptance/preparation, sales/payments, register opening, receipts and stock balances in assigned branches |
| `cashier`           | Sales/payments and register opening; existing saved operational grants are preserved                                               |
| `inventory_officer` | Read-only stock balances in assigned branches                                                                                      |
| `accountant`        | Read-only receipt history, detail and reprint in assigned branches                                                                 |
| `customer_service`  | Read-only incoming recipe-order queue                                                                                              |
| `kitchen`           | Incoming recipe-order queue, acceptance and preparation                                                                            |
| `supervisor`        | Existing cashier and approval grants, unchanged; not automatically converted to branch manager                                     |
| No preset           | Existing saved grants, unchanged                                                                                                   |

Roles are single-select. The owner editor shows the effective permission preview
and branch assignment, with English/Arabic labels and a server-side role filter.
`savedPermissions` in the owner directory response allows the preview to resolve a
proposed role without accidentally copying grants from the previous preset.

## Authorization and compatibility

The API reloads current employee state and active branch assignments on each
request. New presets use exact grants; saved grants from an old cashier or
supervisor do not authorize sales, kitchen actions or approvals after reassignment
to accounting, inventory, customer service or kitchen. Legacy roles retain saved
grants for compatibility. Historic sales/kitchen grants imply corresponding order
or receipt read access. Unsupported saved permission strings are ignored.

`GET /pos/inventory/balances` requires `view_inventory`, a valid assigned
`branchId`, and bounded pagination. Inventory's existing ledger query intersects
the authenticated merchant, selected branch and optional filters/cursor. Receipt
history/detail require receipt access, independently of sales permission. Payment
writes still require sales permission. Order queue reads and acceptance/preparation
each enforce their permission. Pending storefront recipe orders without a branch
remain available for routing; pending POS recipe orders are visible only in their
saved branch. Cross-branch orders cannot be acted upon through the existing
lifecycle services.

The employee workspace filters navigation and guards direct URLs. Roles with stock
or receipt access land on those screens. Accounts without operational grants see
an access notice. API authorization remains authoritative; UI checks do not confer
permissions. Existing supervisor/null-role data is not rewritten. The schema's
nullable string role and saved permission array already support the new presets,
but its database check constraints require the additive
`20261018220000_employee_role_presets` migration before assigning new roles.

## Further workflows

Inventory adjustments/transfers/counts, purchase management, financial reports and
reconciliation, customer edits, broader order tracking, employee administration,
refund/void/discount approval execution, approval limits and shift closing are not
granted by these new presets. They need separate scoped business workflows and
verification. The editor explicitly states the initial read-only limits for
accountants and inventory officers; it does not promise these future capabilities.
