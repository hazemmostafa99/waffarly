'use client';

import Link from 'next/link';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { storefrontHref } from '../../lib/storefront-address';

const AddressContext = createContext({ slug: '', hostBased: false });

export function StorefrontAddressProvider({ slug, hostBased, children }: {
  slug: string; hostBased: boolean; children: ReactNode;
}) {
  return <AddressContext.Provider value={{ slug, hostBased }}>{children}</AddressContext.Provider>;
}

export function useStorefrontBasePath(slug: string): string {
  const address = useContext(AddressContext);
  return address.hostBased && address.slug === slug ? '' : `/s/${encodeURIComponent(slug)}`;
}

/** Preserve legacy URLs while rendering clean paths on a merchant hostname. */
export default function StorefrontLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { slug, hostBased } = useContext(AddressContext);
  const publicHref = typeof href === 'string'
    ? storefrontHref(href, slug, hostBased)
    : { ...href, pathname: href.pathname ? storefrontHref(href.pathname, slug, hostBased) : href.pathname };
  return <Link {...props} href={publicHref} />;
}
