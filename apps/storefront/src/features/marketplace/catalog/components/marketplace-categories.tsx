'use client';

import { cn } from '@waffarly/ui';

import {
  marketplaceCategories,
  type CategoryId,
} from '@/features/marketplace/search/model/search-state';
import { SectionHeading } from '@/components/marketplace/section-heading';

export function MarketplaceCategories({
  activeCategory,
  onSelect,
}: {
  activeCategory: CategoryId;
  onSelect: (category: CategoryId) => void;
}) {
  return (
    <section className={'section mt-7'} id="categories">
      <SectionHeading
        title="تسوّق حسب القسم"
        subtitle="كل نشاط له متجره وتجربته الخاصة"
        more="عرض كل الأقسام"
        moreHref="#categories"
      />
      <div
        className={
          'categories grid grid-cols-8 gap-3 max-[1100px]:grid-cols-4 max-[700px]:grid-cols-4 max-[700px]:gap-2'
        }
      >
        {marketplaceCategories.map((c) => (
          <div
            className={cn(
              `category${activeCategory === c.id ? ' active' : ''}`,
              'bg-white border border-solid [border-color:transparent] rounded-[16px] py-3.5 px-2 text-center [box-shadow:0_3px_12px_rgba(45,_20,_58,_0.05)] [transition:0.2s] cursor-pointer hover:[border-color:#c99bd9] hover:[transform:translateY(-3px)] hover:[box-shadow:var(--shadow)] [&.active]:[border-color:#c99bd9] [&.active]:[transform:translateY(-3px)] [&.active]:[box-shadow:var(--shadow)] [&:hover_.cat-icon_img]:[transform:scale(1.08)] [&.active_.cat-icon]:[box-shadow:0_0_0_3px_var(--gold),_0_5px_14px_rgba(43,_13,_55,_0.18)] [&_b]:text-[12px] [&_b]:block [&_small]:text-muted-foreground [&_small]:text-[10px] max-[700px]:py-[11px] max-[700px]:px-1 max-[700px]:[&_small]:hidden',
            )}
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
            <div
              className={cn(
                'cat-icon w-19 h-19 mt-0 mx-auto mb-2.5 rounded-full bg-[#eee]',
                'overflow-hidden border-[3px] border-solid [border-color:#fff] [box-shadow:0_4px_13px_rgba(43,_13,_55,_0.16)] [&_img]:w-full [&_img]:h-full [&_img]:block',
                '[&_img]:object-cover [&_img]:[transition:0.25s] max-[700px]:w-13 max-[700px]:h-13 max-[700px]:text-[25px]',
              )}
            >
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
