import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';
import { extractApiErrorMessage, incidentManagementApi, toolsApi } from '@urbanmind/shared-api';
import { getScopedSessionKey } from '../../utils/scopedSessionKey';
import { ManagerListRefreshIndicator, ManagerPageHeader } from '../../components/manager/ManagerPageElements';

const PAGE_SIZE = 10;
const SMART_SEARCH_PAGE_SIZE = 100;

const INCIDENT_LIST_SNAPSHOT_KEY_BASE = 'urbanservice-management-incident-list-snapshot-v2';
const INCIDENT_RETURN_STORAGE_KEY_BASE = 'urbanservice-management-incident-return-v2';
const INCIDENT_SNAPSHOT_TTL = 5 * 60 * 1000;

const readIncidentSnapshot = (queryKey, storageKey) => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || !Array.isArray(snapshot.incidents)) return null;
    if (snapshot.queryKey !== queryKey) return null;
    if (Date.now() - Number(snapshot.savedAt || 0) > INCIDENT_SNAPSHOT_TTL) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
};

const writeIncidentSnapshot = (storageKey, snapshot) => {
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ ...snapshot, savedAt: Date.now() })
    );
  } catch (error) {
    console.warn('Không thể lưu trạng thái danh sách sự vụ', error);
  }
};

const readIncidentReturnContext = (storageKey) => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeKey = (value) => String(value ?? '').replace(/[-_\s]/g, '').toLowerCase();

const parseIncidentLocationText = (value) => {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return match ? { latitude: Number(match[1]), longitude: Number(match[2]) } : { latitude: Number.NaN, longitude: Number.NaN };
};

