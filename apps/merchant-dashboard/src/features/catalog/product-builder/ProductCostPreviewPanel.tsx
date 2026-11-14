import { useEffect, useState } from 'react';
import type { CatalogProductCostPreview, CatalogProductCostPreviewRequest } from '@waffarly/contracts';
import { Button, Input } from '@waffarly/ui';
import { apiRequest } from '../../../lib/api-client.js';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';

type SelectedOption = { groupId: string; optionId: string; quantity: number };

export function ProductCostPreviewPanel({
  productId,
  groups,
  variants,
  text,
  formatDigits,
}: {
  productId: string | undefined;
  groups: GroupDraft[];
  variants: VariantDraft[];
  text: (english: string, arabic: string) => string;
  formatDigits: (value: string) => string;
}) {
  const [variantId, setVariantId] = useState('');
  const [selected, setSelected] = useState<SelectedOption[]>([]);
  const [defaultsLoadedFor, setDefaultsLoadedFor] = useState<string | undefined>();
  const [preview, setPreview] = useState<CatalogProductCostPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setVariantId((current) =>
      current && variants.some((variant) => variant.id === current) ? current : variants[0]?.id ?? '',
    );
  }, [productId, variants]);

  useEffect(() => {
    setSelected([]);
    setDefaultsLoadedFor(undefined);
  }, [productId]);

  useEffect(() => {
    if (!productId || !groups.length || defaultsLoadedFor === productId) return;
    setSelected(
      groups.flatMap((group) =>
        group.options
          .filter((option) => option.defaultSelected)
          .map((option) => ({ groupId: group.modifierGroupId, optionId: option.id, quantity: 1 })),
      ),
    );
    setDefaultsLoadedFor(productId);
  }, [defaultsLoadedFor, groups, productId]);

  function setOption(groupId: string, optionId: string, quantity: number | null) {
    setSelected((current) => {
      const without = current.filter(
        (entry) => entry.groupId !== groupId || entry.optionId !== optionId,
      );
      return quantity === null ? without : [...without, { groupId, optionId, quantity }];
    });
  }

  async function loadPreview() {
    if (!productId) return;
    setBusy(true);
    setError('');
    try {
      const body: CatalogProductCostPreviewRequest = {
        variantId: variantId || null,
        selections: selected.map((entry) => ({
          modifierGroupId: entry.groupId,
          modifierOptionId: entry.optionId,
          quantity: entry.quantity,
        })),
      };
      setPreview(
        await apiRequest<CatalogProductCostPreview>(
          `/owner/catalog/products/${productId}/cost-preview`,
          { method: 'POST', body: JSON.stringify(body) },
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Could not load cost preview.', 'تعذر تحميل معاينة التكلفة.'));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="product-cost-preview" aria-labelledby="product-cost-preview-title">
      <div className="product-cost-preview-heading">
        <div>
          <h3 id="product-cost-preview-title">{text('Current cost preview', 'معاينة التكلفة الحالية')}</h3>
          <p>{text('Uses the current stock cost. A new purchase changes this preview only; it does not change the selling price.', 'تعتمد على آخر تكلفة مسجلة للمخزون. الشراء الجديد يحدّث المعاينة فقط ولا يغير سعر البيع.')}</p>
        </div>
        {productId && <Button type="button" variant="outline" disabled={busy} onClick={() => void loadPreview()}>{busy ? text('Loading…', 'جارٍ التحميل…') : text('Calculate cost', 'احسب التكلفة')}</Button>}
      </div>
      {!productId ? (
        <p className="product-cost-preview-note">{text('Save the product once to preview its current cost.', 'احفظ المنتج أولًا لمعاينة تكلفته الحالية.')}</p>
      ) : (
        <>
          {variants.length > 0 && (
            <label className="product-cost-preview-size">
              {text('Size', 'الحجم')}
              <select value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                {variants.map((variant) => <option key={variant.id} value={variant.id}>{formatDigits(variant.name)}</option>)}
              </select>
            </label>
          )}
          {groups.length > 0 && (
            <div className="product-cost-preview-options">
              {groups.map((group) => (
                <fieldset key={group.id}>
                  <legend>{formatDigits(group.name)}</legend>
                  {group.options.map((option) => {
                    const choice = selected.find((entry) => entry.groupId === group.modifierGroupId && entry.optionId === option.id);
                    return (
                      <label key={option.id}>
                        <span>
                          <input type="checkbox" checked={Boolean(choice)} onChange={(event) => setOption(group.modifierGroupId, option.id, event.target.checked ? 1 : null)} />
                          {formatDigits(option.name)}
                        </span>
                        {choice && (
                          <Input type="number" min={1} max={option.maxQuantity ?? 1} aria-label={text('Quantity', 'الكمية')} value={choice.quantity} onChange={(event) => setOption(group.modifierGroupId, option.id, Math.max(1, Math.min(option.maxQuantity ?? 1, Number(event.target.value) || 1)))} />
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}
          {error && <p className="product-cost-preview-error" role="alert">{formatDigits(error)}</p>}
          {preview && (
            <>
              <div className="product-cost-preview-table">
                {preview.lines.map((line) => (
                  <div key={line.stockItemId}>
                    <span><strong>{formatDigits(line.stockItemName)}</strong><small>{formatDigits(`${line.requiredQuantity} ${line.baseUnit}`)}</small></span>
                    <span>{line.extendedCost === null ? text('Cost unknown', 'التكلفة غير معروفة') : formatDigits(`${line.extendedCost} EGP`)}</span>
                  </div>
                ))}
              </div>
              <dl className="product-cost-preview-totals">
                <div><dt>{text('Selling price', 'سعر البيع')}</dt><dd>{formatDigits(`${preview.sellingPrice} EGP`)}</dd></div>
                <div><dt>{text(preview.isComplete ? 'Current cost per item' : 'Known cost subtotal', preview.isComplete ? 'التكلفة الحالية للصنف' : 'مجموع التكلفة المعروفة')}</dt><dd>{formatDigits(`${preview.totalCost ?? preview.totalKnownCost} EGP`)}</dd></div>
                <div><dt>{text('Gross margin preview', 'معاينة مجمل الربح')}</dt><dd>{preview.grossMargin === null ? text('Incomplete', 'غير مكتمل') : formatDigits(`${preview.grossMargin} EGP`)}</dd></div>
              </dl>
              {!preview.isComplete && <p className="product-cost-preview-note" role="status">{text('Add a current cost for every stock item to complete this estimate.', 'سجّل تكلفة حالية لكل صنف مخزون لاكتمال هذه المعاينة.')}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
