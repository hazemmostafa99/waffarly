import Link from 'next/link';
import type { DemoReceipt } from '../../model/checkout';
import { CheckoutOrderSummary } from './checkout-order-summary';

export function CheckoutConfirmation({ receipt }: { receipt: DemoReceipt }) {
  return <section className="checkout-confirmation" aria-labelledby="checkout-success-title">
    <div className="checkout-panel checkout-success-panel"><span className="checkout-success-icon" aria-hidden="true">✓</span><h2 id="checkout-success-title">اكتملت التجربة بنجاح</h2><p role="status">ده تأكيد تجريبي فقط — مفيش طلب حقيقي اتبعت، ومفيش مبلغ اتخصم.</p><p className="detail-note">تم تفريغ سلة التجربة ومسح بيانات التواصل من الشاشة. الملخص هنا محلي ومؤقت، ومفيش رقم طلب أو موعد استلام حقيقي.</p><span className="cart-demo-label">{receipt.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي'}</span><Link className="btn btn-gold" href="/marketplace">العودة للتسوق</Link></div>
    <CheckoutOrderSummary items={receipt.items} />
  </section>;
}
