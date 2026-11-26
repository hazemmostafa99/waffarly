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
    'approve_discounts',
    'approve_refunds',
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

/** Drops unknown or repeated values and returns the permissions in a stable order. */
export function normalizePosEmployeePermissions(
  permissions: readonly string[],
): PosEmployeePermission[] {
  const knownPermissions = new Set<string>(POS_EMPLOYEE_PERMISSIONS);
  const normalized = new Set<PosEmployeePermission>();
  for (const permission of permissions) {
    if (knownPermissions.has(permission)) normalized.add(permission as PosEmployeePermission);
  }
  return [...normalized].sort();
}

/**
 * The permissions a role starts with before the owner adds or removes any.
 * Cashiers, supervisors and employees without a role also start with the
 * original kitchen grants, matching how those accounts were created before.
 */
export function defaultPosEmployeePermissions(
  role: PosEmployeeRole | null,
): PosEmployeePermission[] {
  const withKitchen = role === null || role === 'cashier' || role === 'supervisor';
  return normalizePosEmployeePermissions([
    ...(role ? POS_EMPLOYEE_ROLE_PERMISSIONS[role] : []),
    ...(withKitchen ? POS_LEGACY_EMPLOYEE_PERMISSIONS : []),
  ]);
}

/**
 * Returns an employee's effective permissions. The saved list is the exact set
 * the owner chose; the role only decides which defaults the owner started from.
 * Migration 20261126160000_explicit_employee_permissions stored the previous
 * role-based result for every existing employee.
 */
export function resolvePosEmployeePermissions(
  _role: PosEmployeeRole | null,
  savedPermissions: readonly string[],
): PosEmployeePermission[] {
  return normalizePosEmployeePermissions(savedPermissions);
}

/**
 * Read access implied by operational grants: selling needs to see orders and
 * receipts, and kitchen work needs to see orders.
 */
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
  if (hasPosEmployeePermission(employee, 'view_orders')) return '/kitchen';
  if (hasPosEmployeePermission(employee, 'view_inventory')) return '/inventory';
  if (hasPosEmployeePermission(employee, 'view_receipts')) return '/orders';
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
  /** Same as `permissions`; kept for older dashboard builds. */
  savedPermissions?: PosEmployeePermission[];
  active: boolean;
  revision: number;
  branch: PosEmployeeBranch;
  createdAt: string;
  updatedAt: string;
}

export interface PosEmployeeSession {
  id: string;
  merchantId: string;
  /** This operator is linked to the merchant owner account, not a staff login. */
  owner?: boolean;
  username: string;
  displayName: string;
  role: PosEmployeeRole | null;
  permissions: PosEmployeePermission[];
  branch: PosEmployeeBranch;
  /** Stable browser identity used by POS sessions. Older in-process actors may omit it. */
  deviceId?: string;
  /** The single cashier register paired with this browser, or null during first-time setup. */
  deviceRegister?: PosEmployeeRegister | null;
}

export interface PosEmployeeRegister {
  id: string;
  branchId: string;
  name: string;
}

/** Cashiers sign in as "<store subdomain>.<username>", e.g. "ahmed-cafe.ali". */
export interface PosLoginRequest {
  login: string;
  password: string;
}

export interface CreatePosEmployeeRequest {
  username: string;
  displayName: string;
  password: string;
  role?: PosEmployeeRole | null;
  /** Exact permissions to grant. Omitted: the role's default permissions. */
  permissions?: PosEmployeePermission[];
  branchId: string;
}

export interface UpdatePosEmployeeRequest {
  revision: number;
  displayName: string;
  active: boolean;
  role?: PosEmployeeRole | null;
  /** Exact permissions to grant. Omitted: unchanged, or the new role's defaults when the role changes. */
  permissions?: PosEmployeePermission[];
  branchId: string;
  password?: string | undefined;
}
