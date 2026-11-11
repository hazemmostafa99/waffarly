import type { BusinessActivityKey } from './activities-modules.js';

export type TemplateLayout = 'menu' | 'hero';
export type TemplateStatus = 'draft' | 'available';

export interface MerchantStorefrontSettings {
  merchantId: string;
  storefrontSlug: string;
  storefrontHandle?: string | null;
  templateId: string | null;
  accentColor: string;
  logoData: string | null;
  revision: number;
  templates: StorefrontTemplateSummary[];
}

export interface SaveMerchantStorefrontRequest {
  templateId: string;
  accentColor: string;
  logoData: string | null;
  revision: number;
}

export interface CreateStorefrontTemplateRequest {
  key: string;
  name: string;
  description: string;
  activity: BusinessActivityKey | 'general';
  layout: TemplateLayout;
  accentColor: string;
  status: TemplateStatus;
}

export interface StorefrontTemplateSummary extends CreateStorefrontTemplateRequest {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface UpdateStorefrontTemplateRequest extends Omit<
  CreateStorefrontTemplateRequest,
  'key'
> {
  revision: number;
}
