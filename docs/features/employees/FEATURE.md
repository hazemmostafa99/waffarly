# Employee roles

Employees owns employee record configuration, role assignment and active branch
assignment. Auth owns sign-in, sessions, permission resolution and supervisor
credential verification. Employees imports Auth; Auth does not import Employees.
Owners manage employees at `/owner/employees`; the
employee/POS workspace provides employee operations. Owner dashboard routes remain
owner-only. Employee roles cannot confer account ownership or subscription access.

## Owner-controlled permissions

Each employee's saved `permissions` list is the exact set of grants the API uses.
The role is a starting template: choosing a role in the owner editor fills in its
default permissions (`defaultPosEmployeePermissions`), and the owner can then tick
or untick any permission when adding or editing the employee. The employee list
marks a role whose permissions were changed as "Customized".

- `POST /owner/employees` and `PATCH /owner/employees/:id` accept an optional
  `permissions` array of known permission names. On create, omitting it stores the
  role's defaults. On update, omitting it keeps the saved list unless the role
  changes, in which case the new role's defaults replace it.
- Changes take effect on the employee's next POS request because the API reloads
  employee state on every request.
- Some read access comes with an operational grant: selling includes viewing
  orders and receipts, and kitchen acceptance/preparation includes viewing orders.
  The editor shows these as included and locked.
- Migration `20261126160000_explicit_employee_permissions` stored the previous
  role-based result for every existing employee, so nobody gained or lost access.
- The owner's own POS operator always holds every permission.

## Role defaults

| Preset              | Available access                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `branch_manager`    | Incoming recipe orders, acceptance/preparation, sales/payments, register opening, receipts, stock balances, discount and refund approval, shift-close approval and cash movements in the assigned branch |
| `cashier`           | Sales/payments, register opening, recipe-order acceptance and preparation                                                          |
| `inventory_officer` | Read-only stock balances in the assigned branch                                                                                    |
| `accountant`        | Read-only receipt history, detail and reprint in the assigned branch                                                               |
| `customer_service`  | Read-only incoming recipe-order queue                                                                                              |
| `kitchen`           | Incoming recipe-order queue, acceptance and preparation                                                                            |
| `supervisor`        | Cashier defaults plus discount, void, refund and shift-close approval and cash movements                                           |
| No preset           | Recipe-order acceptance and preparation; the owner picks the rest                                                                  |

Roles are single-select. Every employee has exactly one assigned `branchId`, stored
as a scalar field. The owner editor shows the permission checkboxes and the
single branch assignment, with English/Arabic labels and a server-side role filter.
POS sign-in and every POS screen use that assigned branch directly.
The migration copies each existing assignment link and stops if any employee has
zero or multiple links, so deployment never guesses which branch to keep.
`savedPermissions` in the owner directory response now equals `permissions` and is
kept only for older dashboard builds.

## Authorization and compatibility

The API reloads current employee state and its assigned branch on each
request. Saved grants are exact for every role. Reassigning a role without an
explicit permission list replaces the grants with the new role's defaults, so a
former cashier moved to accounting keeps no sales access. Sales/kitchen grants
imply corresponding order or receipt read access. Unsupported saved permission
strings are ignored. Register shifts require `open_register_shift`, whatever the role.

`GET /pos/inventory/balances` requires `view_inventory`, the assigned
`branchId`, and bounded pagination. Inventory's existing ledger query intersects
the authenticated merchant, assigned branch and optional filters/cursor. Receipt
history/detail require receipt access, independently of sales permission. Payment
writes still require sales permission. Order queue reads and acceptance/preparation
each enforce their permission. Pending storefront recipe orders without a branch
remain available for routing; pending POS recipe orders are visible only in their
saved branch. Cross-branch orders cannot be acted upon through the existing
lifecycle services.

POS screens use the employee's single active branch without a branch selector. The
employee workspace filters navigation and guards direct URLs. Roles with stock
or receipt access land on those screens. Accounts without operational grants see
an access notice. API authorization remains authoritative; UI checks do not confer
permissions. Sign-in requires the assigned branch to remain active; changing an
employee's branch revokes that employee's existing POS sessions. The schema's
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
