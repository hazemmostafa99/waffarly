export type OwnerPosOperationsReport = {
  from: string;
  to: string;
  branchId: string | null;
  orders: {
    placedCount: number;
    cancelledCount: number;
    acceptedCount: number;
    completedCount: number;
    paidCount: number;
    value: string;
    outstanding: string;
  };
  checks: { settledCount: number };
  collections: { cash: string; terminal: string; total: string };
  refunds: { cash: string; terminal: string; total: string };
  netCollected: string;
  deliveryCash?: { customerCollections: string; drawerReceipts: string };
  preparation: {
    acceptedToStartSeconds: number | null;
    startToReadySeconds: number | null;
  };
  cashierActivity: Array<{
    deliveryCashReceived?: string;
    employeeId: string | null;
    employeeName: string | null;
    ordersOpened: number;
    cancelledOrders: number;
    orderValue: string;
    paymentCount: number;
    collections: { cash: string; terminal: string; total: string };
    refundCount: number;
    refunds: { cash: string; terminal: string; total: string };
    netCollected: string;
  }>;
};
