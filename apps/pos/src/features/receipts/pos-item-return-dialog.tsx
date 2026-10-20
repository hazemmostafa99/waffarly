import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PosItemReturnSummary, RecordPosItemReturnRequest } from '@waffarly/contracts';
import { Dialog, Input, useLocale } from '@waffarly/ui';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePosWorkspaceStore, type PendingPosItemReturn } from '../../app/pos-workspace-store.js';
import { PosButton } from '../../components/pos-button.js';
import { ApiError } from '../../lib/api-client.js';
import { getPosOrderReturns, posOrderReturnsKey, recordPosItemReturn } from './pos-returns.api.js';

export function PosItemReturnDialog({
  merchantId,
  employeeId,
  branchId,
  orderId,
  requiresApproval,
  onClose,
}: {
  merchantId: string;
  employeeId: string;
  branchId: string;
  orderId: string;
  requiresApproval: boolean;
  onClose: () => void;
}) {
  const { t, errorText, formatDate, formatNumber } = useLocale();
  const queryClient = useQueryClient();
  const queryKey = posOrderReturnsKey(merchantId, orderId);
  const savePendingItemReturn = usePosWorkspaceStore((state) => state.savePendingItemReturn);
  const removePendingItemReturn = usePosWorkspaceStore((state) => state.removePendingItemReturn);
  const storedCommand = usePosWorkspaceStore((state) =>
    state.workspace?.merchantId === merchantId && state.workspace.employeeId === employeeId
      ? (state.workspace.pendingItemReturns[orderId] ?? null)
      : null,
  );
  const [pendingCommand, setPendingCommand] = useState<PendingPosItemReturn | null>(storedCommand);
  const [reason, setReason] = useState(storedCommand?.request.reason ?? '');
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      storedCommand?.request.lines.map((line) => [line.orderLineId, String(line.quantity)]) ?? [],
    ),
  );
  const [approvalUsername, setApprovalUsername] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedReturn, setSavedReturn] = useState<PosItemReturnSummary | null>(null);

  useEffect(() => {
    if (!storedCommand || pendingCommand) return;
    setPendingCommand(storedCommand);
    setReason(storedCommand.request.reason);
    setQuantities(
      Object.fromEntries(
        storedCommand.request.lines.map((line) => [line.orderLineId, String(line.quantity)]),
      ),
    );
  }, [pendingCommand, storedCommand]);

  const stateQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPosOrderReturns(orderId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const returnState = stateQuery.data;
  const pendingResult = useMemo(
    () =>
      returnState?.returns.find(
        (itemReturn) => itemReturn.requestId === pendingCommand?.request.requestId,
      ),
    [pendingCommand?.request.requestId, returnState?.returns],
  );

  useEffect(() => {
    if (!pendingCommand || !pendingResult) return;
    removePendingItemReturn(merchantId, employeeId, orderId, pendingCommand.request.requestId);
    setPendingCommand(null);
    setSavedReturn(pendingResult);
  }, [employeeId, merchantId, orderId, pendingCommand, pendingResult, removePendingItemReturn]);

  const mutation = useMutation({
    mutationFn: ({
      command,
      approval,
    }: {
      command: PendingPosItemReturn;
      approval?: { username: string; password: string };
    }) =>
      recordPosItemReturn(orderId, {
        ...command.request,
        ...(approval ? { approval } : {}),
      }),
    onSuccess: async (response, { command }) => {
      removePendingItemReturn(merchantId, employeeId, orderId, command.request.requestId);
      setPendingCommand(null);
      setApprovalPassword('');
      setSavedReturn(response.return);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: async (error, { command }) => {
      setApprovalPassword('');
      if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        removePendingItemReturn(merchantId, employeeId, orderId, command.request.requestId);
        setPendingCommand(null);
        await queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  function buildCommand(): PendingPosItemReturn | null {
    if (!returnState || !returnState.eligible || !reason.trim()) return null;
    const lines = returnState.items.flatMap((item) => {
      const raw = quantities[item.orderLineId]?.trim() ?? '';
      if (!raw) return [];
      const quantity = Number(raw);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.returnableQuantity)
        return [];
      return [{ orderLineId: item.orderLineId, quantity }];
    });
    if (!lines.length || !quantitiesValid) return null;
    const request: Omit<RecordPosItemReturnRequest, 'approval'> = {
      requestId: crypto.randomUUID(),
      branchId,
      reason: reason.trim(),
      lines,
    };
    return { branchId, request };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const command = pendingCommand ?? buildCommand();
    if (!command) return;
    try {
      savePendingItemReturn(merchantId, employeeId, orderId, command);
      setPendingCommand(command);
      setSaveError('');
      mutation.mutate({
        command,
        ...(requiresApproval
          ? { approval: { username: approvalUsername.trim(), password: approvalPassword } }
          : {}),
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : t('Could not save this item return safely.'),
      );
    }
  }

  const branchMismatch = Boolean(pendingCommand && pendingCommand.branchId !== branchId);
  const quantitiesValid = Boolean(
    returnState?.items.length &&
    returnState.items.some((item) => Boolean(quantities[item.orderLineId]?.trim())) &&
    returnState.items.every((item) => {
      const raw = quantities[item.orderLineId]?.trim() ?? '';
      if (!raw) return true;
      const quantity = Number(raw);
      return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= item.returnableQuantity;
    }),
  );
  const formValid = Boolean(
    pendingCommand || (returnState?.eligible && reason.trim().length >= 2 && quantitiesValid),
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={savedReturn ? t('Item return recorded') : t('Record item return')}
      description={t(
        'Record returned items against the original sale. This does not refund money.',
      )}
      closeLabel={t('Close')}
      className="flex max-h-[calc(100dvh-20px)] flex-col overflow-hidden"
    >
      {savedReturn ? (
        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 text-sm sm:p-5">
          <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 p-3">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="m-0 font-semibold">{t('Item return recorded')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <bdi dir="ltr">{savedReturn.returnNumber}</bdi> ·{' '}
                {formatDate(savedReturn.issuedAt, true)}
              </p>
            </div>
          </div>
          <ReturnSummary itemReturn={savedReturn} t={t} formatNumber={formatNumber} />
          <div className="flex justify-end">
            <PosButton type="button" variant="solid" onClick={onClose}>
              {t('Close')}
            </PosButton>
          </div>
        </div>
      ) : (
        <form className="grid min-h-0 gap-4 overflow-y-auto p-4 text-sm sm:p-5" onSubmit={submit}>
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning-foreground">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="m-0 text-xs leading-relaxed">
              {t(
                'Returned items are recorded as waste. The original receipt, payment, and stock are unchanged. Use the refund action separately to return money.',
              )}
            </p>
          </div>

          {stateQuery.isLoading ? (
            <p className="m-0 text-muted-foreground" role="status">
              {t('Loading returnable items...')}
            </p>
          ) : branchMismatch ? (
            <p
              className="m-0 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
              role="alert"
            >
              {t(
                'This saved item return belongs to another branch. Switch to its original branch before retrying.',
              )}
            </p>
          ) : pendingCommand ? (
            <div
              className="grid gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs"
              role="status"
            >
              <strong>
                {t(
                  'An item return request is saved. Retry the exact request; supervisor credentials are never saved.',
                )}
              </strong>
              {pendingCommand.request.lines.map((line) => {
                const item = returnState?.items.find(
                  (candidate) => candidate.orderLineId === line.orderLineId,
                );
                return (
                  <span key={line.orderLineId}>
                    {item?.productName ?? t('Original sale item')} × {formatNumber(line.quantity)}
                  </span>
                );
              })}
              <span>{pendingCommand.request.reason}</span>
            </div>
          ) : stateQuery.error ? (
            <p
              className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
              role="alert"
            >
              {errorText(
                stateQuery.error instanceof Error
                  ? stateQuery.error.message
                  : t('Returnable items could not be loaded.'),
              )}
            </p>
          ) : !returnState?.eligible ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {t('Items can only be returned after the order has been handed over.')}
            </div>
          ) : returnState.items.every((item) => item.returnableQuantity === 0) ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {t('All sold item quantities have already been returned.')}
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                {returnState.items.map((item) => (
                  <label
                    key={item.orderLineId}
                    className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
                  >
                    <span className="min-w-0">
                      <strong className="block break-words">{item.productName}</strong>
                      {item.variantName && (
                        <small className="block text-muted-foreground">{item.variantName}</small>
                      )}
                      {item.selections.map((selection) => (
                        <small className="block text-muted-foreground" key={selection}>
                          {selection}
                        </small>
                      ))}
                      <small className="mt-1 block text-muted-foreground">
                        {t('Returnable')}: {formatNumber(item.returnableQuantity)} ·{' '}
                        {formatNumber(Number(item.unitPrice), {
                          style: 'currency',
                          currency: 'EGP',
                        })}{' '}
                        {t('per item')}
                      </small>
                    </span>
                    <span className="grid gap-1 text-xs font-medium text-muted-foreground">
                      {t('Return quantity')}
                      <Input
                        type="number"
                        min={0}
                        max={item.returnableQuantity}
                        step={1}
                        inputMode="numeric"
                        aria-label={`${t('Return quantity')}: ${item.productName}`}
                        value={quantities[item.orderLineId] ?? ''}
                        disabled={Boolean(pendingCommand) || mutation.isPending}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.orderLineId]: event.target.value,
                          }))
                        }
                      />
                    </span>
                  </label>
                ))}
              </div>

              <label className="grid gap-1 text-xs font-medium">
                {t('Item return reason')}
                <Input
                  required
                  minLength={2}
                  maxLength={500}
                  value={reason}
                  disabled={Boolean(pendingCommand) || mutation.isPending}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t('For example: item was damaged')}
                />
              </label>

              {requiresApproval && (
                <fieldset
                  className="grid gap-2 rounded-lg border border-border p-3"
                  disabled={mutation.isPending}
                >
                  <legend className="px-1 text-xs font-semibold">{t('Supervisor approval')}</legend>
                  <p className="m-0 text-xs text-muted-foreground">
                    {t(
                      'Credentials are checked for this action and are never saved on this device.',
                    )}
                  </p>
                  <label className="grid gap-1 text-xs">
                    {t('Supervisor username')}
                    <Input
                      autoComplete="username"
                      required
                      value={approvalUsername}
                      onChange={(event) => setApprovalUsername(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    {t('Supervisor password')}
                    <Input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={approvalPassword}
                      onChange={(event) => setApprovalPassword(event.target.value)}
                    />
                  </label>
                </fieldset>
              )}
            </>
          )}

          {saveError && (
            <p className="m-0 text-sm text-destructive" role="alert">
              {t(saveError)}
            </p>
          )}
          {mutation.isError && (
            <p className="m-0 text-sm text-destructive" role="alert">
              {errorText(
                mutation.error instanceof Error
                  ? mutation.error.message
                  : t('The item return could not be recorded.'),
              )}
            </p>
          )}
          {mutation.isError && pendingCommand && (
            <p className="m-0 text-xs text-muted-foreground" role="status">
              {t(
                'An item return request is saved. Retry the exact request; supervisor credentials are never saved.',
              )}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <PosButton
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              {t('Close')}
            </PosButton>
            <PosButton
              type="submit"
              variant="solid"
              disabled={
                mutation.isPending ||
                stateQuery.isFetching ||
                (!pendingCommand && !returnState?.eligible) ||
                branchMismatch ||
                !formValid ||
                (requiresApproval && (!approvalUsername.trim() || !approvalPassword))
              }
            >
              {mutation.isPending
                ? t('Recording item return...')
                : pendingCommand
                  ? t('Retry saved item return')
                  : t('Record item return')}
            </PosButton>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ReturnSummary({
  itemReturn,
  t,
  formatNumber,
}: {
  itemReturn: PosItemReturnSummary;
  t: (value: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  return (
    <article
      className="grid gap-3 rounded-lg border border-border bg-card p-3"
      aria-label={t('Recorded item return')}
    >
      <div className="grid gap-2 text-xs">
        <dl className="m-0 grid gap-2">
          <SummaryRow label={t('Reason')} value={itemReturn.reason} />
          <SummaryRow label={t('Issued by')} value={itemReturn.issuedBy} />
          {itemReturn.approvedBy && (
            <SummaryRow label={t('Approved by')} value={itemReturn.approvedBy} />
          )}
        </dl>
        <div className="grid gap-2 border-t border-dashed border-border pt-2">
          {itemReturn.lines.map((line) => (
            <div key={line.orderLineId} className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words">
                {line.productName} × {formatNumber(line.quantity)} · {t('Waste')}
              </span>
              <bdi dir="ltr" className="shrink-0">
                {formatNumber(Number(line.amount), {
                  style: 'currency',
                  currency: itemReturn.currency,
                })}
              </bdi>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-2 text-xs">
        <span>{t('Reference value only — no money was refunded.')}</span>
        <strong className="shrink-0">
          <bdi dir="ltr">
            {formatNumber(Number(itemReturn.amount), {
              style: 'currency',
              currency: itemReturn.currency,
            })}
          </bdi>
        </strong>
      </div>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <RotateCcw size={14} aria-hidden="true" />
        {t('This record does not replace the original receipt.')}
      </span>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 break-words text-end">{value}</dd>
    </div>
  );
}
