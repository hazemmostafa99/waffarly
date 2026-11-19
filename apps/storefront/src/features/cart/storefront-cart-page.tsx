'use client';

import { useState } from 'react';
import { StorefrontProductCustomizer } from '../catalog/storefront-product-customizer';
import type { StorefrontCartLine } from './storefront-store';
import Link from '../../components/storefront/storefront-link';
import Image from 'next/image';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, Utensils } from 'lucide-react';
import type { CatalogProductQuoteResponse, PublicStorefrontCatalog } from '@waffarly/contracts';
import { Button, Card } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { apiPost } from '../../lib/api-client';
import { storefrontCopy } from '../../lib/storefront-copy';
import { formatStorefrontPrice, fromMinorUnits, toMinorUnits } from '../../lib/storefront-format';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { storefrontQueryKeys } from '../catalog/storefront-query-keys';

export function StorefrontCartPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const [editing, setEditing] = useState<StorefrontCartLine | null>(null);
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const cart = useStorefrontStore((state) => state.cart);
  const hasHydrated = useStorefrontStore((state) => state.hasHydrated);
  const setQuantity = useStorefrontStore((state) => state.setCartQuantity);
  const removeLine = useStorefrontStore((state) => state.removeCartLine);
  const products = new Map(catalog.products.map((product) => [product.id, product]));

  const quoteQueries = useQueries({
    queries: cart.map((line) => ({
      queryKey: storefrontQueryKeys.quote(
        catalog.slug,
        line.productId,
        line.variantId,
        line.selections,
      ),
      queryFn: () =>
        apiPost<CatalogProductQuoteResponse>(
          `/catalog/stores/${encodeURIComponent(catalog.slug)}/products/${encodeURIComponent(line.productId)}/quote`,
          {
            ...(line.variantId ? { variantId: line.variantId } : {}),
            selections: line.selections,
          },
        ),
      enabled: hasHydrated && products.has(line.productId),
      staleTime: 0,
      refetchOnMount: 'always' as const,
    })),
  });

  if (!hasHydrated) {
    return (
      <main
        id="main-content"
        className="mx-auto min-h-[65vh] max-w-[1000px] px-4 py-12 sm:px-8"
        aria-label={t.cart}
      >
        <div className="h-96 animate-pulse rounded-3xl bg-white" />
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main
        id="main-content"
        className="mx-auto grid min-h-[65vh] max-w-[760px] content-center justify-items-center px-5 py-12 text-center"
      >
        <span className="grid size-16 place-items-center rounded-3xl bg-store-primary/10 text-store-primary">
          <ShoppingBag className="size-8" aria-hidden="true" />
        </span>
        <h1 className="sr-only">{t.basket}</h1>
        <p className="mt-2 text-storefront-body text-store-muted">{t.basketEmpty}</p>
        <Button
          asChild
          className="mt-5 rounded-xl bg-store-accent px-5 font-bold hover:bg-store-primary-dark"
        >
          <Link href={`/s/${catalog.slug}/menu`}>{t.startShopping}</Link>
        </Button>
      </main>
    );
  }

  const estimates = cart.map((line, index) => ({
    line,
    product: products.get(line.productId),
    quote: quoteQueries[index]?.data,
  }));
  const estimatedMinorUnits = estimates.reduce((sum, entry) => {
    const unitPrice = entry.quote?.totalPrice ?? entry.line.unitPriceSnapshot;
    return sum + toMinorUnits(unitPrice) * entry.line.quantity;
  }, 0);
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70vh] max-w-[1000px] px-4 pb-8 pt-4 sm:px-8 sm:pt-5"
    >
      <header className="sr-only">
        <p className="text-storefront-support font-extrabold text-store-accent">
          {catalog.merchantName}
        </p>
        <h1 className="mt-1 font-heading text-storefront-page font-black text-store-ink">
          {t.basket}
        </h1>
        <p className="mt-1 text-storefront-body text-store-muted">
          {cart
            .reduce((count, line) => count + line.quantity, 0)
            .toLocaleString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn')}{' '}
          {t.products}
        </p>
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-4">
        <section className="grid gap-2" aria-label={t.cart}>
          {estimates.map(({ line, product, quote }, index) => {
            const unitPrice = quote?.totalPrice ?? line.unitPriceSnapshot;
            const lineTotal = fromMinorUnits(toMinorUnits(unitPrice) * line.quantity);
            const variant = product?.variants.find((item) => item.id === line.variantId);
            const isUnavailable =
              !product || (line.variantId !== null && variant?.availability !== 'available');
            const image = product?.images.find((item) => item.isPrimary) ?? product?.images[0];
            const selectedOptions = product
              ? line.selections.flatMap((selection) => {
                  const group = product.modifierGroups.find(
                    (item) => item.id === selection.groupId,
                  );
                  return (group?.options ?? [])
                    .filter((option) => selection.optionIds.includes(option.id))
                    .map(
                      (option) =>
                        `${group?.name}: ${option.name} \u00d7 ${selection.optionQuantities?.find((entry) => entry.optionId === option.id)?.quantity ?? 1}`,
                    );
                })
              : [];

            return (
              <Card
                key={line.key}
                className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3 rounded-3xl border-store-border bg-white p-3 shadow-sm sm:grid-cols-[80px_minmax(0,1fr)_auto]"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-store-cream">
                  {image ? (
                    <Image
                      src={image.publicUrl}
                      alt={product?.name ?? ''}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-store-accent">
                      <Utensils className="size-7" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    disabled={!product}
                    onClick={() => setEditing(line)}
                    aria-label={`${locale === 'ar' ? 'تعديل اختيارات' : 'Edit options for'} ${product?.name ?? t.unavailable}`}
                    className="grid w-full min-w-0 justify-items-start gap-1.5 rounded-lg text-start transition hover:text-store-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-accent disabled:cursor-default"
                  >
                    <span className="break-words font-heading text-sm font-extrabold leading-6 text-store-primary-deep sm:text-[15px]">
                      {product?.name ?? t.unavailable}
                    </span>
                    {variant && (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-store-primary/5 px-2 py-0.5 text-xs leading-5 text-store-primary-deep">
                        <Utensils className="size-3 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words">
                          {variant.attributes.length
                            ? variant.attributes
                                .map(
                                  (attribute) => `${attribute.attributeName}: ${attribute.value}`,
                                )
                                .join(' · ')
                            : variant.name}
                        </span>
                      </span>
                    )}
                    {selectedOptions.length > 0 && (
                      <span className="break-words text-[11px] leading-5 text-store-muted">
                        {selectedOptions.join(' · ')}
                      </span>
                    )}
                  </button>
                  {isUnavailable && (
                    <p className="mt-1 text-xs font-bold text-store-error" role="alert">
                      {t.unavailable}
                    </p>
                  )}
                  {quoteQueries[index]?.isError && !isUnavailable && (
                    <p className="mt-1 text-xs text-store-error" role="status">
                      {locale === 'ar'
                        ? 'تعذر تحديث السعر. حاول تاني.'
                        : 'Could not refresh the price. Try again.'}
                    </p>
                  )}
                </div>
                <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-store-border pt-2 sm:col-span-1 sm:flex-nowrap sm:justify-start sm:gap-3 sm:border-s sm:border-t-0 sm:ps-3 sm:pt-0">
                  <div className="flex shrink-0 items-center rounded-full border border-store-border bg-store-page/60 p-0.5">
                    <button
                      type="button"
                      aria-label={locale === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}
                      disabled={line.quantity >= 99}
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                      className="grid size-8 place-items-center rounded-full text-store-primary transition hover:bg-store-primary/10 disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                    <output
                      aria-live="polite"
                      aria-label={locale === 'ar' ? 'الكمية' : 'Quantity'}
                      className="min-w-6 text-center text-sm font-bold tabular-nums"
                    >
                      {line.quantity}
                    </output>
                    <button
                      type="button"
                      aria-label={locale === 'ar' ? 'تقليل الكمية' : 'Decrease quantity'}
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                      className="grid size-8 place-items-center rounded-full text-store-primary transition hover:bg-store-primary/10"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`${t.remove}: ${product?.name ?? t.unavailable}`}
                    onClick={() => removeLine(line.key)}
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-store-error/20 text-store-error transition hover:bg-store-error/5"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0 border-s border-store-border ps-3">
                    <div className="rounded-2xl bg-store-primary/5 px-3 py-2 text-center">
                      {quote?.promotion && quote.originalTotalPrice && (
                        <del className="block text-[10px] text-store-muted">
                          <bdi dir="auto">
                            {formatStorefrontPrice(
                              fromMinorUnits(
                                toMinorUnits(quote.originalTotalPrice) * line.quantity,
                              ),
                              locale,
                            )}
                          </bdi>
                        </del>
                      )}
                      <strong className="font-heading text-sm font-extrabold text-store-primary-deep">
                        <bdi dir="auto">{formatStorefrontPrice(lineTotal, locale)}</bdi>
                      </strong>
                      <span className="block text-[9px] leading-3 text-store-muted">
                        <bdi dir="auto">
                          {line.quantity} × {formatStorefrontPrice(unitPrice, locale)}
                        </bdi>
                      </span>
                    </div>
                    {quote?.promotion && (
                      <span className="mt-1 block text-center text-[10px] text-store-primary">
                        {t.productDiscount} −
                        <bdi dir="auto">
                          {formatStorefrontPrice(
                            fromMinorUnits(
                              toMinorUnits(quote.promotion.discountAmount) * line.quantity,
                            ),
                            locale,
                          )}
                        </bdi>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        <aside className="lg:sticky lg:top-28">
          <Card className="rounded-2xl border-store-border bg-white p-4 shadow-sm">
            <h2 className="sr-only">{locale === 'ar' ? 'ملخص الطلب' : 'Order summary'}</h2>
            <div className="flex items-center justify-between gap-3 border-b border-store-border pb-3 text-storefront-support">
              <span className="text-store-muted">{t.productsSubtotal}</span>
              <strong className="font-heading text-base font-extrabold text-store-ink">
                <bdi dir="auto">
                  {formatStorefrontPrice(fromMinorUnits(estimatedMinorUnits), locale)}
                </bdi>
              </strong>
            </div>
            <Button
              asChild
              className="mt-3 h-10 w-full rounded-xl bg-store-accent font-heading text-sm font-extrabold hover:bg-store-primary-dark"
            >
              <Link href={`/s/${catalog.slug}/checkout`}>
                {t.checkout}
                <Arrow className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="mt-2 h-10 w-full rounded-xl border-store-border bg-white text-sm font-bold text-store-primary hover:bg-store-cream"
            >
              <Link href={`/s/${catalog.slug}/menu`}>{t.continueShopping}</Link>
            </Button>
          </Card>
        </aside>
      </div>
      {editing && products.get(editing.productId) && (
        <StorefrontProductCustomizer
          key={editing.key}
          product={products.get(editing.productId)!}
          slug={catalog.slug}
          editLine={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
