# Merchant account

The Merchant Dashboard exposes `/account` from the owner avatar in the header,
Settings and the subscription notice. The header uses an avatar-only link with
an accessible label and an owner-name tooltip. It shows merchant and owner
contacts, username, activity, account creation date/reference, logo, storefront
slug/link and merchant-visible subscription facts. Support and renewal open
WhatsApp at `+201044280822`, configurable with `VITE_SUPPORT_WHATSAPP`.

## Ownership and contracts

Merchants owns the authenticated account controller and profile persistence.
Subscriptions owns the owner billing projection and existing period history.
The existing Merchants → Auth/Subscriptions dependencies remain unchanged.

- `GET /owner/account`: profile plus subscription overview, read in one
  repeatable-read transaction. It remains available to inactive owners.
- `PATCH /owner/account`: trimmed merchant name, owner name, business phone,
  owner mobile and required positive revision. Tenant and actor come from
  `OwnerGuard`; unknown fields, including slug, username and subscription state,
  are rejected. Existing inactive-subscription write restrictions still apply.
- `GET /owner/account/subscription/periods?cursor=...`: explicit 50-record pages
  using the existing subscription history query and merchant-scoped cursors.
  The frontend requests further pages only on demand.

The profile update checks/increments `profileRevision`, records
`profileUpdatedBy`/`profileUpdatedAt` and returns the persisted projection in the
same transaction. Stale writes return 409; the UI retains the draft and asks the
owner to reload before another edit. Header identity updates after saving.
Migration `20261028140000_merchant_account_profile` adds only these profile
metadata columns; it does not modify existing profile or subscription facts.

## Subscription presentation

The owner sees effective status, snapshotted purchased plan name, duration,
decimal-string price/collections/credit, start, original/effective end, total
paid coverage end, next prepaid period and scheduled cancellation. Current and
next periods are queried directly rather than inferred from a truncated history
page. Display dates use `Africa/Cairo`. No administrator identities, internal
event reasons, credential hashes, assumed debts, invoices or automatic charges
are exposed. Legacy accounts receive an explicit review explanation without
invented dates or money. A seven-day notice uses the full paid coverage end.

General Settings now links to this persisted profile instead of presenting a
local-only save, sample email/timezone or nonfunctional security/notification
controls. Storefront design remains in Settings. The slug is read-only because
it is also the POS employee business code. Email, self-service slug changes,
password/session management, payment providers and plan quotas remain separate
features.

## Design and verification

The account page uses Tailwind utilities, existing shadcn-style `@waffarly/ui`
Card, Badge, Button, Input and Dialog components, and shared semantic/Waffarly
color tokens. It supports Arabic/English, RTL, narrow screens, explicit loading,
retry, save/error/conflict and empty-history states.

HTTP tests cover authentication, actor-derived tenancy, normalization and strict
input/cursor validation. Database tests cover profile persistence, attributable
revision checks, tenant isolation, snapshotted billing projections and inactive
states. Browser tests cover bilingual responsive views, real request-based
saving/reload, failure/conflict recovery, bounded history loading, renewal links,
legacy accounts and prepaid/scheduled-cancellation presentation.
