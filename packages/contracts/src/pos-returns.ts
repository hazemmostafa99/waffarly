export interface RecordPosItemReturnRequest {
  requestId: string;
  branchId: string;
  reason: string;
  lines: Array<{ orderLineId: string; quantity: number }>;
  approval?: { username: string; password: string } | undefined;
}

export interface PosItemReturnLine {
  orderLineId: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  disposition: 'waste';
  unitPrice: string;
  amount: string;
}

export interface PosItemReturnSummary {
  id: string;
  requestId: string;
  returnNumber: string;
  orderId: string;
  amount: string;
  currency: 'EGP';
  reason: string;
  issuedAt: string;
  createdByEmployeeId: string;
  approvedByEmployeeId: string | null;
  issuedBy: string;
  approvedBy: string | null;
  lines: PosItemReturnLine[];
}

export interface PosOrderReturnsState {
  orderId: string;
  orderReference: string;
  orderStatus: string;
  eligible: boolean;
  items: Array<{
    orderLineId: string;
    productName: string;
    variantName: string | null;
    selections: string[];
    soldQuantity: number;
    returnedQuantity: number;
    returnableQuantity: number;
    unitPrice: string;
  }>;
  returns: PosItemReturnSummary[];
}

export interface RecordPosItemReturnResponse {
  orderId: string;
  return: PosItemReturnSummary;
  state: PosOrderReturnsState;
}

export interface OwnerPosItemReturnReportRow {
  id: string;
  returnNumber: string;
  orderId: string;
  orderReference: string;
  branchId: string;
  branchName: string;
  fulfillmentType: 'dine_in' | 'takeaway' | 'delivery' | 'unknown';
  issuedAt: string;
  reason: string;
  referenceValue: string;
  currency: 'EGP';
  issuedBy: string;
  approvedBy: string | null;
  lines: Array<{
    productName: string;
    variantName: string | null;
    quantity: number;
    disposition: 'waste';
    referenceValue: string;
  }>;
}

export interface OwnerPosItemReturnReportsQuery {
  from: string;
  to: string;
  branchId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}
