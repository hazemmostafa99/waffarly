'use client';

import { marketplaceCategories, type CategoryId } from '../../search/search-state';
import { SectionHeading } from '@/components/marketplace/section-heading';

export function MarketplaceCategories({
  activeCategory,
  onSelect,
}: {
  activeCategory: CategoryId;
  onSelect: (category: CategoryId) => void;
}) {
  return (
    <section className="section" id="categories">
      <SectionHeading
        title="تسوّق حسب القسم"
        subtitle="كل نشاط له متجره وتجربته الخاصة"
        more="عرض كل الأقسام"
      />
      <div className="categories">
        {marketplaceCategories.map((c) => (
          <div
            className={`category${activeCategory === c.id ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={activeCategory === c.id}
            key={c.name}
            onClick={() => onSelect(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(c.id);
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
