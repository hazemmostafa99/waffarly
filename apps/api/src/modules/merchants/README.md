# Merchants ownership

| File or folder                                | Responsibility                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `merchant.service.ts`                         | Creates merchants/owners with initial subscription assignment, assigns handles, submits applications and applies approval/rejection decisions. |
| `onboarding/storefront-slug.ts`               | Builds the existing technical storefront identifier.                                                                                           |
| `applications/merchant-applications.query.ts` | Reads applications and matches earlier rejection history for review.                                                                           |
| `addresses/storefront-address.query.ts`       | Resolves a saved public storefront handle.                                                                                                     |
| `queries/`                                    | Merchant directory reads.                                                                                                                      |
| `merchant-record.mapper.ts`                   | Merchant and application response mapping.                                                                                                     |
| `merchant-account.*`                          | Owner account/contact editing and subscription overview.                                                                                       |
| `merchant-pos-appearance.service.ts`          | Merchant-wide cashier appearance setting.                                                                                                      |

MerchantService now executes onboarding, handle assignment and application writes
directly; it is not a forwarding facade. Its existing constructor and public
methods remain compatible. Read queries and mapping remain ordinary functions.

Onboarding keeps the merchant, owner and selected subscription assignment in the
same transaction. Application decisions retain their existing checks and
attribution. Handle uniqueness and reserved-name validation remain unchanged.
The deprecated first-month activation entry point still rejects the request; it
never fabricates collection or a subscription payment.

See [the application standard](../../../../../docs/architecture/API_APPLICATION_STANDARD.md)
and [verification ledger](../../../../../docs/architecture/API_REFACTOR_PROGRESS.md).
