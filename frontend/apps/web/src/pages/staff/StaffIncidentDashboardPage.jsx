import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import {
  getPriorityIntent,
  getSeverityIntent,
  getStatusIntent,
} from '@urbanmind/shared-types';
import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import EmptyState from '../../components/design-system/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import {
  STAFF_INCIDENT_DASHBOARD_STATE,
  useStaffIncidentDashboard,
} from '../../hooks/useStaffIncidentDashboard';
import { getCategoryLabel } from '../../utils/categoryLabels';
import {
  formatIncidentCode,
  formatOperationalDateTime,
} from './incidentDetailPresentation';
import {
  calculateStaffIncidentKpis,
  calculateStaffIncidentSlaKpis,
  getStaffIncidentSlaState,
  getStaffIncidentPriorityLabel,
  getStaffIncidentSeverityLabel,
  getStaffIncidentStatusLabel,
  sortStaffIncidentsForAttention,
} from './staffIncidentDashboard';

const KPI_ITEMS = Object.freeze([
  Object.freeze({
    key: 'assigned',
    label: 'Được phân công',
    description: 'Đã giao, chưa bắt đầu xử lý',
    icon: Lucide.ClipboardCheck,
    iconClassName: 'bg-blue-50 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300',
  }),
  Object.freeze({
    key: 'inProgress',
    label: 'Đang xử lý',
    description: 'Đang phối hợp thực hiện',
    icon: Lucide.LoaderCircle,
    iconClassName: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/45 dark:text-cyan-300',
  }),
  Object.freeze({
    key: 'needRework',
    label: 'Cần xử lý lại',
    description: 'Quản lý yêu cầu cập nhật',
    icon: Lucide.RotateCcw,
    iconClassName: 'bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300',
  }),
  Object.freeze({
    key: 'pendingApproval',
    label: 'Chờ duyệt',
    description: 'Kết quả đã được gửi',
    icon: Lucide.Clock3,
    iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300',
  }),
]);

const SLA_KPI_ITEMS = Object.freeze([
  Object.freeze({
    key: 'tracked',
    label: 'Đang theo dõi SLA',
    description: 'Sự vụ đang hoạt động đã có SLA',
    icon: Lucide.Activity,
    iconClassName: 'bg-blue-50 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300',
  }),
  Object.freeze({
    key: 'healthy',
    label: 'Trong hạn',
    description: 'Chưa chạm ngưỡng cảnh báo',
    icon: Lucide.ShieldCheck,
    iconClassName: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300',
  }),
  Object.freeze({
    key: 'nearingBreach',
    label: 'Sắp quá hạn',
    description: 'Cần ưu tiên xử lý sớm',
    icon: Lucide.ClockAlert,
    iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300',
  }),
  Object.freeze({
    key: 'breached',
    label: 'Đã quá hạn',
    description: 'Đã vi phạm Response hoặc Resolution SLA',
    icon: Lucide.Siren,
    iconClassName: 'bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300',
  }),
]);

const formatCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('vi-VN') : 'Chưa có dữ liệu';
};

function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="Đang tải tổng quan công việc">
      <section className="admin-panel overflow-hidden" aria-hidden="true">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6 dark:border-slate-800">
          <div className="h-5 w-44 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-80 max-w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-h-32 border-b border-slate-100 p-5 sm:border-r xl:border-b-0 dark:border-slate-800">
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="mt-4 h-8 w-14 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 h-3 w-36 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel overflow-hidden" aria-hidden="true">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6 dark:border-slate-800">
          <div className="h-5 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.8fr)_minmax(11rem,0.65fr)_auto] lg:items-center">
              <div>
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="mt-3 h-5 w-3/4 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-8 w-36 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </section>
      <span className="sr-only">Đang tải dữ liệu sự vụ</span>
    </div>
  );
}

