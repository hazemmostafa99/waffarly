export type StorefrontLayout = 'menu' | 'hero';

export interface MerchantStorefrontSettings {
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

export interface SaveMerchantStorefrontRequest {
  layout: StorefrontLayout;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  logoScale: 'small' | 'medium' | 'large';
  logoData: string | null;
  revision: number;
}

