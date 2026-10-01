import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { incidentManagementApi, toolsApi } from '@urbanmind/shared-api';
import { IncidentMap } from '../../components/maps/IncidentMap';
import {
  ManagerMetricCard,
  ManagerPageHeader,
  ManagerSelectMenu,
} from '../../components/manager/ManagerPageElements';
import { AdminErrorState, AdminRefreshIndicator } from '../../components/admin/AdminDataStates';
import {
  buildAdminMapFilterOptions,
  filterAdminMapIncidents,
  filterAdminMapIncidentsByFilters,
  hasAdminMapCoordinates,
  normalizeAdminMapIncident,
  normalizeAreaBoundaryGeoJson,
  isHighAttentionIncident,
  resolveAdminMapArea,
  summarizeAdminMapIncidents,
} from './adminIncidentMapUtils.mjs';

const PAGE_SIZE = 500;
const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'new', label: 'Mới phát sinh' },
  { value: 'intake', label: 'Mới / đã xác minh' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'approval', label: 'Chờ duyệt kết quả' },
  { value: 'ended', label: 'Đã kết thúc' },
];
const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Tất cả mức nghiêm trọng' },
  { value: 'high-critical', label: 'Cao / Khẩn cấp' },
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Khẩn cấp' },
];
const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Tất cả ưu tiên' },
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Khẩn cấp' },
];

const fetchAllIncidents = async (signal) => {
  const first = await incidentManagementApi.getIncidents({ pageNumber: 1, pageSize: PAGE_SIZE, includeMerged: true }, { signal });
  const totalPages = Math.max(1, Number(first?.totalPages) || 1);
  const requests = [];
  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    requests.push(incidentManagementApi.getIncidents({ pageNumber, pageSize: PAGE_SIZE, includeMerged: true }, { signal }));
  }
  const results = await Promise.allSettled(requests);
  return {
    items: [
      ...(first?.items || []),
      ...results.filter((result) => result.status === 'fulfilled').flatMap((result) => result.value?.items || []),
    ].map(normalizeAdminMapIncident),
    totalItems: Number(first?.totalItems) || (first?.items || []).length,
    partial: results.some((result) => result.status === 'rejected'),
  };
};

const readInitialFilters = (search) => {
  const params = new URLSearchParams(search);
  return {
    query: params.get('q') || '',
    area: params.get('areaId') || params.get('area') || 'all',
    category: params.get('category') || 'all',
    status: params.get('status') || 'all',
    severity: params.get('severity') || 'all',
    priority: params.get('priority') || 'all',
  };
};

