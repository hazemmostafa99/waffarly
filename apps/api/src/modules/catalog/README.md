# Catalog ownership

Catalog owns products, categories, reusable choices, menu configuration and
pricing. Application operation ownership does not change these boundaries.

| File or folder                | Responsibility                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `products/product.service.ts` | Creates/updates products, attaches/detaches reusable choice groups, and archives/restores/removes products. Owns the write operation boundaries. |
| `products/queries/`           | Merchant product list and detail reads.                                                                                                          |
| `products/persistence/`       | Reference checks and active-transaction helpers for variants, choices and inventory mappings.                                                    |
| `products/*.rules.ts`         | Independent product and stock-configuration decisions.                                                                                           |
| `products/product.mapper.ts`  | Product response projection.                                                                                                                     |
| `pricing/`                    | Authoritative configured-product quotes.                                                                                                         |

ProductService executes its operations directly instead of forwarding to a
separate `commands` layer. Its existing callers and constructor remain
compatible. Query, rule, mapping and persistence helpers remain ordinary
functions; no wrapper repository or extra service layer was introduced.

Create/update preserve the original transaction scope, tenant/reference checks,
revisions, pending recipe protection and saved order-history protection. Helpers
use the transaction supplied by the service. Pricing remains separate from
configuration editing.

See [the application standard](../../../../../docs/architecture/API_APPLICATION_STANDARD.md)
and [verification ledger](../../../../../docs/architecture/API_REFACTOR_PROGRESS.md).
