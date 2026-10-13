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
  return (
    <section
      aria-label={`${layout === 'menu' ? 'Menu-first' : 'Welcome-first'} restaurant storefront preview`}
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
            {name || 'Your restaurant'}
            <small>FRESH FROM OUR KITCHEN</small>
          </span>
        </span>
        <span className="design-nav">
          <span>OUR MENU</span>
          <span>OUR STORY</span>
        </span>
        <span className="design-header-action">
          ORDER NOW <span aria-hidden="true">↗</span>
        </span>
      </header>

      <div className="design-hero-copy">
        <span className="design-eyebrow">
          {layout === 'menu' ? 'GOOD FOOD, GROWN HERE' : 'A PLACE AT OUR TABLE'}
        </span>
        <h2>
          {layout === 'menu' ? 'A little garden\nin every meal.' : 'Come hungry.\nLeave happy.'}
        </h2>
        <p>{description || 'Thoughtfully prepared food, gathered around the table.'}</p>
        <span className="design-cta">
          EXPLORE THE MENU <span aria-hidden="true">→</span>
        </span>
      </div>

      <div className="design-food-art" aria-hidden="true">
        <span className="design-art-sun" />
        <span className="design-plate">
          <span className="design-food-leaf">✳</span>
          <span className="design-food-center">✹</span>
          <span className="design-food-seed">· · ·</span>
        </span>
        <span className="design-art-label">MADE WITH CARE</span>
      </div>

      <div className="design-menu-strip">
        <span>
          <small>01</small> MADE FRESH DAILY
        </span>
        <span>
          <small>02</small> SEASONAL INGREDIENTS
        </span>
        <span>
          <small>03</small> YOUR TABLE IS READY
        </span>
      </div>

      <footer className="design-footer">
        <span>GOOD THINGS ARE GATHERED HERE</span>
        <span>SCROLL TO EXPLORE ↓</span>
      </footer>
    </section>
  );
}
