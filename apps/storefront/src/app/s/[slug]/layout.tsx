import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { LocaleProvider } from '@waffarly/ui';
import type { Locale } from '@waffarly/ui';
import { cairo, tajawal } from '../../../fonts/storefront-fonts';
import { ApiError } from '../../../lib/api-client';
import { getStorefrontCatalog } from '../../../features/catalog/storefront-data';
import { StorefrontFooter } from '../../../components/storefront/storefront-footer';
import { StorefrontHeader } from '../../../components/storefront/storefront-header';
import { StorefrontProviders } from '../../../providers/storefront-providers';
import { StorefrontAddressProvider } from '../../../components/storefront/storefront-link';
import { storefrontHostHandle } from '../../../lib/storefront-address';

type StorefrontRouteProps = {
  params: Promise<{ slug: string }>;
};
type StorefrontLayoutProps = StorefrontRouteProps & { children: ReactNode };

export async function generateMetadata({ params }: StorefrontRouteProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const catalog = await getStorefrontCatalog(slug);
    return {
      title: `${catalog.merchantName} | Waffarly`,
      description: `Explore the menu from ${catalog.merchantName}.`,
      openGraph: {
        title: catalog.merchantName,
        description: `Explore the menu from ${catalog.merchantName}.`,
      },
    };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
}

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  const [{ slug }, cookieStore] = await Promise.all([params, cookies()]);
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const handle = storefrontHostHandle(host);
  const hostBased = handle !== null &&
    handle === slug;
  let catalog;
  try {
    catalog = await getStorefrontCatalog(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
  const locale: Locale = cookieStore.get('waffarly-locale')?.value === 'en' ? 'en' : 'ar';

  return (
    <LocaleProvider initialLocale={locale}>
      <StorefrontProviders key={catalog.slug} slug={catalog.slug}>
        <StorefrontAddressProvider slug={catalog.slug} routeSlug={slug} hostBased={hostBased}>
          <div
            className={`${cairo.variable} ${tajawal.variable} storefront-theme min-h-screen bg-store-page font-body text-store-ink`}
          >
            <StorefrontHeader catalog={catalog} />
            <div className="pb-20 lg:pb-0">{children}</div>
            <StorefrontFooter catalog={catalog} />
          </div>
        </StorefrontAddressProvider>
      </StorefrontProviders>
    </LocaleProvider>
  );
}
