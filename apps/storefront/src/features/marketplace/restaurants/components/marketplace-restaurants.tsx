import { cn } from '@waffarly/ui';
import data from '@/features/marketplace/data/reference.json';
import { SectionHeading } from '@/components/marketplace/section-heading';
import Link from 'next/link';
import { restaurantHref } from '@/features/marketplace/restaurants/model/restaurants';

export function MarketplaceRestaurants() {
  return (
    <section
      className={
        'section restaurants-wrap mt-7 bg-white rounded-[20px] p-5 [box-shadow:var(--shadow)] max-[700px]:p-3.5'
      }
      id="restaurants"
    >
      <SectionHeading
        title="مطاعم قريبة منك"
        subtitle="واجهات حقيقية ومطاعم متنوعة — اختر مطعمك واطلب مباشرة"
        more="عرض كل المطاعم"
        moreHref="#restaurants"
      />
      <div
        className={
          'restaurants-grid grid grid-cols-6 gap-[13px] max-[1100px]:grid-cols-4 max-[700px]:flex max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-[7px]'
        }
      >
        {data.restaurants.map((r) => (
          <article
            className={cn(
              'restaurant border border-solid border-border rounded-[16px] overflow-hidden bg-white [transition:0.22s]',
              'min-w-0 hover:[transform:translateY(-4px)] hover:[box-shadow:var(--shadow)] [&:hover_.restaurant-cover_>_img]:[transform:scale(1.06)] max-[700px]:min-w-[225px] max-[700px]:[scroll-snap-align:start]',
            )}
            key={r.name}
          >
            <Link
              className="block text-inherit no-underline"
              href={restaurantHref(r)}
              aria-label={`تفاصيل مطعم ${r.name}`}
            >
              <div
                className={
                  'restaurant-cover h-28 relative bg-[#eee] overflow-hidden [&_>_img]:w-full [&_>_img]:h-full [&_>_img]:object-cover [&_>_img]:block [&_>_img]:[transition:0.3s]'
                }
              >
                <img {...r.cover} loading="lazy" />
                <span
                  className={cn(
                    'rest-offer absolute top-[9px] right-[9px] bg-destructive text-[#fff] rounded-[8px] py-[5px]',
                    'px-[7px] text-[9px] font-black',
                  )}
                >
                  {r.offer}
                </span>
              </div>
              <div
                className={cn(
                  'restaurant-logo w-14 h-14 rounded-full overflow-hidden border-[4px] border-solid [border-color:#fff]',
                  'bg-white mt-[-28px] mx-[13px] mb-0 relative z-[2] [box-shadow:0_4px_13px_rgba(31,_10,_41,_0.2)] [&_img]:w-full',
                  '[&_img]:h-full [&_img]:object-cover',
                )}
              >
                <img {...r.logo} loading="lazy" />
              </div>
              <div
                className={
                  'restaurant-info pt-2 px-[13px] pb-3.5 [&_h3]:text-[13px] [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-1.5'
                }
              >
                <h3>{r.name}</h3>
                <div className={'restaurant-meta text-[9px] text-muted-foreground leading-[1.8]'}>
                  {r.meta}
                </div>
                <div
                  className={'restaurant-foot flex items-center justify-between mt-2 text-[9px]'}
                >
                  <span className={'rest-rating text-[#967000] font-black'}>{r.rating}</span>
                  <span className={'rest-time text-success font-extrabold'}>{r.time}</span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
