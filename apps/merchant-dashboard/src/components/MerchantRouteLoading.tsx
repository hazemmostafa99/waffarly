import { useLocale } from '@waffarly/ui';

export function MerchantRouteLoading() {
  const { locale } = useLocale();
  return (
    <main id="main-content" tabIndex={-1} className="shell" aria-busy="true" role="status">
      {locale === 'ar' ? 'جارٍ تحميل الصفحة…' : 'Loading page…'}
    </main>
  );
}
