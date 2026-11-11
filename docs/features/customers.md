# Customers foundation

## Subsequent authentication implementation (2026-11-11)

The earlier phone-plus-OTP decision was superseded by the user's explicit choice
of email, mobile and password, with sign-in by either email or mobile. Auth owns
global CustomerAccount credentials and customer sessions. Neither contact method
is verified during registration. Customer profile linking and guest-order claims
remain disabled; a matching email or mobile alone does not prove ownership.
See [customer authentication](../marketplace-customer-authentication.md).

## Delivery and authorization (2026-11-11)

The user authorized implementing shared customer identity, merchant-local customer
records and order associations, in preparation for frontend integration. Mobile
phone + OTP was the initially chosen sign-in method. This delivery implements the persistence
foundation, authenticated owner APIs, and the merchant customer directory/order
association UI. It does not implement or enable customer sign-in, send OTP messages,
link global accounts, integrate Marketplace customer screens, or change existing
checkout/POS submission behavior.

Customers owns merchant customer records and their private merchant-facing
projection. Auth remains responsible for future customer identity verification,
credentials/challenges and sessions. Orders owns customer associations and customer
order history. Dependencies: Customers -> Auth; Orders -> Customers (in addition
to existing dependencies). No reverse dependency is introduced.

## Models

### CustomerAccount: one Marketplace account across Waffarly

| Field                    | Meaning                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `id`                     | Global UUID, independent of merchants                              |
| `phone`                  | Unique normalized phone in E.164 format, e.g. `+201000000000`      |
| `phoneVerifiedAt`        | Nullable; not set by password registration                         |
| `email`                  | Optional normalized unique email used for password sign-in         |
| `emailVerifiedAt`        | Nullable; not set by password registration                         |
| `passwordHash`           | Nullable scrypt hash for accounts created by password registration |
| `displayName`            | Optional account display name                                      |
| `createdAt`, `updatedAt` | Account timestamps                                                 |

There is no public/owner account creation endpoint in this delivery. A stored
contact phone is not proof of ownership. The database format constraint does not
itself verify ownership. No passwords, OTP plaintext, account sessions or fake
verification endpoints are introduced. CustomerAccount has no merchantId.

### MerchantCustomer: relationship/contact record at one merchant

| Field                                    | Meaning                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`, `merchantId`                       | UUID and tenant boundary                                                              |
| `accountId`                              | Optional future verified account association; never accepted or exposed by owner APIs |
| `name`, `phone`, `email`                 | Merchant-local contact details; phone/email nullable and unverified                   |
| `notes`                                  | Private merchant notes, up to 2,000 characters                                        |
| `segment`                                | `regular` or merchant-assigned `vip`                                                  |
| `firstChannel`                           | First contact: `marketplace`, `storefront`, `pos`, `manual`                           |
| `archivedAt`                             | Nullable soft-archive timestamp; history remains readable                             |
| `revision`                               | Starts at 1; optimistic concurrency for changes                                       |
| `creationRequest`, `creationFingerprint` | Tenant-scoped creation retry identity and normalized-payload fingerprint              |
| `createdBy`, `updatedBy`                 | Attributable owner username                                                           |
| `createdAt`, `updatedAt`                 | Timestamps                                                                            |

Manual owner creation always sets `firstChannel = manual`. Clients cannot claim
another acquisition source. Other channel values are foundations for future trusted
channel integration. They do not mean those ingestion paths are connected today.

Multiple guest/contact records may share the same phone/email. They are never
automatically merged or granted global order access. A future verified account can
have at most one relationship per merchant (`merchantId + accountId` uniqueness).
Connecting multiple historical guest records requires a deliberate verified
claim/merge workflow, which is not implemented here. Owner changes affect only
local contact details, never global account data.

### StorefrontOrder: existing order, additive customer association

| Field                                              | Meaning                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `merchantCustomerId`                               | Optional linked merchant-local customer                                      |
| `customerLinkedBy`, `customerLinkedAt`             | Attribution for the explicit association                                     |
| `merchantId`                                       | Existing merchant boundary; compound FK prevents foreign-tenant associations |
| `customerName`, `customerPhone`, `deliveryAddress` | Existing order contact snapshot, unchanged by profile editing/linking        |
| `source`                                           | Existing order source; remains separate from customer's firstChannel         |
| `revision`                                         | Existing order revision; association increments it                           |

Existing orders and POS walk-in sales remain valid without a customer association.
No historical phone-based backfill occurs. Existing `source` behavior is preserved:
this slice does not add a trusted marketplace/manual order-entry channel or rewrite
existing storefront/POS sources. Channel attribution at Marketplace checkout is a
separate integration step, not inferred from caller-provided customer data.

## Owner HTTP contracts

All routes require the existing owner session. Tenant and actor come from that
session; unknown fields, merchantId/accountId injection and invalid UUIDs fail.
There is no customer-side/public access to this directory.

| Method | Route                             | Behavior                                                                                                                                  |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/owner/customers`                | Cursor list: `limit` 1..100 (default 25), optional UUID `cursor`, `search` up to 120 chars, `status=active/archived/all` (default active) |
| POST   | `/owner/customers`                | Create using UUID `requestId`, required `name`, optional nullable `phone`/`email`, optional `notes`/`segment`                             |
| GET    | `/owner/customers/:id`            | Merchant-local profile, including archived records                                                                                        |
| PATCH  | `/owner/customers/:id`            | Required `revision` plus at least one editable field: name/phone/email/notes/segment/archived                                             |
| GET    | `/owner/customers/:id/orders`     | Linked order history, UUID cursor and limit 1..100 (default 25); no inferred phone matches                                                |
| PUT    | `/owner/orders/:orderId/customer` | Required order `revision` and `customerId`; explicitly link an active same-merchant customer                                              |

