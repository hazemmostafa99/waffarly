import Link from 'next/link';
import { money } from '../../model/catalog';
import type { CheckoutItem } from '../../model/checkout';

export function CheckoutOrderSummary({ items, editable = false }: { items: CheckoutItem[]; editable?: boolean }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <aside className="cart-summary checkout-summary" aria-labelledby="checkout-summary-title">
    <div className="checkout-summary-heading"><h2 id="checkout-summary-title">ملخص المنتجات</h2>{editable && <Link href="/marketplace/cart">تعديل السلة</Link>}</div>
    <ul className="checkout-summary-items">{items.map(item => <li key={item.id}><img src={item.cartImage} alt="" /><div><b>{item.cartName}</b><span>{item.quantity} × {money(item.price)}</span></div><strong>{money(item.price * item.quantity)}</strong></li>)}</ul>
    <dl><div><dt>عدد القطع</dt><dd>{items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div className="cart-summary-total"><dt>إجمالي المنتجات</dt><dd>{money(total)}</dd></div></dl>
    <p className="detail-note">بدون احتساب شحن أو ضرائب أو رسوم إضافية. لا يوجد دفع فعلي في التجربة.</p>
  </aside>;
}
