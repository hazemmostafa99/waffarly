import { Card, useLocale } from '@waffarly/ui';

export function App() {
  const { t } = useLocale();
  return (
    <main id="main-content" tabIndex={-1} className="shell">
      <span className="eyebrow">{t('Business operations')}</span>
      <h1>{t('POS Workspace')}</h1>
      <Card className="mt-8 flex flex-col items-center py-16 text-center">
        <span
          className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-secondary text-3xl text-primary"
          aria-hidden="true"
        >
          ▦
        </span>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {t('Workspace in preparation')}
        </span>
        <h2 className="mt-5">{t('Your point of sale workspace')}</h2>
        <p className="mt-3 max-w-lg">
          {t(
            'This workspace is being prepared. Sales and order tools will appear here when available.',
          )}
        </p>
      </Card>
    </main>
  );
}
