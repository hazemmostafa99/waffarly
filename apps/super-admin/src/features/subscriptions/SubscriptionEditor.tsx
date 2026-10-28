import { formatSubscriptionMoney } from './subscription-money.js';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Info,
  ReceiptText,
  Store,
} from 'lucide-react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type {
  SubscriptionCommand,
  SubscriptionDetail,
  SubscriptionMonths,
  SubscriptionQuote,
} from '@waffarly/contracts';
import { StatusBadge } from '../../components/StatusBadge.js';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';
import { useMonthlyPlansQuery } from '../plans/plans-queries.js';
import { subscriptionStatusLabels } from './subscription-status.js';
import { availableSubscriptionActions, subscriptionActions } from './subscription-actions.js';
import { SubscriptionHistory } from './SubscriptionHistory.js';

const actionHints: Record<SubscriptionCommand['action'], string> = {
  assign: 'Select a plan without starting paid coverage.',
  activate: 'Start paid coverage after confirming external collection.',
  renew: 'Extend coverage or schedule a different plan for the next period.',
  change: 'Apply a new plan now and credit the unused paid time.',
  suspend: 'Suspension blocks new operations. Paid time continues and the end date does not move.',
  resume: 'Restore access for the remaining paid coverage.',
  cancel:
    'Immediate cancellation ends all remaining coverage. No refund is recorded automatically.',
  'cancel-at-end':
    'Existing prepaid periods remain available until their final end date. Further renewal is blocked.',
  'keep-active': 'Allow renewal again without changing the current paid period.',
};

