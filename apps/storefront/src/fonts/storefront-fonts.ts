import localFont from 'next/font/local';

export const cairo = localFont({
  src: './Cairo-Variable.ttf',
  weight: '200 1000',
  style: 'normal',
  variable: '--font-cairo',
  display: 'swap',
  fallback: ['Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
});

export const tajawal = localFont({
  src: [
    { path: './Tajawal-Regular.ttf', weight: '400', style: 'normal' },
    { path: './Tajawal-Medium.ttf', weight: '500', style: 'normal' },
    { path: './Tajawal-Bold.ttf', weight: '700', style: 'normal' },
    { path: './Tajawal-ExtraBold.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-tajawal',
  display: 'swap',
  fallback: ['Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
});
