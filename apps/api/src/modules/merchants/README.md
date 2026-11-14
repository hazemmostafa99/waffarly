# Merchants

| Folder/file                          | Responsibility                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `onboarding/`                        | Creates the merchant, owner and initial subscription assignment; builds the technical storefront identifier. |
| `applications/`                      | Submission, prior rejection history, approval and rejection of applications.                                 |
| `addresses/`                         | Assignment and public resolution of storefront handles.                                                      |
| `queries/`                           | Merchant directory reads.                                                                                    |
| `merchant-record.mapper.ts`          | Merchant and application summaries.                                                                          |
| `merchant-account.*`                 | Existing owner account/contact editing and subscription overview.                                            |
| `merchant-pos-appearance.service.ts` | Existing merchant-wide cashier appearance setting.                                                           |

`MerchantService` retains its constructor and public methods. Application approval
keeps its existing transaction and validation; the create flow keeps owner and
subscription assignment together. Historical first-month activation remains
blocked by its existing conflict response. Do not infer subscription access from
that historical timestamp.
