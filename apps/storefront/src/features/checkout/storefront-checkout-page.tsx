'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, ShoppingBag } from 'lucide-react';
import type {
  CatalogProductQuoteResponse,
  CreateStorefrontOrderRequest,
  StorefrontCustomerAddress,
  PublicStorefrontCatalog,
  StorefrontOrderReceipt,
  StorefrontCheckoutQuote,
} from '@waffarly/contracts';
import { Button, Card, Input, Textarea } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { ApiError, apiPost } from '../../lib/api-client';
import {
  RestaurantRouteFields,
  useRestaurantFulfillment,
} from '../delivery/restaurant-route-fields';
import { useStorefrontCustomer } from '../account/hooks/use-storefront-customer';
import {
  loadStorefrontCustomer,
  loadStorefrontCustomerAddresses,
  storefrontCustomerAddressesKey,
} from '../account/data/storefront-customer-api';
import { StorefrontSignInLink } from '../account/storefront-sign-in-link';
import { formatStorefrontPrice } from '../../lib/storefront-format';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { storefrontQueryKeys } from '../catalog/storefront-query-keys';
import { saveStorefrontOrderReceipt } from '../orders/storefront-order-receipt-session';

type CheckoutFields = {
  customerName: string;
  customerPhone: string;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress: string;
  discountCode: string;
};

