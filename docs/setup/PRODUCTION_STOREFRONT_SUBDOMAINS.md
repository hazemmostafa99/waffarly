# Production storefront subdomains

Production host routing is opt-in through `STOREFRONT_BASE_DOMAIN=wfarly.com` in
both the API and storefront environments. Use a bare domain, without scheme,
path, wildcard or port. Local development continues to use `<handle>.localhost`.

Cloudflare DNS needs a proxied wildcard A record (`*`) pointing to the VPS.
Keep explicit API, admin, merchant and POS records. The origin certificate must
cover both `wfarly.com` and `*.wfarly.com`; use Full (strict) with that certificate.
The existing origin certificate on the demo VPS already covers these names.

In the existing Nginx storefront server, use:

```nginx
server_name wfarly.com *.wfarly.com;
```

Keep its existing TLS configuration and proxy to `127.0.0.1:3000`, preserving
`Host $host`. Existing exact-name Nginx API/admin/merchant/POS servers take
precedence over the wildcard. Validate with `nginx -t` before reloading.

Set `VITE_STOREFRONT_BASE_URL=https://wfarly.com` in both dashboard build
environments. Keep `https://wfarly.com` in API `CORS_ORIGINS`; do not add a broad
wildcard CORS origin. Set `NEXT_PUBLIC_API_BASE_URL=https://api.wfarly.com` in
the storefront build environment. Rebuild after changing Vite/NEXT_PUBLIC values.

Assign each merchant's handle through Super Admin. Handles remain immutable,
unique, validated and attributed by Merchants. Existing `/s/<technical-slug>`
links on the main domain continue to work. Unknown handles and reserved
application names do not open another tenant. The proxy uses the preserved Host,
never arbitrary forwarded-host headers, and the server resolves the saved handle.
Proxy also replaces a private request-context header before forwarding it to the
page loader. `skipProxyUrlNormalize` and a raw URL preserve the loopback origin;
otherwise Next normalizes `127.0.0.1` to `localhost`, treats the rewrite as external
and loses tenant context. A regression test covers that case and header spoofing.

Dynamic production CORS accepts only HTTPS origins under the configured domain
whose handles exist. Public catalog/quote/order access is checked against the
resolved merchant's technical slug. Only the existing customer-auth routes receive
credentialed CORS; customer accounts remain global, as before. Owner/admin/POS
requests and other tenants' catalog requests receive no dynamic authorization.
The exact trusted application origins retain their existing permissions.

Build in a separate checkout while production services remain running. Back up
the database, environment files, Nginx configuration and previous build artifacts
before switching builds. Verify root/menu/cart/login, unknown handles, old URLs,
customer-auth preflight and rejected cross-tenant/admin requests. No schema change
or automatic assignment of customer merchants is needed for this rollout.

## Demo VPS rollout, 2026-11-12

The user-selected `demo-restaurant.wfarly.com` is assigned to the dedicated
`reference-restaurant-1` tenant (بيت البرجر) through Merchants' existing assignment
service, with deployment-operator attribution. No customer merchant was changed.
Nginx and application environments are configured; the pre-existing wildcard
origin certificate is retained. Database/configuration and old build backups are
under `/var/backups/waffarly`; the tested build checkout is under
`/var/www/waffarly-releases/20261111T221804Z-subdomains`.

All eight workspace builds passed on the VPS. Five origin-policy HTTP tests and
the host/rewrite regression test passed. Public HTTPS checks passed for root,
menu, product, cart, checkout, login and account; clean menu links were verified.
Unknown hosts and cross-store paths returned 404. Own-catalog CORS and
customer-auth preflight/unauthenticated session CORS passed; cross-tenant quote,
admin write and unregistered customer-auth requests returned 403. Empty quote
validation returned 400 without creating an order. Legacy store URLs and all
existing application domains remained available.

Limits: interactive browser verification was unavailable in this session. No real
customer account, order or payment was created. The full API suite had 231/233
passing tests, with two existing discount-schema fixture failures (`maximum: ''`
does not satisfy the unchanged money schema). API-wide lint still reports six
existing restaurant-service errors; modified API files pass targeted lint.
