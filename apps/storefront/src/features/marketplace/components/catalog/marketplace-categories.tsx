'use client';

import data from '../../data/reference.json';
import { SectionHeading } from '@/components/marketplace/section-heading';

export function MarketplaceCategories({
  activeCategory,
  onSelect,
}: {
  activeCategory: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="section" id="categories">
      <SectionHeading
        title="تسوّق حسب القسم"
        subtitle="كل نشاط له متجره وتجربته الخاصة"
        more="عرض كل الأقسام"
      />
      <div className="categories">
        {data.categories.map((c, index) => (
          <div
            className={`category${activeCategory === index ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={activeCategory === index}
            key={c.name}
            onClick={() => onSelect(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(index);
              }
            }}
          >
            <div className="cat-icon">
              <img {...c.image} />
            </div>
            <b>{c.name}</b>
            <small>{c.subtitle}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
