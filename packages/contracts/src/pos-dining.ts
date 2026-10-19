import type { CursorPage } from './pagination.js';

export interface PosDiningTableSummary {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  capacity: number;
  active: boolean;
  revision: number;
}

export interface PosDiningTableOption extends PosDiningTableSummary {
  occupancy: 'available' | 'occupied';
  sessionId: string | null;
  sessionRevision: number | null;
  openedAt: string | null;
  orderCount: number;
  outstandingTotal: string;
}

export type PosOrderCheckSplitMethod = 'whole' | 'items' | 'equal' | 'custom';

export interface PosOrderCheckSummary {
  id: string;
  position: number;
  amount: string;
  splitMethod: PosOrderCheckSplitMethod;
  allocations: Array<{
    orderLineId: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    amount: string;
  }>;
}

export interface PosDiningSessionSummary {
  id: string;
  branchId: string;
  tableId: string;
  tableCode: string;
  revision: number;
  openedAt: string;
  orderCount: number;
  outstandingTotal: string;
  orders: Array<{
    id: string;
    total: string;
    currency: string;
    status: string;
    revision: number;
    createdAt: string;
    lines: Array<{
      id: string;
      productName: string;
      variantName: string | null;
      quantity: number;
      unitPrice: string;
    }>;
    checks: PosOrderCheckSummary[];
  }>;
}

export type PosDiningTablesPage = CursorPage<PosDiningTableSummary>;

export interface CreatePosDiningTableRequest {
  branchId: string;
  code: string;
  capacity: number;
}

export interface UpdatePosDiningTableRequest {
  revision: number;
  code: string;
  capacity: number;
  active: boolean;
}

export interface MovePosDiningSessionRequest {
  requestId: string;
  revision: number;
  tableId: string;
}

export type SplitPosOrderChecksRequest =
  | {
      requestId: string;
      revision: number;
      method: 'items';
      checks: Array<{
        lines: Array<{ orderLineId: string; quantity: number }>;
      }>;
    }
  | {
      requestId: string;
      revision: number;
      method: 'equal';
      checkCount: number;
    }
  | {
      requestId: string;
      revision: number;
      method: 'custom';
      amounts: string[];
    };

export interface SplitPosOrderChecksResponse {
  orderId: string;
  revision: number;
  checks: PosOrderCheckSummary[];
}
