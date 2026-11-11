'use client';

import { useState, type FormEvent } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, ShoppingBag } from 'lucide-react';
import type {
  CatalogProductQuoteResponse,
  CreateStorefrontOrderRequest,
  PublicStorefrontCatalog,
  StorefrontOrderReceipt,
} from '@waffarly/contracts';
import { Button, Card, Input, Textarea } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { apiPost } from '../../lib/api-client';
import { formatStorefrontPrice } from '../../lib/storefront-format';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { storefrontQueryKeys } from '../catalog/storefront-query-keys';

type CheckoutFields = {
  customerName: string;
  customerPhone: string;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress: string;
};

export function StorefrontCheckoutPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const cart = useStorefrontStore((state) => state.cart);
  const hasHydrated = useStorefrontStore((state) => state.hasHydrated);
  const clearCart = useStorefrontStore((state) => state.clearCart);
  const [fields, setFields] = useState<CheckoutFields>({
    customerName: '',
    customerPhone: '',
    fulfillmentType: 'pickup',
    deliveryAddress: '',
  });

  const orderMutation = useMutation({
    mutationKey: storefrontQueryKeys.order(catalog.slug),
    mutationFn: async (checkout: CheckoutFields) => {
      if (cart.length === 0) throw new Error(t.basketEmpty);

      await Promise.all(
        cart.map((line) =>
          apiPost<CatalogProductQuoteResponse>(
            `/catalog/stores/${encodeURIComponent(catalog.slug)}/products/${encodeURIComponent(line.productId)}/quote`,
            {
              ...(line.variantId ? { variantId: line.variantId } : {}),
              selections: line.selections,
            },
          ),
        ),
      );

      const request: CreateStorefrontOrderRequest = {
        customerName: checkout.customerName.trim(),
        customerPhone: checkout.customerPhone.trim(),
        fulfillmentType: checkout.fulfillmentType,
        ...(checkout.fulfillmentType === 'delivery'
          ? { deliveryAddress: checkout.deliveryAddress.trim() }
          : {}),
        items: cart.map((line) => ({
          productId: line.productId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          selections: line.selections,
          quantity: line.quantity,
        })),
      };

      return apiPost<StorefrontOrderReceipt>(
        `/catalog/stores/${encodeURIComponent(catalog.slug)}/orders`,
        request,
      );
    },
    onSuccess: () => clearCart(),
  });

  function update<K extends keyof CheckoutFields>(key: K, value: CheckoutFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderMutation.isPending) orderMutation.mutate(fields);
  }

  if (!hasHydrated) {
    return <main id="main-content" className="mx-auto min-h-[60vh] max-w-[1100px] px-4 py-10 sm:px-8"><div className="h-80 animate-pulse rounded-3xl bg-white" /></main>;
  }

  if (orderMutation.data) {
    const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
    return (
      <main id="main-content" className="mx-auto grid min-h-[70vh] max-w-[760px] content-center justify-items-center px-5 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-store-primary/10 text-store-primary">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-heading text-storefront-page font-black text-store-primary-deep">{t.orderReceived}</h1>
        <p className="mt-2 max-w-xl text-storefront-body text-store-muted">{t.orderPending}</p>
        <Card className="mt-5 grid w-full gap-3 rounded-3xl border-store-border bg-white p-4 text-start sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-store-muted">{t.orderReference}</span>
            <strong className="font-heading text-base font-extrabold text-store-ink" dir="ltr">
              {orderMutation.data.id.slice(0, 8).toLocaleUpperCase()}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-store-border pt-4">
            <span className="text-sm font-bold text-store-muted">{t.orderTotal}</span>
            <strong className="font-heading text-storefront-price font-extrabold text-store-primary-deep">
              <bdi dir="auto">{formatStorefrontPrice(orderMutation.data.total, locale)}</bdi>
            </strong>
          </div>
        </Card>
        <p className="mt-4 text-sm text-store-muted">{t.noPayment}</p>
        <Button asChild className="mt-5 h-11 rounded-xl bg-store-accent px-5 font-bold hover:bg-store-primary-dark">
          <Link href={`/s/${catalog.slug}`}>
            {t.home}<Arrow className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main id="main-content" className="mx-auto grid min-h-[65vh] max-w-[760px] content-center justify-items-center px-5 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-store-cream text-store-accent"><ShoppingBag className="size-8" aria-hidden="true" /></span>
        <h1 className="mt-4 font-heading text-storefront-page font-black text-store-ink">{t.basketEmpty}</h1>
        <Button asChild className="mt-5 rounded-xl bg-store-accent px-5 font-bold hover:bg-store-primary-dark"><Link href={`/s/${catalog.slug}/menu`}>{t.startShopping}</Link></Button>
      </main>
    );
  }

  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  return (
    <main id="main-content" className="mx-auto min-h-[70vh] max-w-[1100px] px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
      <header className="mb-5">
        <p className="text-storefront-support font-extrabold text-store-accent">{catalog.merchantName}</p>
        <h1 className="mt-1 font-heading text-storefront-page font-black text-store-ink">{t.checkoutTitle}</h1>
        <p className="mt-1 text-storefront-body text-store-muted">{t.checkoutIntro}</p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <form onSubmit={submit} className="grid gap-4">
          <Card className="grid gap-4 rounded-3xl border-store-border bg-white p-4 sm:p-5">
            <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">{locale === 'ar' ? 'بيانات العميل' : 'Your details'}</h2>
            <label className="grid gap-2 text-sm font-bold text-store-ink">
              {t.customerName}
              <Input
                autoComplete="name"
                value={fields.customerName}
                onChange={(event) => update('customerName', event.currentTarget.value)}
                placeholder={t.namePlaceholder}
                minLength={2}
                maxLength={120}
                required
                className="h-12 rounded-xl border-store-border bg-white text-base"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-store-ink">
              {t.customerPhone}
              <Input
                autoComplete="tel"
                type="tel"
                inputMode="tel"
                value={fields.customerPhone}
                onChange={(event) => update('customerPhone', event.currentTarget.value)}
                placeholder={t.phonePlaceholder}
                minLength={7}
                maxLength={32}
                pattern="[+0-9 .()\\-]{7,32}"
                required
                className="h-12 rounded-xl border-store-border bg-white text-base"
                dir="ltr"
              />
            </label>
          </Card>

          <Card className="grid gap-4 rounded-3xl border-store-border bg-white p-4 sm:p-5">
            <fieldset className="grid gap-3">
              <legend className="mb-2 font-heading text-storefront-subsection font-extrabold text-store-ink">{t.fulfillment}</legend>
              {([
                { value: 'pickup', label: t.pickup },
                { value: 'delivery', label: t.delivery },
              ] as const).map((option) => (
                <label key={option.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 transition ${fields.fulfillmentType === option.value ? 'border-store-primary bg-store-primary/5' : 'border-store-border bg-white hover:bg-store-page'}`}>
                  <input
                    type="radio"
                    name="fulfillment"
                    value={option.value}
                    checked={fields.fulfillmentType === option.value}
                    onChange={() => update('fulfillmentType', option.value)}
                    className="size-4 accent-store-primary"
                  />
                  <span className="font-bold text-store-ink">{option.label}</span>
                </label>
              ))}
            </fieldset>
            {fields.fulfillmentType === 'delivery' && (
              <label className="grid gap-2 text-sm font-bold text-store-ink">
                {t.address}
                <Textarea
                  autoComplete="street-address"
                  value={fields.deliveryAddress}
                  onChange={(event) => update('deliveryAddress', event.currentTarget.value)}
                  placeholder={t.addressPlaceholder}
                  minLength={8}
                  maxLength={1000}
                  required
                  className="min-h-28 rounded-xl border-store-border bg-white text-base"
                />
              </label>
            )}
          </Card>

          {orderMutation.isError && (
            <p className="rounded-2xl border border-store-error/20 bg-store-error/5 px-4 py-3 text-sm font-bold leading-6 text-store-error" role="alert">
              {orderMutation.error.message || t.orderError}
            </p>
          )}

          <Button type="submit" disabled={orderMutation.isPending} className="h-11 rounded-xl bg-store-accent font-heading text-sm font-extrabold hover:bg-store-primary-dark">
            {orderMutation.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
            {orderMutation.isPending ? t.submittingOrder : t.submitOrder}
            {!orderMutation.isPending && <Arrow className="size-4" aria-hidden="true" />}
          </Button>
          <p className="text-center text-xs leading-5 text-store-muted">{t.noPayment}</p>
        </form>

        <aside className="lg:sticky lg:top-28">
          <Card className="rounded-3xl border-store-border bg-white p-4 shadow-[0_12px_36px_rgba(23,35,48,0.06)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">{locale === 'ar' ? 'ملخص السلة' : 'Basket summary'}</h2>
              <span className="rounded-full bg-store-cream px-3 py-1 text-xs font-extrabold text-store-primary">
                {cart.reduce((count, line) => count + line.quantity, 0)}
              </span>
            </div>
            <ul className="mt-4 grid gap-3">
              {cart.map((line) => {
                const product = catalog.products.find((item) => item.id === line.productId);
                return (
                  <li key={line.key} className="flex items-start justify-between gap-3 border-b border-store-border pb-3 text-sm">
                    <span className="min-w-0 font-medium text-store-muted">{line.quantity} × {product?.name ?? t.unavailable}</span>
                    <strong className="shrink-0 font-bold text-store-ink"><bdi dir="auto">{formatStorefrontPrice(line.unitPriceSnapshot, locale)}</bdi></strong>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 rounded-xl bg-store-cream px-3 py-3 text-xs leading-5 text-store-muted">{t.priceNote}</p>
            <Button asChild variant="outline" className="mt-3 h-11 w-full rounded-xl border-store-border font-bold text-store-primary hover:bg-store-cream">
              <Link href={`/s/${catalog.slug}/cart`}>{locale === 'ar' ? 'العودة إلى السلة' : 'Back to basket'}</Link>
            </Button>
          </Card>
        </aside>
      </div>
    </main>
  );
}
