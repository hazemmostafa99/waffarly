import { cn } from '@waffarly/ui';
import Link from 'next/link';
export function MarketplaceFooter() {
  return (
    <footer className={'bg-[#21102a] text-[#fff] pt-10.5 px-0 pb-[95px]'}>
      <div
        className={
          'marketplace-container w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)]'
        }
      >
        <div
          className={cn(
            'footer-grid grid grid-cols-[1.3fr_repeat(3,_1fr)] gap-10 [&_h4]:mt-0 [&_h4]:mx-0 [&_h4]:mb-3.5 [&_p]:text-[#cfc3d5]',
            '[&_p]:text-[12px] [&_p]:leading-[2] [&_p]:no-underline [&_p]:block [&_a]:text-[#cfc3d5] [&_a]:text-[12px] [&_a]:leading-[2] [&_a]:no-underline',
            '[&_a]:block max-[1100px]:grid-cols-[1fr_1fr] max-[700px]:grid-cols-[1fr_1fr] max-[700px]:gap-[25px]',
          )}
        >
          <div>
            <img
              className={'footer-logo w-[165px]'}
              src="/marketplace-assets/wafarly-logo.png"
              alt="وفّرلي"
            />
            <p>
              سوق إلكتروني يجمع أفضل المتاجر والبائعين في مكان واحد، لتجد ما تحتاجه بأفضل سعر وأسرع
              توصيل.
            </p>
          </div>
          {[
            ['اعرف أكثر', 'عن وفّرلي', 'بيع على وفّرلي', 'كل المتاجر', 'كل العروض'],
            ['مساعدة', 'تواصل معنا', 'الإرجاع والاستبدال', 'تتبّع طلبك'],
            ['حسابك', 'تسجيل الدخول', 'إنشاء حساب', 'طلباتك', 'المفضلة'],
          ].map(([title, ...links]) => (
            <div key={title}>
              <h4>{title}</h4>
              {links.map((label) =>
                label === 'طلباتك' ||
                label === 'تتبّع طلبك' ||
                label === 'المفضلة' ||
                label === 'تسجيل الدخول' ||
                label === 'إنشاء حساب' ||
                label === 'بيع على وفّرلي' ||
                label === 'كل المتاجر' ||
                label === 'كل العروض' ? (
                  <Link
                    key={label}
                    href={
                      label === 'المفضلة'
                        ? '/favorites'
                        : label === 'تسجيل الدخول'
                          ? '/account/sign-in'
                          : label === 'إنشاء حساب'
                            ? '/account/sign-up'
                            : label === 'بيع على وفّرلي'
                              ? '/join'
                              : label === 'كل المتاجر'
                                ? '/stores'
                                : label === 'كل العروض'
                                  ? '/offers'
                                  : '/orders'
                    }
                  >
                    {label}
                  </Link>
                ) : (
                  <a key={label} href="#">
                    {label}
                  </a>
                ),
              )}
            </div>
          ))}
        </div>
        <div
          className={
            'copyright [border-top-width:1px] [border-top-style:solid] [border-top-color:rgba(255,_255,_255,_0.1)] mt-7 pt-4.5 text-[#a99caf] text-[11px] text-center'
          }
        >
          © 2026 وفّرلي — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  );
}
