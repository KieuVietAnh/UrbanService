// src/pages/analytics/HeatmapDashboard.jsx
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

export const HeatmapDashboard = () => {
  const [filterCategory, setFilterCategory] = useState('all');

  const width = 800;
  const height = 450;

  // Mock coordinate heatmap density centers
  const heatCenters = [
    { x: 300, y: 150, radius: 60, intensity: 0.8, name: 'Khu trung tâm Lê Lợi - ổ gà nhiều', category: 'roads' },
    { x: 500, y: 120, radius: 70, intensity: 0.7, name: 'Nguyễn Huệ - ứ đọng rác', category: 'waste' },
    { x: 180, y: 340, radius: 55, intensity: 0.9, name: 'Bùi Viện - mất điện chiếu sáng', category: 'lighting' },
    { x: 600, y: 380, radius: 80, intensity: 0.6, name: 'Nút giao Khánh Hội - cống ngập nước', category: 'water' },
    { x: 420, y: 220, radius: 50, intensity: 0.5, name: 'Ngã tư Hàm Nghi - sụt lún vỉa hè', category: 'roads' }
  ];

  const filteredCenters = filterCategory === 'all'
    ? heatCenters
    : heatCenters.filter(c => c.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Bản Đồ Nhiệt Mật Độ Sự Cố</h2>
          <p className="text-xs text-gray-500 font-semibold">Bản đồ nhiệt phân bổ mật độ các phản ánh đô thị, hỗ trợ khoanh vùng và tối ưu hóa phân bổ nhân lực sửa chữa.</p>
        </div>

        {/* Heat filters */}
        <div className="form-control">
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="select select-bordered select-sm text-xs font-bold rounded-xl"
          >
            <option value="all">Tất cả sự cố</option>
            <option value="waste">Vệ sinh &amp; Rác thải</option>
            <option value="lighting">Điện chiếu sáng</option>
            <option value="water">Cấp thoát nước</option>
            <option value="roads">Đường sá &amp; Giao thông</option>
          </select>
        </div>
      </div>

      {/* Interactive Map Visual with Heat overlays */}
      <div className="card bg-base-100 border border-base-300 p-4 rounded-3xl shadow-sm relative overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-slate-950 rounded-2xl">
          {/* River */}
          <path d="M 580 0 Q 640 180 520 300 T 700 450 L 800 450 L 800 0 Z" fill="#1e293b" opacity="0.4" />
          
          {/* Parks */}
          <rect x="80" y="80" width="160" height="120" rx="10" fill="#065f46" opacity="0.15" />
          <rect x="50" y="320" width="280" height="40" rx="8" fill="#065f46" opacity="0.15" />

          {/* Streets layout */}
          <g stroke="#ffffff" strokeOpacity="0.08" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="100" y1="200" x2="600" y2="200" />
            <line x1="500" y1="50" x2="500" y2="380" />
            <line x1="350" y1="280" x2="650" y2="280" />
            <path d="M 50 400 L 550 400 L 750 450" />
            <line x1="50" y1="360" x2="350" y2="260" />
          </g>

          {/* Heat Gradient Definitions */}
          <defs>
            <radialGradient id="heatGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#f97316" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Overlay Heat Circles */}
          {filteredCenters.map((hc, idx) => (
            <circle
              key={idx}
              cx={hc.x}
              cy={hc.y}
              r={hc.radius}
              fill="url(#heatGrad)"
              className="animate-pulse"
              style={{ animationDuration: `${2 + idx}s` }}
            />
          ))}

          {/* Legend HUD inside map */}
          <g transform="translate(20, 20)" className="text-[9px] font-bold fill-white">
            <rect width="130" height="70" rx="10" fill="#020617" opacity="0.8" stroke="#1e293b" />
            <circle cx="15" cy="18" r="6" fill="#ef4444" opacity="0.8" />
            <text x="28" y="21">Mật độ cao (Khẩn cấp)</text>
            <circle cx="15" cy="38" r="6" fill="#f97316" opacity="0.5" />
            <text x="28" y="41">Mật độ trung bình</text>
            <circle cx="15" cy="58" r="6" fill="#f97316" opacity="0.15" />
            <text x="28" y="61">Mật độ phân bố thưa</text>
          </g>
        </svg>
      </div>
    </div>
  );
};
