import type { LocalizedMessage } from '@waffarly/ui';
import { useLocale, Button, Input, Card, Textarea } from '@waffarly/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  CreateMonthlyPlanRequest,
  MonthlyPlanSettings,
  MonthlyPlanSummary,
  PlanCurrency,
  UpdateMonthlyPlanRequest,
} from '@waffarly/contracts';
import { ApiError, apiRequest } from './lib/api-client.js';
import './plans.css';

type FormValues = Omit<MonthlyPlanSettings, 'currency'> & { currency: PlanCurrency | '' };
const emptyForm: FormValues = {
  name: '',
  description: '',
  monthlyPrice: '',
  currency: '',
  billingInterval: 'monthly',
};

function explainError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Could not save the plan.';
}

export function Plans() {
  const { t, locale, formatDate, errorText } = useLocale();
  const [plans, setPlans] = useState<MonthlyPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [editing, setEditing] = useState<MonthlyPlanSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reload, setReload] = useState(0);
  const requestId = useRef<string | null>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<MonthlyPlanSummary[]>('/admin/plans')
      .then((rows) => {
        if (active) {
          setPlans(rows);
          setLoadError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(explainError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }

  function reset() {
    setForm(emptyForm);
    setEditing(null);
    setConflict(false);
    setError('');
    requestId.current = null;
  }

  function edit(plan: MonthlyPlanSummary) {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      currency: plan.currency,
      billingInterval: 'monthly',
    });
    setError('');
    setNotice('');
    setConflict(false);
    requestId.current = null;
    editorHeading.current?.focus();
  }

  function change<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    // A changed payload is a new creation attempt; identical retries retain their ID.
    requestId.current = null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || !form.currency || conflict) return;
    setSaving(true);
    setError('');
    setNotice('');
    const settings: MonthlyPlanSettings = { ...form, currency: form.currency };
    try {
      let saved: MonthlyPlanSummary;
      if (editing) {
        const body: UpdateMonthlyPlanRequest = { ...settings, revision: editing.revision };
        saved = await apiRequest<MonthlyPlanSummary>(`/admin/plans/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        requestId.current ??= crypto.randomUUID();
        const body: CreateMonthlyPlanRequest = { ...settings, requestId: requestId.current };
        saved = await apiRequest<MonthlyPlanSummary>('/admin/plans', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      setPlans((current) => [saved, ...current.filter((plan) => plan.id !== saved.id)]);
      setNotice({
        key: editing ? '{{name}} updated.' : '{{name}} created.',
        values: { name: saved.name },
      });
      reset();
    } catch (cause) {
      setError(explainError(cause));
      if (cause instanceof ApiError && cause.statusCode === 409) setConflict(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="plans-heading">
      <div className="library-heading">
        <div>
          <span className="eyebrow">{t('Plans & subscriptions')}</span>
          <h2 id="plans-heading">{t('Monthly plans')}</h2>
          <p>{t('Set the monthly offer for your business merchants.')}</p>
        </div>
        <Button
          variant="outline"
          type="button"
          className="secondary"
          disabled={loading || saving}
          onClick={refresh}
        >
          {t('Refresh plans')}{' '}
        </Button>
      </div>
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      <div className="plan-columns">
        <Card className="panel" aria-labelledby="plan-editor-heading">
          <h3 id="plan-editor-heading" ref={editorHeading} tabIndex={-1}>
            {editing ? t('Edit monthly plan') : t('Create a monthly plan')}
          </h3>
          {error && (
            <p className="error" role="alert">
              {errorText(error)}
            </p>
          )}
          <form className="form" onSubmit={(event) => void save(event)}>
            <fieldset disabled={saving || loading} className="plan-fields">
              <label>
                {t('Plan name')}{' '}
                <Input
                  required
                  maxLength={160}
                  value={form.name}
                  placeholder={t('Monthly plan')}
                  onChange={(event) => change('name', event.target.value)}
                />
              </label>
              <div className="plan-price-inputs">
                <label>
                  {t('Monthly price')}{' '}
                  <Input
                    required
                    type="text"
                    inputMode="decimal"
                    pattern="(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?"
                    title={t('An amount from 0 to 99999999.99, with up to two decimal places')}
                    maxLength={11}
                    value={form.monthlyPrice}
                    placeholder="0.00"
                    onChange={(event) => change('monthlyPrice', event.target.value)}
                  />
                </label>
                <label>
                  {t('Currency')}{' '}
                  <select
                    required
                    value={form.currency}
                    onChange={(event) => change('currency', event.target.value as PlanCurrency)}
                  >
                    <option value="" disabled>
                      {t('Select currency')}{' '}
                    </option>
                    <option value="EGP">{t('EGP')}</option>
                    <option value="USD">{t('USD')}</option>
                    <option value="EUR">{t('EUR')}</option>
                  </select>
                </label>
              </div>
              <p className="plan-interval">
                {t('Billing interval')} <strong>{t('Monthly')}</strong>
              </p>
              <label>
                {t('Description')} <small>{t('Optional')}</small>
                <Textarea
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(event) => change('description', event.target.value)}
                />
              </label>
              <div className="template-form-actions">
                <Button type="submit" disabled={conflict}>
                  {saving ? t('Saving…') : editing ? t('Save changes') : t('Create plan')}
                </Button>
                {(editing || conflict) && (
                  <Button variant="outline" className="secondary" type="button" onClick={reset}>
                    {t('Cancel')}{' '}
                  </Button>
                )}
              </div>
              {conflict && (
                <p className="plan-help">
                  {t('Refresh plans and reopen the plan to review its latest values.')}{' '}
                </p>
              )}
            </fieldset>
          </form>
        </Card>
        <Card className="panel" aria-labelledby="plan-list-heading" aria-busy={loading}>
          <div className="plan-list-heading">
            <h3 id="plan-list-heading">{t('Plan catalog')}</h3>
            <span>
              {plans.length} {t('plans')}
            </span>
          </div>
          {loadError && (
            <p className="error" role="alert">
              {errorText(loadError)}
            </p>
          )}
          {loading ? (
            <p role="status">{t('Loading plans…')}</p>
          ) : !loadError && plans.length === 0 ? (
            <div className="library-empty">
              <h3>{t('Your first monthly plan')}</h3>
              <p>{t('Enter a name and monthly price to get started.')}</p>
            </div>
          ) : (
            <div className="plan-list">
              {plans.map((plan) => (
                <article className="plan-card" key={plan.id}>
                  <div className="plan-card-heading">
                    <h3>{plan.name}</h3>
                    <span className="template-status status-available">{t('Monthly')}</span>
                  </div>
                  <p className="plan-price">
                    <strong>
                      {new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn', {
                        style: 'currency',
                        currency: plan.currency,
                      }).format(Number(plan.monthlyPrice))}
                    </strong>
                    <span> {t('/ month')}</span>
                  </p>
                  {plan.description && <p className="plan-description">{plan.description}</p>}
                  <div className="plan-card-footer">
                    <span>
                      {t('Updated')} {formatDate(plan.updatedAt)}
                    </span>
                    <Button
                      variant="outline"
                      type="button"
                      className="secondary"
                      disabled={saving || loading || Boolean(loadError)}
                      aria-label={t('Edit {{name}}', { name: plan.name })}
                      onClick={() => edit(plan)}
                    >
                      {t('Edit plan')}{' '}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
