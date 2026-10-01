import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_ROLES } from '@urbanmind/shared-types';
import { toolsApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole } from '../../utils/roleMap';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { ManagerListRefreshIndicator, ManagerSelectMenu } from '../../components/manager/ManagerPageElements';
import { getCoordinatorDirectoryCache, setCoordinatorDirectoryCache } from '../../services/cache/adminCoordinatorDirectoryCache';
import { getCategoryLabel } from '../../utils/categoryLabels';


const unwrapList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.msg || error?.message || fallback;

const getScrollContainer = () =>
  document.querySelector('[data-dashboard-scroll-container]') || document.scrollingElement;

const COORDINATOR_PAGE_SIZE = 8;

export default function CoordinatorDirectoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupCoverage = location.state?.setupCoverage || null;
  const initialCache = useMemo(() => getCoordinatorDirectoryCache(), []);
  const restoredContext = useMemo(() => {
    if (!location.state?.restoreCoordinatorList || !initialCache.hasLoaded) return null;
    return {
      coordinatorId: String(initialCache.selectedCoordinatorId || ''),
      scrollY: Number(initialCache.scrollY) || 0,
      pendingRestore: Boolean(initialCache.pendingRestore),
    };
  }, [initialCache, location.state?.restoreCoordinatorList]);
  const restoreContextRef = useRef(restoredContext);
  const highlightTimerRef = useRef(null);
  const shouldDeferBackgroundRefreshRef = useRef(Boolean(restoredContext));
  const hasLoadedRef = useRef(initialCache.hasLoaded);
  const coordinatorRequestIdRef = useRef(0);
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canManage = role === APP_ROLES.ADMINISTRATOR || role === APP_ROLES.INTERACTION_MANAGER;

  const [items, setItems] = useState(initialCache.items);
  const [summaryItems, setSummaryItems] = useState(initialCache.items);
  const [areas, setAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(!initialCache.hasLoaded);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [search, setSearch] = useState(initialCache.search);
  const [areaId, setAreaId] = useState(initialCache.areaId);
  const [categoryId, setCategoryId] = useState(initialCache.categoryId);
  const [statusFilter, setStatusFilter] = useState(
    initialCache.statusFilter || (initialCache.includeInactive ? 'all' : 'active')
  );
  const [restoreComplete, setRestoreComplete] = useState(() => !restoredContext);
  const [highlightedCoordinatorId, setHighlightedCoordinatorId] = useState('');
  const [page, setPage] = useState(1);

  const loadReferenceData = useCallback(async () => {
    setMetadataLoading(true);
    setMetadataError('');
    const [areaResult, categoryResult, coordinatorResult] = await Promise.allSettled([
      toolsApi.getAreas(),
      toolsApi.getCategories(),
      managementFeedbackApi.getServiceProviders({ includeInactive: true }),
    ]);

    setAreas(areaResult.status === 'fulfilled' ? unwrapList(areaResult.value) : []);
    setCategories(categoryResult.status === 'fulfilled' ? unwrapList(categoryResult.value) : []);
    if (coordinatorResult.status === 'fulfilled') {
      setSummaryItems(unwrapList(coordinatorResult.value));
    }

    const failed = [];
    if (areaResult.status === 'rejected') failed.push('khu vực');
    if (categoryResult.status === 'rejected') failed.push('danh mục');
    if (coordinatorResult.status === 'rejected') failed.push('chỉ số tổng quan');
    if (failed.length) {
      setMetadataError(`Không thể tải ${failed.join(', ')}. Một số bộ lọc hoặc chỉ số có thể chưa đầy đủ.`);
    }
    setMetadataLoading(false);
  }, []);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  const fetchCoordinators = useCallback(async ({ keepCurrent = false } = {}) => {
    const requestId = ++coordinatorRequestIdRef.current;
    const shouldKeepCurrent = keepCurrent || hasLoadedRef.current;
    if (shouldKeepCurrent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await managementFeedbackApi.getServiceProviders({
        search: search.trim() || undefined,
        areaId: areaId || undefined,
        categoryId: categoryId || undefined,
        includeInactive: true,
      });
      if (requestId !== coordinatorRequestIdRef.current) return;

      const nextItems = unwrapList(response);
      setItems(nextItems);
      hasLoadedRef.current = true;
      setCoordinatorDirectoryCache({
        items: nextItems,
        search,
        areaId,
        categoryId,
        includeInactive: true,
        hasLoaded: true,
        updatedAt: Date.now(),
      });
    } catch (err) {
      if (requestId !== coordinatorRequestIdRef.current) return;

      setError(getErrorMessage(err, 'Không thể tải danh sách điều phối viên.'));
      if (!shouldKeepCurrent) setItems([]);
    } finally {
      if (requestId === coordinatorRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [search, areaId, categoryId]);

  useEffect(() => {
    if (shouldDeferBackgroundRefreshRef.current) return undefined;

    const timer = window.setTimeout(
      () => fetchCoordinators({ keepCurrent: hasLoadedRef.current }),
      250
    );
    return () => window.clearTimeout(timer);
  }, [fetchCoordinators]);

  useEffect(() => {
    if (!restoreComplete || !shouldDeferBackgroundRefreshRef.current) return;

    shouldDeferBackgroundRefreshRef.current = false;
    fetchCoordinators({ keepCurrent: true });
  }, [fetchCoordinators, restoreComplete]);

  useEffect(() => {
    setCoordinatorDirectoryCache({
      search,
      areaId,
      categoryId,
      includeInactive: true,
      statusFilter,
    });
  }, [search, areaId, categoryId, statusFilter]);

  useEffect(() => () => {
    coordinatorRequestIdRef.current += 1;
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const savedContext = restoreContextRef.current;
    if (!savedContext?.pendingRestore || loading || items.length === 0) {
      return undefined;
    }

    let cancelled = false;
    let retryCount = 0;
    let retryTimer = null;

    const consumeReturnContext = () => {
      setCoordinatorDirectoryCache({
        selectedCoordinatorId: '',
        pendingRestore: false,
      });
      restoreContextRef.current = null;
      setRestoreComplete(true);
    };

    const restorePosition = () => {
      if (cancelled) return;

      const coordinatorId = String(savedContext.coordinatorId || '');
      const escapedCoordinatorId = (
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(coordinatorId)
          : coordinatorId.replace(/["\\]/g, '\\$&')
      );
      const targetRow = escapedCoordinatorId
        ? document.querySelector(
          `[data-admin-coordinator-id="${escapedCoordinatorId}"]`
        )
        : null;
      const scrollContainer = getScrollContainer();

      if (!targetRow || !scrollContainer) {
        retryCount += 1;
        if (retryCount < 30) {
          retryTimer = window.setTimeout(restorePosition, 100);
          return;
        }

        scrollContainer?.scrollTo({
          top: Number(savedContext.scrollY) || 0,
          left: 0,
          behavior: 'auto',
        });
        consumeReturnContext();
        return;
      }

      window.requestAnimationFrame(() => {
        if (cancelled) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const rowRect = targetRow.getBoundingClientRect();
        const rowTopInContainer = (
          scrollContainer.scrollTop + rowRect.top - containerRect.top
        );
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
        setHighlightedCoordinatorId(coordinatorId);
        if (highlightTimerRef.current) {
          window.clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightedCoordinatorId('');
        }, 2500);
        consumeReturnContext();
      });
    };

    restorePosition();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [items, loading]);

  const openCoordinator = (id) => {
    setCoordinatorDirectoryCache({
      items,
      search,
      areaId,
      categoryId,
      includeInactive: true,
      statusFilter,
      scrollY: getScrollContainer()?.scrollTop || 0,
      selectedCoordinatorId: String(id),
      pendingRestore: true,
      hasLoaded: true,
    });
    navigate(`/management/coordinators/${id}`, {
      state: setupCoverage ? { setupCoverage } : undefined,
    });
  };

  const cancelCoverageSetup = () => {
    if (setupCoverage?.returnTo) {
      navigate(setupCoverage.returnTo);
      return;
    }
    navigate('/management/coordinators', { replace: true });
  };

  const stats = useMemo(() => ({
    total: summaryItems.length,
    active: summaryItems.filter((item) => item.isActive).length,
    inactive: summaryItems.filter((item) => !item.isActive).length,
    coverages: summaryItems.reduce((sum, item) => sum + Number(item.coverageCount || 0), 0),
  }), [summaryItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'active') return items.filter((item) => item.isActive);
    if (statusFilter === 'inactive') return items.filter((item) => !item.isActive);
    return items;
  }, [items, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / COORDINATOR_PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * COORDINATOR_PAGE_SIZE;
    return filteredItems.slice(start, start + COORDINATOR_PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [search, areaId, categoryId, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const summaryCards = [
    {
      label: 'Tổng điều phối viên',
      value: stats.total,
      icon: Lucide.Users,
      helper: 'Tất cả đơn vị',
      filter: 'all',
    },
    {
      label: 'Đang hoạt động',
      value: stats.active,
      icon: Lucide.CircleCheck,
      helper: 'Có thể nhận phân công',
      filter: 'active',
    },
    {
      label: 'Đã vô hiệu hóa',
      value: stats.inactive,
      icon: Lucide.CircleOff,
      helper: 'Tạm ngừng hoạt động',
      filter: 'inactive',
    },
    {
      label: 'Phạm vi phụ trách',
      value: stats.coverages,
      icon: Lucide.MapPinned,
      helper: 'Tổng khu vực – danh mục',
      filter: null,
    },
  ];

  return (
    <div className="admin-page-shell space-y-6">
      <section className="admin-page-hero">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-cyan-100/50 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="admin-hero-icon"><Lucide.Network size={22} /></div>
            <div className="min-w-0">
              <h1 className="admin-hero-title">Quản lý điều phối viên</h1>
              <p className="admin-hero-description">Quản lý điều phối viên và phạm vi phụ trách theo khu vực, danh mục.</p>
            </div>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() =>
                navigate('/management/coordinators/new', {
                  state: setupCoverage ? { setupCoverage } : undefined,
                })
              }
              className="btn h-11 rounded-xl border-0 bg-blue-600 px-4 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
            >
              <Lucide.Plus size={18} /> Thêm điều phối viên
            </button>
          )}
        </div>
      </section>


      {setupCoverage ? (
        <section className="rounded-[22px] border border-blue-200 bg-blue-50/90 p-4 shadow-sm dark:border-blue-400/20 dark:bg-blue-500/10 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Lucide.Link2 size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-950 dark:text-slate-100">Chọn điều phối viên để thiết lập đầu mối</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Danh mục <strong>{setupCoverage.categoryName || `Mã #${setupCoverage.categoryId}`}</strong> sẽ được chọn sẵn. Bấm vào một điều phối viên, sau đó chọn khu vực phụ trách và lưu.
                </p>
              </div>
            </div>
            <button type="button" onClick={cancelCoverageSetup} className="btn btn-sm rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
              <Lucide.X size={15} /> Hủy thiết lập
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, helper, filter }) => {
          const selectable = Boolean(filter);
          const selected = selectable && statusFilter === filter;
          return (
            <div
              key={label}
              role={selectable ? 'button' : undefined}
              tabIndex={selectable ? 0 : undefined}
              onClick={selectable ? () => setStatusFilter(filter) : undefined}
              onKeyDown={selectable ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setStatusFilter(filter);
                }
              } : undefined}
              className={`rounded-[20px] border bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all dark:bg-slate-950/70 ${
                selectable
                  ? `cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:hover:border-blue-500/50 ${
                    selected
                      ? 'border-blue-400 ring-2 ring-blue-100 dark:border-blue-400/70 dark:ring-blue-500/15'
                      : 'border-slate-200 dark:border-slate-700'
                  }`
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{helper}</p></div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><Icon size={18} /></div>
              </div>
            </div>
          );
        })}
      </section>

      {metadataError ? (
        <section className="admin-error-note flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span className="inline-flex items-start gap-2 text-sm font-medium">
            <Lucide.CircleAlert size={17} className="mt-0.5 shrink-0" />
            {metadataError}
          </span>
          <button
            type="button"
            onClick={() => void loadReferenceData()}
            disabled={metadataLoading}
            className="btn admin-secondary-action h-9 shrink-0 rounded-xl px-4 text-xs font-semibold normal-case"
          >
            <Lucide.RefreshCw size={15} className={metadataLoading ? 'animate-spin' : ''} />
            {metadataLoading ? 'Đang tải' : 'Tải lại dữ liệu'}
          </button>
        </section>
      ) : null}

      <section className="admin-panel relative overflow-hidden">
        <div className="manager-list-panel-header bg-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách điều phối viên</h2>
                  <ManagerListRefreshIndicator visible={refreshing && !loading} label="Đang cập nhật" />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tổng cộng {summaryItems.length} điều phối viên · {filteredItems.length} phù hợp</p>
              </div>
              {(search || areaId || categoryId || statusFilter !== 'active') ? (
                <button type="button" onClick={() => { setSearch(''); setAreaId(''); setCategoryId(''); setStatusFilter('active'); setPage(1); }} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Lucide.RotateCcw size={15} /> Xóa bộ lọc
                </button>
              ) : null}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1.45fr)_minmax(190px,0.8fr)_minmax(190px,0.8fr)_minmax(180px,0.75fr)]">
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-950/70">
                <Lucide.Search size={17} className="text-slate-400" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500" placeholder="Tìm đơn vị, người phụ trách, email, số điện thoại" />
              </label>
              <ManagerSelectMenu
                value={areaId}
                onChange={(value) => { setAreaId(value); setPage(1); }}
                ariaLabel="Lọc khu vực"
                className="h-11"
                disabled={metadataLoading || areas.length === 0}
                options={[
                  { value: '', label: 'Tất cả khu vực' },
                  ...areas.map((area) => ({ value: area.areaId ?? area.id, label: area.areaName ?? area.name })),
                ]}
              />
              <ManagerSelectMenu
                value={categoryId}
                onChange={(value) => { setCategoryId(value); setPage(1); }}
                ariaLabel="Lọc danh mục"
                className="h-11"
                disabled={metadataLoading || categories.length === 0}
                options={[
                  { value: '', label: 'Tất cả danh mục' },
                  ...categories.map((category) => ({ value: category.categoryId ?? category.id, label: getCategoryLabel(category.categoryName ?? category.name) })),
                ]}
              />
              <ManagerSelectMenu
                value={statusFilter}
                onChange={(value) => { setStatusFilter(value); setPage(1); }}
                ariaLabel="Lọc trạng thái điều phối viên"
                className="h-11"
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'inactive', label: 'Đã vô hiệu hóa' },
                ]}
              />
            </div>
          </div>
        </div>

        {error && <div className="px-5 pt-4"><ErrorAlert title="Không tải được dữ liệu" message={error} /></div>}

        <div className="min-w-0 overflow-hidden">
          <table className="table table-fixed w-full text-sm text-slate-700 dark:text-slate-200">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[17%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
              <tr><th>Đơn vị cung cấp</th><th>Người phụ trách</th><th>Liên hệ</th><th>Phạm vi phụ trách</th><th>Trạng thái</th><th /></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="py-12 text-center"><div className="inline-flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400"><span className="loading loading-spinner loading-md text-blue-600" /> Đang tải danh sách điều phối viên...</div></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="6" className="py-12 text-center text-slate-500">Không có điều phối viên phù hợp với bộ lọc.</td></tr>
              ) : paginatedItems.map((item) => {
                const id = item.coordinatorId ?? item.id;
                return (
                  <tr
                    key={id}
                    data-admin-coordinator-id={String(id)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-500/5 ${
                      String(highlightedCoordinatorId) === String(id)
                        ? 'bg-blue-100/80 ring-1 ring-inset ring-blue-300 dark:bg-blue-500/15 dark:ring-blue-400/40'
                        : ''
                    }`}
                    onClick={() => openCoordinator(id)}
                  >
                    <td className="min-w-0"><div className="break-words font-semibold text-slate-950 dark:text-slate-100">{item.providerName || '—'}</div><div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Mã: {id}</div></td>
                    <td className="break-words font-medium text-slate-700 dark:text-slate-300">{item.coordinatorName || item.name || '—'}</td>
                    <td className="min-w-0"><div>{item.phoneNumber || '—'}</div><div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={item.email || ''}>{item.email || '—'}</div></td>
                    <td><span className="inline-flex rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{item.coverageCount ?? 0}</span></td>
                    <td><span className={`badge border-0 font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{item.isActive ? 'Hoạt động' : 'Đã vô hiệu hóa'}</span></td>
                    <td className="whitespace-nowrap text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openCoordinator(id); }} className="whitespace-nowrap text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">Chi tiết</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filteredItems.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Hiển thị {Math.min((page - 1) * COORDINATOR_PAGE_SIZE + 1, filteredItems.length)}–{Math.min(page * COORDINATOR_PAGE_SIZE, filteredItems.length)} / {filteredItems.length} điều phối viên</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn btn-sm rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Trước</button>
              <span className="min-w-24 text-center font-semibold text-slate-700 dark:text-slate-200">Trang {page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="btn btn-sm rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Sau</button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