export function SubscriptionEditor({
  merchantId,
  onClose,
}: {
  merchantId: string;
  onClose: () => void;
}) {
  const { t, errorText, formatDate, formatNumber, locale } = useLocale();
  const formId = useId();
  const client = useQueryClient();
  const plans = useMonthlyPlansQuery();
  const detail = useQuery({
    queryKey: ['subscriptions', 'detail', merchantId],
    queryFn: () => apiRequest<SubscriptionDetail>(`/admin/subscriptions/${merchantId}`),
  });
  const [selectedAction, setAction] = useState<SubscriptionCommand['action'] | null>(null);
  const [selectedPlanId, setPlanId] = useState('');
  const [selectedMonths, setMonths] = useState<SubscriptionMonths | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState(false);
  const retry = useRef<{ key: string; requestId: string } | null>(null);
  const s = detail.data;
  const availableActions = s ? availableSubscriptionActions(s) : [];
  const action =
    selectedAction && availableActions.includes(selectedAction)
      ? selectedAction
      : (availableActions[0] ?? 'activate');
  const availablePlans = (plans.data ?? []).filter((p) => p.available !== false);
  const defaultPlanId = s?.assignedPlanId ?? s?.currentPeriod?.planId;
  const planId = selectedPlanId || availablePlans.find((p) => p.id === defaultPlanId)?.id || '';
  const plan = availablePlans.find((p) => p.id === planId);
  const durations = plan
    ? [{ months: 1 as const, price: plan.monthlyPrice }, ...(plan.terms ?? [])]
    : [];
  const desiredMonths = selectedMonths ?? s?.assignedMonths ?? s?.currentPeriod?.months ?? 1;
  const months = durations.find((term) => term.months === desiredMonths)?.months ?? 1;
  const monetary = ['activate', 'renew', 'change'].includes(action);
  const needsPlan = monetary || action === 'assign';
  const money = (amount: string) => formatSubscriptionMoney(amount, locale);
  const quote = useMutation({
    mutationFn: () =>
      apiRequest<SubscriptionQuote>(`/admin/subscriptions/${merchantId}/quote`, {
        method: 'POST',
        body: JSON.stringify({ action, planId, months }),
      }),
  });
  const save = useMutation({
    mutationFn: (body: SubscriptionCommand) =>
      apiRequest<SubscriptionDetail>(`/admin/subscriptions/${merchantId}/actions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async (result) => {
      client.setQueryData(['subscriptions', 'detail', merchantId], result);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['subscriptions'] }),
        client.invalidateQueries({ queryKey: adminQueryKeys.merchants }),
      ]);
      quote.reset();
      setConfirmed(false);
      setReason('');
      retry.current = null;
      setNotice(true);
      setAction(null);
    },
  });
  function reset() {
    quote.reset();
    save.reset();
    setConfirmed(false);
    setNotice(false);
    retry.current = null;
  }
  const validQuote =
    quote.data?.action === action &&
    quote.data.planId === planId &&
    quote.data.months === months &&
    quote.data.subscriptionRevision === s?.revision;
  const canSave = Boolean(
    s &&
    reason.trim() &&
    !save.isPending &&
    (!needsPlan || planId) &&
    (!monetary || (validQuote && confirmed)),
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!s || !canSave) return;
    const body = {
      revision: s.revision,
      action,
      reason,
      ...(needsPlan ? { planId, months } : {}),
      ...(monetary && validQuote && quote.data
        ? {
            planRevision: quote.data.planRevision,
            expectedDue: quote.data.due,
            externalCollectionConfirmed: true as const,
            ...(action === 'change' ? { effectiveAt: quote.data.startsAt } : {}),
          }
        : {}),
    };
    const key = JSON.stringify(body);
    if (retry.current?.key !== key) retry.current = { key, requestId: crypto.randomUUID() };
    save.mutate({ ...body, requestId: retry.current.requestId });
  }
  const destructive = action === 'cancel';
  const BackArrow = locale === 'ar' ? ArrowRight : ArrowLeft;
  const currentPlan =
    s?.currentPeriod?.planName ?? plans.data?.find((p) => p.id === s?.assignedPlanId)?.name;
  return (
    <section className="subscription-editor" aria-label={t('Manage subscription')}>
      <Button variant="ghost" size="sm" className="subscription-back" onClick={onClose}>
        <BackArrow size={16} />
        {t('Back to subscriptions')}
      </Button>
      {detail.isPending && (
        <div className="subscription-surface subscription-editor-loading" role="status">
          <span className="subscription-loading-bar" />
          <span className="subscription-loading-bar" />
          {t('Loading subscriptions…')}
        </div>
      )}
      {detail.isError && (
        <div role="alert" className="subscription-alert">
          {errorText(detail.error.message)}
          <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>
            {t('Try again')}
          </Button>
        </div>
      )}
      {s && (
        <>
          <div className="subscription-customer subscription-surface">
            <div className="subscription-customer-heading">
              <span className="subscription-customer-avatar">
                <Store size={24} />
              </span>
              <div>
                <small>{t('Manage subscription')}</small>
                <h2>{s.merchantName}</h2>
              </div>
              <StatusBadge
                tone={
                  s.status === 'active'
                    ? 'success'
                    : s.status === 'cancelled'
                      ? 'neutral'
                      : 'warning'
                }
              >
                {t(subscriptionStatusLabels[s.status])}
              </StatusBadge>
            </div>
            <div className="subscription-current-facts">
              <div>
                <FileText size={17} />
                <span>
                  <small>{t(s.currentPeriod ? 'Current plan' : 'Assigned plan')}</small>
                  <strong>{currentPlan ?? t('Not assigned')}</strong>
                </span>
              </div>
              <div>
                <CalendarDays size={17} />
                <span>
                  <small>{t('Ends at')}</small>
                  <strong>{s.endsAt ? formatDate(s.endsAt) : t('No end date')}</strong>
                </span>
              </div>
              <div>
                <Clock3 size={17} />
                <span>
                  <small>{t('Days remaining')}</small>
                  <strong>
                    {s.endsAt
                      ? formatNumber(
                          Math.max(0, Math.ceil((Date.parse(s.endsAt) - Date.now()) / 86400000)),
                        )
                      : '—'}
                  </strong>
                </span>
              </div>
            </div>
            {s.cancelAtEnd && (
              <div className="subscription-inline-notice">
                <CalendarDays size={15} />
                {t('Cancels at period end')}
              </div>
            )}
          </div>
          {s.status === 'legacy' && (
            <div className="subscription-legacy-note">
              <Info size={18} />
              <div>
                <strong>{t('Existing access is preserved')}</strong>
                <span>{t('Review the agreed plan before starting a new paid period.')}</span>
              </div>
            </div>
          )}
          {notice && (
            <div role="status" className="subscription-success">
              <CheckCircle2 size={18} />
              {t('Subscription updated.')}
            </div>
          )}
          <form id={formId} onSubmit={submit} className="subscription-workspace">
            <div className="subscription-settings subscription-surface">
              <div className="subscription-section-heading">
                <span className="subscription-step">1</span>
                <div>
                  <h3>{t('Subscription details')}</h3>
                  <p>{t('Choose what changes for this business.')}</p>
                </div>
              </div>
              <fieldset disabled={save.isPending} className="subscription-settings-fields">
                <label className="subscription-field" htmlFor={`${formId}-action`}>
                  <span>{t('Action')}</span>
                  <select
                    id={`${formId}-action`}
                    aria-label={t('Action')}
                    value={action}
                    onChange={(e) => {
                      reset();
                      setAction(e.target.value as SubscriptionCommand['action']);
                    }}
                  >
                    {availableActions.map((a) => (
                      <option key={a} value={a}>
                        {t(subscriptionActions[a])}
                      </option>
                    ))}
                  </select>
                  <small className={destructive ? 'subscription-danger-copy' : ''}>
                    {t(actionHints[action])}
                  </small>
                </label>
                {needsPlan && (
                  <>
                    <label className="subscription-field" htmlFor={`${formId}-plan`}>
                      <span>{t('Plan')}</span>
                      <select
                        required
                        id={`${formId}-plan`}
                        value={planId}
                        onChange={(e) => {
                          reset();
                          setPlanId(e.target.value);
                          setMonths(null);
                        }}
                      >
                        <option value="">{t('Choose a plan')}</option>
                        {availablePlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {plan && (
                      <fieldset className="subscription-duration-group">
                        <legend>
                          {t('Duration')}
                          <small>{t('Total price for the selected period')}</small>
                        </legend>
                        <div className="subscription-duration-options">
                          {durations.map((term) => (
                            <label
                              key={term.months}
                              className={`subscription-duration ${months === term.months ? 'is-selected' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`${formId}-duration`}
                                aria-label={t('{{months}} months', { months: term.months })}
                                checked={months === term.months}
                                onChange={() => {
                                  reset();
                                  setMonths(term.months);
                                }}
                              />
                              <span>
                                {t('{{months}} months', { months: term.months })}
                                {months === term.months && <Check size={14} />}
                              </span>
                              <strong>{money(term.price)}</strong>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    {!plans.isPending && !availablePlans.length && (
                      <div className="subscription-inline-notice">
                        {t('Create an available plan before activating a subscription.')}
                      </div>
                    )}
                  </>
                )}
                <label className="subscription-field" htmlFor={`${formId}-reason`}>
                  <span>
                    {t('Reason / collection reference')}
                    <small>{t('Required')}</small>
                  </span>
                  <Input
                    id={`${formId}-reason`}
                    aria-label={t('Reason / collection reference')}
                    required
                    maxLength={1000}
                    placeholder={t(
                      monetary
                        ? 'e.g. Bank transfer reference or receipt number'
                        : 'Briefly explain this change',
                    )}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      retry.current = null;
                      save.reset();
                    }}
                  />
                </label>
              </fieldset>
              {plans.isError && (
                <p role="alert" className="subscription-alert">
                  {errorText(plans.error.message)}
                </p>
              )}
            </div>
            <aside
              className="subscription-review subscription-surface"
              aria-label={t('Review and confirm')}
            >
              <div className="subscription-section-heading">
                <span className="subscription-step">2</span>
                <div>
                  <h3>{t('Review and confirm')}</h3>
                  <p>
                    {t(
                      monetary
                        ? 'Check the amount before recording collection.'
                        : 'Review the effect of this change.',
                    )}
                  </p>
                </div>
              </div>
              {monetary ? (
                validQuote && quote.data ? (
                  <>
                    <div className="subscription-amount-due">
                      <span>
                        <CircleDollarSign size={17} />
                        {t('Amount to collect')}
                      </span>
                      <strong>{money(quote.data.due)}</strong>
                      <small>{t('Confirmed outside Waffarly')}</small>
                    </div>
                    <dl className="subscription-price-breakdown">
                      <div>
                        <dt>{t('Total price')}</dt>
                        <dd>{money(quote.data.price)}</dd>
                      </div>
                      {quote.data.credit !== '0.00' && (
                        <div className="subscription-credit">
                          <dt>{t('Unused coverage credit')}</dt>
                          <dd>− {money(quote.data.credit)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="subscription-coverage-dates">
                      <div>
                        <small>{t('Starts at')}</small>
                        <strong>{formatDate(quote.data.startsAt)}</strong>
                      </div>
                      <ChevronRight size={15} aria-hidden="true" />
                      <div>
                        <small>{t('Ends at')}</small>
                        <strong>{formatDate(quote.data.endsAt)}</strong>
                      </div>
                    </div>
                    <label className={`subscription-check ${confirmed ? 'is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={save.isPending}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span>
                        {t('I confirm the displayed amount was collected outside Waffarly.')}
                      </span>
                    </label>
                  </>
                ) : (
                  <div className="subscription-review-placeholder">
                    <ReceiptText size={30} />
                    <strong>{t('Your payment summary appears here')}</strong>
                    <p>
                      {t(
                        'Select a plan and duration, then review the exact price and coverage dates.',
                      )}
                    </p>
                  </div>
                )
              ) : (
                <div className={`subscription-action-summary ${destructive ? 'is-danger' : ''}`}>
                  {destructive ? <AlertCircle size={24} /> : <BadgeCheck size={24} />}
                  <strong>{t(subscriptionActions[action])}</strong>
                  <p>{t(actionHints[action])}</p>
                </div>
              )}
              {quote.isError && (
                <p role="alert" className="subscription-alert">
                  {errorText(quote.error.message)}
                </p>
              )}
              {save.isError && (
                <div role="alert" className="subscription-alert">
                  <p>{errorText(save.error.message)}</p>
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    onClick={() => {
                      reset();
                      void detail.refetch();
                      void plans.refetch();
                    }}
                  >
                    {t('Refresh subscription and review again')}
                  </Button>
                </div>
              )}
              {monetary && !validQuote ? (
                <Button
                  type="button"
                  className="subscription-primary"
                  disabled={!planId || quote.isPending || save.isPending}
                  onClick={() => {
                    setConfirmed(false);
                    retry.current = null;
                    quote.mutate();
                  }}
                >
                  <CreditCard size={16} />
                  {t(quote.isPending ? 'Reviewing…' : 'Review price and dates')}
                </Button>
              ) : (
                <>
                  <Button
                    type="submit"
                    className="subscription-primary"
                    variant={destructive ? 'destructive' : 'default'}
                    disabled={!canSave}
                  >
                    {save.isPending ? t('Saving…') : t(subscriptionActions[action])}
                    {!save.isPending && <CheckCircle2 size={16} />}
                  </Button>
                  {!reason.trim() && (
                    <p className="subscription-review-help">
                      {t('Add a reason or collection reference to continue.')}
                    </p>
                  )}
                  {monetary && !confirmed && (
                    <p className="subscription-review-help">
                      {t('Confirm collection to activate the action.')}
                    </p>
                  )}
                </>
              )}
            </aside>
          </form>
          <SubscriptionHistory subscription={s} />
        </>
      )}
    </section>
  );
}
