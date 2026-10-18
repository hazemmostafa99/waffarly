export interface PosRegisterSummary {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  active: boolean;
  revision: number;
}

export interface PosRegisterOption {
  id: string;
  branchId: string;
  name: string;
}

export interface PosShiftSummary {
  id: string;
  branchId: string;
  registerId: string;
  registerName: string;
  openedByEmployeeId: string;
  openedByName: string;
  openRequestId: string;
  openingFloat: string;
  currency: 'EGP';
  openedAt: string;
  status: 'open';
}

export interface CreatePosRegisterRequest {
  branchId: string;
  name: string;
}

export interface UpdatePosRegisterRequest {
  revision: number;
  name: string;
  active: boolean;
}

export interface OpenPosShiftRequest {
  registerId: string;
  requestId: string;
  openingFloat: string;
}
