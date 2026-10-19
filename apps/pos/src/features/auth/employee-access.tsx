import {
  hasPosEmployeePermission,
  posEmployeeHome,
  type PosEmployeePermission,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import type { ReactNode } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';

export function EmployeeAccess({
  permission,
  children,
}: {
  permission: PosEmployeePermission;
  children: ReactNode;
}) {
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
  return hasPosEmployeePermission(employee, permission) ? (
    children
  ) : (
    <Navigate to={posEmployeeHome(employee)} replace />
  );
}

export function EmployeeAccessNotice() {
  const { employee } = useOutletContext<{ employee: PosEmployeeSession }>();
  const { locale } = useLocale();
  const home = posEmployeeHome(employee);
  if (home !== '/access') return <Navigate to={home} replace />;
  return (
    <p className="p-5" role="status">
      {locale === 'ar'
        ? 'لم يتم تعيين صلاحيات تشغيلية لهذا الحساب. تواصل مع مالك الحساب.'
        : 'No operational permissions are assigned to this account. Contact the account owner.'}
    </p>
  );
}
