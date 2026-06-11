// src/pages/tickets/DuplicateDetection.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const DuplicateDetection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  
  // Selection states
  const [selectedGroup, setSelectedGroup] = useState([]);
  const [masterId, setMasterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Read all submitted / active tickets to show potential duplicates
    const all = mockDb.getTickets().filter(t => t.status !== 'Closed');
    
    // Group tickets by proximity to mock duplication queue (e.g. group tickets in same category and near coordinates)
    const groups = [];
    const visited = new Set();

    for (let i = 0; i < all.length; i++) {
      if (visited.has(all[i].feedbackId)) continue;
      const group = [all[i]];
      visited.add(all[i].feedbackId);

      for (let j = i + 1; j < all.length; j++) {
        if (visited.has(all[j].feedbackId)) continue;
        // Check same category and proximity
        const distLat = Math.abs(all[i].latitude - all[j].latitude);
        const distLng = Math.abs(all[i].longitude - all[j].longitude);
        if (all[i].categoryId === all[j].categoryId && distLat < 0.008 && distLng < 0.008) {
          group.push(all[j]);
          visited.add(all[j].feedbackId);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    setTickets(groups);
    if (groups.length > 0) {
      setSelectedGroup(groups[0]);
      setMasterId(groups[0][0].feedbackId);
    }
  }, [success]);

  const handleMerge = async () => {
    if (!masterId || selectedGroup.length < 2) return;
    setLoading(true);
    try {
      const duplicates = selectedGroup
        .map(t => t.feedbackId)
        .filter(id => id !== masterId);

      await ticketApi.mergeTickets(masterId, duplicates, user.userId);
      setSuccess(!success); // trigger reload
      alert(`Gộp thành công! Thiết lập ${masterId} thành Master Ticket và đóng các phản ánh trùng lặp khác.`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Xử Lý Phản Ánh Trùng Lặp</h2>
        <p className="text-xs text-gray-500 font-semibold">Gộp các phản ánh trùng lặp xảy ra cùng địa điểm, thời gian vào một sự cố chính (Master Ticket) để hợp nhất đầu mối xử lý.</p>
      </div>

      {tickets.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 p-12 text-center rounded-3xl space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Lucide.ShieldCheck size={32} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm">Không Phát Hiện Sự Cố Trùng Lặp</h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">Các phản ánh hiện hữu có vị trí phân tán, không có trùng lặp chồng lấn về mặt không gian địa lý.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Duplicate Groups Column */}
          <div className="card bg-base-100 border border-base-300 p-4 rounded-3xl shadow-sm space-y-3 h-[600px] overflow-y-auto">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 px-2">Nhóm nghi trùng do AI phát hiện ({tickets.length})</h4>
            <div className="space-y-3">
              {tickets.map((group, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    setSelectedGroup(group);
                    setMasterId(group[0].feedbackId);
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 text-xs flex flex-col gap-1.5 ${
                    selectedGroup === group 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-base-300 hover:bg-base-200/50'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-primary">
                    <span>Nhóm #{idx + 1}</span>
                    <span>{group.length} Phản ánh</span>
                  </div>
                  <h5 className="font-extrabold truncate text-base-content">{group[0].title}</h5>
                  <span className="text-[10px] font-semibold text-gray-400 line-clamp-1">{group[0].locationText}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Merge & Side by Side Comparison Column */}
          {selectedGroup.length > 0 && (
            <div className="lg:col-span-2 flex flex-col gap-6 h-[600px] overflow-y-auto">
              
              {/* Compare List */}
              <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400 border-b border-base-300 pb-2">So Sánh Chi Tiết Nhóm Trùng Lặp</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedGroup.map((t) => (
                    <div 
                      key={t.feedbackId}
                      className={`p-4 rounded-2xl border transition-all ${
                        masterId === t.feedbackId 
                          ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/10' 
                          : 'border-base-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-gray-400">{t.feedbackId}</span>
                        <button 
                          onClick={() => setMasterId(t.feedbackId)}
                          className={`btn btn-xs rounded-lg font-bold text-[9px] ${
                            masterId === t.feedbackId ? 'btn-primary' : 'btn-outline'
                          }`}
                        >
                          {masterId === t.feedbackId ? 'Master Ticket' : 'Chọn làm Master'}
                        </button>
                      </div>
                      <h5 className="font-extrabold text-xs text-base-content mb-1">{t.title}</h5>
                      <p className="text-[10px] text-gray-500 font-medium mb-3 italic">"{t.description}"</p>
                      
                      {t.attachments && t.attachments.length > 0 && (
                        <img src={t.attachments[0]} alt="Duplicate proof" className="w-full aspect-video object-cover rounded-xl border border-base-300 mb-2" />
                      )}
                      
                      <div className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                        <Lucide.MapPin size={10} className="text-primary" />
                        <span className="truncate">{t.locationText}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Merge Card */}
              <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400">Tiến Hành Gộp Sự Cố</h4>
                <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                  Thiết lập phản ánh <span className="font-bold text-primary">{masterId}</span> làm sự cố chính. Tất cả phản ánh khác trong nhóm sẽ được liên kết và đóng lại. Chủ sở hữu các phản ánh phụ sẽ nhận được thông báo liên thông để theo dõi sự cố chính.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={handleMerge}
                    disabled={loading}
                    className="btn btn-primary px-8 rounded-xl font-bold text-xs"
                  >
                    {loading ? <span className="loading loading-spinner"></span> : 'Gộp Phản Ánh Trùng Lặp'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
};
