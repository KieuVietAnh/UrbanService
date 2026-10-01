// src/pages/management/FeedbackManagement.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { ManagerListRefreshIndicator, ManagerSelectMenu } from '../../components/manager/ManagerPageElements';
import { managementFeedbackApi, toolsApi } from '@urbanmind/shared-api';
import { getCategoryLabel } from '../../utils/categoryLabels';
import {
  ADMIN_FEEDBACK_METRICS,
  calculateAdminFeedbackSummary,
} from '../../utils/adminFeedbackMetrics';
import {
  peekAdminFeedbackDetail,
  prefetchAdminFeedbackDetail,
} from '../../services/cache/adminFeedbackDetailCache';
import {
  createAdminFeedbackDeleteGuard,
  deleteAdminFeedbackAndReconcile,
} from '../../services/adminFeedbackDeletion';


const ADMIN_FEEDBACK_SNAPSHOT_KEY = 'adminFeedbackListSnapshot';
const ADMIN_FEEDBACK_RETURN_STORAGE_KEY = 'urbanmind-admin-feedback-return';
const ADMIN_FEEDBACK_SNAPSHOT_TTL = 5 * 60 * 1000;
const ADMIN_FEEDBACK_PAGE_SIZE = 10;

const readFeedbackSnapshot = () => {
  try {
    const raw = sessionStorage.getItem(ADMIN_FEEDBACK_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || !Array.isArray(snapshot.feedbacks)) return null;
    if (Date.now() - Number(snapshot.savedAt || 0) > ADMIN_FEEDBACK_SNAPSHOT_TTL) {
      sessionStorage.removeItem(ADMIN_FEEDBACK_SNAPSHOT_KEY);
      return null;
    }
    return snapshot;
  } catch {
    sessionStorage.removeItem(ADMIN_FEEDBACK_SNAPSHOT_KEY);
    return null;
  }
};


const readAdminFeedbackReturnContext = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(
      ADMIN_FEEDBACK_RETURN_STORAGE_KEY
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Không thể đọc vị trí quay lại danh sách phản ánh', error);
    return null;
  }
};

const writeFeedbackSnapshot = (snapshot) => {
  try {
    let previous = {};
    const raw = sessionStorage.getItem(ADMIN_FEEDBACK_SNAPSHOT_KEY);
    if (raw) previous = JSON.parse(raw) || {};
    sessionStorage.setItem(
      ADMIN_FEEDBACK_SNAPSHOT_KEY,
      JSON.stringify({ ...previous, ...snapshot, savedAt: Date.now() })
    );
  } catch (error) {
    console.warn('Không thể lưu trạng thái danh sách phản ánh', error);
  }
};

const normalizeFeedbackEnum = (value) => String(value ?? '')
  .replace(/[-_\s]/g, '')
  .toLowerCase();

