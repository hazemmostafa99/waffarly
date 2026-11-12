# Storefront subdomains

Storefront subdomains are opt-in. Existing `/s/<technical-slug>` URLs on the main
host continue to work. No migration, automatic merchant assignment or reference
data import is required by this change.

## Application configuration

Set `STOREFRONT_BASE_DOMAIN=example.com` in both the API runtime environment and
the storefront build/runtime environment. Supply the bare domain without a
scheme, wildcard, path or port. With no setting, production tenant host routing
and dynamic storefront CORS stay disabled. Development keeps `<handle>.localhost`.

Keep `https://example.com` in the API's explicit `CORS_ORIGINS`. Dynamic origins
are limited to registered HTTPS handles under this domain; do not configure a
broad wildcard CORS origin. Public catalog/quote/order requests must target that
handle's technical slug. Only existing customer-auth endpoints receive
credentialed dynamic CORS. Owner/admin/POS access remains protected by the
existing explicit origin policy and authentication.

Use `NEXT_PUBLIC_API_BASE_URL=https://api.example.com` for storefront builds and
`VITE_STOREFRONT_BASE_URL=https://example.com` for both dashboard builds. Rebuild
after changing browser-facing environment values. Assign each merchant's unique
handle through Super Admin; previewing a handle does not reserve it.

## DNS, TLS and reverse proxy

Configure a wildcard DNS record pointing to the deployment's reverse proxy, and
keep explicit API/admin/merchant/POS records. The HTTPS certificate must cover the
root domain and `*.example.com`. When using Cloudflare proxying, configure Full
(strict) with a valid origin certificate covering both names.

Add `*.example.com` to the storefront Nginx server's `server_name`, retaining
exact-name servers for the other applications. Preserve `Host $host` and set
`X-Forwarded-Proto $scheme`; validate with `nginx -t` before reloading. Keep the
application listener private to the proxy. Host routing does not trust an
arbitrary `X-Forwarded-Host` supplied by a client.

Proxy replaces its private tenant-context header on every request, so clients
cannot inject it on root-domain requests. The server loader resolves the saved
handle before fetching the existing catalog. Unknown and reserved handles fail
closed; public links retain clean `/menu`, `/cart`, etc. paths.

`skipProxyUrlNormalize` and raw rewrite URLs keep loopback destinations internal:
NextURL otherwise normalizes `127.0.0.1` to `localhost`, which can cause a second
request that loses tenant context. Redirects use the public host without leaking
the private listener port. Regression tests cover both behaviors.

## Verification

Run the API HTTP/unit suite, API/storefront typechecks and production builds.
Focused checks are `apps/api/test/http/storefront-origin.e2e.test.ts` and
`apps/storefront/src/lib/storefront-address.test.ts`.

On a configured deployment, verify a registered handle's home/menu/product/cart/
login pages, clean links and legacy root-host URLs. Check own-catalog CORS,
customer-auth preflight and rejected cross-tenant/admin/unknown-handle requests.
Build separately from live artifacts and retain the previous builds and
configuration for rollback.
