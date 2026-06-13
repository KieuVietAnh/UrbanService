// src/pages/tickets/TicketListPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { toolsApi } from '@urbanmind/shared-api';
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    categoryId: '',
    title: '',
    description: '',
    locationText: '',
    latitude: null,
    longitude: null,
    priority: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editAttachments, setEditAttachments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState(null);

  const fetchTickets = useCallback(async () => {
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
  }, [user, search, status, categoryId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

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

  const openEditModal = async (ticket) => {
    try {
      const detailResponse = await ticketApi.getTicketById(ticket.feedbackId);

      const detail =
        detailResponse?.data ||
        detailResponse?.item ||
        detailResponse?.result ||
        detailResponse ||
        ticket;

      setEditTarget(detail);

      setEditForm({
        categoryId: detail.categoryId || ticket.categoryId || '',
        title: detail.title || ticket.title || '',
        description: detail.description || ticket.description || '',
        locationText: detail.locationText || ticket.locationText || '',
        latitude: detail.latitude ?? ticket.latitude ?? null,
        longitude: detail.longitude ?? ticket.longitude ?? null,
        priority: detail.priority || ticket.priority || '',
      });
      setEditAttachments(Array.isArray(detail.attachments) ? detail.attachments : []);
      setSelectedFiles([]);
    } catch (err) {
      console.error('Không lấy được chi tiết phản ánh để sửa:', err);

      setEditTarget(ticket);
      setEditForm({
        categoryId: ticket.categoryId || '',
        title: ticket.title || '',
        description: ticket.description || '',
        locationText: ticket.locationText || '',
        latitude: ticket.latitude ?? null,
        longitude: ticket.longitude ?? null,
        priority: ticket.priority || '',
      });
      setEditAttachments(Array.isArray(ticket.attachments) ? ticket.attachments : []);
      setSelectedFiles([]);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ lấy vị trí hiện tại.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setEditForm((prev) => ({
          ...prev,
          latitude,
          longitude,
          locationText: `Vị trí hiện tại: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        }));
      },
      () => {
        alert('Không thể lấy vị trí hiện tại. Vui lòng cho phép quyền vị trí.');
      }
    );
  };

  const getAttachmentId = (file) => {
    if (!file || typeof file === 'string') return null;

    return (
      file.attachmentId ||
      file.id ||
      file.fileId ||
      file.feedbackAttachmentId ||
      null
    );
  };

  const getAttachmentUrl = (file) => {
    if (!file) return '';

    if (typeof file === 'string') return file;

    return (
      file.fileUrl ||
      file.url ||
      file.path ||
      file.attachmentUrl ||
      file.displayUrl ||
      ''
    );
  };

  const getAttachmentName = (file, index) => {
    if (!file) return `Tệp ${index + 1}`;

    if (typeof file === 'string') {
      return file.split('/').pop() || `Tệp ${index + 1}`;
    }

    return (
      file.fileName ||
      file.name ||
      file.originalFileName ||
      `Tệp ${index + 1}`
    );
  };

  const isVideoFile = (fileUrl = '') => {
    const url = fileUrl.toLowerCase();

    return (
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.ogg') ||
      url.includes('.mov') ||
      url.includes('.m4v')
    );
  };
  const handleUploadAttachments = async () => {
    if (!editTarget || selectedFiles.length === 0) return;

    try {
      setAttachmentLoading(true);

      await ticketApi.addAttachments(editTarget.feedbackId, selectedFiles);

      const detailResponse = await ticketApi.getTicketById(editTarget.feedbackId);

      const detail =
        detailResponse?.data ||
        detailResponse?.item ||
        detailResponse?.result ||
        detailResponse;

      setEditAttachments(Array.isArray(detail?.attachments) ? detail.attachments : []);
      setSelectedFiles([]);
    } catch (err) {
      console.error('Không thể thêm tệp đính kèm:', err);
      alert(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể thêm tệp đính kèm.'
      );
    } finally {
      setAttachmentLoading(false);
    }
  };

  // const handleDeleteAttachment = async (file) => {
  //   if (!editTarget) return;

  //   const attachmentId = getAttachmentId(file);

  //   if (!attachmentId) {
  //     alert('Không tìm thấy attachmentId để xóa file này.');
  //     return;
  //   }

  //   try {
  //     setAttachmentLoading(true);

  //     await ticketApi.deleteAttachment(editTarget.feedbackId, attachmentId);

  //     setEditAttachments((prev) =>
  //       prev.filter((item) => getAttachmentId(item) !== attachmentId)
  //     );
  //   } catch (err) {
  //     console.error('Không thể xóa tệp đính kèm:', err);
  //     alert(
  //       err?.response?.data?.message ||
  //       err?.message ||
  //       'Không thể xóa tệp đính kèm.'
  //     );
  //   } finally {
  //     setAttachmentLoading(false);
  //   }
  // };
  const handleDeleteAttachment = async () => {
    if (!editTarget || !attachmentDeleteTarget) return;

    const attachmentId = getAttachmentId(attachmentDeleteTarget);

    if (!attachmentId) {
      alert('Không tìm thấy attachmentId để xóa file này.');
      return;
    }

    try {
      setAttachmentLoading(true);

      await ticketApi.deleteAttachment(editTarget.feedbackId, attachmentId);

      setEditAttachments((prev) =>
        prev.filter((item) => getAttachmentId(item) !== attachmentId)
      );

      setAttachmentDeleteTarget(null);
    } catch (err) {
      console.error('Không thể xóa tệp đính kèm:', err);
      alert(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể xóa tệp đính kèm.'
      );
    } finally {
      setAttachmentLoading(false);
    }
  };

  const handleUpdateTicket = async (e) => {
    e.preventDefault();

    if (!editTarget) return;

    if (!editForm.title.trim()) {
      alert('Vui lòng nhập tiêu đề phản ánh.');
      return;
    }

    if (!editForm.description.trim()) {
      alert('Vui lòng nhập mô tả phản ánh.');
      return;
    }

    try {
      setEditLoading(true);

      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        locationText: editForm.locationText.trim(),
      };

      if (editForm.categoryId !== '') {
        payload.categoryId = Number(editForm.categoryId);
      }

      if (editForm.latitude !== null && editForm.latitude !== '') {
        payload.latitude = Number(editForm.latitude);
      }

      if (editForm.longitude !== null && editForm.longitude !== '') {
        payload.longitude = Number(editForm.longitude);
      }

      if (editForm.priority !== '') {
        payload.priority = editForm.priority;
      }

      const updatedResponse = await ticketApi.updateTicket(editTarget.feedbackId, payload);

      const updatedTicket =
        updatedResponse?.data ||
        updatedResponse?.item ||
        updatedResponse?.result ||
        updatedResponse ||
        payload;

      const nextTicket = {
        ...editTarget,
        ...payload,
        ...updatedTicket,
      };

      setTickets((prev) =>
        prev.map((t) => (t.feedbackId === editTarget.feedbackId ? nextTicket : t))
      );

      setAllCitizenTickets((prev) =>
        prev.map((t) => (t.feedbackId === editTarget.feedbackId ? nextTicket : t))
      );

      setEditTarget(null);
    } catch (err) {
      console.error('Không thể cập nhật phản ánh:', err);
      alert(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể cập nhật phản ánh.'
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);

      await ticketApi.deleteTicket(deleteTarget.feedbackId);

      setTickets((prev) => prev.filter((t) => t.feedbackId !== deleteTarget.feedbackId));
      setAllCitizenTickets((prev) => prev.filter((t) => t.feedbackId !== deleteTarget.feedbackId));

      setDeleteTarget(null);
    } catch (err) {
      console.error('Không thể xóa phản ánh:', err);
      alert(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể xóa phản ánh.'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Pagination calculations
  const totalItems = tickets.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTickets = Array.isArray(tickets) ? tickets.slice(startIndex, endIndex) : [];

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
          className={`bg-white border p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer transition-all duration-200 ${status === '' ? 'border-[#0052CC] bg-[#EFF6FF]/40 ring-1 ring-[#0052CC]' : 'border-slate-200 hover:border-slate-350'
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
          className={`bg-white border p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer transition-all duration-200 ${status === 'InProgress' ? 'border-[#0052CC] bg-[#EFF6FF]/40 ring-1 ring-[#0052CC]' : 'border-slate-200 hover:border-slate-350'
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
          className={`bg-white border p-4 rounded-2xl shadow-xs space-y-3 cursor-pointer transition-all duration-200 ${status === 'Resolved' ? 'border-[#0052CC] bg-[#EFF6FF]/40 ring-1 ring-[#0052CC]' : 'border-slate-200 hover:border-slate-350'
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
            {toolsApi.getCategories().map(c => (
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
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === '' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setStatus('Submitted')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === 'Submitted' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Đã gửi
        </button>
        <button
          onClick={() => setStatus('AI Reviewed')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === 'AI Reviewed' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Đang xem xét
        </button>
        <button
          onClick={() => setStatus('Assigned')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === 'Assigned' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Đã phân công
        </button>
        <button
          onClick={() => setStatus('InProgress')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === 'InProgress' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Đang xử lý
        </button>
        <button
          onClick={() => setStatus('Resolved')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === 'Resolved' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
        >
          Đã xử lý
        </button>
        <button
          onClick={() => setStatus('Closed')}
          className={`px-3 py-1.5 rounded-full font-bold text-[11px] border transition-colors ${status === 'Closed' ? 'bg-[#0052CC] text-white border-[#0052CC]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
                        <span>{toolsApi.getCategories().find(c => c.categoryId === t.categoryId)?.categoryName}</span>
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
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/tickets/${t.feedbackId}`)}
                          className="btn btn-ghost btn-circle btn-xs text-[#0052CC]"
                          title="Xem chi tiết"
                        >
                          <Lucide.Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(t)}
                          className="btn btn-ghost btn-circle btn-xs text-amber-500 hover:bg-amber-50"
                          title="Sửa phản ánh"
                        >
                          <Lucide.Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="btn btn-ghost btn-circle btn-xs text-red-500 hover:bg-red-50"
                          title="Xóa phản ánh"
                        >
                          <Lucide.Trash2 size={16} />
                        </button>
                      </div>
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
                  className={`btn btn-xs rounded-lg w-8 h-8 ${currentPage === idx + 1
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

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <Lucide.Trash2 size={22} />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  Xóa phản ánh?
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Bạn có chắc muốn xóa phản ánh{' '}
                  <span className="font-bold text-slate-800">
                    {deleteTarget.title}
                  </span>
                  ? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="btn btn-ghost rounded-xl font-bold"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleDeleteTicket}
                disabled={deleteLoading}
                className="btn bg-red-500 hover:bg-red-600 text-white border-none rounded-xl font-bold"
              >
                {deleteLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <Lucide.Trash2 size={16} />
                    Xóa phản ánh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Sửa phản ánh
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  Cập nhật thông tin phản ánh của bạn.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={editLoading}
                className="btn btn-ghost btn-circle btn-sm"
              >
                <Lucide.X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTicket} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-control space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Tiêu đề
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="input input-bordered rounded-2xl text-sm h-12"
                    placeholder="Nhập tiêu đề phản ánh"
                  />
                </div>

                <div className="form-control space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Danh mục
                  </label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, categoryId: e.target.value }))
                    }
                    className="select select-bordered rounded-2xl text-sm h-12"
                  >
                    {toolsApi.getCategories().map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.categoryName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-control space-y-1.5 w-full">
                <label className="text-xs font-bold text-slate-600">
                  Mô tả
                </label>

                <textarea
                  rows="7"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="textarea textarea-bordered rounded-2xl text-sm w-full min-h-[190px] resize-none leading-relaxed px-4 py-3"
                  placeholder="Nhập mô tả phản ánh"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-control space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Vị trí
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editForm.locationText}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, locationText: e.target.value }))
                      }
                      className="input input-bordered rounded-2xl text-sm h-12 flex-1"
                      placeholder="Nhập vị trí hoặc địa chỉ"
                    />

                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="btn btn-outline rounded-2xl h-12 px-4"
                      title="Lấy vị trí hiện tại"
                    >
                      <Lucide.MapPin size={17} />
                    </button>
                  </div>

                  {editForm.latitude !== null && editForm.longitude !== null && (
                    <p className="text-[10px] text-slate-400 font-semibold pl-1">
                      Tọa độ: {Number(editForm.latitude).toFixed(6)}, {Number(editForm.longitude).toFixed(6)}
                    </p>
                  )}
                </div>

                <div className="form-control space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Mức ưu tiên
                  </label>

                  <select
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, priority: e.target.value }))
                    }
                    className="select select-bordered rounded-2xl text-sm h-12"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 space-y-4 w-full">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                      <Lucide.ImagePlus size={18} />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-slate-800">
                        Hình ảnh / video đính kèm
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        Thêm hoặc xóa file đính kèm cho phản ánh này.
                      </p>
                    </div>
                  </div>

                  {editAttachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editAttachments.map((file, index) => {
                        const fileUrl = getAttachmentUrl(file);

                        return (
                          <div
                            key={getAttachmentId(file) || fileUrl || index}
                            className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3"
                          >
                            <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {fileUrl ? (
                                isVideoFile(fileUrl) ? (
                                  <div className="relative w-full h-full bg-black">
                                    <video
                                      src={fileUrl}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      className="w-full h-full object-cover opacity-80"
                                    />

                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                      <div className="w-7 h-7 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-sm">
                                        <Lucide.Play size={14} fill="currentColor" />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={fileUrl}
                                    alt={getAttachmentName(file, index)}
                                    className="w-full h-full object-cover"
                                  />
                                )
                              ) : (
                                <Lucide.File size={20} className="text-slate-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate">
                                {getAttachmentName(file, index)}
                              </p>
                              {fileUrl && (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-[#0052CC] font-bold hover:underline"
                                >
                                  Xem file
                                </a>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setAttachmentDeleteTarget(file)}
                              disabled={attachmentLoading}
                              className="btn btn-ghost btn-circle btn-xs text-red-500 hover:bg-red-50"
                              title="Xóa file"
                            >
                              <Lucide.Trash2 size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                      className="file-input file-input-bordered rounded-2xl flex-1 text-sm"
                    />

                    <button
                      type="button"
                      onClick={handleUploadAttachments}
                      disabled={attachmentLoading || selectedFiles.length === 0}
                      className="btn btn-outline rounded-2xl font-bold"
                    >
                      {attachmentLoading ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        <>
                          <Lucide.Upload size={16} />
                          Thêm file
                        </>
                      )}
                    </button>
                  </div>

                  {selectedFiles.length > 0 && (
                    <p className="text-[10px] text-slate-500 font-semibold">
                      Đã chọn {selectedFiles.length} file.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    disabled={editLoading}
                    className="btn btn-ghost rounded-xl font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="btn bg-amber-500 hover:bg-amber-600 text-white border-none rounded-xl font-bold"
                  >
                    {editLoading ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <>
                        <Lucide.Save size={16} />
                        Lưu thay đổi
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Delete Modal */}
      {attachmentDeleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <Lucide.Trash2 size={22} />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  Xóa tệp đính kèm?
                </h3>

                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Bạn có chắc muốn xóa file{' '}
                  <span className="font-bold text-slate-800">
                    {getAttachmentName(attachmentDeleteTarget, 0)}
                  </span>
                  ? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAttachmentDeleteTarget(null)}
                disabled={attachmentLoading}
                className="btn btn-ghost rounded-xl font-bold"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleDeleteAttachment}
                disabled={attachmentLoading}
                className="btn bg-red-500 hover:bg-red-600 text-white border-none rounded-xl font-bold"
              >
                {attachmentLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <Lucide.Trash2 size={16} />
                    Xóa file
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