const STATUS_META = {
  submitted: { value: 'Submitted', label: 'Mới gửi', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  aireviewed: { value: 'AiReviewed', label: 'AI đã phân loại', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  verified: { value: 'Verified', label: 'Đã xác minh', className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  assigned: { value: 'Assigned', label: 'Đã phân công', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  inprogress: { value: 'InProgress', label: 'Đang xử lý', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  resolved: { value: 'Resolved', label: 'Chờ nghiệm thu', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  submittedforapproval: { value: 'SubmittedForApproval', label: 'Chờ phê duyệt', className: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  approved: { value: 'Approved', label: 'Đã phê duyệt', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  rejected: { value: 'Rejected', label: 'Đã từ chối', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  needrework: { value: 'NeedRework', label: 'Cần xử lý lại', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  closed: { value: 'Closed', label: 'Đã đóng', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  cancelled: { value: 'Cancelled', label: 'Đã hủy', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

const PRIORITY_META = {
  critical: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  urgent: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  high: { label: 'Cao', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  medium: { label: 'Trung bình', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  low: { label: 'Thấp', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

const getStatusMeta = (status) => STATUS_META[normalizeFeedbackEnum(status)];
const getPriorityMeta = (priority) => PRIORITY_META[normalizeFeedbackEnum(priority)];

const getCategoryName = (feedback, categories = []) => {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const categoryId = feedback?.categoryId ?? feedback?.category?.categoryId ?? feedback?.category?.id;
  const matchedCategory = safeCategories.find((category) =>
    String(category?.categoryId ?? category?.id) === String(categoryId)
  );
  const categoryName =
    feedback?.categoryName ??
    feedback?.category?.categoryName ??
    feedback?.category?.name ??
    matchedCategory?.categoryName ??
    matchedCategory?.name;

  return getCategoryLabel(categoryName);
};

const formatFeedbackId = (feedbackId) => {
  if (!feedbackId) return '—';
  const value = String(feedbackId);
  const suffix = value.split('-').pop();
  return suffix ? `UM-${suffix.slice(0, 8).toUpperCase()}` : value;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
};

const getDeleteErrorMessage = (error) => {
  const responseData = error?.response?.data;
  return (typeof responseData === 'string' ? responseData : '') ||
    responseData?.msg ||
    responseData?.message ||
    error?.message ||
    'Không thể xóa phản ánh. Vui lòng thử lại.';
};

const getAreaName = (feedback) => {
  const areaName = [
    feedback?.wardName,
    feedback?.areaName,
    feedback?.area?.areaName,
    feedback?.area?.name,
    feedback?.ward?.name,
    feedback?.location?.wardName,
    feedback?.location?.areaName,
  ].find((value) => typeof value === 'string' && value.trim());

  return areaName?.trim() || '';
};

const getLocationText = (feedback) => {
  const locationText = [
    feedback?.locationText,
    feedback?.address,
    feedback?.location?.address,
  ].find((value) => typeof value === 'string' && value.trim());

  return locationText?.trim() || getAreaName(feedback) || 'Chưa xác định vị trí';
};

const getStatusLabel = (status) => {
  return getStatusMeta(status)?.label || status || 'Chưa rõ';
};

const getPriorityLabel = (priority) => {
  return getPriorityMeta(priority)?.label || priority || 'Trung bình';
};

const StatusBadge = ({ status }) => {
  const meta = getStatusMeta(status) || { label: getStatusLabel(status), className: 'bg-slate-100 text-slate-600 ring-slate-200' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
};

const PriorityBadge = ({ priority }) => {
  const meta = getPriorityMeta(priority) || { ...PRIORITY_META.medium, label: getPriorityLabel(priority) };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
};


const FeedbackTableSkeleton = () => (
  <div className="overflow-hidden">
    <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="grid min-w-[1040px] grid-cols-[120px_minmax(280px,1.4fr)_180px_120px_140px_120px_96px] gap-6">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid min-w-[1040px] grid-cols-[120px_minmax(280px,1.4fr)_180px_120px_140px_120px_96px] items-center gap-6 px-6 py-5"
        >
          <div className="h-4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-3/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, helper, tone = 'blue', active = false, onClick }) => {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }[tone];
  const interactive = typeof onClick === 'function';
  const Component = interactive ? 'button' : 'div';

  return (
    <Component
      {...(interactive ? { type: 'button', onClick, 'aria-pressed': active } : {})}
      className={`group w-full rounded-2xl border bg-white p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition duration-200 ${interactive ? 'hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_42px_rgba(15,23,42,0.07)]' : ''} ${active
        ? 'border-blue-400 ring-2 ring-blue-100 shadow-[0_16px_42px_rgba(37,99,235,0.10)]'
        : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          {helper && <p className="mt-1 text-xs font-medium text-slate-400">{helper}</p>}
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${toneClass}`}>
          <Icon size={20} />
        </span>
      </div>
    </Component>
  );
};

export const FeedbackManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialSnapshot] = useState(readFeedbackSnapshot);
  const [shouldRestoreListContext] = useState(() => Boolean(location.state?.restoreFeedbackId));
  const [restoredContext] = useState(() => {
    if (!shouldRestoreListContext) return null;

    const stored = readAdminFeedbackReturnContext();
    return {
      ...(stored || {}),
      feedbackId: location.state.restoreFeedbackId,
    };
  });

  const parseUrlFilters = useCallback((params) => ({
    group: 'total',
    status: params.get('status') || 'all',
    search: params.get('search') || '',
    locationFilter: params.get('locationFilter') || 'all',
    categoryFilter: params.get('categoryId') || 'all',
    page: Math.max(1, Number(params.get('page')) || 1),
  }), []);

  const initialUrlFilters = parseUrlFilters(searchParams);
  const initialFilters = restoredContext
    ? {
        group: 'total',
        status: restoredContext.statusFilter ?? initialUrlFilters.status,
        search: restoredContext.searchTerm ?? initialUrlFilters.search,
        locationFilter: restoredContext.locationFilter ?? initialUrlFilters.locationFilter,
        categoryFilter: restoredContext.categoryFilter ?? initialUrlFilters.categoryFilter,
        page: Math.max(
          1,
          Number(restoredContext.pageNumber ?? initialUrlFilters.page) || 1
        ),
      }
    : initialUrlFilters;

  const restoreContextRef = useRef(restoredContext);
  const feedbackRequestIdRef = useRef(0);
  const highlightTimerRef = useRef(null);
  const lastWrittenQueryRef = useRef('');
  const deleteGuardRef = useRef(createAdminFeedbackDeleteGuard());
  const deleteDialogRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const deleteSuccessTimerRef = useRef(null);
  const [filters, setFilters] = useState({ ...initialFilters, group: 'total' });
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search.trim());
  const [allFeedbacks, setAllFeedbacks] = useState(() => (
    Array.isArray(initialSnapshot?.feedbacks)
      ? initialSnapshot.feedbacks
      : Array.isArray(initialSnapshot?.allFeedbacks)
        ? initialSnapshot.allFeedbacks.slice(0, ADMIN_FEEDBACK_PAGE_SIZE)
        : []
  ));
  const allFeedbacksRef = useRef(allFeedbacks);
  const [categories, setCategories] = useState(() => initialSnapshot?.categories || []);
  const [feedbackSummary, setFeedbackSummary] = useState(() => (
    initialSnapshot?.feedbackSummary || calculateAdminFeedbackSummary([], initialSnapshot?.totalItems)
  ));
  const feedbackSummaryRef = useRef(feedbackSummary);
  const [pagination, setPagination] = useState(() => ({
    pageNumber: Number(initialSnapshot?.pageNumber) || initialFilters.page || 1,
    pageSize: ADMIN_FEEDBACK_PAGE_SIZE,
    totalItems: Number(initialSnapshot?.totalItems) || 0,
    totalPages: Number(initialSnapshot?.totalPages) || 0,
    hasPreviousPage: Boolean(initialSnapshot?.hasPreviousPage),
    hasNextPage: Boolean(initialSnapshot?.hasNextPage),
  }));
  const [loading, setLoading] = useState(() => allFeedbacks.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [feedbackToDelete, setFeedbackToDelete] = useState(null);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [highlightedFeedbackId, setHighlightedFeedbackId] = useState(
    restoredContext?.feedbackId || ''
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  const loadFeedbackSummary = useCallback(async () => {
    try {
      const summaryResponse = await managementFeedbackApi.getFeedbackSummary();
      const nextSummary = {
        total: Number(summaryResponse?.total) || 0,
        pending: Number(summaryResponse?.pending) || 0,
        inProgress: Number(summaryResponse?.inProgress) || 0,
        completed: Number(summaryResponse?.completed) || 0,
      };
      feedbackSummaryRef.current = nextSummary;
      setFeedbackSummary(nextSummary);
      return nextSummary;
    } catch (err) {
      console.warn('Không thể tải thống kê phản ánh', err);
      return null;
    }
  }, []);

  const fetchFeedbacks = useCallback(async ({ background = false, includeSummary = false } = {}) => {
    const requestId = ++feedbackRequestIdRef.current;
    const hasCurrentFeedbacks = allFeedbacksRef.current.length > 0;

    if (background || hasCurrentFeedbacks) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const hasPreciseLocationFilter = filters.locationFilter === 'withPreciseLocation'
        ? true
        : filters.locationFilter === 'withoutPreciseLocation'
          ? false
          : undefined;
      const [pageResult, summaryResult] = await Promise.all([
        managementFeedbackApi.getFeedbackPage({
          PageNumber: filters.page,
          PageSize: ADMIN_FEEDBACK_PAGE_SIZE,
          Status: filters.status === 'all' ? undefined : filters.status,
          CategoryId: filters.categoryFilter === 'all' ? undefined : filters.categoryFilter,
          HasPreciseLocation: hasPreciseLocationFilter,
          Search: debouncedSearch || undefined,
        }),
        includeSummary ? loadFeedbackSummary() : Promise.resolve(null),
      ]);
      if (requestId !== feedbackRequestIdRef.current) return null;

      const nextFeedbacks = Array.isArray(pageResult?.items) ? pageResult.items : [];
      const nextPagination = {
        pageNumber: Number(pageResult?.pageNumber) || filters.page,
        pageSize: Number(pageResult?.pageSize) || ADMIN_FEEDBACK_PAGE_SIZE,
        totalItems: Number(pageResult?.totalItems) || 0,
        totalPages: Number(pageResult?.totalPages) || 0,
        hasPreviousPage: Boolean(pageResult?.hasPreviousPage),
        hasNextPage: Boolean(pageResult?.hasNextPage),
      };

      allFeedbacksRef.current = nextFeedbacks;
      setAllFeedbacks(nextFeedbacks);
      setPagination(nextPagination);
      return { feedbacks: nextFeedbacks, pagination: nextPagination, summary: summaryResult };
    } catch (err) {
      if (requestId !== feedbackRequestIdRef.current) return null;
      console.error(err);
      if (!background || !hasCurrentFeedbacks) {
        setError(err?.message || 'Không thể tải danh sách phản ánh.');
      }
      return null;
    } finally {
      if (requestId === feedbackRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [debouncedSearch, filters.categoryFilter, filters.locationFilter, filters.page, filters.status, loadFeedbackSummary]);

  useEffect(() => {
    let cancelled = false;
    toolsApi.getCategories()
      .then((fetchedCategories) => {
        if (!cancelled) setCategories(Array.isArray(fetchedCategories) ? fetchedCategories : []);
      })
      .catch((err) => console.warn('Failed to load categories for feedback management', err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void loadFeedbackSummary();
  }, [loadFeedbackSummary]);

  useEffect(() => {
    void fetchFeedbacks({ background: allFeedbacksRef.current.length > 0 });
    return () => {
      feedbackRequestIdRef.current += 1;
    };
  }, [fetchFeedbacks]);

  useEffect(() => {
    if (shouldRestoreListContext) return;

    try {
      window.sessionStorage.removeItem(ADMIN_FEEDBACK_RETURN_STORAGE_KEY);
    } catch {
      // Ignore storage failures; URL filters remain the source of truth.
    }
  }, [shouldRestoreListContext]);

  const feedbacks = allFeedbacks;
  const filteredFeedbacks = feedbacks;
  const searchTerm = filters.search;
  const statusFilter = filters.status;
  const metricFilter = 'total';
  const pageNumber = pagination.pageNumber || filters.page;
  const locationFilter = filters.locationFilter || 'all';
  const categoryFilter = filters.categoryFilter || 'all';
  const stats = feedbackSummary;

  const statusOptions = useMemo(() => ([
    { value: 'all', label: 'Tất cả trạng thái' },
    ...Object.values(STATUS_META).map((meta) => ({ value: meta.value, label: meta.label })),
  ]), []);

  const categoryOptions = useMemo(() => ([
    { value: 'all', label: 'Tất cả danh mục' },
    ...categories
      .map((category) => ({
        value: String(category?.categoryId ?? category?.id ?? ''),
        label: getCategoryLabel(category?.categoryName ?? category?.name),
      }))
      .filter((option) => option.value),
  ]), [categories]);

  const locationOptions = useMemo(() => ([
    { value: 'all', label: 'Tất cả vị trí' },
    { value: 'withPreciseLocation', label: 'Có tọa độ chính xác' },
    { value: 'withoutPreciseLocation', label: 'Chưa có tọa độ chính xác' },
  ]), []);

  const hasActiveListFilters = Boolean(
    searchTerm || statusFilter !== 'all' || locationFilter !== 'all' || categoryFilter !== 'all'
  );

  useEffect(() => {
    if (loading) return;
    const maxPage = Math.max(1, Number(pagination.totalPages) || 1);
    if (filters.page > maxPage) {
      setFilters((current) => ({ ...current, page: maxPage }));
    }
  }, [filters.page, loading, pagination.totalPages]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (filters.status !== 'all') nextParams.set('status', filters.status);
    if (filters.search.trim()) nextParams.set('search', filters.search.trim());
    if (filters.locationFilter && filters.locationFilter !== 'all') nextParams.set('locationFilter', filters.locationFilter);
    if (filters.categoryFilter && filters.categoryFilter !== 'all') nextParams.set('categoryId', filters.categoryFilter);
    if (filters.page > 1) nextParams.set('page', String(filters.page));

    const nextQuery = nextParams.toString();
    if (nextQuery === searchParams.toString()) return;
    lastWrittenQueryRef.current = nextQuery;
    setSearchParams(nextParams, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    if (currentQuery === lastWrittenQueryRef.current) {
      lastWrittenQueryRef.current = '';
      return;
    }
    const urlFilters = parseUrlFilters(searchParams);
    setFilters((current) => (
      current.group === urlFilters.group &&
      current.status === urlFilters.status &&
      current.search === urlFilters.search &&
      current.locationFilter === urlFilters.locationFilter &&
      current.categoryFilter === urlFilters.categoryFilter &&
      current.page === urlFilters.page
        ? current
        : urlFilters
    ));
  }, [parseUrlFilters, searchParams]);

  useEffect(() => {
    writeFeedbackSnapshot({
      feedbacks,
      allFeedbacks,
      categories,
      searchTerm,
      statusFilter,
      metricFilter,
      locationFilter,
      categoryFilter,
      feedbackSummary,
      ...pagination,
    });
  }, [allFeedbacks, categories, categoryFilter, feedbackSummary, feedbacks, locationFilter, metricFilter, pagination, searchTerm, statusFilter]);

  const updateFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, [setFilters]);

  const handleStatusFilterChange = useCallback((nextStatus) => {
    restoreContextRef.current = null;
    updateFilters({
      status: nextStatus,
      group: 'total',
      page: 1,
    });
  }, [updateFilters]);

  const handleOpenFeedbackDetail = useCallback((feedback) => {
    const feedbackId = feedback?.feedbackId || feedback?.id;
    if (!feedbackId) return;
    const scrollY = document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0;

    try {
      window.sessionStorage.setItem(
        ADMIN_FEEDBACK_RETURN_STORAGE_KEY,
        JSON.stringify({
          feedbackId: String(feedbackId),
          searchTerm,
          statusFilter,
          metricFilter,
          pageNumber,
          locationFilter,
          categoryFilter,
          scrollY,
        })
      );
    } catch (storageError) {
      console.warn('Không thể lưu vị trí danh sách phản ánh', storageError);
    }

    const prefetchedDetail = peekAdminFeedbackDetail(feedbackId);
    navigate(`/management/feedbacks/${feedbackId}`, {
      state: {
        feedback: prefetchedDetail
          ? { ...feedback, ...(prefetchedDetail?.data || prefetchedDetail?.item || prefetchedDetail?.result || prefetchedDetail?.record || prefetchedDetail) }
          : feedback,
        from: '/management/feedbacks',
      },
    });
  }, [categoryFilter, locationFilter, metricFilter, navigate, pageNumber, searchTerm, statusFilter]);

  const handleRequestFeedbackDelete = useCallback((event, feedback) => {
    event.stopPropagation();
    if (deleteGuardRef.current.isRunning()) return;

    const feedbackId = feedback?.feedbackId || feedback?.id;
    if (!feedbackId) return;

    deleteTriggerRef.current = event.currentTarget;
    setFeedbackToDelete(feedback);
    setDeleteError('');
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    if (deleteGuardRef.current.isRunning()) return;
    setFeedbackToDelete(null);
    setDeleteError('');
  }, []);

  useEffect(() => {
    if (!feedbackToDelete) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleDeleteDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseDeleteDialog();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(deleteDialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      } else if (!deleteDialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      }
    };

    document.addEventListener('keydown', handleDeleteDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDeleteDialogKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (deleteTriggerRef.current?.isConnected) {
        deleteTriggerRef.current.focus();
      }
      deleteTriggerRef.current = null;
    };
  }, [feedbackToDelete, handleCloseDeleteDialog]);

  const handleDismissDeleteSuccess = useCallback(() => {
    if (deleteSuccessTimerRef.current) {
      window.clearTimeout(deleteSuccessTimerRef.current);
      deleteSuccessTimerRef.current = null;
    }
    setDeleteSuccess('');
  }, []);

  const handleConfirmFeedbackDelete = useCallback(async () => {
    const feedback = feedbackToDelete;
    const feedbackId = feedback?.feedbackId || feedback?.id;
    if (!feedbackId || deleteGuardRef.current.isRunning()) return;

    const normalizedFeedbackId = String(feedbackId);
    await deleteGuardRef.current.run(async () => {
      setDeletingFeedbackId(normalizedFeedbackId);
      setDeleteError('');

      try {
        const reconciled = await deleteAdminFeedbackAndReconcile({
          feedbackId,
          feedbacks: allFeedbacksRef.current,
          summary: feedbackSummaryRef.current,
        });
        feedbackRequestIdRef.current += 1;
        allFeedbacksRef.current = reconciled.feedbacks;
        feedbackSummaryRef.current = reconciled.summary;
        setAllFeedbacks(reconciled.feedbacks);
        setFeedbackSummary(reconciled.summary);
        setPagination((current) => ({
          ...current,
          totalItems: Math.max(0, Number(current.totalItems || 0) - 1),
        }));
        setFeedbackToDelete(null);

        if (deleteSuccessTimerRef.current) {
          window.clearTimeout(deleteSuccessTimerRef.current);
        }
        setDeleteSuccess(`Đã xóa vĩnh viễn phản ánh ${formatFeedbackId(feedbackId)}.`);
        deleteSuccessTimerRef.current = window.setTimeout(() => {
          setDeleteSuccess('');
          deleteSuccessTimerRef.current = null;
        }, 5000);

        if (reconciled.feedbacks.length === 0 && filters.page > 1) {
          updateFilters({ page: filters.page - 1 });
          void loadFeedbackSummary();
        } else {
          void fetchFeedbacks({ background: true, includeSummary: true });
        }
      } catch (deleteRequestError) {
        console.error('Failed to delete feedback', deleteRequestError);
        setDeleteError(getDeleteErrorMessage(deleteRequestError));
        void fetchFeedbacks({ background: true, includeSummary: true });
      } finally {
        setDeletingFeedbackId('');
      }
    });
  }, [feedbackToDelete, fetchFeedbacks, filters.page, loadFeedbackSummary, updateFilters]);

  useEffect(() => () => {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    if (deleteSuccessTimerRef.current) window.clearTimeout(deleteSuccessTimerRef.current);
  }, []);

  useEffect(() => {
    const savedContext = restoreContextRef.current;
    if (!savedContext || loading || filteredFeedbacks.length === 0) return undefined;

    let cancelled = false;
    let animationFrameId;
    let frameCount = 0;

    const consumeReturnContext = () => {
      try { window.sessionStorage.removeItem(ADMIN_FEEDBACK_RETURN_STORAGE_KEY); } catch { /* noop */ }
      restoreContextRef.current = null;
    };

    const restorePosition = () => {
      if (cancelled) return;

      const feedbackId = String(savedContext.feedbackId || '');
      const escapedFeedbackId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(feedbackId)
        : feedbackId.replace(/["\\]/g, '\\$&');
      const targetRow = escapedFeedbackId
        ? document.querySelector(`[data-admin-feedback-id="${escapedFeedbackId}"]`)
        : null;

      if (!targetRow) {
        frameCount += 1;
        if (frameCount < 20) {
          animationFrameId = window.requestAnimationFrame(restorePosition);
          return;
        }

        const scrollContainer = document.querySelector('[data-dashboard-scroll-container]');
        scrollContainer?.scrollTo({
          top: Number(savedContext.scrollY) || 0,
          left: 0,
          behavior: 'auto',
        });
        consumeReturnContext();
        return;
      }

      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      setHighlightedFeedbackId(feedbackId);

      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedFeedbackId('');
        highlightTimerRef.current = null;
      }, 2500);

      consumeReturnContext();
    };

    animationFrameId = window.requestAnimationFrame(restorePosition);

    return () => {
      cancelled = true;
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, [filteredFeedbacks, loading]);


  return (
    <div className="admin-page-shell space-y-6">
      <section className="admin-page-hero">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-cyan-100/50 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="admin-hero-icon">
              <Lucide.MessageSquare size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="admin-hero-title">
                Quản lý phản ánh
              </h1>
              <p className="admin-hero-description">
                Theo dõi phản ánh, trạng thái xử lý và các điểm cần điều phối.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:self-center">
            <button
              type="button"
              onClick={() => fetchFeedbacks({ background: feedbacks.length > 0, includeSummary: true })}
              className="btn btn-outline h-11 rounded-xl border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={loading || refreshing}
            >
              <Lucide.RefreshCcw size={16} className={loading || refreshing ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <Link
              to="/management/map"
              className="btn h-11 rounded-xl border-0 bg-blue-600 px-4 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
            >
              <Lucide.Map size={16} />
              Xem bản đồ
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_FEEDBACK_METRICS.map((metric) => {
          const Icon = Lucide[metric.icon] || Lucide.Circle;
          return (
            <StatCard
              key={metric.key}
              icon={Icon}
              label={metric.label}
              value={stats[metric.key] ?? 0}
              helper={metric.helper}
              tone={metric.tone}
              active={false}
            />
          );
        })}
      </section>

      <section className="admin-panel relative overflow-hidden">
        <div className="manager-list-panel-header bg-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách phản ánh</h2>
                  <ManagerListRefreshIndicator visible={refreshing && !loading} label="Đang cập nhật" />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>Tổng cộng {pagination.totalItems} phản ánh</span>
                  {hasActiveListFilters ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      Đang lọc · {pagination.totalItems} kết quả
                    </span>
                  ) : null}
                </div>
              </div>

              {hasActiveListFilters ? (
                <button
                  type="button"
                  onClick={() => updateFilters({ search: '', status: 'all', group: 'total', categoryFilter: 'all', locationFilter: 'all', page: 1 })}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  title="Xóa toàn bộ bộ lọc"
                >
                  <Lucide.RotateCcw size={15} />
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1.45fr)_minmax(190px,0.8fr)_minmax(190px,0.8fr)_minmax(190px,0.8fr)]">
              <label className="relative block min-w-0">
                <span className="sr-only">Tìm kiếm phản ánh</span>
                <Lucide.Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={searchTerm}
                  onChange={(event) => updateFilters({ search: event.target.value, page: 1 })}
                  className="input h-10 w-full rounded-xl border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Tìm theo mã, nội dung, vị trí..."
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ search: '', page: 1 })}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Xóa từ khóa tìm kiếm"
                  >
                    <Lucide.X size={15} />
                  </button>
                )}
              </label>

              <ManagerSelectMenu
                value={statusFilter}
                onChange={handleStatusFilterChange}
                options={statusOptions}
                placeholder="Tất cả trạng thái"
                ariaLabel="Lọc phản ánh theo trạng thái"
              />

              <ManagerSelectMenu
                value={categoryFilter}
                onChange={(value) => updateFilters({ categoryFilter: value, page: 1 })}
                options={categoryOptions}
                placeholder="Tất cả danh mục"
                ariaLabel="Lọc phản ánh theo danh mục"
              />

              <ManagerSelectMenu
                value={locationFilter}
                onChange={(value) => updateFilters({ locationFilter: value, page: 1 })}
                options={locationOptions}
                placeholder="Tất cả vị trí"
                ariaLabel="Lọc phản ánh theo vị trí"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <FeedbackTableSkeleton />
        ) : error ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Lucide.WifiOff size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-slate-100">Không thể tải danh sách phản ánh</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{error}</p>
            <button type="button" onClick={fetchFeedbacks} className="btn btn-outline mt-5 h-10 rounded-xl text-sm">
              <Lucide.RefreshCcw size={15} />
              Thử lại
            </button>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Lucide.MessageSquare size={24} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-slate-100">Không tìm thấy phản ánh phù hợp</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              {hasActiveListFilters
                ? 'Thử xóa từ khóa hoặc chọn bộ lọc khác.'
                : 'Danh sách chưa có dữ liệu để hiển thị.'}
            </p>
            {hasActiveListFilters && (
              <button
                type="button"
                onClick={() => updateFilters({ search: '', status: 'all', group: 'total', categoryFilter: 'all', locationFilter: 'all', page: 1 })}
                className="btn btn-outline mt-5 h-10 rounded-xl border-slate-300 px-4 text-sm dark:border-slate-700"
              >
                <Lucide.RotateCcw size={15} />
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="table w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[30%]" />
                <col className="w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-[0.04em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="whitespace-nowrap px-4 py-4">Mã</th>
                  <th className="px-4 py-4">Nội dung</th>
                  <th className="px-4 py-4">Danh mục</th>
                  <th className="whitespace-nowrap px-4 py-4">Ưu tiên</th>
                  <th className="whitespace-nowrap px-4 py-4">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-4">Ngày tạo</th>
                  <th className="whitespace-nowrap px-4 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFeedbacks.map((feedback) => {
                  const feedbackId = feedback.feedbackId || feedback.id;
                  return (
                    <tr
                      key={feedbackId}
                      data-admin-feedback-id={String(feedbackId)}
                      className={`cursor-pointer transition ${
                        String(highlightedFeedbackId) === String(feedbackId)
                          ? 'bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/70'
                      }`}
                      onClick={() => handleOpenFeedbackDetail(feedback)}
                      onMouseEnter={() => prefetchAdminFeedbackDetail(feedbackId)}
                      onFocus={() => prefetchAdminFeedbackDetail(feedbackId)}
                      onPointerDown={() => prefetchAdminFeedbackDetail(feedbackId)}
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-blue-700 dark:text-blue-300">{formatFeedbackId(feedbackId)}</td>
                      <td className="min-w-0 px-4 py-4">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{feedback.title || 'Không có tiêu đề'}</p>
                        <p
                          className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                          title={getLocationText(feedback)}
                        >
                          {getLocationText(feedback)}
                        </p>
                        {feedback.locationText && getAreaName(feedback) ? (
                          <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {getAreaName(feedback)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300"><span className="block truncate" title={getCategoryName(feedback, categories)}>{getCategoryName(feedback, categories)}</span></td>
                      <td className="whitespace-nowrap px-4 py-4"><PriorityBadge priority={feedback.priority} /></td>
                      <td className="whitespace-nowrap px-4 py-4"><StatusBadge status={feedback.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(feedback.createdAt)}</td>
                      <td className="px-3 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Xóa phản ánh"
                            aria-label={`Xóa phản ánh ${formatFeedbackId(feedbackId)}`}
                            disabled={Boolean(deletingFeedbackId)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onFocus={(event) => event.stopPropagation()}
                            onClick={(event) => handleRequestFeedbackDelete(event, feedback)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingFeedbackId === String(feedbackId) ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" aria-hidden="true" />
                            ) : (
                              <Lucide.Trash2 size={16} aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenFeedbackDetail(feedback);
                            }}
                            className="btn btn-ghost h-9 min-h-0 whitespace-nowrap rounded-xl px-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pagination.totalItems > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Trang <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.pageNumber}</span> / {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPreviousPage || refreshing}
                onClick={() => updateFilters({ page: Math.max(1, pageNumber - 1) })}
                className="btn btn-outline h-10 min-h-0 rounded-xl border-slate-300 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                <Lucide.ChevronLeft size={16} />
                Trước
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
                  .filter((page) => (
                    page === 1 ||
                    page === pagination.totalPages ||
                    Math.abs(page - pagination.pageNumber) <= 1
                  ))
                  .map((page, index, pages) => {
                    const previousPage = pages[index - 1];
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {previousPage && page - previousPage > 1 && (
                          <span className="px-1 text-sm text-slate-400">…</span>
                        )}
                        <button
                          type="button"
                          onClick={() => updateFilters({ page })}
                          disabled={refreshing}
                          aria-current={page === pagination.pageNumber ? 'page' : undefined}
                          className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
                            page === pagination.pageNumber
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                              : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={!pagination.hasNextPage || refreshing}
                onClick={() => updateFilters({ page: Math.min(pagination.totalPages, pageNumber + 1) })}
                className="btn btn-outline h-10 min-h-0 rounded-xl border-slate-300 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Sau
                <Lucide.ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {deleteSuccess ? (
        <div
          className="fixed right-4 top-20 z-[110] w-[min(420px,calc(100vw-32px))] sm:right-6"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl shadow-slate-900/10 dark:border-emerald-900 dark:bg-slate-950">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Lucide.CheckCircle2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">Xóa thành công</p>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{deleteSuccess}</p>
              </div>
              <button
                type="button"
                onClick={handleDismissDeleteSuccess}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Đóng thông báo"
              >
                <Lucide.X size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackToDelete ? (
        <div
          ref={deleteDialogRef}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-feedback-title"
          aria-describedby="delete-feedback-description"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-[2px]"
            onClick={handleCloseDeleteDialog}
            aria-label="Đóng hộp thoại xóa phản ánh"
            tabIndex={-1}
          />

          <div className="relative w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
                  <Lucide.Trash2 size={20} />
                </span>
                <div className="min-w-0">
                  <h3 id="delete-feedback-title" className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                    Xóa vĩnh viễn phản ánh
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {formatFeedbackId(feedbackToDelete.feedbackId || feedbackToDelete.id)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteDialog}
                disabled={Boolean(deletingFeedbackId)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Đóng"
              >
                <Lucide.X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div id="delete-feedback-description" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm leading-6 text-rose-800 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
                <p className="font-semibold">Hành động này không thể hoàn tác.</p>
                <p className="mt-1">
                  Phản ánh “{feedbackToDelete.title || 'Không có tiêu đề'}” sẽ bị xóa vĩnh viễn khỏi hệ thống.
                </p>
              </div>

              {deleteError ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300" role="alert">
                  <Lucide.AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="font-semibold">Chưa thể xóa phản ánh</p>
                    <p className="mt-1 leading-5">{deleteError}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={handleCloseDeleteDialog}
                disabled={Boolean(deletingFeedbackId)}
                autoFocus
                className="btn btn-outline h-11 rounded-xl border-slate-300 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmFeedbackDelete}
                disabled={Boolean(deletingFeedbackId)}
                className="btn h-11 rounded-xl border-0 bg-rose-600 px-4 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingFeedbackId ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                ) : (
                  <Lucide.Trash2 size={16} />
                )}
                {deletingFeedbackId ? 'Đang xóa...' : deleteError ? 'Thử lại' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};
