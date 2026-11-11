import data from '../../data/reference.json';
import { SectionHeading } from '@/components/marketplace/section-heading';

export function MarketplaceStores() {
  return (
    <>
      <section className="section" id="stores">
        <SectionHeading
          title="متاجر مميزة على وفّرلي"
          subtitle="تسوّق مباشرة من بائعين معتمدين"
          more="كل المتاجر"
        />
        <div className="market-grid">
          <div className="stores">
            {data.stores.map((s) => (
              <article className="store" key={s.name}>
                <div className="store-logo">
                  <img {...s.image} loading="lazy" />
                </div>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <a href="#">زيارة المتجر ←</a>
                </div>
              </article>
            ))}
          </div>
          <aside className="side-banner">
            <span className="eyebrow" style={{ color: '#3b1745', borderColor: '#5d2870' }}>
              لأصحاب المتاجر
            </span>
            <h3>ابدأ البيع على وفّرلي</h3>
            <p>أنشئ متجرك، أضف منتجاتك، استخدم الكاشير والمخزون ووصل لعملاء أكتر.</p>
            <button className="btn">سجّل كتاجر</button>
          </aside>
        </div>
      </section>
      <section className="app-strip">
        <div>
          <h2>خلّي وفّرلي على موبايلك</h2>
          <p>ثبّت التطبيق وتابع عروض المتاجر القريبة وطلباتك أولًا بأول.</p>
        </div>
        <div className="app-actions">
          <span className="app-btn">▶ Google Play</span>
          <span className="app-btn"> App Store</span>
        </div>
      </section>
    </>
  );
}
