import { useEffect, useRef, useState } from 'react';
import type { SaveMerchantStorefrontRequest } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { storefrontUrl } from '../../lib/storefront-url.js';
import type { RestaurantIdentityDraft } from './RestaurantSettings.js';
import { SettingsChoices } from './SettingsChoices.js';

export function StorefrontPreview({ slug, identity, appearance }: {
  slug: string;
  identity?: RestaurantIdentityDraft | undefined;
  appearance: SaveMerchantStorefrontRequest;
}) {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const frame = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const url = new URL(storefrontUrl(slug));
  url.pathname = '/store-preview' + url.pathname.slice('/s'.length);
  url.searchParams.set('locale', locale);
  const origin = url.origin;
  const src = url.toString();

  useEffect(() => {
    const send = () => {
      frame.current?.contentWindow?.postMessage({
        type: 'waffarly:appearance-preview',
        primaryColor: appearance.primaryColor,
        accentColor: appearance.accentColor,
        backgroundColor: appearance.backgroundColor,
        surfaceColor: appearance.surfaceColor,
        logoScale: appearance.logoScale,
        heroTitle: appearance.heroTitle,
        heroEyebrow: appearance.heroEyebrow,
        heroEmphasis: appearance.heroEmphasis,
        heroShade: appearance.heroShade,
        logoData: identity ? identity.logoImage?.src ?? null : appearance.logoData,
        ...(identity && {
          merchantName: identity.name,
          restaurantDescription: identity.description,
          coverImageUrl: identity.coverImage?.src ?? null,
        }),
      }, origin);
    };
    const onReady = (event: MessageEvent<unknown>) => {
      if (event.origin === origin && event.source === frame.current?.contentWindow &&
          event.data === 'waffarly:preview-ready') send();
    };
    window.addEventListener('message', onReady);
    send();
    return () => window.removeEventListener('message', onReady);
  }, [appearance, identity, origin, src]);

  return (
    <section className="rs-real-preview" aria-labelledby="storefront-preview-heading">
      <div className="rs-inline-heading">
        <h3 id="storefront-preview-heading">{ar ? 'معاينة المتجر' : 'Store preview'}</h3>
        <SettingsChoices<'desktop' | 'mobile'>
          label={ar ? 'عرض المعاينة' : 'Preview viewport'}
          hideLabel
          value={viewport}
          onChange={setViewport}
          options={[
            { value: 'desktop', label: ar ? 'كمبيوتر' : 'Desktop', icon: 'monitor' },
            { value: 'mobile', label: ar ? 'موبايل' : 'Mobile', icon: 'smartphone' },
          ]}
        />
      </div>
      <iframe
        ref={frame}
        src={src}
        title={ar ? 'معاينة المتجر' : 'Store preview'}
        referrerPolicy="origin"
        sandbox="allow-scripts allow-same-origin"
        className={viewport === 'mobile' ? 'is-mobile' : undefined}
      />
    </section>
  );
}
