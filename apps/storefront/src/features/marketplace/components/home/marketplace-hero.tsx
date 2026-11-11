'use client';

export function MarketplaceHero() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">✦ أكثر من 250 متجرًا محليًا</span>
          <h1>
            كل اللي محتاجه…
            <br />
            من أقرب بائع وبأفضل سعر
          </h1>
          <p>قارن الأسعار، اكتشف المتاجر الموثوقة، واطلب أونلاين أو احجز واستلم من المحل.</p>
          <div className="hero-actions">
            <button
              className="btn btn-gold"
              onClick={() =>
                document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              تسوّق العروض
            </button>
            <button
              className="btn btn-light"
              onClick={() =>
                document.getElementById('stores')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              استكشف المتاجر
            </button>
          </div>
        </div>
        <div className="hero-art">
          <div className="deal-orbit">
            <img
              src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1000&q=85"
              alt="تجربة تسوق واقعية داخل متجر"
            />
          </div>
          <div className="deal-tag tag-a">توصيل سريع ⚡</div>
          <div className="deal-tag tag-b">وفّر حتى 50%</div>
        </div>
      </section>
      <section className="trust">
        {[
          ['✓', 'بائعون موثوقون', 'مراجعة واعتماد كل متجر'],
          ['↩', 'إرجاع بسهولة', 'سياسة واضحة لكل بائع'],
          ['🔒', 'دفع آمن', 'أكثر من وسيلة دفع'],
          ['📦', 'تتبّع الطلب', 'من المتجر حتى بابك'],
        ].map(([icon, title, description]) => (
          <div className="trust-item" key={title}>
            <div className="trust-icon">{icon}</div>
            <div>
              <b>{title}</b>
              <span>{description}</span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
