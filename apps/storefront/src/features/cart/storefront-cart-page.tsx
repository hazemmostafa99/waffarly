'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, Utensils } from 'lucide-react';
import type {
  CatalogProductQuoteResponse,
  PublicStorefrontCatalog,
} from '@waffarly/contracts';
import { Button, Card } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { apiPost } from '../../lib/api-client';
import { storefrontCopy } from '../../lib/storefront-copy';
import { formatStorefrontPrice, fromMinorUnits, toMinorUnits } from '../../lib/storefront-format';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { storefrontQueryKeys } from '../catalog/storefront-query-keys';

export function StorefrontCartPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const cart = useStorefrontStore((state) => state.cart);
  const hasHydrated = useStorefrontStore((state) => state.hasHydrated);
  const setQuantity = useStorefrontStore((state) => state.setCartQuantity);
  const removeLine = useStorefrontStore((state) => state.removeCartLine);
  const products = new Map(catalog.products.map((product) => [product.id, product]));

  const quoteQueries = useQueries({
    queries: cart.map((line) => ({
      queryKey: storefrontQueryKeys.quote(catalog.slug, line.productId, line.variantId, line.selections),
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
      <main id="main-content" className="mx-auto min-h-[65vh] max-w-[1000px] px-4 py-12 sm:px-8" aria-label={t.cart}>
        <div className="h-96 animate-pulse rounded-3xl bg-white" />
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main id="main-content" className="mx-auto grid min-h-[65vh] max-w-[760px] content-center justify-items-center px-5 py-16 text-center">
        <span className="grid size-20 place-items-center rounded-3xl bg-store-primary/10 text-store-primary">
          <ShoppingBag className="size-9" aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-heading text-3xl font-black text-store-ink">{t.basket}</h1>
        <p className="mt-2 text-base text-store-muted">{t.basketEmpty}</p>
        <Button asChild className="mt-7 rounded-xl bg-store-accent px-6 font-bold hover:bg-store-primary-dark">
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
    <main id="main-content" className="mx-auto min-h-[70vh] max-w-[1160px] px-4 pb-12 pt-8 sm:px-8 sm:pt-12">
      <header className="mb-7">
        <p className="text-sm font-extrabold text-store-accent">{catalog.merchantName}</p>
        <h1 className="mt-1 font-heading text-3xl font-black text-store-ink sm:text-4xl">{t.basket}</h1>
        <p className="mt-2 text-base text-store-muted">
          {cart.reduce((count, line) => count + line.quantity, 0).toLocaleString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG-u-nu-latn')} {t.products}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-8">
        <section className="grid gap-4" aria-label={t.cart}>
          {estimates.map(({ line, product, quote }, index) => {
            const variant = product?.variants.find((item) => item.id === line.variantId);
            const isUnavailable = !product || (line.variantId !== null && variant?.availability !== 'available');
            const image = product?.images.find((item) => item.isPrimary) ?? product?.images[0];
            const selectedOptions = product
              ? line.selections.flatMap((selection) => {
                  const group = product.modifierGroups.find((item) => item.id === selection.groupId);
                  return (group?.options ?? [])
                    .filter((option) => selection.optionIds.includes(option.id))
                    .map((option) => `${group?.name}: ${option.name}`);
                })
              : [];

            return (
              <Card key={line.key} className="grid gap-4 rounded-3xl border-store-border bg-white p-4 sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-center sm:p-5">
                <div className="relative aspect-[1.3] overflow-hidden rounded-2xl bg-store-cream sm:aspect-square">
                  {image ? (
                    <Image src={image.publicUrl} alt={product?.name ?? ''} fill sizes="130px" className="object-cover" unoptimized />
                  ) : (
                    <span className="grid size-full place-items-center text-store-accent"><Utensils className="size-8" aria-hidden="true" /></span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-extrabold text-store-ink">{product?.name ?? t.unavailable}</h2>
                  {variant && (
                    <p className="mt-1 text-sm text-store-muted">
                      {variant.attributes.length
                        ? variant.attributes.map((attribute) => `${attribute.attributeName}: ${attribute.value}`).join(' · ')
                        : variant.name}
                    </p>
                  )}
                  {selectedOptions.length > 0 && (
                    <ul className="mt-2 grid gap-1 text-xs leading-5 text-store-muted">
                      {selectedOptions.map((option) => <li key={option}>{option}</li>)}
                    </ul>
                  )}
                  {isUnavailable && (
                    <p className="mt-2 text-sm font-bold text-store-error" role="alert">{t.unavailable}</p>
                  )}
                  {quoteQueries[index]?.isError && !isUnavailable && (
                    <p className="mt-2 text-xs font-bold text-store-gold-muted" role="status">{t.priceNote}</p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={locale === 'ar' ? 'تقليل الكمية' : 'Decrease quantity'}
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                      className="grid size-10 place-items-center rounded-full border border-store-border bg-white text-store-primary hover:bg-store-cream"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <output aria-live="polite" className="min-w-8 text-center font-bold tabular-nums">{line.quantity}</output>
                    <button
                      type="button"
                      aria-label={locale === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}
                      disabled={line.quantity >= 99}
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                      className="grid size-10 place-items-center rounded-full border border-store-border bg-white text-store-primary hover:bg-store-cream disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="ms-auto inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-store-error hover:bg-store-error/5"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />{t.remove}
                    </button>
                  </div>
                </div>
                <div className="text-end sm:min-w-28">
                  <strong className="font-heading text-lg font-extrabold text-store-primary-deep">
                    <bdi dir="auto">{formatStorefrontPrice(quote?.totalPrice ?? line.unitPriceSnapshot, locale)}</bdi>
                  </strong>
                  <span className="mt-1 block text-xs text-store-muted">
                    {locale === 'ar' ? 'للقطعة' : 'per item'}
                  </span>
                </div>
              </Card>
            );
          })}
        </section>

        <aside className="lg:sticky lg:top-28">
          <Card className="rounded-3xl border-store-border bg-white p-5 shadow-[0_12px_36px_rgba(23,35,48,0.06)] sm:p-6">
            <h2 className="font-heading text-xl font-extrabold text-store-ink">{locale === 'ar' ? 'ملخص الطلب' : 'Order summary'}</h2>
            <div className="mt-5 flex items-center justify-between gap-3 border-b border-store-border pb-4 text-sm">
              <span className="text-store-muted">{t.estimatedSubtotal}</span>
              <strong className="font-heading text-lg font-extrabold text-store-ink">
                <bdi dir="auto">{formatStorefrontPrice(fromMinorUnits(estimatedMinorUnits), locale)}</bdi>
              </strong>
            </div>
            <p className="mt-4 rounded-xl bg-store-cream px-3 py-3 text-xs leading-5 text-store-muted">{t.priceNote}</p>
            <Button asChild className="mt-5 h-12 w-full rounded-xl bg-store-accent font-heading font-extrabold hover:bg-store-primary-dark">
              <Link href={`/s/${catalog.slug}/checkout`}>
                {t.checkout}<Arrow className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="mt-3 h-12 w-full rounded-xl border-store-border bg-white font-bold text-store-primary hover:bg-store-cream">
              <Link href={`/s/${catalog.slug}/menu`}>{t.continueShopping}</Link>
            </Button>
          </Card>
        </aside>
      </div>
    </main>
  );
}
