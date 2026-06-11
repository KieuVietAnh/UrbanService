// src/pages/admin/PerformanceDashboard.jsx
import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../../services/api/analyticsApi';
import * as Lucide from 'lucide-react';

export const PerformanceDashboard = () => {
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
        <h2 className="text-2xl font-black">Hiệu Năng &amp; Trạng Thái Hệ Thống</h2>
        <p className="text-xs text-gray-500 font-semibold">Theo dõi sức khỏe tài nguyên hạ tầng, thời gian đáp ứng API và trạng thái hoạt động của mô hình AI.</p>
      </div>

      {/* Resource Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* API Health */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-base-300 pb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cổng dịch vụ API</span>
            <span className="badge badge-success badge-sm font-bold text-white uppercase">Healthy</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Thời gian phản hồi trung bình:</span>
              <span className="font-bold text-base-content">120ms</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Tỷ lệ thành công:</span>
              <span className="font-bold text-success">99.98%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Số request/giây (Peak):</span>
              <span className="font-bold text-base-content">250 req/s</span>
            </div>
          </div>
        </div>

        {/* AI Processing Engine */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-base-300 pb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mô hình AI Copilot</span>
            <span className="badge badge-info badge-sm font-bold text-white uppercase">Active</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Tốc độ xử lý (GPU):</span>
              <span className="font-bold text-base-content">0.8 giây/token</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Độ chính xác (NLP):</span>
              <span className="font-bold text-base-content">94.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Hàng chờ phân loại:</span>
              <span className="font-bold text-emerald-500">00 Phiếu</span>
            </div>
          </div>
        </div>

        {/* Database & LocalStorage Storage */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-base-300 pb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lưu Trữ Cơ Sở Dữ Liệu</span>
            <span className="badge badge-warning badge-sm font-bold text-white uppercase">Sufficient</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Dung lượng sử dụng:</span>
              <span className="font-bold text-base-content">{stats.storageUsage}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Dữ liệu quan hệ (ERD):</span>
              <span className="font-bold text-base-content">22 Bảng</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-500">Sao lưu tự động gần nhất:</span>
              <span className="font-bold text-base-content">1 Giờ trước</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
