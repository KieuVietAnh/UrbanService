import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { slaApi } from '../../services/api/slaApi';
import {
  ManagerMetricCard,
  ManagerPageHeader,
  ManagerSectionHeader,
} from '../../components/manager/ManagerPageElements';

const EMPTY_OVERVIEW = {
  totalSla: 0,
  runningSla: 0,
  completedSla: 0,
  breachedSla: 0,
  warningSla: 0,
  successRate: 0,
  averageResolutionMinutes: 0,
};

const EMPTY_COMPLIANCE = { todayRate: 0, thisWeekRate: 0, thisMonthRate: 0 };
const EMPTY_PERFORMANCE = {
  averageResponseMinutes: 0,
  averageResolutionMinutes: 0,
  responseSuccessRate: 0,
  resolutionSuccessRate: 0,
};

const SOURCE_KEYS = ['overview', 'compliance', 'performance', 'trend', 'near', 'recent'];
const AVAILABLE_BY_DEFAULT = Object.fromEntries(SOURCE_KEYS.map((key) => [key, true]));
const SLA_ANALYTICS_SNAPSHOT_STORAGE_KEY = 'urbanmind-manager-sla-analytics-snapshot-v1';

const readSlaAnalyticsSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawSnapshot = window.sessionStorage.getItem(SLA_ANALYTICS_SNAPSHOT_STORAGE_KEY);
    if (!rawSnapshot) return null;

    const parsedSnapshot = JSON.parse(rawSnapshot);
    return parsedSnapshot && typeof parsedSnapshot === 'object' ? parsedSnapshot : null;
  } catch {
    return null;
  }
};

const writeSlaAnalyticsSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      SLA_ANALYTICS_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({ ...snapshot, updatedAt: Date.now() })
    );
  } catch {
    // Storage can be unavailable in private mode or when quota is exceeded.
  }
};

const toNumber = (value) => Number(value) || 0;
const clampPercent = (value) => Math.max(0, Math.min(100, toNumber(value)));

const normalizeOverview = (value) => ({
  totalSla: toNumber(value?.totalSla ?? value?.TotalSla),
  runningSla: toNumber(value?.runningSla ?? value?.RunningSla),
  completedSla: toNumber(value?.completedSla ?? value?.CompletedSla),
  breachedSla: toNumber(value?.breachedSla ?? value?.BreachedSla),
  warningSla: toNumber(value?.warningSla ?? value?.WarningSla),
  successRate: toNumber(value?.successRate ?? value?.SuccessRate),
  averageResolutionMinutes: toNumber(value?.averageResolutionMinutes ?? value?.AverageResolutionMinutes),
});

const normalizeCompliance = (value) => ({
  todayRate: clampPercent(value?.todayRate ?? value?.TodayRate),
  thisWeekRate: clampPercent(value?.thisWeekRate ?? value?.ThisWeekRate),
  thisMonthRate: clampPercent(value?.thisMonthRate ?? value?.ThisMonthRate),
});

