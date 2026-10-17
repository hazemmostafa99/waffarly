import { useLocale } from '@waffarly/ui';

export function RouteLoading() {
  const { t } = useLocale();
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
    >
      {t('Loading design preview…')}
    </div>
  );
}
