'use client';

import { useEffect, useState } from 'react';

export function FlashCountdown() {
  const [remaining, setRemaining] = useState(5 * 3600 + 42 * 60 + 18);
  useEffect(() => {
    const interval = window.setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const parts = [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60];
  return (
    <div className="timer" aria-label="الوقت المتبقي">
      {parts.map((n, i) => (
        <span key={i} className="contents">
          {i > 0 && <span>:</span>}
          <span className="time">{String(n).padStart(2, '0')}</span>
        </span>
      ))}
    </div>
  );
}
