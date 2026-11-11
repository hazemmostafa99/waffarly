# Local merchant hostnames

The first development slice supports merchant hostnames on the existing Next
storefront server. It does not provision production domains or reserve handles.

## Configure two merchants

Use merchants that already work at `http://localhost:3000/s/<business-code>`.
The Business Code is shown in Super Admin merchant details and is the existing
technical storefront slug. Do not change it, because POS uses it too.

Add this entry to `apps/storefront/.env.local`, replacing both example values:

```dotenv
LOCAL_STOREFRONT_ALIASES='{"abo-ali":"existing-merchant-slug-one","pizza-house":"existing-merchant-slug-two"}'
```

Restart the existing storefront dev process after changing aliases. Then open:

- `http://abo-ali.localhost:3000`
- `http://pizza-house.localhost:3000`
- `http://marketplace.localhost:3000` for the separate local Marketplace.

The two aliases above are configuration examples, not seeded merchants. Without
configured aliases, merchant hostnames return 404. An alias pointing to a missing
merchant retains the existing catalog not-found behavior; there is no mock fallback.
Alias routing is enabled only with `NODE_ENV=development`, and only under
`.localhost`. Deployment needs its own domain/host configuration later.

Routing reads the browser's HTTP `Host` header, including its optional port,
rather than Next's internal URL, which can contain the dev server bind hostname.
Invalid individual alias entries are ignored with a configuration warning; a
valid merchant entry continues to work. Invalid JSON or a non-object configuration
still reports a configuration error.

Names use 3–63 lowercase ASCII letters/digits with internal hyphens. Names reserved
for applications cannot be assigned. A configured alias can point to a longer
technical slug (up to the existing 120-character limit).

## Behavior

Merchant URLs rewrite internally to the existing `/s/<technical-slug>` pages.
Navigation exposes `/menu`, `/products/...`, `/cart`, `/checkout` and account/order
paths on the merchant host. Query parameters are retained. The same components
retain their original links when entered through the legacy localhost path.

Merchant hosts cannot open `/s/<another-merchant>`, `/marketplace` or `/join`.
Unknown handles and reserved application names on port 3000 return 404.
Next internals and public asset directories bypass tenant routing.

The bare `localhost:3000` business homepage and `/marketplace` stay available.
Marketplace-host navigation retains `/marketplace/...` paths for this transitional
slice; `/join` remains the existing local merchant-entry demonstration. Marketplace
continues to use local reference data, with no added backend requests.

Super Admin (5173), Merchant Dashboard (5174) and POS (5175) retain their existing
entry URLs. A hostname does not automatically choose one of these ports.

Chrome/Edge can be used for local hostnames. If local resolution fails, explicitly
map `abo-ali.localhost`, `pizza-house.localhost` and `marketplace.localhost` to
`127.0.0.1` in the Windows hosts file. Hosts files do not accept wildcard entries.
No Cloudflare settings or public DNS changes are needed for this setup.

## Data, state and verification limits

The existing tenant storefront still uses its existing API. This is not a new
Marketplace integration or a new local server. Rendering depends on the configured
API and those merchants already being available.

The API currently checks an explicit origin list, including a separate guard for
unsafe methods. A merchant subdomain is a new browser origin. API-dependent browser
operations may be rejected until that compatibility is addressed separately; do
not disable the checks or assume that homepage rendering proves checkout works.
No CORS, API, authentication or database changes were made in this slice.

Browser storage is origin-specific. An old localhost cart does not automatically
appear on its merchant subdomain. Existing slug-specific cart keys remain intact.

Implementation review only: no dev server/browser acceptance, tests, typechecks or
builds were run for this slice. Manual checks remain pending:

1. Open both configured merchants and verify branding/products.
2. Follow menu, product, cart, checkout and account links; inspect visible host/path.
3. Refresh a nested route with query parameters and use Back/Forward.
4. Confirm unknown/reserved names and cross-merchant paths return 404.
5. Confirm existing localhost routes and the other applications remain available.
6. Confirm Marketplace retains its local demo state and does not call the API.

Next planned slices: Dashboard public-link generation and explicitly labeled
Super Admin address previews. Real create-and-open handle persistence is deferred
to a separately authorized backend phase. See the [plan](local-storefront-subdomains-plan.md).
