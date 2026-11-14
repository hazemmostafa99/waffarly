'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CircleCheck, Clock3, Copy, ReceiptText } from 'lucide-react';
import type { StorefrontOrderReceipt } from '@waffarly/contracts';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';
import { money } from '@/features/marketplace/shared/lib/format-money';

const statusLabels: Record<StorefrontOrderReceipt['status'], string> = {
  pending: 'بانتظار مراجعة المطعم', accepted: 'تم قبول الطلب', rejected: 'تم رفض الطلب',
  preparing: 'جارٍ تجهيز الطلب', ready: 'الطلب جاهز', completed: 'الطلب مكتمل', cancelled: 'تم إلغاء الطلب',
};

export function RestaurantOrderConfirmation({ receipt }: { receipt: StorefrontOrderReceipt }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(receipt.id);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <Card aria-labelledby="restaurant-order-confirmed" className="mx-auto max-w-[620px] overflow-hidden rounded-[22px] border border-border bg-card">
      <div className="border-b border-border bg-[var(--purple-50)] px-5 py-6 text-center">
        <span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-success/10 text-success"><CircleCheck size={30} strokeWidth={1.7} aria-hidden="true" /></span>
        <h2 id="restaurant-order-confirmed" className="mb-1 mt-0 text-[21px] font-bold text-primary">تم تسجيل طلبك لدى المطعم</h2>
        <p className="m-0 text-[13px] leading-6 text-muted-foreground">احتفظ برقم الطلب للرجوع إليه عند التواصل مع المطعم.</p>
      </div>
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <span className="text-[12px] text-muted-foreground">الحالة عند تسجيل الطلب</span>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary"><Clock3 size={15} aria-hidden="true" />{statusLabels[receipt.status]}</span>
        </div>
        <div className="min-w-0 rounded-xl bg-[var(--purple-50)] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><ReceiptText size={15} aria-hidden="true" />رقم الطلب</span>
            <Button type="button" onClick={copyOrderId} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-accent hover:bg-secondary">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'تم النسخ' : 'نسخ الرقم'}
            </Button>
          </div>
          <bdi dir="ltr" className="block select-all break-all text-right text-[13px] font-medium leading-6">{receipt.id}</bdi>
          <span role="status" className="text-[12px] text-muted-foreground">{copyError ? 'تعذر النسخ. تقدر تحدد الرقم وتنسخه يدويًا.' : copied ? 'تم نسخ رقم الطلب.' : ''}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-y border-border py-3 text-primary"><span className="text-[14px] font-medium">إجمالي الطلب</span><strong className="text-[24px] font-bold">{money(Number(receipt.total))}</strong></div>
        <p className="m-0 text-[12px] leading-6 text-muted-foreground">لم تتم أي عملية دفع إلكتروني. تابع طلبك من صفحة الطلب؛ الضيف يقدر يتابع من نفس المتصفح لمدة محدودة.</p>
        <Link href={"/orders/" + receipt.id} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-bold text-primary">متابعة الطلب</Link>
        <Link href="/restaurants" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-waffarly-gold px-4 py-2 text-[14px] font-medium text-primary no-underline hover:bg-[#ffd353]">العودة للمطاعم<ArrowLeft size={16} aria-hidden="true" /></Link>
      </div>
    </Card>
  );
}
