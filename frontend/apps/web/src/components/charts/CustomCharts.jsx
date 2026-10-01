import { useEffect, useId, useRef, useState } from 'react';

// src/components/charts/CustomCharts.jsx


// 1. Sentiment Donut Chart Component
export const SentimentDonutChart = ({ positive = 0, neutral = 0, negative = 0, animate = true }) => {
  const total = positive + neutral + negative;
  const posPct = total > 0 ? (positive / total) * 100 : 0;
  const neuPct = total > 0 ? (neutral / total) * 100 : 0;
  const negPct = total > 0 ? (negative / total) * 100 : 0;
  const [progress, setProgress] = useState(0);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (!animate || prefersReducedMotion) {
      setProgress(1);
      return undefined;
    }

    setProgress(0);
    const duration = 700;
    const startAt = performance.now();
    const tick = (now) => {
      const elapsed = Math.min(1, (now - startAt) / duration);
      setProgress(1 - Math.pow(1 - elapsed, 3));
      if (elapsed < 1) animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [animate, positive, neutral, negative]);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { key: 'positive', pct: posPct, stroke: '#10b981' },
    { key: 'neutral', pct: neuPct, stroke: '#f59e0b' },
    { key: 'negative', pct: negPct, stroke: '#ef4444' },
  ];
  let offset = 0;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-44 w-44 sm:h-48 sm:w-48">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`Tích cực ${Math.round(posPct)}%, trung tính ${Math.round(neuPct)}%, tiêu cực ${Math.round(negPct)}%`}>
          <circle cx="60" cy="60" r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
          {segments.map((segment) => {
            const dash = ((segment.pct * progress) / 100) * circumference;
            const dashOffset = offset;
            offset += dash;
            if (segment.pct <= 0) return null;
            return (
              <circle
                key={segment.key}
                cx="60" cy="60" r={radius}
                fill="transparent"
                stroke={segment.stroke}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="text-3xl font-black tabular-nums text-slate-950">{total}</strong>
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">đã phân loại</span>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Tích cực {positive}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Trung tính {neutral}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Tiêu cực {negative}</span>
      </div>
    </div>
  );
};

// 2. SLA Performance Line Chart
const DEFAULT_SLA_TREND = [
  { label: 'T12', value: 75 },
  { label: 'T1', value: 82 },
  { label: 'T2', value: 80 },
  { label: 'T3', value: 88 },
  { label: 'T4', value: 92 },
  { label: 'T5', value: 95 },
];

export const SLAPerformanceChart = ({ data = DEFAULT_SLA_TREND }) => {
  const gradientId = useId().replace(/:/g, '');
  const series = Array.isArray(data) && data.length > 1
    ? data.map((item, index) => ({
      label: typeof item === 'number' ? `Kỳ ${index + 1}` : item.label,
      value: Number(typeof item === 'number' ? item : item.value) || 0,
    }))
    : DEFAULT_SLA_TREND;

  const width = 640;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 42, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = series.map((item, index) => ({
    ...item,
    x: padding.left + (index / (series.length - 1)) * chartWidth,
    y: padding.top + chartHeight - (Math.min(100, Math.max(0, item.value)) / 100) * chartHeight,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
  const firstValue = points[0]?.value || 0;
  const latestValue = points.at(-1)?.value || 0;
  const delta = latestValue - firstValue;

  return (
    <section className="manager-chart" aria-label="Xu hướng tỷ lệ đạt SLA theo thời gian">
      <header className="manager-chart-summary">
        <span>
          <small>Tỷ lệ kỳ gần nhất</small>
          <strong>{latestValue}%</strong>
        </span>
        <span className={delta >= 0 ? 'manager-chart-trend is-positive' : 'manager-chart-trend is-negative'}>
          {delta >= 0 ? 'Tăng' : 'Giảm'} {Math.abs(delta)} điểm so với kỳ đầu
        </span>
      </header>

      <svg viewBox={`0 0 ${width} ${height}`} className="manager-line-chart" role="img" aria-labelledby={`${gradientId}-title ${gradientId}-desc`}>
        <title id={`${gradientId}-title`}>Biểu đồ xu hướng SLA</title>
        <desc id={`${gradientId}-desc`}>Tỷ lệ đạt SLA tăng từ {firstValue}% lên {latestValue}% trong {series.length} kỳ.</desc>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padding.top + chartHeight - (tick / 100) * chartHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="manager-chart-grid" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" className="manager-chart-axis-label">{tick}%</text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} className="manager-chart-area" />
        <path d={linePath} className="manager-chart-line" />

        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="8" className="manager-chart-point-halo" />
            <circle cx={point.x} cy={point.y} r="4.5" className="manager-chart-point" />
            <text x={point.x} y={height - 14} textAnchor="middle" className="manager-chart-axis-label">{point.label}</text>
            <title>{point.label}: {point.value}%</title>
          </g>
        ))}
      </svg>
    </section>
  );
};

// 3. Category Volume Bar Chart
export const CategoryVolumeBarChart = ({ data = [] }) => {
  const source = data.length > 0 ? data : [
    { categoryName: 'Vệ sinh', count: 18 },
    { categoryName: 'Điện chiếu sáng', count: 12 },
    { categoryName: 'Cấp thoát nước', count: 15 },
    { categoryName: 'Đường sá', count: 9 },
    { categoryName: 'Cây xanh', count: 6 },
  ];
  const categories = source.map((item, index) => ({
    name: item.categoryName || item.name || `Danh mục ${index + 1}`,
    count: Number(item.count ?? item.value ?? item.total ?? 0),
  }));
  const maxCount = Math.max(...categories.map((category) => category.count), 1);
  const total = categories.reduce((sum, category) => sum + category.count, 0);

  return (
    <section className="manager-chart" aria-label="Khối lượng phản ánh theo danh mục dịch vụ">
      <header className="manager-chart-summary">
        <span>
          <small>Tổng khối lượng</small>
          <strong>{total}</strong>
        </span>
        <span className="manager-chart-muted">So sánh tương đối giữa các nhóm dịch vụ</span>
      </header>

      <ol className="manager-category-bars">
        {categories.map((category) => {
          const percentage = Math.round((category.count / maxCount) * 100);
          return (
            <li key={category.name}>
              <header>
                <span>{category.name}</span>
                <strong>{category.count}</strong>
              </header>
              <div className="manager-category-track" role="img" aria-label={`${category.name}: ${category.count} phản ánh`}>
                <span style={{ width: `${percentage}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
