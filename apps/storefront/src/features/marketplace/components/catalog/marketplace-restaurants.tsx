import data from '../../data/reference.json';
import { SectionHeading } from '@/components/marketplace/section-heading';

export function MarketplaceRestaurants() {
  return (
    <section className="section restaurants-wrap" id="restaurants">
      <SectionHeading
        title="مطاعم قريبة منك"
        subtitle="واجهات حقيقية ومطاعم متنوعة — اختر مطعمك واطلب مباشرة"
        more="عرض كل المطاعم"
      />
      <div className="restaurants-grid">
        {data.restaurants.map((r) => (
          <article className="restaurant" key={r.name}>
            <div className="restaurant-cover">
              <img {...r.cover} loading="lazy" />
              <span className="rest-offer">{r.offer}</span>
            </div>
            <div className="restaurant-logo">
              <img {...r.logo} loading="lazy" />
            </div>
            <div className="restaurant-info">
              <h3>{r.name}</h3>
              <div className="restaurant-meta">{r.meta}</div>
              <div className="restaurant-foot">
                <span className="rest-rating">{r.rating}</span>
                <span className="rest-time">{r.time}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
