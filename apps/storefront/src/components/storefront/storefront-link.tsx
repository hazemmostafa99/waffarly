'use client';

import Link from 'next/link';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { storefrontHref } from '../../lib/storefront-address';

const AddressContext = createContext({ slug: '', routeSlug: '', hostBased: false });

export function StorefrontAddressProvider({
  slug,
  routeSlug,
  hostBased,
  children,
}: {
  slug: string;
  routeSlug: string;
  hostBased: boolean;
  children: ReactNode;
}) {
  return (
    <AddressContext.Provider value={{ slug, routeSlug, hostBased }}>
      {children}
    </AddressContext.Provider>
  );
}

export function useStorefrontBasePath(slug: string): string {
  const address = useContext(AddressContext);
  return address.hostBased && (address.slug === slug || address.routeSlug === slug)
    ? ''
    : `/s/${encodeURIComponent(slug)}`;
}

/** Preserve legacy URLs while rendering clean paths on a merchant hostname. */
export default function StorefrontLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { slug, routeSlug, hostBased } = useContext(AddressContext);
  const publicPath = (path: string) =>
    storefrontHref(storefrontHref(path, slug, hostBased), routeSlug, hostBased);
  const publicHref =
    typeof href === 'string'
      ? publicPath(href)
      : { ...href, pathname: href.pathname ? publicPath(href.pathname) : href.pathname };
  return <Link {...props} href={publicHref} />;
}
