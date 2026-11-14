# Catalog

Catalog keeps its existing product, category, reusable choice, menu and pricing
ownership. This cleanup narrows product management without changing that boundary.

| Path                                          | Responsibility                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `products/queries/`                           | Merchant product list and detail reads.                                             |
| `products/commands/create-product.ts`         | Saves a new product and its related configuration.                                  |
| `products/commands/update-product.ts`         | Updates a reviewed product version and replaces its configuration atomically.       |
| `products/commands/product-modifier-links.ts` | Attaches/detaches reusable choice groups.                                           |
| `products/commands/product-availability.ts`   | Archive, restore and deletion with order-history protection.                        |
| `products/persistence/`                       | Existing reference checks and helpers for variants, choices and inventory mappings. |
| `products/*.rules.ts`                         | Existing product and inventory configuration rules.                                 |
| `pricing/`                                    | Authoritative configured-product quotes.                                            |

`ProductService` remains the application entry point. Create/update operations
retain their existing transaction scope, revision/reference checks and immutable
order-history protection. Keep pricing distinct from configuration editing.
