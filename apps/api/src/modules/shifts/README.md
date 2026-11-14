# Shifts ownership

- `registers/` lists, creates and updates cashier registers. Register changes
  retain their original tenant scope, revision checks and transaction boundaries.
- `shift-records.ts` defines saved record selections and the types they produce.
- `shift.mapper.ts` prepares register, shift, cash movement and close-report
  responses, including saved retry responses.
- `sessions/` owns opening, closing, saved close retries and current shift reads.
- `reconciliation/` calculates cash/payment facts and previews shift closing.
- `cash-movements/` owns manual drawer activity and the transaction-aware helpers
  used by order payments and refunds.
- `reports/` reads saved close reports; `access/` checks current branch permissions
  and supervisor approvals.
- `custody/` owns safes, drawers, handoffs and receipt workflows. Its cash-write
  helper preserves the existing transaction/conflict behavior.
- `http/owner` and `http/pos` contain the separate owner and cashier endpoints.
- `shifts.service.ts` and `cash-custody.service.ts` retain their application APIs
  and delegate to the responsible operation. Constructors remain compatible.
- `cash-drawer-ledger.ts` and `delivery-reconciliation.ts` calculate cash facts.

Keep locks, replay checks and related financial writes in their original
transaction. Functions receiving a transaction must not replace it with the root
database client. The public reconciliation export remains available for callers.

Verification is recorded in `docs/architecture/API_REFACTOR_PROGRESS.md` at the
repository root. Database fixtures remove their own subscription records before
deleting test merchants; no database reset or schema migration is part of this work.
