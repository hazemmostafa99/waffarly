# Simple HR and expenses

## Purpose

Give a merchant clear workspaces to manage staff, daily attendance,
monthly pay, advances and operating expenses. The owner manages the first release;
employees do not need a new self-service account. Existing POS credentials remain
optional and separate from the employee's HR record.

## First-release screens

1. **Employees** — add and update an employee, assign one active branch, set a
   job title and pay basis, and optionally link an existing POS employee account.
2. **Attendance** — record one status per employee per date and approve the
   month's attendance before it is used for payroll.
3. **Payroll** — review the monthly calculation, enter explained
   additions/deductions, approve a frozen payroll, record full or partial cash
   payments. Advance instalments remain visible in each payroll line.
4. **Staff advances** — independently manage employee advances and instalments.
5. **Expenses** — record a categorized expense, its branch and date, optional
   receipt image, and whether/how much has been paid.

## Merchant navigation

The sidebar uses one level of collapsible groups. Human resources contains
employees (`/staff`), attendance (`/staff/attendance`), payroll (`/staff/payroll`)
and advances (`/staff/advances`). Operating expenses retain `/staff/expenses`
for existing links but appear under Finance alongside cash drawers and safes.
POS credentials appear under Point of sale, separately from HR employee records.
The active page opens its group automatically, including direct detail-page URLs.
HR pages display their own title and description rather than duplicating sidebar
destinations in a tab bar.

The advances screen reads staff and open advances without loading a payroll
month or attendance. Payroll reads its run, attendance and staff without loading
the advances list. Both screens retain the original merchant/user-scoped
`waffarly:hr:payroll:` pending-command key. An uncertain salary payment or advance
can be retried from either screen with its original path, body and request ID.

`GET /owner/payroll?month=YYYY-MM` returns the run or literal JSON `null` with
HTTP 200. The controller explicitly serializes the nullable result because Nest's
default Express handling sends bare null as an empty body, which cannot be parsed
by the dashboard's JSON client. No payroll record is created by this read.
The existing owner guard, merchant scope and calculation/payment rules are unchanged.

### Manual acceptance checklist for navigation changes

- Check Arabic/English labels, RTL/LTR, narrow screens and keyboard group toggles.
- Open each destination directly and follow links; only the matching sidebar
  child should be current, including product edit, stock detail and expense URLs.
- Check a month without payroll: a JSON null response should show the attendance
  prerequisite or create-draft prompt, without an unexpected-error banner.
- Check existing draft and approved payroll views, and loading failures/retry.
- Check advances loading, empty state, branch-safe selection and validation.
- In an authorized disposable scenario, verify an uncertain cash action retains
  its original request ID after moving between advances and payroll. Retrying must
  produce one business record and one safe withdrawal.

These are acceptance steps, not a record of passed browser checks. No automated
checks were run for this change, in accordance with the project's manual-QA preference.

## Employee and pay rules

- An HR employee record is independent from `PosEmployee`. Linking a POS account
  is optional, same-merchant, and one-to-one. An employee can be managed without
  credentials for the dashboard or POS.
- Each employee has one primary branch, a job title, a start date, an optional
  end date, and an active/inactive status. Deactivation retains payroll and
  attendance history.
- Changing an employee's branch after attendance, payroll or advance history is
  recorded is deferred in the first release so prior branch records remain
  accurate. Use a separate HR record for a future transfer workflow.
- The first release supports a monthly or daily base rate, effective-dated rate
  history, and EGP amounts with two decimal places. Rates cannot overlap; a new
  rate applies from its effective date onward.
- A monthly rate is prorated by calendar days for employment start/end dates and
  effective-dated rate changes within the month. Approved absence does not reduce
  a monthly rate automatically. The owner may add a separately explained
  deduction after review.
- A daily rate is multiplied by approved `present` attendance days in the pay
  period. `absent`, `leave`, `rest`, and `unrecorded` dates do not count as paid
  days. The first release does not distinguish paid leave from unpaid leave.
- Attendance dates use the merchant's local calendar date. Each employee has at
  most one attendance entry per date. Missing entries remain `unrecorded`; they
  are never inferred to be absences.
- A payroll period is one calendar month. It must have approved attendance
  before calculation. The payroll draft includes active employees whose work
  dates overlap the period, including employees who left during the month.
- Payroll gross is base pay plus explicit additions; net due is gross less
  explicit deductions and approved advance instalments. Total deductions cannot
  exceed earnings. Tax/social-insurance
  values are not calculated by the first release; if entered, they are reviewed
  manual deductions. Every manual line requires a reason.
- Payroll has `draft`, `approved`, and `paid`-when-fully-settled states.
  Approval stores an immutable calculation snapshot. Payment records may settle
  it in multiple amounts; paid cannot exceed net due. Corrections after approval
  use a documented adjustment rather than editing the frozen calculation.
- Payroll's accounting period is separate from payment date. A later cash
  payment does not change the payroll month to which the staff cost belongs.

## Attendance rules

- The owner records `present`, `absent`, `leave`, or `rest`. An empty date is
  displayed as `unrecorded`.
