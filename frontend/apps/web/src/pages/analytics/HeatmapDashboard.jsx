
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { incidentManagementApi, toolsApi } from '@urbanmind/shared-api';
import { IncidentMap } from '../../components/maps/IncidentMap';
import { ManagerPageHeader, ManagerSelectMenu } from '../../components/manager/ManagerPageElements';
import { buildMapFilterOptions, filterMapIncidents, getHeatmapViewportMode, normalizeAreaBoundaryGeoJson, normalizeMapCoordinate, resolveSelectedMapArea, shouldAutoScrollMapFilter, shouldAutoScrollMapKpi, summarizeMapIncidents } from './heatmapUtils.mjs';

const CACHE_KEY = 'urbanservice.manager.heatmap.v3';
const CACHE_TTL_MS = 60_000;

const parseCoordinatesFromLocationText = (locationText) => {
  if (!locationText || typeof locationText !== 'string') {
    return { latitude: Number.NaN, longitude: Number.NaN };
  }
  const match = locationText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return { latitude: Number.NaN, longitude: Number.NaN };
  return { latitude: Number(match[1]), longitude: Number(match[2]) };
};

const normalizeIncident = (item) => {
  const parsed = parseCoordinatesFromLocationText(item?.locationText);
  return {
    ...item,
    feedbackId: item?.incidentId || item?.id || item?.feedbackId || item?.ticketId,
    incidentId: item?.incidentId || item?.id || item?.feedbackId || item?.ticketId,
    title: item?.title || item?.summary || item?.description || 'Sự vụ đô thị',
    areaId: item?.areaId ?? item?.area?.areaId ?? item?.area?.id ?? '',
    categoryId: item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id ?? '',
    categoryName: item?.categoryName || item?.category?.categoryName || item?.category?.name || 'Chưa phân loại',
    areaName: item?.areaName || item?.wardName || item?.area?.areaName || item?.area?.name || '',
    latitude: normalizeMapCoordinate(
      item?.latitude ?? item?.lat ?? item?.location?.latitude ?? item?.location?.lat ?? parsed.latitude
    ),
    longitude: normalizeMapCoordinate(
      item?.longitude ?? item?.lng ?? item?.lon ?? item?.location?.longitude ?? item?.location?.lng ?? parsed.longitude
    ),
  };
};

const hasCoordinates = (item) => (
  Number.isFinite(item?.latitude) && Math.abs(item.latitude) <= 90 &&
  Number.isFinite(item?.longitude) && Math.abs(item.longitude) <= 180
);

const normalizeResponse = (response) => {
  if (Array.isArray(response)) return response;
  const candidates = [
    response?.items, response?.data, response?.content, response?.result, response?.records,
    response?.feedbacks, response?.data?.items, response?.data?.data, response?.data?.content,
    response?.data?.result, response?.data?.records, response?.data?.feedbacks,
    response?.result?.items, response?.result?.content, response?.result?.records,
  ];
  return candidates.find(Array.isArray) || [];
};

const readTotalCount = (response, fallback = 0) => {
  const candidates = [
    response?.totalCount, response?.totalItems, response?.totalRecords,
    response?.data?.totalCount, response?.data?.totalItems, response?.data?.totalRecords,
  ];
  const total = candidates.map(Number).find((value) => Number.isFinite(value) && value >= 0);
  return total ?? fallback;
};

const readCache = () => {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.incidents)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (payload) => {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
  } catch {
    // Ignore cache write failures.
  }
};

const fetchAllIncidents = async () => {
  const pageSize = 500;
  const first = await incidentManagementApi.getIncidents({
    pageNumber: 1,
    pageSize,
    includeMerged: false,
  });
  const firstItems = normalizeResponse(first);
  const total = readTotalCount(first, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages === 1) {
    return { items: firstItems, totalCount: total, partial: false };
  }

  const remaining = await Promise.allSettled(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      incidentManagementApi.getIncidents({
        pageNumber: index + 2,
        pageSize,
        includeMerged: false,
      })
    )
  );
  const fulfilled = remaining.filter((result) => result.status === 'fulfilled');

  return {
    items: [
      ...firstItems,
      ...fulfilled.flatMap((result) => normalizeResponse(result.value)),
    ],
    totalCount: total,
    partial: fulfilled.length !== remaining.length,
  };
};

const MapSkeleton = () => (
  <div className="relative h-[550px] overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/[0.04]" aria-hidden="true">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-blue-50 via-slate-100 to-cyan-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-cyan-950/20" />
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-lg dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-300">
        <span className="loading loading-spinner loading-sm text-blue-600" />
        Đang tải dữ liệu bản đồ
      </span>
    </div>
  </div>
);

