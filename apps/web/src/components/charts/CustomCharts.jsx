// src/components/charts/CustomCharts.jsx
import React from 'react';

// 1. Sentiment Donut Chart Component
export const SentimentDonutChart = ({ positive = 45, neutral = 35, negative = 20 }) => {
  const total = positive + neutral + negative;
  const posPct = total > 0 ? Math.round((positive / total) * 100) : 0;
  const neuPct = total > 0 ? Math.round((neutral / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((negative / total) * 100) : 0;

  // Circle parameters for Donut
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke offsets
  const posOffset = circumference;
  const neuDash = (neuPct / 100) * circumference;
  const negDash = (negPct / 100) * circumference;
  const posDash = (posPct / 100) * circumference;

  // Cumulative offsets
  const posStrokeOffset = 0;
  const neuStrokeOffset = posDash;
  const negStrokeOffset = posDash + neuDash;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-base-100 rounded-2xl border border-base-300">
      <h4 className="text-sm font-bold mb-4 text-center">Chỉ Số Cảm Xúc Cư Dân (AI)</h4>
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle cx="60" cy="60" r={radius} fill="transparent" stroke="var(--fallback-b3, #e5e7eb)" strokeWidth="12" />
          
          {/* Positive segment */}
          {posPct > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#10b981" // Emerald-500
              strokeWidth="12"
              strokeDasharray={`${posDash} ${circumference - posDash}`}
              strokeDashoffset={-posStrokeOffset}
              className="transition-all duration-1000 ease-out"
            />
          )}
          
          {/* Neutral segment */}
          {neuPct > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#f59e0b" // Amber-500
              strokeWidth="12"
              strokeDasharray={`${neuDash} ${circumference - neuDash}`}
              strokeDashoffset={-neuStrokeOffset}
              className="transition-all duration-1000 ease-out"
            />
          )}
          
          {/* Negative segment */}
          {negPct > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#ef4444" // Red-500
              strokeWidth="12"
              strokeDasharray={`${negDash} ${circumference - negDash}`}
              strokeDashoffset={-negStrokeOffset}
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-emerald-500">{posPct}%</span>
          <span className="text-[9px] uppercase tracking-wider font-bold text-gray-500">Tích cực</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-6 text-xs font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span>Tích cực: {positive}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span>Trung tính: {neutral}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span>Tiêu cực: {negative}</span>
        </div>
      </div>
    </div>
  );
};

// 2. SLA Performance Line Chart
export const SLAPerformanceChart = () => {
  // Mock data for weekly SLA compliance rates (%)
  const data = [75, 82, 80, 88, 92, 95];
  const labels = ['T12', 'T1', 'T2', 'T3', 'T4', 'T5'];
  
  const width = 500;
  const height = 180;
  const padding = 30;
  
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  // Calculate points
  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * chartWidth;
    // Map 0-100 to chartHeight-0
    const y = padding + chartHeight - (val / 100) * chartHeight;
    return { x, y, val };
  });

  // Construct SVG Path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="bg-base-100 p-4 rounded-2xl border border-base-300 w-full">
      <h4 className="text-sm font-bold mb-4">Tỷ Lệ Đạt Chỉ Tiêu SLA Theo Tháng</h4>
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--fallback-b3, #e5e7eb)" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="var(--fallback-b3, #e5e7eb)" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--fallback-b3, #e5e7eb)" strokeWidth="1" />

          {/* Area fill */}
          <path d={areaPath} fill="url(#slaGrad)" opacity="0.15" />

          {/* SLA Line */}
          <path d={linePath} fill="none" stroke="var(--fallback-p, #4f46e5)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="slaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--fallback-p, #4f46e5)" />
              <stop offset="100%" stopColor="var(--fallback-p, #4f46e5)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Dots and Tooltips */}
          {points.map((p, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle cx={p.x} cy={p.y} r="5" fill="var(--fallback-p, #4f46e5)" stroke="var(--fallback-b1, #ffffff)" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="10" fill="var(--fallback-p, #4f46e5)" opacity="0" className="hover:opacity-20 transition-opacity" />
              {/* Text label on hover or default */}
              <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-bold fill-primary opacity-0 group-hover:opacity-100 transition-opacity">
                {p.val}%
              </text>
              {/* X axis labels */}
              <text x={p.x} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-500 font-semibold">
                {labels[idx]}
              </text>
            </g>
          ))}
          
          {/* Y Axis labels */}
          <text x={10} y={padding + 4} className="text-[8px] fill-gray-400 font-bold">100%</text>
          <text x={10} y={padding + chartHeight / 2 + 4} className="text-[8px] fill-gray-400 font-bold">50%</text>
          <text x={10} y={height - padding + 4} className="text-[8px] fill-gray-400 font-bold">0%</text>
        </svg>
      </div>
    </div>
  );
};

// 3. Category Volume Bar Chart
export const CategoryVolumeBarChart = ({ data = [] }) => {
  // Use provided category counts or defaults
  const categories = data.length > 0 ? data : [
    { categoryName: 'Vệ sinh', count: 18 },
    { categoryName: 'Điện chiếu sáng', count: 12 },
    { categoryName: 'Cấp thoát nước', count: 15 },
    { categoryName: 'Đường sá', count: 9 },
    { categoryName: 'Cây xanh', count: 6 }
  ];

  const maxCount = Math.max(...categories.map(c => c.count), 1);
  const width = 500;
  const height = 180;
  const padding = 30;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = 40;
  const gap = (chartWidth - barWidth * categories.length) / (categories.length - 1);

  return (
    <div className="bg-base-100 p-4 rounded-2xl border border-base-300 w-full">
      <h4 className="text-sm font-bold mb-4">Số Lượng Phản Ánh Theo Danh Mục</h4>
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Y-Axis lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--fallback-b3, #e5e7eb)" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--fallback-b3, #e5e7eb)" strokeWidth="1" />

          {categories.map((cat, idx) => {
            const x = padding + idx * (barWidth + gap);
            const barHeight = (cat.count / maxCount) * chartHeight;
            const y = height - padding - barHeight;

            return (
              <g key={idx} className="group cursor-pointer">
                {/* Visual Bar with nice rounding at top */}
                <path
                  d={`
                    M ${x} ${y + 6}
                    A 6 6 0 0 1 ${x + barWidth} ${y + 6}
                    L ${x + barWidth} ${height - padding}
                    L ${x} ${height - padding}
                    Z
                  `}
                  fill="url(#barGrad)"
                  className="transition-all duration-500 ease-out hover:fill-secondary"
                />
                
                {/* Numeric value at top */}
                <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="text-[10px] font-extrabold fill-base-content opacity-90">
                  {cat.count}
                </text>

                {/* X axis labels (shortened if necessary) */}
                <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="text-[9px] fill-gray-500 font-bold">
                  {cat.categoryName.split(' ')[0]}
                </text>
              </g>
            );
          })}
          
          {/* Gradients */}
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--fallback-s, #f000b8)" />
              <stop offset="100%" stopColor="var(--fallback-p, #4f46e5)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
