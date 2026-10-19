export function isReadablePosLabel(value: string) {
  return /[\p{L}\p{N}]/u.test(value.trim()) && !/[\uFFFD\u25A1]/u.test(value);
}
