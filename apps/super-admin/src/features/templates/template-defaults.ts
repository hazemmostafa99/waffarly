import type { CreateStorefrontTemplateRequest } from '@waffarly/contracts';

export const emptyTemplateDraft: CreateStorefrontTemplateRequest = {
  key: '',
  name: '',
  description: '',
  activity: 'restaurant',
  layout: 'menu',
  accentColor: '#245c43',
  status: 'draft',
};
