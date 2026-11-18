export type StorefrontLayout = 'menu' | 'hero';

export interface StorefrontHeroSettings {
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroEmphasis: string | null;
  heroShade: 'light' | 'medium' | 'strong';
}

export interface MerchantStorefrontSettings extends StorefrontHeroSettings {
  merchantId: string;
  storefrontSlug: string;
  storefrontHandle?: string | null;
  layout: StorefrontLayout;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  logoScale: 'small' | 'medium' | 'large';
  logoData: string | null;
  coverImageUrl: string | null;
  revision: number;
}

export interface SaveMerchantStorefrontRequest extends Partial<StorefrontHeroSettings> {
  layout: StorefrontLayout;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  logoScale: 'small' | 'medium' | 'large';
  logoData: string | null;
  revision: number;
}

