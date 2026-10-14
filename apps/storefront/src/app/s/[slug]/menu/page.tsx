import { requireStorefrontCatalog } from '../../../../features/catalog/storefront-data';
import { StorefrontMenuPage } from '../../../../features/catalog/storefront-menu-page';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function MenuPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const catalog = await requireStorefrontCatalog(slug);
  return (
    <StorefrontMenuPage
      catalog={catalog}
      initialCategoryId={firstString(query.category)}
      initialSearch={firstString(query.q)}
      initialSort={firstString(query.sort)}
    />
  );
}