- An attendance period is approved as one unit after the owner resolves entries
  they intend to include and the selected month has ended in the merchant's
  Cairo calendar. Saving a draft does not make it payroll-ready.
- The owner can correct an entry before attendance-period approval. Attendance
  locks when approved. Corrections needed before payroll approval are recorded as
  explained payroll adjustments; an approved payroll is never rewritten.
- The first release does not calculate lateness, overtime, clock-in/out, device
  punches, shift schedules, or paid-leave balances.

## Advances

- An advance is cash given to one employee, recorded with its date, amount,
  branch, reason, and planned per-period instalment.
- Each disbursement is a cash withdrawal from a safe in the employee's branch.
  The advance record and withdrawal are committed in the same database
  transaction.
- Instalments are proposed in a payroll draft only from the configured start
  month and up to the remaining balance. Approval records the actual repayment
  against that payroll once; it cannot exceed the remaining advance balance or
  payroll net due.
- Open balance is original amount less recorded repayments. It is not an
  expense. A payroll instalment is capped at the employee's remaining net pay
  after the other deductions.

## Expenses and cash

- An expense has an incurred date, category, amount, branch, description, and
  optional receipt image. Initial categories include rent, utilities, supplies,
  maintenance, transport, and other. Categories can be extended by the merchant.
- Recording an expense does not change cash. Each payment is recorded separately
  from a safe in the same branch and links to exactly one expense.
- Employee compensation, advances, and reimbursements cannot be entered again as
  generic expenses. Reimbursement is deferred from the first release; a related
  staff cost uses payroll or a future dedicated reimbursement flow.
- Cash payment and its HR record are written atomically. A retried request ID
  returns the original result and cannot create another cash movement. The safe
  must have sufficient balance. The same cash withdrawal cannot be allocated to
  a supplier invoice, payroll payment, advance or expense more than once.
- HR cash payments use the existing safe ledger. They do not write directly to
  register drawers or shift cash.

## Access, tenant scope, and history

- First-release HR routes are owner-only and derive `merchantId` from the owner
  session. Employee, branch, pay-period, advance, expense, file and safe references
  are checked against that merchant in every operation.
- HR metadata is stored as structured database records. No passwords or bank
  account/payment credentials are collected.
- Receipt images use private tenant-scoped file storage and owner-authorized reads;
  the catalog's public media URLs are not used for receipts.
- Approved payroll, payments, cash movements, attendance changes and advance
  repayments retain creator, timestamp, reason and immutable history. Historical
  records are not deleted when an employee becomes inactive.

## Out of scope

Scheduling, attendance devices, biometrics, overtime rules, leave balances,
automatic payroll tax/social-insurance computation, bank transfer execution,
recruitment, employee self-service, performance reviews, tip pooling,
accounting journal/financial statements, and direct cash-drawer payments.

## Worked examples

1. A daily employee has a rate of EGP 250 and 22 approved `present` days. Base
   pay is EGP 5,500; `leave`, `rest`, and missing days contribute zero.
2. A monthly employee earns EGP 9,000 and works the full month. A separately
   reviewed EGP 300 deduction and EGP 500 advance instalment produce EGP 8,200
   net due. An EGP 4,000 payment leaves EGP 4,200 outstanding.
3. A monthly employee starts on the 16th of a 30-day month with a rate of EGP
   9,000. The first-release proration is 15/30 × EGP 9,000 = EGP 4,500 before
   additions, deductions, and advance instalments.
4. An EGP 2,000 advance with EGP 500 monthly instalments creates a EGP 2,000
   cash withdrawal at disbursement and reduces payroll net due by EGP 500 for
   each approved instalment until the recorded balance reaches zero.

## Advance corrections

Owners can update or cancel advances from the advances table. Cancellation retains
history and excludes the advance from future payroll. The history checkbox shows
settled/cancelled records. Employee and original safe cannot change.

POST /owner/payroll/advances/:id/update accepts requestId, revision, amount,
installmentAmount, firstInstallmentMonth, reason and correctionReason.
POST /owner/payroll/advances/:id/cancel accepts requestId, revision and
correctionReason. Both commands are merchant scoped and idempotent. Immutable
correction rows retain before/after snapshots, actor and reason. Original cash
withdrawals and creation fingerprints remain unchanged.

Increases withdraw the difference, reductions deposit the difference, and
cancellation deposits the full original amount into the original safe. Confirm
only after cash has actually moved. Revision checks and serializable transactions
protect corrections against concurrent edits and payroll approval. Cash movements,
correction history and advance updates commit together. Insufficient cash rejects
an increase. Retrying a request never repeats its cash movement.

After any approved repayment, cancellation, amount changes and first-month changes
are blocked. Only installment and reason can change. Existing payroll snapshots
remain immutable; future repayments retain the existing remaining-balance and
available-pay caps.

Manual QA pending: increase 200 to 300 (withdraw 100), reduce to 150 (deposit 50),
cancel (deposit 150 once), duplicate requests, stale revision, foreign tenants,
insufficient funds, concurrent approval, cancelled history, and installment edits
after repayment. No automated checks were run, following project preference.
