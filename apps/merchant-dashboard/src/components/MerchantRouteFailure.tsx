import { Button, useLocale } from '@waffarly/ui';

export function MerchantRouteFailure() {
  const { locale } = useLocale();
  return (
    <main id="main-content" tabIndex={-1} className="shell" role="alert">
      <h1>{locale === 'ar' ? 'تعذر تحميل الصفحة' : 'This page could not be loaded'}</h1>
      <p>
        {locale === 'ar'
          ? 'تحقق من الاتصال ثم أعد تحميل الصفحة.'
          : 'Check your connection, then reload the page.'}
      </p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        {locale === 'ar' ? 'إعادة تحميل الصفحة' : 'Reload page'}
      </Button>
    </main>
  );
}
