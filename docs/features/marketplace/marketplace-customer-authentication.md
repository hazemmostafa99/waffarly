# Marketplace customer authentication

## Authorized behavior

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

The same auth endpoints serve the customer login at the tenant storefront route
`/s/[slug]/login`; customer identity is global across Waffarly stores. The store
account overview displays the active session and supports logout. Profile editing,
order history, and saved addresses on tenant storefront pages remain previews.

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
