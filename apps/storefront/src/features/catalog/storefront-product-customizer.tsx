'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { getStorefrontProductImage } from '../../lib/storefront-images';
import { useMutation } from '@tanstack/react-query';
import { Minus, Plus, X } from 'lucide-react';
import type {
  CatalogProductQuoteRequest,
  CatalogProductQuoteResponse,
  CatalogProductQuoteSelection,
  PublicStorefrontProduct,
} from '@waffarly/contracts';
import { Button } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { apiPost } from '../../lib/api-client';
import {
  formatStorefrontPrice,
  getProductStartingPrice,
  fromMinorUnits,
  toMinorUnits,
} from '../../lib/storefront-format';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import type { StorefrontCartLine } from '../cart/storefront-store';
import { useStorefrontCartFeedback } from '../cart/use-storefront-cart-feedback';
import { storefrontQueryKeys } from './storefront-query-keys';

function effectiveGroups(product: PublicStorefrontProduct, variantId: string) {
  return product.modifierGroups
    .filter(
      (group) =>
        group.variantOverrides?.find((override) => override.variantId === variantId)?.available !==
        false,
    )
    .map((group) => ({
      ...group,
      options: group.options
        .filter(
          (option) =>
            option.variantOverrides?.find((override) => override.variantId === variantId)
              ?.available !== false,
        )
        .map((option) => ({
          ...option,
          priceAdjustment:
            option.variantOverrides?.find((override) => override.variantId === variantId)
              ?.priceAdjustment ?? option.priceAdjustment,
        })),
    }))
    .filter((group) => group.options.length > 0 || group.minSelections > 0);
}

function defaultChoices(
  product: PublicStorefrontProduct,
  variantId: string,
): Record<string, string[]> {
  return Object.fromEntries(
    effectiveGroups(product, variantId).map((group) => [
      group.id,
      group.options
        .filter((option) => option.defaultSelected)
        .slice(0, group.selectionMode === 'single' ? 1 : group.maxSelections)
        .map((option) => option.id),
    ]),
  );
}

type ProductCustomizerProps = {
  product: PublicStorefrontProduct;
  slug: string;
  presentation?: 'dialog' | 'inline';
  onClose?: () => void;
  editLine?: StorefrontCartLine;
};

