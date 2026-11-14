# Super Admin UI Redesign

## Status

- Document status: Active implementation guide
- Product status: Visual redesign of existing approved Super Admin capabilities
- Target application: `apps/super-admin`
- Visual reference: `waffarly_super_admin_ui_kit/Waffarly_Super_Admin_UI`
- Primary implementation language: TypeScript and React

## Objective

Rebuild the Waffarly Super Admin experience page by page using the supplied Arabic RTL UI reference, Tailwind CSS, shadcn/ui-style components, React Router, TanStack React Query, and Zustand.

The result must be responsive, accessible, localized, reusable, and connected to real Waffarly APIs. The reference kit controls visual direction only. Its sample counts, prices, statuses, labels, and workflows do not define product behavior.

## Sources of Truth

When sources disagree, use this priority:

1. Approved Waffarly feature documentation and contracts.
2. Existing API behavior and authorization rules.
3. Existing automated tests.
4. The supplied UI kit for layout and visual styling.
5. Mock content only when clearly marked and isolated from production behavior.

Do not infer new subscription, pricing, suspension, entitlement, audit, or template rules from the screenshots.

## Technical Direction

### Required libraries

- React 19 and TypeScript.
- React Router for URL-driven navigation and nested layouts.
- Tailwind CSS 4 for tokens, responsive layout, and utility styling.
- shadcn/ui conventions for accessible UI primitives.
- TanStack React Query for server state.
- Zustand for small, app-local client state.
- Lucide icons through the existing shadcn configuration.

### State ownership

TanStack React Query owns remote data:

- Authenticated administrator profile.
- Merchants and merchant applications.
- Plans and subscriptions.
- Activities and modules.
- Templates and template details.
- Loading, error, mutation, cache, retry, and invalidation behavior.

Zustand owns client-only UI state:

- Desktop sidebar collapsed state.
- Mobile navigation state.
- Non-shareable table presentation preferences.
- Temporary row selection.
- Dismissible UI notices when they are not server records.

The URL owns navigation and shareable view state:

- Current page and resource identifier.
- Search terms, filters, sorting, and pagination when users may bookmark or share them.
- Selected tab when a direct link is useful.

Do not copy React Query response data into Zustand. Component-local state remains the default for form fields, dialogs, and one-off interactions.

### Query conventions

Keep query keys in each feature or in a small shared query-key factory:

```ts
export const adminQueryKeys = {
  profile: ['admin', 'profile'] as const,
  merchants: (filters: MerchantFilters) => ['admin', 'merchants', filters] as const,
  merchant: (merchantId: string) => ['admin', 'merchants', merchantId] as const,
  plans: ['admin', 'plans'] as const,
  templates: ['admin', 'templates'] as const,
};
```

Mutations must invalidate the smallest relevant query scope and display translated success or error feedback. Authentication failures must continue to redirect protected deep links to `/login` and return users to their requested route after login.

## Proposed File Structure

```text
apps/super-admin/src/
|-- app/
|   |-- providers.tsx
|   |-- router.tsx
|   `-- navigation.ts
|-- layouts/
|   `-- AdminLayout.tsx
|-- components/
|   |-- app-sidebar.tsx
|   |-- app-topbar.tsx
|   |-- page-header.tsx
|   |-- stat-card.tsx
|   |-- filter-bar.tsx
|   |-- status-badge.tsx
|   |-- empty-state.tsx
|   `-- confirm-action-dialog.tsx
|-- features/
|   |-- dashboard/
|   |-- merchants/
|   |-- plans/
|   |-- subscriptions/
|   |-- activities/
|   |-- modules/
|   |-- templates/
|   `-- governance/
|-- hooks/
|-- lib/
|   |-- api-client.ts
|   |-- query-client.ts
|   `-- route-paths.ts
|-- stores/
|   `-- admin-ui-store.ts
`-- styles/
    `-- super-admin.css
```

Generic primitives belong in `packages/ui`. Components composed specifically for the Super Admin belong in `apps/super-admin/src/components`. Feature-specific components, query hooks, schemas, and pages stay inside their feature directory.

## Design Foundation

- Arabic-first RTL layout with a right-side desktop sidebar.
- Preserve the existing localization system and support LTR without duplicating components.
- Cairo is the preferred UI font, with a safe Arabic-capable fallback stack.
- Brand primary: `#00583F`.
- Brand gold: `#E8A12F`.
- Main background: `#FAFBFC`.
- Surface: `#FFFFFF`.
- Text: `#14203E` and secondary `#7384A1`.
- Borders: `#E9EEF2`.
- Success: `#0EA77A`; accent gold: `#E8A12F`; pale gold: `#FFF3DD`.
- KPI tints: mint `#E3F8EC`, gold `#FFF3DD`, blue `#EAF3FF`, and special `#F2EAFB`.
- Danger: `#D54850` with `#FCE8E9`; info: `#2168C8`; input: `#F7F9FB`.
- Spacing scale: 4, 8, 12, 16, 24, and 32 pixels.
- Cards use subtle borders, restrained shadows, and 12-16 pixel radii.
- Keep redesigned Super Admin screens styled with Tailwind utilities and shared shadcn primitives. Legacy CSS may remain only for pages not yet migrated.
- Arabic is a supported interface locale, not only a layout direction: translated labels, document language, RTL layout, and Arabic-capable font fallbacks are required.
- The 1500 by 1035 reference is the desktop comparison target, not a fixed application size.
- Responsive behavior must be intentionally designed for desktop, tablet, and mobile.

