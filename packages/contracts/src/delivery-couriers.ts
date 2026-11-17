export interface DeliveryCourierBranch {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface DeliveryCourierSummary {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  revision: number;
  branches: DeliveryCourierBranch[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryCourierOption {
  id: string;
  name: string;
}

export interface DeliveryCourierPerformance {
  courierId: string;
  courierName: string;
  active: boolean;
  attemptCount: number;
  deliveredCount: number;
  failedCount: number;
  activeAttemptCount: number;
  successRate: number | null;
  averageDeliveryMinutes: number | null;
}

export interface DeliveryCourierPerformanceReport {
  periodStart: string;
  generatedAt: string;
  items: DeliveryCourierPerformance[];
}

export interface CreateDeliveryCourierRequest {
  name: string;
  phone: string | null;
  branchIds: string[];
}

export interface UpdateDeliveryCourierRequest extends CreateDeliveryCourierRequest {
  revision: number;
  active: boolean;
}
