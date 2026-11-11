'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CreateStorefrontOrderRequest, StorefrontCheckoutQuote, StorefrontOrderReceipt } from '@waffarly/contracts';
import { ApiError, apiPost } from '@/lib/api-client';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { useCheckoutStore } from '@/features/marketplace/checkout/hooks/use-checkout-store';
import { cartProducts } from '@/features/marketplace/cart/model/cart';
import { EMPTY_CHECKOUT, validateCheckout, type CheckoutDraft, type CheckoutErrors } from '../model/checkout';
import { CheckoutContactForm } from './checkout-contact-form';
import { CheckoutConfirmation } from './checkout-confirmation';
import type { DemoOrder } from '@/features/marketplace/orders/model/demo-order';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function RestaurantCheckoutPage() {
  const lines = useCartStore((state) => state.cart);
  const clear = useCartStore((state) => state.clearCartIfMatches);
  const completeDemo = useCheckoutStore((state) => state.completeDemoCheckout);
  const products = cartProducts(lines);
  const restaurant = products[0];
  const slug = restaurant?.restaurantSlug;
  const areas = restaurant?.restaurantSettings?.deliveryAreas ?? [];
  const [draft, setDraft] = useState<CheckoutDraft>({ ...EMPTY_CHECKOUT });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [area, setArea] = useState('');
  const [quote, setQuote] = useState<StorefrontCheckoutQuote | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<StorefrontOrderReceipt | null>(null);
  const [demoReceipt, setDemoReceipt] = useState<DemoOrder | null>(null);
  const reviewed = useRef('');
  const busy = useRef(false);
  const envelope = useRef<{ body: CreateStorefrontOrderRequest; cart: typeof lines; slug: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);

  function change(values: Partial<CheckoutDraft>) {
    if (busy.current || envelope.current) return;
    setDraft((current) => ({ ...current, ...values })); setErrors({}); setQuote(null); setNotice('');
  }
  function items() {
    return lines.map((line) => ({ productId: line.productId, quantity: line.quantity,
      ...(line.selection?.size?.[0] ? { variantId: line.selection.size[0] } : {}),
      selections: (line.snapshot?.apiModifierGroups ?? []).filter((group) => group.variantOverrides?.find((override) => override.variantId === line.selection?.size?.[0])?.available !== false)
        .map((group) => ({ groupId: group.id, optionIds: line.selection?.[group.id] ?? [] })),
    }));
  }
  async function review() {
    if (busy.current || envelope.current || !slug || !lines.length) return;
    const validation = validateCheckout(draft);
    if (restaurant?.restaurantSettings?.referenceData?.origin !== 'local-mock') Object.keys(validation).forEach((key) => { const field = key as keyof CheckoutErrors; const message = validation[field]; if (message !== undefined) validation[field] = message.replace(/تجريبيًا /g, ''); });
    setErrors(validation);
    if (Object.keys(validation).length) return;
    if (products.some((product) => product.restaurantSlug !== slug)) { setNotice('السلة لازم تكون من مطعم واحد.'); return; }
    if (draft.fulfillment === 'delivery' && areas.length && !area) { setNotice('اختار منطقة التوصيل.'); return; }
    const snapshot = JSON.stringify(lines);
    busy.current = true; setPending(true); setNotice('');
    try {
      const result = await apiPost<StorefrontCheckoutQuote>(`catalog/stores/${encodeURIComponent(slug)}/orders/quote`, {
        fulfillmentType: draft.fulfillment, items: items(), ...(draft.fulfillment === 'delivery' && area ? { deliveryAreaId: area } : {}),
      });
      reviewed.current = snapshot; setQuote(result);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذرت مراجعة السعر. حاول مرة تانية.'); }
    finally { busy.current = false; setPending(false); }
  }
  async function confirm() {
    if (busy.current) return;
    if (!envelope.current) {
      if (!quote || !slug || reviewed.current !== JSON.stringify(lines)) { setQuote(null); setNotice('السلة اتغيرت. راجع السعر من جديد.'); return; }
      if (quote.demo) {
        const order = completeDemo(lines, draft.fulfillment, quote);
        if (!order) { setQuote(null); setNotice('تعذر التأكيد التجريبي. راجع السلة.'); return; }
        setDemoReceipt(order); setDraft({ ...EMPTY_CHECKOUT }); return;
      }
      envelope.current = { slug, cart: structuredClone(lines), body: {
        requestId: crypto.randomUUID(), reviewedTotal: quote.total, restaurantSettingsRevision: quote.restaurantSettingsRevision,
        customerName: draft.name.trim(), customerPhone: draft.phone.trim(), fulfillmentType: draft.fulfillment,
        ...(draft.fulfillment === 'delivery' ? { deliveryAddress: draft.address.trim(), ...(area ? { deliveryAreaId: area } : {}) } : {}), items: items(),
      } };
    }
    busy.current = true; setPending(true); setNotice('');
    try {
      const attempt = envelope.current;
      const result = await apiPost<StorefrontOrderReceipt>(`catalog/stores/${encodeURIComponent(attempt.slug)}/orders`, attempt.body);
      clear(attempt.cart); setReceipt(result); setDraft({ ...EMPTY_CHECKOUT }); envelope.current = null; setUncertain(false);
    } catch (error) {
      const definitive = error instanceof ApiError && [400,401,403,404,409,422].includes(error.statusCode);
      if (definitive) { envelope.current = null; setQuote(null); setUncertain(false); }
      else setUncertain(true);
      setNotice(definitive && error instanceof Error ? error.message : 'لم يصل تأكيد من الخادم. أعد نفس المحاولة من الزر؛ لا تبدأ طلبًا جديدًا أو تغادر الصفحة قبل حسم النتيجة.');
    } finally { busy.current = false; setPending(false); }
  }

  return <main id="marketplace-main" className="min-h-[60vh] py-6"><MarketplaceContainer>
    <div className="mx-auto max-w-[1000px]">
      <h1 className="mb-4 text-xl font-extrabold text-primary">إتمام الطلب</h1>
      {demoReceipt ? <CheckoutConfirmation receipt={demoReceipt} /> : receipt ? <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">تم تسجيل طلبك</h2><p dir="ltr">{receipt.id}</p><p>الحالة: {receipt.status}</p><p className="font-bold">الإجمالي {money(Number(receipt.total))}</p><p className="text-sm text-muted-foreground">تم تسجيل الطلب على الخادم؛ لم تتم أي عملية دفع إلكتروني.</p><Link href="/restaurants" className="text-accent">العودة للمطاعم</Link>
      </section> : !lines.length ? <p>السلة فارغة. <Link href="/restaurants">تصفح المطاعم</Link></p> : <>
        <p className="mb-4 rounded-xl bg-secondary p-3 text-xs leading-6 text-accent">بيانات المنيو والأسعار من الخادم. مطاعم العرض تُكمل تأكيدًا محليًا فقط. الطلب الفعلي يُرسل فقط للمطاعم غير التجريبية؛ لا يوجد دفع إلكتروني هنا.</p>
        {notice && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{notice}</p>}
        {!quote && !uncertain ? <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
          <CheckoutContactForm demo={restaurant?.restaurantSettings?.referenceData?.origin === 'local-mock'} draft={draft} errors={errors} onChange={change} onContinue={review} />
          {draft.fulfillment === 'delivery' && areas.length > 0 && <label className="mt-4 grid gap-2 text-sm">منطقة التوصيل<select value={area} onChange={(event) => setArea(event.target.value)} className="rounded-xl border border-border bg-card p-3"><option value="">اختار المنطقة</option>{areas.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
          {pending && <p role="status">جارٍ مراجعة السعر مع الخادم…</p>}
        </fieldset> : <section aria-busy={pending} className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mt-0 text-lg font-bold">راجع السعر قبل التأكيد</h2>
          <ul className="list-none space-y-2 p-0">{products.map((product) => <li key={product.lineId} className="text-sm">{product.cartName} × {product.quantity}<small className="block text-muted-foreground">{product.optionsLabel}</small></li>)}</ul>
          <div className="my-3 border-y border-border py-3 text-sm leading-6"><p className="m-0">{draft.name} · <bdi>{draft.phone}</bdi></p><p className="m-0">{draft.fulfillment === 'delivery' ? draft.address : 'استلام من المطعم'}</p></div>
          {quote && <dl className="space-y-3 text-sm"><div className="flex justify-between"><dt>الأصناف</dt><dd>{money(Number(quote.subtotal))}</dd></div><div className="flex justify-between"><dt>التوصيل</dt><dd>{money(Number(quote.deliveryFee))}</dd></div><div className="flex justify-between font-bold"><dt>الإجمالي من الخادم</dt><dd>{money(Number(quote.total))}</dd></div></dl>}
          <Button type="button" tone="gold" disabled={pending} onClick={confirm} className="mt-4 min-h-11 w-full rounded-xl px-4 font-bold">{pending ? 'جارٍ التأكيد…' : uncertain ? 'إعادة نفس المحاولة' : quote?.demo ? 'تأكيد محاكاة محلية — بدون إرسال طلب' : 'تأكيد وإرسال الطلب للمطعم'}</Button>
          {!pending && !uncertain && <Button type="button" tone="neutral" onClick={() => setQuote(null)} className="mt-3 min-h-10 rounded-xl px-4 text-sm">تعديل البيانات ومراجعة السعر</Button>}
        </section>}
      </>}
    </div>
  </MarketplaceContainer></main>;
}
