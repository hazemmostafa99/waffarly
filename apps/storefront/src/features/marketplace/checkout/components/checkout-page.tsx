'use client';

import { cn } from '@waffarly/ui';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { useCheckoutStore } from '@/features/marketplace/checkout/hooks/use-checkout-store';
import { cartProducts } from '@/features/marketplace/cart/model/cart';
import { CartEmptyState } from '@/features/marketplace/cart/components/cart-empty-state';
import { useLocalCheckout } from '@/features/marketplace/checkout/hooks/use-local-checkout';
import { CheckoutContactForm } from '@/features/marketplace/checkout/components/checkout-contact-form';
import { CheckoutReview } from '@/features/marketplace/checkout/components/checkout-review';
import { CheckoutOrderSummary } from '@/features/marketplace/checkout/components/checkout-order-summary';
import { CheckoutConfirmation } from '@/features/marketplace/checkout/components/checkout-confirmation';

const steps = ['بيانات التواصل والاستلام', 'مراجعة الطلب', 'تأكيد تجريبي'];

export function CheckoutPage() {
  const lines = useCartStore((state) => state.cart);
  const complete = useCheckoutStore((state) => state.completeDemoCheckout);
  const checkout = useLocalCheckout(lines, complete);
  const products = cartProducts(lines);
  const heading = useRef<HTMLHeadingElement>(null);
  const activeStep = checkout.step === 'details' ? 0 : checkout.step === 'review' ? 1 : 2;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [checkout.step]);

  return (
    <main
      id="marketplace-main"
      tabIndex={-1}
      className={
        'cart-review-page checkout-page pb-16 min-h-[60vh] pt-6 [&_>_.marketplace-container]:max-w-310 max-[700px]:pt-4.5'
      }
    >
      <MarketplaceContainer>
        <nav
          className={
            'cart-breadcrumbs flex items-center gap-2.5 text-muted-foreground text-[12px] mb-6 [&_a]:text-accent [&_a]:no-underline'
          }
          aria-label="مسار التنقل"
        >
          <Link href="/marketplace">الرئيسية</Link>
          <span aria-hidden="true">/</span>
          <Link href="/marketplace/cart">السلة</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">إتمام الطلب التجريبي</span>
        </nav>
        <div
          className={cn(
            'cart-review-heading flex items-center justify-between gap-4 mb-6 [&_h1]:text-[30px] [&_h1]:leading-[1.4]',
            '[&_h1]:mt-0 [&_h1]:mx-0 [&_h1]:mb-2 [&_p]:m-0 [&_p]:text-muted-foreground [&_p]:text-[13px] [&_p]:leading-[1.8] max-[700px]:items-start',
            'max-[700px]:[&_h1]:text-[25px] max-[700px]:[&_p]:text-[12px]',
          )}
        >
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {checkout.step === 'confirmed' ? 'تأكيد التجربة' : 'إتمام الطلب'}
            </h1>
            <p>رحلة تجريبية بالكامل — بدون إرسال بيانات أو دفع حقيقي.</p>
          </div>
          <span
            className={
              'cart-demo-label whitespace-nowrap py-[7px] px-2.5 rounded-[8px] bg-secondary text-accent text-[11px]'
            }
          >
            تجربة محلية
          </span>
        </div>
        {checkout.step === 'confirmed' && checkout.receipt ? (
          <CheckoutConfirmation receipt={checkout.receipt} />
        ) : !products.length ? (
          <CartEmptyState />
        ) : (
          <>
            <ol
              className={cn(
                'checkout-steps flex gap-5 list-none mt-0 mx-0 mb-7 p-0',
                '[&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:text-muted-foreground [&_li]:text-[13px] [&_li_>_span]:grid [&_li_>_span]:place-items-center [&_li_>_span]:shrink-0',
                '[&_li_>_span]:w-8 [&_li_>_span]:h-8 [&_li_>_span]:border [&_li_>_span]:border-solid [&_li_>_span]:border-border [&_li_>_span]:rounded-full [&_li_>_span]:bg-card [&_li.active]:text-primary',
                '[&_li.active]:font-bold [&_li.active_>_span]:bg-primary [&_li.active_>_span]:text-card [&_li.active_>_span]:border-primary max-[700px]:gap-2.5 max-[700px]:[&_li]:[flex:1] max-[700px]:[&_li]:flex-col max-[700px]:[&_li]:text-center',
                'max-[700px]:[&_li]:text-[10px] max-[700px]:[&_li]:leading-[1.6] max-[700px]:[&_li]:gap-1.5',
              )}
              aria-label="خطوات إتمام الطلب"
            >
              {steps.map((label, index) => (
                <li
                  key={label}
                  className={index <= activeStep ? 'active' : undefined}
                  aria-current={index === activeStep ? 'step' : undefined}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            <div
              className={
                'cart-review-layout grid grid-cols-[minmax(0,1fr)_330px] items-start gap-6 max-[1000px]:grid-cols-[minmax(0,1fr)_290px] max-[1000px]:gap-4 max-[768px]:grid-cols-[1fr]'
              }
            >
              {checkout.step === 'details' ? (
                <CheckoutContactForm
                  draft={checkout.draft}
                  errors={checkout.errors}
                  onChange={checkout.change}
                  onContinue={checkout.review}
                />
              ) : (
                <CheckoutReview
                  draft={checkout.draft}
                  pending={checkout.pending}
                  notice={checkout.notice}
                  onEdit={checkout.edit}
                  onConfirm={checkout.confirm}
                />
              )}
              <CheckoutOrderSummary items={products} editable />
            </div>
            <p
              className={
                'cart-storage-note text-muted-foreground text-[11px] leading-[1.8] mt-5 mx-0 mb-0'
              }
            >
              بيانات التواصل مؤقتة داخل الصفحة فقط؛ المغادرة أو التحديث يمسحها. استخدم بيانات غير
              حقيقية.
            </p>
          </>
        )}
      </MarketplaceContainer>
    </main>
  );
}
