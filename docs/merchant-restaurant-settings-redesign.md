# Restaurant settings workspace redesign

The restaurant `/settings` page now uses a scoped workspace aligned with the
merchant dashboard's green, navy, cool borders and white surfaces. Other business
activities retain their existing settings route.

- URL-backed sections for identity, hours, delivery, menu, standalone storefront
  design and account. Only one panel is shown; restaurant/menu editors remain
  mounted so switching sections preserves unsaved drafts.
- Removed the repeated general-information card from the default restaurant view.
  Account/subscription details and standalone design have their own sections.
- Image previews with upload/change actions; URLs and alt text are under optional
  details. Existing upload and owner settings APIs remain in use.
- Consistent input sizes and primary/secondary buttons; responsive section
  navigation, sticky save bars, dirty indicators and explicit discard actions.
- Weekly days have enable switches; pause uses an amber control to distinguish
  stopping orders from enabling a service. Schedule exceptions/areas remain editable.
- Menu sections and products are moved using labeled up/down actions, replacing
  raw display-order inputs. Product movement stays inside its effective section.
  Added search, category filter, image/price context, availability switches and
  empty results. Primary-section editing and existing Product Builder links remain.
- A router leave dialog and browser unload warnings protect restaurant/menu
  drafts. In-page section changes are permitted without losing those drafts.
  Existing standalone-design editing retains its prior save behavior.
- Restaurant form validation is submitted across its sections; hidden required
  inputs do not trigger an inaccessible browser validation popup. Server revision
  conflicts remain explicit and never silently overwrite drafts.

No tests, browser automation, typecheck, lint or build were run as requested.
The user-provided screenshots guided the redesign; the new rendering is manually
unverified. No live merchant settings or seeded data were changed by this redesign.


## Settings simplification

- Removed the menu management tab and its mounted editor from restaurant settings.
  Product/category management remains in the existing catalog pages; no menu data
  or API was removed. Old `section=menu` links show restaurant identity instead.
- Removed the page heading, breadcrumbs, repeated section heading and restaurant
  name decoration above the editor. Each editor retains its own concise heading.
- Opening schedules use Africa/Cairo without an editable timezone control.
  The pause reason is shown when orders are paused.
- Storefront identity uses a compact logo editor and customer link with copy/open
  actions. Links use the assigned storefront handle from settings, falling back to
  the owner profile handle. Merchants without a handle retain their working legacy
  URL and see that an administrator can assign a subdomain; no handle is invented.
- Account and subscription content is unchanged.
- No tests, builds, lint, typechecks or browser validation were run, as requested.
