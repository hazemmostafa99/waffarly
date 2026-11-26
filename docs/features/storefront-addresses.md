# Direct storefront addresses

User authorized persistent public handles on 2026-11-11 after reviewing local
subdomain routing. This authorization covers the direct tenant storefront only;
Marketplace remains local-only under its existing roadmap.

## Ownership and contracts

Merchants owns the public handle on Merchant, assignment attribution and lookup.
No new business-module dependency or authentication flow was introduced.

- `POST /admin/merchants` accepts optional `storefrontHandle`; merchant, owner and
  handle are created in the existing transaction. Conflicts roll back together.
- `PUT /admin/merchants/:id/storefront-handle`, protected by AdminGuard, accepts
  only `{ handle }`. Names are trimmed/lowercased and checked against shared rules.
  The actor comes from CurrentAdmin, never the request body. Unknown merchant:404;
  invalid body/name:400; duplicate name or attempted replacement:409.
- `GET /storefront-handles/:handle` is public and returns only `{ handle,
storefrontSlug }`. Unknown/reserved/invalid handles return 404, never owner PII.
- Admin merchant summaries and owner account/storefront-settings projections
  expose optional nullable `storefrontHandle`, preserving existing clients.

Handles use 3–63 lowercase ASCII letters/digits with internal hyphens. Shared
reserved names cover existing applications and infrastructure labels. SQL checks
and a unique index enforce stored validity and cross-merchant uniqueness.
Conditional assignment requires the existing field to be null, protecting the
same merchant against simultaneous competing assignments. A repeat of the same
handle is idempotent and preserves original actor/time. Rename/removal/reuse
semantics are deliberately unsupported in this initial slice.

The technical `storefrontSlug` remains the public catalog identifier. Since 2026-11-26 it
is no longer the POS business code (see the section at the end). No existing code,
account or historical order is renamed.

## Frontend behavior

Next Proxy parses the request host and rewrites without querying the API.
The request-memoized server page loader resolves the handle without a persistent
cache, then fetches the existing technical-slug catalog. Catalog tags, cart state
and query identity continue to use the technical slug. Legacy URLs remain valid.

Super Admin supports optional handle selection during creation and initial
assignment on existing merchant details, with preview/copy/open actions.
Merchant-application approval can be followed by assignment on merchant details.
The preview is not an availability guarantee; the database decides on save.
Owner account/settings links use the assigned handle where present.

Local `.localhost` origins require development mode and a matching explicitly
trusted localhost scheme/port. Production storefront routing and API origins are
opt-in through `STOREFRONT_BASE_DOMAIN` in both applications. Only HTTPS origins
under that domain, with a registered handle and a trusted root origin, qualify.
Public catalog/quote/order access requires the handle's exact technical slug.
Only existing customer-auth routes receive credentialed dynamic CORS; these
customer accounts remain global. Admin/owner/POS routes, other tenants and unknown
handles receive no dynamic authorization. Explicit trusted application origins
retain their existing permissions.

## Migration, rollout and validation

Apply `20261111120000_storefront_handles` before running the updated API. It adds
nullable columns to `merchants`, with uniqueness/validation constraints, without
backfilling addresses or changing old identifiers. Build contracts/database client
before API clients. The migration was applied to the local development database.

223 API HTTP/unit tests passed; focused real-database checks passed for concurrent
reservation, assignment races, replay attribution, atomic create rollback and
unchanged technical codes. Merchant account database regression passed. API
typecheck/lint/build evidence is recorded at task completion. Frontend browser
acceptance remains manual and was not performed by this change.

See [local setup](../setup/local-storefront-subdomains.md) and
[production configuration](../setup/STOREFRONT_SUBDOMAINS.md). This production
routing change adds no database migration, shared API contract or module dependency.

## Required subdomain and POS sign-in names — 2026-11-26

User-approved change. The handle ("subdomain") is now required for every merchant and
is the first part of every POS cashier sign-in name.

- Migration `20261126180000_required_storefront_handle` gave each merchant without a
  handle a temporary one from its name (Latin letters/digits joined by hyphens, cut to
  50 characters) or `store-<first 6 id chars>` when the name has none, with `-2`, `-3`…
  on conflicts, attributed to `migration`. `merchants.storefrontHandle` is then NOT NULL.
- `POST /admin/merchants` requires `storefrontHandle`. Merchant applications
  (`POST /merchant-applications`) require a requested handle; a handle already used by a
  merchant or another pending application returns 409. Approval
  (`POST /admin/merchant-applications/:id/approve`) requires `storefrontHandle`, prefilled
  in Super Admin from the request and editable; the unique column decides on save.
- `PUT /admin/merchants/:id/storefront-handle` now also changes an existing handle. The
  old subdomain stops resolving and every POS sign-in name changes; Super Admin must tick
  a warning before saving. Concurrent changes are guarded by matching the current value.
- POS login (`POST /auth/pos/login`) takes `{ login, password }` where `login` is
  `<subdomain>.<username>`, e.g. `ahmed-cafe.ali`, split at the first dot
  (`parsePosSignInName`). The technical `storefrontSlug` is no longer accepted there and
  is no longer shown in Super Admin, the merchant dashboard or POS; it stays the internal
  catalog/order identifier. Supervisor approvals still use the plain username.