const normalizePerformance = (value) => ({
  averageResponseMinutes: toNumber(value?.averageResponseMinutes ?? value?.AverageResponseMinutes),
  averageResolutionMinutes: toNumber(value?.averageResolutionMinutes ?? value?.AverageResolutionMinutes),
  responseSuccessRate: clampPercent(value?.responseSuccessRate ?? value?.ResponseSuccessRate),
  resolutionSuccessRate: clampPercent(value?.resolutionSuccessRate ?? value?.ResolutionSuccessRate),
});

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const formatDuration = (minutes) => {
  const safeMinutes = Math.max(0, toNumber(minutes));
  if (safeMinutes < 60) return `${Math.round(safeMinutes)} phút`;
  const hours = safeMinutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} giờ`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const formatShortDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const getIncidentSlaId = (item = {}) => (
  item?.incidentSlaId ?? item?.IncidentSlaId ?? item?.slaId ?? item?.SlaId ?? null
);
const getIncidentId = (item = {}) => item?.incidentId ?? item?.IncidentId ?? null;
const getIncidentTitle = (item = {}) => (
  item?.incidentTitle ?? item?.IncidentTitle ?? item?.title ?? item?.Title ?? 'Sự vụ chưa có tiêu đề'
);

const getBreachTypeMeta = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('response')) {
    return { label: 'Vi phạm thời hạn phản hồi', shortLabel: 'SLA phản hồi', Icon: Lucide.MessageCircleWarning };
  }
  if (normalized.includes('resolution')) {
    return { label: 'Vi phạm thời hạn hoàn thành', shortLabel: 'SLA hoàn thành', Icon: Lucide.BadgeCheck };
  }
  return { label: value || 'Vi phạm SLA', shortLabel: 'SLA', Icon: Lucide.ShieldAlert };
};

const getPriorityTone = (priority) => {
  const value = String(priority || '').toLowerCase();
  if (value === 'critical' || value === 'urgent') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value === 'high') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (value === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const formatPriority = (priority) => {
  const value = String(priority || '').trim().toLowerCase();
  if (value === 'critical' || value === 'urgent') return 'Khẩn cấp';
  if (value === 'high') return 'Cao';
  if (value === 'medium') return 'Trung bình';
  if (value === 'low') return 'Thấp';
  return priority || '—';
};

const RateBar = ({ label, value, tone = 'blue', detail }) => {
  const safeValue = clampPercent(value);
  const tones = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500' };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
          {detail ? <span className="ml-2 text-[11px] text-slate-400">{detail}</span> : null}
        </div>
        <strong className="text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{Math.round(safeValue)}%</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <span className={`block h-full rounded-full transition-[width] duration-500 ${tones[tone] || tones.blue}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
};

const SourceUnavailable = ({ text, compact = false }) => (
  <div className={`rounded-2xl border border-amber-200/80 bg-amber-50/70 text-amber-800 ${compact ? 'px-4 py-4 text-xs' : 'px-5 py-6 text-sm'}`} role="status">
    <div className="flex items-center gap-2">
      <Lucide.WifiOff size={16} aria-hidden="true" />
      <span>{text}</span>
    </div>
  </div>
);