export const AdminIncidentMapPage = () => {
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef(null);
  const mapSectionRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [initialFilters] = useState(() => readInitialFilters(location.search));
  const [incidents, setIncidents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [areaFilter, setAreaFilter] = useState(initialFilters.area);
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [severityFilter, setSeverityFilter] = useState(initialFilters.severity);
  const [priorityFilter, setPriorityFilter] = useState(initialFilters.priority);
  const [query, setQuery] = useState(initialFilters.query);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [mapScrollRequestKey, setMapScrollRequestKey] = useState(0);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHeatLayer, setShowHeatLayer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestIdRef.current;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    setWarning('');

    try {
      const payload = await fetchAllIncidents(controller.signal);
      if (requestId !== requestIdRef.current) return;
      setIncidents(payload.items);
      setTotalItems(payload.totalItems);
      if (payload.partial) setWarning('Một số trang sự vụ chưa tải được; bản đồ đang hiển thị phần dữ liệu đã nhận.');
      setFitRequestKey((key) => key + 1);
    } catch (loadError) {
      if (loadError?.name === 'AbortError' || requestId !== requestIdRef.current) return;
      setError(loadError?.response?.data?.message || loadError?.message || 'Không thể tải dữ liệu bản đồ sự vụ.');
    } finally {
      if (requestId === requestIdRef.current) {
        if (activeRequestRef.current === controller) activeRequestRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    toolsApi.getAreas({}, { throwOnError: true })
      .then((nextAreas) => {
        if (active && Array.isArray(nextAreas)) setAreas(nextAreas.filter((area) => area?.isActive !== false));
      })
      .catch(() => {
        // Incident-derived ward options remain usable if area metadata is unavailable.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (areaFilter !== 'all') params.set('areaId', areaFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    const nextSearch = params.toString();
    if (nextSearch !== location.search.replace(/^\?/, '')) {
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
  }, [areaFilter, categoryFilter, location.pathname, location.search, location.state, navigate, priorityFilter, query, severityFilter, statusFilter]);

  const filterOptions = useMemo(() => buildAdminMapFilterOptions(incidents, areas), [areas, incidents]);
  const areaOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả phường' },
    ...filterOptions.areas,
  ], [filterOptions.areas]);
  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả danh mục' },
    ...filterOptions.categories,
  ], [filterOptions.categories]);
  const selectedArea = useMemo(() => resolveAdminMapArea(areas, areaFilter), [areaFilter, areas]);
  const selectedAreaBoundary = useMemo(
    () => normalizeAreaBoundaryGeoJson(selectedArea?.boundaryGeoJson),
    [selectedArea],
  );

  const visibleIncidents = useMemo(() => filterAdminMapIncidentsByFilters(incidents, {
    search: query,
    area: areaFilter,
    category: categoryFilter,
    status: statusFilter,
    severity: severityFilter,
    priority: priorityFilter,
  }), [areaFilter, categoryFilter, incidents, priorityFilter, query, severityFilter, statusFilter]);

  const mappedIncidents = useMemo(() => visibleIncidents
    .filter(hasAdminMapCoordinates)
    .map((item) => ({ ...item, feedbackId: item.incidentId })), [visibleIncidents]);
  const newCount = useMemo(() => filterAdminMapIncidents(incidents, 'new').length, [incidents]);
  const processingCount = useMemo(() => filterAdminMapIncidents(incidents, 'processing').length, [incidents]);
  const highAttentionCount = useMemo(() => incidents.filter(isHighAttentionIncident).length, [incidents]);
  const missingCoordinates = useMemo(() => incidents.filter((item) => !hasAdminMapCoordinates(item)).length, [incidents]);
  const summary = useMemo(() => summarizeAdminMapIncidents(visibleIncidents), [visibleIncidents]);
  const hasActiveFilters = Boolean(
    query.trim() || areaFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || severityFilter !== 'all' || priorityFilter !== 'all'
  );

  useEffect(() => {
    if (mapScrollRequestKey === 0) return undefined;

    let frameOne = 0;
    let frameTwo = 0;
    const timeoutId = window.setTimeout(() => {
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          const target = mapSectionRef.current;
          if (!target) return;

          const scrollContainer = target.closest('[data-dashboard-scroll-container]');
          const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
          const behavior = prefersReducedMotion ? 'auto' : 'smooth';

          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const top = scrollContainer.scrollTop + targetRect.top - containerRect.top - 16;
            scrollContainer.scrollTo({ top: Math.max(0, top), left: 0, behavior });
            return;
          }

          target.scrollIntoView({ behavior, block: 'start' });
        });
      });
    }, 40);

    return () => {
      window.clearTimeout(timeoutId);
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [mapScrollRequestKey]);

  const requestMapScroll = () => setMapScrollRequestKey((key) => key + 1);

  const applyFilter = (setter) => (value) => {
    setter(value);
    setFitRequestKey((key) => key + 1);
    requestMapScroll();
  };

  const clearFilters = () => {
    setQuery('');
    setAreaFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSeverityFilter('all');
    setPriorityFilter('all');
    setFitRequestKey((key) => key + 1);
    requestMapScroll();
  };

  const applyKpiFilter = ({ status = 'all', severity = 'all' } = {}) => {
    setQuery('');
    setAreaFilter('all');
    setCategoryFilter('all');
    setStatusFilter(status);
    setSeverityFilter(severity);
    setPriorityFilter('all');
    setFitRequestKey((key) => key + 1);
    requestMapScroll();
  };

  const isAllKpiActive = !query.trim()
    && areaFilter === 'all'
    && categoryFilter === 'all'
    && statusFilter === 'all'
    && severityFilter === 'all'
    && priorityFilter === 'all';
  const isNewKpiActive = !query.trim()
    && areaFilter === 'all'
    && categoryFilter === 'all'
    && statusFilter === 'new'
    && severityFilter === 'all'
    && priorityFilter === 'all';
  const isProcessingKpiActive = !query.trim()
    && areaFilter === 'all'
    && categoryFilter === 'all'
    && statusFilter === 'processing'
    && severityFilter === 'all'
    && priorityFilter === 'all';
  const isHighAttentionKpiActive = !query.trim()
    && areaFilter === 'all'
    && categoryFilter === 'all'
    && statusFilter === 'all'
    && severityFilter === 'high-critical'
    && priorityFilter === 'all';

  const areaLabel = selectedArea?.areaName || selectedArea?.name
    || areaOptions.find((option) => String(option.value) === String(areaFilter))?.label
    || 'Tất cả phường';

  return (
    <div className="manager-ui-page space-y-5">
      <ManagerPageHeader
        title="Bản đồ sự vụ"
        description="Theo dõi sự vụ theo phường và trạng thái trên toàn hệ thống."
        icon={Lucide.MapPinned}
        statusLabel={areaFilter === 'all' ? 'Phạm vi đang xem' : 'Phường đang xem'}
        statusValue={areaFilter === 'all' ? 'Tất cả phường' : areaLabel}
        actions={(
          <button type="button" onClick={() => load({ background: true })} disabled={loading || refreshing} className="btn h-10 rounded-xl border-0 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            <Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Làm mới
          </button>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số nhanh bản đồ sự vụ">
        <button
          type="button"
          onClick={() => applyKpiFilter()}
          aria-pressed={isAllKpiActive}
          className={`group h-full w-full rounded-[1.5rem] text-left outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${isAllKpiActive ? 'ring-2 ring-blue-500/25' : ''}`}
        >
          <ManagerMetricCard label="Tổng sự vụ" value={loading ? '—' : totalItems || incidents.length} description="Toàn bộ sự vụ trong hệ thống." icon={Lucide.Layers3} toneClass="bg-blue-50 text-blue-700" />
        </button>
        <button
          type="button"
          onClick={() => (isProcessingKpiActive ? applyKpiFilter() : applyKpiFilter({ status: 'processing' }))}
          aria-pressed={isProcessingKpiActive}
          className={`group h-full w-full rounded-[1.5rem] text-left outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${isProcessingKpiActive ? 'ring-2 ring-amber-500/25' : ''}`}
        >
          <ManagerMetricCard label="Đang xử lý" value={loading ? '—' : processingCount} description="Sự vụ còn trong quy trình xử lý." icon={Lucide.Activity} toneClass="bg-amber-50 text-amber-700" />
        </button>
        <button
          type="button"
          onClick={() => (isHighAttentionKpiActive ? applyKpiFilter() : applyKpiFilter({ severity: 'high-critical' }))}
          aria-pressed={isHighAttentionKpiActive}
          className={`group h-full w-full rounded-[1.5rem] text-left outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-rose-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${isHighAttentionKpiActive ? 'ring-2 ring-rose-500/25' : ''}`}
        >
          <ManagerMetricCard label="Cao / Khẩn cấp" value={loading ? '—' : highAttentionCount} description="Mức nghiêm trọng cần ưu tiên theo dõi." icon={Lucide.TriangleAlert} toneClass="bg-rose-50 text-rose-700" />
        </button>
        <button
          type="button"
          onClick={() => (isNewKpiActive ? applyKpiFilter() : applyKpiFilter({ status: 'new' }))}
          aria-pressed={isNewKpiActive}
          className={`group h-full w-full rounded-[1.5rem] text-left outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${isNewKpiActive ? 'ring-2 ring-sky-500/25' : ''}`}
        >
          <ManagerMetricCard label="Mới phát sinh" value={loading ? '—' : newCount} description="Sự vụ mới cần được theo dõi." icon={Lucide.Sparkles} toneClass="bg-sky-50 text-sky-700" />
        </button>
      </section>

      <section className="admin-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Bộ lọc bản đồ</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lọc theo phường, danh mục và mức độ cần theo dõi.</p>
          </div>
          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Lucide.RotateCcw size={15} /> Xóa bộ lọc
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-12">
          <label className="relative block xl:col-span-5">
            <span className="sr-only">Tìm sự vụ trên bản đồ</span>
            <Lucide.Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setFitRequestKey((key) => key + 1); }}
              placeholder="Tìm mã, tiêu đề, phường, danh mục..."
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <ManagerSelectMenu value={areaFilter} onChange={applyFilter(setAreaFilter)} options={areaOptions} ariaLabel="Lọc theo phường" className="xl:col-span-3" />
          <ManagerSelectMenu value={categoryFilter} onChange={applyFilter(setCategoryFilter)} options={categoryOptions} ariaLabel="Lọc theo danh mục" className="xl:col-span-4" />
          <ManagerSelectMenu value={statusFilter} onChange={applyFilter(setStatusFilter)} options={STATUS_OPTIONS} ariaLabel="Lọc theo trạng thái" className="xl:col-span-4" />
          <ManagerSelectMenu value={severityFilter} onChange={applyFilter(setSeverityFilter)} options={SEVERITY_OPTIONS} ariaLabel="Lọc theo mức nghiêm trọng" className="xl:col-span-4" />
          <ManagerSelectMenu value={priorityFilter} onChange={applyFilter(setPriorityFilter)} options={PRIORITY_OPTIONS} ariaLabel="Lọc theo ưu tiên" className="xl:col-span-4" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{loading ? 'Đang tải dữ liệu…' : `${visibleIncidents.length} sự vụ phù hợp · ${mappedIncidents.length} có tọa độ`}</span>
          <AdminRefreshIndicator visible={refreshing} label="Đang đồng bộ bản đồ…" />
        </div>
      </section>

      {warning ? <p className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300"><Lucide.TriangleAlert size={14} />{warning}</p> : null}

      {error && incidents.length === 0 ? (
        <AdminErrorState title="Không thể tải bản đồ sự vụ" description={error} onRetry={() => load()} />
      ) : (
        <section ref={mapSectionRef} className="admin-panel scroll-mt-24 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{areaLabel}</p>
              <p className="mt-0.5 text-xs text-slate-500">{mappedIncidents.length} vị trí trên bản đồ · {visibleIncidents.length}/{incidents.length} sự vụ trong phạm vi lọc</p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Chọn điểm sự vụ để xem chi tiết.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {missingCoordinates > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/management/incidents?coordinates=missing', {
                    state: {
                      from: `${location.pathname}${location.search}`,
                      preserveScroll: true,
                    },
                  })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300"
                  aria-label={`Mở danh sách ${missingCoordinates} sự vụ thiếu tọa độ`}
                >
                  <Lucide.MapPinOff size={14} />
                  <span>{missingCoordinates} sự vụ thiếu tọa độ</span>
                </button>
              ) : null}
              <div className="flex flex-wrap items-center gap-2" aria-label="Lớp hiển thị bản đồ">
                <span className="mr-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Lớp bản đồ</span>
                <button type="button" onClick={() => setShowMarkers((value) => !value)} aria-pressed={showMarkers} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${showMarkers ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
                  <Lucide.MapPin size={14} /> <span>Điểm sự vụ</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${showMarkers ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </button>
                <button type="button" onClick={() => setShowHeatLayer((value) => !value)} aria-pressed={showHeatLayer} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${showHeatLayer ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
                  <Lucide.Flame size={14} /> <span>Điểm nóng</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${showHeatLayer ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                </button>
              </div>
            </div>
          </div>
          <div className="relative">
            <IncidentMap
              incidents={mappedIncidents}
              fitRequestKey={fitRequestKey}
              detailPathBuilder={(item) => `/management/incidents/${item?.incidentId || item?.feedbackId}`}
              returnPath={`${location.pathname}${location.search}`}
              areaBoundaryGeoJson={selectedAreaBoundary}
              areaBoundaryKey={areaFilter === 'all' ? null : areaFilter}
              areaCenterLatitude={selectedArea?.centerLatitude}
              areaCenterLongitude={selectedArea?.centerLongitude}
              autoFitIncidents={areaFilter === 'all' || !selectedArea}
              showMarkers={showMarkers}
              showHeatLayer={showHeatLayer}
            />
            {loading && incidents.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 z-[520] flex items-center justify-center bg-slate-950/5 backdrop-blur-[1px] dark:bg-slate-950/15" role="status" aria-live="polite">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200"><span className="loading loading-spinner loading-sm" />Đang chuẩn bị bản đồ…</span>
              </div>
            ) : refreshing ? (
              <div className="pointer-events-none absolute left-4 top-4 z-[520]" role="status" aria-live="polite">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-md backdrop-blur dark:border-blue-400/20 dark:bg-slate-950/95 dark:text-blue-300"><span className="loading loading-spinner loading-xs" />Đang đồng bộ dữ liệu…</span>
              </div>
            ) : null}
            {!loading && visibleIncidents.length === 0 ? (
              <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 px-3">
                <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-center shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">0 sự vụ phù hợp bộ lọc</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Điều chỉnh bộ lọc để xem lại dữ liệu trên bản đồ.</p>
                </div>
              </div>
            ) : !loading && visibleIncidents.length > 0 && mappedIncidents.length === 0 ? (
              <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 px-3">
                <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-center shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Chưa có điểm có tọa độ</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Các sự vụ phù hợp chưa có tọa độ hợp lệ để đánh dấu.</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {!loading && visibleIncidents.length > 0 ? (
        <section className="admin-panel overflow-hidden" aria-label="Tóm tắt phạm vi bản đồ">
          <div className="grid gap-0 lg:grid-cols-3">
            <div className="min-w-0 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Phường nhiều sự vụ nhất</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{summary.topArea?.name || 'Chưa có dữ liệu'}</p>
                <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">{summary.topArea ? `${summary.topArea.count} sự vụ` : '—'}</span>
              </div>
            </div>
            <div className="min-w-0 border-t border-slate-200 px-5 py-4 lg:border-l lg:border-t-0 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Danh mục nổi bật</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{summary.topCategory?.name || 'Chưa có dữ liệu'}</p>
                <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">{summary.topCategory ? `${summary.topCategory.count} sự vụ` : '—'}</span>
              </div>
            </div>
            <div className="min-w-0 border-t border-slate-200 px-5 py-4 lg:border-l lg:border-t-0 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Thiếu tọa độ</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="text-xl font-bold text-slate-950 dark:text-white">{summary.missingCoordinates}</p>
                <span className="text-sm text-slate-500 dark:text-slate-400">không thể hiển thị trên bản đồ</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {error && incidents.length > 0 ? <p className="inline-flex items-center gap-2 text-sm font-medium text-rose-600"><Lucide.CircleAlert size={16} />{error}</p> : null}
    </div>
  );
};

export default AdminIncidentMapPage;
