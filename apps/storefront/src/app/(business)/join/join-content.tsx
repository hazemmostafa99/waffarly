'use client';
import Link from 'next/link';
import { useLocale } from '@waffarly/ui';
import { MerchantApplicationForm } from './merchant-application-form';

export function JoinContent() {
  const { t } = useLocale();
  return (
    <main id="main-content" tabIndex={-1} className="join-shell">
      <Link className="join-back" href="/">
        {t('Back to home')}
      </Link>
      <section className="join-card">
        <p className="eyebrow">{t('For business owners')}</p>
        <h1>{t('Apply to join Waffarly')}</h1>
        <p className="join-intro">
          {t('Share your business and contact details. Our team will review your application.')}
        </p>
        <MerchantApplicationForm />
      </section>
    </main>
  );
}
