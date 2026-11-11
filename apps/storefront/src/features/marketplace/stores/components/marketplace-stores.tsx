import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import data from '@/features/marketplace/data/reference.json';
import { SectionHeading } from '@/components/marketplace/section-heading';
import Link from 'next/link';
import { storeHref } from '@/features/marketplace/stores/model/stores';

export function MarketplaceStores() {
  return (
    <>
      <section className={'section mt-7'} id="stores">
        <SectionHeading
          title="متاجر مميزة على وفّرلي"
          subtitle="تسوّق مباشرة من بائعين معتمدين"
          more="كل المتاجر"
        />
        <div
          className={
            'market-grid grid grid-cols-[1.35fr_0.65fr] gap-4 max-[1100px]:grid-cols-[1fr]'
          }
        >
          <div className={'stores grid grid-cols-3 gap-3 max-[700px]:grid-cols-[1fr]'}>
            {data.stores.map((s) => (
              <article
                className={cn(
                  'store bg-white rounded-[17px] p-4.5 border border-solid border-border grid',
                  'grid-cols-[auto_1fr] gap-3 items-center [&_h3]:text-[14px] [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-[5px] [&_p]:text-[10px]',
                  '[&_p]:text-muted-foreground [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[7px] [&_a]:text-[11px] [&_a]:text-accent [&_a]:font-black [&_a]:no-underline',
                )}
                key={s.name}
              >
                <div
                  className={cn(
                    'store-logo w-16 h-16 rounded-[15px] bg-[linear-gradient(145deg,_var(--purple-800),_var(--purple-600))] text-[#fff] overflow-hidden [box-shadow:0_4px_12px_rgba(43,_13,_55,_0.15)]',
                    '[&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:block',
                  )}
                >
                  <img {...s.image} loading="lazy" />
                </div>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <Link href={storeHref(s)}>زيارة المتجر ←</Link>
                </div>
              </article>
            ))}
          </div>
          <aside
            className={cn(
              'side-banner min-h-full rounded-[19px] p-[27px] bg-[linear-gradient(150deg,_#f1c933,_#ffdd67)] text-[#2f1237] relative overflow-hidden',
              "after:content-['%'] after:absolute after:text-[180px] after:font-black after:opacity-[0.12] after:left-[-5px] after:bottom-[-55px] [&_h3]:text-[25px]",
              '[&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-2.5 [&_p]:text-[13px] [&_p]:leading-[1.8] [&_.btn]:mt-2.5 [&_.btn]:bg-primary [&_.btn]:text-[#fff]',
            )}
          >
            <span
              className={cn(
                'eyebrow inline-flex items-center gap-[7px] bg-[rgba(245,_189,_25,_0.14)] text-[#3b1745] border border-solid',
                '[border-color:#5d2870] rounded-[99px] py-2 px-[13px] text-[13px] font-extrabold',
              )}
            >
              لأصحاب المتاجر
            </span>
            <h3>ابدأ البيع على وفّرلي</h3>
            <p>أنشئ متجرك، أضف منتجاتك، استخدم الكاشير والمخزون ووصل لعملاء أكتر.</p>
            <Button
              className={
                'btn disabled:cursor-not-allowed disabled:opacity-[0.5] border-0 rounded-[11px] py-[13px] px-5 font-extrabold'
              }
            >
              سجّل كتاجر
            </Button>
          </aside>
        </div>
      </section>
      <section
        className={cn(
          'app-strip mt-7.5 bg-[linear-gradient(105deg,_var(--purple-950),_var(--purple-700))] rounded-[22px] py-7 px-[35px] text-[#fff] flex',
          'items-center justify-between gap-[25px] [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-[7px] [&_p]:m-0 [&_p]:text-[#ded0e5]',
          '[&_p]:text-[13px] max-[700px]:block max-[700px]:p-6',
        )}
      >
        <div>
          <h2>خلّي وفّرلي على موبايلك</h2>
          <p>ثبّت التطبيق وتابع عروض المتاجر القريبة وطلباتك أولًا بأول.</p>
        </div>
        <div className={'app-actions flex gap-2.5 max-[700px]:mt-4.5'}>
          <span
            className={
              'app-btn bg-white text-[#25102d] rounded-[10px] py-[11px] px-4 font-extrabold text-[12px] whitespace-nowrap'
            }
          >
            ▶ Google Play
          </span>
          <span
            className={
              'app-btn bg-white text-[#25102d] rounded-[10px] py-[11px] px-4 font-extrabold text-[12px] whitespace-nowrap'
            }
          >
             App Store
          </span>
        </div>
      </section>
    </>
  );
}