function DashboardState({ state, onRetry }) {
  const content = {
    [STAFF_INCIDENT_DASHBOARD_STATE.API_UNAVAILABLE]: {
      icon: Lucide.ClipboardList,
      title: 'Chưa thể tải tổng quan sự vụ',
      description: 'Dữ liệu công việc hiện chưa khả dụng. Vui lòng quay lại sau.',
    },
    [STAFF_INCIDENT_DASHBOARD_STATE.SCOPE_UNAVAILABLE]: {
      icon: Lucide.ShieldAlert,
      title: 'Chưa xác định được phạm vi công việc',
      description: 'Không thể xác định tài khoản nhân viên hiện tại để tải đúng các sự vụ được phân công.',
    },
    [STAFF_INCIDENT_DASHBOARD_STATE.EMPTY]: {
      icon: Lucide.ClipboardList,
      title: 'Bạn chưa có sự vụ nào được phân công',
      description: 'Các sự vụ được quản lý giao cho bạn sẽ xuất hiện tại đây.',
    },
    [STAFF_INCIDENT_DASHBOARD_STATE.ERROR]: {
      icon: Lucide.TriangleAlert,
      title: 'Không thể tải tổng quan công việc',
      description: 'Đã xảy ra lỗi khi tải dữ liệu sự vụ. Vui lòng thử lại.',
      action: (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <Lucide.RefreshCw size={16} aria-hidden="true" />
          Thử lại
        </Button>
      ),
    },
  }[state];

  return content ? <EmptyState {...content} /> : null;
}

