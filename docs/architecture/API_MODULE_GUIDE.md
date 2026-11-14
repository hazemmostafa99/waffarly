# API module navigation

Organize the API by business ownership. Keep small features flat. Within larger
features, put independent operations, queries, rules and mapping in the folder
that owns them. Preserve existing application-service entry points when callers
need them. A folder split alone does not require another Nest module.

| Feature       | Guide                                                               | Main internal areas                                                                      |
| ------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Orders        | [Guide](../../apps/api/src/modules/orders/README.md)                | Checkout, sales, fulfillment, kitchen, bills, receipts, delivery, returns and customers. |
| Shifts        | [Guide](../../apps/api/src/modules/shifts/README.md)                | Registers, sessions, reconciliation, drawer cash, custody and close reports.             |
| Subscriptions | [Guide](../../apps/api/src/modules/subscriptions/README.md)         | Eligibility, assignment, quotes, commands and account/history reads.                     |
| Inventory     | [Guide](../../apps/api/src/modules/inventory/README.md)             | Stock identities, locations, policy, ledger and visibility.                              |
| Merchants     | [Guide](../../apps/api/src/modules/merchants/README.md)             | Onboarding, applications, public addresses and account settings.                         |
| Catalog       | [Guide](../../apps/api/src/modules/catalog/README.md)               | Product commands/queries, configuration helpers and authoritative pricing.               |
| Employees     | [Guide](../../apps/api/src/modules/employees/README.md)             | Staff account, role and branch configuration.                                            |
| Auth          | [Employee boundary](../../apps/api/src/modules/employees/README.md) | Identity, sign-in, sessions, permission enforcement and supervisor verification.         |

Each extracted file starts with a plain-English purpose comment. Longer commands
keep significant business steps visible. Do not introduce generic CRUD base
classes, service locators or a helper folder for unrelated business rules.

Controllers parse HTTP and use the current actor. Operations coordinate related
writes and their transaction. Transaction helpers use the supplied client.
Preserve authorization before saved-result replay where the existing operation
requires it, along with tenant/branch scope, lock order and monetary invariants.

The feature-to-feature ESLint boundary still requires public `index.ts` imports.
The one new business-module dependency is Employees → Auth. Auth → Subscriptions
remains unchanged; no reverse Employees dependency or database/schema change was
introduced.
