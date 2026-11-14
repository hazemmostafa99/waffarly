import { useEffect, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import type { StorefrontTemplateSummary, TemplateLayout } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';

const previewAssets = {
  hero: '/assets/restaurant-hero.jpg',
  menu: '/assets/restaurant-menu.jpg',
  offers: '/assets/restaurant-offers.jpg',
} as const;

function templatePreviewSource(
  template: Pick<StorefrontTemplateSummary, 'key' | 'name' | 'description' | 'layout'>,
) {
  const content = `${template.key} ${template.name} ${template.description}`.toLocaleLowerCase();
  if (/offer|promotion|promo|deal/.test(content)) return previewAssets.offers;
  return template.layout === 'hero' ? previewAssets.hero : previewAssets.menu;
}

function layoutPreviewSource(layout: TemplateLayout, name: string, description: string) {
  const content = `${name} ${description}`.toLocaleLowerCase();
  if (/offer|promotion|promo|deal/.test(content)) return previewAssets.offers;
  return layout === 'hero' ? previewAssets.hero : previewAssets.menu;
}

function Artwork({ source, name }: { source: string; name: string }) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [source]);

  if (failed) {
    return (
      <div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-waffarly-kpi-mint via-white to-waffarly-kpi-gold text-waffarly-primary">
        <div className="grid justify-items-center gap-2">
          <span className="grid size-11 place-items-center rounded-2xl bg-white shadow-sm">
            <LayoutTemplate size={20} aria-hidden="true" />
          </span>
          <span className="text-xs font-bold">{name || t('Storefront preview')}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={source}
      alt=""
      className="aspect-[16/9] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function TemplateArtwork({
  template,
}: {
  template: Pick<StorefrontTemplateSummary, 'key' | 'name' | 'description' | 'layout'>;
}) {
  return <Artwork source={templatePreviewSource(template)} name={template.name} />;
}

export function TemplateFormArtwork({
  layout,
  name,
  description,
}: {
  layout: TemplateLayout;
  name: string;
  description: string;
}) {
  return <Artwork source={layoutPreviewSource(layout, name, description)} name={name} />;
}
