import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import {
  getPriorityIntent,
  getSeverityIntent,
  getStatusIntent,
} from '@urbanmind/shared-types';

import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import EmptyState from '../../components/design-system/EmptyState';
import IncidentLocationMapCard from '../../components/maps/IncidentLocationMapCard';
import {
  STAFF_INCIDENT_DETAIL_STATE,
  useStaffIncidentDetail,
} from '../../hooks/useStaffIncidentDetail';
import {
  STAFF_INCIDENT_SLA_STATE,
  useStaffIncidentSlaStatus,
} from '../../hooks/useStaffIncidentSlaStatus';
import StaffIncidentReportsPanel from './StaffIncidentReportsPanel';
import StaffIncidentTimelinePanel from './StaffIncidentTimelinePanel';
import StaffIncidentProcessingPanel from './StaffIncidentProcessingPanel';
import StaffIncidentResolutionPanel from './StaffIncidentResolutionPanel';
import { getIncidentLifecycleMilestones } from './incidentDetailPresentation';
import {
  formatStaffIncidentSlaRemaining,
  getStaffIncidentSlaMetric,
  getStaffIncidentSlaState,
  getStaffIncidentSlaStatusLabel,
} from './staffIncidentSla';

const STATUS_LABELS = Object.freeze({
  new: 'Mới',
  verified: 'Đã xác nhận',
  assigned: 'Đã phân công',
  inprogress: 'Đang xử lý',
  submittedforapproval: 'Chờ duyệt kết quả',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  merged: 'Đã gộp',
});

const PRIORITY_LABELS = Object.freeze({
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  low: 'Thấp',
});

const SEVERITY_LABELS = Object.freeze({
  critical: 'Nghiêm trọng',
  urgent: 'Nghiêm trọng',
  major: 'Cao',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  minor: 'Thấp',
  low: 'Thấp',
});

const TAB_ITEMS = Object.freeze([
  { id: 'overview', label: 'Tổng quan', icon: Lucide.LayoutDashboard },
  { id: 'reports', label: 'Các phản ánh', icon: Lucide.MessagesSquare },
  { id: 'timeline', label: 'Dòng thời gian', icon: Lucide.History },
  { id: 'processing', label: 'Xử lý', icon: Lucide.Wrench },
  { id: 'resolution', label: 'Kết quả xử lý', icon: Lucide.ClipboardCheck },
]);

const EMPTY_VALUE = 'Chưa có dữ liệu';

const normalizeEnumKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const getEnumLabel = (value, labels) => {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  return labels[normalizeEnumKey(value)] || 'Chưa xác định';
};

const formatIncidentCode = (incidentId) => {
  const normalized = String(incidentId ?? '').trim();
  return normalized ? `SV-${normalized.slice(0, 8).toUpperCase()}` : EMPTY_VALUE;
};

const formatDateTime = (value) => {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatCount = (value) => {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('vi-VN') : EMPTY_VALUE;
};

const formatCoordinates = (latitude, longitude) => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return EMPTY_VALUE;
  }

  return `${parsedLatitude.toFixed(6)}, ${parsedLongitude.toFixed(6)}`;
};

function SectionHeading({ id, icon: Icon, title, description }) {
  return (
    <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/65 px-4 py-3.5 sm:px-5 dark:border-slate-800 dark:bg-slate-950/25">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="admin-section-title">{title}</h2>
        {description ? <p className="admin-section-description mt-1">{description}</p> : null}
      </div>
    </header>
  );
}

