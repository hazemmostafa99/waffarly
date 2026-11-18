import type { Metadata } from 'next';
import { requireStorefrontCatalog } from '../../../features/catalog/storefront-data';
import { StorefrontAppearancePreview } from '../../../features/catalog/storefront-appearance-preview';
import { cairo, tajawal } from '../../../fonts/storefront-fonts';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StorePreview({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const [{ slug }, { locale }] = await Promise.all([params, searchParams]);
  const catalog = await requireStorefrontCatalog(slug);

  return (
    <StorefrontAppearancePreview
      initialCatalog={catalog}
      locale={locale === 'en' ? 'en' : 'ar'}
      fontClasses={`${cairo.variable} ${tajawal.variable}`}
    />
  );
}
