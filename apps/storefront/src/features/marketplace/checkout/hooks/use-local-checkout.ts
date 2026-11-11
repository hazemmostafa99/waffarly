'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';
import { cartProducts } from '@/features/marketplace/cart/model/cart';
import { restaurantCheckout } from '@/features/marketplace/checkout/model/restaurant-checkout';
import {
  EMPTY_CHECKOUT,
  validateCheckout,
  type CheckoutDraft,
  type CheckoutErrors,
} from '@/features/marketplace/checkout/model/checkout';
import type { DemoOrder } from '@/features/marketplace/orders/model/demo-order';

export function useLocalCheckout(
  lines: MarketplaceCartLine[],
  completeDemoCheckout: (
    snapshot: MarketplaceCartLine[],
    fulfillment: CheckoutDraft['fulfillment'],
  ) => DemoOrder | null,
  initialAddress = '',
) {
  const [step, setStep] = useState<'details' | 'review' | 'confirmed'>('details');
  const [draft, setDraft] = useState<CheckoutDraft>(() => ({
    ...EMPTY_CHECKOUT,
    address: initialAddress,
  }));
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<DemoOrder | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function change(values: Partial<CheckoutDraft>) {
    setDraft((current) => ({ ...current, ...values }));
    setErrors({});
    setNotice('');
  }

  function review() {
    const nextErrors = validateCheckout(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !lines.length) return;
    const summary = restaurantCheckout(cartProducts(lines), draft.fulfillment);
    if (summary.issue) { setNotice(summary.issue); return; }
    setStep('review');
    setNotice('');
  }

  function confirm() {
    if (busy.current || !lines.length) return;
    const summary = restaurantCheckout(cartProducts(lines), draft.fulfillment);
    if (summary.issue) { setNotice(summary.issue); return; }
    const nextErrors = validateCheckout(draft);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStep('details');
      return;
    }
    const snapshot = lines.map((line) => ({ ...line }));
    busy.current = true;
    setPending(true);
    setNotice('');
    // In-process UI delay only. No request, real payment or order record.
    timer.current = setTimeout(() => {
      busy.current = false;
      setPending(false);
      const order = completeDemoCheckout(snapshot, draft.fulfillment);
      if (!order) {
        setNotice('السلة اتغيّرت أثناء المراجعة. راجع المنتجات والإجمالي وأكد التجربة مرة تانية.');
        return;
      }
      setReceipt(order);
      setDraft({ ...EMPTY_CHECKOUT });
      setStep('confirmed');
    }, 600);
  }

  return {
    step,
    draft,
    errors,
    notice,
    pending,
    receipt,
    change,
    review,
    confirm,
    edit: () => {
      if (!busy.current) setStep('details');
    },
  };
}
