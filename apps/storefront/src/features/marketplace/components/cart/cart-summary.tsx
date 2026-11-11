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
      <button className="add" type="button" disabled aria-describedby="checkout-pending-note">متابعة لإتمام الطلب</button>
      <p id="checkout-pending-note" className="cart-checkout-note">إتمام الطلب التجريبي لسه قيد التجهيز. لم يتم إرسال أي طلب.</p>
      <Link className="cart-continue-link" href="/marketplace#deals">متابعة التسوق ←</Link>
    </aside>
  );
}
