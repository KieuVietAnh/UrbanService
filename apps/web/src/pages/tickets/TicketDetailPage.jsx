// src/pages/tickets/TicketDetailPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { signalrService } from '../../services/socket/signalrService';
import { mockDb } from '../../store/mockStore';
import { LocationPicker } from '../../components/maps/LocationPicker';
import * as Lucide from 'lucide-react';

export const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Rating states (Flow 4)
  const [rating, setRating] = useState(5);
  const [satisfied, setSatisfied] = useState(true);
  const [reviewComment, setReviewComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  const chatEndRef = useRef(null);

  const fetchDetails = async () => {
    try {
      const resTicket = await ticketApi.getTicketById(id);
      const resComments = await ticketApi.getComments(id);
      const resHist = await ticketApi.getHistory(id);
      
      setTicket(resTicket);
      setComments(resComments);
      setHistory(resHist);
    } catch (err) {
      console.error(err);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();

    // SignalR Socket Simulation Connection
    signalrService.start();
    
    // Register listener for chat messages
    const handleReceiveMessage = (feedbackId, comment) => {
      if (feedbackId === id) {
        setComments(prev => [...prev, comment]);
      }
    };
    
    signalrService.on('ReceiveChatMessage', handleReceiveMessage);

    return () => {
      signalrService.off('ReceiveChatMessage', handleReceiveMessage);
      signalrService.stop();
    };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const text = chatInput;
    setChatInput('');
    
    // Send message via SignalR mock service
    await signalrService.sendChatMessage(id, user, text);
    
    // Refresh history in case system logs are updated
    const resHist = await ticketApi.getHistory(id);
    setHistory(resHist);
  };

  const handleRateSubmit = async (e) => {
    e.preventDefault();
    setRatingLoading(true);
    try {
      await ticketApi.submitReview(id, user.userId, rating, satisfied, reviewComment);
      await fetchDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setRatingLoading(false);
    }
  };

  const getStatusStep = (status) => {
    switch (status) {
      case 'Submitted': return 0;
      case 'AI Reviewed': return 1;
      case 'Assigned': return 2;
      case 'InProgress': return 3;
      case 'Resolved': return 4;
      case 'Closed': return 5;
      default: return 0;
    }
  };

  const getRatingText = (val) => {
    switch (val) {
      case 1: return 'Rất tệ';
      case 2: return 'Không hài lòng';
      case 3: return 'Bình thường';
      case 4: return 'Hài lòng';
      case 5: return 'Rất hài lòng';
      default: return '';
    }
  };

  const formatTicketId = (fbId) => {
    if (!fbId) return '';
    const num = fbId.split('-').pop();
    return `UM-2026-00${num}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 bg-white rounded-3xl border border-slate-200">
        <span className="loading loading-spinner loading-lg text-[#0052CC]"></span>
      </div>
    );
  }

  const currentStep = getStatusStep(ticket.status);
  const steps = [
    { title: 'Đã gửi', sub: 'Submitted' },
    { title: 'Kiểm duyệt', sub: 'AI Reviewed' },
    { title: 'Điều phối', sub: 'Assigned' },
    { title: 'Đang xử lý', sub: 'In Progress' },
    { title: 'Đã xử lý', sub: 'Resolved' },
    { title: 'Đã đóng', sub: 'Closed' }
  ];

  return (
    <div className="space-y-6 text-slate-800">
      {/* Breadcrumbs */}
      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
        <span className="cursor-pointer hover:text-slate-600" onClick={() => navigate('/dashboard')}>Trang chủ</span>
        <Lucide.ChevronRight size={12} />
        <span className="cursor-pointer hover:text-slate-600" onClick={() => navigate('/tickets')}>Phản ánh đã gửi</span>
        <Lucide.ChevronRight size={12} />
        <span className="text-[#0052CC]">{formatTicketId(ticket.feedbackId)}</span>
      </div>

      {/* Detail Header */}
      <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400">{formatTicketId(ticket.feedbackId)}</span>
            <span className="badge bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] badge-xs font-black py-2 px-2.5 rounded-lg uppercase">
              {mockDb.getCategories().find(c => c.categoryId === ticket.categoryId)?.categoryName}
            </span>
            {ticket.isMasterTicket && <span className="badge badge-accent badge-xs font-black py-2 px-2.5 rounded-lg text-white">MASTER TICKET</span>}
          </div>
          <h2 className="text-lg font-black text-slate-900 leading-tight">{ticket.title}</h2>
          <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
            <Lucide.MapPin size={12} className="text-[#0052CC]" />
            {ticket.locationText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`badge font-bold py-2.5 px-3 rounded-lg border uppercase ${
            ticket.priority === 'Critical' ? 'bg-red-50 text-red-600 border-red-200' : 
            (ticket.priority === 'High' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200')
          }`}>
            Ưu tiên: {ticket.priority}
          </span>
          <span className={`badge font-bold py-2.5 px-3 rounded-lg border uppercase ${
            ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}>
            Trạng thái: {ticket.status}
          </span>
        </div>
      </div>

      {/* Map Location Viewer */}
      <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Vị Trí Sự Cố</h4>
              <p className="text-xs text-slate-500 font-semibold">Xem vị trí đã gửi trên bản đồ với chế độ chỉ xem.</p>
            </div>
            <span className="badge badge-sm bg-slate-100 text-slate-600 border border-slate-200 font-bold">Chỉ xem</span>
          </div>
          <LocationPicker
            readonly
            latitude={ticket.latitude}
            longitude={ticket.longitude}
            initialLatitude={ticket.latitude || 10.776530}
            initialLongitude={ticket.longitude || 106.700981}
          />
        </div>
      </div>

      {/* Horizontal Lifecycle Steps */}
      <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm overflow-x-auto">
        <div className="flex justify-between items-center w-full min-w-[600px] px-4">
          {steps.map((st, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <div className={`h-0.5 flex-1 mx-2 rounded-full transition-colors duration-300 ${
                  currentStep >= idx ? 'bg-[#0052CC]' : 'bg-slate-200'
                }`}></div>
              )}
              <div className="flex flex-col items-center text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                  currentStep >= idx 
                    ? 'bg-[#0052CC] text-white shadow-md shadow-[#0052CC]/20 ring-4 ring-[#0052CC]/10' 
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}>
                  {idx + 1}
                </div>
                <span className="text-[10px] font-black mt-2 text-slate-700">{st.title}</span>
                <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{st.sub}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Description */}
          <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-5">
            <h4 className="font-extrabold text-sm border-b border-slate-100 pb-2 text-slate-900">Thông Tin Phản Ánh</h4>
            
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Mô tả của người dân:</span>
              <p className="text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-150 italic">
                "{ticket.description}"
              </p>
            </div>

            {/* Before / After photo comparison */}
            {ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">So sánh hình ảnh hiện trường</span>
                <div className="grid grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Hình ảnh phản ánh (Trước)</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-video block bg-slate-50">
                      {ticket.attachments && ticket.attachments.length > 0 ? (
                        <img src={ticket.attachments[0]} alt="Before" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-350 text-[10px] font-bold">Không có ảnh trước</div>
                      )}
                    </div>
                  </div>
                  {/* After */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Hình ảnh nghiệm thu (Sau)</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-video block bg-slate-50">
                      {ticket.resolution?.attachments && ticket.resolution.attachments.length > 0 ? (
                        <img src={ticket.resolution.attachments[0]} alt="After" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-350 text-[10px] font-bold">Chưa bàn giao ảnh sau</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              ticket.attachments && ticket.attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Hình ảnh đính kèm</span>
                  <div className="grid grid-cols-2 gap-3">
                    {ticket.attachments.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="rounded-2xl overflow-hidden border border-slate-200 aspect-video block bg-slate-50">
                        <img src={img} alt="Evidence" className="w-full h-full object-cover hover:scale-102 transition-transform" />
                      </a>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* SLA countdown info */}
            {ticket.dueDate && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-2 text-amber-700 font-bold">
                  <Lucide.Clock size={16} />
                  <span>Hạn chót giải quyết (SLA)</span>
                </div>
                <span className="font-extrabold text-slate-800">
                  {new Date(ticket.dueDate).toLocaleString()}
                </span>
              </div>
            )}

            {/* Operator Resolution Text Summary */}
            {ticket.resolution && (
              <div className="card bg-emerald-50/40 border border-emerald-250 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-emerald-600 font-extrabold text-xs">
                  <Lucide.CheckSquare size={16} />
                  <span>Báo Cáo Nghiệm Thu Từ Đội Kỹ Thuật</span>
                </div>
                <div className="text-xs space-y-2 text-slate-700">
                  <p><span className="font-bold text-slate-400">Tóm tắt:</span> <span className="font-semibold text-slate-800">{ticket.resolution.resolutionSummary}</span></p>
                  <p><span className="font-bold text-slate-400">Biện pháp:</span> <span className="font-semibold text-slate-650">{ticket.resolution.actionTaken}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log / Status Timeline History */}
          <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
            <h4 className="font-extrabold text-sm border-b border-slate-100 pb-2 text-slate-900">Lịch Sử Cập Nhật Trạng Thái</h4>
            <div className="space-y-4 text-xs">
              {history.map((h, i) => (
                <div key={i} className="flex gap-4 items-start last:pb-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0052CC] mt-1.5 ring-4 ring-[#0052CC]/10 shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-extrabold text-slate-750">{h.newStatus}</span>
                      <span className="text-[9px] text-slate-400 font-bold">{new Date(h.changedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-500 mt-0.5 font-medium leading-relaxed">{h.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Rating Form block (Flow 4: CSAT review) */}
          {ticket.status === 'Resolved' && user?.role === 'service-user' && (
            <div className="card bg-white border border-[#0052CC]/30 shadow-md p-6 rounded-3xl space-y-4 ring-2 ring-[#0052CC]/5">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0052CC] flex items-center justify-center mx-auto">
                  <Lucide.Star className="animate-pulse" size={20} />
                </div>
                <h3 className="font-black text-sm text-[#0052CC] uppercase tracking-wider">Đánh giá chất lượng xử lý</h3>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Ý kiến của bạn sẽ giúp ban quản lý nghiệm thu chất lượng thi công.</p>
              </div>

              <form onSubmit={handleRateSubmit} className="space-y-4 text-xs">
                <div className="form-control text-center">
                  <label className="label justify-center py-0">
                    <span className="label-text font-bold text-xs text-slate-700">Chấm điểm sao (1 - 5)</span>
                  </label>
                  <div className="flex flex-col items-center gap-1.5 mt-2">
                    <div className="rating rating-md flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <input 
                          key={num}
                          type="radio" 
                          name="rating-1" 
                          checked={rating === num}
                          onChange={() => setRating(num)}
                          className="mask mask-star-2 bg-amber-400 cursor-pointer" 
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-amber-600 block bg-amber-50 px-2 py-0.5 rounded-md">
                      {getRatingText(rating)}
                    </span>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="label-text font-bold text-slate-700">Tôi hài lòng với kết quả này</span> 
                    <input 
                      type="checkbox" 
                      checked={satisfied} 
                      onChange={(e) => setSatisfied(e.target.checked)}
                      className="checkbox checkbox-primary checkbox-sm rounded-lg" 
                    />
                  </label>
                </div>

                <div className="form-control space-y-1">
                  <label className="label py-0">
                    <span className="label-text font-bold text-slate-700">Bình luận, ý kiến đóng góp</span>
                  </label>
                  <textarea 
                    rows="3" 
                    placeholder="Để lại ý kiến về thái độ phục vụ, chất lượng hoàn thiện công trình..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="textarea textarea-bordered text-xs font-semibold p-2.5 rounded-xl border-slate-200 focus:outline-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary w-full rounded-xl font-bold text-xs h-10 min-h-0"
                  disabled={ratingLoading}
                >
                  {ratingLoading ? <span className="loading loading-spinner"></span> : 'Gửi Đánh Giá & Đóng Phản Ánh'}
                </button>
              </form>
            </div>
          )}

          {/* Live Chat Box */}
          <div className="card bg-white border border-slate-200 shadow-sm p-6 rounded-3xl h-[480px] flex flex-col justify-between">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <h4 className="font-extrabold text-sm text-slate-900">Trao Đổi Trực Tuyến</h4>
              </div>
              <span className="badge badge-xs bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold text-[8px] uppercase tracking-wider px-1.5 py-0.5">Dân - Cán Bộ</span>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {comments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-slate-400 font-semibold text-[10px] leading-relaxed">
                  Bắt đầu cuộc trao đổi về sự cố của bạn. Nhập @ai vào khung tin nhắn để được bot tư vấn pháp lý nhanh.
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.commentId} className={`chat ${c.userId === user.userId ? 'chat-end' : 'chat-start'}`}>
                    <div className="chat-header text-[9px] font-bold text-slate-400 mb-0.5">
                      {c.userName} ({c.userRole === 'service-user' ? 'Dân' : 'Cán bộ'})
                    </div>
                    <div className={`chat-bubble text-[11px] font-semibold leading-relaxed max-w-[85%] rounded-2xl ${
                      c.userId === user.userId 
                        ? 'bg-[#0052CC] text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-800 border border-slate-150 shadow-sm'
                    }`}>
                      {c.content}
                    </div>
                    <div className="chat-footer text-[8px] opacity-40 mt-0.5">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* AI helper hints */}
            <div className="py-2 border-t border-slate-100 flex flex-wrap gap-1">
              <button 
                type="button"
                onClick={() => setChatInput('@ai luật vứt rác')}
                className="badge badge-outline border-slate-200 hover:border-primary text-[9px] py-1.5 cursor-pointer font-bold text-slate-500"
              >
                @ai Luật rác thải
              </button>
              <button 
                type="button"
                onClick={() => setChatInput('@ai tiến độ xử lý')}
                className="badge badge-outline border-slate-200 hover:border-primary text-[9px] py-1.5 cursor-pointer font-bold text-slate-500"
              >
                @ai Hỏi tiến độ
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="pt-2 border-t border-slate-100 flex gap-2">
              <input 
                type="text" 
                placeholder="Nhập tin nhắn..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="input input-bordered input-sm flex-1 text-xs rounded-xl border-slate-200 focus:outline-none focus:border-primary"
              />
              <button 
                type="submit" 
                className="btn btn-sm bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl font-bold text-xs px-3 h-8 min-h-0"
              >
                Gửi
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