The restaurant hero, menu, and offers images are template preview assets. They are not dashboard backgrounds or operational content.

## Shared Component Inventory

### Shared UI primitives

Use or add shadcn/ui-style primitives in `packages/ui`:

- Button
- Card
- Input and Textarea
- Select
- Checkbox and Switch
- Dialog and AlertDialog
- DropdownMenu
- Tabs
- Badge
- Table
- Skeleton
- Tooltip
- Sheet
- Pagination

### Super Admin compositions

- `AdminLayout`: authentication boundary, sidebar, topbar, and outlet.
- `AppSidebar`: route-driven navigation with desktop and mobile variants.
- `PageHeader`: breadcrumb, title, description, and actions.
- `StatCard`: metric, icon, semantic tint, and optional comparison.
- `FilterBar`: search and feature-provided filters.
- `DataTable`: shared table behavior with feature-owned column definitions.
- `StatusBadge`: typed mapping from domain status to visual treatment.
- `EmptyState`: empty, no-results, and unavailable states.
- `ConfirmActionDialog`: accessible confirmation for sensitive mutations.
- `AsyncBoundary`: loading, error, and retry presentation.

Avoid creating a shared component until it is used by at least two pages or represents an established design-system primitive.

## Routes and Page Order

| Order | Route                               | Page                   | Implementation boundary                                                                                                                                                    |
| ----- | ----------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `/dashboard`                        | Platform Overview      | Real aggregate data only; unsupported metrics are omitted.                                                                                                                 |
| 2     | `/merchants`                        | Merchants List         | Existing merchants and applications APIs.                                                                                                                                  |
| 3     | `/merchants/new`                    | Create Merchant        | Existing creation contract and validation.                                                                                                                                 |
| 4     | `/merchants/:merchantId`            | Merchant Details       | Only approved details and actions.                                                                                                                                         |
| 5     | `/plans`                            | Plans Catalog          | Existing plans API; no invented prices or rules.                                                                                                                           |
| 6     | `/plans/new`, `/plans/:planId/edit` | Plan Editor            | Subject to supported API operations.                                                                                                                                       |
| 7     | `/subscriptions`                    | Merchant Subscriptions | Implement only approved subscription behavior.                                                                                                                             |
| 8     | `/activities`                       | Business Activities    | Existing catalog API fields and revision-aware editing; compatibility does not grant access or entitlements.                                                               |
| 9     | `/modules`                          | Modules Matrix         | Compare code-supported activity types with saved catalog associations; keep both distinct from entitlements and permissions.                                               |
| 10    | `/templates`                        | Templates Library      | Existing template API and preview assets; availability adds a design to the merchant selection library but does not publish a storefront.                                  |
| 11    | `/templates/:templateId`            | Template Details       | Derive metadata from the existing templates list (there is no detail endpoint); merchant selection eligibility follows the template activity scope and `available` status. |
| 12    | `/governance`                       | Governance and Audit   | Deferred until its requirements and API are approved.                                                                                                                      |

Additional routes:

- `/login` remains public.
- `/dashboard` is the post-login start page.
- `/` remains a compatibility entry for the existing business management screen.
- `/businesses` redirects to `/merchants`; other supported legacy URLs remain available.
- Unknown dashboard routes recover to the dashboard without bypassing authentication.

## Page Delivery Workflow

For every page:

1. Confirm the approved data and actions from repository documentation and contracts.
2. Identify reusable primitives and feature-specific compositions.
3. Add the route and navigation state.
4. Add typed React Query hooks and mutation invalidation.
5. Implement the page with all loading, error, empty, success, and disabled states.
6. Verify RTL, LTR, keyboard navigation, focus behavior, and responsive layouts.
7. Compare the desktop result with the supplied reference.
8. Add or update route and interaction tests.
9. Run typecheck, lint, build, and relevant Playwright tests.
10. Update `PROGRESS.md` with evidence and remaining work.

## Accessibility Requirements

- Keyboard-accessible navigation, menus, dialogs, tables, and forms.
- Visible focus indicators.
- Correct landmarks, headings, labels, and accessible names.
- Status colors must not be the only source of meaning.
- Destructive operations require explicit confirmation.
- Loading and mutation feedback must use suitable live-region semantics.
- Mobile navigation must trap and restore focus correctly when presented as a sheet.

## Testing Requirements

- Unit or component coverage for state mappings and reusable behavior where valuable.
- Route tests for direct navigation, refresh, back/forward history, redirects, and authentication return paths.
- API mocking for deterministic UI tests.
- Mutation tests for success, validation error, authorization error, and retry behavior.
- Visual checks at the reference desktop size and representative tablet/mobile sizes.
- Existing tests must remain green unless an approved route change requires a deliberate update.

## Definition of Done

The redesign is complete when:

- Approved pages are available through stable routes.
- Shared components and feature boundaries follow this document.
- Server state uses React Query and client UI state uses Zustand according to the ownership rules.
- Screens match the Waffarly visual language without inventing product behavior.
- RTL, localization, responsiveness, accessibility, and error states are verified.
- Typecheck, lint, build, and relevant automated tests pass.
- `PROGRESS.md` contains current evidence for every page.
