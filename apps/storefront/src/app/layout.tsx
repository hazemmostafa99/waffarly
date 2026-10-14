import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@waffarly/ui';
import { SiteChrome } from './site-chrome';
import '@waffarly/ui/theme.css';
import './globals.css';
import '@waffarly/ui/storefront-design.css';

export const metadata: Metadata = {
  title: 'Waffarly Storefront',
  description: 'Bring your business to Waffarly. انضم بمتجرك إلى وفّرلي.',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = (await cookies()).get('waffarly-locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <SiteChrome>{children}</SiteChrome>
        </LocaleProvider>
      </body>
    </html>
  );
}