export function StorefrontProductCustomizer({
  product,
  slug,
  presentation = 'dialog',
  onClose,
  editLine,
}: ProductCustomizerProps) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const updateCartLine = useStorefrontStore((state) => state.updateCartLine);
  const feedback = useStorefrontCartFeedback();
  const [saveError, setSaveError] = useState('');
  const submitting = useRef(false);
  const addCartLine = useStorefrontStore((state) => state.addCartLine);
  const [variantId, setVariantId] = useState(
    editLine?.variantId ??
      product.variants.find((variant) => variant.availability === 'available')?.id ??
      '',
  );
  const [quantity, setQuantity] = useState(editLine?.quantity ?? 1);
  const groups = useMemo(() => effectiveGroups(product, variantId), [product, variantId]);
  const [choices, setChoices] = useState<Record<string, string[]>>(() =>
    editLine
      ? Object.fromEntries(
          editLine.selections.map((group) => [group.groupId, [...group.optionIds]]),
        )
      : defaultChoices(product, variantId),
  );
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      editLine?.selections.flatMap(
        (group) =>
          group.optionQuantities?.map((option) => [option.optionId, option.quantity]) ?? [],
      ) ?? [],
    ),
  );
  const imageUrl = getStorefrontProductImage(product, 'detail');
  const isDialog = presentation === 'dialog';

  const selections = useMemo<CatalogProductQuoteSelection[]>(
    () =>
      groups.map((group) => ({
        groupId: group.id,
        optionIds: choices[group.id] ?? [],
        optionQuantities: (choices[group.id] ?? []).map((optionId) => ({
          optionId,
          quantity: optionQuantities[optionId] ?? 1,
        })),
      })),
    [choices, groups, optionQuantities],
  );
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const isSelectionValid =
    (!product.variants.length || selectedVariant?.availability === 'available') &&
    groups.every((group) => {
      const count = choices[group.id]?.length ?? 0;
      return (
        count >= group.minSelections &&
        count <= group.maxSelections &&
        (choices[group.id] ?? []).every((id) => {
          const option = group.options.find((entry) => entry.id === id);
          const amount = optionQuantities[id] ?? 1;
          return (
            option && Number.isInteger(amount) && amount >= 1 && amount <= (option.maxQuantity ?? 1)
          );
        })
      );
    });

  const quoteMutation = useMutation({
    mutationKey: storefrontQueryKeys.quote(slug, product.id, variantId || null, selections),
    mutationFn: (request: CatalogProductQuoteRequest) =>
      apiPost<CatalogProductQuoteResponse>(
        `/catalog/stores/${encodeURIComponent(slug)}/products/${encodeURIComponent(product.id)}/quote`,
        request,
      ),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isDialog || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDialog]);

  function makeQuoteRequest(): CatalogProductQuoteRequest {
    return { ...(product.variants.length ? { variantId } : {}), selections };
  }

  function clearQuote() {
    quoteMutation.reset();

    setSaveError('');
  }

  function updateChoice(groupId: string, optionId: string, checked: boolean, single: boolean) {
    setChoices((current) => {
      const existing = current[groupId] ?? [];
      const next = single
        ? checked
          ? [optionId]
          : existing.filter((id) => id !== optionId)
        : checked
          ? [...existing, optionId]
          : existing.filter((id) => id !== optionId);
      return { ...current, [groupId]: next };
    });
    clearQuote();
  }

  function submitSelection(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!isSelectionValid || submitting.current) return;
    submitting.current = true;
    if (!editLine) feedback.prepare();
    setSaveError('');

    quoteMutation.mutate(makeQuoteRequest(), {
      onSuccess: (quote) => {
        const line = {
          productId: quote.productId,
          variantId: quote.variantId,
          selections: quote.selections.map(({ groupId, optionIds, options }) => ({
            groupId,
            optionIds,
            optionQuantities: options?.map(({ optionId, quantity }) => ({ optionId, quantity })),
          })),
          quantity,
          unitPriceSnapshot: quote.totalPrice,
        };
        if (editLine) {
          if (!updateCartLine(editLine.key, line)) {
            setSaveError(
              locale === 'ar'
                ? 'تعذر حفظ التعديل. راجع وجود العنصر وحد الكمية 99 بعد دمج الاختيارات المتطابقة.'
                : 'Could not save. Check that the item exists and the combined quantity is at most 99.',
            );
            return;
          }
        } else {
          if (!addCartLine(line)) {
            setSaveError(
              locale === 'ar'
                ? 'الحد الأقصى 99 قطعة للاختيارات المتطابقة في السلة.'
                : 'The maximum combined quantity is 99.',
            );
            return;
          }
          feedback.play();
        }

        onClose?.();
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  }

  const estimatedUnitPrice =
    toMinorUnits(
      selectedVariant?.promotionalPrice ??
        selectedVariant?.price ??
        String(getProductStartingPrice(product)),
    ) +
    groups.reduce(
      (sum, group) =>
        sum +
        group.options.reduce(
          (subtotal, option) =>
            subtotal +
            ((choices[group.id] ?? []).includes(option.id)
              ? Math.round(Number(option.priceAdjustment) * 100) *
                (optionQuantities[option.id] ?? 1)
              : 0),
          0,
        ),
      0,
    );
  const displayTotal = fromMinorUnits(
    (quoteMutation.data ? toMinorUnits(quoteMutation.data.totalPrice) : estimatedUnitPrice) *
      quantity,
  );

  const optionFieldsets = (
    <>
      {product.variants.length > 0 && (
        <fieldset className="grid min-w-0 gap-2 border-0 p-0">
          <legend className="mb-2 flex w-full items-center justify-between gap-2 p-0 text-sm font-bold text-store-ink">
            {t.chooseVariant}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {product.variants.map((variant) => {
              const unavailable = variant.availability !== 'available';
              const label = variant.attributes.length
                ? variant.attributes
                    .map((attribute) => `${attribute.attributeName}: ${attribute.value}`)
                    .join(' · ')
                : variant.name;
              return (
                <label
                  key={variant.id}
                  className={`flex min-w-0 flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 transition ${unavailable ? 'cursor-not-allowed border-store-border bg-store-page/60 opacity-55' : 'cursor-pointer border-store-border bg-white hover:border-store-accent/60 has-[:checked]:border-store-primary has-[:checked]:bg-store-primary/5'}`}
                >
                  <input
                    type="radio"
                    name={`variant-${product.id}-${presentation}`}
                    value={variant.id}
                    checked={variantId === variant.id}
                    disabled={unavailable || quoteMutation.isPending}
                    onChange={() => {
                      setVariantId(variant.id);
                      setChoices(defaultChoices(product, variant.id));
                      setOptionQuantities({});
                      clearQuote();
                    }}
                    className="m-0 size-4 shrink-0 accent-store-primary"
                  />
                  <span className="min-w-0 flex-1 break-words text-sm font-bold text-store-ink">
                    {label}
                  </span>
                  <span className="ms-6 flex w-full flex-col items-start text-xs font-bold text-store-accent">
                    {unavailable ? (
                      t.unavailable
                    ) : (
                      <>
                        <bdi dir="auto">
                          {formatStorefrontPrice(variant.promotionalPrice ?? variant.price, locale)}
                        </bdi>
                        {variant.promotionalPrice && (
                          <del className="text-xs font-medium text-store-muted">
                            <bdi dir="auto">{formatStorefrontPrice(variant.price, locale)}</bdi>
                          </del>
                        )}
                      </>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {groups.map((group) => {
        const single = group.selectionMode === 'single';
        const selected = choices[group.id] ?? [];
        return (
          <fieldset key={group.id} className="grid min-w-0 gap-2 border-0 p-0">
            <legend className="mb-2 flex w-full items-center justify-between gap-2 p-0 text-sm font-bold text-store-ink">
              {group.name}{' '}
              <span className="rounded-md bg-store-cream px-2 py-1 text-[10px] font-medium text-store-muted">
                {group.minSelections > 0 ? t.required : t.optional}
              </span>
            </legend>
            {group.options.length === 0 && (
              <p className="text-xs text-store-error" role="status">
                {locale === 'ar'
                  ? 'لا توجد اختيارات متاحة للنوع ده.'
                  : 'No options available for this variant.'}
              </p>
            )}
            {group.description && (
              <p className="-mt-1 text-sm leading-6 text-store-muted">{group.description}</p>
            )}

            <div className="grid gap-2">
              {single && group.minSelections === 0 && (
                <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border border-store-border px-3 py-2 hover:border-store-accent/60 has-[:checked]:border-store-primary has-[:checked]:bg-store-primary/5">
                  <input
                    type="radio"
                    name={`modifier-${product.id}-${group.id}-${presentation}`}
                    checked={selected.length === 0}
                    disabled={quoteMutation.isPending}
                    onChange={() => {
                      setChoices((current) => ({ ...current, [group.id]: [] }));
                      clearQuote();
                    }}
                    className="m-0 size-4 shrink-0 accent-store-primary"
                  />
                  <span className="flex-1 text-sm font-medium text-store-ink">{t.noChoice}</span>
                </label>
              )}

              {group.options.map((option) => {
                const checked = selected.includes(option.id);
                const disabled =
                  quoteMutation.isPending ||
                  (!single && !checked && selected.length >= group.maxSelections);
                const adjustment = Number(option.priceAdjustment);
                return (
                  <div key={option.id} className="grid gap-2">
                    <label
                      className={`flex min-h-10 items-center gap-3 rounded-xl border px-3 py-2 transition ${disabled && !checked ? 'cursor-not-allowed border-store-border bg-store-page/60 opacity-55' : 'cursor-pointer border-store-border hover:border-store-accent/60 has-[:checked]:border-store-primary has-[:checked]:bg-store-primary/5'}`}
                    >
                      <input
                        type={single ? 'radio' : 'checkbox'}
                        name={`modifier-${product.id}-${group.id}-${presentation}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) =>
                          updateChoice(group.id, option.id, event.currentTarget.checked, single)
                        }
                        className="m-0 size-4 shrink-0 accent-store-primary"
                      />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-store-ink">
                        {option.name}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-store-accent">
                        {adjustment > 0 ? '+ ' : ''}
                        <bdi dir="auto">
                          {formatStorefrontPrice(option.priceAdjustment, locale)}
                        </bdi>
                      </span>
                    </label>
                    {checked && (option.maxQuantity ?? 1) > 1 && (
                      <label className="flex items-center justify-between gap-3 px-3 text-sm">
                        <span>
                          {option.name}: {t.quantity}
                        </span>
                        <input
                          aria-label={`${option.name} ${t.quantity}`}
                          type="number"
                          min="1"
                          max={option.maxQuantity}
                          disabled={quoteMutation.isPending}
                          value={optionQuantities[option.id] ?? 1}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setOptionQuantities((current) => ({
                              ...current,
                              [option.id]: Math.max(
                                1,
                                Math.min(option.maxQuantity ?? 1, Math.floor(value) || 1),
                              ),
                            }));
                            clearQuote();
                          }}
                          className="w-20 rounded-lg border border-store-border p-2"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {group.selectionMode === 'multiple' && (
              <p className="text-xs leading-5 text-store-muted">
                {t.min} {group.minSelections}, {t.max} {group.maxSelections} {t.options}
              </p>
            )}
          </fieldset>
        );
      })}
    </>
  );

  const actions = (
    <div className="grid gap-2">
      {!isSelectionValid && (
        <p role="status" className="text-xs text-store-error">
          {locale === 'ar'
            ? 'راجع النوع والاختيارات المطلوبة والحد المسموح لكل مجموعة.'
            : 'Review the variant and required option limits.'}
          <button
            type="button"
            className="ms-2 underline"
            onClick={() => {
              setChoices(defaultChoices(product, variantId));
              setOptionQuantities({});
              clearQuote();
            }}
          >
            {locale === 'ar' ? 'إعادة اختيار الإضافات' : 'Reset options'}
          </button>
        </p>
      )}
      {(quoteMutation.isError || saveError) && (
        <p role="alert" className="text-xs leading-5 text-store-error">
          {saveError || quoteMutation.error?.message || t.priceError}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-11 shrink-0 items-center rounded-xl border border-store-border bg-white">
          <button
            type="button"
            aria-label={t.decreaseQuantity}
            disabled={quantity <= 1 || quoteMutation.isPending}
            onClick={() => {
              setQuantity((value) => value - 1);
            }}
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-store-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <output
            aria-label={t.quantity}
            aria-live="polite"
            className="min-w-5 text-center text-sm font-bold tabular-nums"
          >
            {quantity}
          </output>
          <button
            type="button"
            aria-label={t.increaseQuantity}
            disabled={quantity >= 99 || quoteMutation.isPending}
            onClick={() => {
              setQuantity((value) => value + 1);
            }}
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-store-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <Button
          type={isDialog ? 'submit' : 'button'}
          disabled={!isSelectionValid || quoteMutation.isPending}
          onClick={isDialog ? undefined : () => submitSelection()}
          className="flex h-auto min-h-11 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-xl bg-store-accent px-3 py-2 text-sm font-bold hover:bg-store-primary-dark"
        >
          <span>
            {quoteMutation.isPending
              ? locale === 'ar'
                ? 'جارٍ الحفظ…'
                : 'Saving…'
              : editLine
                ? locale === 'ar'
                  ? 'حفظ التعديلات'
                  : 'Save changes'
                : t.addConfigured}
          </span>
          <bdi className="text-xs" dir="auto">
            {formatStorefrontPrice(displayTotal, locale)}
          </bdi>
        </Button>
      </div>
      <p className="text-[10px] leading-4 text-store-muted">
        {locale === 'ar'
          ? 'السعر المعروض تقديري لحد مراجعة الاختيارات عند الحفظ.'
          : 'Price is estimated until options are checked on save.'}
      </p>
    </div>
  );

  if (!isDialog)
    return (
      <section
        aria-label={t.customize}
        className="grid min-w-0 gap-5 rounded-2xl border border-store-border bg-white p-4"
      >
        {optionFieldsets}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 rounded-b-2xl border-t border-store-border bg-white p-3 shadow-sm lg:static">
          {actions}
        </div>
      </section>
    );

  return (
    <dialog
      ref={dialogRef}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      aria-labelledby={`customizer-title-${product.id}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onClose?.();
      }}
      onClose={() => onClose?.()}
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting.current) onClose?.();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[380px] overflow-hidden rounded-3xl border border-store-border bg-white p-0 text-store-ink shadow-2xl backdrop:bg-store-ink/55 open:flex open:flex-col"
    >
      <form onSubmit={submitSelection} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
          {imageUrl && (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-store-cream">
              <Image src={imageUrl} alt="" fill sizes="56px" unoptimized className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p id={`customizer-title-${product.id}`} className="text-base font-bold">
              {product.name}
            </p>
            {product.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-store-muted">
                {product.description}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={quoteMutation.isPending}
            onClick={() => onClose?.()}
            aria-label={t.close}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-store-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent disabled:opacity-40"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain px-5 pb-5">
          {optionFieldsets}
        </div>
        <div className="shrink-0 border-t border-store-border bg-white p-4">{actions}</div>
      </form>
    </dialog>
  );
}
