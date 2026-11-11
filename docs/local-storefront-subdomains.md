# Saved storefront addresses in local development

Production rollout is now supported through an explicit base-domain setting.
See [production storefront subdomains](setup/PRODUCTION_STOREFRONT_SUBDOMAINS.md)
for DNS, TLS, Nginx, environment and origin-policy requirements. The local setup
below still applies; its earlier production limitations are superseded there.

Updated 2026-11-11. Merchant addresses are now stored through the API/database.
`LOCAL_STOREFRONT_ALIASES` is obsolete and is no longer read. There is no automatic
import of old aliases: an administrator explicitly assigns the desired handle.

## Try an existing merchant

1. Restart the API and storefront development processes after pulling these changes.
2. Open Super Admin at its usual localhost:5173 entry and open merchant details.
3. In Direct storefront address, enter a handle such as `abo-ali` and save.
4. Use Open storefront or visit `http://abo-ali.localhost:3000`.
5. Refresh, navigate menu/products/cart/account and verify the host stays the same.

New merchant creation also accepts an optional storefront address. Merchants
approved through applications can receive an address from their details page.
The POS Business Code remains unchanged. Existing merchants without an address
continue to use `/s/<business-code>`; the old URLs remain available after assignment.

A preview does not reserve a name. The API validates and atomically reserves it
when saving. Duplicate names return 409; invalid/reserved names return 400.
Addresses cannot currently be renamed or removed. Repeating the same assignment
is safe and does not overwrite the original assignment actor/time.

## Local applications

- Merchant store: `http://<handle>.localhost:3000`
- Marketplace: `http://localhost:3000/` or `http://marketplace.localhost:3000`
- Super Admin: existing localhost:5173 entry
- Merchant Dashboard: existing localhost:5174 entry
- POS: existing localhost:5175 entry

Super Admin and Merchant Dashboard use `VITE_STOREFRONT_BASE_URL` (locally
`http://localhost:3000`) for public links. A hostname does not choose an application
port. No Cloudflare records, hosts-file edits or reverse proxy are normally needed
with Chrome/Edge localhost support. If name resolution fails, explicitly map the
individual `.localhost` names to 127.0.0.1 in Windows hosts; wildcard entries are
not supported there.

## Request flow

Proxy reads the original HTTP Host header and rewrites a merchant request to the
existing `/s/<handle>/...` page tree. Proxy does not fetch merchant data. The server
page loader resolves the handle through `GET /storefront-handles/:handle`, then
loads the existing catalog by its unchanged technical slug. Handle resolution is
not cached between requests; React request memoization deduplicates layout/page
work. Existing catalog cache tags remain based on the technical slug.

The address context carries both route handle and technical slug, so old component
links render as clean `/menu`, `/cart`, `/checkout`, etc. Tenant cart storage and
query keys use the technical slug. Browser storage remains origin-specific: an old
localhost basket does not automatically move to a merchant subdomain.

Unknown handles render not-found. Reserved application hosts and merchant-host
access to `/s/...`, `/join` or the legacy
`/marketplace` prefix are rejected. The former Marketplace prefix redirects
to the corresponding root-based route on localhost. Framework/public asset paths
bypass tenant routing. Marketplace remains local-data-only and does not use the new
resolver or tenant APIs.

## Browser API requests

In API development mode only, a registered `<handle>.localhost` origin may access
its own public catalog/quote/checkout paths. Its scheme/port must correspond to an
explicitly configured trusted localhost origin in `CORS_ORIGINS` (normally
`http://localhost:3000`). The API checks the saved handle maps to the requested
technical slug. These dynamic origins receive no credentialed CORS access and
cannot use this exception for admin/owner/POS requests or other merchants.
The normal trusted application origin list and unsafe-method checks remain in
place. No production-origin allowance was added.

## Database and validation evidence

Migration `20261111120000_storefront_handles` adds nullable public handle and
assignment attribution fields, a unique index and a SQL validation constraint.
It was applied to the local development database in this session. It preserves
all existing merchant slugs and does not assign any production/customer handles.

The first migration attempt failed before changing schema because the SQL used
the Prisma model name instead of its mapped table name. The failed state was
marked rolled back, the new unapplied migration corrected to `merchants`, and
then successfully deployed. No historical migration was changed.

API regression suite: 223 tests passed. Focused real-database verification passed
for concurrent duplicate reservation, same-merchant competing assignments,
idempotency/attribution, invalid/missing addresses, unchanged POS codes and
atomic merchant creation/rollback. Merchant account database regression also
passed. Isolated test fixtures were cleaned up.

Frontend automated checks and browser acceptance have not been run, per repository
manual-QA preference. Manually verify the create/details form, duplicate errors,
copy/open actions, two merchants, nested refresh and legacy links. Cloudflare/VPS
host routing and production HTTPS remain a separate deployment step.
