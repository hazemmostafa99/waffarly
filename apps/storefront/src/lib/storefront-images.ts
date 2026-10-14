import type { PublicStorefrontProduct } from '@waffarly/contracts';

type ProductImagePlacement = 'card' | 'detail';

export function getStorefrontProductImage(
  product: PublicStorefrontProduct,
  placement: ProductImagePlacement,
): string | undefined {
  const searchText = [product.name, ...product.categories.map((category) => category.name)]
    .join(' ')
    .toLocaleLowerCase('ar-EG');
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const hasMerchantPhoto = primaryImage && !primaryImage.publicUrl.includes('/media/seed/');

  if (hasMerchantPhoto) return primaryImage.publicUrl;

  if (/دجاج|تشيكن|chicken|tenders|crispy/u.test(searchText)) return '/storefront-assets/chicken.webp';
  if (/برجر|burger|سماش/u.test(searchText)) {
    return placement === 'detail'
      ? '/storefront-assets/hero-burger.webp'
      : '/storefront-assets/burger.webp';
  }
  if (/بطاطس|fries|مقبلات|appetizer/u.test(searchText)) return '/storefront-assets/fries.webp';
  if (/بيتزا|pizza/u.test(searchText)) return '/storefront-assets/pizza.webp';
  if (/وافل|waffle|كيك|cake|حلويات|dessert/u.test(searchText)) return '/storefront-assets/waffle.webp';
  if (/مشروبات|مشروب|drink|beverage|shake/u.test(searchText)) return '/storefront-assets/shake.webp';

  return primaryImage?.publicUrl;
}
