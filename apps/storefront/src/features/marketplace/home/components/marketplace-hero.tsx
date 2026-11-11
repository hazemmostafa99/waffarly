'use client';

import { cn } from '@waffarly/ui';
import { useRouter } from 'next/navigation';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

export function MarketplaceHero() {
  const router = useRouter();

  return (
    <>
      <section
        className={cn(
          'hero mt-4.5 min-h-87.5 rounded-[24px] overflow-hidden bg-[linear-gradient(115deg,_#2c083e_0%,_#4c1463_54%,_#7c3394_100%)] relative grid',
          "grid-cols-[1.15fr_0.85fr] text-[#fff] [box-shadow:var(--shadow)] before:content-[''] before:absolute before:w-130 before:h-130 before:rounded-full",
          'before:bg-[rgba(255,_255,_255,_0.06)] before:left-[-120px] before:top-[-210px] [&_h1]:text-[44px] [&_h1]:leading-[1.25] [&_h1]:mt-4.5 [&_h1]:mx-0 [&_h1]:mb-3',
          '[&_h1]:max-w-180 [&_p]:text-[17px] [&_p]:leading-[1.8] [&_p]:text-[#e8dbed] [&_p]:max-w-162.5 [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[25px]',
          'max-[1100px]:[&_h1]:text-[35px] max-[700px]:grid-cols-[1fr] max-[700px]:min-h-auto max-[700px]:rounded-[18px] max-[700px]:[&_h1]:text-[29px] max-[700px]:[&_p]:text-[14px]',
        )}
      >
        <div className={'hero-copy py-13 px-14 relative z-[1] max-[700px]:py-8 max-[700px]:px-6'}>
          <span
            className={cn(
              'eyebrow inline-flex items-center gap-[7px] bg-[rgba(245,_189,_25,_0.14)] text-[#ffe283] border border-solid',
              '[border-color:rgba(245,_189,_25,_0.38)] rounded-[99px] py-2 px-[13px] text-[13px] font-extrabold',
            )}
          >
            ✦ أكثر من 250 متجرًا محليًا
          </span>
          <h1>
            كل اللي محتاجه…
            <br />
            من أقرب بائع وبأفضل سعر
          </h1>
          <p>قارن الأسعار، اكتشف المتاجر الموثوقة، واطلب أونلاين أو احجز واستلم من المحل.</p>
          <div className={'hero-actions flex gap-2.5 flex-wrap'}>
            <Button
              className={cn(
                'btn btn-gold disabled:cursor-not-allowed disabled:opacity-[0.5] border-0 rounded-[11px] py-[13px] px-5',
                'font-extrabold bg-waffarly-gold text-[#2d1038]',
              )}
              onClick={() => router.push('/offers')}
            >
              تسوّق العروض
            </Button>
            <Button
              className={cn(
                'btn btn-light disabled:cursor-not-allowed disabled:opacity-[0.5] border-0 rounded-[11px] py-[13px] px-5',
                'font-extrabold bg-white text-primary',
              )}
              onClick={() =>
                document.getElementById('stores')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              استكشف المتاجر
            </Button>
          </div>
        </div>
        <div className={'hero-art relative grid place-items-center p-8 max-[700px]:hidden'}>
          <div
            className={cn(
              'deal-orbit w-[min(420px,_90%)] h-[285px] rounded-[26px] bg-white overflow-hidden [box-shadow:0_25px_70px_rgba(0,_0,_0,_0.28)] [transform:rotate(-3deg)]',
              'border-[7px] border-solid [border-color:rgba(255,_255,_255,_0.2)] [&_img]:w-full [&_img]:h-full [&_img]:block [&_img]:object-cover',
            )}
          >
            <img
              src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1000&q=85"
              alt="تجربة تسوق واقعية داخل متجر"
            />
          </div>
          <div
            className={cn(
              'deal-tag tag-a absolute bg-waffarly-gold text-[#2d1038] py-3 px-[17px] rounded-[14px]',
              'font-black [box-shadow:0_10px_25px_rgba(0,_0,_0,_0.2)] top-[45px] right-[24px] [transform:rotate(4deg)]',
            )}
          >
            توصيل سريع ⚡
          </div>
          <div
            className={cn(
              'deal-tag tag-b absolute bg-waffarly-gold text-[#2d1038] py-3 px-[17px] rounded-[14px]',
              'font-black [box-shadow:0_10px_25px_rgba(0,_0,_0,_0.2)] bottom-10.5 left-[22px] [transform:rotate(-5deg)]',
            )}
          >
            وفّر حتى 50%
          </div>
        </div>
      </section>
      <section
        className={cn(
          'trust mt-[-24px] relative z-[2] grid grid-cols-4 bg-white rounded-[18px]',
          '[box-shadow:var(--shadow)] p-[7px] [&_b]:block [&_b]:text-[13px] [&_span]:text-[11px] [&_span]:text-muted-foreground max-[700px]:mt-2.5 max-[700px]:grid-cols-[1fr_1fr]',
        )}
      >
        {[
          ['✓', 'بائعون موثوقون', 'مراجعة واعتماد كل متجر'],
          ['↩', 'إرجاع بسهولة', 'سياسة واضحة لكل بائع'],
          ['🔒', 'دفع آمن', 'أكثر من وسيلة دفع'],
          ['📦', 'تتبّع الطلب', 'من المتجر حتى بابك'],
        ].map(([icon, title, description]) => (
          <div
            className={cn(
              'trust-item flex items-center gap-[11px] p-4 [border-left-width:1px] [border-left-style:solid] [border-left-color:var(--line)]',
              '[&:last-child]:[border-left-width:0] max-[700px]:[&:nth-child(2)]:[border-left-width:0] max-[700px]:p-3',
            )}
            key={title}
          >
            <div
              className={
                'trust-icon w-[43px] h-[43px] rounded-[12px] bg-secondary grid place-items-center text-[21px] max-[700px]:w-9 max-[700px]:h-9'
              }
            >
              {icon}
            </div>
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
