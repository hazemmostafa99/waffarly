const priceFormatter = new Intl.NumberFormat('en-US', { numberingSystem: 'latn' });
export const money = (value: number) => priceFormatter.format(value) + ' ج.م';
