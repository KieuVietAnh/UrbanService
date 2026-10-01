import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { incidentDashboardApi, incidentManagementApi, slaApi } from '@urbanmind/shared-api';
import {
  ManagerMetricCard,
  ManagerPageHeader,
  ManagerSectionHeader,
} from '../../components/manager/ManagerPageElements';
import {
  AdminErrorState,
  AdminRefreshIndicator,
} from '../../components/admin/AdminDataStates';
import { AdminIncidentDistributionPanel } from '../../components/admin/AdminIncidentDistributionPanel';
import {
  buildAdminIncidentSummary,
  buildAdminIncidentSummaryFromDashboard,
  getAdminDashboardCacheState,
  getAdminIncidentStatusLabel,
  sortRecentIncidents,
} from './adminIncidentDashboardUtils.mjs';
import {
  readAdminDashboardCache,
  writeAdminDashboardCache,
} from '../../services/cache/adminDashboardCache';

const PRIORITY_LABELS = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp',
  critical: 'Khẩn cấp',
};

const STATUS_TONES = {
  submitted: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300',
  aireviewed: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300',
  new: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300',
  open: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300',
  pending: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  verified: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300',
  assigned: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300',
  inprogress: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  submittedforapproval: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-300',
  needrework: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-300',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  canceled: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  merged: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300',
  closed: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const normalizeToken = (value) => String(value || '')
  .trim()
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatIncidentCode = (incident) => {
  const raw = String(
    incident?.incidentCode ||
    incident?.code ||
    incident?.incidentId ||
    incident?.id ||
    '',
  ).trim();

  if (!raw) return '—';
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}…`;
};

const readPriorityLabel = (value) => (
  PRIORITY_LABELS[String(value || '').trim().toLowerCase()] ||
  value ||
  'Chưa xác định'
);

const getStatusBarClass = (value) => {
  const key = normalizeToken(value);
  if (['resolved', 'approved'].includes(key)) return 'bg-emerald-500';
  if (['closed', 'cancelled', 'canceled'].includes(key)) return 'bg-slate-400';
  if (['inprogress'].includes(key)) return 'bg-amber-500';
  if (['needrework'].includes(key)) return 'bg-orange-500';
  if (['assigned', 'aireviewed', 'submittedforapproval'].includes(key)) return 'bg-violet-500';
  if (['verified', 'submitted', 'new', 'open'].includes(key)) return 'bg-blue-500';
  return 'bg-cyan-500';
};

const flattenAreaMapIncidents = (areaDistribution = []) => (
  (Array.isArray(areaDistribution) ? areaDistribution : []).flatMap((area) => (
    (Array.isArray(area?.points) ? area.points : []).map((point) => ({
      ...point,
      areaId: point?.areaId ?? area?.areaId,
      areaName: point?.areaName ?? area?.areaName,
    }))
  ))
);


const StatusBadge = ({ status }) => {
  const tone = STATUS_TONES[normalizeToken(status)] || 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {getAdminIncidentStatusLabel(status)}
    </span>
  );
};

export const AdminDashboardPage = () => {
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(null);
  const mountedRef = useRef(true);
  const [initialCacheState] = useState(() => (
    getAdminDashboardCacheState(readAdminDashboardCache())
  ));
  const [incidents, setIncidents] = useState(initialCacheState.incidents);
  const [recentIncidentItems, setRecentIncidentItems] = useState(initialCacheState.recentIncidents);
  const [totalItems, setTotalItems] = useState(initialCacheState.totalItems);
  const [dashboardOverview, setDashboardOverview] = useState(initialCacheState.dashboardOverview);
  const [statusDistribution, setStatusDistribution] = useState(initialCacheState.statusDistribution);
  const [priorityDistribution, setPriorityDistribution] = useState(initialCacheState.priorityDistribution);
  const [categoryDistribution, setCategoryDistribution] = useState(initialCacheState.categoryDistribution);
  const [areaDistribution, setAreaDistribution] = useState(initialCacheState.areaDistribution);
  const [slaOverview, setSlaOverview] = useState(initialCacheState.slaOverview);
  const [loading, setLoading] = useState(!initialCacheState.hasData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async ({ background = false } = {}) => {
    if (inFlightRef.current) return inFlightRef.current;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    setWarning('');

    const task = (async () => {
      try {
        const [
          overviewResult,
          statusResult,
          priorityResult,
          categoryResult,
          areaResult,
          recentResult,
          slaResult,
        ] = await Promise.allSettled([
          incidentDashboardApi.getOverview(),
          incidentDashboardApi.getStatusDistribution(),
          incidentDashboardApi.getPriorityDistribution(),
          incidentDashboardApi.getCategoryDistribution(),
          incidentDashboardApi.getAreaDistribution(),
          incidentManagementApi.getIncidents({
            pageNumber: 1,
            pageSize: 5,
            includeMerged: false,
          }, { signal: controller.signal }),
          slaApi.getDashboardOverview(),
        ]);

        if (!mountedRef.current || requestId !== requestIdRef.current) return;

        const coreResults = [overviewResult, statusResult, priorityResult, categoryResult, areaResult];
        if (coreResults.every((result) => result.status === 'rejected')) {
          throw overviewResult.reason || statusResult.reason || areaResult.reason || new Error('Không thể tải dữ liệu dashboard.');
        }

        const cachePatch = {};

        if (overviewResult.status === 'fulfilled') {
          setDashboardOverview(overviewResult.value);
          setTotalItems(Number(overviewResult.value?.totalIncident) || 0);
          cachePatch.dashboardOverview = overviewResult.value;
          cachePatch.totalItems = Number(overviewResult.value?.totalIncident) || 0;
        }
        if (statusResult.status === 'fulfilled') {
          setStatusDistribution(statusResult.value);
          cachePatch.statusDistribution = statusResult.value;
        }
        if (priorityResult.status === 'fulfilled') {
          setPriorityDistribution(priorityResult.value);
          cachePatch.priorityDistribution = priorityResult.value;
        }
        if (categoryResult.status === 'fulfilled') {
          setCategoryDistribution(categoryResult.value);
          cachePatch.categoryDistribution = categoryResult.value;
        }
        if (areaResult.status === 'fulfilled') {
          const nextAreas = areaResult.value;
          const nextMapIncidents = flattenAreaMapIncidents(nextAreas);
          setAreaDistribution(nextAreas);
          setIncidents(nextMapIncidents);
          cachePatch.areaDistribution = nextAreas;
          cachePatch.incidents = nextMapIncidents;
        }
        if (recentResult.status === 'fulfilled') {
          const nextRecent = recentResult.value?.items || [];
          setRecentIncidentItems(nextRecent);
          cachePatch.recentIncidents = nextRecent;
        }
        if (slaResult.status === 'fulfilled') {
          setSlaOverview(slaResult.value);
          cachePatch.slaOverview = slaResult.value;
        }

        writeAdminDashboardCache(cachePatch);

        const issues = [];
        if (overviewResult.status === 'rejected') issues.push('KPI tổng quan');
        if (statusResult.status === 'rejected') issues.push('phân bố trạng thái');
        if (priorityResult.status === 'rejected') issues.push('phân bố ưu tiên');
        if (categoryResult.status === 'rejected') issues.push('phân bố danh mục');
        if (areaResult.status === 'rejected') issues.push('dữ liệu theo phường và bản đồ');
        if (recentResult.status === 'rejected') issues.push('sự vụ gần đây');
        if (slaResult.status === 'rejected') issues.push('dữ liệu SLA');
        if (issues.length > 0) {
          setWarning(`Chưa tải được ${issues.join(', ')}. Các phần còn lại vẫn giữ dữ liệu hợp lệ.`);
        }
      } catch (loadError) {
        if (loadError?.name === 'AbortError' || !mountedRef.current || requestId !== requestIdRef.current) return;
        setError(
          loadError?.response?.data?.message ||
          loadError?.message ||
          'Không thể tải tổng quan hệ thống.',
        );
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    inFlightRef.current = task;
    try {
      return await task;
    } finally {
      if (inFlightRef.current === task) inFlightRef.current = null;
    }
  }, []);


  useEffect(() => {
    mountedRef.current = true;

    if (!initialCacheState.hasData) {
      void load();
    } else if (initialCacheState.shouldRevalidate) {
      void load({ background: true });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [initialCacheState.hasData, initialCacheState.shouldRevalidate, load]);

  const hasAggregateDashboardData = Boolean(dashboardOverview) || [
    statusDistribution,
    priorityDistribution,
    categoryDistribution,
    areaDistribution,
  ].some((items) => items.length > 0);
  const summary = hasAggregateDashboardData
    ? buildAdminIncidentSummaryFromDashboard({
        overview: dashboardOverview,
        statusDistribution,
        priorityDistribution,
        categoryDistribution,
        areaDistribution,
      })
    : buildAdminIncidentSummary(incidents, totalItems);
  const recentIncidents = recentIncidentItems.length > 0
    ? sortRecentIncidents(recentIncidentItems, 5)
    : (!hasAggregateDashboardData ? sortRecentIncidents(incidents, 5) : []);
  const statusMax = Math.max(...summary.statuses.map((item) => item.count), 1);
  const slaBreached = Number(slaOverview?.breachedSla ?? slaOverview?.breached ?? 0);
  const slaWarning = Number(slaOverview?.warningSla ?? slaOverview?.warning ?? 0);
  const topAreaValue = summary.topArea
    ? `${summary.topArea.name} · ${summary.topArea.count}`
    : 'Chưa có dữ liệu';
  const priorityRows = useMemo(() => {
    const counts = new Map([
      ['urgent', 0],
      ['high', 0],
      ['medium', 0],
      ['low', 0],
    ]);

    priorityDistribution.forEach((item) => {
      const rawKey = normalizeToken(item?.priority);
      const key = rawKey === 'critical' ? 'urgent' : (rawKey === 'normal' ? 'medium' : rawKey);
      if (counts.has(key)) counts.set(key, counts.get(key) + (Number(item?.count) || 0));
    });

    return [
      { key: 'urgent', label: 'Khẩn cấp', count: counts.get('urgent'), barClass: 'bg-rose-500' },
      { key: 'high', label: 'Cao', count: counts.get('high'), barClass: 'bg-orange-500' },
      { key: 'medium', label: 'Trung bình', count: counts.get('medium'), barClass: 'bg-amber-400' },
      { key: 'low', label: 'Thấp', count: counts.get('low'), barClass: 'bg-emerald-500' },
    ];
  }, [priorityDistribution]);
  const priorityMax = Math.max(1, ...priorityRows.map((item) => item.count));
  const priorityTotal = priorityRows.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="admin-page-shell manager-ui-page space-y-4 pb-6">
      <ManagerPageHeader
        title="Tổng quan hệ thống"
        description="Theo dõi sự vụ, từng phường và tín hiệu SLA toàn hệ thống."
        icon={Lucide.LayoutDashboard}
        statusLabel={<span className="whitespace-nowrap">Phường có nhiều sự vụ nhất</span>}
        statusValue={loading ? 'Đang tải…' : (
          <span className="inline-block max-w-[220px] truncate whitespace-nowrap align-bottom" title={topAreaValue}>
            {topAreaValue}
          </span>
        )}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/management/map"
              className="admin-secondary-link inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold"
            >
              <Lucide.MapPinned size={16} aria-hidden="true" />
              Bản đồ sự vụ
            </Link>
            <Link
              to="/management/incidents"
              className="admin-primary-action btn h-10 rounded-xl px-4 text-sm font-semibold normal-case"
            >
              <Lucide.Siren size={16} aria-hidden="true" />
              Quản lý sự vụ
            </Link>
            <button
              type="button"
              onClick={() => load({ background: true })}
              disabled={loading || refreshing}
              className="admin-secondary-action btn h-10 rounded-xl px-3 text-sm font-semibold normal-case"
              aria-label="Làm mới tổng quan hệ thống"
              title="Làm mới"
            >
              <Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        )}
      />

      {error && !initialCacheState.hasData && !hasAggregateDashboardData ? (
        <AdminErrorState
          title="Không thể tải tổng quan sự vụ"
          description={error}
          onRetry={() => load()}
        />
      ) : (
        <>
          {(refreshing || warning) ? (
            <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
              <AdminRefreshIndicator visible={refreshing} label="Đang đồng bộ dữ liệu sự vụ…" />
              {warning ? (
                <p className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300" role="status">
                  <Lucide.TriangleAlert size={14} aria-hidden="true" />
                  {warning}
                </p>
              ) : null}
            </div>
          ) : null}

          <section className="manager-kpi-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số tổng quan hệ thống">
            <ManagerMetricCard
              label="Tổng sự vụ"
              value={loading ? '—' : summary.total}
              description="Tổng số sự vụ trong phạm vi quản trị."
              icon={Lucide.Layers3}
              toneClass="bg-blue-50 text-blue-700"
              to="/management/incidents"
            />
            <ManagerMetricCard
              label="Đang mở"
              value={loading ? '—' : summary.open}
              description="Sự vụ chưa ở nhóm trạng thái kết thúc."
              icon={Lucide.Activity}
              toneClass="bg-cyan-50 text-cyan-700"
              to="/management/incidents"
            />
            <ManagerMetricCard
              label="Ưu tiên cao / khẩn"
              value={loading ? '—' : summary.highPriority}
              description="Sự vụ cần được theo dõi và điều phối sát."
              icon={Lucide.TriangleAlert}
              toneClass="bg-rose-50 text-rose-700"
              to="/management/incidents"
            />
            <ManagerMetricCard
              label="SLA cảnh báo · vi phạm"
              value={loading || !slaOverview ? '—' : `${slaWarning} · ${slaBreached}`}
              description="SLA đang gần hạn hoặc đã vượt cam kết."
              icon={Lucide.Gauge}
              toneClass="bg-amber-50 text-amber-700"
              to="/management/sla"
            />
          </section>

          <AdminIncidentDistributionPanel />

          <article data-admin-recent-incidents-section className="admin-panel min-w-0 overflow-hidden">
            <ManagerSectionHeader
              title="Sự vụ cập nhật gần đây"
              description="Các sự vụ có thay đổi mới nhất trên toàn hệ thống."
              icon={Lucide.Clock3}
              actions={(
                <Link to="/management/incidents" className="text-sm font-semibold text-blue-700 transition hover:text-blue-800 dark:text-blue-300">
                  Xem tất cả
                </Link>
              )}
            />

            <div data-admin-recent-incidents className="border-t border-slate-100 dark:border-slate-800">
              {recentIncidents.map((incident) => {
                const id = incident?.incidentId || incident?.id;
                return (
                  <Link
                    key={id}
                    to={`/management/incidents/${id}`}
                    state={{ from: '/dashboard' }}
                    className="group grid min-w-0 gap-3 border-b border-slate-100 px-5 py-4 transition last:border-b-0 hover:bg-slate-50/80 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(180px,0.45fr)_110px_150px_20px] lg:items-center dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 font-mono text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          {formatIncidentCode(incident)}
                        </span>
                        <strong className="min-w-0 truncate text-sm font-semibold text-slate-900 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                          {incident?.title || incident?.summary || 'Sự vụ đô thị'}
                        </strong>
                      </div>
                      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="min-w-0 truncate">{incident?.categoryName || 'Chưa xác định danh mục'}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Lucide.Clock3 size={12} aria-hidden="true" />
                          {formatDateTime(incident?.updatedAt || incident?.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 text-sm text-slate-600 dark:text-slate-300">
                      <span className="inline-flex max-w-full items-center gap-1.5">
                        <Lucide.MapPin size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{incident?.areaName || 'Chưa xác định phường'}</span>
                      </span>
                    </div>

                    <div className="flex items-center lg:justify-center">
                      <span className="inline-flex max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {readPriorityLabel(incident?.priority)}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-center lg:justify-center">
                      <StatusBadge status={incident?.status} />
                    </div>

                    <div className="hidden items-center justify-end lg:flex">
                      <Lucide.ChevronRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}

              {!loading && recentIncidents.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  Chưa có sự vụ để hiển thị.
                </div>
              ) : null}
            </div>
          </article>

          <section data-admin-dashboard-composition-grid className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
            <article className="admin-panel h-full overflow-hidden">
              <ManagerSectionHeader
                title="Trạng thái vận hành"
                description="Phân bố sự vụ theo trạng thái hiện tại."
                icon={Lucide.GitBranch}
                actions={(
                  <Link to="/management/incidents" className="text-sm font-semibold text-blue-700 transition hover:text-blue-800 dark:text-blue-300">
                    Xem sự vụ
                  </Link>
                )}
              />
              <div className="grid gap-x-5 gap-y-3 border-t border-slate-100 p-5 sm:grid-cols-2 dark:border-slate-800">
                {summary.statuses.slice(0, 6).map((item) => (
                  <div key={item.key} className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-600 dark:text-slate-300">
                        {getAdminIncidentStatusLabel(item.name)}
                      </span>
                      <strong className="shrink-0 tabular-nums text-slate-900 dark:text-white">{item.count}</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className={`block h-full rounded-full ${getStatusBarClass(item.name)}`}
                        style={{ width: `${Math.max(4, (item.count / statusMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!loading && summary.statuses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 sm:col-span-2">Chưa có dữ liệu trạng thái.</p>
                ) : null}
              </div>
            </article>

            <article className="admin-panel h-full overflow-hidden">
              <ManagerSectionHeader
                title="Cơ cấu ưu tiên"
                description="Theo dõi tỷ trọng sự vụ theo mức ưu tiên."
                icon={Lucide.SignalHigh}
                actions={(
                  <Link to="/management/incidents" className="text-sm font-semibold text-blue-700 transition hover:text-blue-800 dark:text-blue-300">
                    Xem sự vụ
                  </Link>
                )}
              />
              <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-label={`Tổng ${priorityTotal} sự vụ theo mức ưu tiên`}>
                  {priorityRows.map((item) => (
                    <span
                      key={`stack-${item.key}`}
                      className={item.barClass}
                      style={{ width: `${priorityTotal > 0 ? (item.count / priorityTotal) * 100 : 0}%` }}
                      title={`${item.label}: ${item.count}`}
                    />
                  ))}
                </div>

                <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  {priorityRows.map((item) => (
                    <div key={item.key} className="min-w-0">
                      <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.barClass}`} aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <strong className="shrink-0 tabular-nums text-slate-900 dark:text-white">{item.count}</strong>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <span
                          className={`block h-full rounded-full ${item.barClass}`}
                          style={{ width: `${item.count > 0 ? Math.max(5, (item.count / priorityMax) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          {error && (incidents.length > 0 || hasAggregateDashboardData) ? (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-rose-600" role="alert">
              <Lucide.CircleAlert size={16} aria-hidden="true" />
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default AdminDashboardPage;
