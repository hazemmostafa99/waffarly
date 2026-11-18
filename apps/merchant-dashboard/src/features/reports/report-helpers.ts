/** Shared report formatting, comparison and CSV export; financial totals stay in the API. */
export function cairoMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
}

export function validReportMonth(value: string | null): string {
  return value && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) ? value : cairoMonth();
}

export function reportCents(value: string): bigint {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

export function reportMoney(value: string | null, locale: string): string {
  if (value === null) return '—';
  const cents = reportCents(value);
  const absolute = cents < 0n ? -cents : cents;
  const whole = new Intl.NumberFormat('en-EG').format(absolute / 100n);
  return `${cents < 0n ? '−' : ''}${whole}.${String(absolute % 100n).padStart(2, '0')} ${locale === 'ar' ? 'ج.م' : 'EGP'}`;
}

/** No percentage is invented for a zero/negative baseline or incomplete values. */
export function reportChange(current: string | null, previous: string | null): string | null {
  if (current === null || previous === null) return null;
  const baseline = reportCents(previous);
  if (baseline <= 0n) return null;
  const change = ((reportCents(current) - baseline) * 10_000n) / baseline;
  const absolute = change < 0n ? -change : change;
  return `${change > 0n ? '+' : change < 0n ? '−' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}%`;
}

export function reportLink(path: string, filters: Record<string, string | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return `${path}?${query.toString()}`;
}

export function downloadReportCsv(filename: string, rows: Array<Array<string | number | null>>) {
  const cell = (value: string | number | null) => {
    let text = value === null ? 'Incomplete / غير مكتمل' : String(value);
    // Keep numeric amounts usable while neutralizing spreadsheet formulas in names/categories.
    if (!/^-?\d+(\.\d+)?$/.test(text) && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
