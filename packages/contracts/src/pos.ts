export const POS_LEGACY_EMPLOYEE_PERMISSIONS = [
  'accept_recipe_orders',
  'start_preparation',
] as const;

// Ownership belongs to OwnerAccount and is deliberately not assignable to employees.
export const POS_EMPLOYEE_ROLES = [
  'branch_manager',
  'cashier',
  'inventory_officer',
  'accountant',
  'customer_service',
  'kitchen',
  'supervisor',
] as const;
export type PosEmployeeRole = (typeof POS_EMPLOYEE_ROLES)[number];

export function isPosEmployeeRole(value: string | null): value is PosEmployeeRole {
  return value !== null && (POS_EMPLOYEE_ROLES as readonly string[]).includes(value);
}

export const POS_EMPLOYEE_ROLE_PERMISSIONS = {
  branch_manager: [
    'view_orders',
    'accept_recipe_orders',
    'start_preparation',
    'open_register_shift',
    'sell',
    'view_receipts',
    'view_inventory',
    'approve_shift_close',
    'manage_cash_movements',
  ],
  cashier: ['open_register_shift', 'sell'],
  inventory_officer: ['view_inventory'],
  accountant: ['view_receipts'],
  customer_service: ['view_orders'],
  kitchen: ['view_orders', 'accept_recipe_orders', 'start_preparation'],
  supervisor: [
    'open_register_shift',
    'sell',
    'approve_discounts',
    'approve_voids',
    'approve_refunds',
    'approve_shift_close',
    'manage_cash_movements',
  ],
} as const satisfies Record<PosEmployeeRole, readonly string[]>;

export const POS_EMPLOYEE_PERMISSIONS = [
  ...POS_LEGACY_EMPLOYEE_PERMISSIONS,
  'open_register_shift',
  'sell',
  'approve_discounts',
  'approve_voids',
  'approve_refunds',
  'approve_shift_close',
  'manage_cash_movements',
  'view_orders',
  'view_receipts',
  'view_inventory',
] as const;

export type PosEmployeePermission = (typeof POS_EMPLOYEE_PERMISSIONS)[number];

export function resolvePosEmployeePermissions(
  role: PosEmployeeRole | null,
  savedPermissions: readonly string[],
): PosEmployeePermission[] {
  const knownPermissions = new Set<string>(POS_EMPLOYEE_PERMISSIONS);
  const resolved = new Set<PosEmployeePermission>();
  // Preserve legacy grants only for existing role types. New presets are exact,
  // so moving a cashier to accounting cannot retain sales or kitchen access.
  const legacyGrants = role === null || role === 'cashier' || role === 'supervisor';
  for (const permission of legacyGrants ? savedPermissions : []) {
    if (knownPermissions.has(permission)) resolved.add(permission as PosEmployeePermission);
  }
  if (role) {
    for (const permission of POS_EMPLOYEE_ROLE_PERMISSIONS[role]) {
      resolved.add(permission as PosEmployeePermission);
    }
  }
  return [...resolved].sort();
}

/** Read access implied by historical operational grants remains compatible. */
export function hasPosEmployeePermission(
  employee: Pick<PosEmployeeSession, 'permissions'>,
  permission: PosEmployeePermission,
): boolean {
  if (employee.permissions.includes(permission)) return true;
  if (permission === 'view_orders') {
    return employee.permissions.some((value) =>
      ['accept_recipe_orders', 'start_preparation', 'sell'].includes(value),
    );
  }
  return permission === 'view_receipts' && employee.permissions.includes('sell');
}

export function posEmployeeHome(employee: Pick<PosEmployeeSession, 'permissions'>): string {
  if (hasPosEmployeePermission(employee, 'view_orders')) return '/';
  if (hasPosEmployeePermission(employee, 'view_inventory')) return '/inventory';
  if (hasPosEmployeePermission(employee, 'view_receipts')) return '/receipts';
  return '/access';
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
  /** Stored grants before the role preset; used by the owner's permission preview. */
  savedPermissions?: PosEmployeePermission[];
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
