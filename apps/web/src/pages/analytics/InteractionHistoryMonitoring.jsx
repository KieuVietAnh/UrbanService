// src/pages/analytics/InteractionHistoryMonitoring.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const InteractionHistoryMonitoring = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    // Fetch all active/resolved tickets to monitor conversations
    setTickets(mockDb.getTickets());
  }, []);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Giám Sát Tương Tác &amp; Hội Thoại</h2>
        <p className="text-xs text-gray-500 font-semibold">Theo dõi dòng hội thoại trao đổi trực tiếp giữa cư dân, nhân viên tiếp nhận và kỹ thuật viên sửa chữa.</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-primary">15 Phút</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Phản hồi trung bình</span>
        </div>
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-warning">03 Phút</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">AI phân phối việc</span>
        </div>
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-emerald-500">4.8 / 5</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">CSAT hài lòng trung bình</span>
        </div>
        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm text-center">
          <span className="text-xl font-black text-error">00 Ca</span>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">Tranh chấp / Escalated</span>
        </div>
      </div>

      {/* Conversations Table */}
      <div className="card bg-base-100 border border-base-300 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full text-xs">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200 text-gray-500 uppercase tracking-wider font-extrabold text-[10px]">
                <th>Mã sự cố</th>
                <th>Tiêu đề / Địa chỉ</th>
                <th>Đơn vị thi công</th>
                <th>AI Sentiment</th>
                <th>CSAT Khảo sát</th>
                <th className="text-right">Giám sát</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {tickets.map((t) => {
                const rating = t.reviews && t.reviews.length > 0 ? t.reviews[0].rating : null;
                
                return (
                  <tr key={t.feedbackId} className="hover:bg-base-200/50">
                    <td className="font-bold text-gray-400">{t.feedbackId}</td>
                    <td className="font-semibold max-w-xs">
                      <div className="truncate text-base-content">{t.title}</div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">{t.locationText}</div>
                    </td>
                    <td className="font-medium text-gray-500">
                      {t.assignment ? t.assignment.operatorName : 'Chưa phân công'}
                    </td>
                    <td>
                      <span className={`badge badge-xs font-bold uppercase py-1.5 px-2 ${
                        t.sentiment === 'Positive' ? 'badge-success text-white' : (t.sentiment === 'Negative' ? 'badge-error' : 'badge-warning')
                      }`}>
                        {t.sentiment}
                      </span>
                    </td>
                    <td>
                      {rating ? (
                        <div className="flex items-center gap-0.5 font-bold text-warning text-[10px]">
                          <Lucide.Star size={10} fill="currentColor" />
                          <span>{rating} Sao</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium">Chưa đánh giá</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button 
                        onClick={() => navigate(`/tickets/${t.feedbackId}`)}
                        className="btn btn-xs btn-ghost rounded-lg text-[9px] gap-1 font-bold"
                      >
                        <Lucide.Eye size={12} />
                        Audit Chat
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
