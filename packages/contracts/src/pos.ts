export const POS_EMPLOYEE_PERMISSIONS = ['accept_recipe_orders', 'start_preparation'] as const;

export type PosEmployeePermission = (typeof POS_EMPLOYEE_PERMISSIONS)[number];

export interface PosEmployeeBranch {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface PosEmployeeSummary {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  revision: number;
  branchIds: string[];
  branches: PosEmployeeBranch[];
  createdAt: string;
  updatedAt: string;
}

export interface PosEmployeeSession {
  id: string;
  merchantId: string;
  username: string;
  displayName: string;
  permissions: PosEmployeePermission[];
  branches: PosEmployeeBranch[];
}

export interface PosLoginRequest {
  storefrontSlug: string;
  username: string;
  password: string;
}

export interface CreatePosEmployeeRequest {
  username: string;
  displayName: string;
  password: string;
  branchIds: string[];
}

export interface UpdatePosEmployeeRequest {
  revision: number;
  displayName: string;
  active: boolean;
  branchIds: string[];
  password?: string | undefined;
}
