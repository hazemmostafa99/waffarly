import { cookies } from 'next/headers';
import type { Locale } from '@waffarly/ui';
import { requireStorefrontCatalog } from '../../../features/catalog/storefront-data';
import { StorefrontHomePage } from '../../../features/catalog/storefront-home-page';

type PageProps = { params: Promise<{ slug: string }> };

export default async function StorefrontHome({ params }: PageProps) {
  const [{ slug }, cookieStore] = await Promise.all([params, cookies()]);
  const catalog = await requireStorefrontCatalog(slug);
  const locale: Locale = cookieStore.get('waffarly-locale')?.value === 'ar' ? 'ar' : 'en';
  return <StorefrontHomePage catalog={catalog} locale={locale} />;
}
