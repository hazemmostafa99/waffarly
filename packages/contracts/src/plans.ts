export type PlanCurrency = 'EGP' | 'USD' | 'EUR';

export interface MonthlyPlanSettings {
  name: string;
  description: string;
  /** Decimal amount, e.g. "250.00". Never a floating-point JSON number. */
  monthlyPrice: string;
  currency: PlanCurrency;
  billingInterval: 'monthly';
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
