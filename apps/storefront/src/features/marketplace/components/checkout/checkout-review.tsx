import Link from 'next/link';
import type { CheckoutDraft } from '../../model/checkout';

export function CheckoutReview({ draft, pending, notice, onEdit, onConfirm }: { draft: CheckoutDraft; pending: boolean; notice: string; onEdit: () => void; onConfirm: () => void }) {
  return <section className="checkout-panel" aria-labelledby="checkout-review-title" aria-busy={pending}>
    <h2 id="checkout-review-title">راجع قبل التأكيد</h2>
    <dl className="checkout-review-details"><div><dt>الاسم</dt><dd>{draft.name.trim()}</dd></div><div><dt>رقم الموبايل</dt><dd><bdi dir="ltr">{draft.phone.trim()}</bdi></dd></div><div><dt>الاستلام</dt><dd>{draft.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي من المتجر'}</dd></div>{draft.fulfillment === 'delivery' && <div><dt>العنوان</dt><dd>{draft.address.trim()}</dd></div>}</dl>
    <p className="checkout-demo-notice">التأكيد محاكاة محلية فقط. لن يتم إرسال طلب أو حجز منتجات أو خصم أي مبلغ.</p>
    {notice && <p className="checkout-error" role="alert">{notice}</p>}
    <button type="button" className="add" disabled={pending} onClick={onConfirm}>{pending ? 'جارٍ تجهيز التأكيد التجريبي…' : 'تأكيد الطلب التجريبي'}</button>
    <div className="checkout-secondary-actions"><button type="button" disabled={pending} onClick={onEdit}>تعديل البيانات</button><Link href="/marketplace/cart">الرجوع للسلة</Link></div>
  </section>;
}
