import type { CatalogProductFields } from '@waffarly/contracts';
export type ProductInput = CatalogProductFields;
export type ProductPatch = { [Key in keyof ProductInput]?: ProductInput[Key] | undefined };
