// src/pages/community/HelperWorkspacePage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const HelperWorkspacePage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Resolution states
  const [resSummary, setResSummary] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    try {
      // Fetch tickets assigned to this operator
      const res = await ticketApi.getTickets({ operatorId: user?.operatorId });
      // Exclude closed tickets for active workspace
      const active = res.filter(t => t.status !== 'Closed');
      setTickets(active);
      if (active.length > 0) {
        setSelectedTicket(active[0]);
      } else {
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.operatorId) {
      fetchTasks();
    }
  }, [user]);

  const handleUpdateStatus = async (status) => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      await ticketApi.updateOperatorStatus(selectedTicket.feedbackId, user.userId, status, '');
      await fetchTasks();
      alert(`Đã cập nhật trạng thái sự cố thành: ${status}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !resSummary.trim()) return;
    setLoading(true);
    try {
      // Mock Base64 Resolution Image
      const resolutionPhoto = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80';
      
      await ticketApi.updateOperatorStatus(selectedTicket.feedbackId, user.userId, 'Resolved', resSummary, [resolutionPhoto]);
      alert('Đã gửi báo cáo hoàn thành công việc! Chờ nghiệm thu từ cán bộ tiếp nhận.');
      setShowCompletionModal(false);
      setResSummary('');
      await fetchTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black">Nhiệm Vụ Đơn Vị Thi Công</h2>
          <p className="text-xs text-gray-500 font-semibold">
            Đơn vị: <span className="text-primary font-bold">{mockDb.getOperators().find(o => o.operatorId === user?.operatorId)?.operatorName}</span>
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 p-12 text-center rounded-3xl space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Lucide.CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm">Không Có Nhiệm Vụ Nào</h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">Hệ thống hiện không ghi nhận phản ánh nào được phân công cho đơn vị của bạn.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assigned Tasks List Column */}
          <div className="card bg-base-100 border border-base-300 p-4 rounded-3xl shadow-sm space-y-3 h-[600px] overflow-y-auto">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 px-2">Hộp Thư Công Việc ({tickets.length})</h4>
            <div className="space-y-2">
              {tickets.map((t) => (
                <div 
                  key={t.feedbackId}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 text-xs flex flex-col gap-1.5 ${
                    selectedTicket?.feedbackId === t.feedbackId 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-base-300 hover:bg-base-200/50'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-gray-400">{t.feedbackId}</span>
                    <span className={`badge badge-xs text-[8px] uppercase font-bold py-1.5 ${
                      t.status === 'Resolved' ? 'badge-success' : 'badge-warning'
                    }`}>{t.status}</span>
                  </div>
                  <h5 className="font-extrabold truncate text-base-content">{t.title}</h5>
                  <span className="text-[10px] font-semibold text-gray-400 line-clamp-1">{t.locationText}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Action details panel Column */}
          {selectedTicket && (
            <div className="lg:col-span-2 flex flex-col gap-6 h-[600px] overflow-y-auto">
              
              {/* Ticket detail card */}
              <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-start border-b border-base-300 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400">{selectedTicket.feedbackId}</span>
                    <h4 className="font-extrabold text-sm text-base-content mt-1">{selectedTicket.title}</h4>
                  </div>
                  <span className="badge badge-error uppercase font-extrabold py-2 px-2.5 text-[9px]">
                    Khẩn cấp: {selectedTicket.priority}
                  </span>
                </div>

                <div className="text-xs space-y-3">
                  <p><span className="font-bold text-gray-500">Mô tả sự cố:</span> <span className="font-medium text-gray-600">{selectedTicket.description}</span></p>
                  <p><span className="font-bold text-gray-500">Địa chỉ:</span> <span className="font-semibold">{selectedTicket.locationText}</span></p>
                  {selectedTicket.assignment?.note && (
                    <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/20 text-primary font-semibold">
                      Chỉ thị điều phối: "{selectedTicket.assignment.note}"
                    </div>
                  )}
                </div>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <span className="font-bold text-gray-500">Ảnh hiện trường người dân chụp:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedTicket.attachments.map((img, i) => (
                        <img key={i} src={img} alt="Before" className="w-full aspect-video object-cover rounded-xl border border-base-300" />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress update controls */}
              <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400 border-b border-base-300 pb-2">Tiến Độ Xử Lý</h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                  <button 
                    onClick={() => handleUpdateStatus('Accepted')}
                    disabled={selectedTicket.status !== 'Assigned' || loading}
                    className="btn btn-sm btn-outline rounded-xl"
                  >
                    Tiếp Nhận
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus('On the way')}
                    disabled={(selectedTicket.status !== 'Accepted' && selectedTicket.status !== 'Assigned') || loading}
                    className="btn btn-sm btn-outline rounded-xl"
                  >
                    Di Chuyển
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus('InProgress')}
                    disabled={(selectedTicket.status !== 'On the way' && selectedTicket.status !== 'Accepted') || loading}
                    className="btn btn-sm btn-outline rounded-xl"
                  >
                    Đang Sửa Chữa
                  </button>
                  <button 
                    onClick={() => setShowCompletionModal(true)}
                    disabled={(selectedTicket.status !== 'InProgress' && selectedTicket.status !== 'On the way') || loading}
                    className="btn btn-sm btn-primary rounded-xl"
                  >
                    Báo Hoàn Thành
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* RESOLUTION SUBMISSION MODAL */}
      {showCompletionModal && (
        <div className="modal modal-open">
          <div className="modal-box rounded-3xl border border-base-300 max-w-md p-6 space-y-4">
            <h3 className="font-extrabold text-base text-primary flex items-center gap-2">
              <Lucide.CheckCircle2 size={20} />
              Báo Cáo Hoàn Thành Công Việc
            </h3>
            <p className="text-xs text-gray-500 font-semibold">Nhập tóm tắt hành động đã sửa chữa và đính kèm bằng chứng nghiệm thu chất lượng hoàn trả.</p>
            
            <form onSubmit={handleCompletionSubmit} className="space-y-4 text-xs">
              <div className="form-control">
                <textarea 
                  rows="4" 
                  placeholder="Ví dụ: Đã thay thế bóng đèn LED 150W mới, điều chỉnh cột và cố định cáp điện an toàn..."
                  value={resSummary}
                  onChange={(e) => setResSummary(e.target.value)}
                  className="textarea textarea-bordered text-xs font-semibold p-2.5 rounded-xl"
                  required
                ></textarea>
              </div>

              <div className="bg-base-200 p-3 rounded-xl border border-base-300 text-[10px] text-gray-400 font-bold">
                Mẹo: Hệ thống sẽ tự động tạo ảnh nghiệm thu sau sửa chữa để minh chứng.
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowCompletionModal(false)}
                  className="btn btn-sm btn-ghost rounded-xl text-[10px]"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary rounded-xl text-[10px] font-bold"
                  disabled={loading || !resSummary.trim()}
                >
                  Gửi Nghiệm Thu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
