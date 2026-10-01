import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import {
  managementTypes,
} from '@urbanmind/shared-types';
import { toolsApi } from '@urbanmind/shared-api';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import {
  ManagerEmptyState,
  ManagerListRefreshIndicator,
  ManagerMetricCard,
  ManagerPageHeader,
} from '../../components/manager/ManagerPageElements';
import { getScopedSessionKey } from '../../utils/scopedSessionKey';

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: managementTypes.feedbackStatus.SUBMITTED, label: 'Đã gửi' },
  { value: managementTypes.feedbackStatus.AI_REVIEWED, label: 'AI đã phân loại' },
  { value: managementTypes.feedbackStatus.VERIFIED, label: 'Đã xác minh' },
  { value: managementTypes.feedbackStatus.ASSIGNED, label: 'Đã phân công' },
  { value: managementTypes.feedbackStatus.IN_PROGRESS, label: 'Đang xử lý' },
  {
    value: managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
    label: 'Chờ phê duyệt',
  },
  { value: managementTypes.feedbackStatus.NEED_REWORK, label: 'Cần làm lại' },
  { value: managementTypes.feedbackStatus.APPROVED, label: 'Đã duyệt' },
  { value: managementTypes.feedbackStatus.REJECTED, label: 'Bị từ chối' },
  { value: managementTypes.feedbackStatus.CLOSED, label: 'Đã đóng' },
  { value: managementTypes.feedbackStatus.CANCELLED, label: 'Đã hủy' },
];

const priorityOptions = [
  { value: 'all', label: 'Tất cả ưu tiên' },
  { value: 'Urgent', label: 'Khẩn cấp' },
  { value: 'High', label: 'Cao' },
  { value: 'Medium', label: 'Trung bình' },
  { value: 'Low', label: 'Thấp' },
];

const pageSizeOptions = [10, 20, 50];

const getAreaId = (area) => area?.areaId ?? area?.id ?? area?.value ?? '';
const getAreaName = (area) => area?.areaName ?? area?.name ?? area?.label ?? '';

const buildAreaOptions = (areas) => [
  { value: 'all', label: 'Tất cả phường' },
  ...areas
    .map((area) => ({
      value: String(getAreaId(area)),
      label: getAreaName(area),
    }))
    .filter((option) => option.value && option.label)
    .sort((left, right) => left.label.localeCompare(right.label, 'vi')),
];

const MONITOR_INITIAL_FETCH_SIZE = 100;
const MONITOR_BACKGROUND_PAGE_SIZE = 100;
const INTERACTION_LIST_SNAPSHOT_KEY_BASE = 'urbanservice-manager-interaction-list-snapshot-v2';
const INTERACTION_RETURN_STORAGE_KEY_BASE = 'urbanservice-manager-interaction-return-v2';
const INTERACTION_SNAPSHOT_TTL = 5 * 60 * 1000;

const readInteractionSnapshot = (queryKey, storageKey) => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const snapshot = JSON.parse(raw);
    if (!snapshot || !Array.isArray(snapshot.tickets)) return null;
    if (snapshot.queryKey !== queryKey) return null;

    if (Date.now() - Number(snapshot.savedAt || 0) > INTERACTION_SNAPSHOT_TTL) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
};

const writeInteractionSnapshot = (storageKey, snapshot) => {
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ ...snapshot, savedAt: Date.now() }),
    );
  } catch (error) {
    console.warn('Không thể lưu trạng thái danh sách phản ánh', error);
  }
};

const readInteractionReturnContext = (storageKey) => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};


const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không xác định';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${hours}:${minutes} ${day}/${month}/${year}`;
};

const formatFeedbackCode = (value) => {
  const compact = String(value || '').replace(/-/g, '').toUpperCase();
  return compact ? `UM-${compact.slice(0, 8)}` : 'UM-UNKNOWN';
};

const normalizeKey = (value) =>
  String(value ?? '').replace(/[-_\s]/g, '').toLowerCase();

const normalizeSearchText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const getSearchDateTokens = (value) => {
  if (!value) return [];

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return [];

  const day = String(date.getDate());
  const day2 = day.padStart(2, '0');
  const month = String(date.getMonth() + 1);
  const month2 = month.padStart(2, '0');
  const year = String(date.getFullYear());
  const year2 = year.slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return [
    `${day}/${month}`,
    `${day2}/${month2}`,
    `${day}/${month}/${year2}`,
    `${day2}/${month2}/${year2}`,
    `${day}/${month}/${year}`,
    `${day2}/${month2}/${year}`,
    `${hours}:${minutes}`,
    `${hours}:${minutes} ${day2}/${month2}/${year2}`,
  ];
};