function MetadataRow({ label, value, icon: Icon, valueClassName = '' }) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[minmax(9rem,0.68fr)_minmax(0,1.32fr)] sm:items-start sm:gap-4">
      <dt className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        {Icon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-blue-600 dark:bg-slate-800 dark:text-blue-300" aria-hidden="true">
            <Icon size={14} />
          </span>
        ) : null}
        {label}
      </dt>
      <dd className={`min-w-0 text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100 ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}

function ClassificationItem({ label, icon: Icon, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-700" aria-hidden="true">
            <Icon size={16} />
          </span>
        ) : null}
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
          <dd className="mt-1.5 min-w-0 text-sm font-bold leading-6 text-slate-900 dark:text-slate-100">{children}</dd>
        </div>
      </div>
    </div>
  );
}

function HeaderFact({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300" aria-hidden="true">
        <Icon size={16} />
      </span>
      <dl className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[0.055em] text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-slate-100" title={value}>{value}</dd>
      </dl>
    </div>
  );
}

function SlaMetricCard({ label, metric }) {
  const tone = metric.breached
    ? {
        badge: 'danger',
        bar: 'bg-rose-500',
        border: 'border-rose-200 bg-rose-50/65 dark:border-rose-900 dark:bg-rose-950/25',
        icon: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
      }
    : metric.warning
      ? {
          badge: 'warning',
          bar: 'bg-amber-500',
          border: 'border-amber-200 bg-amber-50/65 dark:border-amber-900 dark:bg-amber-950/25',
          icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        }
      : {
          badge: 'success',
          bar: 'bg-emerald-500',
          border: 'border-emerald-200 bg-emerald-50/55 dark:border-emerald-900 dark:bg-emerald-950/20',
          icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        };
  const progress = metric.progressPercent;

  return (
    <article className={`rounded-2xl border p-3.5 ${tone.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`} aria-hidden="true">
            {metric.breached ? <Lucide.Siren size={16} /> : metric.warning ? <Lucide.ClockAlert size={16} /> : <Lucide.ShieldCheck size={16} />}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{label}</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatStaffIncidentSlaRemaining(metric)}</p>
          </div>
        </div>
        <Badge intent={tone.badge} className="shrink-0 whitespace-nowrap">
          {getStaffIncidentSlaStatusLabel(metric.status)}
        </Badge>
      </div>

      {progress !== null ? (
        <div className="mt-3" aria-label={`Tiến độ ${label}: ${Math.round(progress)}%`}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Tiến độ thời gian</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5 dark:bg-slate-900/80 dark:ring-white/10">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <dl className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-2.5 text-xs dark:border-white/10">
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Hạn SLA</dt>
        <dd className="text-right font-bold text-slate-800 dark:text-slate-100">{formatDateTime(metric.dueAt)}</dd>
      </dl>
    </article>
  );
}

function IncidentSlaContent({ onRetry, sla, state }) {
  if (state === STAFF_INCIDENT_SLA_STATE.LOADING) {
    return (
      <div className="space-y-3" role="status" aria-label="Đang tải SLA sự vụ">
        {[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />)}
        <span className="sr-only">Đang tải SLA sự vụ</span>
      </div>
    );
  }

  if (state === STAFF_INCIDENT_SLA_STATE.NOT_FOUND) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50" role="note">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700" aria-hidden="true">
          <Lucide.TimerOff size={17} />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">SLA chưa được khởi tạo</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">Sự vụ này hiện chưa có thông tin thời hạn xử lý.</p>
        </div>
      </div>
    );
  }

  if (state === STAFF_INCIDENT_SLA_STATE.ERROR || !sla) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900 dark:bg-rose-950/25" role="alert">
        <div className="flex items-start gap-3">
          <Lucide.CircleAlert className="mt-0.5 shrink-0 text-rose-700 dark:text-rose-300" size={18} aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-rose-950 dark:text-rose-100">Không thể tải SLA sự vụ</p>
            <p className="mt-1 text-sm leading-6 text-rose-800/80 dark:text-rose-200/80">Không thể tải trạng thái SLA lúc này. Vui lòng thử lại.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <Lucide.RefreshCw size={15} aria-hidden="true" />
          Thử lại
        </Button>
      </div>
    );
  }

  const overallState = getStaffIncidentSlaState(sla);
  const overallIntent = overallState === 'breached' ? 'danger' : overallState === 'warning' ? 'warning' : 'success';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/55">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Trạng thái tổng thể</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Bắt đầu: {formatDateTime(sla.startedAt)}</p>
        </div>
        <Badge intent={overallIntent}>{getStaffIncidentSlaStatusLabel(sla.status)}</Badge>
      </div>
      <SlaMetricCard label="Phản hồi đầu tiên" metric={getStaffIncidentSlaMetric(sla, 'response')} />
      <SlaMetricCard label="Hoàn thành xử lý" metric={getStaffIncidentSlaMetric(sla, 'resolution')} />
      <p className="text-right text-[11px] font-medium text-slate-400 dark:text-slate-500">Đồng bộ lúc {formatDateTime(sla.serverTime)}</p>
    </div>
  );
}

function IncidentDetailSkeleton() {
  return (
    <article className="admin-page-shell space-y-4" aria-busy="true" aria-label="Đang tải chi tiết sự vụ">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="h-4 w-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-9 w-3/5 max-w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
      </header>

      <div className="flex gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[96, 124, 132, 92, 138].map((width) => (
          <div key={width} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" style={{ width }} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
        <div className="space-y-4">
          {[7, 6].map((rows) => (
            <section key={rows} className="admin-panel overflow-hidden p-5 sm:p-6">
              <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: rows }).map((_, index) => (
                  <div key={index} className="h-4 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="space-y-4">
          {[6, 3].map((rows) => (
            <section key={rows} className="admin-panel overflow-hidden p-5 sm:p-6">
              <div className="h-5 w-36 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: rows }).map((_, index) => (
                  <div key={index} className="h-4 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </article>
  );
}

function IncidentDetailState({ state, onRetry }) {
  const content = {
    [STAFF_INCIDENT_DETAIL_STATE.API_UNAVAILABLE]: {
      icon: Lucide.FileQuestion,
      title: 'Chi tiết sự vụ chưa khả dụng',
      description: 'Không thể tải thông tin sự vụ lúc này.',
    },
    [STAFF_INCIDENT_DETAIL_STATE.ERROR]: {
      icon: Lucide.TriangleAlert,
      title: 'Không thể tải chi tiết sự vụ',
      description: 'Không thể tải thông tin sự vụ. Vui lòng thử lại.',
      action: (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <Lucide.RefreshCw size={16} aria-hidden="true" />
          Thử lại
        </Button>
      ),
    },
    [STAFF_INCIDENT_DETAIL_STATE.NOT_FOUND]: {
      icon: Lucide.FileQuestion,
      title: 'Không tìm thấy sự vụ',
      description: 'Sự vụ này không tồn tại hoặc hiện không còn khả dụng.',
    },
  }[state];

  if (!content) return null;

  return (
    <article className="admin-page-shell space-y-4">
      <EmptyState {...content} />
      <div className="flex justify-center">
        <Link
          to="/staff/incidents"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-950"
        >
          <Lucide.ArrowLeft size={16} aria-hidden="true" />
          Quay lại danh sách sự vụ
        </Link>
      </div>
    </article>
  );
}

function IncidentTabs({ activeTab, onTabChange, reportCount }) {
  const navigationRef = useRef(null);
  const tabRefs = useRef([]);
  const parsedReportCount = Number(reportCount);
  const hasReportCount = Number.isFinite(parsedReportCount) && parsedReportCount >= 0;

  useEffect(() => {
    const selectedIndex = TAB_ITEMS.findIndex((tab) => tab.id === activeTab);
    const selectedTab = tabRefs.current[selectedIndex];
    const navigation = navigationRef.current;

    if (!selectedTab || !navigation) return;

    const centeredLeft = selectedTab.offsetLeft
      - ((navigation.clientWidth - selectedTab.offsetWidth) / 2);
    navigation.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'auto' });
  }, [activeTab]);

  const handleKeyDown = (event, currentIndex) => {
    let nextIndex = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_ITEMS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TAB_ITEMS.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    onTabChange(TAB_ITEMS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <nav ref={navigationRef} className="admin-panel overflow-x-auto p-1" aria-label="Điều hướng nội dung sự vụ">
      <div className="grid min-w-[48rem] grid-cols-5 gap-1" role="tablist" aria-label="Nội dung chi tiết sự vụ">
        {TAB_ITEMS.map((tab, index) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          const label = tab.id === 'reports' && hasReportCount
            ? `${tab.label} (${parsedReportCount.toLocaleString('vi-VN')})`
            : tab.label;

          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`incident-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`incident-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`group/tab relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-950 ${
                selected
                  ? 'bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]'
                  : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-950/35 dark:hover:text-blue-200'
              }`}
            >
              <Icon size={17} className="shrink-0" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function OverviewPanel({ incident, onRetrySla, sla, slaState }) {
  const incidentCode = formatIncidentCode(incident?.incidentId);
  const title = String(incident?.title ?? '').trim() || EMPTY_VALUE;
  const description = String(incident?.description ?? '').trim() || EMPTY_VALUE;
  const locationText = String(incident?.locationText ?? '').trim() || EMPTY_VALUE;
  const areaName = String(incident?.areaName ?? '').trim() || EMPTY_VALUE;
  const categoryName = String(incident?.categoryName ?? '').trim() || EMPTY_VALUE;
  const assignedStaffName = String(incident?.assignedStaffName ?? '').trim();
  const latitude = incident?.latitude ?? incident?.lat;
  const longitude = incident?.longitude ?? incident?.lng;
  const milestones = getIncidentLifecycleMilestones(incident, sla, {
    slaLoading: slaState === STAFF_INCIDENT_SLA_STATE.LOADING,
  });

  return (
    <div
      id="incident-panel-overview"
      role="tabpanel"
      aria-labelledby="incident-tab-overview"
      tabIndex={0}
      className="grid gap-4 focus-visible:outline-none xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.78fr)]"
    >
      <div className="min-w-0 space-y-4">
        <section className="admin-panel overflow-hidden" aria-labelledby="incident-identity-title">
          <SectionHeading
            id="incident-identity-title"
            icon={Lucide.Fingerprint}
            title="Nhận diện sự vụ"
            description="Thông tin cốt lõi để nhận biết và xác định vị trí sự vụ."
          />
          <dl className="divide-y divide-slate-100 px-4 sm:px-5 dark:divide-slate-800/80">
            <MetadataRow label="Mã sự vụ" icon={Lucide.Hash} value={incidentCode} valueClassName="font-mono break-all" />
            <MetadataRow label="Tiêu đề" icon={Lucide.Type} value={title} />
            <MetadataRow
              label="Mô tả"
              icon={Lucide.AlignLeft}
              value={<span className="whitespace-pre-line font-medium text-slate-700 dark:text-slate-200">{description}</span>}
            />
            <MetadataRow label="Vị trí ghi nhận" icon={Lucide.MapPin} value={locationText} />
            <MetadataRow
              label="Tọa độ"
              icon={Lucide.Crosshair}
              value={formatCoordinates(latitude, longitude)}
              valueClassName="font-mono"
            />
          </dl>
        </section>

        <IncidentLocationMapCard
          incidentId={incident?.incidentId}
          latitude={latitude}
          longitude={longitude}
          locationText={incident?.locationText}
          areaName={incident?.areaName}
          tone="blue"
          compact
        />

        <section className="admin-panel overflow-hidden" aria-labelledby="incident-classification-title">
          <SectionHeading
            id="incident-classification-title"
            icon={Lucide.Tags}
            title="Phân loại"
            description="Phạm vi, danh mục và mức độ cần ưu tiên theo dữ liệu sự vụ."
          />
          <dl className="grid gap-2.5 p-3.5 sm:grid-cols-2 sm:p-4">
            <ClassificationItem label="Phường / Khu vực" icon={Lucide.MapPinned}>{areaName}</ClassificationItem>
            <ClassificationItem label="Danh mục" icon={Lucide.Tags}>{categoryName}</ClassificationItem>
            <ClassificationItem label="Trạng thái" icon={Lucide.Activity}>
              <Badge intent={getStatusIntent(incident?.status)}>
                {getEnumLabel(incident?.status, STATUS_LABELS)}
              </Badge>
            </ClassificationItem>
            <ClassificationItem label="Mức ưu tiên" icon={Lucide.Flag}>
              <Badge intent={getPriorityIntent(incident?.priority)}>
                {getEnumLabel(incident?.priority, PRIORITY_LABELS)}
              </Badge>
            </ClassificationItem>
            <ClassificationItem label="Mức độ nghiêm trọng" icon={Lucide.TriangleAlert}>
              <Badge intent={getSeverityIntent(incident?.severity)}>
                {getEnumLabel(incident?.severity, SEVERITY_LABELS)}
              </Badge>
            </ClassificationItem>
            <ClassificationItem label="Trạng thái gộp" icon={Lucide.GitMerge}>
              {incident?.mergedIntoIncidentId ? (
                <span className="space-y-1">
                  <Badge intent="neutral">Đã gộp</Badge>
                  <span className="block break-all font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
                    Sang {formatIncidentCode(incident.mergedIntoIncidentId)}
                  </span>
                </span>
              ) : 'Chưa gộp'}
            </ClassificationItem>
          </dl>
        </section>
      </div>

      <aside className="min-w-0 space-y-4" aria-label="Thông tin xử lý sự vụ">
        <section className="admin-panel overflow-hidden" aria-labelledby="incident-handling-title">
          <SectionHeading
            id="incident-handling-title"
            icon={Lucide.BriefcaseBusiness}
            title="Theo dõi xử lý"
            description="Phân công, số lượng phản ánh và các mốc thời gian của sự vụ."
          />

          <div className="border-b border-slate-100 p-3.5 sm:p-4 dark:border-slate-800/80">
            <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/75 p-3.5 dark:border-blue-900/70 dark:bg-blue-950/30">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)]" aria-hidden="true">
                <Lucide.UserRoundCheck size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Staff phụ trách
                </p>
                <p className="mt-1 break-words text-sm font-bold leading-6 text-slate-900 dark:text-slate-100">
                  {assignedStaffName || 'Chưa có dữ liệu Staff phụ trách'}
                </p>
              </div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 px-4 sm:px-5 dark:divide-slate-800/80">
            <MetadataRow label="Số phản ánh" icon={Lucide.MessagesSquare} value={formatCount(incident?.reportCount)} />
            <MetadataRow label="Người theo dõi" icon={Lucide.UsersRound} value={formatCount(incident?.subscriberCount)} />
            <MetadataRow label="Thời gian tạo" icon={Lucide.CalendarPlus} value={formatDateTime(incident?.createdAt)} />
            <MetadataRow label="Cập nhật gần nhất" icon={Lucide.RefreshCw} value={formatDateTime(incident?.updatedAt)} />
            <MetadataRow
              label="Hạn dự kiến"
              icon={Lucide.CalendarClock}
              value={milestones.dueAt ? formatDateTime(milestones.dueAt) : milestones.duePlaceholder}
            />
            <MetadataRow
              label="Đã giải quyết lúc"
              icon={Lucide.CircleCheckBig}
              value={milestones.resolvedAt ? formatDateTime(milestones.resolvedAt) : milestones.resolvedPlaceholder}
              valueClassName={milestones.resolvedAt ? '' : 'text-slate-500 dark:text-slate-400'}
            />
            <MetadataRow
              label="Đã đóng lúc"
              icon={Lucide.Archive}
              value={milestones.closedAt ? formatDateTime(milestones.closedAt) : milestones.closedPlaceholder}
              valueClassName={milestones.closedAt ? '' : 'text-slate-500 dark:text-slate-400'}
            />
          </dl>
        </section>

        <section className="admin-panel overflow-hidden" aria-labelledby="incident-sla-title">
          <SectionHeading
            id="incident-sla-title"
            icon={Lucide.ClockAlert}
            title="SLA sự vụ"
            description="Cam kết thời gian xử lý ở cấp sự vụ."
          />
          <div className="px-4 py-4 sm:px-5">
            <IncidentSlaContent onRetry={onRetrySla} sla={sla} state={slaState} />
          </div>
        </section>
      </aside>
    </div>
  );
}

export default function StaffIncidentDetailPage() {
  const { incidentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    capability,
    incident,
    retry,
    state,
    updateIncident,
  } = useStaffIncidentDetail(incidentId);
  const {
    retry: retrySla,
    sla,
    state: slaState,
  } = useStaffIncidentSlaStatus(incidentId);
  const requestedTab = searchParams.get('tab');
  const activeTab = useMemo(
    () => TAB_ITEMS.some((tab) => tab.id === requestedTab) ? requestedTab : 'overview',
    [requestedTab],
  );

  const selectTab = (tabId) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (tabId === 'overview') nextSearchParams.delete('tab');
    else nextSearchParams.set('tab', tabId);
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleIncidentUpdated = (nextIncident) => {
    const updated = updateIncident(nextIncident);
    if (updated) retrySla();
    return updated;
  };

  if (state === STAFF_INCIDENT_DETAIL_STATE.LOADING) {
    return <IncidentDetailSkeleton />;
  }

  if (state !== STAFF_INCIDENT_DETAIL_STATE.READY || !incident) {
    return <IncidentDetailState state={state} onRetry={retry} />;
  }

  const incidentTitle = String(incident?.title ?? '').trim() || 'Sự vụ chưa có tiêu đề';
  const areaName = String(incident?.areaName ?? '').trim() || EMPTY_VALUE;
  const categoryName = String(incident?.categoryName ?? '').trim() || EMPTY_VALUE;
  const assignedStaffName = String(incident?.assignedStaffName ?? '').trim() || 'Chưa có Staff phụ trách';

  return (
    <article className="admin-page-shell space-y-4 pb-5">
      <header className="admin-page-hero p-0">
        <div className="px-5 py-5 sm:px-6 sm:py-5">
          <Link
            to="/staff/incidents"
            className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white/75 px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:hidden dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
          >
            <Lucide.ArrowLeft size={15} aria-hidden="true" />
            Danh sách sự vụ
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="admin-hero-icon" aria-hidden="true">
                <Lucide.BriefcaseBusiness size={23} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-blue-100 px-2.5 py-1 font-mono text-xs font-black tracking-[0.04em] text-blue-700 dark:bg-blue-950/55 dark:text-blue-300">
                    {formatIncidentCode(incident?.incidentId)}
                  </span>
                  {incident?.mergedIntoIncidentId ? <Badge intent="neutral">Đã gộp</Badge> : null}
                </div>
                <h1 className="mt-2.5 max-w-4xl text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-[1.75rem] dark:text-white">
                  {incidentTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Không gian theo dõi thông tin, các phản ánh liên quan và toàn bộ hoạt động của sự vụ.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-xs lg:justify-end">
              <Badge intent={getStatusIntent(incident?.status)} className="px-3 py-1.5 text-xs">
                Trạng thái: {getEnumLabel(incident?.status, STATUS_LABELS)}
              </Badge>
              <Badge intent={getPriorityIntent(incident?.priority)} className="px-3 py-1.5 text-xs">
                Ưu tiên: {getEnumLabel(incident?.priority, PRIORITY_LABELS)}
              </Badge>
              <Badge intent={getSeverityIntent(incident?.severity)} className="px-3 py-1.5 text-xs">
                Mức độ: {getEnumLabel(incident?.severity, SEVERITY_LABELS)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid border-t border-slate-200/80 bg-white/55 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-700/80 dark:bg-slate-950/20">
          <HeaderFact icon={Lucide.MapPin} label="Phường / Khu vực" value={areaName} />
          <HeaderFact icon={Lucide.Tags} label="Danh mục" value={categoryName} />
          <HeaderFact icon={Lucide.UserRoundCheck} label="Staff phụ trách" value={assignedStaffName} />
          <HeaderFact icon={Lucide.RefreshCw} label="Cập nhật gần nhất" value={formatDateTime(incident?.updatedAt)} />
        </div>
      </header>

      <IncidentTabs
        activeTab={activeTab}
        onTabChange={selectTab}
        reportCount={incident?.reportCount}
      />

      {activeTab === 'overview' ? (
        <OverviewPanel
          incident={incident}
          onRetrySla={retrySla}
          sla={sla}
          slaState={slaState}
        />
      ) : null}
      {activeTab === 'reports' ? (
        <StaffIncidentReportsPanel incident={incident} capability={capability} />
      ) : null}
      {activeTab === 'timeline' ? (
        <StaffIncidentTimelinePanel incidentId={incident?.incidentId || incidentId} />
      ) : null}
      {activeTab === 'processing' ? (
        <StaffIncidentProcessingPanel
          incident={incident}
          onIncidentUpdated={handleIncidentUpdated}
        />
      ) : null}
      {activeTab === 'resolution' ? (
        <StaffIncidentResolutionPanel
          incident={incident}
          onIncidentUpdated={handleIncidentUpdated}
          readOnly
        />
      ) : null}
    </article>
  );
}