const filterFromSearch = (search, key, fallback) => {
  const value = new URLSearchParams(search).get(key);
  return value || fallback;
};

export const HeatmapDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [cached] = useState(readCache);
  const [incidents, setIncidents] = useState(() => (cached?.incidents || []).map(normalizeIncident));
  const [areas, setAreas] = useState(() => Array.isArray(cached?.areas) ? cached.areas : []);
  const [totalCount, setTotalCount] = useState(() => Number(cached?.totalCount) || cached?.incidents?.length || 0);
  const [loading, setLoading] = useState(() => !cached?.incidents?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [partialWarning, setPartialWarning] = useState('');
  const [search, setSearch] = useState(() => filterFromSearch(location.search, 'q', cached?.search || ''));
  const [areaFilter, setAreaFilter] = useState(() => filterFromSearch(location.search, 'area', cached?.areaFilter || 'all'));
  const [statusFilter, setStatusFilter] = useState(() => filterFromSearch(location.search, 'status', cached?.statusFilter || 'all'));
  const [categoryFilter, setCategoryFilter] = useState(() => filterFromSearch(location.search, 'category', cached?.categoryFilter || 'all'));
  const [severityFilter, setSeverityFilter] = useState(() => filterFromSearch(location.search, 'severity', cached?.severityFilter || 'all'));
  const [priorityFilter, setPriorityFilter] = useState(() => filterFromSearch(location.search, 'priority', cached?.priorityFilter || 'all'));
  const [coordinateFilter, setCoordinateFilter] = useState(() => filterFromSearch(location.search, 'coordinates', cached?.coordinateFilter || 'all'));
  const [showHeatLayer, setShowHeatLayer] = useState(cached?.showHeatLayer ?? true);
  const [showMarkers, setShowMarkers] = useState(cached?.showMarkers ?? true);
  const [mapView, setMapView] = useState(cached?.mapView || null);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const requestIdRef = useRef(0);
  const mapViewportRef = useRef(null);
  const pendingAutoScrollRef = useRef(false);
  const focusState = location.state?.mapState || location.state || {};

  const loadIncidents = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    setPartialWarning('');

    try {
      const response = await fetchAllIncidents();
      if (requestId !== requestIdRef.current) return;
      const next = response.items.map(normalizeIncident);
      setIncidents(next);
      setTotalCount(response.totalCount);
      setPartialWarning(response.partial ? 'Một phần dữ liệu chưa tải được. Bản đồ đang hiển thị các trang dữ liệu đã nhận thành công.' : '');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || 'Không thể tải dữ liệu bản đồ sự vụ.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const cacheFresh = cached?.cachedAt && (Date.now() - cached.cachedAt) < CACHE_TTL_MS;
    if (!cacheFresh) void loadIncidents({ background: Boolean(cached?.incidents?.length) });
    return () => { requestIdRef.current += 1; };
  }, [cached, loadIncidents]);

  useEffect(() => {
    let active = true;
    toolsApi.getAreas({}, { throwOnError: true })
      .then((nextAreas) => {
        if (active && Array.isArray(nextAreas)) setAreas(nextAreas);
      })
      .catch(() => {
        // Incident-derived area options remain available if boundary metadata cannot be loaded.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    writeCache({
      incidents,
      areas,
      totalCount,
      search,
      areaFilter,
      statusFilter,
      categoryFilter,
      severityFilter,
      priorityFilter,
      coordinateFilter,
      showHeatLayer,
      showMarkers,
      mapView,
    });
  }, [areaFilter, areas, categoryFilter, coordinateFilter, incidents, mapView, priorityFilter, search, severityFilter, showHeatLayer, showMarkers, statusFilter, totalCount]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (areaFilter !== 'all') params.set('area', areaFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (coordinateFilter !== 'all') params.set('coordinates', coordinateFilter);
    const nextSearch = params.toString();
    const currentSearch = location.search.replace(/^\?/, '');
    if (nextSearch !== currentSearch) {
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
        {
          replace: true,
          state: {
            ...(location.state && typeof location.state === 'object' ? location.state : {}),
            preserveScroll: true,
          },
        },
      );
    }
  }, [areaFilter, categoryFilter, coordinateFilter, location.pathname, location.search, location.state, navigate, priorityFilter, search, severityFilter, statusFilter]);

  const filterOptions = useMemo(() => buildMapFilterOptions(incidents, areas), [areas, incidents]);
  const selectedArea = useMemo(() => resolveSelectedMapArea(areas, areaFilter), [areaFilter, areas]);
  const selectedAreaBoundary = useMemo(
    () => normalizeAreaBoundaryGeoJson(selectedArea?.boundaryGeoJson),
    [selectedArea],
  );
  const mapViewportMode = useMemo(() => getHeatmapViewportMode(areaFilter), [areaFilter]);
  const scopedIncidents = useMemo(() => filterMapIncidents(incidents, {
    search,
    area: areaFilter,
    category: categoryFilter,
    status: statusFilter,
    priority: priorityFilter,
    severity: severityFilter,
    coordinates: coordinateFilter,
  }), [areaFilter, categoryFilter, coordinateFilter, incidents, priorityFilter, search, severityFilter, statusFilter]);
  const allMappedIncidents = useMemo(() => incidents.filter(hasCoordinates), [incidents]);
  const filteredIncidents = useMemo(() => scopedIncidents.filter(hasCoordinates), [scopedIncidents]);
  const summary = useMemo(() => summarizeMapIncidents(scopedIncidents, filteredIncidents), [filteredIncidents, scopedIncidents]);
  const highPriorityCount = useMemo(() => scopedIncidents.filter((item) => (
    ['high', 'urgent', 'critical'].includes(String(item?.priority || '').trim().toLocaleLowerCase('en-US'))
  )).length, [scopedIncidents]);

  const hasActiveFilters = Boolean(
    search.trim() || areaFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all' ||
    severityFilter !== 'all' || priorityFilter !== 'all' || coordinateFilter !== 'all'
  );

  const scrollToMap = useCallback(() => {
    const target = mapViewportRef.current;
    if (!target) return;

    const scrollContainer = target.closest('[data-dashboard-scroll-container]');
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top = scrollContainer.scrollTop + targetRect.top - containerRect.top - 16;
      scrollContainer.scrollTo({ top: Math.max(0, top), behavior });
      return;
    }

    target.scrollIntoView({ behavior, block: 'start' });
  }, []);

  const updateFilter = (filterKey, setter, value) => {
    if (shouldAutoScrollMapFilter(filterKey)) {
      pendingAutoScrollRef.current = true;
    }
    setter(value);
    setFitRequestKey((key) => key + 1);
  };

  useEffect(() => {
    if (!pendingAutoScrollRef.current) return undefined;
    pendingAutoScrollRef.current = false;
    const frameId = window.requestAnimationFrame(scrollToMap);
    return () => window.cancelAnimationFrame(frameId);
  }, [fitRequestKey, scrollToMap]);

  const resetMapFilters = () => {
    setSearch('');
    setAreaFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSeverityFilter('all');
    setPriorityFilter('all');
    setCoordinateFilter('all');
    setFitRequestKey((key) => key + 1);
  };

  const handleKpiClick = (key) => {
    if (shouldAutoScrollMapKpi(key)) {
      pendingAutoScrollRef.current = true;
    }

    if (key === 'total' || key === 'mapped') {
      resetMapFilters();
      return;
    }
    if (key === 'visible') {
      setFitRequestKey((value) => value + 1);
      return;
    }
    if (key === 'priority') {
      setPriorityFilter((current) => current === 'highOrUrgent' ? 'all' : 'highOrUrgent');
      setFitRequestKey((value) => value + 1);
    }
  };

  const noLoadedData = loading && incidents.length === 0;
  const returnPath = `${location.pathname}${location.search}`;

  return (
    <article className="admin-page-shell space-y-5 pb-5">
      <ManagerPageHeader
        title="Bản đồ điểm nóng"
        description="Theo dõi sự vụ theo vị trí, mức độ ưu tiên và phạm vi quản lý để nhanh chóng nhận diện khu vực cần chú ý."
        icon={Lucide.MapPinned}
        actions={(
          <button
            type="button"
            onClick={() => loadIncidents({ background: incidents.length > 0 })}
            disabled={refreshing}
            className="btn admin-secondary-action h-10 rounded-xl px-4 text-sm font-semibold normal-case"
          >
            <Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang cập nhật' : 'Làm mới'}
          </button>
        )}
      />

      <section className="admin-panel overflow-hidden" aria-label="Tổng quan bản đồ">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0 dark:divide-slate-800">
          {[
            { key: 'total', label: 'Tổng sự vụ', value: noLoadedData ? '—' : totalCount, hint: 'Bấm để bỏ tất cả bộ lọc' },
            { key: 'mapped', label: 'Có tọa độ', value: noLoadedData ? '—' : allMappedIncidents.length, hint: 'Sự vụ có thể hiển thị trên bản đồ' },
            { key: 'visible', label: 'Đang hiển thị', value: noLoadedData ? '—' : filteredIncidents.length, hint: 'Bấm để căn bản đồ theo phạm vi đang xem' },
            { key: 'priority', label: 'Cao / Khẩn cấp', value: noLoadedData ? '—' : highPriorityCount, hint: priorityFilter === 'highOrUrgent' ? 'Bấm để bỏ lọc Cao / Khẩn cấp' : 'Bấm để chỉ xem Cao / Khẩn cấp' },
          ].map(({ key, label, value, hint }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKpiClick(key)}
              title={hint}
              className={`group relative min-h-[92px] bg-transparent px-4 py-4 text-left transition-colors hover:bg-slate-500/[0.06] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-5 ${
                key === 'priority' && priorityFilter === 'highOrUrgent'
                  ? 'bg-rose-500/[0.08]'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
                  <p className={`mt-1.5 text-[28px] font-bold leading-none tracking-tight ${key === 'priority' ? 'text-rose-600 dark:text-rose-300' : 'text-slate-950 dark:text-white'}`}>{value}</p>
                </div>
                <Lucide.ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="admin-error-note flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Lucide.CircleAlert size={17} />
            {incidents.length ? `${error} Đang hiển thị dữ liệu gần nhất đã tải thành công.` : error}
          </span>
          <button type="button" onClick={() => loadIncidents({ background: incidents.length > 0 })} className="btn admin-secondary-action h-9 rounded-xl px-4 text-xs font-semibold normal-case">Thử lại</button>
        </div>
      ) : null}

      {partialWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="inline-flex items-center gap-2"><Lucide.TriangleAlert size={16} />{partialWarning}</span>
        </div>
      ) : null}

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5 dark:border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="admin-section-title">Phân bố sự vụ theo tọa độ</h2>
                <p className="admin-section-description">Vùng cảnh báo được mở rộng theo mức ưu tiên của từng sự vụ; đây không phải mô hình mật độ hay dự báo AI.</p>
              </div>
              {hasActiveFilters ? (
                <button type="button" onClick={resetMapFilters} className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/[0.04] xl:self-auto">
                  <Lucide.RotateCcw size={14} /> Xóa bộ lọc
                </button>
              ) : null}
            </div>

            <div className="grid gap-2 lg:grid-cols-12">
              <label className="relative block lg:col-span-4">
                <span className="sr-only">Tìm sự vụ trên bản đồ</span>
                <Lucide.Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => updateFilter('search', setSearch, event.target.value)}
                  placeholder="Tìm mã, tiêu đề, khu vực..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/10"
                />
              </label>
              <div className="lg:col-span-4">
                <ManagerSelectMenu
                  value={areaFilter}
                  onChange={(value) => updateFilter('area', setAreaFilter, value)}
                  ariaLabel="Lọc khu vực"
                  options={[{ value: 'all', label: 'Tất cả khu vực' }, ...filterOptions.areas]}
                />
              </div>
              <div className="lg:col-span-4">
                <ManagerSelectMenu
                  value={categoryFilter}
                  onChange={(value) => updateFilter('category', setCategoryFilter, value)}
                  ariaLabel="Lọc danh mục sự vụ"
                  options={[{ value: 'all', label: 'Tất cả dịch vụ' }, ...filterOptions.categories]}
                />
              </div>
              <div className="lg:col-span-3">
                <ManagerSelectMenu
                  value={statusFilter}
                  onChange={(value) => updateFilter('status', setStatusFilter, value)}
                  ariaLabel="Lọc trạng thái sự vụ"
                  options={[
                    { value: 'all', label: 'Tất cả trạng thái' },
                    { value: 'intake', label: 'Mới / Đã xác minh' },
                    { value: 'processing', label: 'Đang xử lý' },
                    { value: 'approval', label: 'Chờ duyệt kết quả' },
                    { value: 'ended', label: 'Đã kết thúc' },
                  ]}
                />
              </div>
              <div className="lg:col-span-3">
                <ManagerSelectMenu
                  value={severityFilter}
                  onChange={(value) => updateFilter('severity', setSeverityFilter, value)}
                  ariaLabel="Lọc mức độ nghiêm trọng"
                  options={[
                    { value: 'all', label: 'Tất cả mức nghiêm trọng' },
                    { value: 'critical', label: 'Nghiêm trọng' },
                    { value: 'high', label: 'Cao' },
                    { value: 'medium', label: 'Trung bình' },
                    { value: 'low', label: 'Thấp' },
                  ]}
                />
              </div>
              <div className="lg:col-span-3">
                <ManagerSelectMenu
                  value={priorityFilter}
                  onChange={(value) => updateFilter('priority', setPriorityFilter, value)}
                  ariaLabel="Lọc mức ưu tiên"
                  options={[
                    { value: 'all', label: 'Tất cả ưu tiên' },
                    { value: 'highOrUrgent', label: 'Cao / Khẩn cấp' },
                    { value: 'urgent', label: 'Khẩn cấp' },
                    { value: 'high', label: 'Cao' },
                    { value: 'medium', label: 'Trung bình' },
                    { value: 'low', label: 'Thấp' },
                  ]}
                />
              </div>
              <div className="lg:col-span-3">
                <ManagerSelectMenu
                  value={coordinateFilter}
                  onChange={(value) => updateFilter('coordinates', setCoordinateFilter, value)}
                  ariaLabel="Lọc theo tọa độ"
                  options={[
                    { value: 'all', label: 'Tất cả tọa độ' },
                    { value: 'mapped', label: 'Có tọa độ' },
                    { value: 'missing', label: 'Thiếu tọa độ' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              {summary.missingCoordinates > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/manager/incidents?coordinates=missing')}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15"
                  title="Xem các sự vụ chưa có tọa độ"
                >
                  <Lucide.MapPinOff size={14} />
                  {summary.missingCoordinates} sự vụ thiếu tọa độ
                </button>
              ) : null}
              <button type="button" onClick={() => setShowHeatLayer((value) => !value)} aria-pressed={showHeatLayer} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${showHeatLayer ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}>
                <Lucide.Flame size={14} /> Vùng ưu tiên
                <span className={`h-1.5 w-1.5 rounded-full ${showHeatLayer ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </button>
              <button type="button" onClick={() => setShowMarkers((value) => !value)} aria-pressed={showMarkers} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${showMarkers ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}>
                <Lucide.MapPin size={14} /> Điểm sự vụ
                <span className={`h-1.5 w-1.5 rounded-full ${showMarkers ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </button>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Chọn một điểm để mở chi tiết sự vụ.</span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div ref={mapViewportRef} className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            {loading ? <MapSkeleton /> : (
              <>
                <IncidentMap
                  incidents={filteredIncidents}
                  fitRequestKey={fitRequestKey}
                  focusFeedbackId={focusState?.focusFeedbackId}
                  focusLatitude={focusState?.focusLatitude}
                  focusLongitude={focusState?.focusLongitude}
                  detailPathBuilder={(ticket) => `/manager/incidents/${ticket.incidentId || ticket.feedbackId}`}
                  returnPath={returnPath}
                  showHeatLayer={showHeatLayer}
                  showMarkers={showMarkers}
                  initialViewState={mapView}
                  onViewStateChange={setMapView}
                  areaBoundaryGeoJson={selectedAreaBoundary}
                  areaBoundaryKey={selectedArea?.areaId ?? selectedArea?.id ?? null}
                  areaCenterLatitude={selectedArea?.centerLatitude ?? null}
                  areaCenterLongitude={selectedArea?.centerLongitude ?? null}
                  autoFitIncidents={mapViewportMode === 'incidents'}
                />
                {filteredIncidents.length === 0 ? (
                  <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 px-3">
                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-center shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {scopedIncidents.length > 0 ? 'Chưa có điểm có tọa độ' : '0 sự vụ phù hợp bộ lọc'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {scopedIncidents.length > 0
                          ? 'Các sự vụ phù hợp chưa có tọa độ hợp lệ để đánh dấu trên bản đồ.'
                          : 'Bản đồ vẫn giữ nguyên để bạn tiếp tục điều chỉnh phạm vi lọc.'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="admin-panel overflow-hidden" aria-label="Tóm tắt phạm vi">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-0">
          <div className="min-w-0 flex-1 lg:pr-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Khu vực nhiều sự vụ nhất</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{summary.topArea?.name || 'Chưa có dữ liệu'}</p>
              <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">{summary.topArea ? `${summary.topArea.count} sự vụ` : '—'}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:px-6 lg:pt-0 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Nhóm dịch vụ nổi bật</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{summary.topCategory?.name || 'Chưa có dữ liệu'}</p>
              <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">{summary.topCategory ? `${summary.topCategory.count} sự vụ` : '—'}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Chưa có tọa độ</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <p className="text-xl font-bold text-slate-950 dark:text-white">{noLoadedData ? '—' : summary.missingCoordinates}</p>
              <span className="text-sm text-slate-500 dark:text-slate-400">không thể hiển thị trên bản đồ</span>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
};

export default HeatmapDashboard;

