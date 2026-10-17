import { useId } from 'react';
import type { FoodKind } from './prototype-data.js';

export function FoodArt({ kind, chocolate = false }: { kind: FoodKind; chocolate?: boolean }) {
  const patternId = useId();
  return (
    <svg viewBox="0 0 220 130" fill="none" aria-hidden="true" className="h-full w-full">
      <ellipse cx="111" cy="113" rx="65" ry="8" fill="currentColor" opacity=".07" />
      {kind === 'waffle' && (
        <>
          <ellipse cx="110" cy="96" rx="79" ry="24" fill="#fffaf0" fillOpacity=".7" />
          <g transform="translate(51 17) rotate(-12 59 45)">
            <rect x="3" y="10" width="116" height="80" rx="19" fill="#ab713f" />
            <rect width="116" height="80" rx="18" fill="#e8b767" />
            <defs>
              <pattern id={patternId} width="24" height="22" patternUnits="userSpaceOnUse">
                <rect x="5" y="5" width="15" height="13" rx="3" fill="#bf8748" />
                <path d="M6 17V6h13" stroke="#f7d69a" strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="8" y="6" width="100" height="66" rx="12" fill={`url(#${patternId})`} />
            {chocolate && (
              <path
                d="m15 11 80 57M8 34l63 45M42 4l62 47"
                stroke="#644131"
                strokeWidth="7"
                strokeLinecap="round"
              />
            )}
            {!chocolate && (
              <>
                <rect
                  x="47"
                  y="25"
                  width="24"
                  height="22"
                  rx="4"
                  fill="#fff0b0"
                  transform="rotate(10 59 35)"
                />
                <path d="M49 27h20" stroke="#fffbe5" strokeWidth="3" />
              </>
            )}
          </g>
          <circle cx="170" cy="91" r="9" fill="#bd5b66" />
          <circle cx="183" cy="84" r="7" fill="#ce7380" />
          <path d="m171 80 7-12 3 15" fill="#6f9464" />
        </>
      )}
      {kind === 'coffee' && (
        <>
          <ellipse cx="111" cy="104" rx="63" ry="13" fill="#fff8ed" fillOpacity=".75" />
          <path d="M146 53h14c24 0 23 38-2 38h-14" stroke="#e9decf" strokeWidth="12" />
          <path d="M62 48h86v35c0 32-86 32-86 0Z" fill="#f9f3e9" />
          <ellipse cx="105" cy="49" rx="43" ry="14" fill="#dfc2a3" />
          <ellipse cx="105" cy="49" rx="35" ry="10" fill="#a87551" />
          <path
            d="M84 48c8-14 34-11 43 0-11 13-27 15-33 6 14-2 20-4 22-9"
            stroke="#f3e3c8"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M92 24c-8-8 9-10 4-19m20 17c-5-7 8-10 4-16"
            stroke="currentColor"
            opacity=".25"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'toast' && (
        <>
          <ellipse cx="110" cy="95" rx="78" ry="22" fill="#fffaf0" fillOpacity=".7" />
          <path d="M54 52c-15-34 114-48 111 0l-6 40c-3 13-97 18-102 2Z" fill="#b7804d" />
          <path d="M63 52c-12-24 95-37 94 0l-5 34c-1 8-83 12-86 1Z" fill="#ecd19c" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${72 + i * 15} 45q-15 18-4 38q20-8 12-32Z`}
              fill={i % 2 ? '#8eac62' : '#a8bc72'}
            />
          ))}
          <circle cx="102" cy="64" r="19" fill="#fff9eb" />
          <circle cx="104" cy="65" r="9" fill="#e6b54b" />
          <path d="m75 39 6 5m55 34 7 4m-22-40 5 5" stroke="#466145" strokeWidth="3" />
        </>
      )}
      {kind === 'bowl' && (
        <>
          <path d="M51 59h120c-3 70-116 70-120 0Z" fill="#eee6dc" />
          <ellipse cx="111" cy="59" rx="60" ry="22" fill="#faf7ef" />
          <ellipse cx="111" cy="59" rx="49" ry="15" fill="#e6d4b8" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              cx={81 + i * 11}
              cy={55 + (i % 3) * 5}
              r={7}
              fill={i % 2 ? '#a44d61' : '#d4a05a'}
            />
          ))}
          <path d="m143 46 23-28" stroke="#8e9b94" strokeWidth="6" strokeLinecap="round" />
          <path d="m78 70 13-4m24 5 8-4" stroke="#947243" strokeWidth="3" />
        </>
      )}
      {kind === 'drink' && (
        <>
          <path d="m122 8-8 43" stroke="#809d73" strokeWidth="5" strokeLinecap="round" />
          <path d="m78 36 9 73h53l9-73Z" fill="#eef5e5" fillOpacity=".7" />
          <path d="m82 55 7 52h48l6-52Z" fill="#a3b991" />
          <ellipse cx="113" cy="53" rx="31" ry="7" fill="#c4d3ae" />
          <path
            d="m93 46 11 3m12-7 10 6m-18 23 10 3"
            stroke="white"
            strokeOpacity=".6"
            strokeWidth="8"
          />
        </>
      )}
    </svg>
  );
}
