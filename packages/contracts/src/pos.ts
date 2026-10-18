export const POS_LEGACY_EMPLOYEE_PERMISSIONS = [
  'accept_recipe_orders',
  'start_preparation',
] as const;

export const POS_EMPLOYEE_ROLES = ['cashier', 'supervisor'] as const;
export type PosEmployeeRole = (typeof POS_EMPLOYEE_ROLES)[number];

export function isPosEmployeeRole(value: string | null): value is PosEmployeeRole {
  return value !== null && (POS_EMPLOYEE_ROLES as readonly string[]).includes(value);
}

export const POS_EMPLOYEE_ROLE_PERMISSIONS = {
  cashier: ['open_register_shift', 'sell'],
  supervisor: [
    'open_register_shift',
    'sell',
    'approve_discounts',
    'approve_voids',
    'approve_refunds',
  ],
} as const satisfies Record<PosEmployeeRole, readonly string[]>;

export const POS_EMPLOYEE_PERMISSIONS = [
  ...POS_LEGACY_EMPLOYEE_PERMISSIONS,
  'open_register_shift',
  'sell',
  'approve_discounts',
  'approve_voids',
  'approve_refunds',
] as const;

export type PosEmployeePermission = (typeof POS_EMPLOYEE_PERMISSIONS)[number];

export function resolvePosEmployeePermissions(
  role: PosEmployeeRole | null,
  savedPermissions: readonly string[],
): PosEmployeePermission[] {
  const knownPermissions = new Set<string>(POS_EMPLOYEE_PERMISSIONS);
  const resolved = new Set<PosEmployeePermission>();
  for (const permission of savedPermissions) {
    if (knownPermissions.has(permission)) resolved.add(permission as PosEmployeePermission);
  }
  if (role) {
    for (const permission of POS_EMPLOYEE_ROLE_PERMISSIONS[role]) {
      resolved.add(permission as PosEmployeePermission);
    }
  }
  return [...resolved].sort();
}

export interface PosEmployeeBranch {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface PosEmployeeSummary {
  id: string;
  username: string;
  displayName: string;
  role: PosEmployeeRole | null;
  permissions: PosEmployeePermission[];
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
  role: PosEmployeeRole | null;
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
  role?: PosEmployeeRole | null;
  branchIds: string[];
}

export interface UpdatePosEmployeeRequest {
  revision: number;
  displayName: string;
  active: boolean;
  role?: PosEmployeeRole | null;
  branchIds: string[];
  password?: string | undefined;
}
