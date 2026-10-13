'use client';
import Link from 'next/link';
import { Button, useLocale } from '@waffarly/ui';
export default function NotFoundPage() {
  const { t } = useLocale();
  return (
    <main id="main-content" tabIndex={-1} className="storefront-shell">
      <h1>{t('Page not found')}</h1>
      <p>{t('The requested page is not available.')}</p>
      <Button asChild>
        <Link href="/">{t('Back to home')}</Link>
      </Button>
    </main>
  );
}
