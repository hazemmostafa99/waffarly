export type StaffPayBasis = 'monthly' | 'daily';
export type StaffAttendanceStatus = 'present' | 'absent' | 'leave' | 'rest';
export type PayrollRunStatus = 'draft' | 'approved' | 'paid';
export type PayrollAdjustmentKind = 'addition' | 'deduction';

export interface StaffPayRateSummary {
  id: string;
  effectiveDate: string;
  basis: StaffPayBasis;
  amount: string;
}

export interface StaffMemberSummary {
  id: string;
  employeeNumber: string | null;
  displayName: string;
  jobTitle: string;
  phone: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  revision: number;
  branch: { id: string; name: string };
  posEmployee: { id: string; username: string } | null;
  payRates: StaffPayRateSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffAttendanceEntry {
  id: string;
  staffMemberId: string;
  attendanceDate: string;
  status: StaffAttendanceStatus;
  updatedBy: string;
  updatedAt: string;
}

export interface AttendanceMonthSummary {
  month: string;
  status: 'draft' | 'approved';
  approvedBy: string | null;
  approvedAt: string | null;
  entries: StaffAttendanceEntry[];
}

export interface PayrollAdjustmentSummary {
  id: string;
  staffMemberId: string;
  kind: PayrollAdjustmentKind;
  amount: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface AdvanceRepaymentPreview {
  advanceId: string;
  amount: string;
  remainingBalance: string;
}

export interface PayrollEmployeePreview {
  staffMemberId: string;
  employeeName: string;
  branchName: string;
  branchId: string;
  payBasis: StaffPayBasis;
  presentDays: number;
  basePay: string;
  additions: string;
  deductions: string;
  advanceDeduction: string;
  netDue: string;
  adjustments: PayrollAdjustmentSummary[];
  advanceRepayments: AdvanceRepaymentPreview[];
}

export interface PayrollLineSummary extends PayrollEmployeePreview {
  id: string;
  paidAmount: string;
  remainingAmount: string;
  payments: Array<{ id: string; amount: string; paidAt: string; reason: string }>;
}

export interface PayrollRunSummary {
  id: string;
  month: string;
  status: PayrollRunStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  lines: PayrollLineSummary[];
  totalDue: string;
  totalPaid: string;
  totalOutstanding: string;
}

export interface StaffAdvanceSummary {
  revision: number;
  cancelledAt: string | null;
  id: string;
  staffMemberId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  amount: string;
  installmentAmount: string;
  firstInstallmentMonth: string;
  reason: string;
  repaidAmount: string;
  remainingBalance: string;
  createdAt: string;
}

export interface MerchantExpenseSummary {
  id: string;
  branchId: string;
  branchName: string;
  incurredOn: string;
  category: string;
  amount: string;
  description: string;
  paidAmount: string;
  remainingAmount: string;
  revision: number;
  receiptAvailable: boolean;
  createdAt: string;
}

export interface CreateStaffMemberRequest {
  employeeNumber?: string | null;
  displayName: string;
  jobTitle: string;
  phone?: string | null;
  branchId: string;
  posEmployeeId?: string | null;
  startDate: string;
  payBasis: StaffPayBasis;
  payAmount: string;
}

export interface UpdateStaffMemberRequest {
  revision: number;
  employeeNumber?: string | null;
  displayName: string;
  jobTitle: string;
  phone?: string | null;
  branchId: string;
  posEmployeeId?: string | null;
  startDate: string;
  endDate?: string | null;
  active: boolean;
}

export interface CreateStaffPayRateRequest {
  effectiveDate: string;
  basis: StaffPayBasis;
  amount: string;
}

export interface SetStaffAttendanceRequest {
  branchId: string;
  staffMemberId: string;
  attendanceDate: string;
  status: StaffAttendanceStatus | null;
  reason: string;
}

export interface CreatePayrollAdjustmentRequest {
  staffMemberId: string;
  kind: PayrollAdjustmentKind;
  amount: string;
  reason: string;
}

export interface CreateStaffAdvanceRequest {
  requestId: string;
  staffMemberId: string;
  safeId: string;
  amount: string;
  installmentAmount: string;
  firstInstallmentMonth: string;
  reason: string;
}

export interface RecordPayrollPaymentRequest {
  requestId: string;
  safeId: string;
  amount: string;
  reason: string;
}

export interface CreateMerchantExpenseRequest {
  branchId: string;
  incurredOn: string;
  category: string;
  amount: string;
  description: string;
}

export interface UpdateMerchantExpenseRequest extends CreateMerchantExpenseRequest {
  revision: number;
}

export interface ExpenseMonthSummary {
  month: string;
  incurredAmount: string;
  paidDuringMonth: string;
  outstandingAmount: string;
}

export interface RecordExpensePaymentRequest {
  requestId: string;
  safeId: string;
  amount: string;
  reason: string;
}

export interface CancelStaffAdvanceRequest {
  requestId: string;
  revision: number;
  correctionReason: string;
}

export interface UpdateStaffAdvanceRequest extends CancelStaffAdvanceRequest {
  amount: string;
  installmentAmount: string;
  firstInstallmentMonth: string;
  reason: string;
}
