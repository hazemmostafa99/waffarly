# Super Admin design system

Super Admin uses a compact layout by default. The source of truth is
`apps/super-admin/src/admin-design-system.css`, loaded by `main.tsx` and scoped to
the authenticated `.admin-workspace`. Other applications and login screens keep
their existing presentation.

## Tokens

| Purpose                         | Token                                                                                      | Desktop             | Mobile (600px and below)            |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------- | ----------------------------------- |
| Spacing scale                   | `--admin-space-1` through `--admin-space-4`                                                | 4 / 8 / 12 / 16px   | Same                                |
| Content padding                 | `--admin-page-padding`                                                                     | 16px                | 12px                                |
| Section gap                     | `--admin-section-gap`                                                                      | 12px                | 12px                                |
| Panel padding                   | `--admin-panel-padding`                                                                    | 12px                | 12px                                |
| Control height                  | `--admin-control-height`                                                                   | 34px                | 44px                                |
| Header minimum height           | `--admin-header-height`                                                                    | 56px                | Wraps as needed                     |
| Table cell padding              | `--admin-cell-padding-block` / `--admin-cell-padding-inline`                               | 8 / 12px            | Same                                |
| Panel / control radius          | `--admin-radius` / `--admin-radius-control`                                                | 12 / 8px            | Same                                |
| Body / label / caption / metric | `--admin-font-body` / `--admin-font-label` / `--admin-font-caption` / `--admin-font-value` | 13 / 12 / 11 / 22px | Fields use 16px to avoid focus zoom |

Colors and fonts continue to use the existing Waffarly theme. Do not shrink the
root font size or apply browser/CSS zoom to increase density.

## Reusable primitives

- `admin-content`: full available content width with responsive page padding.
- `admin-page`: top-level grid with standard section gaps.
- `admin-stack`: standard gap on an existing grid or flex layout.
- `admin-toolbar`: wrapping action row above page content.
- `admin-panel` / `admin-panel-flush`: padded or unpadded surfaces, using shared
  radii and shadows. Use the flush variant for tables and separately padded sections.
- `admin-section`: padding inside a flush panel, form section, or dialog.
- `admin-table`: semantic table with consistent compact cells. The shared
  `DataTable` component receives the same styling automatically inside Super Admin.
- `admin-table-scroll`: keyboard-focusable horizontal scrolling region for wide
  tables; label the region and keep scrolling inside the panel.
- `admin-inline-note`: supporting information without a large standalone banner.
- `admin-dialog`: compact shared dialog header and close control. Use `admin-section`
  for its content and retain the shared dialog's focus and Escape behavior.
- `CompactStatCard`: horizontal icon, label, helper, and value, replacing stacked
  metric cards.

Shared `Button`, `Input`, and native selects inherit control tokens inside the
workspace, including forms and native dialogs. Preserve focus indicators, disabled
states, labels, and error messages. Mobile navigation and controls retain 44px
targets. Never force a fixed table row height: names, translated labels, and
multiline contact information must remain readable.

Summary grids use two columns on narrow mobile screens. Their optional helper
copy is hidden there so labels and values stay visible without stacking a long
introduction above the records. Search spans both filter columns; secondary
filters share the next row.

## Page patterns

The current page title belongs in `AdminTopbar`. `PageHeader` registers the title
and renders only the action toolbar; do not add another page title or introduction.

Use tables for records compared across consistent fields. Plans show name, status,
monthly price, each prepaid term, and Edit in one row. A missing term is shown as
an em dash; plan descriptions render only when provided. Preserve the ability to
create, refresh, and edit plans. Use visual cards for template artwork and similar
content that benefits from a preview, with token-based padding.

Subscription screens consume the same tokens in their feature stylesheet rather
than introducing another spacing scale. New pages should reuse these primitives
instead of adding large page-specific padding, gaps, or minimum heights.

## Verification

Check English and Arabic, desktop and narrow mobile widths, long names, and both
populated and empty tables. Verify create/edit/navigation/filter actions, one
header heading, keyboard-accessible table scrolling, and no page-wide horizontal
overflow. Check populated lists at an ordinary viewport height to confirm that
records and their actions remain visible without excessive introductory space.
