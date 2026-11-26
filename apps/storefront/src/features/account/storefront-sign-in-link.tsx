'use client';

import type { ComponentProps } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link, {
  useStorefrontBasePath,
  useStorefrontSlug,
} from '@/components/storefront/storefront-link';

export function StorefrontSignInLink(props: Omit<ComponentProps<typeof Link>, 'href'>) {
  const slug = useStorefrontSlug();
  const base = useStorefrontBasePath(slug);
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Link
      {...props}
      href={`${base}/login?returnTo=${encodeURIComponent(pathname)}`}
      onClick={(event) => {
        // Include filters and anchors without making the shared header depend on Suspense.
        const target = new URL(event.currentTarget.href);
        target.searchParams.set(
          'returnTo',
          window.location.pathname + window.location.search + window.location.hash,
        );
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        router.push(target.pathname + target.search);
      }}
    />
  );
}

/**
 * True when a return path has a backslash or an ASCII control character (codes 0-31),
 * which browsers may normalise into another destination.
 * Example: "/menu" -> false, "/\evil.com" -> true, "/menu" + newline -> true.
 */
function hasUnsafePathCharacter(value: string): boolean {
  for (const character of value) {
    if (character === '\\' || character.charCodeAt(0) < 0x20) return true;
  }
  return false;
}

/** Accept only paths inside this storefront, never external URLs or another tenant. */
export function storefrontReturnPath(value: string | null, base: string): string {
  const home = base || '/';
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafePathCharacter(value))
    return home;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return home;
    const path = decodeURIComponent(url.pathname);
    const localPath = base ? path.slice(base.length) : path;
    if (base && path !== base && !path.startsWith(`${base}/`)) return home;
    const allowedPage =
      /^\/(?:menu|offers|about|branches|favorites|cart|checkout|account(?:\/(?:profile|orders|addresses))?|(?:order|products)\/[a-zA-Z0-9_-]+)\/?$/;
    if (localPath && localPath !== '/' && !allowedPage.test(localPath)) return home;
    if (hasUnsafePathCharacter(path)) return home;
    return url.pathname + url.search + url.hash;
  } catch {
    return home;
  }
}
