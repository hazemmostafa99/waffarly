'use client';
import { useLocale } from './i18n.js';
import type { CSSProperties } from 'react';

export interface StorefrontDesignPreviewProps {
  layout: 'menu' | 'hero';
  name: string;
  description?: string;
  accentColor: string;
  logoData?: string | null;
  className?: string;
}

export function StorefrontDesignPreview({
  layout,
  name,
  description = '',
  accentColor,
  logoData = null,
  className,
}: StorefrontDesignPreviewProps) {
  const { t } = useLocale();
  return (
    <section
      aria-label={t('{{layout}} business storefront preview', {
        layout: layout === 'menu' ? t('Catalog-first') : t('Welcome-first'),
      })}
      className={['storefront-design', `design-${layout}`, className].filter(Boolean).join(' ')}
      style={{ '--design-accent': accentColor } as CSSProperties}
    >
      <header className="design-header">
        <span className="design-brand">
          {logoData ? (
            <img className="design-logo" src={logoData} alt="" />
          ) : (
            <span className="design-monogram">{name.trim().charAt(0) || 'R'}</span>
          )}
          <span>
            {name || t('Your business')}
            <small>{t('WELCOME TO OUR BUSINESS')}</small>
          </span>
        </span>
        <span className="design-nav">
          <span>{t('OUR CATALOG')}</span>
          <span>{t('OUR STORY')}</span>
        </span>
        <span className="design-header-action">
          {t('EXPLORE NOW')} <span aria-hidden="true">↗</span>
        </span>
      </header>

      <div className="design-hero-copy">
        <span className="design-eyebrow">
          {layout === 'menu' ? t('DISCOVER OUR COLLECTION') : t('WELCOME TO OUR STORE')}
        </span>
        <h2>
          {layout === 'menu' ? t('Great finds.\nEvery day.') : t('Your favorites.\nOne place.')}
        </h2>
        <p>{description || t('Discover our products and services, chosen with care.')}</p>
        <span className="design-cta">
          {t('EXPLORE THE CATALOG')} <span aria-hidden="true">→</span>
        </span>
      </div>

      <div className="design-food-art" aria-hidden="true">
        <span className="design-art-sun" />
        <span className="design-plate">
          <span className="design-food-leaf">✳</span>
          <span className="design-food-center">✹</span>
          <span className="design-food-seed">· · ·</span>
        </span>
        <span className="design-art-label">{t('MADE WITH CARE')}</span>
      </div>

      <div className="design-menu-strip">
        <span>
          <small>01</small> {t('EXPLORE OUR RANGE')}{' '}
        </span>
        <span>
          <small>02</small> {t('CHOSEN WITH CARE')}{' '}
        </span>
        <span>
          <small>03</small> {t('HERE FOR YOU')}{' '}
        </span>
      </div>

      <footer className="design-footer">
        <span>{t('GOOD THINGS ARE GATHERED HERE')}</span>
        <span>{t('SCROLL TO EXPLORE ↓')}</span>
      </footer>
    </section>
  );
}
