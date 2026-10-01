import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { duplicateManagementApi } from '@urbanmind/shared-api';
import Badge from '../../components/design-system/Badge';
import * as Lucide from 'lucide-react';
import {
  ManagerEmptyState,
  ManagerListRefreshIndicator,
  ManagerMetricCard,
  ManagerPageHeader,
  ManagerToast,
} from '../../components/manager/ManagerPageElements';
import { normalizeDuplicateCandidatePayload } from './duplicateDetailUtils';
import { getScopedSessionKey } from '../../utils/scopedSessionKey';

const PAGE_SIZE = 10;
const DUPLICATE_ALL_CACHE_KEY_BASE = 'urbanservice-duplicate-all-cache-v2';
const DUPLICATE_CACHE_DIRTY_KEY_BASE = 'urbanservice-duplicate-cache-dirty-v2';

const readDuplicateAllCache = (cacheKey) => {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeDuplicateAllCache = (cacheKey, dirtyKey, summary, allItems) => {
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ summary, allItems, savedAt: Date.now() })
    );
    sessionStorage.removeItem(dirtyKey);
  } catch {
    // Ignore storage failures.
  }
};

const getDuplicateSummarySignature = (summary) => (
  [summary?.pending, summary?.confirmed, summary?.rejected, summary?.total]
    .map((value) => Number(value) || 0)
    .join('|')
);

const STATUS_FILTERS = [
  {
    key: '',
    label: 'Tổng trường hợp',
    summaryKey: 'total',
    icon: Lucide.Layers3,
    toneClass: 'bg-blue-50 text-blue-700',
    description: 'Tất cả đề xuất đối chiếu giữa phản ánh mới và sự vụ hiện có.',
  },
  {
    key: 'Pending',
    label: 'Chờ xử lý',
    summaryKey: 'pending',
    icon: Lucide.Clock3,
    toneClass: 'bg-amber-50 text-amber-700',
    description: 'Đề xuất đang chờ Manager đối chiếu và đưa ra quyết định.',
  },
  {
    key: 'Confirmed',
    label: 'Đã liên kết',
    summaryKey: 'confirmed',
    icon: Lucide.BadgeCheck,
    toneClass: 'bg-emerald-50 text-emerald-700',
    description: 'Phản ánh đã được xác nhận thuộc một sự vụ hiện có.',
  },
  {
    key: 'Rejected',
    label: 'Không trùng',
    summaryKey: 'rejected',
    icon: Lucide.XCircle,
    toneClass: 'bg-rose-50 text-rose-700',
    description: 'Đề xuất đã được xác định không thuộc sự vụ được gợi ý.',
  },
];

const getConfidenceValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed : parsed * 100;
};

const formatConfidence = (value) => {
  const confidence = getConfidenceValue(value);
  return confidence === null ? '—' : `${Math.round(confidence)}%`;
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'Pending':
      return 'Chờ xử lý';
    case 'Confirmed':
      return 'Đã liên kết';
    case 'Rejected':
      return 'Không trùng';
    default:
      return status || 'Không xác định';
  }
};

