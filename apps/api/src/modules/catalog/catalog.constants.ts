export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 10;
export const MAX_PRODUCT_PRICE = '9999999999.99';

export type ImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export function isImageMimeType(value: string): value is ImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function isValidProductPrice(value: string): boolean {
  return /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) && !/^0(?:\.0{1,2})?$/.test(value);
}
