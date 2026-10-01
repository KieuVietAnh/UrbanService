// src/pages/tickets/AIReviewDetail.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { managementTypes } from '@urbanmind/shared-types';
import { signalrService } from '../../services/socket/signalrService';
import { ticketApi, toolsApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { fetchAllAiReviewedPages } from '../manager/managerReportReviewUtils';

const normalizePriority = (value = '') => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized === 'urgent' || normalized === 'critical') return 'Urgent';
  if (normalized === 'high') return 'High';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'low') return 'Low';
  return '';
};

const getUrgencyBadgeClass = (urgency = '') => {
  const normalized = normalizePriority(urgency);
  if (normalized === 'Urgent') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (normalized === 'High') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-500';
};

const getTicketPriority = (ticket = {}) => {
  // In the AI review queue, the AI urgency is the proposal Staff is reviewing.
  // Fall back to the persisted feedback priority only when the AI result has no urgency.
  return normalizePriority(
    ticket.analysisResult?.urgencyLevel
      || ticket.urgencyLevel
      || ticket.urgency
      || ticket.priority
  );
};

const getUrgencyLabel = (urgency = '') => {
  const normalized = normalizePriority(urgency);
  if (normalized === 'Urgent') return 'Khẩn cấp';
  if (normalized === 'High') return 'Cao';
  if (normalized === 'Medium') return 'Trung bình';
  if (normalized === 'Low') return 'Thấp';
  return 'Chưa xác định';
};

const getSentimentLabel = (sentiment = '') => {
  const normalized = `${sentiment || ''}`.trim().toLowerCase();
  if (normalized === 'positive') return 'Tích cực';
  if (normalized === 'negative') return 'Tiêu cực';
  if (normalized === 'neutral') return 'Trung tính';
  if (normalized === 'unknown' || normalized === 'undefined' || normalized === 'null') return 'Không xác định';
  return sentiment || 'Không xác định';
};

const shortenFeedbackId = (value = '') => {
  const text = `${value || ''}`;
  if (text.length <= 18) return text || '—';
  return `${text.slice(0, 8)}…${text.slice(-5)}`;
};

const AI_QUEUE_CACHE_KEY = 'staff-ai-review-queue-cache-v2';
const AI_QUEUE_CACHE_TTL = 60 * 1000;

const hasPreciseLocation = (ticket = {}) => {
  const latitude = ticket?.latitude ?? ticket?.lat;
  const longitude = ticket?.longitude ?? ticket?.lng ?? ticket?.long;
  return latitude !== null
    && latitude !== undefined
    && latitude !== ''
    && longitude !== null
    && longitude !== undefined
    && longitude !== ''
    && Number.isFinite(Number(latitude))
    && Number.isFinite(Number(longitude));
};

