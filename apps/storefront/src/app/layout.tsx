import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@waffarly/ui';
import { LocalizedFormValidation } from '@/components/localized-form-validation';
import '@waffarly/ui/theme.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wfarly Storefront',
  description: 'Bring your business to Wfarly. انضم بمتجرك إلى وفّرلي.',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = (await cookies()).get('waffarly-locale')?.value === 'en' ? 'en' : 'ar';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <LocalizedFormValidation />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
