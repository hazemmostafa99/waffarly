'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { ar } from './locales/ar.js';
import { Button } from './button.js';
import { cn } from './utils.js';
import { formatDigits, formatNumber } from './number-format.js';

export type Locale = 'en' | 'ar';
export type LocalizedMessage = string | { key: string; values?: Record<string, unknown> };
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void } | null>(
  null,
);

export function LocaleProvider({
  children,
  initialLocale = 'ar',
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [i18n] = useState(() => {
    const instance = createInstance();
    void instance.use(initReactI18next).init({
      lng: initialLocale,
      fallbackLng: 'en',
      supportedLngs: ['en', 'ar'],
      resources: {
        en: { translation: Object.fromEntries(Object.keys(ar).map((key) => [key, key])) },
        ar: { translation: ar },
      },
      keySeparator: false,
      nsSeparator: false,
      initAsync: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    return instance;
  });

  function setLocale(next: Locale) {
    updateLocale(next);
    void i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.cookie = `waffarly-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem('waffarly-locale', next);
    } catch {
      /* Cookie still preserves the preference. */
    }
  }

  useEffect(() => {
    const saved = document.cookie.match(/(?:^|; )waffarly-locale=(en|ar)(?:;|$)/)?.[1];
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('waffarly-locale');
    } catch {
      /* Storage can be disabled. */
    }
    const preferred = saved ?? stored ?? initialLocale;
    const next: Locale = preferred === 'ar' ? 'ar' : 'en';
    updateLocale(next);
    void i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  }, [i18n, initialLocale]);

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
    </I18nextProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Consumers use the hook and provider from the same shared entry point.
export function useLocale() {
  const context = useContext(LocaleContext);
  const { t: translate } = useTranslation();
  if (!context) throw new Error('LocaleProvider is required.');
  return useMemo(
    () => ({
      ...context,
      t: (message: LocalizedMessage, values: Record<string, unknown> = {}) => {
        const text = typeof message === 'string' ? message : message.key;
        const interpolation = typeof message === 'string' ? values : (message.values ?? {});
        const formattedValues = Object.fromEntries(
          Object.entries(interpolation).map(([key, value]) => [
            key,
            typeof value === 'number' ? formatNumber(value, context.locale) : value,
          ]),
        );
        return formatDigits(
          String(
            translate(text, {
              ...formattedValues,
              defaultValue: text,
            }),
          ),
          context.locale,
        );
      },
      errorText: (text: string) => {
        if (context.locale === 'en') return formatDigits(text, context.locale);
        if (ar[text]) return formatDigits(String(translate(text)), context.locale);
        const required = text.match(/^Select the required modules for (.+)\.$/);
        return formatDigits(
          String(
            translate(
              required ? 'Select the required modules for {{name}}.' : 'Something went wrong.',
              { name: required?.[1] },
            ),
          ),
          context.locale,
        );
      },
      formatDigits: (value: string | number) => formatDigits(value, context.locale),
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, context.locale, options),
      formatDate: (value: string, withTime = false) =>
        new Intl.DateTimeFormat(
          context.locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn',
          withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
        ).format(new Date(value)),
    }),
    [context, translate],
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'border-waffarly-border bg-waffarly-surface text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink',
        className,
      )}
      type="button"
      aria-label={t('Change language')}
      onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
    >
      <span lang={locale === 'en' ? 'ar' : 'en'}>{locale === 'en' ? 'العربية' : 'English'}</span>
    </Button>
  );
}
