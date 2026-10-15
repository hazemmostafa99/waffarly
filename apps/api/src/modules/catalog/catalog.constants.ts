export const MAX_PRODUCT_IMAGES = 10;
export const MAX_PRODUCT_PRICE = '9999999999.99';

export function isValidProductPrice(value: string): boolean {
  return /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) && !/^0(?:\.0{1,2})?$/.test(value);
}