Example creation request (sample contact data):

```json
{
  "requestId": "11111111-1111-4111-8111-111111111111",
  "name": "عميل تجريبي",
  "phone": "01000000000",
  "notes": "يفضل الاستلام من الفرع",
  "segment": "regular"
}
```

Profile responses expose only id/name/phone/email/notes/segment/firstChannel,
archivedAt/revision/createdAt/updatedAt. They never expose accountId, global account
profile, other merchants' activity, audit usernames or creation fingerprints.
Lists return `{ items, nextCursor }`; cursors must belong to the same merchant and
current filters. Order history returns id/reference/source/status/total/currency/
createdAt; money is a two-decimal EGP string. No spend/loyalty/marketing-consent
totals or invented financial metrics are persisted.

Creation replays the existing current profile for the same requestId and normalized
creation payload; a changed payload yields 409. Update conflicts yield 409. Foreign
or missing records yield 404. Associating the same customer is idempotent; another
customer cannot overwrite an existing association. Linking locks the active
customer on the caller's transaction, increments the order revision atomically,
and preserves order contact and financial snapshots. Archival blocks new links,
but does not revoke historical associations. Tenant constraints also apply at the
database layer.

## Migration and verification

Migration: `20261111210000_customers_foundation`. Applied to the configured local
development database without resetting data. Existing contacts/orders are not
backfilled, and existing checkout/POS inputs are unchanged.

Verified on Node 24.11.1:

- Prisma schema validation; database/contracts builds; API typecheck/build.
- API default suite: 227 passed, 0 failed/skipped (including four customer HTTP tests).
- Customer database suite: two tests passed, 0 failed/skipped.
- Customer database tests: persistence, scoped reads/writes/cursors, retry payload
  conflict, independent shared-phone records, revision checks, explicit order
  association/replay, archival, snapshot preservation and compound foreign keys.
- Full API lint has pre-existing errors in restaurant-profile and restaurant-order-policy
  services; customer-related files are checked separately.

Source test workers initially hit sandbox `spawn EPERM`. The compiled API suite
also ran using Node's `--test-isolation=none`; source test execution uses the
approved process-execution path. Database fixtures roll back their transactions.

## Remaining work

1. Select/configure the SMS provider, then implement Auth-owned OTP challenges,
   bounded attempts/rate limits, expiration, single use, verified account creation
   and customer sessions. Provider failures must never issue a session.
2. Implement customer-authorized historical-record claims with explicit ownership
   checks; never expose account linking to merchant profile PATCH.
3. Integrate explicit customer selection in POS order entry;
   keep anonymous POS sales available.
4. Separately integrate customer login/profile/history UIs and trusted Marketplace
   order channel attribution. Saved addresses and consent/loyalty behavior need
   their own concrete flows; they are not fabricated in this foundation.