export function StorefrontCheckoutPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const cart = useStorefrontStore((state) => state.cart);
  const hasHydrated = useStorefrontStore((state) => state.hasHydrated);
  const clearCart = useStorefrontStore((state) => state.clearCart);
  const session = useStorefrontCustomer();
  const savedAddresses = useQuery({
    queryKey: storefrontCustomerAddressesKey(catalog.slug, session.data?.id),
    queryFn: () => loadStorefrontCustomerAddresses(catalog.slug),
    enabled: Boolean(session.data),
    retry: false,
  });
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const appliedDefaultAddress = useRef(false);
  const addressOwner = useRef<{ slug: string; customerId?: string }>({ slug: catalog.slug });
  const fulfillmentType = useStorefrontStore((state) => state.fulfillmentType);
  const setFulfillmentType = useStorefrontStore((state) => state.setFulfillmentType);
  const deliveryAreaId = useStorefrontStore((state) => state.deliveryAreaId);
  const setDeliveryAreaId = useStorefrontStore((state) => state.setDeliveryAreaId);
  const pickup = useStorefrontStore((state) => state.pickupBranchId);
  const setPickup = useStorefrontStore((state) => state.setPickupBranchId);
  const [draft, setDraft] = useState<{
    customerName?: string;
    customerPhone?: string;
    deliveryAddress: string;
    discountCode: string;
  }>({
    deliveryAddress: '',
    discountCode: '',
  });
  // Undefined means untouched: a late session response can fill defaults without overwriting edits.
  const fields: CheckoutFields = {
    ...draft,
    customerName: draft.customerName ?? session.data?.name ?? '',
    customerPhone: draft.customerPhone ?? session.data?.phone ?? '',
    fulfillmentType,
  };
  const [quote, setQuote] = useState<StorefrontCheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [reviewed, setReviewed] = useState<{ key: string; quote: StorefrontCheckoutQuote } | null>(
    null,
  );
  const applySavedAddress = useCallback(
    (address: StorefrontCustomerAddress) => {
      setSelectedSavedAddressId(address.id);
      setDeliveryAreaId(address.deliveryAreaId);
      setDraft((current) => ({
        ...current,
        deliveryAddress: [
          address.governorate,
          address.locality,
          address.area,
          address.streetAddress,
          address.notes ? `${locale === 'ar' ? 'ملاحظات' : 'Notes'}: ${address.notes}` : '',
        ]
          .filter(Boolean)
          .join('، '),
      }));
      setQuote(null);
      setQuoteError('');
      setReviewed(null);
    },
    [locale, setDeliveryAreaId],
  );

  useEffect(() => {
    const previousOwner = addressOwner.current;
    const nextOwner: { slug: string; customerId?: string } = {
      slug: catalog.slug,
      ...(session.data?.id ? { customerId: session.data.id } : {}),
    };
    const merchantChanged = previousOwner.slug !== nextOwner.slug;
    const signedInCustomerChanged = Boolean(
      previousOwner.customerId && previousOwner.customerId !== nextOwner.customerId,
    );
    if (merchantChanged || signedInCustomerChanged) {
      setDraft((current) => ({
        ...current,
        customerName: undefined,
        customerPhone: undefined,
        deliveryAddress: '',
        ...(merchantChanged ? { discountCode: '' } : {}),
      }));
    }
    addressOwner.current = nextOwner;
    appliedDefaultAddress.current = false;
    setSelectedSavedAddressId('');
  }, [catalog.slug, session.data?.id]);

  useEffect(() => {
    if (!savedAddresses.isSuccess || appliedDefaultAddress.current) return;
    appliedDefaultAddress.current = true;
    if (fields.deliveryAddress || deliveryAreaId) return;
    const defaultAddress = savedAddresses.data.find((address) => address.isDefault);
    if (defaultAddress) applySavedAddress(defaultAddress);
  }, [
    applySavedAddress,
    deliveryAreaId,
    savedAddresses.isSuccess,
    savedAddresses.data,
    fields.deliveryAddress,
  ]);
  const restaurant = catalog.activity === 'restaurant';
  const options = useRestaurantFulfillment(restaurant ? catalog.slug : undefined);
  const attempt = useRef<CreateStorefrontOrderRequest | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const branchRouting = options.data?.onlineBranches !== undefined;
  const availablePickupBranches = options.data?.onlineBranches?.filter(
    (branch) => branch.pickup && branch.acceptingOrders,
  );
  const effectivePickup =
    availablePickupBranches?.length === 1
      ? (availablePickupBranches[0]?.branchId ?? '')
      : (availablePickupBranches?.find((branch) => branch.branchId === pickup)?.branchId ?? '');
  const routeInput =
    fields.fulfillmentType === 'delivery' && deliveryAreaId
      ? { deliveryAreaId }
      : fields.fulfillmentType === 'pickup' && branchRouting && effectivePickup
        ? { pickupBranchId: effectivePickup }
        : {};
  const reviewKey = JSON.stringify({ cart, fields, routeInput });
  const reviewedQuote = reviewed?.key === reviewKey ? reviewed.quote : null;

  function quoteRequest() {
    return apiPost<StorefrontCheckoutQuote>(
      `/catalog/stores/${encodeURIComponent(catalog.slug)}/orders/quote`,
      {
        fulfillmentType: fields.fulfillmentType,
        ...routeInput,
        items: cart.map((line) => ({
          productId: line.productId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          selections: line.selections,
          quantity: line.quantity,
        })),
        ...(fields.discountCode.trim()
          ? { discountCode: fields.discountCode.trim().toUpperCase() }
          : {}),
      },
    );
  }

  const reviewMutation = useMutation({
    mutationFn: async () => ({ key: reviewKey, quote: await quoteRequest() }),
    onSuccess: (result) => {
      setReviewed(result);
      setQuote(result.quote);
    },
  });
  const orderMutation = useMutation({
    mutationKey: storefrontQueryKeys.order(catalog.slug),
    mutationFn: async (checkout: CheckoutFields) => {
      if (session.data) {
        const current = await loadStorefrontCustomer(catalog.slug);
        if (!current || current.id !== session.data.id) {
          throw new Error(
            locale === 'ar'
              ? 'انتهت جلسة حسابك. سجّل الدخول تاني قبل تأكيد الطلب.'
              : 'Your session changed. Sign in again before confirming.',
          );
        }
      }
      const post = (body: CreateStorefrontOrderRequest) =>
        apiPost<StorefrontOrderReceipt>(
          `/catalog/stores/${encodeURIComponent(catalog.slug)}/orders`,
          body,
          { credentials: 'include', storefrontSession: true },
        );
      if (attempt.current) return post(attempt.current);
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
        ...routeInput,
        ...(checkout.discountCode.trim()
          ? { discountCode: checkout.discountCode.trim().toUpperCase() }
          : {}),
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
      const finalQuote = reviewedQuote ?? (await quoteRequest());
      if (finalQuote.fulfillmentQuoteKey && !reviewedQuote)
        throw new Error('راجع الفرع والسعر قبل تأكيد الطلب.');
      request.reviewedTotal = finalQuote.total;
      if (finalQuote.restaurantSettingsRevision)
        request.restaurantSettingsRevision = finalQuote.restaurantSettingsRevision;
      if (finalQuote.fulfillmentQuoteKey) {
        request.fulfillmentQuoteKey = finalQuote.fulfillmentQuoteKey;
        request.requestId = crypto.randomUUID();
        attempt.current = request;
      }
      return post(request);
    },
    onSuccess: (receipt) => {
      saveStorefrontOrderReceipt(receipt);
      attempt.current = null;
      setUncertain(false);
      clearCart();
    },
    onError: (error) => {
      if (
        attempt.current &&
        !(error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.statusCode))
      ) {
        setUncertain(true);
      } else {
        attempt.current = null;
        setUncertain(false);
        setReviewed(null);
        if (restaurant) void options.refetch();
      }
    },
  });

  function update<K extends Exclude<keyof CheckoutFields, 'fulfillmentType'>>(
    key: K,
    value: CheckoutFields[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === 'discountCode') {
      setQuote(null);
      setQuoteError('');
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (orderMutation.isPending || reviewMutation.isPending || session.isPending || session.isError)
      return;
    if (!attempt.current && branchRouting && !reviewedQuote) {
      orderMutation.reset();
      reviewMutation.mutate();
    } else {
      orderMutation.mutate(fields);
    }
  }

  if (!hasHydrated) {
    return (
      <main id="main-content" className="mx-auto min-h-[60vh] max-w-[1100px] px-4 py-10 sm:px-8">
        <div className="h-80 animate-pulse rounded-3xl bg-white" />
      </main>
    );
  }

  if (orderMutation.data) {
    const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
    return (
      <main
        id="main-content"
        className="mx-auto grid min-h-[70vh] max-w-[760px] content-center justify-items-center px-5 py-12 text-center"
      >
        <span className="grid size-16 place-items-center rounded-3xl bg-store-primary/10 text-store-primary">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-heading text-storefront-page font-black text-store-primary-deep">
          {t.orderReceived}
        </h1>
        <p className="mt-2 max-w-xl text-storefront-body text-store-muted">{t.orderPending}</p>
        <Card className="mt-5 grid w-full gap-3 rounded-3xl border-store-border bg-white p-4 text-start sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-store-muted">{t.orderReference}</span>
            <strong className="font-heading text-base font-extrabold text-store-ink" dir="ltr">
              {orderMutation.data.id.slice(0, 8).toLocaleUpperCase()}
            </strong>
          </div>
          {orderMutation.data.discount && (
            <div className="flex items-center justify-between gap-4 border-t border-store-border pt-4 text-store-primary">
              <span className="text-sm font-bold">
                {t.discountApplied} ({orderMutation.data.discount.code})
              </span>
              <strong>
                −
                <bdi dir="auto">
                  {formatStorefrontPrice(orderMutation.data.discount.amount, locale)}
                </bdi>
              </strong>
            </div>
          )}
          {orderMutation.data.branchName && (
            <p className="text-sm">الفرع: {orderMutation.data.branchName}</p>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-store-border pt-4">
            <span className="text-sm font-bold text-store-muted">{t.orderTotal}</span>
            <strong className="font-heading text-storefront-price font-extrabold text-store-primary-deep">
              <bdi dir="auto">{formatStorefrontPrice(orderMutation.data.total, locale)}</bdi>
            </strong>
          </div>
        </Card>
        <p className="mt-4 text-sm text-store-muted">{t.noPayment}</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            asChild
            className="h-11 rounded-xl bg-store-accent px-5 font-bold hover:bg-store-primary-dark"
          >
            <Link href={`/s/${catalog.slug}/order/${orderMutation.data.id}`}>
              {t.trackOrder}
              <Arrow className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl px-5 font-bold">
            <Link href={`/s/${catalog.slug}`}>
              {t.home}
              <Arrow className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main
        id="main-content"
        className="mx-auto grid min-h-[65vh] max-w-[760px] content-center justify-items-center px-5 py-12 text-center"
      >
        <span className="grid size-16 place-items-center rounded-3xl bg-store-cream text-store-accent">
          <ShoppingBag className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-heading text-storefront-page font-black text-store-ink">
          {t.basketEmpty}
        </h1>
        <Button
          asChild
          className="mt-5 rounded-xl bg-store-accent px-5 font-bold hover:bg-store-primary-dark"
        >
          <Link href={`/s/${catalog.slug}/menu`}>{t.startShopping}</Link>
        </Button>
      </main>
    );
  }

  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70vh] max-w-[1100px] px-4 pb-10 pt-6 sm:px-8 sm:pt-8"
    >
      <header className="mb-5">
        <p className="text-storefront-support font-extrabold text-store-accent">
          {catalog.merchantName}
        </p>
        <h1 className="mt-1 font-heading text-storefront-page font-black text-store-ink">
          {t.checkoutTitle}
        </h1>
        <p className="mt-1 text-storefront-body text-store-muted">{t.checkoutIntro}</p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <form onSubmit={submit} className="grid gap-4">
          <fieldset
            disabled={uncertain || orderMutation.isPending || reviewMutation.isPending}
            className="contents"
          >
            <Card className="grid gap-4 rounded-3xl border-store-border bg-white p-4 sm:p-5">
              <fieldset className="grid gap-3">
                <legend className="mb-2 font-heading text-storefront-subsection font-extrabold text-store-ink">
                  {t.fulfillment}
                </legend>
                {(
                  [
                    { value: 'pickup', label: t.pickup },
                    { value: 'delivery', label: t.delivery },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 transition ${fields.fulfillmentType === option.value ? 'border-store-primary bg-store-primary/5' : 'border-store-border bg-white hover:bg-store-page'}`}
                  >
                    <input
                      type="radio"
                      name="fulfillment"
                      value={option.value}
                      checked={fields.fulfillmentType === option.value}
                      onChange={() => {
                        setFulfillmentType(option.value);
                        setQuote(null);
                        setQuoteError('');
                      }}
                      className="size-4 accent-store-primary"
                    />
                    <span className="font-bold text-store-ink">{option.label}</span>
                  </label>
                ))}
              </fieldset>
              {fields.fulfillmentType === 'delivery' &&
                session.data &&
                savedAddresses.data &&
                savedAddresses.data.length > 0 && (
                  <label className="grid gap-2 text-sm font-bold text-store-ink">
                    {locale === 'ar' ? 'استخدم عنوانًا محفوظًا' : 'Use a saved address'}
                    <select
                      className="h-11 rounded-xl border border-store-border bg-white px-3"
                      value={selectedSavedAddressId}
                      onChange={(event) => {
                        const address = savedAddresses.data.find(
                          (entry) => entry.id === event.currentTarget.value,
                        );
                        if (address) applySavedAddress(address);
                        else {
                          setSelectedSavedAddressId('');
                          setDeliveryAreaId('');
                          update('deliveryAddress', '');
                          setQuote(null);
                          setQuoteError('');
                          setReviewed(null);
                        }
                      }}
                    >
                      <option value="">
                        {locale === 'ar'
                          ? 'إدخال عنوان لهذا الطلب'
                          : 'Enter an address for this order'}
                      </option>
                      {savedAddresses.data.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} ·{' '}
                          {[address.locality, address.area].filter(Boolean).join('، ')}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {fields.fulfillmentType === 'delivery' && savedAddresses.isError && session.data && (
                <p role="alert" className="text-sm text-store-error">
                  {locale === 'ar'
                    ? 'تعذّر تحميل عناوينك المحفوظة.'
                    : 'Could not load your saved addresses.'}{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void savedAddresses.refetch()}
                  >
                    {locale === 'ar' ? 'حاول تاني' : 'Try again'}
                  </button>
                </p>
              )}
              {options.data && (
                <fieldset
                  disabled={uncertain || orderMutation.isPending || reviewMutation.isPending}
                >
                  <RestaurantRouteFields
                    settings={options.data}
                    fulfillment={fields.fulfillmentType}
                    area={deliveryAreaId}
                    pickup={effectivePickup}
                    locationId={deliveryAreaId}
                    onLocation={(id) => {
                      setSelectedSavedAddressId('');
                      setDeliveryAreaId(id);
                      setQuote(null);
                    }}
                    onArea={(id) => {
                      setSelectedSavedAddressId('');
                      setDeliveryAreaId(id);
                      setQuote(null);
                    }}
                    onPickup={(id) => {
                      setPickup(id);
                      setQuote(null);
                    }}
                  />
                </fieldset>
              )}
              {fields.fulfillmentType === 'delivery' && (
                <label className="grid gap-2 text-sm font-bold text-store-ink">
                  {t.address}
                  <Textarea
                    autoComplete="street-address"
                    dir="auto"
                    value={fields.deliveryAddress}
                    onChange={(event) => {
                      setSelectedSavedAddressId('');
                      update('deliveryAddress', event.currentTarget.value);
                    }}
                    placeholder={t.addressPlaceholder}
                    minLength={8}
                    maxLength={1000}
                    required
                    className="min-h-28 rounded-xl border-store-border bg-white text-base"
                  />
                </label>
              )}
            </Card>

            <Card className="grid gap-4 rounded-3xl border-store-border bg-white p-4 sm:p-5">
              <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                {locale === 'ar' ? 'بيانات العميل' : 'Your details'}
              </h2>
              {session.isPending && (
                <p role="status" className="text-sm text-store-muted">
                  {locale === 'ar' ? 'جارٍ تحميل بيانات حسابك…' : 'Loading your account…'}
                </p>
              )}
              {session.isError ? (
                <p role="alert" className="text-sm text-store-error">
                  {locale === 'ar' ? 'تعذّر التحقق من الحساب.' : 'Could not check your account.'}{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void session.refetch()}
                  >
                    {locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}
                  </button>
                </p>
              ) : (
                !session.isPending &&
                !session.data && (
                  <p className="text-sm text-store-muted">
                    {locale === 'ar' ? 'تقدر تكمل كزائر أو ' : 'Continue as a guest or '}
                    <StorefrontSignInLink className="font-bold text-store-primary underline">
                      {locale === 'ar'
                        ? 'تسجّل الدخول لملء بياناتك ومتابعة طلبك'
                        : 'sign in to fill your details and track your order'}
                    </StorefrontSignInLink>
                  </p>
                )
              )}
              <label className="grid gap-2 text-sm font-bold text-store-ink">
                {t.customerName}
                <Input
                  autoComplete="name"
                  dir="auto"
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

            <Card className="grid gap-3 rounded-3xl border-store-border bg-white p-4 sm:p-5">
              <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                {t.discountCode}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label={t.discountCode}
                  dir="ltr"
                  autoCapitalize="characters"
                  maxLength={32}
                  value={fields.discountCode}
                  onChange={(event) =>
                    update('discountCode', event.currentTarget.value.toUpperCase())
                  }
                  placeholder={t.discountCodePlaceholder}
                  className="h-12 min-w-0 flex-1 rounded-xl border-store-border bg-white text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={orderMutation.isPending || !fields.discountCode.trim()}
                  onClick={() => {
                    setQuoteError('');
                    void quoteRequest()
                      .then(setQuote)
                      .catch(() => {
                        setQuote(null);
                        setQuoteError(t.discountUnavailable);
                      });
                  }}
                  className="h-12 rounded-xl border-store-border font-bold text-store-primary"
                >
                  {t.applyDiscount}
                </Button>
              </div>
              {quoteError && (
                <p className="m-0 text-sm font-bold text-store-error" role="alert">
                  {quoteError}
                </p>
              )}
              {quote?.discount && (
                <p className="m-0 text-sm font-bold text-store-primary" role="status">
                  {quote.discount.code} · {t.discountApplied} · −
                  <bdi dir="auto">{formatStorefrontPrice(quote.discount.amount, locale)}</bdi>
                </p>
              )}
            </Card>

          </fieldset>

          {orderMutation.isError && (
            <p
              className="rounded-2xl border border-store-error/20 bg-store-error/5 px-4 py-3 text-sm font-bold leading-6 text-store-error"
              role="alert"
            >
              {orderMutation.error.message || t.orderError}{' '}
              <StorefrontSignInLink className="underline">
                {locale === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
              </StorefrontSignInLink>
            </p>
          )}

          {options.isError && restaurant && (
            <p role="alert">
              تعذر تحميل خيارات الاستلام.{' '}
              <button type="button" onClick={() => void options.refetch()}>
                حاول تاني
              </button>
            </p>
          )}
          {reviewMutation.isError && <p role="alert">{reviewMutation.error.message}</p>}
          {reviewedQuote?.branch && !uncertain && (
            <div className="rounded-xl border p-3 text-sm" role="status">
              <p>الفرع: {reviewedQuote.branch.name}</p>
              {fields.fulfillmentType === 'pickup' && reviewedQuote.branch.address && (
                <p>{reviewedQuote.branch.address}</p>
              )}
              {reviewedQuote.deliveryAreaName && <p>{reviewedQuote.deliveryAreaName}</p>}
              <p>الإجمالي: {formatStorefrontPrice(reviewedQuote.total, locale)}</p>
            </div>
          )}
          <Button
            type="submit"
            formNoValidate={uncertain}
            disabled={
              session.isPending ||
              session.isError ||
              orderMutation.isPending ||
              reviewMutation.isPending ||
              (restaurant && !options.data && !uncertain)
            }
            className="h-11 rounded-xl bg-store-accent font-heading text-sm font-extrabold hover:bg-store-primary-dark"
          >
            {orderMutation.isPending && (
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            )}
            {uncertain
              ? 'أعد نفس محاولة التأكيد'
              : orderMutation.isPending
                ? t.submittingOrder
                : reviewMutation.isPending
                  ? 'جارٍ مراجعة الطلب…'
                  : branchRouting && !reviewedQuote
                    ? 'راجع الفرع والسعر'
                    : t.submitOrder}
            {!orderMutation.isPending && <Arrow className="size-4" aria-hidden="true" />}
          </Button>
          <p className="text-center text-xs leading-5 text-store-muted">{t.noPayment}</p>
        </form>

        <aside className="lg:sticky lg:top-28">
          <Card className="rounded-3xl border-store-border bg-white p-4 shadow-[0_12px_36px_rgba(23,35,48,0.06)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                {locale === 'ar' ? 'ملخص السلة' : 'Basket summary'}
              </h2>
              <span className="rounded-full bg-store-cream px-3 py-1 text-xs font-extrabold text-store-primary">
                {cart.reduce((count, line) => count + line.quantity, 0)}
              </span>
            </div>
            <ul className="mt-4 grid gap-3">
              {cart.map((line, index) => {
                const product = catalog.products.find((item) => item.id === line.productId);
                const promotion = quote?.promotions?.[index];
                const unitPrice = quote?.unitPrices[index] ?? line.unitPriceSnapshot;
                const originalUnitPrice = quote?.originalUnitPrices?.[index];
                return (
                  <li
                    key={line.key}
                    className="flex items-start justify-between gap-3 border-b border-store-border pb-3 text-sm"
                  >
                    <span className="min-w-0 font-medium text-store-muted">
                      {line.quantity} × {product?.name ?? t.unavailable}
                    </span>
                    <span className="shrink-0 text-end">
                      {promotion && originalUnitPrice && (
                        <del className="block text-xs text-store-muted">
                          <bdi dir="auto">{formatStorefrontPrice(originalUnitPrice, locale)}</bdi>
                        </del>
                      )}
                      <strong className="font-bold text-store-ink">
                        <bdi dir="auto">{formatStorefrontPrice(unitPrice, locale)}</bdi>
                      </strong>
                      {promotion && (
                        <small className="block font-bold text-store-primary">
                          {t.productDiscount} −
                          <bdi dir="auto">
                            {formatStorefrontPrice(promotion.discountAmount, locale)}
                          </bdi>
                        </small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 rounded-xl bg-store-cream px-3 py-3 text-xs leading-5 text-store-muted">
              {t.priceNote}
            </p>
            {quote && (
              <div className="mt-4 grid gap-2 border-t border-store-border pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-store-muted">{t.orderTotal}</span>
                  <strong>
                    <bdi dir="auto">{formatStorefrontPrice(quote.subtotal, locale)}</bdi>
                  </strong>
                </div>
                {quote.discount && (
                  <div className="flex justify-between gap-3 text-store-primary">
                    <span>
                      {t.discountApplied} ({quote.discount.code})
                    </span>
                    <strong>
                      −<bdi dir="auto">{formatStorefrontPrice(quote.discount.amount, locale)}</bdi>
                    </strong>
                  </div>
                )}
                {Number(quote.deliveryFee) > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-store-muted">{t.delivery}</span>
                    <strong>
                      <bdi dir="auto">{formatStorefrontPrice(quote.deliveryFee, locale)}</bdi>
                    </strong>
                  </div>
                )}
                <div className="flex justify-between gap-3 border-t border-store-border pt-2 font-extrabold">
                  <span>{t.finalTotal}</span>
                  <strong>
                    <bdi dir="auto">{formatStorefrontPrice(quote.total, locale)}</bdi>
                  </strong>
                </div>
              </div>
            )}
            {quote?.demo && <p className="mt-2 text-xs text-store-muted">{t.demoDiscountQuote}</p>}
            <Button
              asChild
              variant="outline"
              className="mt-3 h-11 w-full rounded-xl border-store-border font-bold text-store-primary hover:bg-store-cream"
            >
              <Link href={`/s/${catalog.slug}/cart`}>
                {locale === 'ar' ? 'العودة إلى السلة' : 'Back to basket'}
              </Link>
            </Button>
          </Card>
        </aside>
      </div>
    </main>
  );
}
