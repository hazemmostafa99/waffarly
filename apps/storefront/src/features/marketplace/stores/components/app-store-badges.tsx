export function AppStoreBadges() {
  const badgeClassName =
    'app-btn inline-flex min-h-14 items-center gap-2.5 rounded-xl border border-white/25 bg-[#121212] px-3.5 py-2 text-white shadow-sm';

  return (
    <div className="app-actions flex shrink-0 flex-wrap gap-3 max-[700px]:mt-5">
      <span className={badgeClassName} dir="ltr" aria-label="Google Play">
        <svg aria-hidden="true" viewBox="0 0 24 26" className="size-7 shrink-0">
          <path fill="#4285F4" d="M2 1 14 13 2 25Z" />
          <path fill="#34A853" d="m2 1 12 12 5-5Z" />
          <path fill="#FBBC04" d="m14 13 5-5 4 3a2.4 2.4 0 0 1 0 4l-4 3Z" />
          <path fill="#EA4335" d="M2 25 14 13l5 5Z" />
        </svg>
        <span className="flex flex-col font-sans">
          <span className="text-[9px] font-medium leading-[14px] tracking-[0.08em]">GET IT ON</span>
          <span className="text-[19px] font-semibold leading-6 tracking-tight">Google Play</span>
        </span>
      </span>
      <span className={badgeClassName} dir="ltr" aria-label="App Store">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-8 shrink-0">
          <path d="M17.05 12.54c.03 3.23 2.84 4.3 2.87 4.31-.02.08-.45 1.54-1.48 3.05-.9 1.3-1.84 2.6-3.3 2.63-1.44.03-1.9-.85-3.55-.85-1.64 0-2.15.82-3.52.88-1.42.05-2.5-1.42-3.4-2.72C2.84 17.18 1.44 12.33 3.3 9.06a5.25 5.25 0 0 1 4.46-2.7c1.4-.03 2.73.94 3.58.94.86 0 2.46-1.16 4.15-.99.7.03 2.68.28 3.95 2.14-.1.06-2.36 1.38-2.34 4.09ZM14.33 4.56c.75-.91 1.26-2.17 1.12-3.43-1.08.04-2.4.72-3.18 1.63-.7.8-1.31 2.09-1.15 3.32 1.2.09 2.44-.62 3.21-1.52Z" />
        </svg>
        <span className="flex flex-col font-sans">
          <span className="text-[10px] font-medium leading-[14px]">Download on the</span>
          <span className="text-[20px] font-semibold leading-6 tracking-tight">App Store</span>
        </span>
      </span>
    </div>
  );
}
