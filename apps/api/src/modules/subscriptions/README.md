# Subscriptions

The application service retains the existing methods used by Auth, Merchants,
Orders and the subscription administration controllers in Plans.

| Folder/file                     | Responsibility                                                             |
| ------------------------------- | -------------------------------------------------------------------------- |
| `access/`                       | Current subscription eligibility and transactional checkout checks.        |
| `onboarding/`                   | Initial plan assignment during merchant creation.                          |
| `pricing/`                      | Quotes, unused credit and collection due for a proposed change.            |
| `commands/`                     | Administrative changes, their paid periods, events and saved retry result. |
| `queries/`                      | Owner overview, directory/dashboard, details and paged history.            |
| `subscription-record.mapper.ts` | Coverage selection and period/account response mapping.                    |
| `subscription.rules.ts`         | Existing independent time, credit and effective-status rules.              |

An assignment or cancellation never invents a payment or refund. Existing
revision/quote checks, merchant locks, collection references and transaction
boundaries remain in the operation that owns the change. Helpers keep the supplied
transaction; they do not start nested transactions. Subscriptions has no Auth
dependency, preserving the existing direction of access enforcement.