const getStatusIntent = (status) => {
  switch (status) {
    case 'Confirmed':
      return 'success';
    case 'Rejected':
      return 'danger';
    case 'Pending':
      return 'warning';
    default:
      return 'neutral';
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getFeedback = (item) => item?.primaryFeedback || item?.feedback || {};
const getParentFeedback = (item) => item?.duplicateFeedback || item?.potentialParentFeedback || {};


const normalizeSearchText = (value) => (
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const getCandidateSearchText = (item = {}) => {
  const feedback = getFeedback(item);
  const parent = getParentFeedback(item);
  const confidence = formatConfidence(item?.confidenceScore ?? item?.confidence);
  const status = getStatusLabel(item?.status || 'Pending');

  return normalizeSearchText([
    item?.duplicateCandidateId,
    item?.id,
    item?.suggestedIncidentId,
    feedback?.feedbackId,
    feedback?.id,
    feedback?.title,
    feedback?.description,
    feedback?.areaName,
    feedback?.locationText,
    feedback?.reporterName,
    parent?.feedbackId,
    parent?.id,
    parent?.incidentId,
    parent?.title,
    parent?.description,
    parent?.areaName,
    parent?.locationText,
    parent?.reporterName,
    status,
    confidence,
    formatDateTime(item?.createdAt),
  ].filter(Boolean).join(' | '));
};

const getAreaLabel = (item = {}) => {
  const feedback = getFeedback(item);
  const parent = getParentFeedback(item);
  return (
    feedback?.areaName
    || parent?.areaName
    || feedback?.locationText
    || parent?.locationText
    || 'Chưa xác định khu vực'
  );
};

const CONFIDENCE_FILTERS = [
  { value: 'all', label: 'Tất cả độ tương đồng' },
  { value: 'very-high', label: 'Rất cao · từ 90%' },
  { value: 'high', label: 'Khá cao · 75–89%' },
  { value: 'review', label: 'Cần xem kỹ · dưới 75%' },
];

const FilterDropdown = ({
  value,
  options,
  onChange,
  icon: Icon,
  ariaLabel,
  widthClass = '',
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
        className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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

      <menu className="absolute right-0 z-[90] mt-2 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
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
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
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

export const DuplicateDetectionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const duplicateAllCacheKey = useMemo(
    () => getScopedSessionKey(DUPLICATE_ALL_CACHE_KEY_BASE, user),
    [user],
  );
  const duplicateDirtyKey = useMemo(
    () => getScopedSessionKey(DUPLICATE_CACHE_DIRTY_KEY_BASE, user),
    [user],
  );
  const duplicateBasePath = location.pathname.startsWith('/manager/')
    ? '/manager/incident-matches'
    : '/staff/duplicates';

  const [initialAllCache] = useState(() => readDuplicateAllCache(duplicateAllCacheKey));
  const [summary, setSummary] = useState(() => initialAllCache?.summary || {
    pending: 0,
    confirmed: 0,
    rejected: 0,
    total: 0,
  });
  const [allItems, setAllItems] = useState(() => (
    Array.isArray(initialAllCache?.allItems) ? initialAllCache.allItems : []
  ));
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(() => !Array.isArray(initialAllCache?.allItems));
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const successMessage = location.state?.successMessage;
    if (!successMessage) return;

    setMessage({ type: 'success', text: successMessage });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const loadData = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    setMessage((current) => current.type === 'success' ? current : { type: '', text: '' });

    try {
      const summaryResponse = await duplicateManagementApi.getDuplicateSummary();
      const nextSummary = {
        pending: Number(summaryResponse?.pendingCount ?? summaryResponse?.pending ?? 0) || 0,
        confirmed: Number(summaryResponse?.confirmedCount ?? summaryResponse?.confirmed ?? 0) || 0,
        rejected: Number(summaryResponse?.rejectedCount ?? summaryResponse?.rejected ?? 0) || 0,
        total: Number(summaryResponse?.totalCount ?? summaryResponse?.total ?? 0) || 0,
      };
      setSummary(nextSummary);

      const cachedAll = readDuplicateAllCache(duplicateAllCacheKey);
      const cachedItems = Array.isArray(cachedAll?.allItems) ? cachedAll.allItems : [];
      const cacheIsDirty = sessionStorage.getItem(duplicateDirtyKey) === '1';
      const summaryUnchanged =
        getDuplicateSummarySignature(cachedAll?.summary)
        === getDuplicateSummarySignature(nextSummary);

      if (!cacheIsDirty && cachedItems.length > 0 && summaryUnchanged) {
        setAllItems(cachedItems);
        return;
      }

      const statusCounts = [
        ['Pending', nextSummary.pending],
        ['Confirmed', nextSummary.confirmed],
        ['Rejected', nextSummary.rejected],
      ];

      const fetchAllForStatus = async (status, count) => {
        if (!count) return [];

        const totalStatusPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
        const responses = await Promise.all(
          Array.from({ length: totalStatusPages }, (_, index) => (
            duplicateManagementApi.getDuplicateCandidates({
              status,
              page: index + 1,
              pageSize: PAGE_SIZE,
            })
          ))
        );

        return responses.flatMap((response) => (
          Array.isArray(response?.items) ? response.items : []
        ));
      };

      const groupedResults = await Promise.all(
        statusCounts.map(([status, count]) => fetchAllForStatus(status, count))
      );

      const nextItems = groupedResults
        .flat()
        .map((item) => normalizeDuplicateCandidatePayload(item))
        .sort((a, b) => (
          new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
        ));

      setAllItems(nextItems);
      writeDuplicateAllCache(
        duplicateAllCacheKey,
        duplicateDirtyKey,
        nextSummary,
        nextItems,
      );
    } catch (err) {
      console.error('Failed to load duplicate candidates', err);
      setMessage({
        type: 'error',
        text: err?.message || 'Không thể tải danh sách đề xuất trùng lặp.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [duplicateAllCacheKey, duplicateDirtyKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const areaOptions = useMemo(() => {
    const labels = [...new Set(
      allItems
        .map((item) => getAreaLabel(item))
        .filter((label) => label && label !== 'Chưa xác định khu vực')
    )].sort((a, b) => a.localeCompare(b, 'vi'));

    return [
      { value: 'all', label: 'Tất cả phường / khu vực' },
      ...labels.map((label) => ({ value: label, label })),
    ];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(debouncedSearch);

    return allItems.filter((item) => {
      const statusMatches = !statusFilter || String(item?.status || 'Pending') === statusFilter;
      if (!statusMatches) return false;

      if (areaFilter !== 'all' && getAreaLabel(item) !== areaFilter) return false;

      const confidence = getConfidenceValue(item?.confidenceScore ?? item?.confidence);
      if (confidenceFilter === 'very-high' && !(confidence !== null && confidence >= 90)) return false;
      if (confidenceFilter === 'high' && !(confidence !== null && confidence >= 75 && confidence < 90)) return false;
      if (confidenceFilter === 'review' && !(confidence === null || confidence < 75)) return false;

      if (normalizedQuery && !getCandidateSearchText(item).includes(normalizedQuery)) return false;

      return true;
    });
  }, [allItems, areaFilter, confidenceFilter, debouncedSearch, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const items = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, areaFilter, confidenceFilter, debouncedSearch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const start = Math.min(Math.max(currentPage - 2, 1), totalPages - 4);
    return Array.from({ length: 5 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const currentFilterLabel = STATUS_FILTERS.find((filter) => filter.key === statusFilter)?.label || 'Tổng trường hợp';
  const hasToolbarFilters = Boolean(search || areaFilter !== 'all' || confidenceFilter !== 'all');
  const hasAnyFilters = Boolean(statusFilter || hasToolbarFilters);

  const clearToolbarFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setAreaFilter('all');
    setConfidenceFilter('all');
    setPage(1);
  };

  const clearAllFilters = () => {
    setStatusFilter('');
    clearToolbarFilters();
  };

  return (
    <div className="admin-page-shell manager-ui-page space-y-6">
      <ManagerToast
        type={message.type || 'success'}
        message={message.text}
        onClose={() => setMessage({ type: '', text: '' })}
      />

      <ManagerPageHeader
        title="Xử lý trùng lặp"
        description="AI chỉ gợi ý khả năng trùng. Manager quyết định liên kết phản ánh vào sự vụ hiện có hay tạo sự vụ riêng."
        icon={Lucide.ScanSearch}
        statusLabel="ĐANG HIỂN THỊ"
        statusValue={currentFilterLabel}
      />

      <section
        className="manager-kpi-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Tổng quan đề xuất trùng lặp"
      >
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.key;

          return (
            <div
              key={filter.label}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`Lọc danh sách theo ${filter.label}`}
              onClick={() => setStatusFilter(filter.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setStatusFilter(filter.key);
                }
              }}
              className={`manager-metric-filter group relative rounded-[1.5rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 ${
                active ? 'is-active' : 'cursor-pointer'
              }`}
              title={`Lọc: ${filter.label}`}
            >
              {active ? (
                <span className="manager-metric-filter-state pointer-events-none absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold">
                  <Lucide.Check size={11} aria-hidden="true" />
                  {filter.key ? 'Đang lọc' : 'Đang xem'}
                </span>
              ) : null}

              <ManagerMetricCard
                label={filter.label}
                value={summary[filter.summaryKey]}
                description={filter.description}
                icon={filter.icon}
                toneClass={filter.toneClass}
              />
            </div>
          );
        })}
      </section>

      <section
        className="admin-panel relative overflow-hidden"
        aria-labelledby="duplicate-list-title"
        aria-busy={loading || refreshing}
      >
        <header className="manager-list-panel-header px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2
                    id="duplicate-list-title"
                    className="text-lg font-semibold text-slate-950 dark:text-slate-100"
                  >
                    Danh sách đề xuất trùng lặp
                  </h2>
                  <ManagerListRefreshIndicator visible={refreshing} />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị {items.length} trên {filteredItems.length} trường hợp phù hợp
                  {statusFilter ? <> · {currentFilterLabel}</> : null}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {statusFilter ? (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('')}
                    className="manager-active-filter-chip"
                    title="Bỏ lọc trạng thái"
                  >
                    <Lucide.FilterX size={14} aria-hidden="true" />
                    {currentFilterLabel}
                    <Lucide.X size={13} aria-hidden="true" />
                  </button>
                ) : null}

                {hasToolbarFilters ? (
                  <button
                    type="button"
                    onClick={clearToolbarFilters}
                    className="manager-active-filter-chip"
                    title="Xóa tìm kiếm và bộ lọc danh sách"
                  >
                    <Lucide.RotateCcw size={14} aria-hidden="true" />
                    Bỏ lọc danh sách
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => loadData({ background: allItems.length > 0 })}
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
            </div>

            <form
              className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-[minmax(360px,1.55fr)_minmax(210px,0.85fr)_minmax(210px,0.85fr)]"
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="relative block min-w-0" htmlFor="duplicate-search">
                <span className="sr-only">Tìm đề xuất trùng lặp</span>
                <Lucide.Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="duplicate-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input h-11 w-full appearance-none rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none [&::-webkit-search-cancel-button]:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Tìm mã, nội dung, sự vụ, khu vực, trạng thái..."
                  autoComplete="off"
                  spellCheck="false"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
                    aria-label="Xóa từ khóa tìm kiếm"
                  >
                    <Lucide.X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </label>

              <FilterDropdown
                value={areaFilter}
                options={areaOptions}
                onChange={setAreaFilter}
                icon={Lucide.MapPinned}
                ariaLabel="Lọc đề xuất theo phường hoặc khu vực"
              />

              <FilterDropdown
                value={confidenceFilter}
                options={CONFIDENCE_FILTERS}
                onChange={setConfidenceFilter}
                icon={Lucide.Gauge}
                ariaLabel="Lọc theo độ tương đồng"
              />
            </form>
          </div>
        </header>

        {loading && allItems.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">
            <span className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            Đang tải đề xuất trùng lặp...
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <ManagerEmptyState
              icon={message.type === 'error' ? Lucide.ShieldAlert : Lucide.SearchX}
              title={message.type === 'error' ? 'Chưa thể hiển thị đề xuất trùng lặp' : 'Không có trường hợp phù hợp'}
              description={
                message.type === 'error'
                  ? 'Dữ liệu chưa được tải thành công. Hãy thử làm mới hoặc kiểm tra quyền truy cập.'
                  : hasAnyFilters
                    ? 'Hãy thay đổi từ khóa, phường/khu vực, độ tương đồng hoặc trạng thái.'
                    : 'Hiện chưa có đề xuất trùng lặp cần hiển thị.'
              }
              action={hasAnyFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="btn admin-secondary-action rounded-xl"
                >
                  <Lucide.RotateCcw size={15} aria-hidden="true" />
                  Xóa tất cả bộ lọc
                </button>
              ) : null}
            />
          </div>
        ) : (
          <>
            <div className={`overflow-hidden transition-opacity ${refreshing ? 'opacity-70' : 'opacity-100'}`}>
              <table className="manager-data-table table table-fixed w-full text-sm [&_th]:px-4 [&_td]:px-4">
                <caption className="sr-only">
                  Danh sách đề xuất đối chiếu phản ánh mới với sự vụ hiện có
                </caption>
                <colgroup>
                  <col className="w-[31%]" />
                  <col className="w-[31%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[4%]" />
                </colgroup>
                <thead className="admin-table-head">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                    <th scope="col">Phản ánh mới</th>
                    <th scope="col">Sự vụ gợi ý</th>
                    <th scope="col" className="text-center">Tương đồng</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col" className="hidden 2xl:table-cell">Phát hiện lúc</th>
                    <th scope="col"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody className="admin-table-body divide-y divide-slate-100">
                  {items.map((item) => {
                    const itemId = item.duplicateCandidateId || item.id;
                    const feedback = getFeedback(item);
                    const parent = getParentFeedback(item);
                    const confidence = getConfidenceValue(item.confidenceScore ?? item.confidence);
                    const status = item.status || 'Pending';
                    const feedbackId = feedback.feedbackId || feedback.id;
                    const suggestedIncidentId = item.suggestedIncidentId || parent.incidentId;

                    return (
                      <tr
                        key={itemId}
                        className="manager-entity-row cursor-pointer align-middle"
                        onClick={() => navigate(`${duplicateBasePath}/${itemId}`)}
                      >
                        <th scope="row" className="min-w-0 font-normal">
                          <div className="min-w-0 text-left">
                            <div className="flex min-w-0 items-center gap-2">
                              {feedbackId ? (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.05em] text-blue-600" title={String(feedbackId)}>
                                  {String(feedbackId).length > 12
                                    ? `${String(feedbackId).slice(0, 6)}…${String(feedbackId).slice(-4)}`
                                    : String(feedbackId)}
                                </span>
                              ) : null}
                              {feedbackId ? <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" /> : null}
                              <p className="manager-row-primary min-w-0 truncate" title={feedback.title || item.primaryTitle || 'Không có tiêu đề'}>
                                {feedback.title || item.primaryTitle || 'Không có tiêu đề'}
                              </p>
                            </div>
                            <p className="manager-row-secondary mt-1.5 flex min-w-0 items-center gap-1.5 truncate">
                              <Lucide.MapPin size={13} className="shrink-0" aria-hidden="true" />
                              <span className="min-w-0 truncate">
                                {feedback.areaName || feedback.locationText || 'Chưa xác định khu vực'}
                              </span>
                            </p>
                          </div>
                        </th>

                        <td>
                          <div className="min-w-0">
                            {suggestedIncidentId ? (
                              <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-violet-600" title={String(suggestedIncidentId)}>
                                Sự vụ {String(suggestedIncidentId).slice(0, 8)}
                              </span>
                            ) : null}
                            <p className="manager-row-primary mt-0.5 min-w-0 truncate" title={parent.title || item.duplicateTitle || 'Không có tiêu đề'}>
                              {parent.title || item.duplicateTitle || 'Không có tiêu đề'}
                            </p>
                            <p className="manager-row-secondary mt-1 flex min-w-0 items-center gap-1.5 truncate">
                              <Lucide.MapPin size={13} className="shrink-0" aria-hidden="true" />
                              <span className="min-w-0 truncate">
                                {parent.areaName || parent.locationText || 'Chưa xác định khu vực'}
                              </span>
                            </p>
                          </div>
                        </td>

                        <td className="text-center">
                          <span className={`inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                            confidence !== null && confidence >= 90
                              ? 'bg-emerald-50 text-emerald-700'
                              : confidence !== null && confidence >= 75
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}>
                            {formatConfidence(confidence)}
                          </span>
                        </td>

                        <td>
                          <Badge intent={getStatusIntent(status)} className="whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold">
                            {getStatusLabel(status)}
                          </Badge>
                        </td>

                        <td className="hidden 2xl:table-cell">
                          <time className="whitespace-nowrap text-[13px] font-medium text-slate-700" dateTime={item.createdAt || undefined}>
                            {formatDateTime(item.createdAt)}
                          </time>
                        </td>

                        <td className="text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`${duplicateBasePath}/${itemId}`);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                            aria-label={`Mở chi tiết đề xuất ${feedback.title || itemId}`}
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

            <footer className="manager-pagination flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-slate-500">
                Trang <strong className="text-slate-800">{currentPage}</strong> / {totalPages}
                {' · '}{filteredItems.length} trường hợp
              </p>

              {totalPages > 1 ? (
                <nav className="flex items-center gap-1.5" aria-label="Phân trang đề xuất trùng lặp">
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang trước"
                  >
                    <Lucide.ChevronLeft size={16} />
                  </button>

                  {visiblePages.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-semibold transition ${
                        pageNumber === currentPage
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang sau"
                  >
                    <Lucide.ChevronRight size={16} />
                  </button>
                </nav>
              ) : null}
            </footer>
          </>
        )}
      </section>
    </div>
  );
};

export const IncidentMatchListPage = DuplicateDetectionPage;
export const DuplicateDetection = DuplicateDetectionPage;
