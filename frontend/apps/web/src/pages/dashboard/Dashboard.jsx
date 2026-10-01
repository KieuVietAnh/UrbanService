// src/pages/dashboard/Dashboard.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { analyticsApi } from '../../services/api/analyticsApi';
import { slaApi } from '../../services/api/slaApi';
import { axiosClient, toolsApi, managementFeedbackApi, incidentDashboardApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { normalizeRole } from '../../utils/roleMap';
import { APP_ROLES, getStatusLabel, managementTypes, STATUS_BADGE_CLASSES } from '@urbanmind/shared-types';
import { signalrService } from '../../services/socket/signalrService';
import { ManagerMetricCard, ManagerPageHeader, ManagerSectionHeader } from '../../components/manager/ManagerPageElements';
import { getCategoryLabel } from '../../utils/categoryLabels';
import { ADMIN_FEEDBACK_METRICS, calculateAdminFeedbackSummary } from '../../utils/adminFeedbackMetrics';
import { getCommunityFeed } from '../../services/api/feedApi';
import usePublicLandingFeed from '../../hooks/usePublicLandingFeed';
import PublicPageMotion from '../../components/public/PublicPageMotion';
import CompactPublicIncidentMap from '../../components/public/CompactPublicIncidentMap';
import {
  getCommunityIncidentId,
  getCommunityInteractionFeedbackId,
  getCommunityItemTitle,
  getResidentStatusMeta,
} from '../../components/community/communityPresentation.js';
import { readAdminDashboardCache, writeAdminDashboardCache } from '../../services/cache/adminDashboardCache';
import { buildManagerDashboardStats, managerMetricValue } from './managerDashboardUtils.mjs';
import AdminDashboardPage from '../admin/AdminDashboardPage';
import { IncidentDistributionPanel } from '../../components/manager/IncidentDistributionPanel';

const DASHBOARD_AREA_STORAGE_KEY =
  'urbanmind-dashboard-area-filter-v2';
const DASHBOARD_SNAPSHOT_STORAGE_KEY =
  'urbanmind-service-user-dashboard-snapshot';
const STAFF_DASHBOARD_SNAPSHOT_STORAGE_KEY =
  'urbanmind-staff-dashboard-snapshot-v1';
const MANAGER_DASHBOARD_SNAPSHOT_STORAGE_KEY =
  'urbanmind-manager-dashboard-snapshot-v3';
const MANAGER_DASHBOARD_CACHE_TTL_MS = 60 * 1000;

const readDashboardSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawSnapshot = window.sessionStorage.getItem(
      DASHBOARD_SNAPSHOT_STORAGE_KEY
    );
    if (!rawSnapshot) return null;

    const parsedSnapshot = JSON.parse(rawSnapshot);
    return parsedSnapshot && typeof parsedSnapshot === 'object'
      ? parsedSnapshot
      : null;
  } catch {
    return null;
  }
};

const writeDashboardSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      DASHBOARD_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(snapshot)
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};


const readStaffDashboardSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawSnapshot = window.sessionStorage.getItem(
      STAFF_DASHBOARD_SNAPSHOT_STORAGE_KEY
    );
    if (!rawSnapshot) return null;

    const parsedSnapshot = JSON.parse(rawSnapshot);
    return parsedSnapshot && typeof parsedSnapshot === 'object'
      ? parsedSnapshot
      : null;
  } catch {
    return null;
  }
};

const writeStaffDashboardSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      STAFF_DASHBOARD_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};


const readManagerDashboardSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawSnapshot = window.sessionStorage.getItem(
      MANAGER_DASHBOARD_SNAPSHOT_STORAGE_KEY
    );
    if (!rawSnapshot) return null;

    const parsedSnapshot = JSON.parse(rawSnapshot);
    return parsedSnapshot && typeof parsedSnapshot === 'object'
      ? parsedSnapshot
      : null;
  } catch {
    return null;
  }
};

const writeManagerDashboardSnapshot = (snapshot) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      MANAGER_DASHBOARD_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};

const isFreshManagerDashboardSnapshot = (snapshot) => {
  const updatedAt = Number(snapshot?.updatedAt);
  return Number.isFinite(updatedAt)
    && Date.now() - updatedAt < MANAGER_DASHBOARD_CACHE_TTL_MS;
};

const normalizeTicketCollection = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeTicketPage = (response) => {
  const payload = (
    response?.data &&
    !Array.isArray(response.data) &&
    typeof response.data === 'object'
  )
    ? response.data
    : response;
  const items = normalizeTicketCollection(payload);
  const totalItems = Number(
    payload?.totalItems ??
    payload?.totalCount ??
    payload?.count ??
    items.length
  );

  return {
    items,
    totalItems: Number.isFinite(totalItems)
      ? totalItems
      : items.length,
  };
};

const getAreaId = (area) => area?.areaId ?? area?.id ?? '';
const getAreaName = (area) => (
  area?.areaName ||
  area?.name ||
  area?.displayName ||
  'Chưa xác định khu vực'
);
const getTicketAreaId = (ticket) => (
  ticket?.areaId ??
  ticket?.area?.areaId ??
  ticket?.area?.id ??
  ''
);

const readTrackedAreaId = () => {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem(
      DASHBOARD_AREA_STORAGE_KEY
    ) || '';
  } catch {
    return '';
  }
};

const buildTicketListUrl = ({
  status = '',
  search = '',
  sort = '',
} = {}) => {
  const params = new URLSearchParams();

  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (sort) params.set('sort', sort);

  const queryString = params.toString();
  return queryString ? `/tickets?${queryString}` : '/tickets';
};


const toDashboardCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const formatManagerSummaryDate = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const mapFeedbackDashboardOverview = (overview, fallbackSummary) => {
  if (!overview || typeof overview !== 'object') return fallbackSummary;

  const total = toDashboardCount(overview.totalFeedback);
  const assigned = toDashboardCount(overview.assigned);
  const inProgress = toDashboardCount(overview.inProgress);
  const pendingApproval = toDashboardCount(overview.pendingApproval);
  const completed = toDashboardCount(overview.completed);
  const cancelled = toDashboardCount(overview.cancelled);
  const groupedTotal = assigned + inProgress + pendingApproval + completed + cancelled;

  return {
    total,
    pending: Math.max(0, total - groupedTotal),
    inProgress: assigned + inProgress + pendingApproval,
    completed: completed + cancelled,
  };
};

const SAFE_DASHBOARD_STATS = {
  totalUsers: 0,
  processingRate: 0,
  csatScore: 0,
  avgResolutionTimeHours: 0,
  slaBreaches: 0,
  apiStatus: 'Ổn định',
  aiStatus: 'Chưa xác định',
  storageUsage: '0 KB',
  sentimentTrend: {
    Positive: 0,
    Neutral: 0,
    Negative: 0,
  },
  categoryDistribution: [],
};

const normalizeDashboardStats = (rawStats) => ({
  ...SAFE_DASHBOARD_STATS,
  ...(rawStats && typeof rawStats === 'object' ? rawStats : {}),
  sentimentTrend: {
    ...SAFE_DASHBOARD_STATS.sentimentTrend,
    ...(rawStats?.sentimentTrend && typeof rawStats.sentimentTrend === 'object' ? rawStats.sentimentTrend : {}),
  },
  categoryDistribution: Array.isArray(rawStats?.categoryDistribution)
    ? rawStats.categoryDistribution
    : SAFE_DASHBOARD_STATS.categoryDistribution,
});

const buildManagerTrendChartModel = (items) => {
  const series = Array.isArray(items) ? items : [];
  const width = 1180;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 42, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rawMaxValue = Math.max(
    1,
    ...series.flatMap((item) => [
      toDashboardCount(item?.createdCount),
      toDashboardCount(item?.completedCount),
    ])
  );
  const tickSegments = 4;
  const tickStep = Math.max(1, Math.ceil(rawMaxValue / tickSegments));
  const maxValue = tickStep * tickSegments;
  const groupWidth = series.length > 0 ? plotWidth / series.length : plotWidth;
  const barWidth = Math.min(46, Math.max(20, groupWidth * 0.24));
  const barGap = Math.min(10, Math.max(6, groupWidth * 0.07));
  const baselineY = padding.top + plotHeight;
  const valueToY = (value) => padding.top + plotHeight - ((value / maxValue) * plotHeight);

  const groups = series.map((item, index) => {
    const created = toDashboardCount(item?.createdCount);
    const completed = toDashboardCount(item?.completedCount);
    const centerX = padding.left + groupWidth * index + groupWidth / 2;
    const createdY = valueToY(created);
    const completedY = valueToY(completed);

    return {
      ...item,
      created,
      completed,
      centerX,
      createdX: centerX - barGap / 2 - barWidth,
      completedX: centerX + barGap / 2,
      createdY,
      completedY,
      createdHeight: baselineY - createdY,
      completedHeight: baselineY - completedY,
    };
  });

  const ticks = Array.from({ length: tickSegments + 1 }, (_, index) => {
    const value = maxValue - tickStep * index;
    const y = padding.top + (plotHeight * index) / tickSegments;
    return { value, y };
  });

  return {
    width,
    height,
    padding,
    plotWidth,
    plotHeight,
    baselineY,
    barWidth,
    groupWidth,
    groups,
    ticks,
    maxValue,
  };
};

const getManagerTrendSearchValue = (item, fallbackLabel) => {
  const monthNumber = Number(item?.month);
  const yearNumber = Number(item?.year);
  if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12 && Number.isInteger(yearNumber) && yearNumber > 0) {
    return `${String(monthNumber).padStart(2, '0')}/${yearNumber}`;
  }

  const label = String(fallbackLabel || item?.monthLabel || item?.label || '');
  const match = label.match(/(\d{1,2})[/-](\d{4})/);
  return match ? `${match[1].padStart(2, '0')}/${match[2]}` : label;
};

