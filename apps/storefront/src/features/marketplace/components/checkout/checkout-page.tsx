'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useMarketplaceStore } from '../../providers/marketplace-providers';
import { cartProducts } from '../../model/catalog';
import { CartEmptyState } from '../cart/cart-empty-state';
import { useLocalCheckout } from './use-local-checkout';
import { CheckoutContactForm } from './checkout-contact-form';
import { CheckoutReview } from './checkout-review';
import { CheckoutOrderSummary } from './checkout-order-summary';
import { CheckoutConfirmation } from './checkout-confirmation';

const steps = ['بيانات التواصل والاستلام', 'مراجعة الطلب', 'تأكيد تجريبي'];

export function CheckoutPage() {
  const lines = useMarketplaceStore(state => state.cart);
  const complete = useMarketplaceStore(state => state.clearCartIfUnchanged);
  const checkout = useLocalCheckout(lines, complete);
  const products = cartProducts(lines);
  const heading = useRef<HTMLHeadingElement>(null);
  const activeStep = checkout.step === 'details' ? 0 : checkout.step === 'review' ? 1 : 2;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [checkout.step]);

  return <main id="marketplace-main" tabIndex={-1} className="cart-review-page checkout-page"><MarketplaceContainer>
    <nav className="cart-breadcrumbs" aria-label="مسار التنقل"><Link href="/marketplace">الرئيسية</Link><span aria-hidden="true">/</span><Link href="/marketplace/cart">السلة</Link><span aria-hidden="true">/</span><span aria-current="page">إتمام الطلب التجريبي</span></nav>
    <div className="cart-review-heading"><div><h1 ref={heading} tabIndex={-1}>{checkout.step === 'confirmed' ? 'تأكيد التجربة' : 'إتمام الطلب'}</h1><p>رحلة تجريبية بالكامل — بدون إرسال بيانات أو دفع حقيقي.</p></div><span className="cart-demo-label">تجربة محلية</span></div>
    {checkout.step === 'confirmed' && checkout.receipt ? <CheckoutConfirmation receipt={checkout.receipt} /> : !products.length ? <CartEmptyState /> : <>
      <ol className="checkout-steps" aria-label="خطوات إتمام الطلب">{steps.map((label, index) => <li key={label} className={index <= activeStep ? 'active' : undefined} aria-current={index === activeStep ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
      <div className="cart-review-layout">
        {checkout.step === 'details' ? <CheckoutContactForm draft={checkout.draft} errors={checkout.errors} onChange={checkout.change} onContinue={checkout.review} /> : <CheckoutReview draft={checkout.draft} pending={checkout.pending} notice={checkout.notice} onEdit={checkout.edit} onConfirm={checkout.confirm} />}
        <CheckoutOrderSummary items={products} editable />
      </div>
      <p className="cart-storage-note">بيانات التواصل مؤقتة داخل الصفحة فقط؛ المغادرة أو التحديث يمسحها. استخدم بيانات غير حقيقية.</p>
    </>}
  </MarketplaceContainer></main>;
}
