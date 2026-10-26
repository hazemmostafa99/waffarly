import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMonthlyPlanRequest,
  MonthlyPlanSettings,
  MonthlyPlanSummary,
  UpdateMonthlyPlanRequest,
} from '@waffarly/contracts';
import { Button, Card, Input, Textarea, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { ArrowLeft, ArrowRight, CircleDollarSign, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { adminQueryKeys } from '../../app/query-keys.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ApiError, apiRequest } from '../../lib/api-client.js';
import { useMonthlyPlansQuery } from './plans-queries.js';

type FormValues = Omit<MonthlyPlanSettings, 'currency'>;
type SavePlanInput = {
  settings: MonthlyPlanSettings;
  planId?: string;
  revision?: number;
  requestId?: string;
};

const emptyForm: FormValues = {
  name: '',
  description: '',
  monthlyPrice: '',
  billingInterval: 'monthly',
};

function settingsFor(plan: MonthlyPlanSummary): FormValues {
  return {
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice,
    billingInterval: 'monthly',
  };
}

function sameSettings(left: FormValues, right: FormValues) {
  return left.name === right.name &&
    left.description === right.description &&
    left.monthlyPrice === right.monthlyPrice;
}

export function PlanEditorPage() {
  const { t, errorText, formatDate, locale } = useLocale();
  const navigate = useNavigate();
  const { planId } = useParams();
  const isEditing = Boolean(planId);
  const plans = useMonthlyPlansQuery(isEditing);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [initialForm, setInitialForm] = useState<FormValues>(emptyForm);
  const [basePlan, setBasePlan] = useState<MonthlyPlanSummary | null>(null);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const requestId = useRef<string | null>(null);
  const allowNavigation = useRef(false);
  const discardDialog = useRef<HTMLDialogElement>(null);
  const currentPlan = plans.data?.find((plan) => plan.id === planId);
  const recordPlan = basePlan ?? currentPlan;
  const isDirty = !sameSettings(form, initialForm);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty &&
    !allowNavigation.current &&
    currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!currentPlan || loadedPlanId === currentPlan.id) return;
    const values = settingsFor(currentPlan);
    setForm(values);
    setInitialForm(values);
    setBasePlan(currentPlan);
    setLoadedPlanId(currentPlan.id);
    setConflict(false);
    setError('');
    requestId.current = null;
  }, [currentPlan, loadedPlanId]);

  useEffect(() => {
    const dialog = discardDialog.current;
    if (!dialog) return;
    if (blocker.state === 'blocked' && !dialog.open) dialog.showModal();
    if (blocker.state !== 'blocked' && dialog.open) dialog.close();
  }, [blocker.state]);

  useEffect(() => {
    if (!isDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [isDirty]);

  const savePlan = useMutation({
    mutationFn: async ({ settings, planId: id, revision, requestId: idempotencyKey }: SavePlanInput) => {
      if (id && revision !== undefined) {
        const body: UpdateMonthlyPlanRequest = { ...settings, revision };
        return apiRequest<MonthlyPlanSummary>(`/admin/plans/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }

      const body: CreateMonthlyPlanRequest = {
        ...settings,
        requestId: idempotencyKey ?? crypto.randomUUID(),
      };
      return apiRequest<MonthlyPlanSummary>('/admin/plans', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (saved, variables) => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.plans });
      const planNotice: LocalizedMessage = {
        key: variables.planId ? '{{name}} updated.' : '{{name}} created.',
        values: { name: saved.name },
      };
      allowNavigation.current = true;
      navigate('/plans', { state: { planNotice } });
    },
    onError: (cause: unknown) => {
      setError(errorText(cause instanceof Error ? cause.message : 'Could not save the plan.'));
      if (isEditing && cause instanceof ApiError && cause.statusCode === 409) setConflict(true);
    },
  });

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    savePlan.reset();
    setForm((valueBefore) => ({ ...valueBefore, [field]: value }));
    setError('');
    if (!isEditing) requestId.current = null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savePlan.isPending || conflict) return;
    setError('');
    const settings: MonthlyPlanSettings = { ...form, currency: 'EGP' };
    if (isEditing) {
      if (!basePlan || basePlan.id !== planId || loadedPlanId !== planId) return;
      savePlan.mutate({ settings, planId: basePlan.id, revision: basePlan.revision });
      return;
    }
    requestId.current ??= crypto.randomUUID();
    savePlan.mutate({ settings, requestId: requestId.current });
  }

  async function reloadLatestPlan() {
    if (!planId) return;
    const confirmed = !isDirty || window.confirm(t('Discard your draft and load the latest plan values?'));
    if (!confirmed) return;
    const result = await plans.refetch();
    const latest = result.data?.find((plan) => plan.id === planId);
    if (!latest) {
      setError(t('Plan was not found.'));
      return;
    }
    const values = settingsFor(latest);
    savePlan.reset();
    setForm(values);
    setInitialForm(values);
    setBasePlan(latest);
    setLoadedPlanId(latest.id);
    setConflict(false);
    setError('');
  }

  const waitingForPlan = isEditing && (plans.isPending || (Boolean(currentPlan) && loadedPlanId !== planId));
  const planNotFound = isEditing && plans.isSuccess && !currentPlan;
  const pageError = plans.isError && !plans.data;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Plans & subscriptions')}
        title={isEditing ? t('Edit monthly plan') : t('Create a monthly plan')}
        description={isEditing ? t('Update the approved details for this monthly offer.') : t('Add an administrator-defined monthly offer to the plan catalog.')}
        actions={
          <Button asChild variant="outline" className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink">
            <Link to="/plans">
              {locale === 'ar' ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
              {t('Back to plan catalog')}
            </Link>
          </Button>
        }
      />

      {pageError && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <div>
            <strong className="block">{t('Could not load plans.')}</strong>
            <p className="mb-0 mt-1 text-xs">{errorText(plans.error instanceof Error ? plans.error.message : 'Something went wrong.')}</p>
          </div>
          <Button variant="outline" size="sm" className="border-waffarly-danger/20 bg-white text-waffarly-danger" onClick={() => void plans.refetch()}>
            {t('Try again')}
          </Button>
        </div>
      )}

      {savePlan.isError && (
        <div className="rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <strong className="block">{t('The plan could not be saved.')}</strong>
          <p className="mb-0 mt-1 text-xs">{error}</p>
          {conflict && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-xs">{t('The plan changed after you opened it. Your draft is preserved; reload the latest values before saving again.')}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={plans.isFetching}
                className="border-waffarly-danger/20 bg-white text-waffarly-danger"
                onClick={() => void reloadLatestPlan()}
              >
                <RefreshCw size={14} aria-hidden="true" />
                {t('Load latest values')}
              </Button>
            </div>
          )}
        </div>
      )}

      {planNotFound ? (
        <Card className="grid justify-items-start gap-3 border-waffarly-border p-6">
          <h2 className="m-0 text-lg font-bold text-waffarly-ink">{t('Plan was not found.')}</h2>
          <p className="m-0 text-sm text-waffarly-muted">{t('This plan may have been removed or is no longer available.')}</p>
          <Button asChild variant="outline" className="border-waffarly-border bg-white text-waffarly-ink">
            <Link to="/plans">{t('Back to plan catalog')}</Link>
          </Button>
        </Card>
      ) : waitingForPlan ? (
        <div className="grid gap-4 rounded-2xl border border-waffarly-border bg-white p-6" role="status" aria-label={t('Loading plan details…')}>
          <div className="h-5 w-48 animate-pulse rounded bg-waffarly-input" />
          <div className="h-11 animate-pulse rounded-lg bg-waffarly-input" />
          <div className="h-11 animate-pulse rounded-lg bg-waffarly-input" />
          <div className="h-24 animate-pulse rounded-lg bg-waffarly-input" />
        </div>
      ) : pageError ? null : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <Card className="grid gap-6 border-waffarly-border p-5 shadow-[0_3px_12px_rgba(20,32,62,0.035)] md:p-7" aria-labelledby="plan-form-heading">
            <div>
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-waffarly-kpi-gold text-waffarly-ink" aria-hidden="true">
                <CircleDollarSign size={19} />
              </div>
              <h2 id="plan-form-heading" className="m-0 text-lg font-bold text-waffarly-ink">{isEditing ? t('Plan details') : t('Monthly offer details')}</h2>
              <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Only enter the commercial details approved for this plan.')}</p>
            </div>

            <form onSubmit={submit} className="grid gap-5">
              <fieldset disabled={savePlan.isPending || conflict || (isEditing && !currentPlan)} className="grid min-w-0 gap-5 border-0 p-0">
                <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
                  {t('Plan name')}
                  <Input
                    required
                    maxLength={160}
                    value={form.name}
                    placeholder={t('Monthly plan')}
                    onChange={(event) => updateField('name', event.target.value)}
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
                  <span>{t('Monthly price')} ({t('EGP')})</span>
                  <Input
                    required
                    type="text"
                    inputMode="decimal"
                    pattern="(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?"
                    title={t('An amount from 0 to 99999999.99, with up to two decimal places')}
                    maxLength={11}
                    value={form.monthlyPrice}
                    placeholder="0.00"
                    onChange={(event) => updateField('monthlyPrice', event.target.value)}
                  />
                </label>

                <div className="flex items-center justify-between rounded-xl bg-waffarly-input px-4 py-3 text-xs text-waffarly-muted">
                  <span>{t('Billing interval')}</span>
                  <strong className="font-bold text-waffarly-ink">{t('Monthly')}</strong>
                </div>

                <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
                  {t('Description')} <span className="font-normal text-waffarly-muted">{t('Optional')}</span>
                  <Textarea
                    rows={4}
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    className="resize-y"
                  />
                </label>
              </fieldset>

              <div className="flex flex-wrap gap-2 border-t border-waffarly-border pt-5">
                <Button
                  type="submit"
                  disabled={savePlan.isPending || conflict || (isEditing && (!currentPlan || loadedPlanId !== planId))}
                  className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
                >
                  {savePlan.isPending ? t('Saving…') : isEditing ? t('Save changes') : t('Create plan')}
                </Button>
                <Button asChild variant="outline" className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink">
                  <Link to="/plans">{t('Cancel')}</Link>
                </Button>
              </div>
            </form>
          </Card>

          <aside className="grid content-start gap-4">
            <Card className="grid gap-3 border-waffarly-border p-5 shadow-[0_3px_12px_rgba(20,32,62,0.035)]">
              <h2 className="m-0 text-sm font-bold text-waffarly-ink">{t('About plan definitions')}</h2>
              <p className="m-0 text-xs leading-5 text-waffarly-muted">{t('Plan definitions do not change merchant access, subscriptions, or collected payments.')}</p>
            </Card>
            {isEditing && recordPlan && (
              <Card className="grid gap-2 border-waffarly-border p-5 shadow-[0_3px_12px_rgba(20,32,62,0.035)]">
                <h2 className="m-0 text-sm font-bold text-waffarly-ink">{t('Record information')}</h2>
                <p className="m-0 text-xs text-waffarly-muted">{t('Created')} {formatDate(recordPlan.createdAt)}</p>
                <p className="m-0 text-xs text-waffarly-muted">{t('Last updated')} {formatDate(recordPlan.updatedAt)}</p>
              </Card>
            )}
          </aside>
        </div>
      )}

      <dialog
        ref={discardDialog}
        aria-labelledby="discard-plan-title"
        aria-describedby="discard-plan-description"
        onCancel={(event) => {
          event.preventDefault();
          if (blocker.state === 'blocked') blocker.reset();
        }}
        className="w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-waffarly-border bg-white p-0 shadow-[0_20px_70px_rgba(20,32,62,0.24)] backdrop:bg-waffarly-ink/35"
      >
        <div className="grid gap-4 p-5 md:p-6">
          <div>
            <h2 id="discard-plan-title" className="m-0 text-lg font-bold text-waffarly-ink">{t('Leave without saving?')}</h2>
            <p id="discard-plan-description" className="mb-0 mt-2 text-sm leading-6 text-waffarly-muted">{t('Your plan changes have not been saved. Leave and discard them?')}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" className="border-waffarly-border bg-white text-waffarly-ink" onClick={() => blocker.state === 'blocked' && blocker.reset()}>
              {t('Stay and keep editing')}
            </Button>
            <Button variant="destructive" type="button" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
              {t('Discard changes')}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
