/** Format numbers with standard separators and Western digits in every UI locale. */
export function formatNumber(
  value: number,
  _locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat('en-EG-u-nu-latn', options).format(value);
}

/** Normalize Arabic-Indic and Persian digits in display text to Western digits. */
export function formatDigits(value: string | number, _locale: string): string {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}
