import Link from 'next/link';

export function CartEmptyState() {
  return (
    <section className="cart-empty-state" aria-labelledby="empty-cart-title">
      <span className="cart-empty-icon" aria-hidden="true">🛒</span>
      <h2 id="empty-cart-title">سلتك لسه فاضية</h2>
      <p>تصفّح المنتجات وأضف اللي يعجبك، وهتلاقيه هنا جاهز للمراجعة.</p>
      <Link href="/marketplace#deals" className="btn btn-gold">ابدأ التسوق</Link>
    </section>
  );
}