const ViolationTrend = ({ data, available }) => {
  const normalized = useMemo(() => ([...data]
    .map((item) => ({ date: item?.date ?? item?.Date, count: toNumber(item?.count ?? item?.Count) }))
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))), [data]);
  const maxCount = Math.max(1, ...normalized.map((item) => item.count));
  const peak = normalized.reduce((best, item) => (item.count > (best?.count ?? -1) ? item : best), null);
  const points = normalized.map((item, index) => ({
    ...item,
    x: normalized.length === 1 ? 50 : (index / (normalized.length - 1)) * 100,
    y: 86 - ((item.count / maxCount) * 68),
  }));
  const linePoints = points.map((item) => `${item.x},${item.y}`).join(' ');
  const areaPoints = points.length > 0
    ? `${points[0].x},90 ${linePoints} ${points[points.length - 1].x},90`
    : '';

  if (!available) return <SourceUnavailable text="Không tải được dữ liệu xu hướng vi phạm." />;
  if (normalized.length === 0) return <div className="admin-empty-panel px-5 py-7 text-center text-sm text-slate-500">30 ngày gần đây chưa phát sinh sự kiện vi phạm SLA.</div>;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/45 px-4 pb-3 pt-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900/55 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
          <span>Mỗi điểm là số sự kiện vi phạm được ghi nhận trong ngày.</span>
        </div>
        {peak ? (
          <div className="flex items-baseline gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <span className="font-medium">Cao nhất</span>
            <strong className="tabular-nums">{peak.count} sự kiện</strong>
            <span className="text-rose-500/80">· {formatShortDate(peak.date)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-[26px_minmax(0,1fr)] gap-2">
        <div className="relative h-[158px] text-[10px] tabular-nums text-slate-400" aria-hidden="true">
          <span className="absolute right-0 top-[10px]">{maxCount}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{Math.round(maxCount / 2)}</span>
          <span className="absolute bottom-[8px] right-0">0</span>
        </div>

        <div className="min-w-0">
          <div className="relative h-[158px]">
            <span className="pointer-events-none absolute inset-x-0 top-[18%] border-t border-dashed border-slate-200/80 dark:border-slate-800" />
            <span className="pointer-events-none absolute inset-x-0 top-[52%] border-t border-dashed border-slate-200/80 dark:border-slate-800" />
            <span className="pointer-events-none absolute inset-x-0 top-[86%] border-t border-slate-200 dark:border-slate-800" />

            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="slaViolationArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={areaPoints} fill="url(#slaViolationArea)" />
              <polyline
                points={linePoints}
                fill="none"
                stroke="#e11d48"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {points.map((item) => (
              <button
                key={`${item.date}-${item.count}`}
                type="button"
                className="group absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-rose-500 shadow-[0_3px_10px_rgba(225,29,72,0.28)] outline-none transition hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-slate-950"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                aria-label={`${formatShortDate(item.date)}: ${item.count} sự kiện vi phạm`}
              >
                <span className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-20 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${item.x < 12 ? 'left-0' : item.x > 88 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                  {formatShortDate(item.date)} · {item.count} sự kiện
                </span>
              </button>
            ))}
          </div>

          <div
            className="mt-1 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {points.map((item) => (
              <span key={`label-${item.date}`} className="truncate text-center text-[10px] tabular-nums text-slate-400">
                {formatShortDate(item.date)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const groupRecentBreachesBySla = (items) => {
  const groups = new Map();
  items.forEach((item, index) => {
    const incidentId = getIncidentId(item);
    const incidentSlaId = getIncidentSlaId(item);
    const title = getIncidentTitle(item);
    const type = item?.type ?? item?.Type;
    const breachedAt = item?.breachedAt ?? item?.BreachedAt;
    const overdueMinutes = toNumber(item?.overdueMinutes ?? item?.OverdueMinutes);
    const key = incidentSlaId || incidentId || `unknown-${index}`;
    if (!groups.has(key)) groups.set(key, { key, incidentId, incidentSlaId, title, events: [] });
    groups.get(key).events.push({ type, breachedAt, overdueMinutes, ...getBreachTypeMeta(type) });
  });
  return Array.from(groups.values())
    .map((group) => ({ ...group, events: group.events.sort((a, b) => new Date(b.breachedAt || 0) - new Date(a.breachedAt || 0)) }))
    .sort((a, b) => new Date(b.events[0]?.breachedAt || 0).getTime() - new Date(a.events[0]?.breachedAt || 0).getTime());
};

const RecentBreachesPanel = ({ groups, events, returnPath, available }) => {
  const breachRows = groups.flatMap((group) => group.events.map((event, eventIndex) => ({
    ...event,
    rowKey: `${group.key}-${event.type || eventIndex}-${event.breachedAt || eventIndex}`,
    incidentId: group.incidentId,
    incidentSlaId: group.incidentSlaId,
    title: group.title,
  }))).sort((a, b) => new Date(b.breachedAt || 0).getTime() - new Date(a.breachedAt || 0).getTime());

  return (
    <article className="admin-panel overflow-hidden">
      <ManagerSectionHeader
        title="Vi phạm gần đây"
        description="Các sự kiện vi phạm SLA gần nhất, sắp xếp theo thời điểm ghi nhận."
        icon={Lucide.ShieldAlert}
        actions={available ? <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">{groups.length} SLA · {events.length} sự kiện</span> : null}
      />
      <section className="p-4 sm:p-5">
        {!available ? <SourceUnavailable text="Không tải được danh sách vi phạm gần đây." /> : breachRows.length === 0 ? (
          <div className="admin-empty-panel px-5 py-7 text-center text-sm text-slate-500">Chưa có sự kiện vi phạm SLA gần đây.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-950/30">
            <div className="hidden grid-cols-[minmax(220px,1.25fr)_minmax(220px,1.25fr)_160px_110px_105px] gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800 dark:bg-slate-900/50 xl:grid">
              <span>Sự vụ / SLA</span>
              <span>Loại vi phạm</span>
              <span>Thời điểm</span>
              <span>Quá hạn</span>
              <span className="text-right">Thao tác</span>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {breachRows.map((row) => {
                const EventIcon = row.Icon;
                return (
                  <li key={row.rowKey} className="px-4 py-4 transition hover:bg-slate-50/70 sm:px-5 dark:hover:bg-slate-900/35">
                    <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.25fr)_minmax(220px,1.25fr)_160px_110px_105px] xl:items-center xl:gap-4">
                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:hidden">Sự vụ / SLA</span>
                        <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{row.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">{row.incidentSlaId ? `SLA #${row.incidentSlaId}` : 'SLA chưa có mã hiển thị'}</p>
                      </div>

                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:hidden">Loại vi phạm</span>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><EventIcon size={15} /></span>
                          <p className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200">{row.label}</p>
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:hidden">Thời điểm</span>
                        <p className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{formatDateTime(row.breachedAt)}</p>
                      </div>

                      <div>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:hidden">Quá hạn</span>
                        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                          {formatDuration(row.overdueMinutes)}
                        </span>
                      </div>

                      <div className="xl:text-right">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 xl:hidden">Thao tác</span>
                        {row.incidentId ? (
                          <Link to={`/manager/incidents/${row.incidentId}`} state={{ from: returnPath }} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
                            Xem sự vụ <Lucide.ArrowUpRight size={13} />
                          </Link>
                        ) : <span className="text-xs text-slate-400">Không có liên kết</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </article>
  );
};
const LoadingSkeleton = () => (
  <article className="admin-page-shell space-y-5" aria-busy="true" aria-label="Đang tải phân tích SLA">
    <header className="admin-page-hero h-32 animate-pulse" />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <article key={index} className="admin-stat-card h-32 animate-pulse" />)}</section>
    <section className="grid items-stretch gap-5 xl:grid-cols-2"><article className="admin-panel h-72 animate-pulse" /><article className="admin-panel h-72 animate-pulse" /></section>
    <article className="admin-panel h-64 animate-pulse" />
    <article className="admin-panel h-24 animate-pulse" />
    <article className="admin-panel h-64 animate-pulse" />
  </article>
);

export const SLAAnalytics = () => {
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;
  const [cachedSnapshot] = useState(() => readSlaAnalyticsSnapshot());
  const requestIdRef = useRef(0);
  const snapshotRef = useRef(cachedSnapshot);
  const [overview, setOverview] = useState(() => cachedSnapshot?.overview || EMPTY_OVERVIEW);
  const [compliance, setCompliance] = useState(() => cachedSnapshot?.compliance || EMPTY_COMPLIANCE);
  const [performance, setPerformance] = useState(() => cachedSnapshot?.performance || EMPTY_PERFORMANCE);
  const [violationTrend, setViolationTrend] = useState(() => normalizeArray(cachedSnapshot?.violationTrend));
  const [nearBreaches, setNearBreaches] = useState(() => normalizeArray(cachedSnapshot?.nearBreaches));
  const [recentBreaches, setRecentBreaches] = useState(() => normalizeArray(cachedSnapshot?.recentBreaches));
  const [availability, setAvailability] = useState(() => (
    cachedSnapshot?.availability && typeof cachedSnapshot.availability === 'object'
      ? { ...AVAILABLE_BY_DEFAULT, ...cachedSnapshot.availability }
      : AVAILABLE_BY_DEFAULT
  ));
  const [loading, setLoading] = useState(() => !cachedSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async ({ initial = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (initial) setLoading(true); else setRefreshing(true);
    setError('');

    const requests = await Promise.allSettled([
      slaApi.getDashboardOverview(), slaApi.getDashboardCompliance(), slaApi.getDashboardPerformance(),
      slaApi.getDashboardViolationsChart(), slaApi.getDashboardNearingBreach(10), slaApi.getDashboardRecentBreach(10),
    ]);
    if (requestId !== requestIdRef.current) return;

    const [overviewResult, complianceResult, performanceResult, violationsResult, nearResult, recentResult] = requests;
    const previousSnapshot = snapshotRef.current;
    const previousAvailability = previousSnapshot?.availability || {};
    const requestAvailability = {
      overview: overviewResult.status === 'fulfilled', compliance: complianceResult.status === 'fulfilled',
      performance: performanceResult.status === 'fulfilled', trend: violationsResult.status === 'fulfilled',
      near: nearResult.status === 'fulfilled', recent: recentResult.status === 'fulfilled',
    };
    const nextAvailability = Object.fromEntries(
      SOURCE_KEYS.map((key) => [key, requestAvailability[key] || previousAvailability[key] === true])
    );

    const nextSnapshot = {
      overview: overviewResult.status === 'fulfilled'
        ? normalizeOverview(overviewResult.value)
        : previousSnapshot?.overview || EMPTY_OVERVIEW,
      compliance: complianceResult.status === 'fulfilled'
        ? normalizeCompliance(complianceResult.value)
        : previousSnapshot?.compliance || EMPTY_COMPLIANCE,
      performance: performanceResult.status === 'fulfilled'
        ? normalizePerformance(performanceResult.value)
        : previousSnapshot?.performance || EMPTY_PERFORMANCE,
      violationTrend: violationsResult.status === 'fulfilled'
        ? normalizeArray(violationsResult.value)
        : normalizeArray(previousSnapshot?.violationTrend),
      nearBreaches: nearResult.status === 'fulfilled'
        ? normalizeArray(nearResult.value)
        : normalizeArray(previousSnapshot?.nearBreaches),
      recentBreaches: recentResult.status === 'fulfilled'
        ? normalizeArray(recentResult.value)
        : normalizeArray(previousSnapshot?.recentBreaches),
      availability: nextAvailability,
    };

    const failedCount = Object.values(requestAvailability).filter((value) => !value).length;
    if (failedCount < SOURCE_KEYS.length || previousSnapshot) {
      snapshotRef.current = nextSnapshot;
      writeSlaAnalyticsSnapshot(nextSnapshot);
    }
    setAvailability(nextAvailability);
    setOverview(nextSnapshot.overview);
    setCompliance(nextSnapshot.compliance);
    setPerformance(nextSnapshot.performance);
    setViolationTrend(nextSnapshot.violationTrend);
    setNearBreaches(nextSnapshot.nearBreaches);
    setRecentBreaches(nextSnapshot.recentBreaches);

    if (failedCount > 0) {
      if (previousSnapshot) {
        setError(failedCount === SOURCE_KEYS.length
          ? 'Không thể làm mới dữ liệu SLA. Đang hiển thị dữ liệu gần nhất.'
          : `Có ${failedCount}/${SOURCE_KEYS.length} nguồn dữ liệu SLA chưa làm mới được. Dữ liệu gần nhất vẫn được giữ lại.`);
      } else {
        setError(failedCount === SOURCE_KEYS.length
          ? 'Không thể tải dữ liệu phân tích SLA. Vui lòng thử lại.'
          : `Có ${failedCount}/${SOURCE_KEYS.length} nguồn dữ liệu SLA chưa tải được. Các phần còn lại vẫn được giữ nguyên.`);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchStats({ initial: !cachedSnapshot }).catch((err) => {
      console.error(err);
      setError(cachedSnapshot
        ? 'Không thể làm mới dữ liệu SLA. Đang hiển thị dữ liệu gần nhất.'
        : 'Không thể tải dữ liệu phân tích SLA. Vui lòng thử lại.');
      setLoading(false);
      setRefreshing(false);
    });
    return () => { requestIdRef.current += 1; };
  }, [cachedSnapshot, fetchStats]);

  const groupedRecentBreaches = useMemo(() => groupRecentBreachesBySla(recentBreaches), [recentBreaches]);
  const successRate = clampPercent(overview.successRate);
  const totalViolationEvents = useMemo(() => violationTrend.reduce((sum, item) => sum + toNumber(item?.count ?? item?.Count), 0), [violationTrend]);
  const healthLabel = useMemo(() => {
    if (!availability.overview) return 'Chưa xác định';
    if (overview.totalSla === 0) return 'Chưa có dữ liệu';
    if (overview.breachedSla === 0 && overview.warningSla === 0) return 'Ổn định';
    return overview.breachedSla > 0 ? 'Cần theo dõi' : 'Có cảnh báo';
  }, [availability.overview, overview]);

  if (loading) return <LoadingSkeleton />;

  const metricUnavailable = !availability.overview;
  const metricValue = (value) => metricUnavailable ? '—' : value;

  return (
    <article className="admin-page-shell space-y-5">
      <ManagerPageHeader
        title="Phân tích SLA sự vụ"
        description="Theo dõi mức tuân thủ, hiệu suất xử lý, cảnh báo gần hạn và các vi phạm SLA của sự vụ."
        icon={Lucide.TimerReset}
        statusLabel="Sức khỏe SLA"
        statusValue={healthLabel}
        statusTone={availability.overview && overview.breachedSla === 0 ? 'success' : 'warning'}
        actions={(
          <button type="button" onClick={() => fetchStats()} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang làm mới' : 'Làm mới'}
          </button>
        )}
      />

      {error ? <section className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert"><span>{error}</span><button type="button" onClick={() => fetchStats()} disabled={refreshing} className="shrink-0 font-semibold text-amber-900 underline underline-offset-2">Thử lại</button></section> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số SLA tổng quan">
        <ManagerMetricCard label="Tổng số SLA" value={metricValue(overview.totalSla)} description={metricUnavailable ? 'Không tải được dữ liệu tổng quan.' : `${overview.completedSla} đã hoàn thành · ${Math.round(successRate)}% đạt SLA.`} icon={Lucide.Files} toneClass="bg-slate-100 text-slate-700" />
        <ManagerMetricCard label="SLA đang chạy" value={metricValue(overview.runningSla)} description={metricUnavailable ? 'Không tải được dữ liệu tổng quan.' : 'Các SLA hiện còn trong quá trình theo dõi.'} icon={Lucide.TimerReset} toneClass="bg-blue-50 text-blue-700" />
        <ManagerMetricCard label="SLA cần cảnh báo" value={metricValue(overview.warningSla)} description={metricUnavailable ? 'Không tải được dữ liệu tổng quan.' : 'Đang tiến gần thời hạn và cần được ưu tiên.'} icon={Lucide.ClockAlert} toneClass="bg-amber-50 text-amber-700" />
        <ManagerMetricCard label="SLA có vi phạm" value={metricValue(overview.breachedSla)} description={metricUnavailable ? 'Không tải được dữ liệu tổng quan.' : 'Đã vi phạm thời hạn phản hồi hoặc hoàn thành.'} icon={Lucide.TriangleAlert} toneClass="bg-rose-50 text-rose-700" />
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="admin-panel flex h-full flex-col overflow-hidden">
          <ManagerSectionHeader title="Tuân thủ theo thời gian" description="Tỷ lệ SLA tạo trong từng kỳ chưa phát sinh vi phạm." icon={Lucide.Gauge} />
          <section className="flex flex-1 flex-col p-5">
            {!availability.compliance ? <SourceUnavailable text="Không tải được dữ liệu tuân thủ theo thời gian." /> : (
              <div className="space-y-4">
                <RateBar label="Hôm nay" value={compliance.todayRate} tone="blue" detail="SLA tạo hôm nay" />
                <RateBar label="Tuần này" value={compliance.thisWeekRate} tone="emerald" detail="SLA tạo trong tuần" />
                <RateBar label="Tháng này" value={compliance.thisMonthRate} tone="amber" detail="SLA tạo trong tháng" />
                <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800">Tỷ lệ này xét cả SLA đang chạy trong kỳ nên không đồng nhất với tỷ lệ đạt của nhóm đã hoàn thành.</p>
              </div>
            )}
          </section>
        </article>

        <article className="admin-panel flex h-full flex-col overflow-hidden">
          <ManagerSectionHeader title="Hiệu suất xử lý" description="Thời gian trung bình và mức đạt mục tiêu của SLA đã hoàn thành." icon={Lucide.Activity} />
          <section className="flex flex-1 flex-col p-5">
            {!availability.performance ? <SourceUnavailable text="Không tải được dữ liệu hiệu suất xử lý." /> : (
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <article className="flex h-full flex-col justify-between rounded-2xl border border-blue-100 bg-blue-50/45 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-400">Phản hồi đầu tiên</p><strong className="mt-2 block text-2xl font-semibold text-slate-950 dark:text-white">{formatDuration(performance.averageResponseMinutes)}</strong></div><Lucide.MessageCircle size={19} className="text-blue-600" /></div>
                  <div className="mt-4"><RateBar label="Đạt SLA phản hồi" value={performance.responseSuccessRate} tone="blue" /></div>
                </article>
                <article className="flex h-full flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-400">Hoàn thành xử lý</p><strong className="mt-2 block text-2xl font-semibold text-slate-950 dark:text-white">{formatDuration(performance.averageResolutionMinutes)}</strong></div><Lucide.CircleCheckBig size={19} className="text-emerald-600" /></div>
                  <div className="mt-4"><RateBar label="Đạt SLA hoàn thành" value={performance.resolutionSuccessRate} tone="emerald" /></div>
                </article>
              </div>
            )}
          </section>
        </article>
      </section>


      <section className="admin-panel overflow-hidden">
        <ManagerSectionHeader title="Xu hướng vi phạm SLA" description="Theo dõi số sự kiện vi phạm SLA trong 30 ngày gần đây." icon={Lucide.ChartColumnIncreasing} actions={availability.trend ? <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">{totalViolationEvents} sự kiện</span> : null} />
        <section className="p-4 sm:p-5"><ViolationTrend data={violationTrend} available={availability.trend} /></section>
      </section>

      {!availability.near ? (
        <section className="admin-panel p-4 sm:p-5">
          <SourceUnavailable text="Không tải được danh sách SLA sắp đến hạn." />
        </section>
      ) : nearBreaches.length === 0 ? (
        <section className="admin-panel flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="Theo dõi ưu tiên SLA">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Lucide.CircleCheckBig size={17} /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">Không có SLA cần ưu tiên</p>
              <p className="mt-0.5 text-xs text-slate-500">Hiện chưa có SLA đang chạy nào tiến gần thời hạn cảnh báo.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">0 SLA · Trạng thái tốt</span>
        </section>
      ) : (
        <section className="admin-panel overflow-hidden">
          <ManagerSectionHeader title="Theo dõi ưu tiên" description="SLA đang tiến gần thời hạn để Manager ưu tiên xử lý trước khi vi phạm." icon={Lucide.AlarmClock} actions={<span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{nearBreaches.length} SLA</span>} />
          <section className="p-4 sm:p-5">
            <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {nearBreaches.map((item, index) => {
                const incidentId = getIncidentId(item);
                const incidentSlaId = getIncidentSlaId(item);
                const title = getIncidentTitle(item);
                const priority = item?.priority ?? item?.Priority ?? '—';
                const deadline = item?.deadline ?? item?.Deadline ?? item?.resolutionDueAt ?? item?.ResolutionDueAt ?? item?.responseDueAt ?? item?.ResponseDueAt;
                const remainingMinutes = toNumber(item?.remainingMinutes ?? item?.RemainingMinutes ?? item?.minutesRemaining ?? item?.MinutesRemaining);
                return (
                  <li key={incidentSlaId || incidentId || index}>
                    <article className="h-full rounded-2xl border border-amber-200/80 bg-amber-50/45 p-4 dark:border-amber-900/50 dark:bg-amber-950/10">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{title}</h3><p className="mt-1 text-xs text-slate-500">Hạn: {formatDateTime(deadline)}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPriorityTone(priority)}`}>{formatPriority(priority)}</span></div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-amber-100 pt-3 dark:border-amber-900/40"><span className="text-xs text-slate-400">{incidentSlaId ? `SLA #${incidentSlaId}` : 'SLA'}</span><strong className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">Còn {formatDuration(remainingMinutes)}</strong></div>
                      {incidentId ? <Link to={`/manager/incidents/${incidentId}`} state={{ from: returnPath }} className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">Xem sự vụ <Lucide.ArrowUpRight size={13} /></Link> : null}
                    </article>
                  </li>
                );
              })}
            </ul>
            {nearBreaches.length >= 10 ? <p className="mt-3 text-right text-[11px] text-slate-400">Đang hiển thị tối đa 10 SLA gần hạn.</p> : null}
          </section>
        </section>
      )}

      <RecentBreachesPanel groups={groupedRecentBreaches} events={recentBreaches} returnPath={returnPath} available={availability.recent} />
      {availability.recent && recentBreaches.length >= 10 ? <p className="-mt-2 px-1 text-right text-[11px] text-slate-400">Danh sách đang hiển thị tối đa 10 sự kiện vi phạm gần nhất.</p> : null}

      <p className="px-1 text-xs leading-5 text-slate-500">Một SLA có thể phát sinh nhiều sự kiện vi phạm phản hồi hoặc hoàn thành; mỗi hàng bên trên tương ứng với một sự kiện vi phạm.</p>
    </article>
  );
};
