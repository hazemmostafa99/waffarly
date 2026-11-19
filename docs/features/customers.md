# Customers foundation

## Storefront customer accounts (2026-11-14)

Tenant storefront accounts are local to one merchant. Registration at
`/s/[slug]/login` creates a `MerchantCustomer` row with
`firstChannel = storefront` and a separate `MerchantCustomerCredential`; it does
not create or sign in to a global `CustomerAccount`. Login sessions use a
store-specific cookie and are checked against that merchant's credential.

Submitting an order from that storefront while signed in attaches the new order
to the same merchant customer inside the checkout transaction. The owner
customer directory therefore shows the registration immediately, and the
storefront account's order history can read only orders linked to that customer
at that merchant. Guest orders and orders submitted through the Marketplace
customer checkout keep their existing behavior. No automatic matching by
phone/email or backfill of old orders occurs; the owner's existing explicit
order-association flow remains available.

The same email or phone may be used to create a separate account at another
merchant. Storefront credentials and sessions remain independent of the global
Waffarly account. Contact ownership is not verified, password recovery is not
available, and the owner directory contact fields are not credential-management
controls. Profile and address previews described in the original 2026-11-14
delivery were superseded by the separately approved 2026-11-19 integration below.

Migration: `20261114150000_merchant_customer_storefront_accounts` adds the
merchant-scoped credential table and widens `auth_sessions.subjectKind` for the
new session kind. Applied to the configured local development database without
resetting data. Existing contacts and orders are not modified.

| Method | Route                                   | Behavior                                                    |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| POST   | `/auth/stores/:slug/customer/sign-up`   | Create a customer and login for that merchant               |
| POST   | `/auth/stores/:slug/customer/login`     | Sign in using that store's normalized email or mobile       |
| GET    | `/auth/stores/:slug/customer/me`        | Read the current store-specific session                     |
| POST   | `/auth/stores/:slug/customer/logout`    | Revoke the current store-specific session                   |
| GET    | `/catalog/stores/:slug/customer/orders` | List orders linked to that signed-in customer at this store |

## Storefront profile and saved addresses (2026-11-19)

The user separately approved backend integration for tenant-store customer
profiles and delivery addresses. This does not change global Marketplace customer
accounts or the Marketplace UI's local-data phase.

`Customers` owns these authenticated self-service routes. The storefront slug is
resolved to a merchant, and every profile and address query/write is scoped to
that merchant and the customer from the existing HttpOnly session. Request bodies
cannot supply a merchant or customer ID. Profile writes use the customer revision;
changing email or phone also requires the current password and updates the
merchant directory contact and sign-in credential together. Email/phone uniqueness
continues to apply within one merchant.

Saved addresses live in `MerchantCustomerAddress`, linked by a compound
`(merchantCustomerId, merchantId)` foreign key. A customer can save up to 20
addresses per store and have at most one default address. Changes require the
address revision. Address writes lock the parent customer row so concurrent saves
cannot exceed the limit or create competing defaults; a partial unique index is a
database backstop. Removing or unsetting the default promotes the oldest remaining
address. An address from one store cannot be read or changed through another
store's session.

Checkout can load this customer's saved addresses. Selecting one fills the
existing delivery-area selection and full textual delivery address, including
optional delivery notes; checkout then uses the existing order API, which remains authoritative for current branch
coverage, availability, pricing and order creation. The saved address is copied
into the existing order address snapshot; later edits do not rewrite past orders.
No payment or collection is implied. Address area details are retained as entered
for display; the order endpoint still decides whether the selected destination is
currently serviceable.

| Method | Route                                              | Behavior                                                            |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------- |
| PATCH  | `/auth/stores/:slug/customer/profile`              | Update the signed-in merchant customer profile with revision checks |
| GET    | `/auth/stores/:slug/customer/addresses`            | List saved addresses for that merchant customer                     |
| POST   | `/auth/stores/:slug/customer/addresses`            | Add an address (maximum 20); the first is default unless unchecked  |
| PATCH  | `/auth/stores/:slug/customer/addresses/:addressId` | Edit an address or change its default status using its revision     |
| DELETE | `/auth/stores/:slug/customer/addresses/:addressId` | Delete an address using its revision                                |

Migration: `20261119100000_storefront_customer_profile_addresses` adds the
address table, tenant-safe foreign key, owner index and one-default partial unique
index. Migration application is recorded only after confirming the configured
target is the local development database. The configured target is
`localhost:5433/waffarly`. After confirming its container was healthy and
reviewing the pending migration SQL, all three pending development migrations
were applied with `migrate deploy`, without a reset. This also applied the earlier
order inbox index and order-origin correction migrations. Manual acceptance
remains required for profile reloads, contact-password checks, tenant isolation,
address CRUD/default behavior and checkout address selection. No automated checks
are run for this slice per the current manual-QA preference.

Sessions use an eight-hour `HttpOnly`, `SameSite=Lax` cookie whose name includes
the storefront slug. Signup allows 5 attempts per IP per hour; sign-in allows
100 attempts per IP and 20 per store-scoped identifier per 15 minutes. Unknown
accounts still perform the password hash verification work. These routes derive
merchant identity from the validated storefront slug, not from request data.

## Subsequent authentication implementation (2026-11-11)

The earlier phone-plus-OTP decision was superseded by the user's explicit choice
of email, mobile and password, with sign-in by either email or mobile. Auth owns
global CustomerAccount credentials and customer sessions. Neither contact method
is verified during registration. Customer profile linking and guest-order claims
remain disabled; a matching email or mobile alone does not prove ownership.
See [customer authentication](marketplace/marketplace-customer-authentication.md).

## Foundation delivery (2026-11-11)

The initial customer-directory delivery added merchant-local contact records,
authenticated owner APIs, and explicit order associations. Phone-plus-OTP was the
first sign-in proposal, then superseded by the email/mobile/password choice
described above. That initial delivery did not create OTP challenges or link
global accounts. Tenant storefront sign-up and order history were authorized
separately on 2026-11-14 as documented earlier in this file.

Customers owns merchant customer records, storefront credentials and the private
merchant-facing projection. Auth owns global `CustomerAccount` credentials and
session primitives. Orders owns customer associations and customer order history.
Dependencies: Customers -> Auth, Merchants; Orders -> Customers (in addition to
existing dependencies). No reverse dependency is introduced. POS behavior and
Marketplace customer identity remain separate.

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

`CustomerAccount` remains the global Waffarly identity. The tenant storefront
registration above does not create it or set its optional association on a
`MerchantCustomer`. A stored contact phone is not proof of ownership. The
database format constraint does not itself verify ownership. `CustomerAccount`
has no merchantId.

### MerchantCustomerCredential: sign-in at one storefront

This separate record stores a scrypt password hash and normalized email/mobile
for one merchant customer. Unique indexes apply within a merchant, so another
store may register the same email or phone independently. A compound foreign
key binds the credential to the matching customer and merchant. Credentials
cannot access another store or the global Marketplace customer session.

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
| `createdBy`, `updatedBy`                 | Attributable owner username or trusted creation source                                |
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

1. Implement verified ownership and safe password recovery for global Marketplace
   accounts and tenant storefront credentials.
2. Implement customer-authorized historical-record claims with explicit ownership
   checks; never expose account linking to merchant profile PATCH.
3. Integrate explicit customer selection in POS order entry;
   keep anonymous POS sales available.
4. Separately integrate the global Marketplace profile/history UI and trusted
   Marketplace order channel attribution. Saved addresses and consent/loyalty
   behavior need their own concrete flows; they are not fabricated here.