const getFeedbackSearchText = (ticket) => {
  const statusMeta = STATUS_META[normalizeKey(ticket?.status)];
  const priorityMeta = PRIORITY_META[normalizeKey(ticket?.priority)];
  const feedbackId = ticket?.feedbackId || ticket?.id;

  return normalizeSearchText([
    feedbackId,
    formatFeedbackCode(feedbackId),
    ticket?.title,
    ticket?.content,
    ticket?.description,
    ticket?.summary,
    ticket?.message,
    ticket?.senderName,
    ticket?.reporterName,
    ticket?.citizenName,
    ticket?.fullName,
    ticket?.email,
    ticket?.phoneNumber,
    ticket?.areaName,
    ticket?.wardName,
    ticket?.locationText,
    ticket?.address,
    ticket?.categoryName,
    ticket?.status,
    statusMeta?.label,
    ticket?.priority,
    priorityMeta?.label,
    ...getSearchDateTokens(ticket?.createdAt),
    ...getSearchDateTokens(ticket?.updatedAt),
  ].filter(Boolean).join(' | '));
};

const STATUS_META = {
  new: { label: 'Mới', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  submitted: { label: 'Mới gửi', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  aireviewed: { label: 'AI đã phân loại', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  verified: { label: 'Đã xác minh', className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  open: { label: 'Đang mở', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  underreview: { label: 'Đang xem xét', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  pending: { label: 'Chờ xử lý', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  assigned: { label: 'Đã phân công', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  inprogress: { label: 'Đang xử lý', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  resolved: { label: 'Đã xử lý', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  submittedforapproval: { label: 'Chờ phê duyệt', className: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  needrework: { label: 'Cần xử lý lại', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  approved: { label: 'Đã phê duyệt', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  rejected: { label: 'Đã từ chối', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  closed: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  cancelled: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const normalizePriorityValue = (value) => {
  const normalized = String(value || '').trim();
  return normalized === 'Critical' ? 'Urgent' : normalized;
};

const PRIORITY_META = {
  critical: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  urgent: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  high: { label: 'Cao', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  medium: { label: 'Trung bình', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  low: { label: 'Thấp', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[normalizeKey(status)] || {
    label: status || 'Chưa rõ',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const meta = PRIORITY_META[normalizeKey(priority)] || {
    label: priority || 'Chưa đặt',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const isUncategorizedFeedback = (ticket) => {
  const categoryName = String(ticket?.categoryName || '').trim().toLowerCase();
  return !ticket?.categoryId || !categoryName || categoryName === 'chưa phân loại';
};

const FilterDropdown = ({
  value,
  options,
  onChange,
  icon: Icon,
  ariaLabel,
  widthClass = 'sm:w-[190px]',
}) => {
  const detailsRef = useRef(null);
  const selectedOption =
    options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const handlePointerDown = (event) => {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target)) return;
      details.open = false;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <details ref={detailsRef} className={`group relative w-full ${widthClass}`}>
      <summary
        className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        aria-label={ariaLabel}
      >
        <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />

        <span className="min-w-0 flex-1 truncate text-left">
          {selectedOption.label}
        </span>

        <Lucide.ChevronDown
          size={15}
          className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <menu className="absolute right-0 z-[80] mt-2 w-full min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <li key={option.value}>
              <button
                type="button"
                onClick={(event) => {
                  onChange(option.value);
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>{option.label}</span>

                {isSelected ? (
                  <Lucide.Check size={15} className="shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            </li>
          );
        })}
      </menu>
    </details>
  );
};

export const InteractionHistoryMonitoring = () => {
  const { user } = useAuth();
  const interactionSnapshotKey = useMemo(
    () => getScopedSessionKey(INTERACTION_LIST_SNAPSHOT_KEY_BASE, user),
    [user],
  );
  const interactionReturnKey = useMemo(
    () => getScopedSessionKey(INTERACTION_RETURN_STORAGE_KEY_BASE, user),
    [user],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryIdFilter = searchParams.get('categoryId') || '';
  const categoryNameFilter = searchParams.get('categoryName') || '';
  const queryKey = location.search || '';

  const [initialSnapshot] = useState(() => readInteractionSnapshot(queryKey, interactionSnapshotKey));
  const [returnContext] = useState(() => {
    const stored = readInteractionReturnContext(interactionReturnKey);
    if (!stored || stored.queryKey !== queryKey) return null;
    return stored;
  });

  const [tickets, setTickets] = useState(() => initialSnapshot?.tickets || []);
  const [serverTotalItems, setServerTotalItems] = useState(() => initialSnapshot?.serverTotalItems || 0);
  const [loading, setLoading] = useState(() => !initialSnapshot);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(initialSnapshot));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState(() => initialSnapshot?.search || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => initialSnapshot?.debouncedSearch || '');
  const [statusFilter, setStatusFilter] = useState(() => initialSnapshot?.statusFilter || 'all');
  const [priorityFilter, setPriorityFilter] = useState(() => initialSnapshot?.priorityFilter || 'all');
  const [areaFilter, setAreaFilter] = useState(() => initialSnapshot?.areaFilter || 'all');
  const [areas, setAreas] = useState(() => initialSnapshot?.areas || []);
  const [metricFilter, setMetricFilter] = useState(() => initialSnapshot?.metricFilter || 'all');

  const [pageNumber, setPageNumber] = useState(() => initialSnapshot?.pageNumber || 1);
  const [pageSize, setPageSize] = useState(() => initialSnapshot?.pageSize || 10);

  const requestIdRef = useRef(0);
  const lastLoadedServerQueryRef = useRef('');
  const restoredCacheConsumedRef = useRef(false);
  const restoreDoneRef = useRef(false);
  const snapshotUiStateRef = useRef(null);

  const serverQueryKey = useMemo(() => JSON.stringify({
    queryKey,
    categoryIdFilter,
    status: statusFilter,
  }), [categoryIdFilter, queryKey, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPageNumber(1);
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    toolsApi.getAreas().then((nextAreas) => {
      if (cancelled) return;
      setAreas(Array.isArray(nextAreas) ? nextAreas : []);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    snapshotUiStateRef.current = {
    search,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    areaFilter,
    areas,
    pageNumber,
    pageSize,
  };
  }, [
    areaFilter,
    areas,
    debouncedSearch,
    pageNumber,
    pageSize,
    priorityFilter,
    search,
    statusFilter,
  ]);

  const loadTickets = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestIdRef.current;

    if (background) setRefreshing(true);
    else setLoading(true);

    if (!background) setError('');

    try {
      const baseParams = {};
      if (statusFilter !== 'all') baseParams.status = statusFilter;
      if (categoryIdFilter) baseParams.categoryId = categoryIdFilter;

      const firstResponse = await managementFeedbackApi.getFeedbacks({
        ...baseParams,
        pageNumber: 1,
        pageSize: MONITOR_INITIAL_FETCH_SIZE,
      });
      if (requestId !== requestIdRef.current) return;

      const firstItems = Array.isArray(firstResponse?.items)
        ? firstResponse.items
        : Array.isArray(firstResponse)
          ? firstResponse
          : [];

      const totalItems = Number(firstResponse?.totalItems ?? firstItems.length);

      lastLoadedServerQueryRef.current = serverQueryKey;
      setTickets(firstItems);
      setServerTotalItems(totalItems);
      setLoading(false);
      setHasLoaded(true);

      writeInteractionSnapshot(interactionSnapshotKey, {
        queryKey,
        tickets: firstItems,
        serverTotalItems: totalItems,
        ...snapshotUiStateRef.current,
        scrollY:
          document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0,
      });

      if (totalItems <= firstItems.length) {
        setRefreshing(false);
        return;
      }

      setRefreshing(true);

      const totalPages = Math.ceil(totalItems / MONITOR_BACKGROUND_PAGE_SIZE);
      const remainingPages = Array.from(
        { length: Math.max(0, totalPages - 1) },
        (_, index) => index + 2
      );

      let hydratedItems = [...firstItems];
      let failedPageCount = 0;
      const batchSize = 3;

      for (let offset = 0; offset < remainingPages.length; offset += batchSize) {
        if (requestId !== requestIdRef.current) return;

        const pageBatch = remainingPages.slice(offset, offset + batchSize);
        const pageResults = await Promise.allSettled(
          pageBatch.map((page) =>
            managementFeedbackApi.getFeedbacks({
              ...baseParams,
              pageNumber: page,
              pageSize: MONITOR_BACKGROUND_PAGE_SIZE,
            })
          )
        );

        const nextItems = pageResults.flatMap((result) => {
          if (result.status !== 'fulfilled') {
            failedPageCount += 1;
            return [];
          }
          const value = result.value;
          return Array.isArray(value?.items)
            ? value.items
            : Array.isArray(value)
              ? value
              : [];
        });

        if (requestId !== requestIdRef.current) return;

        if (nextItems.length > 0) {
          const byId = new Map(
            [...hydratedItems, ...nextItems].map((ticket) => [
              String(ticket?.feedbackId || ticket?.id || JSON.stringify(ticket)),
              ticket,
            ])
          );
          hydratedItems = Array.from(byId.values());
          setTickets(hydratedItems);

          writeInteractionSnapshot(interactionSnapshotKey, {
            queryKey,
            tickets: hydratedItems,
            serverTotalItems: totalItems,
            ...snapshotUiStateRef.current,
            scrollY:
              document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0,
          });
        }
      }

      if (requestId === requestIdRef.current && failedPageCount > 0) {
        setError(`Không thể tải đầy đủ ${failedPageCount} trang phản ánh. Kết quả tìm kiếm và bộ lọc hiện tại có thể chưa đầy đủ; hãy bấm Làm mới để thử lại.`);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      console.error('Failed to load interaction monitoring data', err);

      setError(err?.message || 'Không thể tải dữ liệu giám sát phản ánh.');
      if (!background) {
        setTickets([]);
        setServerTotalItems(0);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setHasLoaded(true);
      }
    }
  }, [
    categoryIdFilter,
    interactionSnapshotKey,
    queryKey,
    serverQueryKey,
    statusFilter,
  ]);

  useEffect(() => {
    const canRestoreWithoutRequest = Boolean(
      !restoredCacheConsumedRef.current &&
      returnContext &&
      initialSnapshot &&
      initialSnapshot.queryKey === queryKey
    );

    if (canRestoreWithoutRequest) {
      restoredCacheConsumedRef.current = true;
      lastLoadedServerQueryRef.current = serverQueryKey;
      return undefined;
    }

    const hasVisibleData = hasLoaded || tickets.length > 0 || Boolean(initialSnapshot);

    loadTickets({ background: hasVisibleData });

    return () => {
      requestIdRef.current += 1;
    };
  }, [
    hasLoaded,
    initialSnapshot,
    loadTickets,
    queryKey,
    returnContext,
    serverQueryKey,
    tickets.length,
  ]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = normalizeSearchText(debouncedSearch);
    const searchFiltered = normalizedSearch
      ? tickets.filter((ticket) => getFeedbackSearchText(ticket).includes(normalizedSearch))
      : tickets;

    const selectedArea = areaFilter === 'all'
      ? null
      : areas.find((area) => String(getAreaId(area)) === String(areaFilter));
    const selectedAreaName = normalizeSearchText(getAreaName(selectedArea));

    const areaFiltered = areaFilter === 'all'
      ? searchFiltered
      : searchFiltered.filter((ticket) => {
          const ticketAreaId =
            ticket?.areaId ??
            ticket?.wardId ??
            ticket?.area?.areaId ??
            ticket?.area?.id ??
            '';
          if (ticketAreaId && String(ticketAreaId) === String(areaFilter)) return true;

          const ticketAreaName = normalizeSearchText(
            ticket?.areaName ?? ticket?.wardName ?? ticket?.area?.name ?? ''
          );
          return Boolean(selectedAreaName && ticketAreaName === selectedAreaName);
        });

    const priorityFiltered =
      priorityFilter === 'all'
        ? areaFiltered
        : areaFiltered.filter(
            (ticket) =>
              normalizePriorityValue(ticket.priority).toLowerCase() ===
              normalizePriorityValue(priorityFilter).toLowerCase()
          );

    if (metricFilter === 'all') return priorityFiltered;

    if (metricFilter === 'inProcessing') {
      return priorityFiltered.filter((ticket) =>
        [
          managementTypes.feedbackStatus.ASSIGNED,
          managementTypes.feedbackStatus.IN_PROGRESS,
        ].includes(ticket.status)
      );
    }

    if (metricFilter === 'uncategorized') {
      return priorityFiltered.filter(isUncategorizedFeedback);
    }

    if (metricFilter === 'highPriority') {
      return priorityFiltered.filter((ticket) =>
        ['High', 'Critical', 'Urgent'].includes(ticket.priority)
      );
    }

    return priorityFiltered;
  }, [areaFilter, areas, debouncedSearch, metricFilter, priorityFilter, tickets]);

  const pagination = useMemo(() => {
    const totalItems = filteredTickets.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePageNumber = Math.min(pageNumber, totalPages);

    return {
      totalItems,
      totalPages,
      hasPreviousPage: safePageNumber > 1,
      hasNextPage: safePageNumber < totalPages,
      safePageNumber,
    };
  }, [filteredTickets.length, pageNumber, pageSize]);

  const visibleTickets = useMemo(() => {
    const startIndex = (pagination.safePageNumber - 1) * pageSize;
    return filteredTickets.slice(startIndex, startIndex + pageSize);
  }, [filteredTickets, pageSize, pagination.safePageNumber]);

  useLayoutEffect(() => {
    if (restoreDoneRef.current || loading || visibleTickets.length === 0) return undefined;

    const restoreFeedbackId =
      location.state?.restoreFeedbackId ||
      returnContext?.feedbackId;

    if (!restoreFeedbackId) return undefined;
    if (returnContext?.queryKey && returnContext.queryKey !== queryKey) return undefined;

    const row = document.querySelector(
      `[data-manager-feedback-id="${String(restoreFeedbackId)}"]`,
    );
    const scrollContainer = document.querySelector('[data-dashboard-scroll-container]');

    if (!row || !scrollContainer) return undefined;

    restoreDoneRef.current = true;

    // Restore the exact list viewport before paint; do not use smooth scrolling.
    scrollContainer.scrollTo({
      top: Number(returnContext?.scrollY ?? initialSnapshot?.scrollY ?? 0),
      left: 0,
      behavior: 'auto',
    });

    // Brief one-shot cue, independent from React state so it cannot interfere
    // with later filtering or pagination.
    if (typeof row.animate === 'function') {
      row.animate(
        [
          {
            backgroundColor: 'rgba(239, 246, 255, 0.96)',
            boxShadow: 'inset 0 0 0 1px rgba(147, 197, 253, 0.8)',
          },
          {
            backgroundColor: 'rgba(239, 246, 255, 0.96)',
            boxShadow: 'inset 0 0 0 1px rgba(147, 197, 253, 0.8)',
            offset: 0.72,
          },
          {
            backgroundColor: 'rgba(239, 246, 255, 0)',
            boxShadow: 'inset 0 0 0 1px rgba(147, 197, 253, 0)',
          },
        ],
        { duration: 2200, easing: 'ease-out' },
      );
    }

    try {
      window.sessionStorage.removeItem(interactionReturnKey);
    } catch {
      // Ignore storage cleanup failures.
    }

    return undefined;
  }, [
    initialSnapshot?.scrollY,
    interactionReturnKey,
    loading,
    location.state?.restoreFeedbackId,
    queryKey,
    returnContext,
    visibleTickets,
  ]);

  useEffect(() => {
    if (pageNumber !== pagination.safePageNumber) {
      setPageNumber(pagination.safePageNumber);
    }
  }, [pageNumber, pagination.safePageNumber]);

  const monitoringSummary = useMemo(() => ({
      total: tickets.length,
      inProcessing: tickets.filter((ticket) =>
        [
          managementTypes.feedbackStatus.ASSIGNED,
          managementTypes.feedbackStatus.IN_PROGRESS,
        ].includes(ticket.status)
      ).length,
      uncategorized: tickets.filter(isUncategorizedFeedback).length,
      highPriority: tickets.filter((ticket) =>
        ['High', 'Critical', 'Urgent'].includes(ticket.priority)
      ).length,
    }), [tickets]);

  const handleOpenFeedbackDetail = useCallback((ticket) => {
    const feedbackId = ticket?.feedbackId || ticket?.id;
    if (!feedbackId) return;

    const scrollY =
      document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0;

    const snapshot = {
      queryKey,
      tickets,
      serverTotalItems,
      search,
      debouncedSearch,
      statusFilter,
      priorityFilter,
      areaFilter,
      areas,
      metricFilter,
      pageNumber: pagination.safePageNumber,
      pageSize,
      scrollY,
    };

    writeInteractionSnapshot(interactionSnapshotKey, snapshot);

    try {
      window.sessionStorage.setItem(
        interactionReturnKey,
        JSON.stringify({
          feedbackId: String(feedbackId),
          queryKey,
          scrollY,
        }),
      );
    } catch (storageError) {
      console.warn('Không thể lưu vị trí danh sách phản ánh', storageError);
    }

    // Mark the list history entry so DashboardLayout does not reset the shared
    // scroll container when this entry becomes active again.
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: {
        ...(location.state || {}),
        restoreFeedbackId: String(feedbackId),
      },
    });

    navigate(`/manager/interactions/${feedbackId}`, {
      state: {
        fromInteractionList: true,
        from: `${location.pathname}${location.search}`,
      },
    });
  }, [
    areaFilter,
    areas,
    debouncedSearch,
    interactionReturnKey,
    interactionSnapshotKey,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    pageSize,
    pagination.safePageNumber,
    metricFilter,
    priorityFilter,
    queryKey,
    search,
    serverTotalItems,
    statusFilter,
    tickets,
  ]);

  useEffect(() => {
    if (!hasLoaded || tickets.length === 0) return;

    // Only persist when the visible dataset belongs to the current server query.
    // This prevents a fast search/status change from caching stale rows.
    if (
      lastLoadedServerQueryRef.current &&
      lastLoadedServerQueryRef.current !== serverQueryKey
    ) {
      return;
    }

    writeInteractionSnapshot(interactionSnapshotKey, {
      queryKey,
      tickets,
      serverTotalItems,
      search,
      debouncedSearch,
      statusFilter,
      priorityFilter,
      areaFilter,
      areas,
      metricFilter,
      pageNumber: pagination.safePageNumber,
      pageSize,
      scrollY:
        document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0,
    });
  }, [
    areaFilter,
    areas,
    debouncedSearch,
    hasLoaded,
    interactionSnapshotKey,
    pageSize,
    pagination.safePageNumber,
    metricFilter,
    priorityFilter,
    queryKey,
    search,
    serverQueryKey,
    serverTotalItems,
    statusFilter,
    tickets,
  ]);

  const handleMetricFilter = useCallback((nextFilter) => {
    setMetricFilter((current) => (
      current === nextFilter && nextFilter !== 'all'
        ? 'all'
        : nextFilter
    ));
    setPageNumber(1);
  }, []);

  const dataUnavailable = Boolean(error && tickets.length === 0);

  if (!hasLoaded && loading) {
    return (
      <article
        className="admin-page-shell manager-ui-page space-y-6"
        aria-busy="true"
        aria-label="Đang tải dữ liệu giám sát"
      >
        <header className="admin-page-hero overflow-hidden">
          <div className="flex min-h-[132px] items-center gap-4 px-7 py-6">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-8 w-64 max-w-[70%] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-[520px] max-w-[82%] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="hidden h-12 w-40 animate-pulse rounded-2xl bg-slate-100 lg:block dark:bg-slate-800" />
          </div>
        </header>

        <section className="manager-kpi-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="admin-stat-card min-h-[132px]">
              <div className="space-y-4 p-5">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-8 w-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </article>
          ))}
        </section>

        <section className="admin-panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div className="space-y-2">
              <div className="h-6 w-44 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-64 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="hidden h-11 w-72 animate-pulse rounded-xl bg-slate-100 md:block dark:bg-slate-800" />
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="grid min-h-[78px] grid-cols-[minmax(0,3.5fr)_1fr_1.2fr_1.25fr_40px] items-center gap-5 px-5 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </section>
      </article>
    );
  }

  return (
    <article className="admin-page-shell manager-ui-page space-y-6">
      <ManagerPageHeader
        title="Giám sát phản ánh"
        description="Theo dõi phản ánh từ tiếp nhận đến hoàn tất xử lý."
        icon={Lucide.MessagesSquare}
        statusLabel="Phạm vi đang giám sát"
        statusValue={dataUnavailable ? 'Không thể tải' : `${serverTotalItems} phản ánh`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/manager/incidents')}
              className="btn admin-secondary-action rounded-2xl"
            >
              <Lucide.Siren size={16} aria-hidden="true" />
              Quản lý sự vụ
            </button>
            <button
              type="button"
              onClick={() => loadTickets({ background: tickets.length > 0 })}
              className="btn admin-secondary-action rounded-2xl"
              disabled={loading || refreshing}
            >
              <Lucide.RefreshCw
                size={16}
                className={loading || refreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              Làm mới
            </button>
          </div>
        )}
      />

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Tín hiệu giám sát phản ánh"
      >
        {[
          {
            key: 'all',
            label: 'Tổng phản ánh',
            value: dataUnavailable ? '—' : monitoringSummary.total,
            description: 'Số phản ánh trong phạm vi tìm kiếm, trạng thái và danh mục đang theo dõi.',
            icon: Lucide.Files,
            toneClass: 'bg-blue-50 text-blue-700',
          },
          {
            key: 'inProcessing',
            label: 'Đang xử lý',
            value: dataUnavailable ? '—' : monitoringSummary.inProcessing,
            description: 'Phản ánh đã được phân công hoặc đang trong quá trình xử lý sự vụ.',
            icon: Lucide.Activity,
            toneClass: 'bg-amber-50 text-amber-700',
          },
          {
            key: 'uncategorized',
            label: 'Chưa phân loại',
            value: dataUnavailable ? '—' : monitoringSummary.uncategorized,
            description: 'Phản ánh chưa có danh mục rõ ràng để chuyển sang bước xử lý tiếp theo.',
            icon: Lucide.Tags,
            toneClass: 'bg-violet-50 text-violet-700',
          },
          {
            key: 'highPriority',
            label: 'Ưu tiên cao',
            value: dataUnavailable ? '—' : monitoringSummary.highPriority,
            description: 'Phản ánh có mức ưu tiên Cao hoặc Khẩn cấp cần được chú ý sớm.',
            icon: Lucide.TriangleAlert,
            toneClass: 'bg-rose-50 text-rose-700',
          },
        ].map((metric) => {
          const isActive = metricFilter === metric.key;

          return (
            <div
              key={metric.key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`Lọc danh sách theo ${metric.label}`}
              onClick={() => handleMetricFilter(metric.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleMetricFilter(metric.key);
                }
              }}
              className={`manager-metric-filter group relative rounded-[1.5rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 ${
                isActive ? 'is-active' : 'cursor-pointer'
              }`}
              title={isActive && metric.key !== 'all' ? 'Bấm lại để bỏ lọc nhanh' : `Lọc: ${metric.label}`}
            >
              {isActive ? (
                <span className="manager-metric-filter-state pointer-events-none absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold">
                  <Lucide.Check size={11} aria-hidden="true" />
                  Đang lọc
                </span>
              ) : null}

              <ManagerMetricCard
                label={metric.label}
                value={metric.value}
                description={metric.description}
                icon={metric.icon}
                toneClass={metric.toneClass}
              />
            </div>
          );
        })}
      </section>

      <section
        className="admin-panel relative overflow-hidden"
        aria-labelledby="interaction-list-title"
        aria-busy={loading || refreshing}
      >
        <header className="manager-list-panel-header px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2
                    id="interaction-list-title"
                    className="text-lg font-semibold text-slate-950 dark:text-slate-100"
                  >
                    Danh sách phản ánh
                  </h2>
                  <ManagerListRefreshIndicator visible={refreshing} />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị {visibleTickets.length} trên {pagination.totalItems} phản ánh phù hợp
                  {areaFilter !== 'all' ? (
                    <> · {getAreaName(areas.find((area) => String(getAreaId(area)) === String(areaFilter)))}</>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {categoryIdFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete('categoryId');
                      nextParams.delete('categoryName');
                      setSearchParams(nextParams, { replace: true });
                      setPageNumber(1);
                    }}
                    className="manager-active-filter-chip"
                    title="Bỏ lọc danh mục"
                  >
                    <Lucide.Tags size={14} aria-hidden="true" />
                    <span className="max-w-[220px] truncate">
                      {categoryNameFilter || `Danh mục #${categoryIdFilter}`}
                    </span>
                    <Lucide.X size={13} aria-hidden="true" />
                  </button>
                ) : null}

                {metricFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => handleMetricFilter('all')}
                    className="manager-active-filter-chip"
                  >
                    <Lucide.FilterX size={14} aria-hidden="true" />
                    Bỏ lọc nhanh
                  </button>
                ) : null}
              </div>
            </div>

            <form
              className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-[minmax(320px,1.55fr)_minmax(190px,0.85fr)_minmax(170px,0.75fr)_minmax(185px,0.85fr)]"
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="relative block min-w-0" htmlFor="interaction-search">
                <span className="sr-only">Tìm phản ánh</span>
                <Lucide.Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="interaction-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input h-11 w-full appearance-none rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none [&::-webkit-search-cancel-button]:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Tìm mã, nội dung, người gửi, vị trí, trạng thái, ngày..."
                  autoComplete="off"
                  spellCheck="false"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label="Xóa từ khóa tìm kiếm"
                  >
                    <Lucide.X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </label>

              <FilterDropdown
                value={areaFilter}
                options={buildAreaOptions(areas)}
                onChange={(value) => {
                  setAreaFilter(value);
                  setPageNumber(1);
                }}
                icon={Lucide.MapPinned}
                ariaLabel="Lọc phản ánh theo phường"
                widthClass="w-full"
              />

              <FilterDropdown
                value={priorityFilter}
                options={priorityOptions}
                onChange={(value) => {
                  setPriorityFilter(value);
                  setPageNumber(1);
                }}
                icon={Lucide.Gauge}
                ariaLabel="Lọc theo mức ưu tiên"
                widthClass="w-full"
              />

              <FilterDropdown
                value={statusFilter}
                options={statusOptions}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPageNumber(1);
                }}
                icon={Lucide.ListFilter}
                ariaLabel="Lọc theo trạng thái"
                widthClass="w-full"
              />
            </form>
          </div>
        </header>

        {error ? (
          <aside className="px-5 pt-5 sm:px-6" aria-live="polite">
            <ErrorAlert
              title="Lỗi tải dữ liệu"
              message={error}
              onClose={() => setError('')}
            />
          </aside>
        ) : null}

        {visibleTickets.length === 0 ? (
          <div className="p-6">
            {error ? (
              <ManagerEmptyState
                icon={Lucide.ShieldAlert}
                title="Chưa thể hiển thị dữ liệu phản ánh"
                description="Dữ liệu chưa được tải thành công. Kiểm tra quyền truy cập/phạm vi quản lý rồi thử lại."
              />
            ) : (
              <ManagerEmptyState
                icon={Lucide.SearchX}
                title="Không có phản ánh phù hợp"
                description="Hãy thay đổi từ khóa, trạng thái hoặc mức ưu tiên."
              />
            )}
          </div>
        ) : (
          <div
            className={`overflow-x-hidden transition-opacity ${
              loading ? 'pointer-events-none opacity-60' : 'opacity-100'
            }`}
          >
            <table className="manager-data-table table table-fixed w-full text-sm">
              <caption className="sr-only">
                Danh sách phản ánh đầu vào và trạng thái xử lý trong hệ thống
              </caption>

              <colgroup>
                <col className="w-[62%] md:w-[50%]" />
                <col className="hidden sm:table-column sm:w-[14%]" />
                <col className="w-[23%] sm:w-[16%]" />
                <col className="hidden lg:table-column lg:w-[15%]" />
                <col className="w-[15%] sm:w-[5%]" />
              </colgroup>

              <thead className="admin-table-head">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                  <th scope="col">Phản ánh</th>
                  <th scope="col" className="hidden sm:table-cell">Ưu tiên</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="hidden lg:table-cell">Ngày tạo</th>
                  <th scope="col"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>

              <tbody className="admin-table-body divide-y divide-slate-100 dark:divide-slate-800">
                {visibleTickets.map((ticket) => {
                  const feedbackId = ticket.feedbackId || ticket.id;
                  const createdAt = ticket.createdAt;
                  const updatedAt = ticket.updatedAt || ticket.createdAt;

                  return (
                    <tr
                      key={feedbackId}
                      data-manager-feedback-id={String(feedbackId)}
                      className="manager-entity-row cursor-pointer align-middle"
                      onClick={() => handleOpenFeedbackDetail(ticket)}
                    >
                      <th scope="row" className="min-w-0 font-normal">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                            <Lucide.MessageSquareText size={16} aria-hidden="true" />
                          </span>

                          <div className="min-w-0 text-left">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="shrink-0 text-[11px] font-bold uppercase tracking-[0.05em] text-blue-600 dark:text-blue-300"
                                title={feedbackId}
                              >
                                {formatFeedbackCode(feedbackId)}
                              </span>
                              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                              <p
                                className="manager-row-primary min-w-0 truncate"
                                title={ticket.title || 'Không có tiêu đề'}
                              >
                                {ticket.title || 'Không có tiêu đề'}
                              </p>
                            </div>

                            <p
                              className="manager-row-secondary mt-1.5 flex min-w-0 items-center gap-1.5 truncate"
                              title={`${ticket.areaName || ticket.locationText || 'Chưa có vị trí'} · ${ticket.categoryName || 'Chưa phân loại'}`}
                            >
                              <Lucide.MapPin size={13} className="shrink-0" aria-hidden="true" />
                              <span className="min-w-0 truncate">
                                {ticket.areaName || ticket.locationText || 'Chưa có vị trí'} · {ticket.categoryName || 'Chưa phân loại'}
                              </span>
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                              <PriorityBadge priority={ticket.priority} />
                            </div>
                            <p className="manager-row-secondary mt-1.5 lg:hidden">
                              Tạo {formatDateTime(createdAt)}
                              {updatedAt && updatedAt !== createdAt ? ` · Cập nhật ${formatDateTime(updatedAt)}` : ''}
                            </p>
                          </div>
                        </div>
                      </th>

                      <td className="hidden sm:table-cell">
                        <PriorityBadge priority={ticket.priority} />
                      </td>

                      <td>
                        <StatusBadge status={ticket.status} />
                      </td>

                      <td className="hidden lg:table-cell">
                        <div className="whitespace-nowrap">
                          <time
                            className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                            dateTime={createdAt || undefined}
                          >
                            {formatDateTime(createdAt)}
                          </time>
                          {updatedAt && updatedAt !== createdAt ? (
                            <time
                              className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500"
                              dateTime={updatedAt}
                            >
                              Cập nhật {formatDateTime(updatedAt)}
                            </time>
                          ) : null}
                        </div>
                      </td>

                      <td className="text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenFeedbackDetail(ticket);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10"
                          aria-label={`Mở chi tiết phản ánh ${ticket.title || feedbackId}`}
                          title="Xem chi tiết"
                        >
                          <Lucide.ChevronRight size={18} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="manager-pagination flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-slate-500 dark:text-slate-400">
            {pagination.totalItems === 0 ? (
              'Không có dữ liệu'
            ) : (
              <>
                Trang <strong className="text-slate-800 dark:text-slate-200">{pagination.safePageNumber}</strong> / {pagination.totalPages}
                {' · '}{pagination.totalItems} phản ánh

              </>
            )}
          </p>

          <section className="flex flex-col gap-3 sm:flex-row sm:items-center" aria-label="Điều khiển phân trang">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Số dòng</span>
              <FilterDropdown
                value={String(pageSize)}
                options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPageNumber(1);
                }}
                icon={Lucide.Rows3}
                ariaLabel="Chọn số dòng mỗi trang"
                widthClass="w-[112px]"
              />
            </div>

            <nav className="flex items-center gap-2" aria-label="Phân trang danh sách phản ánh">
              <button
                type="button"
                className="btn btn-sm admin-secondary-action rounded-xl"
                disabled={!pagination.hasPreviousPage || loading}
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              >
                <Lucide.ChevronLeft size={15} aria-hidden="true" />
                Trước
              </button>
              <button
                type="button"
                className="btn btn-sm admin-secondary-action rounded-xl"
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setPageNumber((current) => current + 1)}
              >
                Sau
                <Lucide.ChevronRight size={15} aria-hidden="true" />
              </button>
            </nav>
          </section>
        </footer>
      </section>
    </article>
  );
};