function KpiStrip({ metrics }) {
  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="staff-dashboard-kpi-title">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/55 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
        <div className="flex items-start gap-3">
          <span className="admin-mini-icon" aria-hidden="true">
            <Lucide.Gauge size={17} />
          </span>
          <div>
            <h2 id="staff-dashboard-kpi-title" className="admin-section-title">Nhịp công việc hiện tại</h2>
            <p className="admin-section-description mt-1">Số liệu từ toàn bộ sự vụ được giao cho tài khoản của bạn.</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-200">
          <Lucide.BriefcaseBusiness size={14} aria-hidden="true" />
          {formatCount(metrics.totalActive)} sự vụ đang hoạt động
        </span>
      </header>

      <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
        {KPI_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={`flex min-h-32 items-start justify-between gap-4 p-5 sm:p-6 ${index < KPI_ITEMS.length - 1 ? 'border-b border-slate-100 sm:border-r xl:border-b-0 dark:border-slate-800' : ''}`}
            >
              <div className="min-w-0">
                <dt className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</dt>
                <dd className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-950 dark:text-slate-50">
                  {formatCount(metrics[item.key])}
                </dd>
                <dd className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</dd>
              </div>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconClassName}`} aria-hidden="true">
                <Icon size={20} />
              </span>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function SlaKpiStrip({ failedCount, metrics, requestedCount }) {
  const withoutSla = Math.max(0, requestedCount - metrics.tracked - failedCount);

  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="staff-dashboard-sla-title">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/55 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
        <div className="flex items-start gap-3">
          <span className="admin-mini-icon" aria-hidden="true">
            <Lucide.TimerReset size={17} />
          </span>
          <div>
            <h2 id="staff-dashboard-sla-title" className="admin-section-title">SLA theo sự vụ</h2>
            <p className="admin-section-description mt-1">Theo dõi thời hạn xử lý của các sự vụ đang được giao cho bạn.</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-200">
          <Lucide.Radar size={14} aria-hidden="true" />
          {formatCount(metrics.tracked)}/{formatCount(requestedCount)} sự vụ có SLA
        </span>
      </header>

      <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
        {SLA_KPI_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={`flex min-h-32 items-start justify-between gap-4 p-5 sm:p-6 ${index < SLA_KPI_ITEMS.length - 1 ? 'border-b border-slate-100 sm:border-r xl:border-b-0 dark:border-slate-800' : ''}`}
            >
              <div className="min-w-0">
                <dt className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</dt>
                <dd className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-950 dark:text-slate-50">
                  {formatCount(metrics[item.key])}
                </dd>
                <dd className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</dd>
              </div>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconClassName}`} aria-hidden="true">
                <Icon size={20} />
              </span>
            </div>
          );
        })}
      </dl>

      {failedCount > 0 || withoutSla > 0 ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-500 sm:px-6 dark:border-slate-800 dark:text-slate-400" role={failedCount > 0 ? 'alert' : 'note'}>
          {withoutSla > 0 ? <span>{formatCount(withoutSla)} sự vụ chưa có bản ghi SLA.</span> : null}
          {failedCount > 0 ? <span>Không thể tải SLA của {formatCount(failedCount)} sự vụ; bấm “Làm mới” để thử lại.</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function IncidentBadges({ incident, sla }) {
  const slaState = getStaffIncidentSlaState(sla);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge intent={getStatusIntent(incident?.status)} className="whitespace-nowrap">
        {getStaffIncidentStatusLabel(incident?.status)}
      </Badge>
      <Badge intent={getPriorityIntent(incident?.priority)} className="whitespace-nowrap">
        Ưu tiên: {getStaffIncidentPriorityLabel(incident?.priority)}
      </Badge>
      <Badge intent={getSeverityIntent(incident?.severity)} className="whitespace-nowrap">
        Mức độ: {getStaffIncidentSeverityLabel(incident?.severity)}
      </Badge>
      {slaState === 'breached' ? <Badge intent="danger" className="whitespace-nowrap">SLA quá hạn</Badge> : null}
      {slaState === 'warning' ? <Badge intent="warning" className="whitespace-nowrap">SLA sắp quá hạn</Badge> : null}
    </div>
  );
}

function AttentionList({ incidents, slaByIncidentId }) {
  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="staff-dashboard-attention-title">
      <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300" aria-hidden="true">
            <Lucide.BellRing size={18} />
          </span>
          <div>
            <h2 id="staff-dashboard-attention-title" className="admin-section-title">Sự vụ cần chú ý</h2>
            <p className="admin-section-description mt-1">Ưu tiên yêu cầu xử lý lại, sau đó theo mức độ nghiêm trọng, mức ưu tiên và thời gian cập nhật.</p>
          </div>
        </div>
        <Link
          to="/staff/incidents"
          className="admin-secondary-link inline-flex min-h-10 w-full items-center justify-center gap-2 px-4 py-2 text-sm font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:w-auto dark:focus-visible:ring-blue-950"
        >
          Xem tất cả sự vụ
          <Lucide.ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      {incidents.length === 0 ? (
        <div className="m-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/55 px-5 py-10 text-center sm:m-6 dark:border-slate-800 dark:bg-slate-950/30">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300" aria-hidden="true">
            <Lucide.CircleCheckBig size={22} />
          </span>
          <h3 className="mt-4 text-base font-black text-slate-900 dark:text-slate-100">Hiện không có sự vụ cần xử lý</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Các sự vụ đang xử lý, cần làm lại hoặc chờ duyệt sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {incidents.map((incident) => {
            const incidentId = String(incident?.incidentId ?? '').trim();
            const updatedAt = incident?.updatedAt || incident?.createdAt;
            return (
              <li key={incidentId}>
                <article className="group grid gap-4 px-5 py-5 transition-colors hover:bg-blue-50/35 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.85fr)_minmax(11rem,0.7fr)_auto] lg:items-center dark:hover:bg-blue-950/15">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                      <span>{formatIncidentCode(incidentId)}</span>
                      <span className="font-medium text-slate-400 dark:text-slate-500">{formatCount(incident?.reportCount)} phản ánh</span>
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-6 text-slate-950 dark:text-slate-50">
                      {incident?.title || 'Chưa có dữ liệu'}
                    </h3>
                    {incident?.locationText ? (
                      <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{incident.locationText}</p>
                    ) : null}
                  </div>

                  <div><IncidentBadges incident={incident} sla={slaByIncidentId[incidentId]} /></div>

                  <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Phường / Khu vực</dt>
                      <dd className="mt-1 truncate font-semibold text-slate-700 dark:text-slate-200">{incident?.areaName || 'Chưa có dữ liệu'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Danh mục</dt>
                      <dd className="mt-1 truncate font-semibold text-slate-700 dark:text-slate-200">{getCategoryLabel(incident?.categoryName, 'Chưa có dữ liệu')}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:items-end">
                    <time dateTime={updatedAt || undefined} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Lucide.Clock3 size={14} aria-hidden="true" />
                      {formatOperationalDateTime(updatedAt)}
                    </time>
                    <Link
                      to={`/staff/incidents/${incidentId}`}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:w-auto dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-950"
                      aria-label={`Xem chi tiết sự vụ ${formatIncidentCode(incidentId)}`}
                    >
                      Xem chi tiết
                      <Lucide.ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function StaffIncidentDashboardPage() {
  const { user } = useAuth();
  const assignedStaffUserId = String(user?.userId ?? user?.id ?? '').trim();
  const {
    incidents,
    retry,
    slaByIncidentId,
    slaFailedCount,
    slaRequestedCount,
    state,
    totalItems,
  } = useStaffIncidentDashboard(assignedStaffUserId);

  const metrics = useMemo(() => calculateStaffIncidentKpis(incidents), [incidents]);
  const slaMetrics = useMemo(
    () => calculateStaffIncidentSlaKpis(slaByIncidentId),
    [slaByIncidentId],
  );
  const attentionIncidents = useMemo(
    () => sortStaffIncidentsForAttention(incidents, slaByIncidentId).slice(0, 6),
    [incidents, slaByIncidentId],
  );
  const loading = state === STAFF_INCIDENT_DASHBOARD_STATE.LOADING;
  const ready = state === STAFF_INCIDENT_DASHBOARD_STATE.READY;
  const displayName = String(user?.fullName ?? '').trim();

  return (
    <article className="admin-page-shell space-y-6" aria-busy={loading}>
      <header className="admin-page-hero px-5 py-6 sm:px-7 sm:py-7" aria-labelledby="staff-dashboard-title">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="admin-hero-icon" aria-hidden="true">
              <Lucide.LayoutDashboard size={22} />
            </span>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Không gian làm việc</p>
              <h1 id="staff-dashboard-title" className="admin-hero-title">Tổng quan công việc</h1>
              <p className="admin-hero-description">
                {displayName ? `Xin chào, ${displayName}. ` : ''}Ưu tiên các sự vụ cần bạn tiếp tục xử lý hôm nay.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
            {ready ? (
              <dl className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-[0_10px_24px_rgba(30,64,175,0.08)] dark:border-slate-700/70 dark:bg-slate-900/65">
                <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Đang cần xử lý</dt>
                <dd className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">{formatCount(metrics.totalActive)}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">trên {formatCount(totalItems)} sự vụ được giao</span>
                </dd>
              </dl>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={retry} disabled={loading} className="min-h-11 whitespace-nowrap">
              <Lucide.RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              Làm mới
            </Button>
            <Link
              to="/staff/incidents"
              className="admin-primary-action inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-950"
            >
              Xem tất cả sự vụ
              <Lucide.ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {loading ? <DashboardSkeleton /> : null}
      {ready ? (
        <>
          <KpiStrip metrics={metrics} />
          <SlaKpiStrip
            failedCount={slaFailedCount}
            metrics={slaMetrics}
            requestedCount={slaRequestedCount}
          />
          <AttentionList incidents={attentionIncidents} slaByIncidentId={slaByIncidentId} />
        </>
      ) : null}
      {!loading && !ready ? <DashboardState state={state} onRetry={retry} /> : null}
    </article>
  );
}
