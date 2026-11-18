'use client';

import { useEffect, useState } from 'react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { LocaleProvider, type Locale } from '@waffarly/ui';
import { StorefrontHeader } from '../../components/storefront/storefront-header';
import { StorefrontFooter } from '../../components/storefront/storefront-footer';
import { StorefrontAddressProvider } from '../../components/storefront/storefront-link';
import { StorefrontProviders } from '../../providers/storefront-providers';
import { storefrontThemeStyles } from '../../lib/storefront-theme';
import { RestaurantDeliveryPreview } from '../delivery/restaurant-delivery-preview';
import { StorefrontHomePage } from './storefront-home-page';

function previewImage(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return fallback;
  if (/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : fallback;
  } catch {
    return fallback;
  }
}

export function StorefrontAppearancePreview({ initialCatalog, locale, fontClasses }: {
  initialCatalog: PublicStorefrontCatalog;
  locale: Locale;
  fontClasses: string;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);

  useEffect(() => {
    if (window.parent === window || !document.referrer) return;
    const parentOrigin = new URL(document.referrer).origin;
    const update = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || event.origin !== parentOrigin ||
          typeof event.data !== 'object' || event.data === null) return;

      const data = event.data as Record<string, unknown>;
      if (data.type !== 'waffarly:appearance-preview') return;
      const next = { ...initialCatalog };
      for (const key of ['primaryColor', 'accentColor', 'backgroundColor', 'surfaceColor'] as const) {
        const color = data[key];
        if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) next[key] = color;
      }
      if (data.logoScale === 'small' || data.logoScale === 'medium' || data.logoScale === 'large') {
        next.logoScale = data.logoScale;
      }
      if (typeof data.merchantName === 'string' && data.merchantName.trim()) {
        next.merchantName = data.merchantName.slice(0, 160);
      }
      if (typeof data.restaurantDescription === 'string') {
        next.restaurantDescription = data.restaurantDescription.slice(0, 1000);
      }
      for (const key of ['heroEyebrow', 'heroTitle', 'heroEmphasis'] as const) {
        const line = data[key];
        if (line === null || typeof line === 'string') {
          next[key] = line?.trim().slice(0, 80) || null;
        }
      }
      if (data.heroShade === 'light' || data.heroShade === 'medium' || data.heroShade === 'strong') {
        next.heroShade = data.heroShade;
      }
      next.logoData = previewImage(data.logoData, next.logoData);
      next.coverImageUrl = previewImage(data.coverImageUrl, next.coverImageUrl);
      setCatalog(next);
    };
    window.addEventListener('message', update);
    window.parent.postMessage('waffarly:preview-ready', parentOrigin);
    return () => window.removeEventListener('message', update);
  }, [initialCatalog]);

  return (
    <LocaleProvider initialLocale={locale}>
      <StorefrontProviders slug={catalog.slug}>
        <StorefrontAddressProvider slug={catalog.slug} routeSlug={catalog.slug} hostBased={false}>
          <div
            className={`${fontClasses} storefront-theme min-h-screen bg-store-page font-body text-store-ink`}
            style={storefrontThemeStyles(catalog)}
            inert
          >
            <StorefrontHeader catalog={catalog} />
            {catalog.activity === 'restaurant' && <RestaurantDeliveryPreview slug={catalog.slug} />}
            <div className="pb-20 lg:pb-0"><StorefrontHomePage catalog={catalog} /></div>
            <StorefrontFooter catalog={catalog} />
          </div>
        </StorefrontAddressProvider>
      </StorefrontProviders>
    </LocaleProvider>
  );
}
