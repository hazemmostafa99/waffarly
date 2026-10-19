import type { PosEmployeeSession } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { useState } from 'react';
import { usePosWorkspaceStore, type PendingPosPayment } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { PosCheckoutDialog } from './pos-checkout-dialog.js';

interface RecoveryTarget {
  orderId: string;
  branchId: string;
}

const EMPTY_PENDING_PAYMENTS: Record<string, PendingPosPayment> = {};

export function PosPaymentRecoveryNotice({ employee }: { employee: PosEmployeeSession }) {
  const { t } = useLocale();
  const pendingPayments = usePosWorkspaceStore((state) =>
    state.workspace?.merchantId === employee.merchantId &&
    state.workspace.employeeId === employee.id
      ? state.workspace.pendingPayments
      : EMPTY_PENDING_PAYMENTS,
  );
  const [recoveryTarget, setRecoveryTarget] = useState<RecoveryTarget | null>(null);
  const assignedBranches = new Map(employee.branches.map((branch) => [branch.id, branch.name]));
  const recoverable = Object.entries(pendingPayments).filter(([, pending]) =>
    assignedBranches.has(pending.branchId),
  );

  return (
    <>
      {recoverable.length > 0 && (
        <section
          aria-label={t('Payments needing confirmation')}
          className="mx-auto mt-4 grid w-full gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 sm:p-4"
          role="alert"
        >
          <div>
            <h2 className="m-0 text-sm font-semibold">{t('Payments need confirmation')}</h2>
            <p className="mb-0 mt-1 text-xs text-muted-foreground">
              {t('The saved payment must be checked before recording another payment.')}
            </p>
          </div>
          <ul className="m-0 grid list-none gap-2 p-0">
            {recoverable.map(([orderId, pending]) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2"
                key={orderId}
              >
                <span className="grid gap-0.5 text-xs">
                  <strong>{t('Order #{{id}}', { id: orderId.slice(0, 8) })}</strong>
                  <span className="text-muted-foreground">
                    {t('Branch: {{branch}}', {
                      branch: assignedBranches.get(pending.branchId) ?? pending.branchId,
                    })}
                  </span>
                </span>
                <PosButton
                  type="button"
                  size="sm"
                  variant="solid"
                  onClick={() => setRecoveryTarget({ orderId, branchId: pending.branchId })}
                >
                  {t('Check saved result')}
                </PosButton>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recoveryTarget && (
        <PosCheckoutDialog
          key={`${recoveryTarget.orderId}:${recoveryTarget.branchId}`}
          branchId={recoveryTarget.branchId}
          employeeId={employee.id}
          merchantId={employee.merchantId}
          orderId={recoveryTarget.orderId}
          onClose={() => setRecoveryTarget(null)}
        />
      )}
    </>
  );
}
