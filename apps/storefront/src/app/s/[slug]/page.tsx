import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { ApiError, apiGet } from '../../../lib/api-client';
import { StorefrontMenu } from './storefront-menu';

export const dynamic = 'force-dynamic';

type StorefrontPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} | Waffarly`, robots: { index: true, follow: true } };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  let catalog: PublicStorefrontCatalog;
  try {
    catalog = await apiGet<PublicStorefrontCatalog>(`catalog/stores/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
  return <StorefrontMenu catalog={catalog} />;
}