const hasIncidentCoordinates = (incident = {}) => {
  const parsed = parseIncidentLocationText(incident?.locationText);
  const latitude = Number(incident?.latitude ?? incident?.lat ?? incident?.location?.latitude ?? parsed.latitude);
  const longitude = Number(incident?.longitude ?? incident?.lng ?? incident?.lon ?? incident?.location?.longitude ?? parsed.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
};

const getPayload = (response) => response?.data ?? response ?? {};

const STATUS_META = {
  new: { label: 'Mới', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  submitted: { label: 'Mới gửi', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  aireviewed: { label: 'AI đã phân loại', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  verified: { label: 'Đã xác minh', className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  open: { label: 'Đang mở', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  pending: { label: 'Chờ xử lý', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  assigned: { label: 'Đã phân công', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  inprogress: { label: 'Đang xử lý', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  resolved: { label: 'Đã xử lý', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  submittedforapproval: { label: 'Chờ phê duyệt', className: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  approved: { label: 'Đã phê duyệt', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  rejected: { label: 'Đã từ chối', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  needrework: { label: 'Cần xử lý lại', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  closed: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  merged: { label: 'Đã gộp', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  cancelled: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const PRIORITY_META = {
  critical: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  urgent: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  high: { label: 'Cao', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  medium: { label: 'Trung bình', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  low: { label: 'Thấp', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

const STATUS_OPTIONS = [
  ['New', 'Mới'],
  ['Submitted', 'Mới gửi'],
  ['AiReviewed', 'AI đã phân loại'],
  ['Verified', 'Đã xác minh'],
  ['Open', 'Đang mở'],
  ['Pending', 'Chờ xử lý'],
  ['Assigned', 'Đã phân công'],
  ['InProgress', 'Đang xử lý'],
  ['Resolved', 'Đã xử lý'],
  ['SubmittedForApproval', 'Chờ phê duyệt'],
  ['Approved', 'Đã phê duyệt'],
  ['Rejected', 'Đã từ chối'],
  ['NeedRework', 'Cần xử lý lại'],
  ['Closed', 'Đã đóng'],
  ['Cancelled', 'Đã hủy'],
];

const PRIORITY_OPTIONS = [
  ['Urgent', 'Khẩn cấp'],
  ['High', 'Cao'],
  ['Medium', 'Trung bình'],
  ['Low', 'Thấp'],
];

const SEVERITY_OPTIONS = [
  ['Critical', 'Khẩn cấp'],
  ['High', 'Cao'],
  ['Medium', 'Trung bình'],
  ['Low', 'Thấp'],
];

const COORDINATE_OPTIONS = [
  ['mapped', 'Có tọa độ'],
  ['missing', 'Thiếu tọa độ'],
];

const buildAreaFilterOptions = (areas) => [
  ['', 'Tất cả phường'],
  ...areas.map((area) => [getOptionId(area), getOptionName(area)]),
];

const OBSOLETE_CATEGORY_NAMES = new Set(['cấp nước', 'water supply']);

const isVisibleManagerCategory = (category) => {
  const name = getOptionName(category).trim().toLowerCase();
  return name && !OBSOLETE_CATEGORY_NAMES.has(name);
};

const buildCategoryFilterOptions = (categories) => [
  ['', 'Tất cả danh mục'],
  ['__unclassified__', 'Chưa phân loại'],
  ...categories
    .filter(isVisibleManagerCategory)
    .map((category) => [getOptionId(category), getOptionName(category)]),
];

const STATUS_FILTER_OPTIONS = [
  ['', 'Tất cả trạng thái'],
  ['__group_active__', 'Đang xử lý'],
  ['__group_completed__', 'Đã hoàn thành'],
  ...STATUS_OPTIONS,
];

const STATUS_GROUPS = {
  active: ['Assigned', 'InProgress'],
  completed: ['Approved', 'Closed'],
};


const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${hours}:${minutes} ${day}/${month}/${year}`;
};

const formatIncidentId = (incidentId) => {
  if (!incidentId) return '—';
  const value = String(incidentId);
  const suffix = value.split('-').pop() || value;
  return `INC-${suffix.slice(0, 8).toUpperCase()}`;
};

const normalizeSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const getMetaLabel = (map, value) => map[normalizeKey(value)]?.label || value || '';

const getSearchableDateText = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const rawDay = String(date.getDate());
  const rawMonth = String(date.getMonth() + 1);
  const day = rawDay.padStart(2, '0');
  const month = rawMonth.padStart(2, '0');
  const year = String(date.getFullYear());
  const shortYear = year.slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return [
    // Có số 0 ở đầu.
    `${day}/${month}/${year}`,
    `${day}/${month}/${shortYear}`,
    `${day}/${month}`,
    `${month}/${year}`,
    `${month}/${shortYear}`,
    `${rawMonth}/${year}`,
    `${rawMonth}/${shortYear}`,
    `${day}-${month}-${year}`,
    `${day}-${month}-${shortYear}`,
    `${day}-${month}`,

    // Không bắt buộc số 0 ở đầu, ví dụ 23/8 hoặc 3/8.
    `${rawDay}/${rawMonth}/${year}`,
    `${rawDay}/${rawMonth}/${shortYear}`,
    `${rawDay}/${rawMonth}`,
    `${rawDay}-${rawMonth}-${year}`,
    `${rawDay}-${rawMonth}-${shortYear}`,
    `${rawDay}-${rawMonth}`,

    `${day} ${month} ${year}`,
    `${rawDay} ${rawMonth} ${year}`,
    `${hours}:${minutes}`,
    `${hours}:${minutes} ${day}/${month}/${year}`,
    `${hours}:${minutes} ${day}/${month}/${shortYear}`,
    `${hours}:${minutes} ${rawDay}/${rawMonth}/${year}`,
    `${hours}:${minutes} ${rawDay}/${rawMonth}/${shortYear}`,
  ].join(' ');
};

const matchesSmartSearch = (incident, rawSearch) => {
  const needle = normalizeSearchText(rawSearch);
  if (!needle) return true;

  const incidentId = incident?.incidentId ?? incident?.id ?? '';
  const status = incident?.status ?? '';
  const priority = incident?.priority ?? '';
  const severity = incident?.severity ?? '';

  const searchable = normalizeSearchText([
    incidentId,
    formatIncidentId(incidentId),
    incident?.title,
    incident?.description,
    incident?.locationText,
    incident?.areaName,
    incident?.categoryName,
    status,
    getMetaLabel(STATUS_META, status),
    priority,
    getMetaLabel(PRIORITY_META, priority),
    severity,
    getMetaLabel(PRIORITY_META, severity),
    getSearchableDateText(incident?.createdAt),
    incident?.reportCount,
    incident?.subscriberCount,
    incident?.assignedStaffName,
  ].filter(Boolean).join(' '));

  return needle
    .split(' ')
    .filter(Boolean)
    .every((token) => searchable.includes(token));
};

const getOptionId = (item) => item?.areaId ?? item?.categoryId ?? item?.id ?? item?.value ?? '';
const getOptionName = (item) => item?.areaName ?? item?.categoryName ?? item?.name ?? item?.label ?? '';

const normalizeListResponse = (response, requestedPage) => {
  const payload = getPayload(response);
  const nested = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const items = Array.isArray(nested)
    ? nested
    : Array.isArray(nested?.items)
      ? nested.items
      : Array.isArray(nested?.records)
        ? nested.records
        : [];

  const totalItems = Number(nested?.totalItems ?? nested?.totalCount ?? nested?.count ?? items.length);
  const pageNumber = Number(nested?.pageNumber ?? nested?.currentPage ?? requestedPage ?? 1) || 1;
  const pageSize = Number(nested?.pageSize ?? nested?.limit ?? PAGE_SIZE) || PAGE_SIZE;
  const totalPages = Math.max(1, Number(nested?.totalPages) || Math.ceil((Number.isFinite(totalItems) ? totalItems : items.length) / pageSize));

  return {
    items,
    pagination: {
      pageNumber,
      pageSize,
      totalItems: Number.isFinite(totalItems) ? totalItems : items.length,
      totalPages,
      hasPreviousPage: nested?.hasPreviousPage ?? pageNumber > 1,
      hasNextPage: nested?.hasNextPage ?? pageNumber < totalPages,
    },
  };
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[normalizeKey(status)] || {
    label: status || 'Chưa rõ',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
};

const PriorityBadge = ({ priority }) => {
  const meta = PRIORITY_META[normalizeKey(priority)] || {
    label: priority || 'Chưa đặt',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
};

const SeverityBadge = ({ severity }) => {
  const meta = PRIORITY_META[normalizeKey(severity)] || {
    label: severity || 'Chưa đặt',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
};



const MainFilterMenu = ({
  label,
  value,
  options,
  icon: Icon,
  onChange,
  widthClass = 'w-[280px]',
  maxHeightClass = 'max-h-[320px]',
}) => {
  const detailsRef = useRef(null);
  const selectedLabel = options.find(([optionValue]) => String(optionValue) === String(value))?.[1] || label;

  useEffect(() => {
    const handlePointerDown = (event) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (details.contains(event.target)) return;
      details.open = false;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const choose = (nextValue) => {
    onChange(nextValue);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="group relative min-w-0">
      <summary className="flex h-10 min-w-0 cursor-pointer list-none items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 [&::-webkit-details-marker]:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <Icon size={16} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <Lucide.ChevronDown size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className={`absolute left-0 top-[calc(100%+8px)] z-50 ${widthClass} overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900`}>
        <div className={`${maxHeightClass} overflow-y-auto overscroll-contain pr-1`}>
          {options.map(([optionValue, optionLabel]) => {
            const isSelected = String(value) === String(optionValue);
            return (
              <button
                key={`${optionValue}-${optionLabel}`}
                type="button"
                onClick={() => choose(optionValue)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  isSelected
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="min-w-0 flex-1 whitespace-normal leading-5">{optionLabel}</span>
                {isSelected ? <Lucide.Check size={15} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
};

const QuickFilterMenu = ({
  label,
  value,
  options,
  icon: Icon,
  onChange,
  metaMap,
  className = '',
}) => {
  const detailsRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (details.contains(event.target)) return;
      details.open = false;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selectedMeta = value ? metaMap?.[normalizeKey(value)] : null;
  const selectedLabel = selectedMeta?.label || options.find(([optionValue]) => optionValue === value)?.[1] || 'Tất cả';

  const choose = (nextValue) => {
    onChange(nextValue);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className={`group relative min-w-0 ${className}`}>
      <summary
        className={`flex h-10 min-w-[196px] cursor-pointer list-none items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition [&::-webkit-details-marker]:hidden ${
          value
            ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
            : 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400'
        } dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
      >
        <Icon size={15} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">{label}: {selectedLabel}</span>
        <Lucide.ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
        <div className="px-2.5 pb-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => choose('')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
            !value
              ? 'bg-blue-50 font-semibold text-blue-700'
              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="flex-1">Tất cả</span>
          {!value ? <Lucide.Check size={15} /> : null}
        </button>

        {options.map(([optionValue, optionLabel]) => {
          const meta = metaMap?.[normalizeKey(optionValue)];
          const isSelected = value === optionValue;
          const dotClass = meta?.className?.includes('rose')
            ? 'bg-rose-500'
            : meta?.className?.includes('orange')
              ? 'bg-orange-500'
              : meta?.className?.includes('amber')
                ? 'bg-amber-400'
                : 'bg-slate-400';

          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => choose(optionValue)}
              className={`mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                isSelected
                  ? 'bg-blue-50 font-semibold text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${dotClass}`} />
              <span className="flex-1">{optionLabel}</span>
              {isSelected ? <Lucide.Check size={15} /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
};

const TableSkeleton = () => (
  <div className="space-y-3 p-5 sm:p-6">
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} className="grid grid-cols-[3.4fr_1.2fr_1fr_1.3fr_1.4fr_0.5fr] gap-4">
        {Array.from({ length: 6 }, (_, cellIndex) => (
          <div key={cellIndex} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    ))}
  </div>
);

export const IncidentManagement = () => {
  const { user } = useAuth();
  const incidentSnapshotKey = useMemo(
    () => getScopedSessionKey(INCIDENT_LIST_SNAPSHOT_KEY_BASE, user),
    [user],
  );
  const incidentReturnKey = useMemo(
    () => getScopedSessionKey(INCIDENT_RETURN_STORAGE_KEY_BASE, user),
    [user],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestIdRef = useRef(0);
  const lastLoadedQueryRef = useRef('');
  const restoredCacheConsumedRef = useRef(false);
  const restoreScrollConsumedRef = useRef(false);
  const queryKey = searchParams.toString();
  const [initialSnapshot] = useState(() => readIncidentSnapshot(queryKey, incidentSnapshotKey));
  const [returnContext] = useState(() => {
    const stored = readIncidentReturnContext(incidentReturnKey);
    if (!stored || stored.queryKey !== queryKey) return null;
    return stored;
  });

  const pageNumber = Math.max(1, Number(searchParams.get('page')) || 1);
  const search = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  const areaId = searchParams.get('areaId') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const categoryGroup = searchParams.get('categoryGroup') || '';
  const status = searchParams.get('status') || '';
  const statusGroup = searchParams.get('statusGroup') || '';
  const rawPriority = searchParams.get('priority') || '';
  const priority = rawPriority === 'Critical' ? 'Urgent' : rawPriority;
  const severity = searchParams.get('severity') || '';
  const coordinateFilter = searchParams.get('coordinates') || '';
  const isAdminIncidentList = location.pathname.startsWith('/management/incidents');

  const [incidents, setIncidents] = useState(() => initialSnapshot?.incidents || []);
  const [areas, setAreas] = useState(() => initialSnapshot?.areas || []);
  const [categories, setCategories] = useState(() => initialSnapshot?.categories || []);
  const [pagination, setPagination] = useState(() => initialSnapshot?.pagination || {
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(() => !initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');

  const updateFilters = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Search input is deliberately decoupled from the URL.
  // Updating searchParams on every keystroke makes a controlled input lose fast
  // numeric/date characters because router updates can arrive between key events.
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch === search.trim()) return;
      updateFilters({ search: nextSearch, page: 1 });
    }, 350);

    return () => window.clearTimeout(timerId);
  }, [search, searchInput, updateFilters]);

  const fetchIncidents = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (background) {
      setRefreshing(true);
      setRefreshError('');
    } else {
      setLoading(true);
      setError('');
    }

    try {
      const normalizedSearch = search.trim();
      const groupedStatuses = STATUS_GROUPS[statusGroup] || null;
      const unclassifiedOnly = categoryGroup === 'unclassified';

      if (isAdminIncidentList && coordinateFilter) {
        const collected = [];
        const statusesToLoad = groupedStatuses?.length ? groupedStatuses : [status];

        for (const requestedStatus of statusesToLoad) {
          let requestedPage = 1;
          let totalPages = 1;
          do {
            const response = await incidentManagementApi.getIncidents({
              pageNumber: requestedPage,
              pageSize: SMART_SEARCH_PAGE_SIZE,
              areaId,
              categoryId: unclassifiedOnly ? '' : categoryId,
              status: requestedStatus,
              priority,
              severity,
              search: '',
              includeMerged: false,
            });

            if (requestId !== requestIdRef.current) return;
            const normalizedPage = normalizeListResponse(response, requestedPage);
            collected.push(...normalizedPage.items);
            totalPages = normalizedPage.pagination.totalPages;
            requestedPage += 1;
          } while (requestedPage <= totalPages);
        }

        let matched = Array.from(new Map(
          collected.map((incident) => [String(incident?.incidentId ?? incident?.id ?? ''), incident])
        ).values()).filter(Boolean);

        if (unclassifiedOnly) {
          matched = matched.filter((item) => {
            const itemCategoryId = item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id;
            const itemCategoryName = String(item?.categoryName ?? item?.category?.name ?? '').trim().toLowerCase();
            return itemCategoryId === undefined || itemCategoryId === null || itemCategoryId === '' || itemCategoryName === 'chưa phân loại' || itemCategoryName === 'unclassified';
          });
        }
        if (normalizedSearch) matched = matched.filter((incident) => matchesSmartSearch(incident, normalizedSearch));
        matched = matched.filter((incident) => coordinateFilter === 'missing' ? !hasIncidentCoordinates(incident) : hasIncidentCoordinates(incident));
        matched.sort((left, right) => {
          const leftTime = new Date(left?.updatedAt ?? left?.createdAt ?? 0).getTime() || 0;
          const rightTime = new Date(right?.updatedAt ?? right?.createdAt ?? 0).getTime() || 0;
          return rightTime - leftTime;
        });

        const totalItems = matched.length;
        const totalResultPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const safePageNumber = Math.min(pageNumber, totalResultPages);
        const startIndex = (safePageNumber - 1) * PAGE_SIZE;
        lastLoadedQueryRef.current = queryKey;
        setIncidents(matched.slice(startIndex, startIndex + PAGE_SIZE));
        setPagination({
          pageNumber: safePageNumber,
          pageSize: PAGE_SIZE,
          totalItems,
          totalPages: totalResultPages,
          hasPreviousPage: safePageNumber > 1,
          hasNextPage: safePageNumber < totalResultPages,
        });
      } else if (unclassifiedOnly) {
        const collected = [];
        let requestedPage = 1;
        let totalPages = 1;

        do {
          const response = await incidentManagementApi.getIncidents({
            pageNumber: requestedPage,
            pageSize: SMART_SEARCH_PAGE_SIZE,
            areaId,
            status,
            priority,
            severity,
            search: '',
            includeMerged: false,
          });

          if (requestId !== requestIdRef.current) return;

          const normalizedPage = normalizeListResponse(response, requestedPage);
          collected.push(...normalizedPage.items);
          totalPages = normalizedPage.pagination.totalPages;
          requestedPage += 1;
        } while (requestedPage <= totalPages);

        const matchedCategory = collected.filter((item) => {
          const itemCategoryId = item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id;
          const itemCategoryName = String(item?.categoryName ?? item?.category?.name ?? '').trim().toLowerCase();
          const isUnclassified = itemCategoryId === undefined || itemCategoryId === null || itemCategoryId === '' || itemCategoryName === 'chưa phân loại' || itemCategoryName === 'unclassified';
          return isUnclassified && (!normalizedSearch || matchesSmartSearch(item, normalizedSearch));
        });

        matchedCategory.sort((left, right) => {
          const leftTime = new Date(left?.updatedAt ?? left?.createdAt ?? 0).getTime() || 0;
          const rightTime = new Date(right?.updatedAt ?? right?.createdAt ?? 0).getTime() || 0;
          return rightTime - leftTime;
        });

        const totalItems = matchedCategory.length;
        const totalResultPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const safePageNumber = Math.min(pageNumber, totalResultPages);
        const startIndex = (safePageNumber - 1) * PAGE_SIZE;

        lastLoadedQueryRef.current = queryKey;
        setIncidents(matchedCategory.slice(startIndex, startIndex + PAGE_SIZE));
        setPagination({
          pageNumber: safePageNumber,
          pageSize: PAGE_SIZE,
          totalItems,
          totalPages: totalResultPages,
          hasPreviousPage: safePageNumber > 1,
          hasNextPage: safePageNumber < totalResultPages,
        });
      } else if (groupedStatuses) {
        const collected = [];

        for (const groupedStatus of groupedStatuses) {
          let requestedPage = 1;
          let totalPages = 1;

          do {
            const response = await incidentManagementApi.getIncidents({
              pageNumber: requestedPage,
              pageSize: SMART_SEARCH_PAGE_SIZE,
              areaId,
              categoryId,
              status: groupedStatus,
              priority,
              severity,
              search: '',
              includeMerged: false,
            });

            if (requestId !== requestIdRef.current) return;

            const normalizedPage = normalizeListResponse(response, requestedPage);
            collected.push(...normalizedPage.items);
            totalPages = normalizedPage.pagination.totalPages;
            requestedPage += 1;
          } while (requestedPage <= totalPages);
        }

        const deduplicated = Array.from(new Map(
          collected.map((incident) => [String(incident?.incidentId ?? incident?.id ?? ''), incident])
        ).values()).filter(Boolean);

        const matched = normalizedSearch
          ? deduplicated.filter((incident) => matchesSmartSearch(incident, normalizedSearch))
          : deduplicated;

        matched.sort((left, right) => {
          const leftTime = new Date(left?.updatedAt ?? left?.createdAt ?? 0).getTime() || 0;
          const rightTime = new Date(right?.updatedAt ?? right?.createdAt ?? 0).getTime() || 0;
          return rightTime - leftTime;
        });
        const totalItems = matched.length;
        const totalResultPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const safePageNumber = Math.min(pageNumber, totalResultPages);
        const startIndex = (safePageNumber - 1) * PAGE_SIZE;

        lastLoadedQueryRef.current = queryKey;
        setIncidents(matched.slice(startIndex, startIndex + PAGE_SIZE));
        setPagination({
          pageNumber: safePageNumber,
          pageSize: PAGE_SIZE,
          totalItems,
          totalPages: totalResultPages,
          hasPreviousPage: safePageNumber > 1,
          hasNextPage: safePageNumber < totalResultPages,
        });
      } else if (normalizedSearch) {
        // Smart search: the backend Search field does not cover operational
        // metadata such as severity/status/priority/createdAt. When the user
        // searches, load the filtered incident set in chunks and search those
        // fields locally so one search box can find all visible incident data.
        const collected = [];
        let requestedPage = 1;
        let totalPages = 1;

        do {
          const response = await incidentManagementApi.getIncidents({
            pageNumber: requestedPage,
            pageSize: SMART_SEARCH_PAGE_SIZE,
            areaId,
            categoryId,
            status,
            priority,
            severity,
            search: '',
            includeMerged: false,
          });

          if (requestId !== requestIdRef.current) return;

          const normalizedPage = normalizeListResponse(response, requestedPage);
          collected.push(...normalizedPage.items);
          totalPages = normalizedPage.pagination.totalPages;
          requestedPage += 1;
        } while (requestedPage <= totalPages);

        const matched = collected.filter((incident) =>
          matchesSmartSearch(incident, normalizedSearch)
        );

        const totalItems = matched.length;
        const totalResultPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const safePageNumber = Math.min(pageNumber, totalResultPages);
        const startIndex = (safePageNumber - 1) * PAGE_SIZE;
        const pageItems = matched.slice(startIndex, startIndex + PAGE_SIZE);

        lastLoadedQueryRef.current = queryKey;
        setIncidents(pageItems);
        setPagination({
          pageNumber: safePageNumber,
          pageSize: PAGE_SIZE,
          totalItems,
          totalPages: totalResultPages,
          hasPreviousPage: safePageNumber > 1,
          hasNextPage: safePageNumber < totalResultPages,
        });
      } else {
        const response = await incidentManagementApi.getIncidents({
          pageNumber,
          pageSize: PAGE_SIZE,
          areaId,
          categoryId,
          status,
          priority,
          severity,
          search: '',
          includeMerged: false,
        });

        if (requestId !== requestIdRef.current) return;

        const normalized = normalizeListResponse(response, pageNumber);
        lastLoadedQueryRef.current = queryKey;
        setIncidents(normalized.items);
        setPagination(normalized.pagination);
      }
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;
      const message = extractApiErrorMessage(fetchError, 'Không thể tải danh sách sự vụ.');
      if (background) {
        setRefreshError(message);
      } else {
        setError(message);
        setIncidents([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [areaId, categoryGroup, categoryId, coordinateFilter, isAdminIncidentList, pageNumber, priority, queryKey, search, severity, status, statusGroup]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([toolsApi.getAreas(), toolsApi.getCategories()]).then(([areaResult, categoryResult]) => {
      if (cancelled) return;
      setAreas(areaResult.status === 'fulfilled' && Array.isArray(areaResult.value) ? areaResult.value : []);
      setCategories(categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value) ? categoryResult.value : []);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (initialSnapshot?.queryKey === queryKey) {
      lastLoadedQueryRef.current = queryKey;
    }
  }, [initialSnapshot, queryKey]);

  useEffect(() => {
    const canRestoreWithoutRequest = Boolean(
      !restoredCacheConsumedRef.current &&
      returnContext &&
      initialSnapshot &&
      initialSnapshot.queryKey === queryKey
    );

    if (canRestoreWithoutRequest) {
      restoredCacheConsumedRef.current = true;
    } else {
      // Sau lần tải đầu tiên, giữ nguyên bảng hiện tại khi đổi bộ lọc/phân trang.
      // Chỉ refresh dữ liệu nền để tránh skeleton làm thay đổi chiều cao và gây giật scroll.
      const hasLoadedOnce = lastLoadedQueryRef.current !== '';
      fetchIncidents({
        background: hasLoadedOnce || Boolean(initialSnapshot && initialSnapshot.queryKey === queryKey),
      });
    }

    return () => { requestIdRef.current += 1; };
  }, [fetchIncidents, initialSnapshot, queryKey, returnContext]);

  useEffect(() => {
    if (!incidents.length || lastLoadedQueryRef.current !== queryKey) return;
    writeIncidentSnapshot(incidentSnapshotKey, {
      queryKey,
      incidents,
      areas,
      categories,
      pagination,
    });
  }, [areas, categories, incidentSnapshotKey, incidents, pagination, queryKey]);

  useLayoutEffect(() => {
    // Restore vị trí chỉ một lần khi quay lại từ trang chi tiết.
    // Nếu để effect chạy lại theo `incidents`, mỗi lần filter/pagination cập nhật dữ liệu
    // nó sẽ kéo vùng cuộn về scrollY cũ và tạo cảm giác giật lên/giật xuống.
    if (restoreScrollConsumedRef.current) return undefined;

    const savedContext = returnContext;
    const restoreIncidentId = String(savedContext?.incidentId || location.state?.restoreIncidentId || '');
    if (!restoreIncidentId || loading || incidents.length === 0) return undefined;
    if (savedContext?.queryKey && savedContext.queryKey !== queryKey) return undefined;

    const scrollContainer = document.querySelector('[data-dashboard-scroll-container]');
    if (!scrollContainer) return undefined;

    restoreScrollConsumedRef.current = true;

    // Khôi phục đúng vị trí cũ trước khi browser paint để tránh nhảy lên đầu rồi cuộn xuống.
    scrollContainer.scrollTo({
      top: Number(savedContext?.scrollY) || 0,
      left: 0,
      behavior: 'auto',
    });

    const restoredRow = document.querySelector(
      `[data-admin-incident-id="${restoreIncidentId}"]`,
    );

    if (restoredRow && typeof restoredRow.animate === 'function') {
      restoredRow.animate(
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
        {
          duration: 2300,
          easing: 'ease-out',
        },
      );
    }

    // Consume only the history flag, without causing a React Router navigation.
    // This keeps the restored scroll position intact and prevents future filters
    // from being treated as another return-from-detail event.
    try {
      const historyState = window.history.state;
      if (historyState?.usr?.restoreIncidentId) {
        const nextUserState = { ...historyState.usr };
        delete nextUserState.restoreIncidentId;

        window.history.replaceState(
          {
            ...historyState,
            usr: nextUserState,
          },
          document.title,
        );
      }
    } catch { /* noop */ }

    try { window.sessionStorage.removeItem(incidentReturnKey); } catch { /* noop */ }

    return undefined;
  }, [incidentReturnKey, incidents, loading, location.state?.restoreIncidentId, queryKey, returnContext]);

  const handleOpenIncidentDetail = useCallback((incident) => {
    const incidentId = incident?.incidentId ?? incident?.id;
    if (!incidentId) return;
    const scrollY = document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0;
    try {
      window.sessionStorage.setItem(incidentReturnKey, JSON.stringify({
        incidentId: String(incidentId),
        queryKey,
        scrollY,
      }));
    } catch (storageError) {
      console.warn('Không thể lưu vị trí danh sách sự vụ', storageError);
    }

    // Đánh dấu history entry của danh sách trước khi mở chi tiết.
    // Khi dùng nút Quay lại hoặc Browser Back, DashboardLayout sẽ không reset scroll.
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: {
        ...(location.state || {}),
        restoreIncidentId: String(incidentId),
      },
    });

    const incidentBasePath = location.pathname.startsWith('/management/incidents')
      ? '/management/incidents'
      : '/manager/incidents';

    navigate(`${incidentBasePath}/${incidentId}`, {
      state: {
        incident,
        from: `${incidentBasePath}${queryKey ? `?${queryKey}` : ''}`,
      },
    });
  }, [incidentReturnKey, location.hash, location.pathname, location.search, location.state, navigate, queryKey]);

  const hasFilters = Boolean(search || areaId || categoryId || categoryGroup || status || statusGroup || priority || severity || (isAdminIncidentList && coordinateFilter));
  const selectedArea = useMemo(() => areas.find((area) => String(getOptionId(area)) === String(areaId)), [areaId, areas]);

  return (
    <div className="admin-page-shell manager-ui-page space-y-6">
      <ManagerPageHeader
        title="Quản lý sự vụ"
        description="Theo dõi các sự vụ đã được tổng hợp từ phản ánh và điều phối xử lý theo khu vực."
        icon={Lucide.Siren}
        actions={(
          <button
            type="button"
            onClick={() => fetchIncidents({ background: incidents.length > 0 })}
            className="btn admin-secondary-action h-10 rounded-xl px-3.5 text-sm font-semibold normal-case"
            disabled={loading || refreshing}
          >
            <Lucide.RefreshCcw size={15} className={loading || refreshing ? 'animate-spin' : ''} />
            Làm mới
          </button>
        )}
      />

      <section className="admin-panel relative overflow-hidden">
        <div className="manager-list-panel-header bg-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách sự vụ</h2>
                <ManagerListRefreshIndicator visible={refreshing} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>Tổng cộng {pagination.totalItems} sự vụ</span>
                {selectedArea ? (
                  <span className="manager-active-filter-chip">
                    <Lucide.MapPin size={13} aria-hidden="true" />
                    {getOptionName(selectedArea)}
                  </span>
                ) : null}
              </div>
              {refreshError ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" role="status">
                  <Lucide.TriangleAlert size={14} aria-hidden="true" />
                  <span className="min-w-0 flex-1">Không thể làm mới dữ liệu. Danh sách hiện tại vẫn được giữ nguyên.</span>
                  <button type="button" onClick={() => fetchIncidents({ background: incidents.length > 0 })} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/10">
                    <Lucide.RefreshCcw size={12} />Thử lại
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.45fr)_minmax(170px,0.85fr)_minmax(190px,0.95fr)_minmax(180px,0.9fr)]">
                <label className="relative block min-w-0">
                  <span className="sr-only">Tìm kiếm sự vụ</span>
                  <Lucide.Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    className="input h-11 w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Tìm mã, nội dung, phường, trạng thái, mức độ, ngày..."
                    autoComplete="off"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        updateFilters({ search: '', page: 1 });
                      }}
                      className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70"
                      aria-label="Xóa từ khóa"
                    >
                      <Lucide.X size={15} />
                    </button>
                  ) : null}
                </label>

                <MainFilterMenu
                  label="Phường"
                  value={areaId}
                  options={buildAreaFilterOptions(areas)}
                  icon={Lucide.MapPin}
                  onChange={(nextValue) => updateFilters({ areaId: nextValue, page: 1 })}
                  widthClass="w-full min-w-[260px]"
                />

                <MainFilterMenu
                  label="Danh mục"
                  value={categoryGroup === 'unclassified' ? '__unclassified__' : categoryId}
                  options={buildCategoryFilterOptions(categories)}
                  icon={Lucide.FolderKanban}
                  onChange={(nextValue) => {
                    if (nextValue === '__unclassified__') {
                      updateFilters({ categoryId: '', categoryGroup: 'unclassified', page: 1 });
                      return;
                    }
                    updateFilters({ categoryId: nextValue, categoryGroup: '', page: 1 });
                  }}
                  widthClass="w-full min-w-[280px]"
                />

                <MainFilterMenu
                  label="Trạng thái"
                  value={statusGroup ? `__group_${statusGroup}__` : status}
                  options={STATUS_FILTER_OPTIONS}
                  icon={Lucide.Filter}
                  onChange={(nextValue) => {
                    if (nextValue === '__group_active__') {
                      updateFilters({ status: '', statusGroup: 'active', page: 1 });
                      return;
                    }
                    if (nextValue === '__group_completed__') {
                      updateFilters({ status: '', statusGroup: 'completed', page: 1 });
                      return;
                    }
                    updateFilters({ status: nextValue, statusGroup: '', page: 1 });
                  }}
                  widthClass="w-full min-w-[260px]"
                  maxHeightClass="max-h-[360px]"
                />
              </div>

              <div className="grid w-full gap-3 xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Lọc nhanh</span>

                <QuickFilterMenu
                  label="Ưu tiên"
                  value={priority}
                  options={PRIORITY_OPTIONS}
                  icon={Lucide.Gauge}
                  metaMap={PRIORITY_META}
                  onChange={(nextValue) => updateFilters({ priority: nextValue, page: 1 })}
                  className="w-full"
                />

                <QuickFilterMenu
                  label="Mức nghiêm trọng"
                  value={severity}
                  options={SEVERITY_OPTIONS}
                  icon={Lucide.Activity}
                  metaMap={PRIORITY_META}
                  onChange={(nextValue) => updateFilters({ severity: nextValue, page: 1 })}
                  className="w-full"
                />

                {isAdminIncidentList ? (
                  <QuickFilterMenu
                    label="Tọa độ"
                    value={coordinateFilter}
                    options={COORDINATE_OPTIONS}
                    icon={Lucide.MapPin}
                    onChange={(nextValue) => updateFilters({ coordinates: nextValue, page: 1 })}
                    className="w-full"
                  />
                ) : null}

                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => setSearchParams({}, { replace: true })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                  >
                    <Lucide.RotateCcw size={14} />
                    Xóa tất cả
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Lucide.WifiOff size={24} /></div>
            <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-slate-100">Không thể tải danh sách sự vụ</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{error}</p>
            <button type="button" onClick={() => fetchIncidents()} className="btn btn-outline mt-5 h-10 rounded-xl text-sm"><Lucide.RefreshCcw size={15} />Thử lại</button>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Lucide.Siren size={24} /></div>
            <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-slate-100">Không tìm thấy sự vụ phù hợp</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hasFilters ? 'Thử xóa bớt bộ lọc hoặc thay đổi từ khóa.' : 'Chưa có dữ liệu sự vụ để hiển thị.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-hidden">
              <table className="manager-data-table table w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                  <th className="w-auto px-5 py-3.5">Sự vụ</th>
                  <th className="hidden w-[150px] whitespace-nowrap px-4 py-3.5 xl:table-cell">Mức nghiêm trọng</th>
                  <th className="hidden w-[110px] whitespace-nowrap px-4 py-3.5 lg:table-cell">Ưu tiên</th>
                  <th className="hidden w-[150px] px-4 py-3.5 sm:table-cell">Trạng thái</th>
                  <th className="hidden w-[170px] px-4 py-3.5 md:table-cell">Ngày tạo</th>
                  <th className="w-[52px] px-3 py-3.5"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {incidents.map((incident) => {
                  const incidentId = incident?.incidentId ?? incident?.id;
                  const title = incident?.title ?? incident?.summary ?? 'Sự vụ chưa có tiêu đề';
                  const areaName = incident?.areaName ?? incident?.wardName ?? incident?.area?.name ?? 'Chưa xác định phường';
                  const categoryName = incident?.categoryName ?? incident?.category?.name ?? 'Chưa phân loại';
                  const reportCount = Number(incident?.reportCount ?? incident?.reportsCount ?? 0) || 0;
                  const subscriberCount = Number(incident?.subscriberCount ?? incident?.subscribersCount ?? 0) || 0;
                  return (
                    <tr
                      key={incidentId}
                      data-admin-incident-id={String(incidentId)}
                      className="manager-entity-row cursor-pointer"
                      onClick={() => handleOpenIncidentDetail(incident)}
                    >
                      <td className="min-w-0 px-5 py-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                            <Lucide.Siren size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.05em] text-blue-600 dark:text-blue-300">
                                {formatIncidentId(incidentId)}
                              </span>
                              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                              <p className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100" title={title}>{title}</p>
                            </div>
                            <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400" title={`${areaName} · ${categoryName} · ${reportCount} phản ánh · ${subscriberCount} theo dõi`}>
                              {areaName} · {categoryName} · {reportCount} phản ánh · {subscriberCount} theo dõi
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 xl:hidden dark:text-slate-400">
                              <span className="sm:hidden">Trạng thái: <span className="font-semibold text-slate-700 dark:text-slate-200">{getMetaLabel(STATUS_META, incident?.status) || 'Chưa rõ'}</span></span>
                              <span className="xl:hidden">Nghiêm trọng: <span className="font-semibold text-slate-700 dark:text-slate-200">{getMetaLabel(PRIORITY_META, incident?.severity) || 'Chưa đặt'}</span></span>
                              <span className="lg:hidden">Ưu tiên: <span className="font-semibold text-slate-700 dark:text-slate-200">{getMetaLabel(PRIORITY_META, incident?.priority) || 'Chưa đặt'}</span></span>
                              <span className="md:hidden">Tạo: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(incident?.createdAt)}</span></span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-4 xl:table-cell"><SeverityBadge severity={incident?.severity} /></td>
                      <td className="hidden px-4 py-4 lg:table-cell"><PriorityBadge priority={incident?.priority} /></td>
                      <td className="hidden px-4 py-4 sm:table-cell"><StatusBadge status={incident?.status} /></td>
                      <td className="hidden px-4 py-4 md:table-cell">
                        <p className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-200">
                          {formatDateTime(incident?.createdAt)}
                        </p>
                        {incident?.updatedAt && incident?.updatedAt !== incident?.createdAt ? (
                          <p className="mt-1 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500">
                            Cập nhật {formatDateTime(incident?.updatedAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); handleOpenIncidentDetail(incident); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10"
                          aria-label={`Xem chi tiết ${title}`}
                          title="Xem chi tiết"
                        >
                          <Lucide.ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>

            {pagination.totalItems > 0 ? (
              <div className="manager-pagination flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">Trang <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.pageNumber}</span> / {pagination.totalPages}</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={!pagination.hasPreviousPage || refreshing} onClick={() => updateFilters({ page: Math.max(1, pagination.pageNumber - 1) })} className="btn btn-outline h-10 min-h-0 rounded-xl border-slate-300 px-3 text-sm disabled:opacity-50 dark:border-slate-700"><Lucide.ChevronLeft size={16} />Trước</button>
                  <button type="button" disabled={!pagination.hasNextPage || refreshing} onClick={() => updateFilters({ page: Math.min(pagination.totalPages, pagination.pageNumber + 1) })} className="btn btn-outline h-10 min-h-0 rounded-xl border-slate-300 px-3 text-sm disabled:opacity-50 dark:border-slate-700">Sau<Lucide.ChevronRight size={16} /></button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
};

export const ManagerIncidentListPage = IncidentManagement;