const TrackedAreaSelector = ({
  areas,
  value,
  onChange,
}) => {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selectedArea = areas.find(
    (area) => String(getAreaId(area)) === String(value)
  );
  const showingAllAreas = !value;

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeOnOutsideClick
      );
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      data-dashboard-area-selector
    >
      <button
        type="button"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${open
            ? 'border-secondary/40 bg-secondary/5 ring-2 ring-secondary/10'
            : 'border-base-300 bg-base-100 hover:border-secondary/25 hover:bg-secondary/5'
          }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
          <Lucide.MapPinHouse size={16} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-base-content/45">
            Khu vực theo dõi
          </span>
          <strong className="mt-0.5 block truncate text-sm font-bold">
            {selectedArea
              ? getAreaName(selectedArea)
              : 'Tất cả khu vực'}
          </strong>
        </span>

        <Lucide.ChevronDown
          size={15}
          className={`shrink-0 text-base-content/35 transition-transform ${open ? 'rotate-180 text-secondary' : ''
            }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <menu
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
          role="listbox"
          aria-label="Chọn khu vực theo dõi"
        >
          <li>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${showingAllAreas
                  ? 'bg-secondary/10 font-semibold text-secondary'
                  : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
                }`}
              role="option"
              aria-selected={showingAllAreas}
            >
              <span className="truncate">Tất cả khu vực</span>
              {showingAllAreas ? (
                <Lucide.Check
                  size={15}
                  className="shrink-0"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </li>

          {areas.length === 0 ? (
            <li className="px-3 py-3 text-sm text-base-content/45">
              Chưa có khu vực cụ thể
            </li>
          ) : (
            areas.map((area) => {
              const areaId = String(getAreaId(area));
              const selected = areaId === String(value);

              return (
                <li key={areaId}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(areaId);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${selected
                        ? 'bg-secondary/10 font-semibold text-secondary'
                        : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
                      }`}
                    role="option"
                    aria-selected={selected}
                  >
                    <span className="truncate">
                      {getAreaName(area)}
                    </span>
                    {selected ? (
                      <Lucide.Check
                        size={15}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </menu>
      ) : null}
    </div>
  );
};


const CitizenDashboardThemeStyles = () => (
  <style>{`
    html:not([data-theme="dark"]) .citizen-dashboard-page {
      --public-surface: rgba(248, 251, 255, 0.97);
      --public-surface-soft: rgba(232, 239, 248, 0.95);
      --public-surface-strong: #f7faff;
      --public-border: rgba(148, 163, 184, 0.52);
      --public-border-soft: rgba(186, 205, 229, 0.86);
      --public-copy: #4f6077;
      --public-muted: #718198;
      --public-shadow: 0 22px 60px rgba(15, 23, 42, 0.12);
    }

    html:not([data-theme="dark"]) .citizen-dashboard-page-shell {
      border-color: rgba(148, 163, 184, 0.38);
      background:
        linear-gradient(
          180deg,
          rgba(226, 235, 247, 0.84) 0%,
          rgba(242, 247, 252, 0.58) 52%,
          rgba(235, 242, 250, 0.72) 100%
        );
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.78),
        0 24px 70px rgba(15, 23, 42, 0.06);
    }

    html[data-theme="dark"] .citizen-dashboard-page-shell {
      border-color: rgba(96, 165, 250, 0.15);
      background:
        linear-gradient(
          180deg,
          rgba(10, 28, 53, 0.62) 0%,
          rgba(7, 20, 39, 0.28) 58%,
          rgba(5, 13, 27, 0.12) 100%
        );
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.025),
        0 28px 78px rgba(0, 0, 0, 0.2);
    }

    html[data-theme="dark"] .citizen-dashboard-page .citizen-dashboard-hero {
      background:
        radial-gradient(circle at 10% 12%, rgba(37, 99, 235, 0.2), transparent 31%),
        radial-gradient(circle at 91% 16%, rgba(8, 145, 178, 0.12), transparent 29%),
        linear-gradient(145deg, #0d1d36 0%, #081426 100%) !important;
      border-color: rgba(96, 165, 250, 0.18) !important;
    }

    .citizen-dashboard-page .citizen-dashboard-hero-backdrop {
      background:
        radial-gradient(circle at 9% 12%, rgba(37, 99, 235, 0.14), transparent 31%),
        radial-gradient(circle at 91% 16%, rgba(8, 145, 178, 0.12), transparent 29%),
        linear-gradient(145deg, rgba(255, 255, 255, 0.2), rgba(219, 234, 254, 0.24));
    }

    html[data-theme="dark"] .citizen-dashboard-page .citizen-dashboard-hero-backdrop {
      background:
        radial-gradient(circle at 9% 12%, rgba(37, 99, 235, 0.18), transparent 32%),
        radial-gradient(circle at 91% 16%, rgba(8, 145, 178, 0.1), transparent 29%),
        linear-gradient(145deg, rgba(13, 29, 54, 0.18), rgba(8, 20, 38, 0.08)) !important;
    }

    .citizen-dashboard-page .citizen-dashboard-hero-map {
      color: #2563eb;
      opacity: 0.18;
    }

    html[data-theme="dark"] .citizen-dashboard-page .citizen-dashboard-hero-map {
      color: #67e8f9;
      opacity: 0.1;
    }

    html[data-theme="dark"] .citizen-dashboard-page .citizen-dashboard-panel {
      background: linear-gradient(155deg, #0d1d36, #081426) !important;
      border-color: rgba(96, 165, 250, 0.18) !important;
      box-shadow: 0 22px 58px rgba(0, 0, 0, 0.24) !important;
    }

    html[data-theme="dark"] .citizen-dashboard-page .citizen-dashboard-map-panel {
      background:
        radial-gradient(circle at 82% 12%, rgba(34, 211, 238, 0.08), transparent 28%),
        linear-gradient(145deg, rgba(12, 32, 58, 0.98), rgba(8, 22, 42, 0.98)) !important;
      border-color: rgba(96, 165, 250, 0.18) !important;
    }
  `}</style>
);

const getCommunityAreaName = (item) => (
  item?.areaName ||
  item?.wardName ||
  item?.districtName ||
  item?.locationText ||
  'Chưa xác định khu vực'
);

const formatCommunityDate = (value) => {
  if (!value) return 'Vừa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa cập nhật';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
};

const CitizenCommunityPreview = () => {
  const {
    items,
    loading,
    error,
    reload,
  } = usePublicLandingFeed();
  const previewItems = items.slice(0, 3);

  return (
    <section
      data-public-reveal
      className="citizen-dashboard-panel overflow-hidden rounded-[26px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_16px_42px_rgba(15,23,42,0.07)]"
      aria-labelledby="citizen-community-title"
    >
      <header className="flex flex-col gap-4 border-b border-[var(--public-border)] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Cộng đồng quanh bạn
          </p>
          <h2
            id="citizen-community-title"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--public-title)] sm:text-3xl"
          >
            Cập nhật đô thị mới nhất
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--public-copy)]">
            Những sự vụ công khai mới nhất và vị trí đang được cộng đồng quan tâm.
          </p>
        </div>

        <Link
          to="/community/feed"
          state={{ resetFeedScroll: true }}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 text-sm font-semibold text-[var(--public-title)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-primary"
        >
          Xem bảng tin
          <Lucide.ArrowRight size={15} aria-hidden="true" />
        </Link>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
        <div className="border-b border-[var(--public-border)] p-5 sm:p-6 xl:border-b-0 xl:border-r">
          {loading ? (
            <div className="space-y-3" aria-label="Đang tải cập nhật cộng đồng">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="flex animate-pulse items-center gap-3 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] p-4"
                  aria-hidden="true"
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-base-300/45" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-3/4 rounded-full bg-base-300/45" />
                    <div className="mt-2 h-3 w-1/2 rounded-full bg-base-300/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[22px] border border-dashed border-rose-300/60 bg-rose-500/[0.05] px-6 text-center">
              <Lucide.CloudOff size={23} className="text-rose-500" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-[var(--public-title)]">
                Chưa tải được cập nhật cộng đồng
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--public-copy)]">
                Dữ liệu công khai đang tạm thời chưa phản hồi. Các chức năng cá nhân vẫn hoạt động bình thường.
              </p>
              <button
                type="button"
                onClick={reload}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 text-sm font-semibold text-[var(--public-title)] transition hover:border-blue-300 hover:text-primary"
              >
                <Lucide.RefreshCw size={14} aria-hidden="true" />
                Tải lại
              </button>
            </div>
          ) : previewItems.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--public-border)] bg-[var(--public-surface-soft)] px-6 text-center">
              <Lucide.Inbox size={24} className="text-[var(--public-muted)]" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-[var(--public-title)]">
                Chưa có cập nhật công khai mới
              </h3>
              <p className="mt-2 text-sm text-[var(--public-copy)]">
                Các sự vụ đủ điều kiện công khai sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {previewItems.map((item) => {
                const incidentId = getCommunityIncidentId(item);
                const interactionFeedbackId = getCommunityInteractionFeedbackId(item);
                const statusValue = item?.incidentStatus || item?.status;
                const badgeClass = STATUS_BADGE_CLASSES[statusValue] || STATUS_BADGE_CLASSES.default;
                const statusMeta = getResidentStatusMeta(statusValue);

                return (
                  <li key={incidentId}>
                    <Link
                      to={incidentId ? `/community/feed/${incidentId}` : '/community/feed'}
                      state={incidentId ? {
                        interactionFeedbackId: interactionFeedbackId || undefined,
                        fallbackFeedbackId: interactionFeedbackId || undefined,
                      } : undefined}
                      className="group grid gap-3 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] p-4 transition hover:border-blue-300 hover:bg-[var(--public-surface-strong)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200/70 bg-blue-500/[0.07] text-primary" aria-hidden="true">
                        <Lucide.MapPin size={17} />
                      </span>

                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-semibold text-[var(--public-title)] transition group-hover:text-primary ">
                          {getCommunityItemTitle(item)}
                        </strong>
                        <span className="mt-1.5 flex items-center gap-2 text-xs text-[var(--public-muted)]">
                          <span className="truncate">{getCommunityAreaName(item)}</span>
                          <span aria-hidden="true">•</span>
                          <time className="shrink-0" dateTime={item?.updatedAt || item?.createdAt || undefined}>
                            {formatCommunityDate(item?.updatedAt || item?.createdAt)}
                          </time>
                        </span>
                      </span>

                      <span className="flex items-center justify-between gap-3 pl-[52px] sm:justify-end sm:pl-0">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeClass}`}>
                          {statusMeta.label}
                        </span>
                        <Lucide.ChevronRight size={15} className="text-[var(--public-muted)] transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside className="p-5 sm:p-6" aria-label="Bản đồ sự cố công khai">
          <CompactPublicIncidentMap
            items={previewItems}
            loading={loading}
            error={error}
            detailStateBuilder={(incident) => {
              const interactionFeedbackId = getCommunityInteractionFeedbackId(incident);
              return {
                interactionFeedbackId: interactionFeedbackId || undefined,
                fallbackFeedbackId: interactionFeedbackId || undefined,
              };
            }}
          />
        </aside>
      </div>
    </section>
  );
};

const RoleDashboard = () => {
  const { user } = useAuth();
  const currentRole = normalizeRole(user?.role);
  const navigate = useNavigate();

  const [cachedDashboard] = useState(() => {
    if (currentRole === APP_ROLES.ADMINISTRATOR) {
      return readAdminDashboardCache();
    }

    if (currentRole === APP_ROLES.SYSTEM_STAFF) {
      return readStaffDashboardSnapshot();
    }

    if (currentRole === APP_ROLES.INTERACTION_MANAGER) {
      return readManagerDashboardSnapshot();
    }

    return readDashboardSnapshot();
  });
  const [stats, setStats] = useState(
    () => cachedDashboard?.stats || SAFE_DASHBOARD_STATS
  );
  const [tickets, setTickets] = useState(
    () => Array.isArray(cachedDashboard?.tickets)
      ? cachedDashboard.tickets
      : []
  );
  const [adminMapTickets, setAdminMapTickets] = useState(
    () => Array.isArray(cachedDashboard?.mapTickets)
      ? cachedDashboard.mapTickets
      : []
  );
  const [ticketTotal, setTicketTotal] = useState(() => {
    const cachedTotal = Number(cachedDashboard?.ticketTotal);
    if (Number.isFinite(cachedTotal)) return cachedTotal;
    return Array.isArray(cachedDashboard?.tickets)
      ? cachedDashboard.tickets.length
      : 0;
  });
  const [feedbackSummary, setFeedbackSummary] = useState(() => (
    cachedDashboard?.feedbackSummary || calculateAdminFeedbackSummary(
      cachedDashboard?.tickets || [],
      cachedDashboard?.ticketTotal
    )
  ));
  const [slaOverview, setSlaOverview] = useState(null);
  const [categories, setCategories] = useState(
    () => Array.isArray(cachedDashboard?.categories)
      ? cachedDashboard.categories
      : []
  );
  const [areas, setAreas] = useState(
    () => Array.isArray(cachedDashboard?.areas)
      ? cachedDashboard.areas
      : []
  );
  const [selectedAreaId, setSelectedAreaId] = useState(
    readTrackedAreaId
  );
  const [loading, setLoading] = useState(!cachedDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [communityAreaCount, setCommunityAreaCount] = useState(0);
  const [
    communityAreaCountLoading,
    setCommunityAreaCountLoading,
  ] = useState(false);
  const [showStaffFilter, setShowStaffFilter] = useState(false);
  const [staffFilter, setStaffFilter] = useState('all');
  const dashboardRequestIdRef = useRef(0);

  const fetchScopedTickets = useCallback(async () => {
    if (!user) return { items: [], totalItems: 0 };

    if (currentRole === APP_ROLES.SERVICE_USER) {
      const response = await axiosClient.get('/api/user/feedbacks', {
        params: {
          PageNumber: 1,
          PageSize: 1000,
        },
      });
      return normalizeTicketPage(response);
    }

    if (currentRole === APP_ROLES.SERVICE_PROVIDER) {
      const response = await ticketApi.getTickets(
        { operatorId: user.operatorId },
        { role: currentRole }
      );
      return normalizeTicketPage(response);
    }

    if (currentRole === APP_ROLES.SYSTEM_STAFF) {
      const response = await managementFeedbackApi.getFeedbacks({
        pageIndex: 0,
        pageSize: 10,
      });
      return normalizeTicketPage(response);
    }


    const response = await ticketApi.getTickets(
      {},
      { role: currentRole }
    );
    return normalizeTicketPage(response);
  }, [currentRole, user]);

  const fetchAdminDashboardContent = useCallback(async () => {
    const [overviewResult, categoryResult, recentResult, mapResult, slaOverviewResult] = await Promise.allSettled([
      incidentDashboardApi.getOverview(),
      incidentDashboardApi.getCategoryDistribution(),
      incidentDashboardApi.getRecent(10),
      managementFeedbackApi.getFeedbacks({
        pageIndex: 0,
        pageSize: 1000,
      }),
      slaApi.getDashboardOverview(),
    ]);

    return {
      overview: overviewResult.status === 'fulfilled' ? overviewResult.value : null,
      categoryDistribution: categoryResult.status === 'fulfilled' ? categoryResult.value : null,
      recentTickets: recentResult.status === 'fulfilled' ? recentResult.value : null,
      mapTickets: mapResult.status === 'fulfilled'
        ? normalizeTicketPage(mapResult.value).items
        : null,
      slaOverview: slaOverviewResult.status === 'fulfilled' ? slaOverviewResult.value : null,
    };
  }, []);

  const fetchManagerDashboardContent = useCallback(async () => {
    const [
      overviewResult,
      statusResult,
      priorityResult,
      categoryResult,
      areaResult,
      trendResult,
      urgentResult,
      slaOverviewResult,
      todayResult,
    ] = await Promise.allSettled([
      incidentDashboardApi.getOverview(),
      incidentDashboardApi.getStatusDistribution(),
      incidentDashboardApi.getPriorityDistribution(),
      incidentDashboardApi.getCategoryDistribution(),
      incidentDashboardApi.getAreaDistribution(),
      incidentDashboardApi.getMonthlyTrend(6),
      incidentDashboardApi.getUrgentOpen(3),
      slaApi.getDashboardOverview(),
      incidentDashboardApi.getTodaySummary(),
    ]);

    const categoryDistribution = categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value)
      ? [...categoryResult.value].sort((left, right) => Number(right?.count || 0) - Number(left?.count || 0))
      : null;
    const areaDistribution = areaResult.status === 'fulfilled' && Array.isArray(areaResult.value)
      ? [...areaResult.value].sort((left, right) => Number(right?.openCount || 0) - Number(left?.openCount || 0))
      : null;
    const dataIssues = [
      [overviewResult, 'KPI sự vụ'],
      [statusResult, 'trạng thái sự vụ'],
      [priorityResult, 'mức ưu tiên'],
      [categoryResult, 'nhóm dịch vụ'],
      [areaResult, 'khu vực'],
      [trendResult, 'xu hướng'],
      [urgentResult, 'sự vụ khẩn cấp'],
      [slaOverviewResult, 'SLA'],
      [todayResult, 'số liệu trong ngày'],
    ]
      .filter(([result]) => result.status === 'rejected')
      .map(([, label]) => label);

    return {
      overview: overviewResult.status === 'fulfilled' ? overviewResult.value : null,
      statusDistribution: statusResult.status === 'fulfilled' && Array.isArray(statusResult.value)
        ? statusResult.value
        : null,
      priorityDistribution: priorityResult.status === 'fulfilled' && Array.isArray(priorityResult.value)
        ? priorityResult.value
        : null,
      categoryDistribution,
      areaDistribution,
      monthlyTrend: trendResult.status === 'fulfilled' && Array.isArray(trendResult.value)
        ? trendResult.value
        : null,
      urgentOpen: urgentResult.status === 'fulfilled' && Array.isArray(urgentResult.value)
        ? urgentResult.value
        : null,
      slaOverview: slaOverviewResult.status === 'fulfilled' ? slaOverviewResult.value : null,
      todaySummary: todayResult.status === 'fulfilled' ? todayResult.value : null,
      dataIssues,
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadDashboardContent = async () => {
      const requestId = ++dashboardRequestIdRef.current;
      const hasCachedContent = Boolean(cachedDashboard);
      const hasFreshManagerCache = currentRole === APP_ROLES.INTERACTION_MANAGER
        && isFreshManagerDashboardSnapshot(cachedDashboard);

      if (hasFreshManagerCache) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (hasCachedContent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const isAdmin = currentRole === APP_ROLES.ADMINISTRATOR;
        const isManager = currentRole === APP_ROLES.INTERACTION_MANAGER;
        const [
          resStats,
          fetchedCategories,
          fetchedAreas,
          ticketPage,
          adminDashboard,
          managerDashboard,
        ] = await Promise.all([
          currentRole === APP_ROLES.SERVICE_USER
            ? Promise.resolve(SAFE_DASHBOARD_STATS)
            : isManager
              ? Promise.resolve(cachedDashboard?.stats || SAFE_DASHBOARD_STATS)
              : analyticsApi.getSystemDashboardStats(currentRole),
          toolsApi.getCategories().catch(() => []),
          currentRole === APP_ROLES.SERVICE_USER
            ? toolsApi.getAreas().catch(() => [])
            : Promise.resolve([]),
          isAdmin ? Promise.resolve(null) : fetchScopedTickets(),
          isAdmin ? fetchAdminDashboardContent() : Promise.resolve(null),
          isManager ? fetchManagerDashboardContent() : Promise.resolve(null),
        ]);
        const baseStats = normalizeDashboardStats(resStats);
        const nextStats = isAdmin && Array.isArray(adminDashboard?.categoryDistribution)
          ? {
            ...baseStats,
            categoryDistribution: adminDashboard.categoryDistribution,
          }
          : isManager
            ? buildManagerDashboardStats(baseStats, managerDashboard, cachedDashboard?.stats || {})
            : baseStats;
        const nextCategories = Array.isArray(fetchedCategories)
          ? fetchedCategories
          : [];
        const nextAreas = Array.isArray(fetchedAreas)
          ? fetchedAreas
          : [];
        const nextTickets = isAdmin
          ? (Array.isArray(adminDashboard?.recentTickets)
            ? adminDashboard.recentTickets
            : (Array.isArray(cachedDashboard?.tickets) ? cachedDashboard.tickets : []))
          : (Array.isArray(ticketPage?.items) ? ticketPage.items : []);
        const nextAdminMapTickets = isAdmin
          ? (Array.isArray(adminDashboard?.mapTickets)
            ? adminDashboard.mapTickets
            : (Array.isArray(cachedDashboard?.mapTickets) ? cachedDashboard.mapTickets : []))
          : [];
        const nextFeedbackSummary = isAdmin
          ? mapFeedbackDashboardOverview(
            adminDashboard?.overview,
            cachedDashboard?.feedbackSummary || calculateAdminFeedbackSummary(
              nextTickets,
              cachedDashboard?.ticketTotal
            )
          )
          : null;
        const nextTicketTotal = isAdmin
          ? nextFeedbackSummary.total
          : (Number.isFinite(Number(ticketPage?.totalItems))
            ? Number(ticketPage.totalItems)
            : nextTickets.length);

        if (requestId !== dashboardRequestIdRef.current) return;

        setStats(nextStats);
        setCategories(nextCategories);
        setAreas(nextAreas);
        setTickets(nextTickets);
        setAdminMapTickets(nextAdminMapTickets);
        setTicketTotal(nextTicketTotal);
        if (currentRole === APP_ROLES.ADMINISTRATOR) {
          setFeedbackSummary(nextFeedbackSummary);
          setSlaOverview(adminDashboard?.slaOverview || null);
        }

        if (currentRole === APP_ROLES.SERVICE_USER) {
          writeDashboardSnapshot({
            stats: nextStats,
            categories: nextCategories,
            areas: nextAreas,
            tickets: nextTickets,
            ticketTotal: nextTicketTotal,
          });
        } else if (currentRole === APP_ROLES.SYSTEM_STAFF) {
          writeStaffDashboardSnapshot({
            stats: nextStats,
            categories: nextCategories,
            tickets: nextTickets,
            ticketTotal: nextTicketTotal,
          });
        } else if (currentRole === APP_ROLES.ADMINISTRATOR) {
          writeAdminDashboardCache({
            stats: nextStats,
            categories: nextCategories,
            tickets: nextTickets,
            mapTickets: nextAdminMapTickets,
            ticketTotal: nextTicketTotal,
            feedbackSummary: nextFeedbackSummary,
          });
        } else if (currentRole === APP_ROLES.INTERACTION_MANAGER) {
          writeManagerDashboardSnapshot({
            stats: nextStats,
            categories: nextCategories,
            tickets: nextTickets,
            ticketTotal: nextTicketTotal,
          });
        }
      } catch (err) {
        if (requestId !== dashboardRequestIdRef.current) return;

        console.error(err);

        if (!hasCachedContent) {
          setStats(currentRole === APP_ROLES.INTERACTION_MANAGER
            ? buildManagerDashboardStats(SAFE_DASHBOARD_STATS, { dataIssues: ['dữ liệu tổng quan'] }, {})
            : SAFE_DASHBOARD_STATS);
          setCategories([]);
          setAreas([]);
          setTickets([]);
          setTicketTotal(0);
          if (currentRole === APP_ROLES.ADMINISTRATOR) {
            setSlaOverview(null);
          }
        }
      } finally {
        if (requestId === dashboardRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadDashboardContent();

    return () => {
      dashboardRequestIdRef.current += 1;
    };
  }, [
    user,
    currentRole,
    fetchScopedTickets,
    fetchAdminDashboardContent,
    fetchManagerDashboardContent,
    cachedDashboard,
  ]);

  // Realtime updates: refresh dashboard when tickets change.
  useEffect(() => {
    if (!user) return;
    signalrService.start();

    const reload = async () => {
      const requestId = ++dashboardRequestIdRef.current;

      try {
        const isAdmin = currentRole === APP_ROLES.ADMINISTRATOR;
        const isManager = currentRole === APP_ROLES.INTERACTION_MANAGER;
        const realtimeCache = isAdmin ? readAdminDashboardCache() : null;
        const [resStats, fetchedCategories, ticketPage, adminDashboard, managerDashboard] = await Promise.all([
          currentRole === APP_ROLES.SERVICE_USER
            ? Promise.resolve(SAFE_DASHBOARD_STATS)
            : isManager
              ? Promise.resolve(readManagerDashboardSnapshot()?.stats || SAFE_DASHBOARD_STATS)
              : analyticsApi.getSystemDashboardStats(currentRole),
          toolsApi.getCategories().catch(() => []),
          isAdmin ? Promise.resolve(null) : fetchScopedTickets(),
          isAdmin ? fetchAdminDashboardContent() : Promise.resolve(null),
          isManager ? fetchManagerDashboardContent() : Promise.resolve(null),
        ]);
        const nextTickets = isAdmin
          ? (Array.isArray(adminDashboard?.recentTickets)
            ? adminDashboard.recentTickets
            : (Array.isArray(realtimeCache?.tickets) ? realtimeCache.tickets : []))
          : (Array.isArray(ticketPage?.items) ? ticketPage.items : []);
        const nextAdminMapTickets = isAdmin
          ? (Array.isArray(adminDashboard?.mapTickets)
            ? adminDashboard.mapTickets
            : (Array.isArray(realtimeCache?.mapTickets) ? realtimeCache.mapTickets : []))
          : [];
        const nextFeedbackSummary = isAdmin
          ? mapFeedbackDashboardOverview(
            adminDashboard?.overview,
            realtimeCache?.feedbackSummary || calculateAdminFeedbackSummary(
              realtimeCache?.tickets || [],
              realtimeCache?.ticketTotal
            )
          )
          : null;
        const nextTicketTotal = isAdmin
          ? nextFeedbackSummary.total
          : (Number.isFinite(Number(ticketPage?.totalItems))
            ? Number(ticketPage.totalItems)
            : nextTickets.length);

        if (requestId !== dashboardRequestIdRef.current) return;

        const baseStats = normalizeDashboardStats(resStats);
        const nextStats = isAdmin && Array.isArray(adminDashboard?.categoryDistribution)
          ? {
            ...baseStats,
            categoryDistribution: adminDashboard.categoryDistribution,
          }
          : isManager
            ? buildManagerDashboardStats(baseStats, managerDashboard, readManagerDashboardSnapshot()?.stats || {})
            : baseStats;
        const nextCategories = Array.isArray(fetchedCategories)
          ? fetchedCategories
          : [];

        setStats(nextStats);
        setCategories(nextCategories);
        setTickets(nextTickets);
        setAdminMapTickets(nextAdminMapTickets);
        setTicketTotal(nextTicketTotal);
        if (currentRole === APP_ROLES.ADMINISTRATOR) {
          setFeedbackSummary(nextFeedbackSummary);
          setSlaOverview(adminDashboard?.slaOverview || null);
          writeAdminDashboardCache({
            stats: nextStats,
            categories: nextCategories,
            tickets: nextTickets,
            mapTickets: nextAdminMapTickets,
            ticketTotal: nextTicketTotal,
            feedbackSummary: nextFeedbackSummary,
          });
        } else if (currentRole === APP_ROLES.SYSTEM_STAFF) {
          writeStaffDashboardSnapshot({
            stats: nextStats,
            categories: nextCategories,
            tickets: nextTickets,
            ticketTotal: nextTicketTotal,
          });
        } else if (currentRole === APP_ROLES.INTERACTION_MANAGER) {
          writeManagerDashboardSnapshot({
            stats: nextStats,
            categories: nextCategories,
            tickets: nextTickets,
            ticketTotal: nextTicketTotal,
          });
        }
      } catch (e) {
        if (requestId !== dashboardRequestIdRef.current) return;
        console.warn('Dashboard realtime reload failed', e);
      } finally {
        if (requestId === dashboardRequestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    const relevantEvents = [
      'FeedbackStatusChanged',
      'CommentAdded',
      'SupportAdded',
      'AssignmentCreated',
      'AssignmentUpdated',
      'ResolutionApproved',
      'ResolutionSubmitted',
      'ResolutionRejected',
      'NotificationReceived',
    ];
    relevantEvents.forEach((eventName) => (
      signalrService.on(eventName, reload)
    ));

    return () => {
      relevantEvents.forEach((eventName) => (
        signalrService.off(eventName, reload)
      ));
      dashboardRequestIdRef.current += 1;
    };
  }, [user, currentRole, fetchScopedTickets, fetchAdminDashboardContent, fetchManagerDashboardContent]);

  useEffect(() => {
    if (
      currentRole !== APP_ROLES.SERVICE_USER ||
      areas.length === 0
    ) {
      return;
    }

    if (!selectedAreaId) return;

    const currentAreaExists = areas.some(
      (area) => (
        String(getAreaId(area)) === String(selectedAreaId)
      )
    );

    if (!currentAreaExists) {
      setSelectedAreaId('');
    }
  }, [areas, currentRole, selectedAreaId]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      currentRole !== APP_ROLES.SERVICE_USER
    ) {
      return;
    }

    try {
      if (selectedAreaId) {
        window.localStorage.setItem(
          DASHBOARD_AREA_STORAGE_KEY,
          String(selectedAreaId)
        );
      } else {
        window.localStorage.removeItem(
          DASHBOARD_AREA_STORAGE_KEY
        );
      }
    } catch {
      // Không chặn dashboard nếu trình duyệt không cho dùng storage.
    }
  }, [currentRole, selectedAreaId]);

  useEffect(() => {
    if (currentRole !== APP_ROLES.SERVICE_USER) return undefined;

    let cancelled = false;

    const loadCommunityAreaCount = async () => {
      setCommunityAreaCountLoading(true);

      try {
        const selectedArea = areas.find(
          (area) => String(getAreaId(area)) === String(selectedAreaId)
        );
        const selectedAreaName = selectedArea
          ? getAreaName(selectedArea)
          : '';
        const response = await getCommunityFeed({
          PageNumber: 1,
          PageSize: 1,
          ...(selectedAreaName ? { Search: selectedAreaName } : {}),
        });
        const nextCount = Number(
          response?.totalItems ?? response?.items?.length ?? 0
        );

        if (!cancelled) {
          setCommunityAreaCount(
            Number.isFinite(nextCount) ? nextCount : 0
          );
        }
      } catch (error) {
        console.warn(
          'Không thể tải số sự vụ công khai theo khu vực',
          error
        );

        if (!cancelled) {
          setCommunityAreaCount(0);
        }
      } finally {
        if (!cancelled) {
          setCommunityAreaCountLoading(false);
        }
      }
    };

    loadCommunityAreaCount();

    return () => {
      cancelled = true;
    };
  }, [areas, currentRole, selectedAreaId]);

  if (loading && currentRole === 'interaction-manager') {
    return (
      <main
        className="manager-ui-page space-y-4 pb-6"
        aria-busy="true"
        aria-label="Đang tải tổng quan hệ thống"
      >
        <span className="sr-only" role="status">Đang tải dữ liệu tổng quan</span>

        <section className="animate-pulse rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950" aria-hidden="true">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
              <div>
                <div className="h-8 w-64 max-w-[65vw] rounded-xl bg-slate-200/80 dark:bg-slate-800" />
                <div className="mt-3 h-3.5 w-[30rem] max-w-[60vw] rounded-full bg-slate-100 dark:bg-slate-900" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-36 rounded-xl bg-slate-100 dark:bg-slate-900" />
              <div className="h-9 w-32 rounded-xl bg-slate-200/80 dark:bg-slate-800" />
            </div>
          </div>
        </section>

        <section className="animate-pulse overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950" aria-hidden="true">
          <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="px-5 py-4">
                <div className="h-3 w-24 rounded-full bg-slate-200/80 dark:bg-slate-800" />
                <div className="mt-3 h-8 w-14 rounded-lg bg-slate-200/80 dark:bg-slate-800" />
                <div className="mt-2 h-3 w-32 rounded-full bg-slate-100 dark:bg-slate-900" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]" aria-hidden="true">
          <div className="animate-pulse overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="h-20 border-b border-slate-100 p-5 dark:border-slate-900">
              <div className="h-5 w-44 rounded-lg bg-slate-200/80 dark:bg-slate-800" />
              <div className="mt-2 h-3 w-72 rounded-full bg-slate-100 dark:bg-slate-900" />
            </div>
            <div className="grid sm:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-40 border-b border-slate-100 p-5 sm:border-b-0 sm:border-r dark:border-slate-900"><div className="h-full rounded-xl bg-slate-100 dark:bg-slate-900" /></div>)}
            </div>
            <div className="border-t border-slate-100 p-4 dark:border-slate-900">
              {[0, 1, 2].map((item) => <div key={item} className="mb-2 h-12 rounded-xl bg-slate-100 last:mb-0 dark:bg-slate-900" />)}
            </div>
          </div>
          <div className="h-[430px] animate-pulse rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="h-5 w-36 rounded-lg bg-slate-200/80 dark:bg-slate-800" />
            <div className="mt-8 h-10 w-20 rounded-lg bg-slate-200/80 dark:bg-slate-800" />
            <div className="mt-5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-900" />
            <div className="mt-7 space-y-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-4 rounded bg-slate-100 dark:bg-slate-900" />)}</div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]" aria-hidden="true">
          <div className="h-[290px] animate-pulse rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950" />
          <div className="h-[430px] animate-pulse rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950" />
        </section>
      </main>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center py-20 bg-white rounded-3xl border border-slate-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Convert ticket priority string to Figma priority badge
  const renderPriorityBadge = (p) => {
    switch (p) {
      case 'Urgent':
      case 'Critical':
        return <span className="badge-priority-critical">KHẨN CẤP</span>;
      case 'High':
        return <span className="badge-priority-high">CAO</span>;
      case 'Medium':
        return <span className="badge-priority-medium">TRUNG BÌNH</span>;
      case 'Low':
        return <span className="badge-priority-low">THẤP</span>;
      default:
        return <span className="badge-priority-low">TRUNG BÌNH</span>;
    }
  };

  // Convert ticket status to Figma status bubble
  const renderStatusBadge = (s) => {
    switch (s) {
      case managementTypes.feedbackStatus.SUBMITTED:
        return <span className="status-label border-indigo-200 bg-indigo-50 text-indigo-700">Cần kiểm tra AI</span>;
      case managementTypes.feedbackStatus.AI_REVIEWED:
        return <span className="status-label border-violet-200 bg-violet-50 text-violet-700">Chờ phân công</span>;
      case managementTypes.feedbackStatus.VERIFIED:
        return <span className="status-label border-sky-200 bg-sky-50 text-sky-700">Đã xác minh</span>;
      case managementTypes.feedbackStatus.ASSIGNED:
        return <span className="status-label border-cyan-200 bg-cyan-50 text-cyan-700">Đã phân công</span>;
      case managementTypes.feedbackStatus.IN_PROGRESS:
        return <span className="status-label border-purple-200 bg-purple-50 text-purple-700">Đang xử lý</span>;
      case managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL:
        return <span className="status-label border-amber-200 bg-amber-50 text-amber-700">Chờ duyệt KQ</span>;
      case managementTypes.feedbackStatus.NEED_REWORK:
        return <span className="status-label border-orange-200 bg-orange-50 text-orange-700">Cần bổ sung</span>;
      case managementTypes.feedbackStatus.RESOLVED:
        return <span className="status-label border-emerald-200 bg-emerald-50 text-emerald-700">Chờ duyệt KQ</span>;
      case managementTypes.feedbackStatus.REJECTED:
        return <span className="status-label border-rose-200 bg-rose-50 text-rose-700">Không tiếp nhận</span>;
      case managementTypes.feedbackStatus.CLOSED:
        return <span className="status-label border-teal-200 bg-teal-50 text-teal-700">Đã đóng</span>;
      default:
        return <span className="status-label border-slate-200 bg-slate-50 text-slate-700">Chờ xử lý</span>;
    }
  };

  // Icon mapping helper
  const renderCategoryIcon = (catId) => {
    switch (catId) {
      case 1: return <Lucide.Trash className="text-emerald-500 shrink-0" size={14} />;
      case 2: return <Lucide.Lightbulb className="text-amber-500 shrink-0" size={14} />;
      case 3: return <Lucide.Droplet className="text-blue-500 shrink-0" size={14} />;
      case 4: return <Lucide.Construction className="text-indigo-500 shrink-0" size={14} />;
      case 5: return <Lucide.Trees className="text-green-500 shrink-0" size={14} />;
      default: return <Lucide.Construction className="text-slate-500 shrink-0" size={14} />;
    }
  };

  // Convert default fb- ticket ID to UM-2026-00xxx
  const formatTicketId = (fbId) => {
    if (!fbId) return '';
    const num = fbId.split('-').pop();
    return `UM-2026-00${num}`;
  };

  const getCategoryName = (categoryId) => {
    const matchedCategory = categories.find((category) => category.categoryId === categoryId);
    return getCategoryLabel(matchedCategory?.categoryName || matchedCategory?.name || matchedCategory?.categoryType || matchedCategory?.type, 'Khác');
  };

  const residentTickets = Array.isArray(tickets) ? tickets : [];
  const isConfirmedDuplicateTicket = (ticket) => Boolean(
    ticket?.parentTicketId || ticket?.parentFeedbackId
  );
  const residentTotal = Math.max(ticketTotal, residentTickets.length);
  const residentInProgressStatuses = [
    managementTypes.feedbackStatus.VERIFIED,
    managementTypes.feedbackStatus.ASSIGNED,
    managementTypes.feedbackStatus.IN_PROGRESS,
    managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
    managementTypes.feedbackStatus.NEED_REWORK,
  ];

  const filteredStaffTickets = [...residentTickets].filter((ticket) => {
    if (staffFilter === 'needs-attention') {
      return [
        managementTypes.feedbackStatus.SUBMITTED,
        managementTypes.feedbackStatus.AI_REVIEWED,
        managementTypes.feedbackStatus.ASSIGNED,
        managementTypes.feedbackStatus.IN_PROGRESS,
      ].includes(ticket.status);
    }

    if (staffFilter === 'high-priority') {
      return ['Urgent', 'Critical', 'High'].includes(ticket.priority);
    }

    return true;
  }).sort((a, b) => {
    if (staffFilter === 'latest') {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    }

    return 0;
  });
  const residentInProgress = residentTickets.filter((ticket) => (
    !isConfirmedDuplicateTicket(ticket) && residentInProgressStatuses.includes(ticket.status)
  )).length;
  const residentEnded = residentTickets.filter((ticket) => (
    ticket.status === managementTypes.feedbackStatus.CLOSED
  )).length;
  const needsReworkTickets = residentTickets.filter((ticket) => (
    !isConfirmedDuplicateTicket(ticket) && ticket.status === managementTypes.feedbackStatus.NEED_REWORK
  ));
  const awaitingReviewTickets = residentTickets.filter((ticket) => (
    !isConfirmedDuplicateTicket(ticket) && ticket.status === managementTypes.feedbackStatus.APPROVED
  ));
  const residentNeedsAttention = (
    needsReworkTickets.length + awaitingReviewTickets.length
  );
  const recentResidentTickets = [...residentTickets]
    .sort((a, b) => (
      new Date(b.updatedAt || b.createdAt || 0) -
      new Date(a.updatedAt || a.createdAt || 0)
    ))
    .slice(0, 5);
  const attentionTickets = [
    ...needsReworkTickets,
    ...awaitingReviewTickets,
  ]
    .sort((a, b) => (
      new Date(b.updatedAt || b.createdAt || 0) -
      new Date(a.updatedAt || a.createdAt || 0)
    ))
    .slice(0, 3);

  const selectedArea = areas.find(
    (area) => (
      String(getAreaId(area)) === String(selectedAreaId)
    )
  );
  const selectedAreaName = selectedArea
    ? getAreaName(selectedArea)
    : 'Chưa chọn khu vực';
  const selectedAreaTickets = selectedAreaId
    ? residentTickets.filter((ticket) => {
      const ticketAreaId = getTicketAreaId(ticket);

      if (ticketAreaId) {
        return (
          String(ticketAreaId) === String(selectedAreaId)
        );
      }

      return ticket?.areaName === selectedAreaName;
    })
    : residentTickets;
  const selectedAreaTicketUrl = selectedArea
    ? buildTicketListUrl({ search: selectedAreaName })
    : '/tickets';

  const getResidentStatusMeta = (status) => {
    const statusMap = {
      [managementTypes.feedbackStatus.SUBMITTED]: {
        label: 'Đã tiếp nhận',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      },
      [managementTypes.feedbackStatus.AI_REVIEWED]: {
        label: 'Đang phân loại',
        className: 'border-violet-200 bg-violet-50 text-violet-700',
      },
      [managementTypes.feedbackStatus.VERIFIED]: {
        label: 'Đã xác minh',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
      },
      [managementTypes.feedbackStatus.ASSIGNED]: {
        label: 'Đã chuyển xử lý',
        className: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      },
      [managementTypes.feedbackStatus.IN_PROGRESS]: {
        label: 'Đang xử lý',
        className: 'border-purple-200 bg-purple-50 text-purple-700',
      },
      [managementTypes.feedbackStatus.RESOLVED]: {
        label: 'Đang kiểm tra kết quả',
        className: 'border-teal-200 bg-teal-50 text-teal-700',
      },
      [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: {
        label: 'Đang kiểm tra kết quả',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      },
      [managementTypes.feedbackStatus.APPROVED]: {
        label: 'Chờ bạn đánh giá',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      },
      [managementTypes.feedbackStatus.NEED_REWORK]: {
        label: 'Đang bổ sung',
        className: 'border-orange-200 bg-orange-50 text-orange-700',
      },
      [managementTypes.feedbackStatus.REJECTED]: {
        label: 'Không tiếp nhận',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      },
      [managementTypes.feedbackStatus.CLOSED]: {
        label: 'Đã kết thúc',
        className: 'border-slate-200 bg-slate-50 text-slate-700',
      },
      [managementTypes.feedbackStatus.CANCELLED]: {
        label: 'Đã hủy',
        className: 'border-base-300 bg-base-200 text-base-content/60',
      },
    };

    return statusMap[status] || {
      label: 'Đang cập nhật',
      className: 'border-base-300 bg-base-200 text-base-content/70',
    };
  };

  const formatResidentDate = (value) => {
    if (!value) return 'Chưa cập nhật';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // ----------------------------------------------------
  // 1. SERVICE USER DASHBOARD
  // ----------------------------------------------------
  if (currentRole === 'service-user') {
    if (loading) {
      return (
        <main
          className="space-y-6 text-[var(--public-title)]"
          aria-busy="true"
          aria-label="Đang tải trang chủ"
        >
          <span className="sr-only" role="status">
            Đang tải dữ liệu trang chủ
          </span>

          <section className="overflow-hidden rounded-[32px] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 shadow-[var(--public-shadow)] sm:p-7">
            <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.72fr)] xl:items-end">
              <div className="animate-pulse">
                <div className="h-7 w-36 rounded-full bg-slate-200/80 dark:bg-white/10" />
                <div className="mt-5 h-11 w-64 max-w-full rounded-xl bg-slate-200/80 dark:bg-white/10" />
                <div className="mt-4 h-4 w-full max-w-xl rounded-full bg-slate-100 dark:bg-white/[0.07]" />
                <div className="mt-2 h-4 w-4/5 max-w-lg rounded-full bg-slate-100 dark:bg-white/[0.07]" />
                <div className="mt-6 flex gap-3">
                  <div className="h-11 w-36 rounded-xl bg-slate-200/80 dark:bg-white/10" />
                  <div className="h-11 w-40 rounded-xl bg-slate-100 dark:bg-white/[0.07]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className={`h-28 animate-pulse rounded-[22px] border border-[var(--public-border)] bg-[var(--public-surface-soft)] ${item === 2 ? 'col-span-2 sm:col-span-1' : ''}`}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="h-36 animate-pulse rounded-[28px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm" aria-hidden="true" />

          <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(350px,0.65fr)]">
            <div className="h-[430px] animate-pulse rounded-[28px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm" aria-hidden="true" />
            <div className="h-[430px] animate-pulse rounded-[28px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm" aria-hidden="true" />
          </section>

          <section className="h-[430px] animate-pulse rounded-[30px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm" aria-hidden="true" />
        </main>
      );
    }

    return (
      <PublicPageMotion>
        <CitizenDashboardThemeStyles />
        <main
          data-public-reveal
          className="citizen-dashboard-page relative isolate space-y-5 text-[var(--public-title)]"
          aria-busy={refreshing}
        >
          <div
            className="citizen-dashboard-page-shell pointer-events-none absolute -inset-x-3 -inset-y-5 -z-10 overflow-hidden rounded-[36px] border border-[var(--public-border-soft)] bg-[linear-gradient(180deg,var(--public-surface-soft),transparent)] sm:-inset-x-5 sm:-inset-y-6"
            aria-hidden="true"
          />
          {refreshing ? (
          <div
            className="fixed right-5 top-24 z-40 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-[var(--public-surface-strong)] px-3 py-2 text-xs font-semibold text-blue-700 shadow-lg backdrop-blur "
            role="status"
            aria-live="polite"
          >
            <span className="loading loading-spinner loading-xs" />
            Đang đồng bộ trang chủ
          </div>
        ) : null}

          <section
            data-public-reveal
            className="citizen-dashboard-hero relative isolate overflow-hidden rounded-[30px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[var(--public-shadow)]"
          aria-labelledby="citizen-dashboard-title"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="citizen-dashboard-hero-backdrop absolute inset-0" />
            <svg
              viewBox="0 0 1280 410"
              preserveAspectRatio="none"
              className="citizen-dashboard-hero-map absolute inset-0 h-full w-full"
              fill="none"
            >
              <path d="M-40 282C120 238 178 128 322 126C450 124 488 220 623 217C762 214 814 112 955 109C1097 106 1168 199 1328 166" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M-15 343C168 310 244 220 377 228C518 236 597 319 733 305C863 292 919 218 1037 216C1161 214 1216 269 1310 287" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="10 12" opacity="0.78" />
              <circle cx="322" cy="126" r="7" fill="currentColor" opacity="0.8" />
              <circle cx="623" cy="217" r="9" fill="currentColor" opacity="0.65" />
              <circle cx="955" cy="109" r="8" fill="currentColor" opacity="0.8" />
              <circle cx="1037" cy="216" r="10" fill="currentColor" opacity="0.55" />
            </svg>
            <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-blue-500/[0.08] blur-3xl" />
            <div className="absolute -right-16 top-4 h-72 w-72 rounded-full bg-cyan-500/[0.08] blur-3xl" />
          </div>

          <div className="relative grid gap-8 px-5 py-7 sm:px-8 sm:py-9 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.72fr)] xl:items-end">
            <header className="max-w-2xl">
              <h1
                id="citizen-dashboard-title"
                className="text-3xl font-semibold tracking-[-0.035em] text-[var(--public-title)] sm:text-4xl lg:text-[44px]"
              >
                Chào, {user?.fullName || 'Bạn'}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--public-copy)] sm:text-base sm:leading-7">
                Theo dõi phản ánh, cập nhật tiến độ và những thông tin đô thị liên quan đến bạn trong cùng một nơi.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  to="/tickets/create"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  <Lucide.Plus size={17} aria-hidden="true" />
                  Gửi phản ánh
                </Link>
                <Link
                  to="/tickets"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-5 text-sm font-semibold text-[var(--public-title)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary"
                >
                  <Lucide.Files size={17} aria-hidden="true" />
                  Phản ánh của tôi
                </Link>
              </div>

              <div className="mt-5">
                {residentNeedsAttention > 0 ? (
                  <a
                    href="#citizen-attention"
                    className="inline-flex items-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning transition hover:bg-warning/15"
                  >
                    <Lucide.BellRing size={14} aria-hidden="true" />
                    {residentNeedsAttention} việc đang chờ bạn kiểm tra
                    <Lucide.ArrowDown size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                    <Lucide.CircleCheck size={14} aria-hidden="true" />
                    Hiện không có việc cần bạn bổ sung
                  </span>
                )}
              </div>
            </header>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <li>
                <Link
                  to="/tickets"
                  className="group block h-full rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)]/90 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                >
                  <span className="flex items-center justify-between gap-2 text-[11px] font-medium text-base-content/50">
                    Tổng phản ánh
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
                    <Lucide.Files size={15} />
                  </span>
                  </span>
                  <strong className="mt-2 block text-3xl font-bold tracking-[-0.035em] text-base-content">
                    {residentTotal}
                  </strong>
                  <span className="mt-1 block text-[11px] text-base-content/40 transition group-hover:text-primary">
                    Xem toàn bộ hồ sơ
                  </span>
                </Link>
              </li>

              <li>
                <Link
                to={buildTicketListUrl({ status: 'processing' })}
                  className="group block h-full rounded-2xl border border-warning/25 bg-[var(--public-surface-strong)]/90 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-md"
                >
                  <span className="flex items-center justify-between gap-2 text-[11px] font-medium text-base-content/50">
                    Đang xử lý
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/10 text-warning" aria-hidden="true">
                    <Lucide.LoaderCircle size={15} />
                  </span>
                  </span>
                  <strong className="mt-2 block text-3xl font-bold tracking-[-0.035em] text-warning">
                    {residentInProgress}
                  </strong>
                  <span className="mt-1 block text-[11px] text-base-content/40 transition group-hover:text-warning">
                    Theo dõi tiến độ
                  </span>
                </Link>
              </li>

              <li className="col-span-2 sm:col-span-1">
                <Link
                to={buildTicketListUrl({ status: 'ended' })}
                  className="group block h-full rounded-2xl border border-success/25 bg-[var(--public-surface-strong)]/90 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-success/40 hover:shadow-md"
                >
                  <span className="flex items-center justify-between gap-2 text-[11px] font-medium text-base-content/50">
                    Đã kết thúc
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-success/10 text-success" aria-hidden="true">
                    <Lucide.CircleCheckBig size={15} />
                  </span>
                  </span>
                  <strong className="mt-2 block text-3xl font-bold tracking-[-0.035em] text-success">
                    {residentEnded}
                  </strong>
                  <span className="mt-1 block text-[11px] text-base-content/40 transition group-hover:text-success">
                    Xem kết quả đã xử lý
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <section
          data-public-reveal
          id="citizen-attention"
          className={`citizen-dashboard-panel overflow-hidden rounded-[24px] border bg-[var(--public-surface)] shadow-[0_12px_30px_rgba(15,23,42,0.055)] ${residentNeedsAttention > 0
              ? 'border-warning/30'
              : 'border-success/30'
            }`}
          aria-labelledby="citizen-attention-title"
        >
          <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${residentNeedsAttention > 0
                  ? 'bg-warning/10 text-warning'
                  : 'bg-success/10 text-success'
                }`} aria-hidden="true">
                {residentNeedsAttention > 0 ? <Lucide.BellRing size={20} /> : <Lucide.ShieldCheck size={20} />}
              </span>
              <div>
                <h2 id="citizen-attention-title" className="text-lg font-semibold text-[var(--public-title)]">
                  {residentNeedsAttention > 0 ? 'Việc cần bạn chú ý' : 'Mọi việc đang được theo dõi'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--public-copy)]">
                  {residentNeedsAttention > 0
                    ? `${needsReworkTickets.length} phản ánh cần bổ sung và ${awaitingReviewTickets.length} phản ánh chờ đánh giá.`
                    : 'Hiện không có phản ánh nào cần bạn bổ sung hoặc đánh giá kết quả.'}
                </p>
              </div>
            </div>

            <Link
              to="/notifications"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 text-sm font-semibold text-[var(--public-title)] transition hover:border-primary/35 hover:text-primary"
            >
              <Lucide.Bell size={15} aria-hidden="true" />
              Xem thông báo
            </Link>
          </header>

          {attentionTickets.length > 0 ? (
            <ol className="grid gap-3 border-t border-warning/20 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              {attentionTickets.map((ticket) => {
                const feedbackId = ticket.feedbackId || ticket.id;
                const needsRework = ticket.status === managementTypes.feedbackStatus.NEED_REWORK;
                const targetPath = needsRework
                  ? `/tickets/${feedbackId}/rework`
                  : `/tickets/${feedbackId}/result`;

                return (
                  <li key={feedbackId}>
                    <Link
                      to={targetPath}
                      className="group flex h-full items-start gap-3 rounded-2xl border border-warning/25 bg-[var(--public-surface-soft)] p-4 transition hover:-translate-y-0.5 hover:border-warning/40 hover:bg-[var(--public-surface-strong)] hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/10 text-warning" aria-hidden="true">
                        {needsRework ? <Lucide.FileWarning size={17} /> : <Lucide.Star size={17} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warning">
                          {needsRework ? 'Cần bổ sung' : 'Chờ đánh giá'}
                        </span>
                        <strong className="mt-1 block line-clamp-2 text-sm font-semibold leading-5 text-[var(--public-title)] transition group-hover:text-warning">
                          {ticket.title || 'Phản ánh chưa có tiêu đề'}
                        </strong>
                      </span>
                      <Lucide.ArrowUpRight size={15} className="mt-1 shrink-0 text-warning/45 transition group-hover:text-warning" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </section>

        <section data-public-reveal className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(350px,0.65fr)]">
          <article
            className="citizen-dashboard-panel flex h-full min-h-[440px] flex-col overflow-hidden rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
            aria-labelledby="recent-feedback-title"
          >
            <header className="flex min-h-[126px] flex-col gap-4 border-b border-[var(--public-border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Hoạt động của bạn
                </p>
                <h2 id="recent-feedback-title" className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[var(--public-title)]">
                  Phản ánh gần đây
                </h2>
                <p className="mt-2 text-sm text-[var(--public-copy)]">
                  Năm hồ sơ có cập nhật mới nhất.
                </p>
              </div>

              <Link
                to="/tickets"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Xem tất cả
                <Lucide.ArrowRight size={15} aria-hidden="true" />
              </Link>
            </header>

            {recentResidentTickets.length === 0 ? (
              <section className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary" aria-hidden="true">
                  <Lucide.FilePlus2 size={27} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[var(--public-title)]">
                  Bạn chưa gửi phản ánh nào
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--public-copy)]">
                  Khi phát hiện vấn đề đô thị, hãy gửi thông tin và hình ảnh để hệ thống tiếp nhận và theo dõi tiến độ.
                </p>
                <Link
                  to="/tickets/create"
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  <Lucide.Plus size={16} aria-hidden="true" />
                  Gửi phản ánh đầu tiên
                </Link>
              </section>
            ) : (
              <ol className="flex-1 divide-y divide-[var(--public-border)]">
                {recentResidentTickets.map((ticket) => {
                  const feedbackId = ticket.feedbackId || ticket.id;
                  const statusMeta = getResidentStatusMeta(ticket.status);
                  const updatedAt = ticket.updatedAt || ticket.createdAt;
                  const isConfirmedDuplicate = isConfirmedDuplicateTicket(ticket);

                  return (
                    <li key={feedbackId}>
                      <Link
                        to={`/tickets/${feedbackId}`}
                        className="group grid gap-3 px-5 py-4 transition-colors hover:bg-[var(--public-surface-soft)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-7"
                      >
                        <article className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary" aria-hidden="true">
                            <Lucide.MapPin size={17} />
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--public-title)] transition-colors group-hover:text-primary">
                                {ticket.title || 'Phản ánh chưa có tiêu đề'}
                              </h3>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.className}`}>
                                {isConfirmedDuplicate ? (
                                  <span className="inline-flex items-center gap-1 text-violet-700">
                                    <Lucide.GitMerge size={11} aria-hidden="true" />
                                    Phản ánh trùng
                                  </span>
                                ) : statusMeta.label}
                              </span>
                            </div>

                            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-[var(--public-muted)]">
                              <Lucide.MapPin size={13} className="shrink-0 text-primary" aria-hidden="true" />
                              <span className="truncate">
                                {ticket.areaName || 'Chưa xác định khu vực'}
                              </span>
                            </p>
                          </div>
                        </article>

                        <div className="flex items-center justify-between gap-3 pl-[56px] sm:justify-end sm:pl-0">
                          <time className="whitespace-nowrap text-xs text-[var(--public-muted)]" dateTime={updatedAt || undefined}>
                            {formatResidentDate(updatedAt)}
                          </time>
                          <Lucide.ChevronRight size={16} className="text-[var(--public-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </article>

          <aside
            className="citizen-dashboard-panel flex h-full min-h-[440px] flex-col overflow-hidden rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
            aria-labelledby="tracked-area-title"
          >
            <div className="flex min-h-[126px] items-center border-b border-[var(--public-border)] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-info/10 text-info" aria-hidden="true">
                  <Lucide.MapPinHouse size={19} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-info">
                    Khu vực của bạn
                  </p>
                  <h2 id="tracked-area-title" className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[var(--public-title)]">
                    Khu vực đang theo dõi
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <TrackedAreaSelector
                areas={areas}
                value={selectedAreaId}
                onChange={setSelectedAreaId}
              />

              <p className="mt-4 text-xs leading-5 text-[var(--public-muted)]">
                {selectedArea
                  ? `Số liệu phản ánh của bạn và sự vụ cộng đồng tại ${selectedAreaName}.`
                  : 'Số liệu tổng hợp phản ánh của bạn và sự vụ cộng đồng trên toàn hệ thống.'}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  to={selectedAreaTicketUrl}
                  className="group rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] p-4 transition hover:border-primary/35 hover:bg-[var(--public-surface-strong)]"
                >
                  <span className="text-[11px] font-medium text-[var(--public-muted)]">
                    Phản ánh của bạn
                  </span>
                  <strong className="mt-1 block text-2xl font-bold text-[var(--public-title)]">
                    {selectedAreaTickets.length}
                  </strong>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                    Xem phản ánh của tôi
                    <Lucide.ChevronRight size={12} aria-hidden="true" />
                  </span>
                </Link>

                <Link
                  to="/community/feed"
                  state={{
                    resetFeedScroll: true,
                    initialQuery: selectedArea ? selectedAreaName : '',
                  }}
                  className="group rounded-2xl border border-info/25 bg-[var(--public-surface-soft)] p-4 transition hover:border-info/40 hover:bg-[var(--public-surface-strong)]"
                  aria-label={selectedArea
                    ? `Xem sự vụ công khai tại ${selectedAreaName}`
                    : 'Xem sự vụ công khai trên bảng tin'}
                >
                  <span className="text-[11px] font-medium text-[var(--public-muted)]">
                    Sự vụ trong khu vực
                  </span>
                  <strong className="mt-1 block text-2xl font-bold text-info">
                    {communityAreaCountLoading ? (
                      <span
                        className="inline-block h-7 w-8 animate-pulse rounded-lg bg-info/15"
                        aria-label="Đang tải số liệu"
                      />
                    ) : (
                      communityAreaCount
                    )}
                  </strong>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-info">
                    Xem bảng tin
                    <Lucide.ChevronRight size={12} aria-hidden="true" />
                  </span>
                </Link>
              </div>

            </div>
          </aside>
        </section>

          <CitizenCommunityPreview />
        </main>
      </PublicPageMotion>
    );
  }

  // ----------------------------------------------------
  // 2. SYSTEM STAFF DASHBOARD
  // ----------------------------------------------------
  if (currentRole === 'system-staff') {
    const staffNewCount = residentTickets.filter((ticket) => (
      ticket.status === managementTypes.feedbackStatus.SUBMITTED
    )).length;
    const staffAiReviewCount = residentTickets.filter((ticket) => (
      ticket.status === managementTypes.feedbackStatus.AI_REVIEWED
    )).length;
    const staffDuplicateCount = residentTickets.filter((ticket) => (
      isConfirmedDuplicateTicket(ticket)
    )).length;
    const staffAssignmentCount = residentTickets.filter((ticket) => (
      ticket.status === managementTypes.feedbackStatus.VERIFIED
    )).length;
    const staffApprovalCount = residentTickets.filter((ticket) => (
      ticket.status === managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL
    )).length;

    const staffMetricCards = [
      {
        label: 'Phản ánh mới',
        value: staffNewCount,
        description: 'Hồ sơ vừa tiếp nhận và cần được kiểm tra ban đầu.',
        icon: Lucide.FolderClock,
        toneClass: 'bg-blue-50 text-blue-700',
        to: '/manager/incidents',
        ariaLabel: 'Mở danh sách tất cả sự vụ',
      },
      {
        label: 'Cần kiểm tra AI',
        value: staffAiReviewCount,
        description: 'Kết quả phân loại AI cần nhân viên xác nhận.',
        icon: Lucide.Cpu,
        toneClass: 'bg-emerald-50 text-emerald-700',
        to: '/manager/approvals',
        ariaLabel: 'Mở hàng đợi duyệt kết quả xử lý',
      },
      {
        label: 'Nghi trùng lặp',
        value: staffDuplicateCount,
        description: 'Phản ánh đã có liên kết với hồ sơ gốc.',
        icon: Lucide.CopyCheck,
        toneClass: 'bg-rose-50 text-rose-700',
      },
      {
        label: 'Chờ phân công',
        value: staffAssignmentCount,
        description: 'Hồ sơ đã xác minh và đang chờ giao đơn vị xử lý.',
        icon: Lucide.UserRoundPlus,
        toneClass: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'Chờ duyệt kết quả',
        value: staffApprovalCount,
        description: 'Kết quả đã gửi lên để quản lý xem xét.',
        icon: Lucide.ClipboardCheck,
        toneClass: 'bg-violet-50 text-violet-700',
      },
    ];

    return (
      <article className="admin-page-shell space-y-6">
        <ManagerPageHeader
          title="Không gian làm việc"
          description={`Xin chào, ${user.fullName}. Kiểm tra phản ánh mới, xác nhận phân loại AI và điều phối xử lý trong cùng một không gian làm việc.`}
          icon={Lucide.LayoutDashboard}
          statusLabel="Hồ sơ đang hiển thị"
          statusValue={`${residentTotal} phản ánh`}
          actions={(
            <Link to="/staff/feedbacks" className="btn admin-primary-action rounded-2xl">
              <Lucide.ListChecks size={17} aria-hidden="true" />
              Mở danh sách phản ánh
            </Link>
          )}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Chỉ số công việc của nhân viên">
          {staffMetricCards.map((metric) => (
            <ManagerMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              description={metric.description}
              icon={metric.icon}
              toneClass={metric.toneClass}
            />
          ))}
        </section>

        <section className="admin-panel overflow-hidden" aria-labelledby="staff-work-queue-title">
          <ManagerSectionHeader
            id="staff-work-queue-title"
            title="Phản ánh cần xử lý"
            description="Ưu tiên các hồ sơ mới, cần kiểm tra AI, cần xác minh hoặc đang chờ điều phối."
            icon={Lucide.Inbox}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStaffFilter((value) => !value)}
                  className="admin-secondary-link inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"
                  aria-expanded={showStaffFilter}
                >
                  <Lucide.SlidersHorizontal size={15} aria-hidden="true" />
                  Bộ lọc
                </button>
                <Link
                  to="/staff/feedbacks"
                  className="admin-secondary-link inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold"
                >
                  Xem tất cả
                  <Lucide.ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          />

          {showStaffFilter ? (
            <section className="border-b border-slate-200 px-5 py-4 sm:px-6" aria-label="Bộ lọc phản ánh">
              <div className="admin-inset-panel flex flex-wrap items-center gap-2 p-3">
                <span className="mr-1 text-xs font-semibold text-slate-500">Hiển thị:</span>
                {[
                  ['latest', 'Mới nhất'],
                  ['needs-attention', 'Cần xử lý'],
                  ['high-priority', 'Ưu tiên cao'],
                  ['all', 'Tất cả'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStaffFilter(value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${staffFilter === value
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-5 py-4 sm:px-6">Mã phản ánh</th>
                  <th className="py-4">Nội dung</th>
                  <th className="py-4">Loại AI gợi ý</th>
                  <th className="py-4">Ưu tiên</th>
                  <th className="py-4">Trạng thái</th>
                  <th className="py-4">Thời gian gửi</th>
                  <th className="px-5 py-4 text-right sm:px-6">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaffTickets.slice(0, 6).map((ticket) => (
                  <tr key={ticket.feedbackId} className="transition hover:bg-blue-50/35">
                    <td className="px-5 py-4 font-semibold text-blue-700 sm:px-6">
                      {formatTicketId(ticket.feedbackId)}
                    </td>
                    <td className="max-w-[260px] py-4">
                      <p className="truncate font-semibold text-slate-950">{ticket.title || 'Phản ánh chưa có tiêu đề'}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{ticket.description || 'Chưa có mô tả bổ sung'}</p>
                    </td>
                    <td className="py-4">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-700">
                        {renderCategoryIcon(ticket.categoryId)}
                        {getCategoryName(ticket.categoryId)}
                      </span>
                    </td>
                    <td className="py-4">{renderPriorityBadge(ticket.priority)}</td>
                    <td className="py-4">{renderStatusBadge(ticket.status)}</td>
                    <td className="py-4 text-xs font-medium text-slate-500">
                      {new Date(ticket.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      <span className="mt-1 block text-slate-400">
                        {new Date(ticket.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right sm:px-6">
                      <Link
                        to={`/staff/feedbacks/${ticket.feedbackId}`}
                        className="admin-secondary-link inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                      >
                        Chi tiết
                        <Lucide.ChevronRight size={13} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredStaffTickets.length === 0 ? (
            <section className="admin-empty-panel m-5 p-8 text-center sm:m-6">
              <span className="admin-mini-icon mx-auto" aria-hidden="true">
                <Lucide.Inbox size={18} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">Không có phản ánh phù hợp</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Thử đổi bộ lọc để xem các hồ sơ khác.</p>
            </section>
          ) : null}
        </section>
      </article>
    );
  }

  // ----------------------------------------------------
  // 3. SERVICE PROVIDER DASHBOARD (service-provider)
  // ----------------------------------------------------
  if (currentRole === 'service-provider') {
    const activeStatuses = [managementTypes.feedbackStatus.ASSIGNED, managementTypes.feedbackStatus.IN_PROGRESS];
    const waitingStatuses = [managementTypes.feedbackStatus.ASSIGNED];
    const inProgressStatuses = [managementTypes.feedbackStatus.IN_PROGRESS];
    const reviewStatuses = [managementTypes.feedbackStatus.RESOLVED];

    const assigned = tickets.filter(t => activeStatuses.includes(t.status));
    const waitingTasks = tickets.filter(t => waitingStatuses.includes(t.status));
    const inProgressTasks = tickets.filter(t => inProgressStatuses.includes(t.status));
    const reviewTasks = tickets.filter(t => reviewStatuses.includes(t.status));
    const visibleTasks = [...assigned, ...reviewTasks].slice(0, 5);

    const getOperatorStatusLabel = status => {
      switch (status) {
        case managementTypes.feedbackStatus.ASSIGNED:
          return 'Chờ tiếp nhận';
        case managementTypes.feedbackStatus.IN_PROGRESS:
          return 'Đang xử lý';
        case managementTypes.feedbackStatus.RESOLVED:
          return 'Chờ nghiệm thu';
        case managementTypes.feedbackStatus.CLOSED:
          return 'Hoàn tất';
        default:
          return 'Chờ xử lý';
      }
    };

    const getCategoryName = categoryId => {
      const matchedCategory = categories.find(c => c.categoryId === categoryId);
      return getCategoryLabel(matchedCategory?.categoryName || matchedCategory?.name || matchedCategory?.categoryType || matchedCategory?.type, 'Chưa phân loại');
    };

    const operatorStats = [
      {
        label: 'Tổng nhiệm vụ',
        value: tickets.length,
        helper: 'Phiếu được gán cho đơn vị',
        icon: Lucide.ClipboardList,
        iconClassName: 'bg-primary/10 text-primary',
      },
      {
        label: 'Chờ tiếp nhận',
        value: waitingTasks.length,
        helper: 'Cần xác nhận xử lý',
        icon: Lucide.BellRing,
        iconClassName: 'bg-warning/10 text-warning',
      },
      {
        label: 'Đang xử lý',
        value: inProgressTasks.length,
        helper: 'Đã nhận và đang thực hiện',
        icon: Lucide.Wrench,
        iconClassName: 'bg-info/10 text-info',
      },
      {
        label: 'Chờ nghiệm thu',
        value: reviewTasks.length,
        helper: 'Đã báo hoàn thành',
        icon: Lucide.CheckCircle2,
        iconClassName: 'bg-success/10 text-success',
      },
    ];

    const workflowSteps = [
      {
        title: 'Tiếp nhận',
        description: 'Xác nhận nhiệm vụ được giao.',
        icon: Lucide.Handshake,
      },
      {
        title: 'Di chuyển',
        description: 'Cập nhật trạng thái tới hiện trường.',
        icon: Lucide.Route,
      },
      {
        title: 'Xử lý',
        description: 'Thực hiện sửa chữa và ghi nhận tiến độ.',
        icon: Lucide.Wrench,
      },
      {
        title: 'Báo hoàn thành',
        description: 'Gửi ghi chú và ảnh nghiệm thu.',
        icon: Lucide.Camera,
      },
    ];

    return (
      <div className="page-container space-y-6 text-base-content">
        <section className="overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 right-28 h-28 w-28 rounded-full bg-secondary/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
                  <Lucide.HardHat size={14} />
                  Trung tâm xử lý
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-base-content sm:text-3xl">
                    Bảng điều hành đơn vị xử lý
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-base-content/60">
                    Theo dõi nhiệm vụ được giao, cập nhật tiến độ hiện trường và gửi kết quả hoàn thành cho hệ thống UrbanMind.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-base-content/40">
                    Trạng thái
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-extrabold text-success">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    Sẵn sàng nhận việc
                  </div>
                </div>

                <Link
                  to="/provider/tasks"
                  className="btn btn-primary rounded-2xl px-5 text-xs font-black shadow-lg shadow-primary/20"
                >
                  <Lucide.ArrowRight size={17} />
                  Mở nhiệm vụ được giao
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {operatorStats.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-base-content/40">
                      {item.label}
                    </p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-base-content">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-base-content/50">
                      {item.helper}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-3 ${item.iconClassName}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <div className="rounded-[1.75rem] border border-base-300 bg-base-100 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-base-300 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-base-content">Nhiệm vụ ưu tiên</h3>
                <p className="mt-1 text-sm font-medium text-base-content/55">
                  Các phiếu đang cần đơn vị cập nhật tiến độ hoặc báo hoàn thành.
                </p>
              </div>
              <Link to="/provider/tasks" className="btn btn-outline btn-sm rounded-xl text-xs font-black">
                Xem tất cả
                <Lucide.ArrowRight size={14} />
              </Link>
            </div>

            {visibleTasks.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-success/10 text-success">
                  <Lucide.CheckCircle2 size={28} />
                </div>
                <h4 className="mt-5 text-lg font-black text-base-content">Chưa có nhiệm vụ cần xử lý</h4>
                <p className="mt-2 max-w-md text-sm font-medium leading-6 text-base-content/55">
                  Khi hệ thống phân công phản ánh cho đơn vị, danh sách nhiệm vụ sẽ xuất hiện tại đây. Bạn vẫn có thể mở màn nhiệm vụ để kiểm tra chi tiết.
                </p>
                <Link to="/provider/tasks" className="btn btn-primary mt-5 rounded-2xl px-5 text-xs font-black">
                  <Lucide.ClipboardList size={16} />
                  Mở nhiệm vụ được giao
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-base-300">
                {visibleTasks.map(task => (
                  <button
                    key={task.feedbackId}
                    type="button"
                    onClick={() => navigate('/provider/tasks')}
                    className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-base-200/70 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {renderCategoryIcon(task.categoryId)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-primary">{formatTicketId(task.feedbackId)}</span>
                          <span className="rounded-full border border-base-300 px-2.5 py-1 text-[11px] font-black text-base-content/60">
                            {getCategoryName(task.categoryId)}
                          </span>
                        </div>
                        <h4 className="mt-2 truncate text-sm font-black text-base-content">{task.title}</h4>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-base-content/45">
                          <Lucide.MapPin size={13} />
                          {task.locationText || 'Chưa có địa chỉ chi tiết'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
                        {getOperatorStatusLabel(task.status)}
                      </span>
                      <Lucide.ChevronRight size={18} className="text-base-content/35" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-base-300 bg-base-100 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-base-content">Quy trình xử lý</h3>
                  <p className="mt-1 text-sm font-medium text-base-content/55">Các bước cập nhật trạng thái tại hiện trường.</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Lucide.Workflow size={20} />
                </div>
              </div>

              <div className="space-y-3">
                {workflowSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="flex gap-3 rounded-2xl border border-base-300 bg-base-100 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-primary">
                        <Icon size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-base-content">
                          {index + 1}. {step.title}
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5 text-base-content/55">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-warning/20 bg-warning/10 p-5 text-warning-content shadow-sm">
              <div className="flex items-start gap-3">
                <Lucide.AlertTriangle size={20} className="mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-black">Lưu ý vận hành</h4>
                  <p className="mt-1 text-sm font-semibold leading-6 opacity-80">
                    Khi hoàn thành xử lý, hãy gửi mô tả kết quả và ảnh nghiệm thu để bộ phận kiểm duyệt xác nhận trước khi đóng phản ánh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ----------------------------------------------------
  // 4. INTERACTION MANAGER DASHBOARD (interaction-manager)
  // ----------------------------------------------------
  if (currentRole === 'interaction-manager') {
    const normalizeStatusKey = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const managerStatusDistribution = Array.isArray(stats?.statusDistribution) ? stats.statusDistribution : [];
    const managerPriorityDistribution = Array.isArray(stats?.priorityDistribution) ? stats.priorityDistribution : [];
    const statusCounts = new Map(
      managerStatusDistribution.map((item) => [normalizeStatusKey(item?.status), toDashboardCount(item?.count)])
    );
    const getStatusCount = (status) => statusCounts.get(normalizeStatusKey(status)) || 0;
    const managerOverview = stats?.managerOverview || {};
    const slaSummary = stats?.slaOverview || {};
    const urgentOpenItems = Array.isArray(stats?.urgentOpen) ? stats.urgentOpen.slice(0, 3) : [];
    /*
     * Ranh giới "hôm nay" do backend tính theo giờ Việt Nam, không suy ra từ
     * đồng hồ trình duyệt để tránh lệch ngày với người dùng ở múi giờ khác.
     */
    const todaySummary = stats?.todaySummary ?? null;
    const todayTopArea = Array.isArray(todaySummary?.byArea) ? todaySummary.byArea[0] : null;
    const monthlyTrend = Array.isArray(stats?.monthlyTrend) ? stats.monthlyTrend.slice(-6) : [];

    const totalIncidents = toDashboardCount(managerOverview?.totalIncident);
    const assignedCount = toDashboardCount(managerOverview?.assigned);
    const inProgressCount = toDashboardCount(managerOverview?.inProgress);
    const pendingApprovalCount = toDashboardCount(managerOverview?.pendingApproval || getStatusCount('SubmittedForApproval'));
    const completedIncidentCount = toDashboardCount(managerOverview?.completed);
    const newIncidentToday = toDashboardCount(managerOverview?.newIncidentToday);
    const needReworkCount = getStatusCount('NeedRework');
    const urgentOpenCount = toDashboardCount(managerOverview?.urgentOpen || urgentOpenItems.length);
    const breachedSla = toDashboardCount(slaSummary?.breachedSla ?? stats?.slaBreaches);
    const warningSla = toDashboardCount(slaSummary?.warningSla);
    const runningSla = toDashboardCount(slaSummary?.runningSla);
    const completedSla = toDashboardCount(slaSummary?.completedSla);
    const managerDataIssues = Array.isArray(stats?.managerDataIssues) ? stats.managerDataIssues : [];
    const managerOverviewAvailable = stats?.managerOverviewAvailable ?? Boolean(stats?.managerOverview);
    const activeWorkCount = assignedCount + inProgressCount;

    const statusMax = Math.max(1, ...managerStatusDistribution.map((item) => toDashboardCount(item?.count)));
    const priorityMeta = {
      urgent: { key: 'urgent', label: 'Khẩn cấp', barClass: 'bg-rose-500', dotClass: 'bg-rose-500', order: 0 },
      high: { key: 'high', label: 'Cao', barClass: 'bg-orange-500', dotClass: 'bg-orange-500', order: 1 },
      medium: { key: 'medium', label: 'Trung bình', barClass: 'bg-amber-400', dotClass: 'bg-amber-400', order: 2 },
      low: { key: 'low', label: 'Thấp', barClass: 'bg-sky-500', dotClass: 'bg-sky-500', order: 3 },
    };
    const priorityBuckets = new Map();
    managerPriorityDistribution.forEach((item) => {
      const rawKey = String(item?.priority || item?.name || item?.label || '').trim().toLowerCase();
      const normalizedKey = rawKey === 'critical' ? 'urgent' : rawKey;
      const meta = priorityMeta[normalizedKey] || {
        key: normalizedKey || 'unknown',
        label: item?.priority || item?.name || item?.label || 'Chưa xác định',
        barClass: 'bg-slate-400',
        dotClass: 'bg-slate-400',
        order: 99,
      };
      const existing = priorityBuckets.get(meta.key);
      priorityBuckets.set(meta.key, {
        ...meta,
        value: toDashboardCount(existing?.value) + toDashboardCount(item?.count),
      });
    });
    const priorityDistributionRows = [...priorityBuckets.values()]
      .filter((item) => item.value > 0)
      .sort((left, right) => left.order - right.order);
    const priorityTotal = priorityDistributionRows.reduce((sum, item) => sum + item.value, 0);
    const trendChart = buildManagerTrendChartModel(monthlyTrend);
    const totalCreatedTrend = monthlyTrend.reduce((sum, item) => sum + toDashboardCount(item?.createdCount), 0);
    const totalCompletedTrend = monthlyTrend.reduce((sum, item) => sum + toDashboardCount(item?.completedCount), 0);
    const peakTrendMonth = monthlyTrend.reduce((peak, item) => {
      const created = toDashboardCount(item?.createdCount);
      if (!peak || created > peak.created) {
        return {
          label: item?.monthLabel || item?.label || `${String(item?.month || '').padStart(2, '0')}/${item?.year || ''}`,
          created,
        };
      }
      return peak;
    }, null);

    const kpis = [
      {
        label: 'Tổng sự vụ',
        value: managerMetricValue(managerOverviewAvailable, totalIncidents),
        description: managerOverviewAvailable
          ? (newIncidentToday > 0 ? `${newIncidentToday} mới hôm nay` : 'Không có sự vụ mới hôm nay')
          : 'Chưa tải được KPI sự vụ',
        icon: Lucide.Siren,
        toneClass: 'bg-blue-50 text-blue-700',
        to: '/manager/incidents',
        ariaLabel: 'Mở danh sách tất cả sự vụ',
      },
      {
        label: 'Đang xử lý',
        value: managerMetricValue(managerOverviewAvailable, activeWorkCount),
        description: managerOverviewAvailable ? `${assignedCount} đã phân công · ${inProgressCount} đang xử lý` : 'Chưa tải được KPI sự vụ',
        icon: Lucide.Workflow,
        toneClass: 'bg-slate-100 text-slate-700',
        to: '/manager/incidents?statusGroup=active',
        ariaLabel: 'Mở danh sách sự vụ đang xử lý',
      },
      {
        label: 'Chờ duyệt kết quả',
        value: managerMetricValue(managerOverviewAvailable, pendingApprovalCount),
        description: managerOverviewAvailable ? 'Kết quả đang chờ người quản lý quyết định' : 'Chưa tải được KPI sự vụ',
        icon: Lucide.ClipboardCheck,
        toneClass: 'bg-emerald-50 text-emerald-700',
        to: '/manager/approvals',
        ariaLabel: 'Mở hàng đợi duyệt kết quả xử lý',
      },
      {
        label: 'Đã hoàn thành',
        value: managerMetricValue(managerOverviewAvailable, completedIncidentCount),
        description: managerOverviewAvailable ? 'Các sự vụ đã kết thúc quy trình xử lý hoặc nghiệm thu' : 'Chưa tải được KPI sự vụ',
        icon: Lucide.CircleCheck,
        toneClass: 'bg-cyan-50 text-cyan-700',
        to: '/manager/incidents?statusGroup=completed',
        ariaLabel: 'Mở danh sách sự vụ đã hoàn thành',
      },
    ];

    const priorityRows = [
      {
        label: 'Duyệt kết quả xử lý',
        description: 'Kết quả nhân viên đã gửi và đang chờ quyết định.',
        value: pendingApprovalCount,
        to: '/manager/approvals',
        icon: Lucide.ClipboardCheck,
        tone: 'bg-emerald-50 text-emerald-700',
      },
      {
        label: 'Sự vụ cần làm lại',
        description: 'Sự vụ đã được trả về để bổ sung hoặc xử lý lại.',
        value: needReworkCount,
        to: '/manager/incidents?status=NeedRework',
        icon: Lucide.RotateCcw,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'SLA cảnh báo',
        description: 'SLA đang tiến gần ngưỡng cần can thiệp.',
        value: warningSla,
        to: '/analytics/sla',
        icon: Lucide.ClockAlert,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'SLA vi phạm',
        description: 'SLA đã vượt ngưỡng cam kết và cần rà soát.',
        value: breachedSla,
        to: '/analytics/sla',
        icon: Lucide.TimerOff,
        tone: 'bg-rose-50 text-rose-700',
      },
    ];

    const visibleStatuses = managerStatusDistribution
      .filter((item) => toDashboardCount(item?.count) > 0)
      .slice(0, 6);

    return (
      <div className="admin-page-shell manager-ui-page space-y-4 pb-6">
        <ManagerPageHeader
          title="Tổng quan hệ thống"
          description="Theo dõi khối lượng sự vụ, hàng đợi cần xử lý và các tín hiệu vận hành trong phạm vi phụ trách."
          icon={Lucide.LayoutDashboard}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              {pendingApprovalCount > 0 ? (
                <Link
                  to="/manager/approvals"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  <Lucide.ClipboardCheck size={16} aria-hidden="true" />
                  {pendingApprovalCount} chờ duyệt
                </Link>
              ) : null}
              <Link
                to="/manager/incidents"
                className="admin-primary-action btn rounded-xl px-4 text-sm font-semibold normal-case"
              >
                <Lucide.Siren size={16} aria-hidden="true" />
                Quản lý sự vụ
              </Link>
            </div>
          )}
        />

        {managerDataIssues.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            <Lucide.TriangleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <strong className="font-semibold">Một phần dữ liệu chưa tải được.</strong>
              <span className="ml-1 text-amber-800/80">Thiếu: {managerDataIssues.join(', ')}.</span>
            </div>
          </div>
        )}

        {todaySummary ? (
          <section
            className="relative overflow-hidden rounded-2xl border border-blue-100/80 bg-[linear-gradient(100deg,rgba(239,246,255,0.96),rgba(255,255,255,0.96)_42%,rgba(240,253,250,0.9))] px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 sm:px-5"
            aria-label="Số liệu tiếp nhận trong ngày"
          >
            <div className="pointer-events-none absolute -left-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-blue-200/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/15">
                  <Lucide.CalendarDays size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-slate-950 dark:text-slate-100">Hôm nay</span>
                    <span className="text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400">{formatManagerSummaryDate(todaySummary.date)}</span>
                  </div>
                  {todayTopArea ? (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400" title={todayTopArea.areaName}>
                      Khu vực nổi bật: {todayTopArea.areaName} · {toDashboardCount(todayTopArea.count)}
                    </p>
                  ) : <p className="mt-0.5 text-[11px] text-slate-400">Tình hình tiếp nhận trong ngày hiện tại</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end xl:gap-x-7">
                {[
                  { label: 'Phản ánh nhận', value: todaySummary.reportCount, icon: Lucide.MessageSquareText, iconClass: 'text-violet-500', valueClass: 'text-slate-950 dark:text-white' },
                  { label: 'Sự vụ mới', value: todaySummary.incidentCount, icon: Lucide.CirclePlus, iconClass: 'text-blue-500', valueClass: 'text-slate-950 dark:text-white' },
                  { label: 'Xử lý xong', value: todaySummary.resolvedCount, icon: Lucide.CircleCheck, iconClass: 'text-emerald-500', valueClass: 'text-emerald-700 dark:text-emerald-300' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex min-w-[145px] items-center gap-2.5">
                      <Icon size={18} className={`shrink-0 ${item.iconClass}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
                        <strong className={`mt-0.5 block text-lg font-semibold tabular-nums leading-none ${item.valueClass}`}>{toDashboardCount(item.value)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section className="manager-kpi-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số tổng quan">
          {kpis.map((item) => <ManagerMetricCard key={item.label} {...item} />)}
        </section>

        <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.8fr)]">
          <article className="admin-panel h-full overflow-hidden">
            <ManagerSectionHeader
              title="Công việc cần xử lý"
              description="Các hàng đợi Manager nên kiểm tra trước trong phiên làm việc hiện tại."
              icon={Lucide.ListChecks}
              actions={<Link to="/manager/incidents" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Xem tất cả</Link>}
            />
            <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {priorityRows.map(({ label, description, value, to, icon: Icon, tone }) => (
                <Link key={label} to={to} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:px-6 dark:hover:bg-slate-900/50">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true"><Icon size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[15px] font-semibold text-slate-900 dark:text-slate-100">{label}</strong>
                    <span className="mt-1 block text-[13px] leading-5 text-slate-500">{description}</span>
                  </span>
                  <strong className="shrink-0 text-[1.55rem] font-bold tabular-nums tracking-tight text-slate-950 dark:text-white">{value}</strong>
                  <Lucide.ChevronRight size={17} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </article>

          <article className="admin-panel flex h-full flex-col overflow-hidden">
            <ManagerSectionHeader
              title="Sự vụ khẩn cấp"
              description="3 sự vụ ưu tiên Khẩn cấp cần được kiểm tra trước."
              icon={Lucide.TriangleAlert}
              actions={<Link to="/manager/incidents?priority=Urgent" className="text-sm font-semibold text-blue-700 hover:text-blue-800">{urgentOpenCount} đang mở</Link>}
            />
            {urgentOpenItems.length > 0 ? (
              <>
                <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                  {urgentOpenItems.map((incident, index) => {
                    const incidentId = incident?.incidentId || incident?.id;
                    return (
                      <Link key={incidentId || index} to={incidentId ? `/manager/incidents/${incidentId}` : '/manager/incidents?priority=Urgent'} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600" aria-hidden="true"><Lucide.Flame size={17} /></span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">{incident?.title || incident?.summary || 'Sự vụ khẩn cấp'}</strong>
                          <span className="mt-1 block truncate text-[13px] text-slate-500">{incident?.areaName || 'Chưa xác định khu vực'} · {getCategoryLabel(incident?.categoryName, 'Chưa phân loại')}</span>
                        </span>
                        <Lucide.ChevronRight size={17} className="shrink-0 text-slate-300 group-hover:text-blue-500" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
                <Link
                  to="/manager/incidents?priority=Urgent"
                  className="mt-auto flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-50/50 hover:text-blue-800 dark:border-slate-800 dark:hover:bg-slate-900/50"
                >
                  <span>Xem toàn bộ sự vụ khẩn cấp</span>
                  <span className="inline-flex items-center gap-1">{urgentOpenCount} sự vụ <Lucide.ArrowRight size={15} aria-hidden="true" /></span>
                </Link>
              </>
            ) : <p className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-500">Không có sự vụ khẩn cấp đang mở.</p>}
          </article>
        </section>

        <section
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/85"
          aria-label="Tóm tắt SLA vận hành"
        >
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            <div className="flex min-w-[250px] items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <Lucide.Gauge size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">SLA vận hành</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Theo dõi mức độ cần can thiệp ở cấp sự vụ.</span>
              </div>
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-2 border-t border-slate-100 sm:grid-cols-4 lg:border-l lg:border-t-0 dark:border-slate-800">
              {[
                { label: 'Đang chạy', value: runningSla, dot: 'bg-slate-400', valueClass: 'text-slate-900 dark:text-slate-100' },
                { label: 'Cảnh báo', value: warningSla, dot: 'bg-amber-400', valueClass: 'text-amber-700 dark:text-amber-300' },
                { label: 'Vi phạm', value: breachedSla, dot: 'bg-rose-500', valueClass: 'text-rose-700 dark:text-rose-300' },
                { label: 'Hoàn thành', value: completedSla, dot: 'bg-emerald-500', valueClass: 'text-emerald-700 dark:text-emerald-300' },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 ${index % 2 === 0 ? 'border-r border-slate-100 dark:border-slate-800' : ''} ${index < 2 ? 'border-b border-slate-100 sm:border-b-0 dark:border-slate-800' : ''} ${index === 1 ? 'sm:border-r sm:border-slate-100 sm:dark:border-slate-800' : ''} ${index === 2 ? 'sm:border-r sm:border-slate-100 sm:dark:border-slate-800' : ''}`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <strong className={`shrink-0 text-lg font-semibold tabular-nums ${item.valueClass}`}>{item.value}</strong>
                </div>
              ))}
            </div>

            <Link
              to="/analytics/sla"
              className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-4 py-3.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50/60 hover:text-blue-800 sm:px-5 lg:border-l lg:border-t-0 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
            >
              <span>Phân tích SLA</span>
              <Lucide.ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
          <article className="admin-panel overflow-hidden">
            <ManagerSectionHeader
              title="Tiến độ xử lý sự vụ"
              description="Phân bố sự vụ theo các trạng thái đang phát sinh trong quy trình."
              icon={Lucide.GitBranch}
              actions={<Link to="/manager/incidents" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Mở danh sách</Link>}
            />
            <div className="border-t border-slate-100 px-5 py-4 sm:px-6 dark:border-slate-800">
              {visibleStatuses.length > 0 ? (
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {visibleStatuses.map((item, index) => {
                    const count = toDashboardCount(item?.count);
                    const width = Math.max(4, (count / statusMax) * 100);
                    return (
                      <div key={`${item?.status || 'status'}-${index}`} className="rounded-2xl bg-slate-50/65 px-4 py-3 dark:bg-slate-900/35">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[14px] font-medium text-slate-700 dark:text-slate-200">{getStatusLabel(item?.status) || item?.status || 'Chưa xác định'}</span>
                          <strong className="text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">{count}</strong>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/75 dark:bg-slate-800">
                          <span className="block h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="py-6 text-center text-sm text-slate-500">Chưa có dữ liệu trạng thái sự vụ.</p>}
            </div>
          </article>

          <article className="admin-panel overflow-hidden">
            <ManagerSectionHeader
              title="Cơ cấu ưu tiên"
              description="Tỷ trọng sự vụ theo mức ưu tiên hiện tại."
              icon={Lucide.SignalHigh}
              actions={<Link to="/manager/incidents" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Xem sự vụ</Link>}
            />
            <div className="border-t border-slate-100 p-5 dark:border-slate-800">
              {priorityDistributionRows.length > 0 ? (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-label={`Tổng ${priorityTotal} sự vụ theo mức ưu tiên`}>
                    {priorityDistributionRows.map((row) => (
                      <span
                        key={row.key}
                        className={row.barClass}
                        style={{ width: `${priorityTotal > 0 ? (row.value / priorityTotal) * 100 : 0}%` }}
                        title={`${row.label}: ${row.value}`}
                      />
                    ))}
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {priorityDistributionRows.map((row) => {
                      const percent = priorityTotal > 0 ? Math.round((row.value / priorityTotal) * 100) : 0;
                      return (
                        <div key={row.key} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dotClass}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{row.label}</span>
                          <span className="text-xs font-medium text-slate-400">{percent}%</span>
                          <strong className="w-8 text-right text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{row.value}</strong>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : <p className="py-6 text-center text-sm text-slate-500">Chưa có dữ liệu mức ưu tiên.</p>}
            </div>
          </article>
        </section>

        <section className="admin-panel overflow-hidden">
          <ManagerSectionHeader
            title="Xu hướng tiếp nhận"
            description="Số sự vụ tạo mới và hoàn thành trong 6 tháng gần nhất."
            icon={Lucide.ChartNoAxesCombined}
          />
          <div className="border-t border-slate-100 px-5 py-5 sm:px-6 dark:border-slate-800">
            {monthlyTrend.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-2.5 rounded-sm bg-blue-500" aria-hidden="true" />Sự vụ mới</span>
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" />Đã hoàn thành</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{totalCreatedTrend} tạo mới</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{totalCompletedTrend} hoàn thành</span>
                    {peakTrendMonth ? <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">Đỉnh {peakTrendMonth.label}</span> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-3 pb-2 pt-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/30 sm:px-4">
                  <svg viewBox={`0 0 ${trendChart.width} ${trendChart.height}`} className="h-[260px] w-full" role="img" aria-label="Biểu đồ cột so sánh sự vụ mới và hoàn thành trong 6 tháng gần nhất">
                    {trendChart.ticks.map((tick) => (
                      <g key={`tick-${tick.y}`}>
                        <line
                          x1={trendChart.padding.left}
                          x2={trendChart.width - trendChart.padding.right}
                          y1={tick.y}
                          y2={tick.y}
                          stroke={tick.value === 0 ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.2)'}
                          strokeDasharray={tick.value === 0 ? '0' : '4 7'}
                        />
                        <text x={trendChart.padding.left - 9} y={tick.y + 4} textAnchor="end" fontSize="11" fill="rgba(100,116,139,0.82)">{tick.value}</text>
                      </g>
                    ))}

                    {trendChart.groups.map((group, index) => {
                      const monthLabel = group?.monthLabel || group?.label || `${String(group?.month || index + 1).padStart(2, '0')}/${group?.year || ''}`;
                      return (
                        <g key={`trend-group-${monthLabel}-${index}`}>
                          {group.created > 0 ? (
                            <>
                              <rect x={group.createdX} y={group.createdY} width={trendChart.barWidth} height={group.createdHeight} rx="7" fill="#3b82f6" />
                              <text x={group.createdX + trendChart.barWidth / 2} y={group.createdY - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="#2563eb">{group.created}</text>
                            </>
                          ) : (
                            <circle cx={group.createdX + trendChart.barWidth / 2} cy={trendChart.baselineY} r="2.5" fill="rgba(59,130,246,0.35)" />
                          )}
                          {group.completed > 0 ? (
                            <>
                              <rect x={group.completedX} y={group.completedY} width={trendChart.barWidth} height={group.completedHeight} rx="7" fill="#10b981" />
                              <text x={group.completedX + trendChart.barWidth / 2} y={group.completedY - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="#059669">{group.completed}</text>
                            </>
                          ) : (
                            <circle cx={group.completedX + trendChart.barWidth / 2} cy={trendChart.baselineY} r="2.5" fill="rgba(16,185,129,0.35)" />
                          )}
                          <text x={group.centerX} y={trendChart.baselineY + 24} textAnchor="middle" fontSize="11" fill="rgba(100,116,139,0.84)">{monthLabel}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {monthlyTrend.map((item, index) => {
                    const monthLabel = item?.monthLabel || item?.label || `${String(item?.month || index + 1).padStart(2, '0')}/${item?.year || ''}`;
                    const created = toDashboardCount(item?.createdCount);
                    const completed = toDashboardCount(item?.completedCount);
                    const monthSearch = getManagerTrendSearchValue(item, monthLabel);
                    return (
                      <button
                        key={`${monthLabel}-${index}`}
                        type="button"
                        onClick={() => navigate(`/manager/incidents?search=${encodeURIComponent(monthSearch)}`)}
                        className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10"
                        aria-label={`Xem sự vụ tháng ${monthLabel}`}
                      >
                        <span>
                          <strong className="block text-xs font-semibold text-slate-800 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">{monthLabel}</strong>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{created} mới · {completed} hoàn thành</span>
                        </span>
                        <Lucide.ArrowUpRight size={13} className="shrink-0 text-slate-300 transition group-hover:text-blue-500" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-500">Chưa có dữ liệu xu hướng.</p>}
          </div>
        </section>

        <IncidentDistributionPanel />
      </div>
    );
  }

  // ----------------------------------------------------
  // 5. ADMINISTRATOR DASHBOARD (administrator)
  // ----------------------------------------------------
  if (currentRole === 'administrator') {
    const adminTickets = Array.isArray(tickets) ? tickets : [];
    const mapTickets = Array.isArray(adminMapTickets) ? adminMapTickets : [];
    const recentTickets = adminTickets.slice(0, 5);
    const adminMetrics = ADMIN_FEEDBACK_METRICS.map((metric) => ({
      ...metric,
      value: feedbackSummary?.[metric.key] ?? 0,
      icon: Lucide[metric.icon] || Lucide.Circle,
      tone: {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        slate: 'bg-slate-100 text-slate-700 border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      }[metric.tone],
      to: `/management/feedbacks?metric=${metric.key}`,
    }));


    const categoryDistribution = Array.isArray(stats.categoryDistribution)
      ? stats.categoryDistribution.map((item, index) => ({
        id: Number(item.categoryId ?? item.id ?? index + 1),
        name: getCategoryLabel(item.categoryName || item.name || item.label, `Danh mục ${index + 1}`),
        count: Number(item.count ?? item.value ?? item.total ?? 0),
      }))
      : [];
    const totalCategoryTickets = categoryDistribution.reduce((sum, item) => sum + item.count, 0);
    const hasLowCategoryData = totalCategoryTickets > 0 && totalCategoryTickets <= 5;

    return (
      <div className="admin-page-shell space-y-6">
        <section className="admin-page-hero">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="admin-hero-icon">
                <Lucide.LayoutDashboard size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="admin-hero-title">
                  Tổng quan hệ thống
                </h2>
                <p className="admin-hero-description">
                  Theo dõi tài khoản, phản ánh, vị trí sự cố, danh mục và chính sách SLA trên một màn hình thống nhất.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Link to="/management/feedbacks" className="admin-primary-action btn rounded-xl px-5 text-sm font-semibold normal-case">
                <Lucide.MessageSquare size={17} />
                Quản lý phản ánh
              </Link>
              <Link to="/management/users" className="admin-secondary-action btn rounded-xl px-5 text-sm font-semibold normal-case">
                <Lucide.UserCog size={17} />
                Quản lý tài khoản
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {adminMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Link
                key={metric.label}
                to={metric.to}
                className="admin-stat-card group flex min-h-[132px] items-center justify-between gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                  <p className="mt-1 min-h-10 line-clamp-2 text-xs leading-5 text-slate-400">{metric.helper}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
                  <Lucide.ArrowUpRight
                    size={15}
                    className="text-slate-300 transition group-hover:text-blue-600"
                  />
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${metric.tone}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="admin-panel overflow-hidden p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="admin-section-title">Bản đồ phản ánh</h3>
              <p className="admin-section-description">Quan sát nhanh các phản ánh có tọa độ và mở bản đồ điều hành đầy đủ.</p>
            </div>
            <Link to="/management/map#admin-incident-map" state={{ focusMap: true }} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
              Mở bản đồ lớn
              <Lucide.Maximize2 size={14} />
            </Link>
          </div>
          <div className="h-[360px]">
            <CompactPublicIncidentMap
              items={mapTickets}
              loading={loading}
              fullMapPath="/management/map#admin-incident-map"
              detailPathBuilder={(feedbackId) => `/management/feedbacks/${feedbackId}`}
              detailStateBuilder={() => ({ from: '/dashboard' })}
              mapLabel="Bản đồ phản ánh"
            />
          </div>
        </section>

        <section className="admin-panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="admin-section-title">Thống kê phản ánh theo danh mục</h3>
              <p className="admin-section-description">So sánh số lượng và tỷ trọng phản ánh giữa các danh mục đang cấu hình.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tổng phản ánh</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-950">
                  {categoryDistribution.length > 0 ? totalCategoryTickets : '—'}
                </p>
              </div>
              <Link
                to="/management/categories"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                Quản lý danh mục
                <Lucide.ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {categoryDistribution.length === 0 ? (
            <div className="admin-empty-panel m-5 flex min-h-[180px] flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Lucide.BarChart3 size={20} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có dữ liệu theo danh mục</p>
              <p className="mt-1 text-xs text-slate-400">Dữ liệu sẽ hiển thị khi API thống kê trả kết quả.</p>
            </div>
          ) : (
            <div className="space-y-2 p-5">
              {categoryDistribution.map((category) => {
                const percent = totalCategoryTickets > 0
                  ? (category.count / totalCategoryTickets) * 100
                  : 0;
                const maxCount = Math.max(...categoryDistribution.map((item) => Number(item.count) || 0), 1);
                const barWidth = (category.count / maxCount) * 100;

                return (
                  <div
                    key={`${category.id}-${category.name}`}
                    className="group grid gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[46px_minmax(210px,0.95fr)_minmax(260px,1.5fr)_130px] md:items-center"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      {renderCategoryIcon(category.id)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{category.name}</p>
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-300 group-hover:bg-blue-700"
                          style={{ width: `${Math.min(100, Math.max(4, barWidth))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <span className="text-sm font-semibold tabular-nums text-slate-950">
                        {category.count}
                        <span className="ml-1 text-[10px] font-medium text-slate-400">phản ánh</span>
                      </span>
                      <span className="w-12 text-right text-xs font-semibold tabular-nums text-slate-500">
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasLowCategoryData ? (
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
              Dữ liệu hiện còn ít; tỷ trọng có thể thay đổi đáng kể khi có thêm phản ánh.
            </p>
          ) : null}
        </section>

        <section className="admin-panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="admin-section-title">Tổng quan SLA</h3>
              <p className="admin-section-description">Theo dõi nhanh tình trạng tuân thủ thời hạn xử lý phản ánh.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tổng SLA</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-950">
                  {slaOverview?.totalSla ?? '—'}
                </p>
              </div>
              <Link
                to="/management/sla"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                Quản lý SLA
                <Lucide.ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <Link
            to="/management/sla"
            className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4"
          >
            {[
              {
                label: 'Đang chạy',
                value: slaOverview?.runningSla ?? '—',
                helper: 'SLA đang được theo dõi',
                icon: Lucide.Activity,
                tone: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'Cảnh báo',
                value: slaOverview?.warningSla ?? '—',
                helper: 'Đang gần tới hạn',
                icon: Lucide.ClockAlert,
                tone: 'bg-amber-50 text-amber-700',
              },
              {
                label: 'Vi phạm',
                value: slaOverview?.breachedSla ?? '—',
                helper: 'Đã vượt thời hạn',
                icon: Lucide.TriangleAlert,
                tone: 'bg-rose-50 text-rose-700',
              },
              {
                label: 'Tỷ lệ thành công',
                value: slaOverview?.successRate != null ? `${slaOverview.successRate}%` : '—',
                helper: 'Hoàn thành đúng SLA',
                icon: Lucide.BadgeCheck,
                tone: 'bg-emerald-50 text-emerald-700',
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="group flex min-h-[118px] items-center justify-between gap-4 bg-white px-5 py-4 transition-colors hover:bg-blue-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{item.helper}</p>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                    <Icon size={18} />
                  </div>
                </div>
              );
            })}
          </Link>
        </section>

        <section>
          <div className="admin-panel p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="admin-section-title">Phản ánh mới nhất</h3>
                <p className="admin-section-description">Dữ liệu tổng hợp để Admin giám sát luồng vận hành.</p>
              </div>
              <Link to="/management/feedbacks" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                Quản lý phản ánh
                <Lucide.ArrowRight size={14} />
              </Link>
            </div>

            <div className="admin-table-wrap overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full text-xs">
                  <thead>
                    <tr className="admin-table-head border-b text-[10px] font-semibold uppercase tracking-wider">
                      <th className="py-3">Mã</th>
                      <th className="py-3">Nội dung</th>
                      <th className="py-3">Danh mục</th>
                      <th className="py-3">Ưu tiên</th>
                      <th className="py-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="admin-table-body divide-y">
                    {recentTickets.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-xs font-medium text-slate-400">
                          Chưa có dữ liệu phản ánh để hiển thị.
                        </td>
                      </tr>
                    ) : (
                      recentTickets.map((ticket) => (
                        <tr
                          key={ticket.feedbackId}
                          className="admin-table-row cursor-pointer transition-colors hover:bg-blue-50/60 focus-within:bg-blue-50/60"
                          onClick={() => navigate(`/management/feedbacks/${ticket.feedbackId}`, { state: { from: '/dashboard', feedback: ticket } })}
                        >
                          <td className="py-3.5 font-semibold text-blue-700">
                            <button
                              type="button"
                              className="text-left font-semibold text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/management/feedbacks/${ticket.feedbackId}`, { state: { from: '/dashboard', feedback: ticket } });
                              }}
                            >
                              {formatTicketId(ticket.feedbackId)}
                            </button>
                          </td>
                          <td className="max-w-[240px] py-3.5 font-medium text-slate-700">
                            <div className="truncate">{ticket.title}</div>
                          </td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-700">
                              {renderCategoryIcon(ticket.categoryId)}
                              <span className="truncate">
                                {getCategoryName(ticket.categoryId)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5">{renderPriorityBadge(ticket.priority)}</td>
                          <td className="py-3.5">{renderStatusBadge(ticket.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </section>
      </div>
    );
  }

  return null;
};




export const Dashboard = () => {
  const { user } = useAuth();
  const currentRole = normalizeRole(user?.role);
  return currentRole === APP_ROLES.ADMINISTRATOR ? <AdminDashboardPage /> : <RoleDashboard />;
};