const readAiQueueCache = () => {
  try {
    const raw = sessionStorage.getItem(AI_QUEUE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const mergeAiQueueCache = (patch) => {
  try {
    const current = readAiQueueCache() || {};
    sessionStorage.setItem(
      AI_QUEUE_CACHE_KEY,
      JSON.stringify({ ...current, ...patch, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage failures.
  }
};


export const AIReviewDetail = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [initialQueueCache] = useState(() => readAiQueueCache());
  const [tickets, setTickets] = useState(() => (
    Array.isArray(initialQueueCache?.tickets) ? initialQueueCache.tickets : []
  ));
  const [selectedTicket, setSelectedTicket] = useState(() => (
    Array.isArray(initialQueueCache?.tickets) && initialQueueCache.tickets.length > 0
      ? initialQueueCache.tickets[0]
      : null
  ));
  const [categories, setCategories] = useState(() => (
    Array.isArray(initialQueueCache?.categories) ? initialQueueCache.categories : []
  ));
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  
  // Edit variables
  const [editCategoryId, setEditCategoryId] = useState(() => {
    const initialTicket = Array.isArray(initialQueueCache?.tickets) ? initialQueueCache.tickets[0] : null;
    const detectedCategoryId = initialTicket?.analysisResult?.detectedCategoryId
      || initialTicket?.detectedCategoryId
      || initialTicket?.categoryId;
    return detectedCategoryId ? Number(detectedCategoryId) : '';
  });
  const [editPriority, setEditPriority] = useState(() => {
    const initialTicket = Array.isArray(initialQueueCache?.tickets) ? initialQueueCache.tickets[0] : null;
    return initialTicket ? getTicketPriority(initialTicket) : '';
  });
  const [loading, setLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [actionError, setActionError] = useState('');

  const handleSelectTicket = (t) => {
    const detectedCategoryId = t?.analysisResult?.detectedCategoryId || t?.detectedCategoryId || t?.categoryId;
    setSelectedTicket(t);
    setEditCategoryId(detectedCategoryId ? Number(detectedCategoryId) : '');
    setEditPriority(getTicketPriority(t));
    setActionError('');
  };

  useEffect(() => {
    const cacheIsFresh =
      Number(initialQueueCache?.savedAt) > 0
      && Date.now() - Number(initialQueueCache.savedAt) < AI_QUEUE_CACHE_TTL;

    if (cacheIsFresh) return undefined;

    const loadQueue = async () => {
      try {
        const result = await fetchAllAiReviewedPages(
          ({ pageNumber, pageSize }) => managementFeedbackApi.getAiReviewedFeedbackPage({ pageNumber, pageSize }),
          { pageSize: 100 },
        );
        const normalized = Array.isArray(result?.items) ? result.items : [];
        if (result?.partial) {
          console.warn('AI review queue only loaded partially; some backend pages failed.');
        }
        setTickets(normalized);
        mergeAiQueueCache({ tickets: normalized });
        if (normalized.length > 0) {
          handleSelectTicket(normalized[0]);
        } else {
          setSelectedTicket(null);
        }
      } catch (err) {
        console.error('Failed to load AI reviewed queue', err);
      }
    };

    const loadCategories = async () => {
      try {
        setCategoriesError('');
        const res = await toolsApi.getCategories();
        const resolved = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
            ? res.items
            : Array.isArray(res?.data)
              ? res.data
              : [];

        if (resolved.length === 0) {
          setCategories([]);
          setCategoriesError('Không thể tải danh mục thật từ hệ thống. Vui lòng tải lại trước khi xác nhận.');
          return;
        }

        setCategories(resolved);
        mergeAiQueueCache({ categories: resolved });
      } catch (err) {
        console.error('Failed to load categories', err);
        setCategories([]);
        setCategoriesError('Không thể tải danh mục thật từ hệ thống. Vui lòng tải lại trước khi xác nhận.');
      }
    };

    loadQueue();
    loadCategories();
  }, [initialQueueCache]);

  const URGENCY_OPTIONS = ['High', 'Urgent'];

  useEffect(() => {
    const onDocClick = (event) => {
      if (!showUrgencyDropdown) return;
      try {
        const target = event.target;
        if (!target.closest('.urgency-dropdown') && !target.closest('.urgency-filter-button')) {
          setShowUrgencyDropdown(false);
        }
      } catch {
        setShowUrgencyDropdown(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showUrgencyDropdown]);

  const displayedTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (urgencyFilter) {
        const urgency = getTicketPriority(t);
        if (urgency !== normalizePriority(urgencyFilter)) return false;
      }

      if (locationFilter === 'withoutPreciseLocation') {
        return !hasPreciseLocation(t);
      }

      return true;
    });
  }, [tickets, urgencyFilter, locationFilter]);

  useEffect(() => {
    if (!displayedTickets || displayedTickets.length === 0) {
      setSelectedTicket(null);
      return;
    }
    // Keep selection and editable Staff corrections in sync with the visible ticket.
    const isSelectedVisible = selectedTicket && displayedTickets.some((d) => d.feedbackId === selectedTicket.feedbackId);
    if (!isSelectedVisible) {
      const nextTicket = displayedTickets[0];
      const detectedCategoryId = nextTicket?.analysisResult?.detectedCategoryId
        || nextTicket?.detectedCategoryId
        || nextTicket?.categoryId;
      setSelectedTicket(nextTicket);
      setEditCategoryId(detectedCategoryId ? Number(detectedCategoryId) : '');
      setEditPriority(getTicketPriority(nextTicket));
      setActionError('');
    }
  }, [displayedTickets, selectedTicket]);

  const selectedParentFeedbackId = selectedTicket?.parentTicketId || selectedTicket?.parentFeedbackId || null;
  const selectedIsConfirmedDuplicate = Boolean(selectedParentFeedbackId);

  const handleDeny = async () => {
    if (!selectedTicket || selectedIsConfirmedDuplicate) return;

    const confirmed = window.confirm('Bạn có chắc muốn không chấp nhận phản ánh này? Trạng thái sẽ chuyển sang Denied/Bị từ chối.');
    if (!confirmed) return;

    setLoading(true);
    try {
      await managementFeedbackApi.updateStatus(selectedTicket.feedbackId, {
        status: managementTypes.feedbackStatus.REJECTED,
        note: 'Staff denied from AI review queue',
      });
      sessionStorage.removeItem(AI_QUEUE_CACHE_KEY);
      try {
        signalrService.notifyStatusChanged(selectedTicket.feedbackId, selectedTicket.status, managementTypes.feedbackStatus.REJECTED, user);
      } catch (e) {
        console.warn('SignalR notify failed', e);
      }

      setTickets((current) => current.filter((ticket) => ticket.feedbackId !== selectedTicket.feedbackId));
      setSelectedTicket(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTicket || selectedIsConfirmedDuplicate || loading) return;

    const categoryId = Number(editCategoryId);
    const priority = normalizePriority(editPriority);
    const categoryExists = categories.some((category) => Number(category?.categoryId ?? category?.id) === categoryId);

    if (!Number.isInteger(categoryId) || categoryId <= 0 || !categoryExists) {
      setActionError('Vui lòng chọn một danh mục hợp lệ từ dữ liệu hệ thống trước khi xác nhận.');
      return;
    }

    if (!priority) {
      setActionError('Vui lòng chọn mức độ ưu tiên trước khi xác nhận.');
      return;
    }

    setLoading(true);
    setActionError('');
    try {
      // Keep the existing verification flow. Staff corrections are passed through
      // the established API path; backend owns the status-transition/SLA rules.
      await ticketApi.verifyAndApprove(
        selectedTicket.feedbackId,
        user.userId,
        { categoryId, priority },
        { role: user.role }
      );

      sessionStorage.removeItem(AI_QUEUE_CACHE_KEY);
      try {
        signalrService.notifyStatusChanged(
          selectedTicket.feedbackId,
          selectedTicket.status,
          managementTypes.feedbackStatus.VERIFIED,
          user
        );
      } catch (e) {
        console.warn('SignalR notify failed', e);
      }

      navigate(`/tickets/assign/${selectedTicket.feedbackId}`);
    } catch (err) {
      console.error(err);
      setActionError(
        err?.response?.data?.message
          || err?.response?.data?.title
          || err?.message
          || 'Không thể lưu điều chỉnh và xác nhận phản ánh. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  const highCount = useMemo(() => tickets.filter((ticket) => getTicketPriority(ticket) === 'High').length, [tickets]);
  const criticalCount = useMemo(() => tickets.filter((ticket) => getTicketPriority(ticket) === 'Urgent').length, [tickets]);

  return (
    <div className="admin-page-shell space-y-5 text-slate-800">
      <section className="admin-page-hero">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_16px_36px_rgba(37,99,235,0.24)]">
              <Lucide.Cpu size={25} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="admin-hero-title">Hàng chờ kiểm duyệt AI</h1>
              <p className="admin-hero-description mt-2 max-w-3xl">
                Kiểm tra kết quả phân loại tự động, điều chỉnh thông tin khi cần và xác nhận phản ánh trước khi chuyển sang bước phân công.
              </p>
            </div>
          </div>

          <div className="min-w-[240px] rounded-[24px] border border-emerald-200 bg-emerald-50/90 px-5 py-4 shadow-[0_10px_28px_rgba(16,185,129,0.08)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Đang chờ kiểm duyệt
            </div>
            <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-slate-950">
              {displayedTickets.length}
              <span className="ml-2 text-base font-semibold tracking-normal text-slate-700">phản ánh</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="admin-stat-card flex items-center justify-between gap-4 p-5">
          <div>
            <p className="admin-section-description">Tổng phản ánh</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{tickets.length}</p>
            <p className="mt-1 text-sm text-slate-500">Hồ sơ AI đã chuyển vào hàng kiểm duyệt.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Lucide.Files size={20} aria-hidden="true" />
          </span>
        </div>

        <div className="admin-stat-card flex items-center justify-between gap-4 p-5">
          <div>
            <p className="admin-section-description">Mức cao</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{highCount}</p>
            <p className="mt-1 text-sm text-slate-500">Phản ánh được AI đánh giá ưu tiên cao.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Lucide.TrendingUp size={20} aria-hidden="true" />
          </span>
        </div>

        <div className="admin-stat-card flex items-center justify-between gap-4 p-5">
          <div>
            <p className="admin-section-description">Khẩn cấp</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{criticalCount}</p>
            <p className="mt-1 text-sm text-slate-500">Phản ánh cần được ưu tiên xem xét ngay.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Lucide.Siren size={20} aria-hidden="true" />
          </span>
        </div>
      </section>

      {tickets.length === 0 ? (
        <div className="admin-empty-panel p-12 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Lucide.CheckCircle2 size={30} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-950">Hàng chờ đang trống</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Hiện không có phản ánh nào cần nhân viên kiểm duyệt kết quả phân loại AI.</p>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="admin-panel flex min-h-0 flex-col overflow-hidden xl:sticky xl:top-[calc((100vh-625px)/2)] xl:h-[560px] xl:max-h-[calc(100vh-8rem)]">
            <div className="shrink-0 border-b border-slate-200/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="admin-section-title">Phản ánh chờ kiểm duyệt</h2>
                  <p className="admin-section-description mt-1">Chọn một hồ sơ để xem kết quả AI và xác nhận.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUrgencyDropdown((value) => !value)}
                  className="urgency-filter-button inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  <Lucide.SlidersHorizontal size={15} aria-hidden="true" />
                  Lọc
                </button>
              </div>

              {showUrgencyDropdown ? (
                <div className="urgency-dropdown mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Mức độ ưu tiên</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setUrgencyFilter(''); setLocationFilter(''); setShowUrgencyDropdown(false); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${urgencyFilter === '' && locationFilter === '' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                    >
                      Tất cả
                    </button>
                    {URGENCY_OPTIONS.map((urgency) => (
                      <button
                        key={urgency}
                        type="button"
                        onClick={() => { setUrgencyFilter(urgency); setShowUrgencyDropdown(false); }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${urgencyFilter === urgency ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                      >
                        {getUrgencyLabel(urgency)}
                      </button>
                    ))}
                  </div>

                  <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Vị trí</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setLocationFilter(''); setShowUrgencyDropdown(false); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${locationFilter === '' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                    >
                      Tất cả vị trí
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLocationFilter('withoutPreciseLocation'); setShowUrgencyDropdown(false); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${locationFilter === 'withoutPreciseLocation' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                    >
                      Chưa có tọa độ chính xác
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
              {displayedTickets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Không có phản ánh phù hợp với bộ lọc.
                </div>
              ) : displayedTickets.map((ticket) => {
                const isConfirmedDuplicate = Boolean(ticket?.parentTicketId || ticket?.parentFeedbackId);
                const isActive = selectedTicket?.feedbackId === ticket.feedbackId;
                const urgency = getTicketPriority(ticket);

                return (
                  <button
                    key={ticket.feedbackId}
                    type="button"
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full rounded-2xl border p-3.5 text-left transition ${isActive ? 'border-blue-300 bg-blue-50/80 shadow-[0_10px_24px_rgba(37,99,235,0.10)]' : 'border-slate-200/80 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-blue-700" title={ticket.feedbackId}>{shortenFeedbackId(ticket.feedbackId)}</span>
                      <span className="shrink-0 text-xs font-medium text-slate-400">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-slate-900">{ticket.title || 'Không có tiêu đề'}</h3>
                    <p className="mt-1 truncate text-xs text-slate-500">{ticket.locationText || 'Chưa có địa điểm'}</p>
                    {!hasPreciseLocation(ticket) ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <Lucide.MapPinOff size={11} aria-hidden="true" />
                        Chưa có tọa độ chính xác
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getUrgencyBadgeClass(urgency)}`}>
                        {getUrgencyLabel(urgency)}
                      </span>
                      {isConfirmedDuplicate ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                          <Lucide.GitMerge size={11} aria-hidden="true" />
                          Trùng lặp
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            {selectedTicket ? (
              <>
                {selectedIsConfirmedDuplicate ? (
                  <section className="admin-panel border-violet-200 bg-violet-50/70 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
                          <Lucide.GitMerge size={20} aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="font-bold text-violet-950">Phản ánh đã được xác nhận trùng lặp</h2>
                          <p className="mt-1 text-sm text-violet-800">Không cần duyệt hoặc phân công riêng; hồ sơ này được xử lý theo phản ánh gốc.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/staff/feedbacks/${selectedParentFeedbackId}`)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                      >
                        <Lucide.ExternalLink size={15} aria-hidden="true" />
                        Xem phản ánh gốc
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="admin-panel overflow-hidden">
                  <div className="border-b border-slate-200/80 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                          <Lucide.Sparkles size={14} aria-hidden="true" />
                          Phân tích từ AI
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-slate-950">Kết quả AI đề xuất</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Xem lại kết quả phân tích tự động và điều chỉnh thông tin trước khi xác nhận chuyển phân công.</p>
                      </div>

                      <div className="admin-inset-panel min-w-[190px] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Lucide.BarChart3 size={19} aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Độ tin cậy AI</p>
                            <p className="mt-1 text-2xl font-bold tracking-[-0.025em] text-slate-950">{Math.round((selectedTicket.confidenceScore || 0) * 100)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 p-5 sm:p-6">
                    <div className="admin-inset-panel p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tóm tắt sự cố</p>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getUrgencyBadgeClass(getTicketPriority(selectedTicket))}`}>
                          {getUrgencyLabel(getTicketPriority(selectedTicket))}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold leading-7 text-slate-800">{selectedTicket.summary || selectedTicket.description || 'Không có tóm tắt từ AI.'}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Lucide.ShieldCheck size={16} /></span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">Độ tin cậy</p>
                            <p className="mt-0.5 text-base font-bold leading-6 tracking-[-0.01em] text-slate-900">{Math.round((selectedTicket.confidenceScore || 0) * 100)}%</p>
                          </div>
                        </div>
                      </div>
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Lucide.TrendingUp size={16} /></span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">Ưu tiên</p>
                            <p className="mt-0.5 text-base font-bold leading-6 tracking-[-0.01em] text-slate-900">{getUrgencyLabel(getTicketPriority(selectedTicket))}</p>
                          </div>
                        </div>
                      </div>
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Lucide.HeartPulse size={16} /></span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">Cảm xúc</p>
                            <p className="mt-0.5 whitespace-nowrap text-[15px] font-bold leading-6 tracking-[-0.01em] text-slate-900">{getSentimentLabel(selectedTicket.sentiment)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Lucide.Repeat size={16} /></span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">Trùng lặp</p>
                            <p className="mt-0.5 whitespace-nowrap text-base font-bold leading-6 tracking-[-0.01em] text-slate-900">{selectedTicket.duplicateLikelihood != null ? `${selectedTicket.duplicateLikelihood}%` : 'Chưa có'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">Danh mục</span>
                        <select
                          value={editCategoryId}
                          onChange={(event) => {
                            setEditCategoryId(event.target.value ? Number(event.target.value) : '');
                            setActionError('');
                          }}
                          disabled={categories.length === 0 || loading}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {categories.map((category) => {
                            const categoryId = category?.categoryId ?? category?.id;
                            const categoryName = category?.categoryName ?? category?.name ?? 'Chưa đặt tên';
                            return <option key={categoryId} value={categoryId}>{categoryName}</option>;
                          })}
                        </select>
                        {categoriesError ? <p className="mt-2 text-xs font-medium text-red-600">{categoriesError}</p> : null}
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">Mức độ ưu tiên</span>
                        <select
                          value={editPriority}
                          onChange={(event) => {
                            setEditPriority(event.target.value);
                            setActionError('');
                          }}
                          disabled={loading}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="Low">Thấp</option>
                          <option value="Medium">Trung bình</option>
                          <option value="High">Cao</option>
                          <option value="Urgent">Khẩn cấp</option>
                        </select>
                      </label>

                      <div className="admin-inset-panel p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Khu vực</p>
                        <p className="mt-2 text-sm font-bold text-slate-800">{selectedTicket.areaName || 'Chưa có khu vực'}</p>
                      </div>
                    </div>

                    <div className="admin-inset-panel p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900">Rủi ro và hành động đề xuất</h3>
                          <p className="mt-1 text-sm text-slate-500">Thông tin hỗ trợ từ kết quả phân tích AI trước khi nhân viên xác nhận.</p>
                        </div>
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Thông tin AI</span>
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Rủi ro / lưu ý</p>
                          {selectedTicket.riskNotes?.length > 0 ? (
                            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                              {selectedTicket.riskNotes.map((note) => <li key={note}>{note}</li>)}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">Không có ghi chú rủi ro cụ thể.</p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Hành động đề xuất</p>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                            <li className="flex gap-2"><Lucide.Check size={15} className="mt-1 shrink-0 text-emerald-600" />Kiểm tra danh mục và mức độ ưu tiên AI đề xuất.</li>
                            <li className="flex gap-2"><Lucide.Check size={15} className="mt-1 shrink-0 text-emerald-600" />Điều chỉnh nếu cần và xác nhận chuyển phân công.</li>
                            <li className="flex gap-2"><Lucide.Check size={15} className="mt-1 shrink-0 text-emerald-600" />Xem lại các lưu ý rủi ro trước khi xác nhận.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {actionError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
                        {actionError}
                      </div>
                    ) : null}

                    {selectedIsConfirmedDuplicate ? (
                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center text-sm font-semibold text-violet-800">
                        Phản ánh trùng lặp không cần duyệt hoặc phân công riêng.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleDeny}
                          disabled={loading}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-bold text-red-700 shadow-[0_12px_28px_rgba(239,68,68,0.12)] transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.XCircle size={18} aria-hidden="true" />}
                          Không chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={loading || categories.length === 0 || !editCategoryId || !normalizePriority(editPriority)}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.20)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.CheckCircle2 size={18} aria-hidden="true" />}
                          {loading ? 'Đang xử lý...' : 'Xác nhận và chuyển phân công'}
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="admin-panel overflow-hidden">
                  <div className="border-b border-slate-200/80 px-5 py-4 sm:px-6">
                    <h2 className="admin-section-title">Chi tiết phản ánh</h2>
                    <p className="admin-section-description mt-1">Thông tin gốc của hồ sơ đang được kiểm duyệt.</p>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="admin-inset-panel p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tiêu đề</p><p className="mt-2 text-sm font-bold text-slate-800">{selectedTicket.title || 'Không có tiêu đề'}</p></div>
                      <div className="admin-inset-panel p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mã phản ánh</p><p className="mt-2 whitespace-nowrap text-sm font-semibold text-blue-700" title={selectedTicket.feedbackId}>{shortenFeedbackId(selectedTicket.feedbackId)}</p></div>
                      <div className="admin-inset-panel p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Người báo cáo</p><p className="mt-2 text-sm font-bold text-slate-800">{selectedTicket.reporterName || 'Không rõ'}</p></div>
                      <div className="admin-inset-panel p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Địa điểm</p><p className="mt-2 text-sm font-bold text-slate-800">{selectedTicket.locationText || 'Không có địa điểm'}</p></div>
                      <div className="admin-inset-panel p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Khu vực</p><p className="mt-2 text-sm font-bold text-slate-800">{selectedTicket.areaName || 'Không có khu vực'}</p></div>
                      <div className="admin-inset-panel p-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Danh mục hồ sơ</p><p className="mt-2 text-sm font-bold text-slate-800">{selectedTicket.categoryName || 'Không có danh mục'}</p></div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Nội dung phản ánh</p>
                        <div className="admin-inset-panel mt-2 min-h-24 p-4 text-sm leading-7 text-slate-700">{selectedTicket.description || selectedTicket.title || 'Không có nội dung phản ánh.'}</div>
                      </div>
                      {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ảnh đính kèm</p>
                          <img src={selectedTicket.attachments?.[0]} alt="Ảnh đính kèm của phản ánh" className="mt-2 aspect-video w-full rounded-2xl border border-slate-200 object-cover" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="admin-empty-panel p-12 text-center">
                <Lucide.MousePointerClick size={30} className="mx-auto text-slate-300" aria-hidden="true" />
                <h2 className="mt-3 font-bold text-slate-900">Chọn một phản ánh</h2>
                <p className="mt-1 text-sm text-slate-500">Chọn hồ sơ ở danh sách bên trái để bắt đầu kiểm duyệt.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

};
