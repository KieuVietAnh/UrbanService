// src/pages/tickets/CompletedTicketReview.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import * as Lucide from 'lucide-react';

export const CompletedTicketReview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // Review inputs
  const [reworkNote, setReworkNote] = useState('');
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchResolved = async () => {
    try {
      // Find tickets resolved but not closed yet, or specifically awaiting approval (which is Resolved status in mock db)
      const res = await ticketApi.getTickets({ status: 'Resolved' });
      // In our mock database, tickets resolved by operator are marked as 'Resolved'
      // We filter out those that do NOT have review rating yet
      const awaitingApproval = res.filter(t => t.reviews.length === 0);
      setTickets(awaitingApproval);
      if (awaitingApproval.length > 0) {
        setSelectedTicket(awaitingApproval[0]);
      } else {
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchResolved();
  }, []);

  const handleApprove = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      await ticketApi.reviewResolution(selectedTicket.feedbackId, user.userId, true);
      alert('Phê duyệt hoàn thành xuất sắc! Đã thông báo cho người dân đánh giá.');
      fetchResolved();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRework = async () => {
    if (!selectedTicket || !reworkNote.trim()) return;
    setLoading(true);
    try {
      await ticketApi.reviewResolution(selectedTicket.feedbackId, user.userId, false, reworkNote);
      alert('Yêu cầu làm lại thành công. Sự cố đã trả về tiến trình Đang Xử Lý.');
      setShowReworkModal(false);
      setReworkNote('');
      fetchResolved();
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
        <h2 className="text-2xl font-black">Kiểm Tra &amp; Nghiệm Thu Kết Quả</h2>
        <p className="text-xs text-gray-500 font-semibold">Thẩm định hình ảnh hiện trường trước/sau sửa chữa từ các đơn vị thi công để nghiệm thu hoàn thành sự cố.</p>
      </div>

      {tickets.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 p-12 text-center rounded-3xl space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Lucide.ShieldCheck size={32} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm">Hàng Chờ Nghiệm Thu Đang Trống</h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">Không có phản ánh nào đang chờ nghiệm thu kết quả thi công.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Awaiting Review Queue */}
          <div className="card bg-base-100 border border-base-300 p-4 rounded-3xl shadow-sm space-y-3 h-[600px] overflow-y-auto">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 px-2">Đợi phê duyệt kết quả ({tickets.length})</h4>
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
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                    <span>{t.feedbackId}</span>
                    <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <h5 className="font-extrabold truncate text-base-content">{t.title}</h5>
                  <span className="text-[10px] font-semibold text-gray-500 line-clamp-1">{t.assignment?.operatorName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Details Panel */}
          {selectedTicket && (
            <div className="lg:col-span-2 flex flex-col gap-6 h-[600px] overflow-y-auto">
              
              {/* Compare Panel: Before and After Images */}
              <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400 border-b border-base-300 pb-2">So Sánh Hiện Trường Bàn Giao</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="space-y-2">
                    <span className="badge badge-error badge-sm font-bold py-2.5 px-3 uppercase text-[9px]">Hình ảnh trước xử lý</span>
                    <div className="rounded-2xl overflow-hidden border border-base-300 aspect-video">
                      <img src={selectedTicket.attachments[0] || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=400&q=80'} alt="Before" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[11px] text-gray-500 font-semibold bg-base-200 p-3 rounded-xl">
                      Mô tả: "{selectedTicket.description}"
                    </p>
                  </div>

                  {/* After */}
                  <div className="space-y-2">
                    <span className="badge badge-success badge-sm font-bold py-2.5 px-3 uppercase text-[9px]">Hình ảnh sau xử lý</span>
                    <div className="rounded-2xl overflow-hidden border border-base-300 aspect-video">
                      <img src={selectedTicket.resolution?.attachments[0] || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80'} alt="After" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold bg-base-200 p-3 rounded-xl space-y-1">
                      <div>Tóm tắt: <span className="font-bold text-base-content">{selectedTicket.resolution?.resolutionSummary}</span></div>
                      <div>Hành động: <span className="font-medium text-gray-600">{selectedTicket.resolution?.actionTaken}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons card */}
              <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-xs">
                  <span className="font-bold text-gray-400 uppercase tracking-wide block mb-1">Nghiệm thu hồ sơ</span>
                  <p className="font-semibold text-gray-500">Xem xét và đánh giá chất lượng thi công bàn giao của đơn vị.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowReworkModal(true)}
                    className="btn btn-error btn-outline flex-1 sm:flex-initial rounded-xl text-xs"
                    disabled={loading}
                  >
                    <Lucide.RotateCcw size={16} />
                    Yêu Cầu Làm Lại
                  </button>
                  <button 
                    onClick={handleApprove}
                    className="btn btn-primary flex-1 sm:flex-initial rounded-xl font-bold text-xs"
                    disabled={loading}
                  >
                    <Lucide.CheckCircle2 size={16} />
                    Phê Duyệt Hoàn Thành
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* REWORK REQUEST DIALOG MODAL */}
      {showReworkModal && (
        <div className="modal modal-open">
          <div className="modal-box rounded-3xl border border-base-300 max-w-md p-6 space-y-4">
            <h3 className="font-extrabold text-base text-error flex items-center gap-2">
              <Lucide.RotateCcw size={20} />
              Yêu Cầu Đơn Vị Làm Lại
            </h3>
            <p className="text-xs text-gray-500 font-semibold">Nhập lý do chi tiết từ chối nghiệm thu để đơn vị thi công nắm rõ nội dung cần khắc phục thêm.</p>
            
            <div className="form-control">
              <textarea 
                rows="4" 
                placeholder="Ví dụ: Rác thải vỉa hè đã được dọn nhưng vẫn còn xà bần đọng lại cản lối đi bộ..."
                value={reworkNote}
                onChange={(e) => setReworkNote(e.target.value)}
                className="textarea textarea-bordered text-xs font-semibold p-2.5 rounded-xl"
                required
              ></textarea>
            </div>

            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowReworkModal(false)}
                className="btn btn-sm btn-ghost rounded-xl text-[10px]"
              >
                Hủy bỏ
              </button>
              <button 
                type="button" 
                onClick={handleRework}
                className="btn btn-sm btn-error rounded-xl text-[10px] font-bold"
                disabled={loading || !reworkNote.trim()}
              >
                Gửi Yêu Cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
