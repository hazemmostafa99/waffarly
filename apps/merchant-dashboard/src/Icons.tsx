import type { ReactNode } from 'react';

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3Z" />
      </>
    ),
    file: (
      <>
        <path d="M5 3h9l5 5v13H5ZM14 3v6h5M9 13h6M9 17h4" />
      </>
    ),
    link: (
      <>
        <path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6m4-6v6" />
      </>
    ),
    tag: (
      <>
        <path d="m12 3 9 9-9 9-9-9Z" />
        <path d="m8 12 4-4 4 4-4 4Z" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6M3 21l4-1 14-14-5-5L2 15Z" />
        <path d="m2 15 5 5" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    box: (
      <>
        <path d="m12 3 9 5v9l-9 5-9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v9m-4.5-16.5 9 5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1" />
        <path d="m3 17 6-6 4 4 3-3 5 5" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-2-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    orders: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    customers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.5-3 2.5-5 6-5s5.5 2 6 5M17 11c2.2.2 3.5 1.5 4 3.5M17 5.5a2.5 2.5 0 0 1 0 5" />
      </>
    ),
    discounts: (
      <>
        <path d="M20 13 13 20l-9-9V4h7Z" />
        <circle cx="8" cy="8" r="1" />
        <path d="m10 14 4-4" />
      </>
    ),
    branches: (
      <>
        <path d="M4 9h16l-2-5H6Zm1 0v11h14V9M9 20v-6h6v6" />
        <path d="M4 9c0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0" />
      </>
    ),
    revenue: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v10M15 9.5c-.6-.7-1.5-1-2.6-1-1.4 0-2.4.7-2.4 1.7 0 2.7 5 1 5 3.7 0 1.1-1 1.8-2.5 1.8-1.1 0-2.1-.3-2.8-1" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 4.3 1.5c-.9 1-2.1 1.3-2.1 3M12 17h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 9h18" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    store: (
      <>
        <path d="M3 9h18l-2-6H5Zm1 0v12h16V9M9 21v-8h6v8M3 9c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21M12 3c-2.2 2.4-3.3 5.4-3.3 9S9.8 18.6 12 21" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    refresh: (
      <path d="M20 7v5h-5M4 17v-5h5m-3.5-2a7 7 0 0 1 12-2L20 12M4 12l2.5 4a7 7 0 0 0 12-2" />
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    'arrow-up': <path d="M12 19V5m-7 7 7-7 7 7" />,
    'arrow-down': <path d="M12 5v14m-7-7 7 7 7-7" />,
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    mapPin: (
      <>
        <path d="M19 10c0 5.2-7 10-7 10s-7-4.8-7-10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />,
    pause: (
      <>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </>
    ),
    trend: <path d="m3 17 6-6 4 4 8-9m-6 0h6v6" />,
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5.3-3.4 8.8-8 10-4.6-1.2-8-4.7-8-10V6Z" />
        <path d="m8.5 12 2.3 2.3 4.8-5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    bag: (
      <>
        <path d="M5 8h14l-1 12H6Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
    megaphone: (
      <>
        <path d="m4 13 12 4V7L4 11Z" />
        <path d="M16 9h3a2 2 0 0 1 0 4h-3M7 14l1.5 5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
        <path d="M9 7h6M9 11h6M9 15h3" />
      </>
    ),
    gift: (
      <>
        <path d="M4 10h16v10H4Z" />
        <path d="M3 7h18v3H3ZM12 7v13" />
        <path d="M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5C11 5.9 12 7 12 7Zm0 0h3.5a2.5 2.5 0 1 0-2.5-2.5C13 5.9 12 7 12 7Z" />
      </>
    ),
    ticket: (
      <>
        <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z" />
        <path d="M12 8v1m0 3v1m0 3v1" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </>
    ),
    userPlus: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.5-3 2.5-5 6-5 2.1 0 3.7.7 4.8 2M19 14v6m-3-3h6" />
      </>
    ),
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z" />,
    percent: (
      <>
        <path d="M19 5 5 19" />
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </>
    ),
    phone: (
      <>
        <path d="M6.5 3.5 9 3l2 5-2 1.5a14 14 0 0 0 5.5 5.5L16 13l5 2 .5 2.5A3 3 0 0 1 18.5 21C10 21 3 14 3 5.5A3 3 0 0 1 6.5 3.5Z" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    send: (
      <>
        <path d="m4 4 16 8-16 8 3-8-3-8Z" />
        <path d="M7 12h13" />
      </>
    ),
  };
  return (
    <svg
      className="merchant-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}
