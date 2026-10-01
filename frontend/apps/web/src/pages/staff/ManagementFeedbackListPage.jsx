 
// src/pages/staff/ManagementFeedbackListPage.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { toolsApi } from '@urbanmind/shared-api';
import { managementTypes } from '@urbanmind/shared-types';
import { EmptyState, LoadingSpinner } from '@urbanmind/shared-ui';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import Button from '../../components/design-system/Button';
import { getCategoryLabel } from '../../utils/categoryLabels';
import * as Lucide from 'lucide-react';

const STAFF_FEEDBACK_LIST_RETURN_KEY = 'staff-feedback-list-return';

const readStaffFeedbackListReturn = () => {
  try {
    const raw = sessionStorage.getItem(STAFF_FEEDBACK_LIST_RETURN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};


const getFeedbackAreaName = (item) => (
  item?.areaName ||
  item?.wardName ||
  item?.area?.areaName ||
  item?.area?.name ||
  ''
);

const getFeedbackLocationText = (item) => (
  item?.locationText ||
  getFeedbackAreaName(item) ||
  ''
);

const hasPreciseLocation = (item = {}) => {
  const latitude = item?.latitude ?? item?.lat ?? item?.location?.latitude ?? item?.location?.lat;
  const longitude = item?.longitude ?? item?.lng ?? item?.long ?? item?.location?.longitude ?? item?.location?.lng;

  return latitude !== null &&
    latitude !== undefined &&
    latitude !== '' &&
    longitude !== null &&
    longitude !== undefined &&
    longitude !== '' &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));
};

