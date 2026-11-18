import type { CSSProperties } from 'react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';

type ColorVariables = CSSProperties & Record<string, string>;

function validColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function rgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function mix(first: string, second: string, amount: number): string {
  const left = rgb(first);
  const right = rgb(second);
  const channels = left.map((value, index) =>
    Math.round(value * (1 - amount) + right[index]! * amount),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

function readableForeground(backgrounds: string | string[]): string {
  const values = Array.isArray(backgrounds) ? backgrounds : [backgrounds];
  const options = ['#ffffff', '#172330'];
  return options
    .map((color) => ({
      color,
      contrast: Math.min(...values.map((background) => contrastRatio(background, color))),
    }))
    .sort((first, second) => second.contrast - first.contrast)[0]!.color;
}

function readableBrandColor(color: string, backgrounds: string | string[]): string {
  const values = Array.isArray(backgrounds) ? backgrounds : [backgrounds];
  if (Math.min(...values.map((background) => contrastRatio(color, background))) >= 4.5) {
    return color;
  }
  return readableForeground(values);
}

export function storefrontThemeStyles(catalog: PublicStorefrontCatalog): ColorVariables {
  // Cached catalogs may predate the palette fields; validate before calculating colors.
  const primaryColor = validColor(catalog.primaryColor, '#0f705a');
  const accentColor = validColor(catalog.accentColor, '#f5b544');
  const backgroundColor = validColor(catalog.backgroundColor, '#faf8f4');
  const surfaceColor = validColor(catalog.surfaceColor, '#ffffff');
  const primaryDark = mix(primaryColor, '#000000', 0.18);
  const primaryDeep = mix(primaryColor, '#000000', 0.55);
  const pageSurfaces = [backgroundColor, surfaceColor];
  const ink = readableForeground(pageSurfaces);
  const primaryText = readableBrandColor(primaryColor, pageSurfaces);
  const primaryDarkText = readableBrandColor(primaryDark, pageSurfaces);
  const primaryDeepText = readableBrandColor(primaryDeep, pageSurfaces);
  const accentText = readableBrandColor(accentColor, pageSurfaces);
  const accentOnPrimaryDeep = readableBrandColor(accentColor, primaryDeep);

  return {
    '--storefront-primary': primaryColor,
    '--storefront-primary-dark': primaryDark,
    '--storefront-primary-deep': primaryDeep,
    '--storefront-primary-foreground': readableForeground(primaryColor),
    '--storefront-primary-dark-foreground': readableForeground(primaryDark),
    '--storefront-primary-deep-foreground': readableForeground(primaryDeep),
    '--storefront-primary-text': primaryText,
    '--storefront-primary-dark-text': primaryDarkText,
    '--storefront-primary-deep-text': primaryDeepText,
    '--storefront-accent': accentColor,
    '--storefront-accent-foreground': readableForeground(accentColor),
    '--storefront-accent-text': accentText,
    '--storefront-accent-on-primary-deep': accentOnPrimaryDeep,
    '--storefront-gold': accentColor,
    '--storefront-gold-muted': mix(accentColor, '#000000', 0.18),
    '--storefront-page': backgroundColor,
    '--storefront-surface': surfaceColor,
    '--storefront-cream': mix(surfaceColor, accentColor, 0.09),
    '--storefront-ink': ink,
    '--storefront-secondary': mix(ink, surfaceColor, 0.38),
    '--storefront-muted': mix(ink, surfaceColor, 0.58),
    '--storefront-border': mix(surfaceColor, primaryColor, 0.14),
    '--storefront-outline': mix(surfaceColor, primaryColor, 0.22),
  };
}
