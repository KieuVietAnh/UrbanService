// src/pages/analytics/SentimentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../../services/api/analyticsApi';
import { SentimentDonutChart } from '../../components/charts/CustomCharts';
import * as Lucide from 'lucide-react';

export const SentimentDashboard = () => {
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
        <h2 className="text-2xl font-black">Biểu Đồ Cảm Xúc Cư Dân (AI)</h2>
        <p className="text-xs text-gray-500 font-semibold">Phân tích sắc thái ý kiến phản ánh của cư dân tự động bằng mô hình học máy NLP, hỗ trợ đo lường mức độ hài lòng.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Donut Chart */}
        <div className="md:col-span-1">
          <SentimentDonutChart 
            positive={stats.sentimentTrend.Positive}
            neutral={stats.sentimentTrend.Neutral}
            negative={stats.sentimentTrend.Negative}
          />
        </div>

        {/* Detailed AI insights cards */}
        <div className="md:col-span-2 space-y-6">
          <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm border-b border-base-300 pb-2 flex items-center gap-1.5">
              <Lucide.Brain className="text-primary" size={18} />
              <span>Nhận định từ AI Copilot</span>
            </h3>
            <div className="text-xs font-semibold space-y-3 text-gray-600 leading-relaxed">
              <div className="flex gap-2">
                <span className="text-emerald-500 font-black">✓</span>
                <span>Mức độ hài lòng của người dân đạt đỉnh <span className="text-emerald-500 font-bold">{stats.csatScore}/5</span> điểm CSAT, tỷ lệ phản hồi tích cực chiếm đa số nhờ sửa chữa nhanh.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-500 font-black">✓</span>
                <span>Xu hướng cảm xúc trung tính chủ yếu đến từ các phản ánh liên quan đến thu gom rác thải bừa bãi và tỉa cành cây xanh.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-red-500 font-black">✓</span>
                <span>Các từ khóa cảm xúc tiêu cực nhiều nhất: "nguy hiểm", "thối", "tai nạn", tập trung cao ở danh mục **Cấp thoát nước** khi xảy ra ngập hoặc vỡ cống nước.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm text-center">
              <span className="text-2xl font-black text-primary">{stats.csatScore}</span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Chỉ số hài lòng CSAT</p>
            </div>
            <div className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm text-center">
              <span className="text-2xl font-black text-secondary">{stats.avgResolutionTimeHours} giờ</span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Thời gian sửa trung bình</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
