import { useState, type FormEvent } from 'react';
import { Button, Input, Textarea, useLocale } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { DashboardSelect } from '../../components/DashboardSelect.js';
import { discountsCopy } from '../../discounts-copy.js';
import {
  emptyDiscount,
  validateDiscount,
  type Discount,
  type MerchantDiscountInput,
} from './discount-model.js';

export function DiscountEditor({
  discount,
  discounts,
  branches,
  busy = false,
  submitError = '',
  onClose,
  onSave,
}: {
  discount: Discount | null;
  discounts: Discount[];
  branches: Array<{ id: string; name: string }>;
  busy?: boolean;
  submitError?: string;
  onClose: () => void;
  onSave: (draft: MerchantDiscountInput) => void;
}) {
  const { locale, t } = useLocale();
  const copy = (message: string) => discountsCopy(message, locale, t);
  const initial = discount
    ? {
        name: discount.name,
        description: discount.description,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minimum: discount.minimum,
        maximum: discount.maximum,
        startDate: discount.startDate,
        endDate: discount.endDate,
        usageLimit: discount.usageLimit,
        branches: discount.branches,
        terms: discount.terms,
        state: discount.state,
      }
    : emptyDiscount();
  const [draft, setDraft] = useState<MerchantDiscountInput>(initial);
  const [error, setError] = useState('');
  function field<K extends keyof MerchantDiscountInput>(key: K, value: MerchantDiscountInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized: MerchantDiscountInput = {
      ...draft,
      name: draft.name.trim(),
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim(),
      terms: draft.terms.trim(),
      maximum: draft.type === 'fixed' ? '' : draft.maximum,
    };
    const problem = validateDiscount(normalized, discounts, discount?.id);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(normalized);
  }
  const dirty = (Object.keys(emptyDiscount()) as Array<keyof MerchantDiscountInput>).some(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(initial[key]),
  );
  function close() {
    if (!busy && (!dirty || window.confirm(copy('Discard unsaved discount changes?')))) onClose();
  }
  return (
    <DashboardDialog
      title={copy(discount ? 'Edit discount' : 'Create a discount')}
      closeLabel={t('Close')}
      onClose={close}
      busy={busy}
      className="discount-editor-dialog"
    >
      <form className="products-form discount-editor-form" onSubmit={submit}>
        {(error || submitError) && (
          <p className="products-error" role="alert">
            {copy(error || submitError)}
          </p>
        )}
        <label>
          {copy('Discount name')}
          <Input
            required
            maxLength={100}
            value={draft.name}
            onChange={(event) => field('name', event.target.value)}
          />
        </label>
        <label>
          {copy('Discount code')}
          <Input
            required
            dir="ltr"
            maxLength={32}
            value={draft.code}
            onChange={(event) => field('code', event.target.value.toUpperCase())}
            placeholder="WELCOME20"
          />
        </label>
        <label>
          {copy('Description')}
          <Input
            maxLength={200}
            value={draft.description}
            onChange={(event) => field('description', event.target.value)}
          />
        </label>
        <div className="discount-editor-grid">
          <div>
            <span className="discount-field-label">{copy('Type')}</span>
            <DashboardSelect
              disabled={busy}
              label={copy('Type')}
              value={draft.type}
              options={[
                { value: 'percentage', label: copy('Percentage discount') },
                { value: 'fixed', label: copy('Fixed discount') },
              ]}
              onChange={(value) => field('type', value as MerchantDiscountInput['type'])}
            />
          </div>
          <label>
            {copy('Value')} ({draft.type === 'percentage' ? '%' : copy('EGP')})
            <Input
              required
              type="number"
              dir="ltr"
              min="0.01"
              max={draft.type === 'percentage' ? '100' : '9999999.99'}
              step="0.01"
              value={draft.value}
              onChange={(event) => field('value', event.target.value)}
            />
          </label>
          <label>
            {copy('Minimum order')} ({copy('EGP')})
            <Input
              required
              type="number"
              dir="ltr"
              min="0"
              max="9999999.99"
              step="0.01"
              value={draft.minimum}
              onChange={(event) => field('minimum', event.target.value)}
            />
          </label>
          {draft.type === 'percentage' && (
            <label>
              {copy('Maximum discount')} ({copy('EGP')})
              <Input
                type="number"
                dir="ltr"
                min="0.01"
                max="9999999.99"
                step="0.01"
                placeholder={copy('Unlimited')}
                value={draft.maximum}
                onChange={(event) => field('maximum', event.target.value)}
              />
            </label>
          )}
          <label>
            {copy('Start date')}
            <Input
              required
              type="date"
              value={draft.startDate}
              onChange={(event) => field('startDate', event.target.value)}
            />
          </label>
          <label>
            {copy('End date')}
            <Input
              required
              type="date"
              min={draft.startDate}
              value={draft.endDate}
              onChange={(event) => field('endDate', event.target.value)}
            />
          </label>
          <label>
            {copy('Usage limit')}
            <Input
              type="number"
              dir="ltr"
              min={Math.max(1, discount?.redemptions ?? 0)}
              max="999999999"
              step="1"
              placeholder={copy('Unlimited')}
              value={draft.usageLimit}
              onChange={(event) => field('usageLimit', event.target.value)}
            />
          </label>
          <div>
            <span className="discount-field-label">{copy('Status')}</span>
            <DashboardSelect
              disabled={busy}
              label={copy('Status')}
              value={draft.state}
              options={[
                { value: 'published', label: copy('Published') },
                { value: 'draft', label: copy('Draft') },
                { value: 'paused', label: copy('Paused') },
              ]}
              onChange={(value) => field('state', value as MerchantDiscountInput['state'])}
            />
          </div>
        </div>
        <fieldset className="discount-branch-options">
          <legend>{copy('Branches')}</legend>
          <label>
            <input
              type="checkbox"
              checked={draft.branches.length === 0}
              onChange={() => field('branches', [])}
            />
            {copy('All branches')}
          </label>
          {branches.map((branch) => (
            <label key={branch.id}>
              <input
                type="checkbox"
                checked={draft.branches.includes(branch.id)}
                onChange={(event) =>
                  field(
                    'branches',
                    event.target.checked
                      ? [...draft.branches, branch.id]
                      : draft.branches.filter((id) => id !== branch.id),
                  )
                }
              />
              {branch.name}
            </label>
          ))}
        </fieldset>
        <label>
          {copy('Terms and conditions')}
          <Textarea
            rows={3}
            maxLength={2000}
            value={draft.terms}
            onChange={(event) => field('terms', event.target.value)}
          />
        </label>
        <footer>
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={busy}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {copy(busy ? 'Saving...' : discount ? 'Save changes' : 'Create discount')}
          </Button>
        </footer>
      </form>
    </DashboardDialog>
  );
}
