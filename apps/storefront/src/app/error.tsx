'use client';
import { useLocale, Button } from '@waffarly/ui';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLocale();
  return (
    <main id="main-content" tabIndex={-1} className="storefront-shell" role="alert">
      <h1>{t('Something went wrong')}</h1>
      <p>{t('The page could not be loaded. Try again.')}</p>
      <Button className="waffarly-button" onClick={reset} type="button">
        {t('Try again')}{' '}
      </Button>
    </main>
  );
}
