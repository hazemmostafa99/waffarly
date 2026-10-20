import {
  POS_APPEARANCE_ACCENTS,
  type PosAppearanceAccent,
  type PosAppearanceSummary,
} from '@waffarly/contracts';
import { Button, DashboardCard, useLocale } from '@waffarly/ui';
import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../../lib/api-client.js';

const colors: Record<PosAppearanceAccent, string> = {
  orange: '#bf4c0d',
  plum: '#7939a4',
  teal: '#0d766c',
  blue: '#285fc1',
};

export function PosAppearanceSettings() {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [appearance, setAppearance] = useState<PosAppearanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PosAppearanceAccent | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let current = true;
    void apiRequest<PosAppearanceSummary>('/owner/merchant/pos-appearance')
      .then((value) => {
        if (current) setAppearance(value);
      })
      .catch((cause: unknown) => {
        if (current) {
          setError(
            errorText(
              cause instanceof Error
                ? cause.message
                : text('Could not load POS appearance.', 'تعذر تحميل مظهر نقطة البيع.'),
            ),
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, locale]);

  async function chooseAccent(accent: PosAppearanceAccent) {
    if (!appearance || saving || appearance.accent === accent) return;
    setSaving(accent);
    setError('');
    setNotice('');
    try {
      const saved = await apiRequest<PosAppearanceSummary>('/owner/merchant/pos-appearance', {
        method: 'PATCH',
        body: JSON.stringify({ accent, revision: appearance.revision }),
      });
      setAppearance(saved);
      setNotice(text('POS accent saved for this merchant.', 'تم حفظ لون نقطة البيع لهذا التاجر.'));
    } catch (cause) {
      try {
        setAppearance(await apiRequest<PosAppearanceSummary>('/owner/merchant/pos-appearance'));
      } catch {
        // Keep the last loaded appearance when refresh also fails.
      }
      setError(
        errorText(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : text('Could not save POS appearance.', 'تعذر حفظ مظهر نقطة البيع.'),
        ),
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <DashboardCard
      className="register-table-card"
      title={text('POS appearance', 'مظهر نقطة البيع')}
      description={text(
        'Choose the accent used across this merchant’s POS. Cashier shifts and other Waffarly apps are unaffected.',
        'اختر اللون المميز لنقاط البيع لدى هذا التاجر. لا يتغير حساب الكاشير أو تطبيقات وفلري الأخرى.',
      )}
    >
      <div className="grid gap-3" data-testid="merchant-pos-appearance">
        {loading ? (
          <p className="m-0 text-sm text-muted-foreground" role="status">
            {text('Loading POS appearance…', 'جارٍ تحميل مظهر نقطة البيع…')}
          </p>
        ) : (
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label={text('POS accent', 'لون نقطة البيع')}
          >
            {POS_APPEARANCE_ACCENTS.map((accent) => (
              <Button
                key={accent}
                type="button"
                variant="outline"
                aria-pressed={appearance?.accent === accent}
                aria-label={text(
                  `${accent} accent`,
                  `اللون ${accent === 'orange' ? 'البرتقالي' : accent === 'plum' ? 'البنفسجي' : accent === 'teal' ? 'الفيروزي' : 'الأزرق'}`,
                )}
                disabled={!appearance || saving !== null}
                onClick={() => void chooseAccent(accent)}
                className="min-h-11 justify-start gap-2"
              >
                <span className="size-4 rounded-full" style={{ backgroundColor: colors[accent] }} />
                <span className="capitalize">
                  {text(
                    accent,
                    accent === 'orange'
                      ? 'برتقالي'
                      : accent === 'plum'
                        ? 'بنفسجي'
                        : accent === 'teal'
                          ? 'فيروزي'
                          : 'أزرق',
                  )}
                </span>
                {appearance?.accent === accent && (
                  <span className="ms-auto text-primary" aria-hidden="true">
                    ✓
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
        {saving && (
          <p className="m-0 text-sm text-muted-foreground" role="status">
            {text('Saving POS accent…', 'جارٍ حفظ لون نقطة البيع…')}
          </p>
        )}
        {error && (
          <p className="m-0 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="m-0 text-sm text-success" role="status">
            {notice}
          </p>
        )}
      </div>
    </DashboardCard>
  );
}
