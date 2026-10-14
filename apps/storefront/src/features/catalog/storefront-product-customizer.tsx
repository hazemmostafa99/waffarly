'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
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
import { formatStorefrontPrice } from '../../lib/storefront-format';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { storefrontQueryKeys } from './storefront-query-keys';

type ProductCustomizerProps = {
  product: PublicStorefrontProduct;
  slug: string;
  presentation?: 'dialog' | 'inline';
  onClose?: () => void;
};

export function StorefrontProductCustomizer({
  product,
  slug,
  presentation = 'dialog',
  onClose,
}: ProductCustomizerProps) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addCartLine = useStorefrontStore((state) => state.addCartLine);
  const [variantId, setVariantId] = useState(
    product.variants.find((variant) => variant.availability === 'available')?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [wasAdded, setWasAdded] = useState(false);
  const [choices, setChoices] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      product.modifierGroups.map((group) => [
        group.id,
        group.options.filter((option) => option.defaultSelected).map((option) => option.id),
      ]),
    ),
  );
  const isDialog = presentation === 'dialog';

  const selections = useMemo<CatalogProductQuoteSelection[]>(
    () => product.modifierGroups.map((group) => ({ groupId: group.id, optionIds: choices[group.id] ?? [] })),
    [choices, product.modifierGroups],
  );
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const isSelectionValid =
    (!product.variants.length || selectedVariant?.availability === 'available') &&
    product.modifierGroups.every((group) => {
      const count = choices[group.id]?.length ?? 0;
      return count >= group.minSelections && count <= group.maxSelections;
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
    if (isDialog && dialog && !dialog.open) dialog.showModal();
  }, [isDialog]);

  function makeQuoteRequest(): CatalogProductQuoteRequest {
    return { ...(product.variants.length ? { variantId } : {}), selections };
  }

  function addQuoteToBasket(quote: CatalogProductQuoteResponse, lineQuantity = quantity) {
    addCartLine({
      productId: quote.productId,
      variantId: quote.variantId,
      selections: quote.selections.map(({ groupId, optionIds }) => ({ groupId, optionIds })),
      quantity: lineQuantity,
      unitPriceSnapshot: quote.totalPrice,
    });
  }

  function clearQuote() {
    quoteMutation.reset();
    setWasAdded(false);
  }

  function updateChoice(groupId: string, optionId: string, checked: boolean, single: boolean) {
    setChoices((current) => {
      const existing = current[groupId] ?? [];
      const next = single
        ? checked ? [optionId] : existing.filter((id) => id !== optionId)
        : checked ? [...existing, optionId] : existing.filter((id) => id !== optionId);
      return { ...current, [groupId]: next };
    });
    clearQuote();
  }

  function checkPrice() {
    if (!isSelectionValid) return;
    quoteMutation.mutate(makeQuoteRequest());
  }

  function addToBasket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quoteMutation.data) return;
    addQuoteToBasket(quoteMutation.data);
    onClose?.();
  }

  function quoteAndAddToBasket() {
    if (!isSelectionValid || quoteMutation.isPending) return;
    setWasAdded(false);
    quoteMutation.mutate(makeQuoteRequest(), {
      onSuccess: (quote) => {
        addQuoteToBasket(quote);
        setWasAdded(true);
      },
    });
  }

  const optionFieldsets = (
    <>
      {product.variants.length > 0 && (
        <fieldset className="grid gap-3 rounded-2xl border border-store-border bg-white p-4 sm:p-5">
          <legend className="px-1 font-heading font-extrabold text-store-ink">{t.chooseVariant}</legend>
          <div className="grid gap-2">
            {product.variants.map((variant) => {
              const unavailable = variant.availability !== 'available';
              const label = variant.attributes.length
                ? variant.attributes.map((attribute) => `${attribute.attributeName}: ${attribute.value}`).join(' · ')
                : variant.name;
              return (
                <label
                  key={variant.id}
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 transition ${unavailable ? 'cursor-not-allowed border-store-border bg-store-page/60 opacity-55' : 'cursor-pointer border-store-border bg-white hover:border-store-accent/60 has-[:checked]:border-store-primary has-[:checked]:bg-store-primary/5'}`}
                >
                  <input
                    type="radio"
                    name={`variant-${product.id}`}
                    value={variant.id}
                    checked={variantId === variant.id}
                    disabled={unavailable || quoteMutation.isPending}
                    onChange={() => { setVariantId(variant.id); clearQuote(); }}
                    className="size-[18px] shrink-0 accent-store-primary"
                  />
                  <span className="min-w-0 flex-1 font-bold text-store-ink">{label}</span>
                  <span className="shrink-0 text-sm font-extrabold text-store-accent">
                    {unavailable ? t.unavailable : <bdi dir="auto">{formatStorefrontPrice(variant.price, locale)}</bdi>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {product.modifierGroups.map((group) => {
        const single = group.selectionMode === 'single';
        const selected = choices[group.id] ?? [];
        return (
          <fieldset key={group.id} className="grid gap-3 rounded-2xl border border-store-border bg-white p-4 sm:p-5">
            <legend className="px-1 font-heading font-extrabold text-store-ink">
              {group.name}{' '}
              <span className="font-body text-xs font-bold text-store-muted">{group.minSelections > 0 ? t.required : t.optional}</span>
            </legend>
            {group.description && <p className="-mt-1 text-sm leading-6 text-store-muted">{group.description}</p>}

            <div className="grid gap-2">
              {single && group.minSelections === 0 && (
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-store-border px-3 py-2 hover:border-store-accent/60 has-[:checked]:border-store-primary has-[:checked]:bg-store-primary/5">
                  <input
                    type="radio"
                    name={`modifier-${group.id}`}
                    checked={selected.length === 0}
                    disabled={quoteMutation.isPending}
                    onChange={() => { setChoices((current) => ({ ...current, [group.id]: [] })); clearQuote(); }}
                    className="size-[18px] shrink-0 accent-store-primary"
                  />
                  <span className="flex-1 font-medium text-store-ink">{t.noChoice}</span>
                </label>
              )}

              {group.options.map((option) => {
                const checked = selected.includes(option.id);
                const disabled = quoteMutation.isPending || (!checked && selected.length >= group.maxSelections);
                const adjustment = Number(option.priceAdjustment);
                return (
                  <label
                    key={option.id}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 transition ${disabled && !checked ? 'cursor-not-allowed border-store-border bg-store-page/60 opacity-55' : 'cursor-pointer border-store-border hover:border-store-accent/60 has-[:checked]:border-store-primary has-[:checked]:bg-store-primary/5'}`}
                  >
                    <input
                      type={single ? 'radio' : 'checkbox'}
                      name={`modifier-${group.id}`}
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) => updateChoice(group.id, option.id, event.currentTarget.checked, single)}
                      className="size-[18px] shrink-0 accent-store-primary"
                    />
                    <span className="min-w-0 flex-1 font-medium text-store-ink">{option.name}</span>
                    <span className="shrink-0 text-sm font-bold text-store-accent">
                      {adjustment > 0 ? '+ ' : ''}<bdi dir="auto">{formatStorefrontPrice(option.priceAdjustment, locale)}</bdi>
                    </span>
                  </label>
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

  const quantityControl = (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl bg-store-cream px-4 py-2.5">
      <span className="font-heading font-extrabold text-store-ink">{t.quantity}</span>
      <div className="flex h-11 items-center gap-3 rounded-full border border-store-border bg-white px-2">
        <button
          type="button"
          aria-label={t.decreaseQuantity}
          disabled={quantity <= 1 || quoteMutation.isPending}
          onClick={() => { setQuantity((value) => Math.max(1, value - 1)); setWasAdded(false); }}
          className="grid size-8 place-items-center rounded-full text-store-primary transition hover:bg-store-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <output className="min-w-5 text-center font-bold tabular-nums" aria-label={t.quantity} aria-live="polite">{quantity}</output>
        <button
          type="button"
          aria-label={t.increaseQuantity}
          disabled={quantity >= 99 || quoteMutation.isPending}
          onClick={() => { setQuantity((value) => Math.min(99, value + 1)); setWasAdded(false); }}
          className="grid size-8 place-items-center rounded-full text-store-primary transition hover:bg-store-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const quoteFeedback = (
    <>
      {quoteMutation.isError && (
        <p className="rounded-xl border border-store-error/20 bg-store-error/5 px-4 py-3 text-sm font-medium text-store-error" role="alert">
          {quoteMutation.error.message || t.priceError}
        </p>
      )}
      {quoteMutation.data && (
        <div className="flex items-center justify-between rounded-2xl bg-store-primary/10 px-4 py-3 text-sm text-store-primary" role="status">
          <span className="font-bold">{t.currentPrice}</span>
          <strong className="font-heading text-lg font-extrabold text-store-primary-deep">
            <bdi dir="auto">{formatStorefrontPrice(quoteMutation.data.totalPrice, locale)}</bdi>
          </strong>
        </div>
      )}
      {wasAdded && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-store-primary/10 px-4 py-3 text-sm text-store-primary-deep" role="status">
          <span className="font-bold">{t.addedToBasket}</span>
          <Link href={`/s/${slug}/cart`} className="font-extrabold underline underline-offset-2 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent">
            {t.viewBasket}
          </Link>
        </div>
      )}
    </>
  );

  const actions = isDialog ? (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        type="button"
        variant="outline"
        disabled={!isSelectionValid || quoteMutation.isPending}
        onClick={checkPrice}
        className="h-12 rounded-xl border-store-border bg-white font-bold text-store-primary hover:bg-store-cream"
      >
        {quoteMutation.isPending ? t.checkingPrice : t.checkPrice}
      </Button>
      <Button
        type="submit"
        disabled={!quoteMutation.data || quoteMutation.isPending}
        className="h-12 rounded-xl bg-store-accent font-bold text-white hover:bg-store-primary-dark"
      >
        {t.addConfigured}
      </Button>
    </div>
  ) : (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
      {quantityControl}
      <Button
        type="button"
        disabled={!isSelectionValid || quoteMutation.isPending}
        onClick={quoteAndAddToBasket}
        className="h-13 rounded-xl bg-store-accent font-heading text-base font-extrabold text-white shadow-sm hover:bg-store-primary-dark"
      >
        {quoteMutation.isPending ? t.checkingPrice : t.addConfigured}
        {quoteMutation.isPending ? null : <Plus className="size-4" aria-hidden="true" />}
      </Button>
    </div>
  );

  if (!isDialog) {
    return (
      <section aria-label={t.customize} className="grid min-w-0 gap-3 sm:gap-4">
        {optionFieldsets}
        {quoteFeedback}
        <div className="sticky bottom-0 z-10 -mx-4 rounded-t-2xl border-t border-store-border bg-white/95 p-4 shadow-[0_-8px_24px_rgba(23,35,48,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:static sm:mx-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
          {actions}
        </div>
      </section>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`customizer-title-${product.id}`}
      onCancel={(event) => { event.preventDefault(); onClose?.(); }}
      onClose={() => onClose?.()}
      onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
      className="fixed inset-0 m-auto max-h-[min(92vh,860px)] w-[min(100%-24px,620px)] overflow-y-auto rounded-[1.6rem] border border-store-border bg-store-page p-0 text-store-ink shadow-2xl backdrop:bg-store-ink/55"
    >
      <form onSubmit={addToBasket} className="grid gap-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-store-accent">{t.customize}</p>
            <h2 id={`customizer-title-${product.id}`} className="mt-1 font-heading text-2xl font-extrabold">
              {product.name}
            </h2>
            {product.description && <p className="mt-2 text-sm leading-6 text-store-muted">{product.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label={t.close}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-store-border bg-white text-store-ink transition hover:bg-store-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {optionFieldsets}
        {quantityControl}
        {quoteFeedback}
        {actions}
      </form>
    </dialog>
  );
}
