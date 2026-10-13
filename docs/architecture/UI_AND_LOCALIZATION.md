# UI and localization

All four frontends use Tailwind CSS v4 and the shared `@waffarly/ui` package. The package owns the adapted shadcn/ui source components (Button, Input, Textarea, Card), Radix Slot composition, the `cn` helper, and the green theme in `src/theme.css`. `components.json` files configure the shared package and each app for shadcn. The Vite apps use `@tailwindcss/vite`; the Next.js storefront uses `@tailwindcss/postcss`.

Existing feature-specific styles remain in the Tailwind `components` layer, so utility classes can override them. Use logical spacing (`ps`, `pe`, `start`, `end`) and `text-start` for layouts that need to work in both directions. Use an explicit Button variant for secondary actions and a grid/block override for interactive preview cards.

`LocaleProvider` creates an isolated i18next instance for each application. `useLocale()` exposes English/Arabic translations, localized dates, readable error messages, and the current locale. English text is the translation key; Arabic translations live in `packages/ui/src/locales/ar.ts`. Add new user-facing strings to that catalog and render them through `t()`. Store dynamic feedback as a `LocalizedMessage` with a key and interpolation values so switching language also updates an existing message.

The language switcher updates `html.lang` and `html.dir`, saves a preference in a cookie and local storage, and preserves form state. The cookie shares the preference across local app ports on the same hostname. Separate production hostnames retain independent preferences. The storefront reads its locale cookie on the server to render the correct direction and language before hydration. Restaurant names, edited descriptions, usernames, and other user-authored content retain the language in which they were entered.

## Verification

Run `pnpm test:ui` with Google Chrome installed. The Playwright suite checks all four apps on desktop and an emulated mobile screen, including Arabic/English switching, preference persistence, RTL overflow, login errors, password visibility, restaurant search, localized prices, and application submission. API responses use synthetic fixtures; the tests do not require a database or modify real accounts.

Test servers use ports 5273–5275 and 3100. The storefront uses a separate `.next-ui-tests` directory to keep its test process separate from a normal development server. Failed tests retain screenshots and traces in `test-results`.

Build the shared package before checking individual applications: `pnpm --filter @waffarly/ui build`. Follow the Node and pnpm versions specified in the root package manifest.
