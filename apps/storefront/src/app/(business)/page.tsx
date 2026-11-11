'use client';
import { Button, Card, useLocale } from '@waffarly/ui';
import Link from 'next/link';

export default function HomePage() {
  const { t } = useLocale();
  const features = [
    [
      '01',
      'Your business, your identity',
      'Choose a storefront design and personalize it with your logo and colours.',
    ],
    [
      '02',
      'A clear path to getting started',
      'Apply, complete the review, and receive your owner account after approval.',
    ],
    [
      '03',
      'Here to help you grow',
      'Manage your business profile and storefront from one workspace.',
    ],
  ] as const;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-7xl px-6 py-12 sm:px-12 sm:py-20"
    >
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex rounded-full border bg-white px-4 py-2 text-sm font-medium text-primary">
            {t('For business owners')}
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {t('A better home for your business.')}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            {t(
              'Bring your business to Waffarly. Share your details and our team will help you get started.',
            )}
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/join">
              {t('Apply to set up your business')}
              <span aria-hidden="true" className="rtl:rotate-180">
                →
              </span>
            </Link>
          </Button>
        </div>
        <div className="rounded-3xl border bg-primary p-8 text-white sm:p-12">
          <span className="text-sm text-white/70">{t('Built around your business')}</span>
          <div className="mt-8 rounded-2xl bg-white p-6 text-foreground shadow-xl">
            <div className="flex items-center gap-4">
              <span
                className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-2xl"
                aria-hidden="true"
              >
                ✳
              </span>
              <div>
                <h2 className="font-bold">{t('Your business')}</h2>
                <span className="text-sm text-muted-foreground">{t('Business account')}</span>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <div className="rounded-xl border bg-background px-4 py-3 text-sm">
                {t('Contact details')}
              </div>
              <div className="rounded-xl border bg-background px-4 py-3 text-sm">
                {t('Storefront design')}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        className="mt-16 grid gap-5 md:grid-cols-3"
        aria-label={t('Built around your business')}
      >
        {features.map(([number, title, description]) => (
          <Card key={number}>
            <span className="text-sm font-semibold text-primary">{number}</span>
            <h2 className="mt-4 text-lg font-semibold">{t(title)}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{t(description)}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
