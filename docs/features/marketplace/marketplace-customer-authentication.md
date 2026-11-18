# Marketplace customer authentication

## Authorized behavior

2026-11-17: the user reduced the password minimum to 6 characters across account
types. Customer registration now uses 6–128 characters in the shared API schema,
Marketplace sign-up and tenant storefront sign-up forms. No character-class
complexity rule is required. Password hashing, sign-in, session ownership and
rate limits are unchanged. Source/diff review only; runtime/browser acceptance
and automated checks remain pending under the manual-QA instruction.

The user chose customer registration with a name, email, mobile and password, and
sign-in with either email or mobile plus password. The earlier OTP proposal was
superseded. These routes belong to the existing Auth module:

| Method | Route                    | Purpose                                 |
| ------ | ------------------------ | --------------------------------------- |
| POST   | `/auth/customer/sign-up` | Create an account and start its session |
| POST   | `/auth/customer/login`   | Sign in by normalized email or phone    |
| GET    | `/auth/customer/me`      | Read the current account                |
| POST   | `/auth/customer/logout`  | Revoke the customer session             |

Passwords are scrypt-hashed. Sessions reuse the platform's hashed opaque-token
table and use a customer-specific `HttpOnly`, `SameSite=Lax` cookie with an
eight-hour lifetime. Login and registration attempts use atomic, database-backed,
hashed identifier/IP limits shared across API processes: 20 attempts per identifier
and 100 per IP per 15 minutes for login, and 5 registrations per IP per hour.
Responses do not expose password hashes or session tokens. Signup normalizes email and accepts Egyptian
mobile numbers in local `01xxxxxxxxx` or international E.164 format. Only API
trusted code supplies future verification timestamps.

## Explicit limits

Email and mobile are unverified until their verification flows exist. Contact
ownership is not asserted. Forgot-password currently explains that recovery is
unavailable; it does not send messages. Customer account data is not used to
claim or automatically link past guest orders. Marketplace order history,
addresses, favorites, checkout, payment and tracking retain their existing demo
behavior and are labeled as current-session/demo content. Customer auth sessions
do not authenticate owner, POS employee or admin routes.

These endpoints serve the global Waffarly customer account. Tenant storefront
login at `/s/[slug]/login` uses a separate merchant-scoped credential and session;
registering there does not create or authenticate a Marketplace account. See
[storefront customer accounts](../customers.md#storefront-customer-accounts-2026-11-14).
Marketplace profile/history, addresses, favorites, checkout and tracking retain
their existing local-demo behavior.

## Delivery notes

Migration `20261111220000_customer_password_auth` adds optional email and password
credentials to the existing `CustomerAccount`, makes verification timestamps
nullable, and creates persistent rate-limit counters. It was applied to the local
development database with `prisma migrate deploy`, without resetting data.

API default suite: 229 passed, 0 failed. Customer-auth database suite: 1 passed.
The Auth controller and service passed the API build and typecheck in the earlier
check. Current workspace typechecks also include concurrent work: the API check
stops at `apps/api/src/modules/discounts`, and the Storefront check reports errors
in generated route types and existing product/cart/order/restaurant features.
Neither list reported errors in the customer-auth files. Scoped API lint passed;
API-wide lint retains six restaurant-file errors. The configured API returned
HTTP 401 from `/auth/customer/me` without a session, confirming the route is live.
Storefront browser/manual acceptance remains pending.
