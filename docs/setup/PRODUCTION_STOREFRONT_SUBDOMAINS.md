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
