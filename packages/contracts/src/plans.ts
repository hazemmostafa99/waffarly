export type PlanCurrency = 'EGP';
export type SubscriptionMonths = 1 | 3 | 6 | 12 | 24;
export interface PlanTerm {
  months: Exclude<SubscriptionMonths, 1>;
  price: string;
}

export interface MonthlyPlanSettings {
  name: string;
  description: string;
  /** Decimal amount, e.g. "250.00". Never a floating-point JSON number. */
  monthlyPrice: string;
  currency: PlanCurrency;
  billingInterval: 'monthly';
  /** Optional longer prepaid terms. The one-month price remains monthlyPrice. */
  terms?: PlanTerm[] | undefined;
  available?: boolean | undefined;
}

export interface CreateMonthlyPlanRequest extends MonthlyPlanSettings {
  /** Reuse for retries of the same creation. */
  requestId: string;
}

export interface UpdateMonthlyPlanRequest extends MonthlyPlanSettings {
  revision: number;
}

export interface MonthlyPlanSummary extends MonthlyPlanSettings {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
