// src/pages/analytics/SLAAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../../services/api/analyticsApi';
import { SLAPerformanceChart, CategoryVolumeBarChart } from '../../components/charts/CustomCharts';
import * as Lucide from 'lucide-react';

export const SLAAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await analyticsApi.getSystemDashboardStats();
        setStats(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20 bg-base-100 rounded-3xl border border-base-300">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Chỉ Số SLA &amp; Hiệu Năng Dịch Vụ</h2>
        <p className="text-xs text-gray-500 font-semibold">Theo dõi hạn chót giải quyết cam kết, tỷ lệ vi phạm và khối lượng phản ánh theo từng ngành dịch vụ đô thị.</p>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-primary">{stats.processingRate}%</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Tỷ lệ đóng hồ sơ</span>
        </div>
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-error">{stats.slaBreaches} Phiếu</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Vi phạm hạn SLA</span>
        </div>
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-secondary">{stats.avgResolutionTimeHours} Giờ</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">SLA trung bình thực tế</span>
        </div>
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-emerald-500">{stats.totalTickets} Phiếu</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Tổng phản ánh tiếp nhận</span>
        </div>
      </div>

      {/* Custom SVG Charts side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SLAPerformanceChart />
        <CategoryVolumeBarChart data={stats.categoryDistribution} />
      </div>
    </div>
  );
};
