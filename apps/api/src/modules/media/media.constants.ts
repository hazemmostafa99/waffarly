export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024;
export type ImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export function isImageMimeType(value: string): value is ImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}
