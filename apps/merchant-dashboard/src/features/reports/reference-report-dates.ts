/** Cairo calendar boundaries shared by every report screen. API end timestamps are exclusive. */
import { cairoMonth } from './report-helpers.js';

export function cairoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
export function shiftReportDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function monthDates(month: string) {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year!, number!, 1)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: shiftReportDate(next, -1) };
}
/** Find the first instant in a Cairo date, including dates whose DST transition skips midnight. */
export function cairoStart(date: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDate = (time: number) => {
    const parts = formatter.formatToParts(new Date(time));
    return ['year', 'month', 'day']
      .map((type) => parts.find((part) => part.type === type)!.value)
      .join('-');
  };
  const noon = Date.parse(`${date}T12:00:00Z`);
  let low = noon - 24 * 60 * 60 * 1000,
    high = noon;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (localDate(mid) < date) low = mid;
    else high = mid;
  }
  return new Date(high).toISOString();
}
export function reportRange(month: string, period: string) {
  if (period === 'month') return monthDates(month);
  const today = cairoToday();
  if (period === 'yesterday') {
    const yesterday = shiftReportDate(today, -1);
    return { from: yesterday, to: yesterday };
  }
  return { from: period === 'last7' ? shiftReportDate(today, -6) : today, to: today };
}
export function reportMonth(value: string | null) {
  return value && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) ? value : cairoMonth();
}
export function reportMonthLabel(month: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`));
}
