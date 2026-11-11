'use client';

import { useEffect, useRef, useState } from 'react';
import { cartProducts, type MarketplaceCartLine } from '@/features/marketplace/cart/model/cart';
import {
  EMPTY_CHECKOUT,
  validateCheckout,
  type CheckoutDraft,
  type CheckoutErrors,
  type DemoReceipt,
} from '@/features/marketplace/checkout/model/checkout';

export function useLocalCheckout(
  lines: MarketplaceCartLine[],
  clearCartIfUnchanged: (snapshot: MarketplaceCartLine[]) => boolean,
) {
  const [step, setStep] = useState<'details' | 'review' | 'confirmed'>('details');
  const [draft, setDraft] = useState<CheckoutDraft>({ ...EMPTY_CHECKOUT });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<DemoReceipt | null>(null);
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
    setStep('review');
    setNotice('');
  }

  function confirm() {
    if (busy.current || !lines.length) return;
    const nextErrors = validateCheckout(draft);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStep('details');
      return;
    }
    const snapshot = lines.map((line) => ({ ...line }));
    const nextReceipt: DemoReceipt = {
      items: cartProducts(snapshot),
      fulfillment: draft.fulfillment,
    };
    busy.current = true;
    setPending(true);
    setNotice('');
    // In-process UI delay only. No request, real payment or order record.
    timer.current = setTimeout(() => {
      busy.current = false;
      setPending(false);
      if (!clearCartIfUnchanged(snapshot)) {
        setNotice('السلة اتغيّرت أثناء المراجعة. راجع المنتجات والإجمالي وأكد التجربة مرة تانية.');
        return;
      }
      setReceipt(nextReceipt);
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
