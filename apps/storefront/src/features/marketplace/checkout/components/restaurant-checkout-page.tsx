'use client';

import { useRef, useState } from 'react';
import { useCustomerSession } from '@/features/marketplace/account/hooks/use-customer-session';
import Link from 'next/link';
import type {
  CreateStorefrontOrderRequest,
  StorefrontCheckoutQuote,
  StorefrontOrderReceipt,
} from '@waffarly/contracts';
import { ApiError, apiPost } from '@/lib/api-client';
import { customerOrdersRequest } from '@/features/marketplace/orders/data/customer-orders-api';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { cartProducts } from '@/features/marketplace/cart/model/cart';
import {
  EMPTY_CHECKOUT,
  validateCheckout,
  type CheckoutDraft,
  type CheckoutErrors,
} from '../model/checkout';
import { CheckoutContactForm } from './checkout-contact-form';
import { CheckoutFulfillmentFields } from './checkout-fulfillment-fields';
import { RestaurantCheckoutReview } from './restaurant-checkout-review';
import { RestaurantOrderConfirmation } from './restaurant-order-confirmation';
import { RestaurantRouteFields, useRestaurantFulfillment } from '@/features/delivery/restaurant-route-fields';

export function RestaurantCheckoutPage() {
  const customerSession = useCustomerSession();
  const lines = useCartStore((state) => state.cart);
  const clear = useCartStore((state) => state.clearCartIfMatches);
  const products = cartProducts(lines);
  const restaurant = products[0];
  const slug = restaurant?.restaurantSlug;
  const remote = useRestaurantFulfillment(slug);
  const settings = remote.data ?? restaurant?.restaurantSettings;
  const [draft, setDraft] = useState<CheckoutDraft>(() => ({ ...EMPTY_CHECKOUT }));
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [area, setArea] = useState('');
  const [pickup, setPickup] = useState('');
  const [locationId, setLocationId] = useState('');
  const deliveryAreaId = settings?.onlineBranches === undefined ? area : locationId;
  const [quote, setQuote] = useState<StorefrontCheckoutQuote | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<StorefrontOrderReceipt | null>(null);
  const reviewed = useRef('');
  const busy = useRef(false);
  const envelope = useRef<{
    body: CreateStorefrontOrderRequest;
    cart: typeof lines;
    slug: string;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);

  function change(values: Partial<CheckoutDraft>) {
    if (busy.current || envelope.current) return;
    setDraft((current) => ({ ...current, ...values }));
    setErrors({});
    setQuote(null);
    setNotice('');
  }
  function items() {
    return lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      ...(line.selection?.size?.[0] ? { variantId: line.selection.size[0] } : {}),
      selections: (line.snapshot?.apiModifierGroups ?? [])
        .filter(
          (group) =>
            group.variantOverrides?.find(
              (override) => override.variantId === line.selection?.size?.[0],
            )?.available !== false,
        )
        .map((group) => ({ groupId: group.id, optionIds: line.selection?.[group.id] ?? [] })),
    }));
  }
  function routeInput() {
    if (draft.fulfillment === 'delivery' && deliveryAreaId) return { deliveryAreaId };
    if (draft.fulfillment === 'pickup' && settings?.onlineBranches !== undefined && pickup)
      return { pickupBranchId: pickup };
    return {};
  }
  async function review() {
    if (busy.current || envelope.current || !slug || !lines.length) return;
    const validation = validateCheckout(draft, false);
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (validation.address && !validation.name && !validation.phone)
        document.querySelector<HTMLTextAreaElement>('[name="address"]')?.focus();
      return;
    }
    if (products.some((product) => product.restaurantSlug !== slug)) {
      setNotice('السلة لازم تكون من مطعم واحد.');
      return;
    }
    if (draft.fulfillment === 'delivery' &&
      (settings?.onlineBranches !== undefined || settings?.deliveryAreas.length) && !deliveryAreaId) {
      setNotice('اختار منطقة التوصيل.');
      return;
    }
    if (draft.fulfillment === 'pickup' && settings?.onlineBranches !== undefined && !pickup) {
      setNotice('اختار فرع الاستلام.');
      return;
    }
    const route = routeInput();
    const snapshot = JSON.stringify({ lines, route });
    busy.current = true;
    setPending(true);
    setNotice('');
    try {
      await customerOrdersRequest('customer/orders/session', {});
      const result = await apiPost<StorefrontCheckoutQuote>(
        `catalog/stores/${encodeURIComponent(slug)}/orders/quote`,
        {
          fulfillmentType: draft.fulfillment,
          items: items(),
          ...route,
        },
      );
      reviewed.current = snapshot;
      setQuote(result);
    } catch (error) {
      void remote.refetch();
      setNotice(
        error instanceof ApiError && error.statusCode === 403
          ? 'المطعم غير متاح لاستقبال طلبات جديدة حاليًا. جرّب لاحقًا أو اختار مطعمًا آخر.'
          : error instanceof Error
            ? error.message
            : 'تعذرت مراجعة السعر. حاول مرة تانية.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function confirm() {
    if (busy.current) return;
    if (!envelope.current) {
      if (!quote || !slug || reviewed.current !== JSON.stringify({ lines, route: routeInput() })) {
        setQuote(null);
        setNotice('السلة اتغيرت. راجع السعر من جديد.');
        return;
      }
      envelope.current = {
        slug,
        cart: structuredClone(lines),
        body: {
          requestId: crypto.randomUUID(),
          reviewedTotal: quote.total,
          restaurantSettingsRevision: quote.restaurantSettingsRevision,
          ...(quote.fulfillmentQuoteKey ? { fulfillmentQuoteKey: quote.fulfillmentQuoteKey } : {}),
          customerName: draft.name.trim(),
          customerPhone: draft.phone.trim(),
          fulfillmentType: draft.fulfillment,
          ...(draft.fulfillment === 'delivery'
            ? { deliveryAddress: draft.address.trim() }
            : {}),
          ...routeInput(),
          items: items(),
        },
      };
    }
    busy.current = true;
    setPending(true);
    setNotice('');
    try {
      const attempt = envelope.current;
      const result = await customerOrdersRequest<StorefrontOrderReceipt>(
        `catalog/stores/${encodeURIComponent(attempt.slug)}/orders/customer`,
        attempt.body,
      );
      clear(attempt.cart);
      setReceipt(result);
      setDraft({ ...EMPTY_CHECKOUT });
      envelope.current = null;
      setUncertain(false);
    } catch (error) {
      const definitive =
        error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.statusCode);
      if (definitive) {
        envelope.current = null;
        setQuote(null);
        setUncertain(false);
        void remote.refetch();
      } else setUncertain(true);
      setNotice(
        definitive && error instanceof Error
          ? error.message
          : 'لم يصل تأكيد من الخادم. أعد نفس المحاولة من الزر؛ لا تبدأ طلبًا جديدًا أو تغادر الصفحة قبل حسم النتيجة.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <main id="marketplace-main" className="min-h-[60vh] py-4">
      <MarketplaceContainer>
        <div
          className={`mx-auto ${receipt ? 'max-w-[620px]' : quote || uncertain ? 'max-w-[1000px]' : 'max-w-[800px]'}`}
        >
          <h1 className="mt-0 mb-2 text-[20px] font-bold leading-8 text-primary">إتمام الطلب</h1>
          {!receipt && (
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              {customerSession.data ? (
                'الطلب هيتحفظ في حسابك المسجّل دخوله.'
              ) : (
                <>
                  إكمال الطلب كضيف: تقدر تتابعه من المتصفح ده لمدة محدودة، أو{' '}
                  <Link href="/account/sign-in" className="font-bold text-accent">
                    سجّل دخول قبل التأكيد
                  </Link>{' '}
                  لحفظه في حسابك.
                </>
              )}
            </p>
          )}
          {receipt ? (
            <RestaurantOrderConfirmation receipt={receipt} />
          ) : !lines.length ? (
            <p>
              السلة فارغة. <Link href="/restaurants">تصفح المطاعم</Link>
            </p>
          ) : (
            <>
              <p className="mt-0 mb-3 rounded-xl bg-secondary px-3 py-2 text-xs leading-6 text-accent">
                راجع بياناتك والسعر النهائي قبل التأكيد. تأكيد الطلب يسجّله لدى المطعم؛ لا تتم عملية
                دفع إلكتروني هنا.
              </p>
              {notice && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive p-3 text-sm text-destructive"
                >
                  {notice}
                </p>
              )}
              {!quote && !uncertain ? (
                <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
                  <div className="mb-4 rounded-[18px] border border-border bg-card p-4 sm:p-5">
                    <CheckoutFulfillmentFields demo={false} draft={draft} errors={errors} onChange={change}>
                      {settings && <RestaurantRouteFields settings={settings} fulfillment={draft.fulfillment}
                        area={area} pickup={pickup} onArea={setArea} onPickup={setPickup}
                        locationId={locationId} onLocation={setLocationId} />}
                    </CheckoutFulfillmentFields>
                  </div>
                  <CheckoutContactForm
                    demo={false}
                    showFulfillment={false}
                    draft={draft}
                    errors={errors}
                    onChange={change}
                    onContinue={review}
                  />
                  {pending && <p role="status">جارٍ مراجعة السعر مع الخادم…</p>}
                </fieldset>
              ) : (
                <RestaurantCheckoutReview
                  products={products}
                  draft={draft}
                  quote={quote}
                  pending={pending}
                  uncertain={uncertain}
                  onConfirm={confirm}
                  onEdit={() => setQuote(null)}
                />
              )}
            </>
          )}
        </div>
      </MarketplaceContainer>
    </main>
  );
}
