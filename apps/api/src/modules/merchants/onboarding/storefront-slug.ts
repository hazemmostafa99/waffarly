/** Builds the technical storefront identifier used when a new merchant is created. */
export function createStorefrontSlug(name: string, id: string): string {
  const namePart = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return `${namePart || 'store'}-${id.replaceAll('-', '').toLocaleLowerCase('en')}`;
}
