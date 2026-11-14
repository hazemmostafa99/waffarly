# Working on Orders

Follow the repository and API instructions. Orders is one business module with
application-specific HTTP entry points and responsibility-specific implementation
folders. Read README.md for the current ownership map before adding a file.

- Start each TypeScript file with one or two plain-English sentences explaining
  what it does for the customer or staff member. Avoid describing imports,
  frameworks or implementation patterns in that introduction.
- Use short numbered comments for meaningful steps in longer commands. Explain
  business intent and important ordering decisions; do not comment every line.
- Name a file/function for the operation or responsibility. Keep rules, queries
  and response mapping with the feature that owns them.
- Keep HTTP actors and request parsing in the appropriate HTTP entry point.
  Separate owner and cashier controllers even when their URLs share a prefix.
- Keep the active transaction explicit when calling helpers. Preserve existing
  lock order, tenant/branch scope, retry identity, authorization order and saved
  financial/stock snapshots during structural changes.
- Keep existing application service methods where callers need them, but put
  substantial independent operations in the responsible folder rather than
  growing a catch-all service.
- Preserve payment-versus-item-return semantics and customer-account-versus-
  merchant-customer association boundaries.
- Follow the root manual-QA preference. Formatting is not evidence of runtime
  correctness; report acceptance status accurately.