const FilterDropdown = ({
  menuId,
  value,
  options,
  onChange,
  label,
  openMenu,
  setOpenMenu,
}) => {
  const isOpen = openMenu === menuId;
  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  ) || options[0];

  return (
    <div className="relative min-w-0" data-staff-feedback-filter>
      <button
        type="button"
        onClick={() => setOpenMenu(isOpen ? null : menuId)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="min-w-0 flex-1 truncate text-left">{selectedOption?.label}</span>
        <Lucide.ChevronDown
          size={15}
          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);

            return (
              <button
                key={String(option.value || 'all')}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpenMenu(null);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <span>{option.label}</span>
                {isSelected ? <Lucide.Check size={15} className="shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default function ManagementFeedbackListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [initialReturnSnapshot] = useState(() => readStaffFeedbackListReturn());
  const initialReturnSnapshotRef = useRef(initialReturnSnapshot);
  const rowRefs = useRef(new Map());
  const restoreHandledRef = useRef(false);
  const skipInitialFilterResetRef = useRef(Boolean(initialReturnSnapshot));

  const [feedbacks, setFeedbacks] = useState(() => (
    Array.isArray(initialReturnSnapshot?.feedbacks) ? initialReturnSnapshot.feedbacks : []
  ));
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(() => !Array.isArray(initialReturnSnapshot?.feedbacks));
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState(() => initialReturnSnapshot?.search || '');
  const [status, setStatus] = useState(() => initialReturnSnapshot?.status || '');
  const [categoryId, setCategoryId] = useState(() => initialReturnSnapshot?.categoryId || '');
  const [locationFilter, setLocationFilter] = useState(() => initialReturnSnapshot?.locationFilter || 'all');

  const normalizeStatusValue = useCallback((value) => {
    if (!value) return '';
    const normalized = String(value).trim();
    if (normalized === managementTypes.feedbackStatus.AI_REVIEWED) return managementTypes.feedbackStatus.AI_REVIEWED;
    if (normalized.toLowerCase() === 'aireviewed' || normalized.toLowerCase() === 'ai reviewed' || normalized.toLowerCase() === 'ai_reviewed') {
      return managementTypes.feedbackStatus.AI_REVIEWED;
    }
    return normalized;
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(() => Number(initialReturnSnapshot?.currentPage) || 1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(() => Number(initialReturnSnapshot?.totalCount) || 0);
  const [workflowTotals, setWorkflowTotals] = useState(() => (
    initialReturnSnapshot?.workflowTotals && typeof initialReturnSnapshot.workflowTotals === 'object'
      ? initialReturnSnapshot.workflowTotals
      : {}
  ));
  const [workflowTotalsLoading, setWorkflowTotalsLoading] = useState(() => !initialReturnSnapshot?.workflowTotals);
  const [restoredFeedbackId, setRestoredFeedbackId] = useState('');
  const [openFilterMenu, setOpenFilterMenu] = useState(null);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await toolsApi.getCategories();
        setCategories(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (!openFilterMenu) return undefined;

    const handlePointerDown = (event) => {
      if (!event.target.closest('[data-staff-feedback-filter]')) {
        setOpenFilterMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openFilterMenu]);

  // Fetch feedbacks
  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        pageNumber: currentPage,
        pageSize,
        search: search || undefined,
        status: normalizeStatusValue(status) || undefined,
        categoryId: categoryId || undefined,
      };

      const response = await managementFeedbackApi.getFeedbacks(params);
      const items = Array.isArray(response?.items) ? response.items : [];
      const filteredItems = items.filter((item) => {
        const normalizedStatus = normalizeStatusValue(item.status);
        const normalizedSelectedStatus = normalizeStatusValue(status);
        const matchesSearch = !search || `${item.title || ''} ${item.description || ''} ${item.feedbackId || ''}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !normalizedSelectedStatus || normalizedStatus === normalizedSelectedStatus;
        const matchesCategory = !categoryId || String(item.categoryId ?? item.category?.categoryId ?? '') === String(categoryId);
        const matchesLocation = locationFilter === 'all' ||
          (locationFilter === 'withPreciseLocation' && hasPreciseLocation(item)) ||
          (locationFilter === 'withoutPreciseLocation' && !hasPreciseLocation(item));
        return matchesSearch && matchesStatus && matchesCategory && matchesLocation;
      });

      setFeedbacks(filteredItems);
      setTotalCount(Number(response?.totalItems ?? response?.totalCount ?? filteredItems.length) || 0);
    } catch (err) {
      console.error('Failed to fetch feedbacks', err);
      setError('Không thể làm mới danh sách phản ánh. Vui lòng thử lại.');
      setFeedbacks((current) => (current.length > 0 ? current : []));
      setTotalCount((current) => current || 0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, status, categoryId, locationFilter, normalizeStatusValue]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const workflowStages = useMemo(() => [
    {
      status: managementTypes.feedbackStatus.SUBMITTED,
      title: 'Chờ AI phân loại',
      subtitle: 'Phản ánh mới đang chờ hệ thống phân tích',
      icon: Lucide.Cpu,
      iconClass: 'bg-violet-50 text-violet-600',
    },
    {
      status: managementTypes.feedbackStatus.AI_REVIEWED,
      title: 'Chờ xác minh',
      subtitle: 'AI đã phân tích, chờ nhân viên xác minh',
      icon: Lucide.ClipboardCheck,
      iconClass: 'bg-blue-50 text-blue-600',
    },
    {
      status: managementTypes.feedbackStatus.VERIFIED,
      title: 'Sẵn sàng phân công',
      subtitle: 'Đã xác minh và chờ giao đơn vị xử lý',
      icon: Lucide.UserRoundCheck,
      iconClass: 'bg-amber-50 text-amber-600',
    },
    {
      status: managementTypes.feedbackStatus.ASSIGNED,
      title: 'Đã phân công',
      subtitle: 'Đã giao cho đơn vị hoặc đội xử lý',
      icon: Lucide.UserRoundCog,
      iconClass: 'bg-cyan-50 text-cyan-600',
    },
    {
      status: managementTypes.feedbackStatus.IN_PROGRESS,
      title: 'Đang xử lý',
      subtitle: 'Đơn vị phụ trách đang thực hiện xử lý',
      icon: Lucide.Wrench,
      iconClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      status: managementTypes.feedbackStatus.RESOLVED,
      title: 'Hoàn thành',
      subtitle: 'Đã ghi nhận kết quả xử lý',
      icon: Lucide.CircleCheckBig,
      iconClass: 'bg-teal-50 text-teal-600',
    },
    {
      status: managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
      title: 'Chờ duyệt',
      subtitle: 'Kết quả đang chờ quản lý xét duyệt',
      icon: Lucide.BadgeCheck,
      iconClass: 'bg-fuchsia-50 text-fuchsia-600',
    },
    {
      status: managementTypes.feedbackStatus.APPROVED,
      title: 'Đã duyệt',
      subtitle: 'Kết quả xử lý đã được phê duyệt',
      icon: Lucide.ShieldCheck,
      iconClass: 'bg-green-50 text-green-600',
    },
    {
      status: managementTypes.feedbackStatus.NEED_REWORK,
      title: 'Cần sửa lại',
      subtitle: 'Kết quả được yêu cầu xử lý lại',
      icon: Lucide.RotateCcw,
      iconClass: 'bg-orange-50 text-orange-600',
    },
    {
      status: managementTypes.feedbackStatus.REJECTED,
      title: 'Bị từ chối',
      subtitle: 'Phản ánh hoặc kết quả đã bị từ chối',
      icon: Lucide.CircleX,
      iconClass: 'bg-rose-50 text-rose-600',
    },
    {
      status: managementTypes.feedbackStatus.CLOSED,
      title: 'Đã đóng',
      subtitle: 'Hồ sơ đã kết thúc quy trình',
      icon: Lucide.Archive,
      iconClass: 'bg-slate-100 text-slate-600',
    },
    {
      status: managementTypes.feedbackStatus.CANCELLED,
      title: 'Đã hủy',
      subtitle: 'Hồ sơ đã được hủy',
      icon: Lucide.Ban,
      iconClass: 'bg-red-50 text-red-600',
    },
  ], []);

  const fetchWorkflowTotals = useCallback(async () => {
    setWorkflowTotalsLoading(true);
    try {
      const entries = await Promise.all(
        workflowStages.map(async (stage) => {
          const response = await managementFeedbackApi.getFeedbacks({
            pageNumber: 1,
            pageSize: 1,
            status: normalizeStatusValue(stage.status),
          });

          const total = Number(response?.totalItems ?? response?.totalCount ?? 0) || 0;
          return [stage.status, total];
        })
      );

      setWorkflowTotals(Object.fromEntries(entries));
    } catch (err) {
      console.error('Failed to fetch workflow totals', err);
      setWorkflowTotals({});
    } finally {
      setWorkflowTotalsLoading(false);
    }
  }, [workflowStages, normalizeStatusValue]);

  useEffect(() => {
    fetchWorkflowTotals();
  }, [fetchWorkflowTotals]);

  const primaryWorkflowStages = useMemo(
    () => workflowStages.slice(0, 6),
    [workflowStages]
  );

  const secondaryWorkflowStages = useMemo(
    () => workflowStages.slice(6).filter((stage) => (
      workflowTotalsLoading
      || Number(workflowTotals[stage.status] || 0) > 0
      || normalizeStatusValue(status) === normalizeStatusValue(stage.status)
    )),
    [workflowStages, workflowTotals, workflowTotalsLoading, status, normalizeStatusValue]
  );

  const handleWorkflowFilter = useCallback((stageStatus) => {
    setSearch('');
    setCategoryId('');
    setStatus((currentStatus) => (
      normalizeStatusValue(currentStatus) === normalizeStatusValue(stageStatus)
        ? ''
        : stageStatus
    ));
    setCurrentPage(1);
  }, [normalizeStatusValue]);

  // Reset pagination only after the restored list state has mounted.
  // Without this guard, returning to page 2/3 first scrolls to the saved row,
  // then this mount effect forces page 1 and makes the view jump back up.
  useEffect(() => {
    if (skipInitialFilterResetRef.current) {
      skipInitialFilterResetRef.current = false;
      return;
    }

    setCurrentPage(1);
  }, [search, status, categoryId, locationFilter]);

  const categoryFilterOptions = useMemo(() => [
    { value: '', label: 'Tất cả danh mục' },
    ...categories.map((category) => ({
      value: category.id || category.categoryId,
      label: getCategoryLabel(
        category.name || category.categoryName || category.categoryType || category.type
      ),
    })),
  ], [categories]);

  const systemTotalCount = useMemo(() => {
    const total = Object.values(workflowTotals).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );

    return total > 0 ? total : totalCount;
  }, [workflowTotals, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalCount);

  const getStatusClass = (s) => {
    if (!s) return 'border-slate-200 bg-slate-50 text-slate-700';
    const key = String(s).trim().toLowerCase();
    switch (key) {
      case managementTypes.feedbackStatus.AI_REVIEWED.toLowerCase():
      case 'aireviewed':
      case 'ai reviewed':
      case 'ai_reviewed':
        return 'border-violet-200 bg-violet-50 text-violet-700';
      case 'submitted':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case managementTypes.feedbackStatus.VERIFIED.toLowerCase():
      case 'verified':
        return 'border-sky-200 bg-sky-50 text-sky-700';
      case managementTypes.feedbackStatus.ASSIGNED.toLowerCase():
      case 'assigned':
        return 'border-cyan-200 bg-cyan-50 text-cyan-700';
      case 'inprogress':
      case 'in progress':
      case managementTypes.feedbackStatus.IN_PROGRESS.toLowerCase():
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'waitingcitizen':
      case 'waiting citizen':
      case managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL.toLowerCase():
      case 'submittedforapproval':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case managementTypes.feedbackStatus.NEED_REWORK.toLowerCase():
      case 'needrework':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case managementTypes.feedbackStatus.APPROVED.toLowerCase():
      case 'approved':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'resolved':
        return 'border-teal-200 bg-teal-50 text-teal-700';
      case 'closed':
        return 'border-slate-200 bg-slate-50 text-slate-700';
      case 'rejected':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'duplicate':
        return 'border-slate-200 bg-slate-50 text-slate-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  const getPriorityClass = (p) => {
    if (!p) return 'badge-priority-low';
    const key = String(p).trim().toLowerCase();
    switch (key) {
      case 'critical': return 'badge-priority-critical';
      case 'high': return 'badge-priority-high';
      case 'medium': return 'badge-priority-medium';
      case 'low': return 'badge-priority-low';
      default: return 'badge-priority-low';
    }
  };

  const getStatusLabel = (s) => {
    const normalizedStatus = normalizeStatusValue(s);
    const labels = {
      [managementTypes.feedbackStatus.SUBMITTED]: 'Đã gửi',
      [managementTypes.feedbackStatus.AI_REVIEWED]: 'AI đã xem xét',
      [managementTypes.feedbackStatus.VERIFIED]: 'Đã xác minh',
      [managementTypes.feedbackStatus.ASSIGNED]: 'Đã giao',
      [managementTypes.feedbackStatus.IN_PROGRESS]: 'Đang xử lý',
      [managementTypes.feedbackStatus.RESOLVED]: 'Hoàn thành',
      [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: 'Chờ duyệt',
      [managementTypes.feedbackStatus.APPROVED]: 'Đã duyệt',
      [managementTypes.feedbackStatus.REJECTED]: 'Bị từ chối',
      [managementTypes.feedbackStatus.NEED_REWORK]: 'Cần sửa lại',
      [managementTypes.feedbackStatus.CLOSED]: 'Đã đóng',
      [managementTypes.feedbackStatus.CANCELLED]: 'Đã hủy',
    };
    return labels[normalizedStatus] || normalizedStatus;
  };

  const statusFilterOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    ...Object.values(managementTypes.feedbackStatus).map((value) => ({
      value,
      label: getStatusLabel(value),
    })),
  ];

  const getPriorityLabel = (p) => {
    const labels = {
      'Low': 'Thấp',
      'Medium': 'Trung bình',
      'High': 'Cao',
      'Urgent': 'Khẩn cấp',
      'Critical': 'Khẩn cấp',
    };
    return labels[p] || p;
  };

  const formatFeedbackId = (value) => {
    if (!value) return '—';
    const id = String(value);
    if (id.length <= 14) return id;
    return `${id.slice(0, 8)}…${id.slice(-5)}`;
  };

  const getAssignedUnitName = (item) => {
    const assignedName = item?.assignment?.operatorName
      || item?.assignment?.providerName
      || item?.assignment?.coordinatorName
      || item?.assignment?.assignedTo
      || item?.assignment?.assignedToName
      || item?.assignment?.assignee
      || item?.assignment?.assigneeName
      || item?.operatorName
      || item?.assignedOperatorName
      || item?.providerName
      || item?.coordinatorName
      || item?.assigneeName
      || item?.assignedToName
      || item?.assignedTo
      || '';

    if (assignedName) return assignedName;

    const assignedStatuses = new Set([
      managementTypes.feedbackStatus.ASSIGNED,
      managementTypes.feedbackStatus.IN_PROGRESS,
      managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
      managementTypes.feedbackStatus.APPROVED,
      managementTypes.feedbackStatus.RESOLVED,
      managementTypes.feedbackStatus.CLOSED,
    ]);

    return assignedStatuses.has(normalizeStatusValue(item?.status))
      ? 'Đã phân công'
      : 'Chưa phân công';
  };

  const openFeedbackDetail = useCallback((feedbackId) => {
    const scrollContainer = document.querySelector('[data-dashboard-scroll-container]');
    const snapshot = {
      feedbackId: String(feedbackId),
      currentPage,
      search,
      status,
      categoryId,
      locationFilter,
      scrollY: scrollContainer?.scrollTop || 0,
      feedbacks,
      totalCount,
      workflowTotals,
    };

    sessionStorage.setItem(STAFF_FEEDBACK_LIST_RETURN_KEY, JSON.stringify(snapshot));

    // Mark the current list history entry before opening detail.
    // DashboardLayout already respects preserveScrollOnEnter, so Browser Back
    // will not be overwritten by its delayed route scroll reset.
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: {
        ...(location.state || {}),
        restoreFeedbackId: String(feedbackId),
        preserveScrollOnEnter: true,
      },
    });

    navigate(`/staff/feedbacks/${feedbackId}`, {
      state: {
        fromStaffFeedbackList: true,
        feedbackId: String(feedbackId),
      },
    });
  }, [
    navigate,
    location.pathname,
    location.search,
    location.hash,
    location.state,
    currentPage,
    search,
    status,
    categoryId,
    locationFilter,
    feedbacks,
    totalCount,
    workflowTotals,
  ]);

  useEffect(() => {
    if (loading || restoreHandledRef.current) return undefined;

    const snapshot = initialReturnSnapshotRef.current;
    const targetFeedbackId = String(
      location.state?.restoreFeedbackId
      || snapshot?.feedbackId
      || ''
    );

    if (!targetFeedbackId) {
      restoreHandledRef.current = true;
      return undefined;
    }

    let cancelled = false;
    let retryCount = 0;
    let retryTimer;
    let clearHighlightTimer;

    const finishRestore = () => {
      sessionStorage.removeItem(STAFF_FEEDBACK_LIST_RETURN_KEY);
      initialReturnSnapshotRef.current = null;
      restoreHandledRef.current = true;
    };

    const restoreRow = () => {
      if (cancelled) return;

      const targetRow = rowRefs.current.get(targetFeedbackId);
      const scrollContainer = document.querySelector('[data-dashboard-scroll-container]');

      if (!targetRow || !scrollContainer) {
        retryCount += 1;
        if (retryCount < 20) {
          retryTimer = window.setTimeout(restoreRow, 60);
          return;
        }

        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: Number(snapshot?.scrollY) || 0,
            left: 0,
            behavior: 'auto',
          });
        }
        finishRestore();
        return;
      }

      requestAnimationFrame(() => {
        if (cancelled) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const rowRect = targetRow.getBoundingClientRect();
        const rowTopInContainer = scrollContainer.scrollTop + rowRect.top - containerRect.top;
        const centeredTop = Math.max(
          0,
          rowTopInContainer - Math.max(
            24,
            (scrollContainer.clientHeight - targetRow.offsetHeight) / 2
          )
        );

        scrollContainer.scrollTo({
          top: centeredTop,
          left: 0,
          behavior: 'auto',
        });

        setRestoredFeedbackId(targetFeedbackId);
        clearHighlightTimer = window.setTimeout(() => {
          setRestoredFeedbackId('');
        }, 2200);

        finishRestore();
      });
    };

    restoreRow();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (clearHighlightTimer) window.clearTimeout(clearHighlightTimer);
    };
  }, [loading, feedbacks, location.state]);

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setCategoryId('');
    setLocationFilter('all');
    setCurrentPage(1);
  };

  if (loading && feedbacks.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && feedbacks.length === 0) {
    return (
      <div className="space-y-4">
        <ErrorAlert 
          title="Lỗi tải danh sách"
          message={error || 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.'}
        />
        <Button
          type="button"
          onClick={fetchFeedbacks}
          variant="primary"
          size="sm"
          className="rounded-lg"
        >
          <Lucide.RefreshCw size={16} />
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-page-shell space-y-6">
      {loading && feedbacks.length > 0 ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          Đang làm mới
        </div>
      ) : null}
      <section className="admin-page-hero">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-cyan-100/50 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="admin-hero-icon">
              <Lucide.ClipboardList size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="admin-hero-title">Quản lý phản ánh</h1>
              <p className="admin-hero-description">
                Theo dõi tiến độ, trạng thái và điều phối các phản ánh trong một danh sách thống nhất.
              </p>
            </div>
          </div>

          <div className="min-w-[220px] rounded-[24px] border border-emerald-200 bg-emerald-50/90 px-5 py-4 shadow-[0_10px_28px_rgba(16,185,129,0.08)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Tổng phản ánh
            </div>
            <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-slate-950">
              {systemTotalCount}
              <span className="ml-2 text-base font-semibold tracking-normal text-slate-700">phản ánh</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {primaryWorkflowStages.map((card) => {
            const CardIcon = card.icon;
            const active = normalizeStatusValue(status) === normalizeStatusValue(card.status);
            const count = workflowTotals[card.status] ?? 0;

            return (
              <button
                key={card.status}
                type="button"
                onClick={() => handleWorkflowFilter(card.status)}
                aria-pressed={active}
                className={`admin-stat-card h-[178px] p-5 text-left transition-all duration-200 ${
                  active
                    ? 'border-blue-300 bg-blue-50/80 shadow-[0_12px_28px_rgba(37,99,235,0.10)] ring-2 ring-blue-100'
                    : 'hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
                }`}
              >
                <div className="flex h-full flex-col">
                  <div className="grid grid-cols-[minmax(0,1fr)_40px] items-start gap-3">
                    <div className="min-w-0">
                      <div className={`flex min-h-10 items-start text-sm font-semibold leading-5 ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                        {card.title}
                      </div>
                      <div className="mt-2 text-3xl font-semibold leading-none text-slate-950">
                        {workflowTotalsLoading ? '—' : count}
                      </div>
                    </div>

                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.iconClass}`}>
                      <CardIcon size={18} aria-hidden="true" />
                    </span>
                  </div>

                  <p className="mt-auto pt-4 text-sm leading-5 text-slate-500">{card.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {secondaryWorkflowStages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm sm:grid-cols-3 xl:grid-cols-6">
            {secondaryWorkflowStages.map((card) => {
              const CardIcon = card.icon;
              const active = normalizeStatusValue(status) === normalizeStatusValue(card.status);
              const count = workflowTotals[card.status] ?? 0;

              return (
                <button
                  key={card.status}
                  type="button"
                  onClick={() => handleWorkflowFilter(card.status)}
                  aria-pressed={active}
                  className={`flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                    active
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700'
                  }`}
                >
                  <CardIcon size={14} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">{card.title}</span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                    {workflowTotalsLoading ? '—' : count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Danh sách phản ánh</h2>
              <p className="mt-1 text-sm text-slate-500">
                {totalCount > 0 ? `Đang hiển thị ${startIdx}–${endIdx} trong tổng số ${totalCount} phản ánh.` : 'Chưa có phản ánh phù hợp.'}
              </p>
            </div>

          </div>

          <div className="mt-4 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1.5fr)_200px_200px_220px_auto]">
              <label className="relative block min-w-0 flex-1 xl:w-full">
                <span className="sr-only">Tìm kiếm phản ánh</span>
                <Lucide.Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo mã, tiêu đề, mô tả..."
                  className="input h-11 w-full rounded-xl border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-300 focus:outline-none"
                />
              </label>

              <FilterDropdown
                menuId="status"
                value={status}
                options={statusFilterOptions}
                onChange={(value) => setStatus(value)}
                label="Lọc theo trạng thái"
                openMenu={openFilterMenu}
                setOpenMenu={setOpenFilterMenu}
              />

              <FilterDropdown
                menuId="category"
                value={categoryId}
                options={categoryFilterOptions}
                onChange={(value) => setCategoryId(value)}
                label="Lọc theo danh mục"
                openMenu={openFilterMenu}
                setOpenMenu={setOpenFilterMenu}
              />

              <FilterDropdown
                menuId="location"
                value={locationFilter}
                options={[
                  { value: 'all', label: 'Tất cả vị trí' },
                  { value: 'withPreciseLocation', label: 'Có tọa độ chính xác' },
                  { value: 'withoutPreciseLocation', label: 'Chưa có tọa độ chính xác' },
                ]}
                onChange={(value) => {
                  setLocationFilter(value);
                  setCurrentPage(1);
                }}
                label="Lọc theo vị trí"
                openMenu={openFilterMenu}
                setOpenMenu={setOpenFilterMenu}
              />

              <Button
                type="button"
                onClick={handleResetFilters}
                variant="outline"
                size="sm"
                className="h-11 whitespace-nowrap rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-sm"
              >
                <Lucide.RotateCcw size={15} aria-hidden="true" />
                Xóa bộ lọc
              </Button>
            </div>
          </div>

        {feedbacks.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-6">
            <EmptyState
              title="Chưa có phản ánh"
              description="Không có dữ liệu phù hợp với bộ lọc hiện tại."
            />
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="table w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[26%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[7%]" />
              </colgroup>

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  <th className="whitespace-nowrap px-4 py-[18px]">Mã</th>
                  <th className="px-4 py-[18px]">Nội dung</th>
                  <th className="px-4 py-[18px]">Danh mục</th>
                  <th className="px-4 py-[18px]">Đơn vị xử lý</th>
                  <th className="whitespace-nowrap px-4 py-[18px]">Ưu tiên</th>
                  <th className="whitespace-nowrap px-4 py-[18px]">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-[18px]">Ngày tạo</th>
                  <th className="px-3 py-4 text-right"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {feedbacks.map((item) => {
                  const feedbackId = item.feedbackId || item.id;
                  const parentFeedbackId = item.parentTicketId || item.parentFeedbackId || null;
                  const isConfirmedDuplicate = Boolean(parentFeedbackId);
                  return (
                    <tr
                      key={feedbackId}
                      ref={(node) => {
                        const key = String(feedbackId);
                        if (node) rowRefs.current.set(key, node);
                        else rowRefs.current.delete(key);
                      }}
                      tabIndex={0}
                      role="button"
                      onClick={() => openFeedbackDetail(feedbackId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openFeedbackDetail(feedbackId);
                        }
                      }}
                      className={`cursor-pointer transition-colors duration-500 hover:bg-slate-50/80 focus-visible:bg-blue-50 focus-visible:outline-none ${
                        restoredFeedbackId === String(feedbackId) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-[18px]">
                        <span
                          title={String(feedbackId || '')}
                          className="block truncate font-semibold text-blue-700"
                        >
                          {formatFeedbackId(feedbackId)}
                        </span>
                        {isConfirmedDuplicate ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600">
                            <Lucide.GitMerge size={11} aria-hidden="true" />
                            Trùng lặp
                          </span>
                        ) : null}
                      </td>

                      <td className="min-w-0 px-4 py-[18px]">
                        <p
                          className="truncate font-semibold text-slate-900"
                          title={item.title || 'Không có tiêu đề'}
                        >
                          {item.title || 'Không có tiêu đề'}
                        </p>
                        <div className="mt-1 min-w-0 text-xs text-slate-500">
                          <p
                            className="truncate"
                            title={getFeedbackLocationText(item) || item.description || ''}
                          >
                            {getFeedbackLocationText(item) || item.description || 'Chưa xác định vị trí'}
                          </p>
                          {item.locationText && getFeedbackAreaName(item) ? (
                            <p
                              className="mt-0.5 truncate text-[11px] text-slate-400"
                              title={getFeedbackAreaName(item)}
                            >
                              {getFeedbackAreaName(item)}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-[18px] text-slate-600">
                        <span
                          className="block truncate"
                          title={getCategoryLabel(
                            item.categoryName || item.category?.name || item.categoryType || item.type,
                            'Chưa phân loại'
                          )}
                        >
                          {getCategoryLabel(
                            item.categoryName || item.category?.name || item.categoryType || item.type,
                            'Chưa phân loại'
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-[18px] text-slate-600">
                        <span className="block truncate" title={getAssignedUnitName(item)}>
                          {getAssignedUnitName(item)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-[18px]">
                        <span className={`${getPriorityClass(item.priority)} inline-flex rounded-full px-2.5 py-1 text-xs font-semibold`}>
                          {getPriorityLabel(item.priority)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-[18px]">
                        <span className={`${getStatusClass(item.status)} inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-[18px] text-xs text-slate-500">
                        <span className="block font-medium text-slate-600">{new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="mt-0.5 block">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                      </td>

                      <td className="px-2 py-[18px] text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Xem chi tiết"
                            aria-label="Xem chi tiết"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFeedbackDetail(feedbackId);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-blue-700 transition hover:bg-blue-50"
                          >
                            <Lucide.ChevronRight size={17} aria-hidden="true" />
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

        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-slate-500">Trang <span className="font-semibold text-slate-700">{currentPage}</span> / {totalPages} · Hiển thị <span className="font-semibold text-slate-700">{startIdx}–{endIdx}</span> trên {totalCount}</p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="h-10 rounded-xl"
              >
                <Lucide.ChevronLeft size={15} aria-hidden="true" />
                Trước
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((page) => (
                    page === 1
                    || page === totalPages
                    || Math.abs(page - currentPage) <= 1
                  ))
                  .map((page, index, pages) => {
                    const previousPage = pages[index - 1];

                    return (
                      <div key={page} className="flex items-center gap-1">
                        {previousPage && page - previousPage > 1 ? (
                          <span className="px-1 text-sm text-slate-400">…</span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          aria-current={page === currentPage ? 'page' : undefined}
                          className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
                            page === currentPage
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                              : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <Button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                className="h-10 rounded-xl"
              >
                Sau
                <Lucide.ChevronRight size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
