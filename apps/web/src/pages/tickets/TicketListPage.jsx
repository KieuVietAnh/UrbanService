// src/pages/tickets/TicketListPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const TicketListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dateRange, setDateRange] = useState(''); // mock filter
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const filters = {
        search,
        status,
        categoryId
      };
      if (user?.role === 'service-user') {
        filters.userId = user.userId;
      }
      const res = await ticketApi.getTickets(filters);
      setTickets(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user, search, status, categoryId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, categoryId, dateRange]);

  // Helpers for stats counts
  const [allCitizenTickets, setAllCitizenTickets] = useState([]);
  useEffect(() => {
    const fetchAllCitizenTickets = async () => {
      if (user?.userId) {
        try {
          const res = await ticketApi.getTickets({ userId: user.userId });
          setAllCitizenTickets(res);
        } catch (e) {
          console.error(e);
        }
      }
    };
    fetchAllCitizenTickets();
  }, [user, loading]);

  const countAll = allCitizenTickets.length;
  const countInProgress = allCitizenTickets.filter(t => ['Submitted', 'AI Reviewed', 'Assigned', 'InProgress'].includes(t.status)).length;
  const countResolved = allCitizenTickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length;
  const countAwaitingReview = allCitizenTickets.filter(t => t.status === 'Resolved').length;

  const renderStatusDot = (s) => {
    switch (s) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-150">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            Đã gửi
          </span>
        );
      case 'AI Reviewed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-150">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
            Đang xem xét
          </span>
        );
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-150">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
            Đã phân công
          </span>
        );
      case 'InProgress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-150">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Đang xử lý
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-150">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Đã xử lý
          </span>
        );
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-350">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            Đã đóng
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Chờ xử lý
          </span>
        );
    }
  };

  const renderCategoryIcon = (catId) => {
    switch (catId) {
      case 1: return <Lucide.Trash className="text-emerald-500 shrink-0" size={14} />;
      case 2: return <Lucide.Lightbulb className="text-amber-500 shrink-0" size={14} />;
      case 3: return <Lucide.Droplet className="text-blue-500 shrink-0" size={14} />;
      case 4: return <Lucide.Construction className="text-indigo-500 shrink-0" size={14} />;
      case 5: return <Lucide.Trees className="text-green-500 shrink-0" size={14} />;
      default: return <Lucide.Construction className="text-slate-500 shrink-0" size={14} />;
    }
  };

  const formatTicketId = (fbId) => {
    if (!fbId) return '';
    const num = fbId.split('-').pop();
    return `UM-2026-00${num}`;
  };

  // Pagination calculations
  const totalItems = tickets.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTickets = tickets.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 text-slate-800">
      {/* Breadcrumbs */}
      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
        <span>Trang chủ</span>
        <Lucide.ChevronRight size={12} />
        <span className="text-[#0052CC]">Phản ánh đã gửi</span>
      </div>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Phản ánh đã gửi</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">Theo dõi tiến độ, cập nhật hội thoại và đánh giá chất lượng xử lý các sự cố đô thị.</p>
        </div>
        <Link to="/tickets/create" className="btn bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl text-xs font-bold gap-1.5 h-10 px-4 min-h-0">
          <Lucide.Plus size={16} />
          Gửi phản ánh mới
        </Link>
      </div>

      {/* 4 Counter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tất cả */}
        <div 
          onClick={() => setStatus('')}
          className={`bg-white border p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer transition-all duration-200 ${
            status === '' ? 'border-[#0052CC] bg-[#EFF6FF]/40 ring-1 ring-[#0052CC]' : 'border-slate-200 hover:border-slate-350'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tất cả phản ánh</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Lucide.FileText size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">{countAll}</span>
          </div>
        </div>

        {/* Card 2: Đang xử lý */}
        <div 
          onClick={() => setStatus('InProgress')}
          className={`bg-white border p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer transition-all duration-200 ${
            status === 'InProgress' ? 'border-[#0052CC] bg-[#EFF6FF]/40 ring-1 ring-[#0052CC]' : 'border-slate-200 hover:border-slate-350'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đang xử lý</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Lucide.Clock size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">{countInProgress}</span>
          </div>
        </div>

        {/* Card 3: Đã xử lý */}
        <div 
          onClick={() => setStatus('Resolved')}
          className={`bg-white border p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer transition-all duration-200 ${
            status === 'Resolved' ? 'border-[#0052CC] bg-[#EFF6FF]/40 ring-1 ring-[#0052CC]' : 'border-slate-200 hover:border-slate-350'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đã xử lý</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Lucide.CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">{countResolved}</span>
          </div>
        </div>

        {/* Card 4: Chờ đánh giá */}
        <div 
          onClick={() => setStatus('Resolved')}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer hover:border-slate-350 transition-all duration-200"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chờ đánh giá</span>
            <div className="p-2 rounded-xl bg-red-50 text-red-500">
              <Lucide.Star size={18} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">{countAwaitingReview}</span>
          </div>
        </div>
      </div>

      {/* Filters Hub Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="form-control col-span-1 sm:col-span-1">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
              <Lucide.Search size={15} />
            </span>
            <input 
              type="text" 
              placeholder="Tìm kiếm mã phản ánh..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input-bordered w-full pl-9 text-xs rounded-xl h-10 border-slate-200 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Category select */}
        <div className="form-control">
          <select 
            value={categoryId} 
            onChange={(e) => setCategoryId(e.target.value)}
            className="select select-bordered text-xs rounded-xl h-10 min-h-0 font-semibold border-slate-200 focus:border-primary focus:outline-none w-full"
          >
            <option value="">Tất cả danh mục</option>
            {mockDb.getCategories().map(c => (
              <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
            ))}
          </select>
        </div>

        {/* Status select */}
        <div className="form-control">
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="select select-bordered text-xs rounded-xl h-10 min-h-0 font-semibold border-slate-200 focus:border-primary focus:outline-none w-full"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Submitted">Đã gửi (Submitted)</option>
            <option value="AI Reviewed">Đang xem xét (AI Reviewed)</option>
            <option value="Assigned">Đã phân công (Assigned)</option>
            <option value="InProgress">Đang xử lý (InProgress)</option>
            <option value="Resolved">Đã xử lý (Resolved)</option>
            <option value="Closed">Đã đóng (Closed)</option>
          </select>
        </div>

        {/* Date picker (mock) */}
        <div className="form-control">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
              <Lucide.Calendar size={15} />
            </span>
            <input 
              type="text" 
              placeholder="Chọn khoảng ngày..." 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input input-bordered w-full pl-9 text-xs rounded-xl h-10 border-slate-200 focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Status Shortcut Pills Row */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <span className="font-bold text-slate-400 mr-1">Bộ lọc nhanh:</span>
        <button 
          onClick={() => setStatus('')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === '' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả
        </button>
        <button 
          onClick={() => setStatus('Submitted')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === 'Submitted' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Đã gửi
        </button>
        <button 
          onClick={() => setStatus('AI Reviewed')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === 'AI Reviewed' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Đang xem xét
        </button>
        <button 
          onClick={() => setStatus('Assigned')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === 'Assigned' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Đã phân công
        </button>
        <button 
          onClick={() => setStatus('InProgress')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === 'InProgress' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Đang xử lý
        </button>
        <button 
          onClick={() => setStatus('Resolved')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === 'Resolved' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Đã xử lý
        </button>
        <button 
          onClick={() => setStatus('Closed')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${
            status === 'Closed' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Đã đóng
        </button>
      </div>

      {/* Main Table view */}
      <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-[#0052CC]"></span>
          </div>
        ) : paginatedTickets.length === 0 ? (
          /* Empty State */
          <div className="py-12 text-center rounded-3xl space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Lucide.FileQuestion size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-slate-900">Không tìm thấy phản ánh nào</h3>
              <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto leading-relaxed">
                Bạn chưa gửi phản ánh sự cố đô thị nào phù hợp với bộ lọc hiện tại.
              </p>
            </div>
            <Link to="/tickets/create" className="btn btn-outline border-slate-350 btn-sm rounded-xl font-bold text-xs h-9 min-h-0">
              Gửi phản ánh đầu tiên
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto w-full text-xs">
            <table className="table w-full">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider border-b border-slate-200">
                  <th className="py-3">Mã phản ánh</th>
                  <th className="py-3">Nội dung</th>
                  <th className="py-3">Loại vấn đề</th>
                  <th className="py-3">Vị trí</th>
                  <th className="py-3">Ngày gửi</th>
                  <th className="py-3">Trạng thái</th>
                  <th className="py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTickets.map((t) => (
                  <tr key={t.feedbackId} className="hover:bg-slate-50/50">
                    <td className="font-bold text-[#0052CC] py-3.5">{formatTicketId(t.feedbackId)}</td>
                    <td className="max-w-[200px] font-semibold py-3.5 text-slate-700">
                      <div className="truncate font-black">{t.title}</div>
                      <div className="truncate text-slate-400 text-[10px] mt-0.5">{t.description}</div>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        {renderCategoryIcon(t.categoryId)}
                        <span>{mockDb.getCategories().find(c => c.categoryId === t.categoryId)?.categoryName}</span>
                      </div>
                    </td>
                    <td className="max-w-[150px] truncate py-3.5 text-slate-500 font-semibold">
                      {t.locationText}
                    </td>
                    <td className="font-bold text-slate-400 py-3.5">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5">
                      {renderStatusDot(t.status)}
                    </td>
                    <td className="text-right py-3.5">
                      <button
                        onClick={() => navigate(`/tickets/${t.feedbackId}`)}
                        className="btn btn-ghost btn-circle btn-xs text-[#0052CC]"
                        title="Xem chi tiết"
                      >
                        <Lucide.Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {!loading && tickets.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-bold text-slate-500">
            <div>
              Hiển thị {startIndex + 1}-{endIndex} của {totalItems} phản ánh
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-xs rounded-lg btn-outline border-slate-200 disabled:opacity-50 text-slate-600"
              >
                Trước
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`btn btn-xs rounded-lg w-8 h-8 ${
                    currentPage === idx + 1 
                      ? 'bg-[#0052CC] hover:bg-[#0043a4] text-white border-none' 
                      : 'btn-outline border-slate-200 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-xs rounded-lg btn-outline border-slate-200 disabled:opacity-50 text-slate-600"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
