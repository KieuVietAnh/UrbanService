import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getScopedSessionKey } from '../../utils/scopedSessionKey';
import * as Lucide from 'lucide-react';
import { fetchAllApprovalSummaryPages } from './approvalSummaryUtils.mjs';
import { incidentManagementApi } from '@urbanmind/shared-api';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import {
  ManagerEmptyState,
  ManagerListRefreshIndicator,
  ManagerPageHeader,
  ManagerToast,
} from '../../components/manager/ManagerPageElements';

const pageSizeOptions = [5, 10, 20, 50];

const APPROVAL_QUEUE_SNAPSHOT_KEY_BASE = 'urbanservice-manager-approval-queue-snapshot-v1';
const APPROVAL_QUEUE_SNAPSHOT_TTL = 5 * 60 * 1000;

const readApprovalQueueSnapshot = (storageKey) => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object') return null;
    if (Date.now() - Number(snapshot.savedAt || 0) > APPROVAL_QUEUE_SNAPSHOT_TTL) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
};

const writeApprovalQueueSnapshot = (storageKey, snapshot) => {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  } catch (error) {
    console.warn('Không thể lưu trạng thái hàng đợi duyệt kết quả', error);
  }
};

const priorityMeta = {
  Low: { label: 'Thấp', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  Medium: { label: 'Trung bình', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  High: { label: 'Cao', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  Critical: { label: 'Khẩn cấp', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  Urgent: { label: 'Khẩn cấp', className: 'border-rose-200 bg-rose-50 text-rose-700' },
};

const severityMeta = {
  Low: { label: 'Thấp', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  Medium: { label: 'Trung bình', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  High: { label: 'Cao', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  Critical: { label: 'Khẩn cấp', className: 'border-rose-200 bg-rose-50 text-rose-700' },
};

const normalizeText = (value) => String(value ?? '').trim();
const isCanceledRequest = (error) => error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không xác định';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
};

const formatIncidentCode = (incidentId) => {
  const value = normalizeText(incidentId);
  if (!value) return 'INC-UNKNOWN';
  const suffix = value.split('-').pop() || value;
  return `INC-${suffix.slice(0, 8).toUpperCase()}`;
};

const getWaitingTime = (value) => {
  if (!value) return 'Chưa xác định';
  const startedAt = new Date(value).getTime();
  if (Number.isNaN(startedAt)) return 'Chưa xác định';
  const hours = Math.max(0, Math.floor((Date.now() - startedAt) / 36e5));
  if (hours < 1) return 'Dưới 1 giờ';
  if (hours < 24) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
};

const getIncidentId = (item) => item?.incidentId ?? item?.id ?? '';
const getWaitingSince = (item) => item?.submittedForApprovalAt ?? item?.updatedAt ?? item?.createdAt ?? null;

const readOption = (item, type) => {
  if (type === 'area') {
    return {
      value: String(item?.areaId ?? item?.wardId ?? ''),
      label: item?.areaName ?? item?.wardName ?? item?.area?.name ?? '',
    };
  }
  return {
    value: String(item?.categoryId ?? item?.category?.id ?? ''),
    label: item?.categoryName ?? item?.category?.name ?? '',
  };
};

const collectOptions = (items, type) => {
  const map = new Map();
  items.forEach((item) => {
    const option = readOption(item, type);
    if (option.value && option.label) map.set(option.value, option.label);
  });
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'));
};



const ApprovalFilterMenu = ({
  label,
  value,
  options,
  icon: Icon,
  onChange,
  toneByValue,
}) => {
  const detailsRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target)) return;
      details.open = false;
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selected = options.find((option) => String(option.value) === String(value));
  const selectedLabel = selected?.label ?? label;

  const choose = (nextValue) => {
    onChange(nextValue);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="group relative min-w-0">
      <summary
        className={`flex h-11 min-w-0 cursor-pointer list-none items-center gap-2.5 rounded-xl border px-3.5 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 [&::-webkit-details-marker]:hidden ${
          value
            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
        }`}
      >
        <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <Lucide.ChevronDown size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[230px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
        <div className="max-h-72 overflow-y-auto overscroll-contain pr-1">
          {options.map((option) => {
            const isSelected = String(value) === String(option.value);
            const toneClass = toneByValue?.[option.value] ?? 'bg-slate-300';
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => choose(option.value)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {toneByValue ? <span className={`h-2 w-2 shrink-0 rounded-full ${toneClass}`} /> : null}
                <span className="min-w-0 flex-1 whitespace-normal leading-5">{option.label}</span>
                {isSelected ? <Lucide.Check size={15} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
};
const LevelBadge = ({ value, type = 'priority' }) => {
  const source = type === 'severity' ? severityMeta : priorityMeta;
  const meta = source[value] ?? {
    label: value || 'Chưa đặt',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

export const InteractionApprovalInboxPage = () => {
  const { user } = useAuth();
  const approvalSnapshotKey = useMemo(
    () => getScopedSessionKey(APPROVAL_QUEUE_SNAPSHOT_KEY_BASE, user),
    [user],
  );
  const [initialSnapshot] = useState(() => readApprovalQueueSnapshot(approvalSnapshotKey));
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState(() => initialSnapshot?.items || []);
  const [summaryItems, setSummaryItems] = useState(() => initialSnapshot?.summaryItems || []);
  const [loading, setLoading] = useState(() => !initialSnapshot);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(initialSnapshot));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState(() => initialSnapshot?.search || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => initialSnapshot?.search?.trim?.() || '');
  const [pageIndex, setPageIndex] = useState(() => Number(initialSnapshot?.pageIndex || 0));
  const [pageSize, setPageSize] = useState(() => Number(initialSnapshot?.pageSize || 10));
  const [totalCount, setTotalCount] = useState(() => Number(initialSnapshot?.totalCount || 0));
  const [filters, setFilters] = useState(() => initialSnapshot?.filters || { areaId: '', categoryId: '', priority: '', severity: '' });
  const itemAbortRef = useRef(null);
  const summaryAbortRef = useRef(null);
  const hasLoadedRef = useRef(Boolean(initialSnapshot));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPageIndex(0);
      setDebouncedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    writeApprovalQueueSnapshot(approvalSnapshotKey, {
      items,
      summaryItems,
      search,
      pageIndex,
      pageSize,
      totalCount,
      filters,
    });
  }, [approvalSnapshotKey, filters, items, pageIndex, pageSize, search, summaryItems, totalCount]);

  useEffect(() => {
    const returnedNotice = location.state?.approvalNotice;
    if (!returnedNotice) return;
    setNotice(returnedNotice);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state?.approvalNotice, navigate]);

  const loadItems = useCallback(async () => {
    itemAbortRef.current?.abort();
    const controller = new AbortController();
    itemAbortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await incidentManagementApi.getIncidents({
        pageNumber: pageIndex + 1,
        pageSize,
        status: 'SubmittedForApproval',
        search: debouncedSearch || undefined,
        areaId: filters.areaId ? Number(filters.areaId) : undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
        priority: filters.priority || undefined,
        severity: filters.severity || undefined,
        includeMerged: false,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setItems(Array.isArray(response?.items) ? response.items : []);
      setTotalCount(Number(response?.totalItems ?? 0));
    } catch (loadError) {
      if (isCanceledRequest(loadError) || controller.signal.aborted) return;
      console.error('Failed to load incident approval queue', loadError);
      setError(loadError?.message || 'Không thể tải danh sách sự vụ chờ duyệt.');
      if (!hasLoadedRef.current) {
        setItems([]);
        setTotalCount(0);
      }
    } finally {
      if (itemAbortRef.current === controller) {
        setLoading(false);
        hasLoadedRef.current = true;
        setHasLoaded(true);
      }
    }
  }, [debouncedSearch, filters.areaId, filters.categoryId, filters.priority, filters.severity, pageIndex, pageSize]);

  const loadQueueSummary = useCallback(async () => {
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    try {
      const response = await fetchAllApprovalSummaryPages(
        incidentManagementApi.getIncidents,
        { pageSize: 500, signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        if (response.partial) {
          console.warn('Số liệu tổng hợp hàng đợi duyệt đang thiếu một phần trang dữ liệu; giữ dữ liệu tổng hợp gần nhất.');
        } else {
          setSummaryItems(response.items);
        }
      }
    } catch (summaryError) {
      if (!isCanceledRequest(summaryError) && !controller.signal.aborted) {
        console.warn('Không thể tải số liệu tổng hợp hàng đợi duyệt sự vụ.', summaryError);
      }
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems, location.state?.refreshKey]);

  useEffect(() => {
    loadQueueSummary();
  }, [loadQueueSummary, location.state?.refreshKey]);

  useEffect(() => () => {
    const itemController = itemAbortRef.current;
    const summaryController = summaryAbortRef.current;
    itemAbortRef.current = null;
    summaryAbortRef.current = null;
    itemController?.abort();
    summaryController?.abort();
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const areaOptions = useMemo(() => collectOptions(summaryItems, 'area'), [summaryItems]);
  const categoryOptions = useMemo(() => collectOptions(summaryItems, 'category'), [summaryItems]);
  const highPriorityCount = useMemo(() => summaryItems.filter((item) => ['High', 'Critical', 'Urgent'].includes(item?.priority)).length, [summaryItems]);
  const oldestWaitingSince = useMemo(() => {
    const sorted = [...summaryItems].sort((left, right) => new Date(getWaitingSince(left) || 0) - new Date(getWaitingSince(right) || 0));
    return sorted[0] ? getWaitingSince(sorted[0]) : null;
  }, [summaryItems]);
  const hasActiveFilters = Boolean(search.trim() || filters.areaId || filters.categoryId || filters.priority || filters.severity);

  const updateFilter = (key, value) => {
    setPageIndex(0);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setPageIndex(0);
    setFilters({ areaId: '', categoryId: '', priority: '', severity: '' });
  };

  const handlePageSizeChange = (value) => {
    setPageIndex(0);
    setPageSize(Number(value));
  };

  const openDetail = (item) => {
    const incidentId = getIncidentId(item);
    if (!incidentId) return;
    navigate(`/manager/approvals/${incidentId}`, {
      state: { incident: item, from: '/manager/approvals' },
    });
  };

  if (!hasLoaded && loading) {
    return (
      <article className="admin-page-shell manager-ui-page space-y-6" aria-busy="true" aria-label="Đang tải hàng đợi duyệt sự vụ">
        <section className="admin-page-hero overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-2xl bg-blue-100 dark:bg-blue-500/15" />
            <div className="min-w-0 flex-1">
              <div className="h-8 w-72 max-w-[60%] animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800" />
              <div className="mt-3 h-4 w-[34rem] max-w-[80%] animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
            </div>
          </div>
        </section>
        <section className="admin-panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6 dark:border-slate-800">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="h-6 w-52 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-72 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
              </div>
              <div className="h-11 w-full max-w-md animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />)}
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-5 py-5 sm:px-6">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
                </div>
                <div className="hidden h-8 w-20 animate-pulse rounded-full bg-slate-100 md:block dark:bg-slate-900" />
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
        title="Duyệt kết quả xử lý"
        description="Duyệt kết quả theo từng sự vụ đã hoàn tất xử lý, kèm minh chứng và lịch sử liên quan."
        icon={Lucide.BadgeCheck}
        actions={(
          <button
            type="button"
            className="btn admin-secondary-action rounded-xl"
            onClick={() => { loadItems(); loadQueueSummary(); }}
            disabled={loading}
          >
            <Lucide.RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Làm mới
          </button>
        )}
      />

      <ManagerToast type="success" message={notice} onClose={() => setNotice('')} />

      <section className="admin-panel relative overflow-hidden" aria-labelledby="approval-queue-title" aria-busy={loading}>
        <header className="manager-list-panel-header px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 id="approval-queue-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách sự vụ chờ duyệt</h2>
                  <ManagerListRefreshIndicator visible={hasLoaded && loading && items.length > 0} />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {totalCount} sự vụ đang ở trạng thái chờ phê duyệt kết quả xử lý.
                </p>
              </div>

              <form className="w-full xl:w-[420px]" role="search" onSubmit={(event) => event.preventDefault()}>
                <label className="relative block" htmlFor="approval-search">
                  <span className="sr-only">Tìm sự vụ chờ duyệt</span>
                  <Lucide.Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="approval-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="manager-control h-11 w-full pl-10 pr-10 text-sm"
                    placeholder="Tìm mã sự vụ, nội dung, vị trí..."
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {search ? (
                    <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Xóa từ khóa">
                      <Lucide.X size={14} />
                    </button>
                  ) : null}
                </label>
              </form>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Lucide.Inbox size={18} /></span>
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Chờ duyệt</p><p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">{summaryItems.length} sự vụ</p></div>
              </div>
              <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Lucide.TriangleAlert size={18} /></span>
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Ưu tiên cao</p><p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">{highPriorityCount} sự vụ</p></div>
              </div>
              <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Lucide.Clock3 size={18} /></span>
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Chờ lâu nhất</p><p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">{oldestWaitingSince ? getWaitingTime(oldestWaitingSince) : '—'}</p></div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.85fr_0.95fr_auto]">
              <ApprovalFilterMenu
                label="Tất cả phường"
                value={filters.areaId}
                options={[{ value: '', label: 'Tất cả phường' }, ...areaOptions]}
                icon={Lucide.MapPin}
                onChange={(value) => updateFilter('areaId', value)}
              />
              <ApprovalFilterMenu
                label="Tất cả danh mục"
                value={filters.categoryId}
                options={[{ value: '', label: 'Tất cả danh mục' }, ...categoryOptions]}
                icon={Lucide.Shapes}
                onChange={(value) => updateFilter('categoryId', value)}
              />
              <ApprovalFilterMenu
                label="Ưu tiên: Tất cả"
                value={filters.priority}
                options={[
                  { value: '', label: 'Ưu tiên: Tất cả' },
                  { value: 'Urgent', label: 'Khẩn cấp' },
                  { value: 'High', label: 'Cao' },
                  { value: 'Medium', label: 'Trung bình' },
                  { value: 'Low', label: 'Thấp' },
                ]}
                icon={Lucide.Gauge}
                onChange={(value) => updateFilter('priority', value)}
                toneByValue={{ '': 'bg-slate-300', Urgent: 'bg-rose-500', High: 'bg-orange-500', Medium: 'bg-amber-400', Low: 'bg-slate-400' }}
              />
              <ApprovalFilterMenu
                label="Nghiêm trọng: Tất cả"
                value={filters.severity}
                options={[
                  { value: '', label: 'Nghiêm trọng: Tất cả' },
                  { value: 'Critical', label: 'Khẩn cấp' },
                  { value: 'High', label: 'Cao' },
                  { value: 'Medium', label: 'Trung bình' },
                  { value: 'Low', label: 'Thấp' },
                ]}
                icon={Lucide.Activity}
                onChange={(value) => updateFilter('severity', value)}
                toneByValue={{ '': 'bg-slate-300', Critical: 'bg-rose-500', High: 'bg-orange-500', Medium: 'bg-sky-500', Low: 'bg-slate-400' }}
              />
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className="btn admin-secondary-action h-11 rounded-xl px-4 text-sm font-semibold normal-case"><Lucide.RotateCcw size={15} />Xóa lọc</button>
              ) : <span className="hidden xl:block" />}
            </div>
          </div>
        </header>

        {error ? <aside className="px-5 pt-5 sm:px-6" aria-live="polite"><ErrorAlert title="Lỗi tải hàng đợi" message={error} onClose={() => setError('')} /></aside> : null}

        {items.length === 0 ? (
          <div className="p-6">
            <ManagerEmptyState
              icon={Lucide.BadgeCheck}
              title={hasActiveFilters ? 'Không có sự vụ phù hợp bộ lọc' : 'Không có sự vụ đang chờ duyệt'}
              description={hasActiveFilters ? 'Thử thay đổi hoặc xóa bộ lọc để xem các sự vụ khác.' : 'Khi nhân viên gửi kết quả xử lý của một sự vụ, sự vụ đó sẽ xuất hiện tại đây.'}
              action={hasActiveFilters ? <button type="button" className="btn admin-secondary-action rounded-xl" onClick={clearFilters}>Xóa bộ lọc</button> : null}
            />
          </div>
        ) : (
          <div className="relative overflow-x-hidden">
            {hasLoaded && loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-blue-100 dark:bg-blue-500/10" aria-hidden="true">
                <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-blue-500" />
              </div>
            ) : null}
            <table className="manager-data-table table w-full table-fixed text-sm">
              <caption className="sr-only">Danh sách sự vụ đang chờ quản lý duyệt kết quả</caption>
              <thead className="admin-table-head">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                  <th scope="col" className="w-auto">Sự vụ</th>
                  <th scope="col" className="hidden w-[170px] xl:table-cell">Danh mục</th>
                  <th scope="col" className="hidden w-[126px] lg:table-cell">Ưu tiên</th>
                  <th scope="col" className="hidden w-[140px] xl:table-cell">Nghiêm trọng</th>
                  <th scope="col" className="hidden w-[125px] md:table-cell">Thời gian chờ</th>
                  <th scope="col" className="hidden w-[150px] lg:table-cell">Cập nhật</th>
                  <th scope="col" className="w-[52px]"><span className="sr-only">Mở chi tiết</span></th>
                </tr>
              </thead>
              <tbody className="admin-table-body divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const incidentId = getIncidentId(item);
                  const waitingSince = getWaitingSince(item);
                  const title = item?.title ?? item?.summary ?? 'Sự vụ chưa có tiêu đề';
                  const areaName = item?.areaName ?? item?.wardName ?? item?.area?.name ?? 'Chưa xác định';
                  const categoryName = item?.categoryName ?? item?.category?.name ?? 'Chưa phân loại';
                  return (
                    <tr key={incidentId} className="admin-table-row group cursor-pointer align-middle" onClick={() => openDetail(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(item); } }} tabIndex={0} aria-label={`Mở chi tiết ${title}`}>
                      <th scope="row" className="font-normal">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="manager-list-card-icon mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" aria-hidden="true"><Lucide.Siren size={17} /></span>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="shrink-0 text-xs font-bold uppercase tracking-[0.04em] text-blue-600 dark:text-blue-400">{formatIncidentCode(incidentId)}</span>
                              <p className="manager-row-primary min-w-0 truncate">{title}</p>
                            </div>
                            <p className="manager-row-secondary mt-1 flex min-w-0 items-center gap-1.5" title={item?.locationText || areaName}><Lucide.MapPin size={13} className="shrink-0" /><span className="min-w-0 truncate">{areaName}{item?.locationText && item.locationText !== areaName ? ` · ${item.locationText}` : ''}</span></p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] xl:hidden">
                              <span className="xl:hidden font-medium text-slate-500">{categoryName}</span>
                              <span className="lg:hidden"><LevelBadge value={item?.priority} /></span>
                              <span className="xl:hidden"><LevelBadge value={item?.severity} type="severity" /></span>
                              <span className="md:hidden font-semibold text-slate-600">Chờ {getWaitingTime(waitingSince)}</span>
                            </div>
                          </div>
                        </div>
                      </th>
                      <td className="hidden xl:table-cell"><span className="block line-clamp-2 font-medium text-slate-700 dark:text-slate-200">{categoryName}</span></td>
                      <td className="hidden lg:table-cell"><LevelBadge value={item?.priority} /></td>
                      <td className="hidden xl:table-cell"><LevelBadge value={item?.severity} type="severity" /></td>
                      <td className="hidden md:table-cell"><span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200"><Lucide.Clock3 size={14} className="text-slate-400" />{getWaitingTime(waitingSince)}</span></td>
                      <td className="hidden lg:table-cell"><time className="whitespace-nowrap text-slate-500 dark:text-slate-400" dateTime={waitingSince || undefined}>{formatDateTime(waitingSince)}</time></td>
                      <td className="text-right"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-600"><Lucide.ChevronRight size={17} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="manager-pagination flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-slate-500 dark:text-slate-400">{totalCount === 0 ? 'Không có dữ liệu' : <>Trang <strong className="text-slate-800 dark:text-slate-200">{pageIndex + 1}</strong> / {totalPages}{' · '}{totalCount} sự vụ</>}</p>
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center" aria-label="Điều khiển phân trang">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Số dòng</span>
              <div className="w-[104px]">
                <ApprovalFilterMenu
                  label={String(pageSize)}
                  value={String(pageSize)}
                  options={pageSizeOptions.map((value) => ({ value: String(value), label: String(value) }))}
                  icon={Lucide.Rows3}
                  onChange={handlePageSizeChange}
                />
              </div>
            </div>
            <nav className="flex items-center gap-2" aria-label="Phân trang hàng đợi duyệt"><button type="button" className="btn btn-sm admin-secondary-action rounded-xl" disabled={pageIndex === 0 || loading} onClick={() => setPageIndex((current) => Math.max(0, current - 1))}><Lucide.ChevronLeft size={15} />Trước</button><button type="button" className="btn btn-sm admin-secondary-action rounded-xl" disabled={pageIndex >= totalPages - 1 || loading || totalCount === 0} onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}>Sau<Lucide.ChevronRight size={15} /></button></nav>
          </section>
        </footer>
      </section>
    </article>
  );
};
