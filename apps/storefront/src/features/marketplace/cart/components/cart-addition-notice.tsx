'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { useCartStore } from '../hooks/use-cart-store';

export function CartAdditionNotice() {
  const addition = useCartStore(state => state.cartAddition);
  const dismiss = useCartStore(state => state.dismissCartAddition);
  const open = useCartStore(state => state.setCartOpen);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!addition || hovered || focused) return;
    const timer = setTimeout(dismiss, 6000);
    return () => clearTimeout(timer);
  }, [addition, dismiss, hovered, focused]);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-20 z-40 mx-auto max-w-[420px] sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[400px]" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
      <div role="status" aria-live="polite" aria-atomic="true">
        {addition && <div key={addition.id} className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-white p-3 text-primary shadow-[0_8px_40px_rgba(43,13,55,0.16)]">
          <img src={addition.image} alt="" className="block size-12 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="m-0 flex items-center gap-1 text-[13px] font-medium"><Check size={15} className="text-success" aria-hidden="true" />اتضاف للسلة</p>
            <p className="mb-0 mt-0.5 truncate text-[12px] text-muted-foreground">{addition.name} · {addition.quantity} قطعة</p>
            <Button type="button" onClick={() => open(true)} className="mt-1 min-h-8 rounded-lg px-1 text-[12px] font-bold text-accent underline underline-offset-4">عرض السلة</Button>
          </div>
          <Button type="button" onClick={dismiss} aria-label="إغلاق إشعار الإضافة" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"><X size={16} aria-hidden="true" /></Button>
        </div>}
      </div>
    </div>
  );
}
