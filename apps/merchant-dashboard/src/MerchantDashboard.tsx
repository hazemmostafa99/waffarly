export interface DashboardProduct {
  id: string;
  name: string;
  basePrice: string;
  availability: string;
  images: Array<{ mediaAssetId: string; publicUrl: string; isPrimary: boolean }>;
  categories: Array<{ id: string; name: string }>;
}

export function ProductThumb({
  product,
  fallback,
}: {
  product?: DashboardProduct | undefined;
  fallback: string;
}) {
  const image =
    product?.images.find((item) => item.isPrimary)?.publicUrl ?? product?.images[0]?.publicUrl;
  return image ? (
    <img className="dashboard-thumb" src={image} alt="" loading="lazy" />
  ) : (
    <span className="dashboard-thumb dashboard-thumb-fallback" aria-hidden="true" title={fallback}>
      <svg viewBox="0 0 36 36" fill="none">
        <path d="M7 16c0-6 4-9 11-9s11 3 11 9" fill="#E5A037" />
        <rect x="7" y="16" width="22" height="4" rx="2" fill="#17664B" />
        <path d="m7 20 6 2 5-2 5 2 6-2v4H7" fill="#F5C655" />
        <rect x="7" y="24" width="22" height="5" rx="2.5" fill="#E5A037" />
      </svg>
    </span>
  );
}

export function RevenueChart({
  t,
  period = 'weekly',
  previous = false,
}: {
  t: (message: string) => string;
  period?: string;
  previous?: boolean;
}) {
  const values = previous
    ? [1600, 2600, 2300, 2900, 3200, 4200, 3800]
    : [2500, 3800, 2800, 3400, 5200, 7400, 6400];
  const bars = previous
    ? [3300, 4400, 4200, 5100, 6400, 7000, 6500]
    : [4200, 5700, 5300, 6900, 8500, 10000, 8900];
  const labels =
    period === 'monthly'
      ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      : ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const plotted =
    period === 'monthly' ? values.filter((_, index) => [0, 2, 4, 6].includes(index)) : values;
  const plottedBars =
    period === 'monthly' ? bars.filter((_, index) => [0, 2, 4, 6].includes(index)) : bars;
  const x = (index: number) => 48 + index * (320 / (plotted.length - 1));
  const y = (value: number) => 152 - value * 0.013;
  return (
    <svg
      className="dashboard-chart"
      viewBox="0 0 400 180"
      preserveAspectRatio="none"
      role="img"
      aria-label={t('Sales chart')}
    >
      {[0, 2000, 4000, 6000, 8000].map((value) => (
        <g key={value}>
          <line x1="38" x2="382" y1={y(value)} y2={y(value)} stroke="#edf1f6" />
          <text x="28" y={y(value) + 3} textAnchor="end" className="dashboard-chart-label">
            {value.toLocaleString('en')}
          </text>
        </g>
      ))}
      {plottedBars.map((value, index) => (
        <rect
          key={index}
          x={x(index) - 17}
          y={y(value)}
          width="34"
          height={152 - y(value)}
          rx="5"
          fill="#e4f7ec"
        />
      ))}
      <polyline
        points={plotted.map((value, index) => `${x(index)},${y(value)}`).join(' ')}
        fill="none"
        stroke="#1c654e"
        strokeWidth="2.3"
      />
      {plotted.map((value, index) => (
        <circle key={index} cx={x(index)} cy={y(value)} r="3" fill="#1c654e">
          <title>
            {t(labels[index] ?? '')}: EGP {value.toLocaleString('en')}
          </title>
        </circle>
      ))}
      {labels.map((label, index) => (
        <text
          key={label}
          x={x(index)}
          y="170"
          textAnchor="middle"
          className="dashboard-chart-label"
        >
          {t(label)}
        </text>
      ))}
    </svg>
  );
}
