import Link from 'next/link';
import { money } from '../../model/catalog';

export function CartSummary({ total, quantity, productCount }: { total: number; quantity: number; productCount: number }) {
  return (
    <aside className="cart-summary" aria-labelledby="cart-summary-title">
      <h2 id="cart-summary-title">ملخص السلة</h2>
      <dl>
        <div><dt>المنتجات المختلفة</dt><dd>{productCount}</dd></div>
        <div><dt>عدد القطع</dt><dd>{quantity}</dd></div>
        <div className="cart-summary-total"><dt>إجمالي المنتجات</dt><dd>{money(total)}</dd></div>
      </dl>
      <p className="detail-note">الشحن وأي رسوم إضافية غير محسوبة في هذه التجربة.</p>
      <Link className="add cart-checkout-link" href="/marketplace/checkout">متابعة لإتمام الطلب</Link>
      <p className="cart-checkout-note">الخطوة التالية تجربة محلية فقط، بدون إرسال طلب أو دفع حقيقي.</p>
      <Link className="cart-continue-link" href="/marketplace#deals">متابعة التسوق ←</Link>
    </aside>
  );
}
