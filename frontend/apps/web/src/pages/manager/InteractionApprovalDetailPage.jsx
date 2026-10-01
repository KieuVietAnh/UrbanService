import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import * as signalR from '@microsoft/signalr';
import { createOptionalSignalRConnection } from '../../utils/optionalSignalR';
import * as Lucide from 'lucide-react';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { incidentManagementApi, slaApi } from '@urbanmind/shared-api';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { ManagerEmptyState, ManagerPageHeader, ManagerSectionHeader, ManagerToast } from '../../components/manager/ManagerPageElements';
import { getStatusLabel, managementTypes, PRIORITY_BADGE_CLASSES, STATUS_BADGE_CLASSES } from '@urbanmind/shared-types';
import { useResolvedLocationText } from '../../hooks/useResolvedLocationText';
import { FeedbackLocationMapCard } from '../../components/maps/FeedbackLocationMapCard';


const INTERACTION_SECONDARY_CACHE_KEY = 'urbanservice-interaction-secondary-v1';
const INTERACTION_SECONDARY_CACHE_TTL = 5 * 60 * 1000;

const readInteractionSecondaryCache = (feedbackId) => {
  try {
    const raw = sessionStorage.getItem(INTERACTION_SECONDARY_CACHE_KEY);
    if (!raw) return null;

    const store = JSON.parse(raw);
    const entry = store?.[feedbackId];
    if (!entry?.savedAt) return null;

    return {
      ...entry,
      fresh: Date.now() - Number(entry.savedAt) <= INTERACTION_SECONDARY_CACHE_TTL,
    };
  } catch {
    return null;
  }
};

const writeInteractionSecondaryCache = (feedbackId, data) => {
  try {
    const raw = sessionStorage.getItem(INTERACTION_SECONDARY_CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[feedbackId] = {
      ...data,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(INTERACTION_SECONDARY_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures.
  }
};

const priorityLabels = {
  Low: 'Thấp',
  Medium: 'Trung bình',
  High: 'Cao',
  Urgent: 'Khẩn cấp',
  Critical: 'Khẩn cấp',
};

const normalizeKey = (value) =>
  String(value ?? '').replace(/[-_\s]/g, '').toLowerCase();

const INCIDENT_PRIORITY_META = {
  critical: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  urgent: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  high: { label: 'Cao', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  medium: { label: 'Trung bình', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  low: { label: 'Thấp', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

const INCIDENT_STATUS_META = {
  new: { label: 'Mới', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  open: { label: 'Đang mở', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  pending: { label: 'Chờ xử lý', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  assigned: { label: 'Đã phân công', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  inprogress: { label: 'Đang xử lý', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  resolved: { label: 'Đã xử lý', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  closed: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  merged: { label: 'Đã gộp', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  verified: { label: 'Đã xác minh', className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  aireviewed: { label: 'AI đã phân loại', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  submitted: { label: 'Đã gửi', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  cancelled: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const formatIncidentCode = (incidentId) => {
  if (!incidentId) return '—';
  const value = String(incidentId);
  const suffix = value.split('-').pop() || value;
  return `INC-${suffix.slice(0, 8).toUpperCase()}`;
};

const formatFeedbackCode = (feedbackId) => {
  const compact = String(feedbackId || '').replace(/-/g, '').toUpperCase();
  return compact ? `UM-${compact.slice(0, 8)}` : 'UM-UNKNOWN';
};

const readInteractionDetailCache = (feedbackId) => {
  if (!feedbackId) return null;
  try {
    const raw = sessionStorage.getItem(`interaction-detail:${feedbackId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeInteractionDetailCache = (feedbackId, value) => {
  if (!feedbackId || !value) return;
  try {
    sessionStorage.setItem(`interaction-detail:${feedbackId}`, JSON.stringify(value));
  } catch {
    // Cache failure must never block rendering.
  }
};

const IncidentLevelBadge = ({ value, type = 'priority' }) => {
  const source = type === 'status' ? INCIDENT_STATUS_META : INCIDENT_PRIORITY_META;
  const meta = source[normalizeKey(value)] || {
    label: value || 'Chưa đặt',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const normalizeProviderReports = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return value && typeof value === 'object' ? [value] : [];
};

const normalizeDocuments = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.documents)) return value.documents;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const normalizeResolutions = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.resolutions)) return value.resolutions;
  if (Array.isArray(value?.data)) return value.data;
  return value ? [value] : [];
};

const getResolutionDate = (resolution) => (
  resolution?.resolvedAt ||
  resolution?.submittedAt ||
  resolution?.createdAt ||
  resolution?.updatedAt ||
  null
);

const getProviderReportStatusLabel = (status) => {
  const key = String(status || '')
    .trim()
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

  const labels = {
    pending: 'Chờ xử lý',
    submitted: 'Đã gửi',
    inprogress: 'Đang xử lý',
    completed: 'Đã hoàn thành',
    done: 'Đã hoàn thành',
    resolved: 'Đã xử lý',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối',
    needrework: 'Cần làm lại',
    cancelled: 'Đã hủy',
    closed: 'Đã đóng',
  };

  return labels[key] || status || 'Chưa xác định';
};


const localizeOperationalNote = (value) => {
  const text = String(value || '');
  if (!text) return '';
  return text.replace(/\bcoordinator\b/gi, 'điều phối viên');
};

const pickLatestResolution = (items = []) => (
  [...items].sort((a, b) => (
    new Date(getResolutionDate(b) || 0) - new Date(getResolutionDate(a) || 0)
  ))[0] || null
);

const pickProviderReport = (reports = [], providerReportId) => {
  if (providerReportId !== undefined && providerReportId !== null) {
    const matchingReport = reports.find((report) => (
      Number(report?.providerReportId) === Number(providerReportId)
    ));
    if (matchingReport) return matchingReport;
  }

  return [...reports].sort((a, b) => (
    new Date(b?.reportedAt || b?.updatedAt || 0) -
    new Date(a?.reportedAt || a?.updatedAt || 0)
  ))[0] || null;
};

const isImageDocument = (document) => {
  const fileType = String(document?.fileType || '').toLowerCase();
  const fileUrl = String(document?.fileUrl || '').toLowerCase();
  return fileType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(fileUrl);
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không xác định';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};



const formatSlaCountdown = (value) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours + (days * 24)).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
};

const formatPauseDuration = (pause) => {
  const pausedAtMs = pause?.pausedAt
    ? new Date(pause.pausedAt).getTime()
    : NaN;

  const resumedAtMs = pause?.resumedAt
    ? new Date(pause.resumedAt).getTime()
    : NaN;

  if (!Number.isFinite(pausedAtMs)) {
    return '—';
  }

  // Nếu chưa resume thì lịch sử hiện tại vẫn đang tạm dừng.
  if (!Number.isFinite(resumedAtMs)) {
    return 'Đang tạm dừng';
  }

  const totalSeconds = Math.max(
    0,
    Math.round((resumedAtMs - pausedAtMs) / 1000)
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} giờ`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} phút`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} giây`);
  }

  return parts.join(' ');
};

const getSignalRAccessToken = () => {
  if (typeof window === 'undefined') return '';

  const storages = [window.localStorage, window.sessionStorage];
  const directKeys = [
    'accessToken',
    'access_token',
    'token',
    'authToken',
    'jwtToken',
  ];

  for (const storage of storages) {
    for (const key of directKeys) {
      const value = storage.getItem(key);
      if (value) return value.replace(/^Bearer\s+/i, '').trim();
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;

      const raw = storage.getItem(key);
      if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) continue;

      try {
        const parsed = JSON.parse(raw);
        const candidates = [
          parsed?.accessToken,
          parsed?.access_token,
          parsed?.token,
          parsed?.authToken,
          parsed?.jwtToken,
          parsed?.state?.accessToken,
          parsed?.state?.access_token,
          parsed?.state?.token,
          parsed?.auth?.accessToken,
          parsed?.auth?.token,
          parsed?.user?.accessToken,
          parsed?.user?.token,
        ];

        const token = candidates.find(Boolean);
        if (token) return String(token).replace(/^Bearer\s+/i, '').trim();
      } catch {
        // Bỏ qua storage không phải JSON hợp lệ.
      }
    }
  }

  return '';
};

const getSlaHubUrl = () => {
  const envBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    ''
  ).replace(/\/$/, '');

  return envBaseUrl
    ? `${envBaseUrl}/hubs/sla`
    : '/hubs/sla';
};

const getSlaBadgeClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value.includes('breach')) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value.includes('met') || value.includes('completed')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value.includes('warning')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value.includes('paused')) return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
};

const getSlaStatusLabel = (status) => {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'running') return 'Đang chạy';
  if (value === 'paused') return 'Tạm dừng';
  if (value === 'completed') return 'Đã hoàn thành';
  if (value === 'cancelled' || value === 'canceled') return 'Đã hủy';
  if (value === 'met') return 'Đạt SLA';
  if (value === 'pending') return 'Đang theo dõi';
  if (value === 'warning') return 'Sắp đến hạn';
  if (value === 'breached') return 'Vi phạm SLA';

  return status || 'Chưa xác định';
};

const getHeaderStatusTone = (status) => {
  if ([
    managementTypes.feedbackStatus.SUBMITTED,
    managementTypes.feedbackStatus.VERIFIED,
    managementTypes.feedbackStatus.ASSIGNED,
  ].includes(status)) return 'info';

  if (status === managementTypes.feedbackStatus.AI_REVIEWED) return 'review';

  if ([
    managementTypes.feedbackStatus.IN_PROGRESS,
    managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
  ].includes(status)) return 'warning';

  if ([
    managementTypes.feedbackStatus.RESOLVED,
    managementTypes.feedbackStatus.APPROVED,
    managementTypes.feedbackStatus.CLOSED,
  ].includes(status)) return 'success';

  if (status === managementTypes.feedbackStatus.NEED_REWORK) return 'rework';
  if ([managementTypes.feedbackStatus.REJECTED, managementTypes.feedbackStatus.CANCELLED].includes(status)) return 'danger';
  return 'neutral';
};

const getFileLabel = (document, index) => {
  const fallback = `Tài liệu ${index + 1}`;
  if (document?.fileName) return document.fileName;
  if (!document?.fileUrl) return fallback;
  try {
    const pathname = new URL(document.fileUrl).pathname;
    return decodeURIComponent(pathname.split('/').pop() || fallback);
  } catch {
    return fallback;
  }
};

const MetaItem = ({ label, children, wide = false }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
    <dd className="mt-1.5 break-words text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
      {children || '—'}
    </dd>
  </div>
);

const ResolutionField = ({ label, children, wide = false }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100">
      {children || 'Chưa có nội dung'}
    </dd>
  </div>
);


const normalizeStatusKey = (value) => (
  String(value ?? '')
    .trim()
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
);

const STATUS_BY_KEY = new Map(
  Object.values(managementTypes.feedbackStatus)
    .filter(Boolean)
    .map((status) => [normalizeStatusKey(status), status])
);

// Hỗ trợ các cách viết khác nhau mà backend cũ có thể đã lưu.
STATUS_BY_KEY.set('aireviewed', managementTypes.feedbackStatus.AI_REVIEWED);
STATUS_BY_KEY.set('submittedforapproval', managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL);
STATUS_BY_KEY.set('needrework', managementTypes.feedbackStatus.NEED_REWORK);
STATUS_BY_KEY.set('inprogress', managementTypes.feedbackStatus.IN_PROGRESS);

const normalizeHistoryStatus = (value) => (
  STATUS_BY_KEY.get(normalizeStatusKey(value)) || null
);

const STATUS_SUBTITLES = {
  [managementTypes.feedbackStatus.SUBMITTED]: 'Phản ánh đã được tạo',
  [managementTypes.feedbackStatus.AI_REVIEWED]: 'AI đã hoàn tất phân loại sơ bộ',
  [managementTypes.feedbackStatus.VERIFIED]: 'Quản lý đã xác minh phản ánh',
  [managementTypes.feedbackStatus.ASSIGNED]: 'Phản ánh đã được chuyển đến đơn vị xử lý',
  [managementTypes.feedbackStatus.IN_PROGRESS]: 'Đơn vị đang tiến hành xử lý',
  [managementTypes.feedbackStatus.RESOLVED]: 'Đơn vị đã gửi kết quả xử lý',
  [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: 'Kết quả đang chờ người quản lý duyệt',
  [managementTypes.feedbackStatus.APPROVED]: 'Kết quả xử lý đã được duyệt',
  [managementTypes.feedbackStatus.NEED_REWORK]: 'Kết quả được yêu cầu bổ sung hoặc làm lại',
  [managementTypes.feedbackStatus.REJECTED]: 'Phản ánh đã bị từ chối',
  [managementTypes.feedbackStatus.CLOSED]: 'Phản ánh đã được đóng',
  [managementTypes.feedbackStatus.CANCELLED]: 'Phản ánh đã bị hủy',
};

const HISTORY_RULES = [
  {
    pattern: /feedback created|created feedback/i,
    status: managementTypes.feedbackStatus.SUBMITTED,
  },
  {
    pattern: /reviewed by ai|ai review|classified by ai|using qwen/i,
    status: managementTypes.feedbackStatus.AI_REVIEWED,
  },
  {
    pattern: /verified by staff|feedback verified/i,
    status: managementTypes.feedbackStatus.VERIFIED,
  },
  {
    pattern: /feedback assigned|assigned to|provider assigned/i,
    status: managementTypes.feedbackStatus.ASSIGNED,
  },
  {
    pattern: /work in progress|processing started|in progress/i,
    status: managementTypes.feedbackStatus.IN_PROGRESS,
  },
  {
    pattern: /resolution submitted|submitted for approval|waiting for manager approval/i,
    status: managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
  },
  {
    pattern: /approved by manager|resolution approved/i,
    status: managementTypes.feedbackStatus.APPROVED,
  },
  {
    pattern: /need rework|rework requested|resolution needs rework/i,
    status: managementTypes.feedbackStatus.NEED_REWORK,
  },
  {
    pattern: /rejected by|feedback rejected/i,
    status: managementTypes.feedbackStatus.REJECTED,
  },
  {
    pattern: /feedback closed|closed by/i,
    status: managementTypes.feedbackStatus.CLOSED,
  },
  {
    pattern: /feedback cancelled|cancelled by|canceled by/i,
    status: managementTypes.feedbackStatus.CANCELLED,
  },
];

const translateUnmatchedHistoryNote = (rawNote, changedByUserName) => {
  if (!rawNote) return `Cập nhật bởi ${changedByUserName || 'hệ thống'}`;

  const updatedByMatch = rawNote.match(/^updated by\s+(.+)$/i);
  if (updatedByMatch) return `Cập nhật bởi ${updatedByMatch[1]}`;

  const statusChangedMatch = rawNote.match(/^status changed to\s+(.+)$/i);
  if (statusChangedMatch) {
    const changedStatus = normalizeHistoryStatus(statusChangedMatch[1]);
    return changedStatus
      ? `Chuyển trạng thái sang ${getStatusLabel(changedStatus)}`
      : 'Trạng thái phản ánh đã được cập nhật';
  }

  return rawNote;
};

const normalizeHistoryItem = (history) => {
  const rawNote = String(
    history?.note ||
    history?.description ||
    history?.reason ||
    ''
  ).trim();

  const explicitStatus = normalizeHistoryStatus(
    history?.newStatus || history?.status
  );

  const matchedRule = HISTORY_RULES.find(({ pattern }) =>
    pattern.test(rawNote)
  );

  const status = explicitStatus || matchedRule?.status || null;

  return {
    status,
    title: status
      ? getStatusLabel(status, 'Cập nhật trạng thái')
      : 'Cập nhật hệ thống',
    // Nếu backend đã trả status hợp lệ thì mô tả phải bám theo status,
    // không để một note cũ của AI ghi đè lên mốc "Đã xác minh".
    subtitle:
      (explicitStatus ? STATUS_SUBTITLES[explicitStatus] : null) ||
      STATUS_SUBTITLES[matchedRule?.status] ||
      translateUnmatchedHistoryNote(rawNote, history?.changedByUserName),
    changedAt: history?.changedAt,
  };
};


export const InteractionApprovalDetailPage = () => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isInteractionView = location.pathname.startsWith('/manager/interactions/');
  const backPath = isInteractionView ? '/manager/interactions' : '/manager/approvals';
  const returningToIncident = isInteractionView
    && typeof location.state?.from === 'string'
    && location.state.from.startsWith('/management/incidents/');
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const handleBack = useCallback(() => {
    if (isInteractionView && location.state?.from === '/management/map') {
      navigate('/management/map', {
        state: {
          mapState: location.state?.mapState || null,
        },
      });
      return;
    }

    if (isInteractionView && location.state?.fromInteractionList) {
      navigate(-1);
      return;
    }

    if (returningToIncident) {
      navigate(-1);
      return;
    }

    navigate(backPath);
  }, [
    backPath,
    isInteractionView,
    location.state?.from,
    location.state?.fromInteractionList,
    location.state?.mapState,
    navigate,
    returningToIncident,
  ]);

  const openEvidenceViewer = useCallback((items, index = 0) => {
    const safeItems = Array.isArray(items)
      ? items.filter((item) => item?.url)
      : [];

    if (safeItems.length === 0) return;

    setSelectedEvidence({
      items: safeItems,
      index: Math.min(Math.max(Number(index) || 0, 0), safeItems.length - 1),
    });
  }, []);
  const cachedFeedback = useMemo(
    () => (isInteractionView ? readInteractionDetailCache(feedbackId) : null),
    [feedbackId, isInteractionView]
  );
  const [feedback, setFeedback] = useState(() => cachedFeedback);
  const [relatedIncident, setRelatedIncident] = useState(null);
  const [relatedIncidentLoading, setRelatedIncidentLoading] = useState(false);
  const [providerReport, setProviderReport] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [slaDetail, setSlaDetail] = useState(null);
  const [slaStatus, setSlaStatus] = useState(null);
  const [slaClock, setSlaClock] = useState({
    responseSeconds: 0,
    resolutionSeconds: 0,
    syncedAt: 0,
    status: '',
  });
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [slaTimeline, setSlaTimeline] = useState([]);
  const [slaError, setSlaError] = useState('');
  const [slaActionLoading, setSlaActionLoading] = useState('');
  const [loading, setLoading] = useState(() => !cachedFeedback);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [note, setNote] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState(null);
  const [slaModal, setSlaModal] = useState(null);
  const [pauseReasonOpen, setPauseReasonOpen] = useState(false);
  const [slaModalForm, setSlaModalForm] = useState({
    reasonCode: 'WaitingCitizen',
    note: '',
  });
  const resolvedLocationText = useResolvedLocationText({
    locationText: feedback?.locationText,
    areaName: feedback?.areaName || feedback?.wardName,
    latitude: feedback?.latitude,
    longitude: feedback?.longitude,
  });

  const latitude = Number(feedback?.latitude);
  const longitude = Number(feedback?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  const openLocationOnMap = useCallback(() => {
    if (!hasCoordinates || !feedbackId) return;

    navigate('/management/map', {
      state: {
        mapState: {
          focusFeedbackId: feedbackId,
          focusLatitude: latitude,
          focusLongitude: longitude,
          focusMap: true,
        },
        returnTo: `${location.pathname}${location.search || ''}`,
        returnLabel: 'Quay lại chi tiết phản ánh',
        returnState: location.state || null,
      },
    });
  }, [feedbackId, hasCoordinates, latitude, location.pathname, location.search, location.state, longitude, navigate]);

  useEffect(() => {
    if (!confirmingAction || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmingAction]);

  useEffect(() => {
    if (!selectedEvidence || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const moveEvidence = (direction) => {
      setSelectedEvidence((current) => {
        if (!current?.items?.length || current.items.length < 2) return current;
        const nextIndex = (
          current.index + direction + current.items.length
        ) % current.items.length;
        return { ...current, index: nextIndex };
      });
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedEvidence(null);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveEvidence(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveEvidence(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEvidence]);

  const refreshSlaData = useCallback(async () => {
    if (!feedbackId || isInteractionView) return;

    const [
      slaDetailResult,
      slaStatusResult,
      slaTimelineResult,
    ] = await Promise.allSettled([
      slaApi.getCurrentFeedbackSla(feedbackId),
      slaApi.getFeedbackSlaStatus(feedbackId),
      slaApi.getFeedbackSlaTimeline(feedbackId),
    ]);

    const nextDetail =
      slaDetailResult.status === 'fulfilled'
        ? slaDetailResult.value
        : null;

    const nextStatus =
      slaStatusResult.status === 'fulfilled'
        ? slaStatusResult.value
        : null;

    const nextTimeline =
      slaTimelineResult.status === 'fulfilled' &&
      Array.isArray(slaTimelineResult.value)
        ? slaTimelineResult.value
        : [];

    if (slaDetailResult.status === 'fulfilled') {
      setSlaDetail(nextDetail);
    }

    if (slaStatusResult.status === 'fulfilled') {
      setSlaStatus(nextStatus);
    }

    if (slaTimelineResult.status === 'fulfilled') {
      setSlaTimeline(nextTimeline);
    }

    setSlaError(
      slaDetailResult.status === 'rejected' &&
      slaStatusResult.status === 'rejected'
        ? 'Phản ánh này chưa có SLA hoặc không thể tải dữ liệu SLA.'
        : ''
    );
  }, [feedbackId, isInteractionView]);

  const loadFeedback = useCallback(async () => {
    const hasCachedPrimary = Boolean(isInteractionView && readInteractionDetailCache(feedbackId));
    const cachedSecondary = isInteractionView
      ? readInteractionSecondaryCache(feedbackId)
      : null;

    if (cachedSecondary) {
      setProviderReport(cachedSecondary.providerReport || null);
      setResolutions(Array.isArray(cachedSecondary.resolutions) ? cachedSecondary.resolutions : []);
      setDocuments(Array.isArray(cachedSecondary.documents) ? cachedSecondary.documents : []);
    }

    setLoading(!hasCachedPrimary);
    setSecondaryLoading(!cachedSecondary);
    setMessage({ type: '', text: '' });

    try {
      const detail = await managementFeedbackApi.getFeedbackById(feedbackId);
      setFeedback(detail);
      if (isInteractionView) writeInteractionDetailCache(feedbackId, detail);
      setLoading(false);
      setSecondaryLoading(!cachedSecondary);

      const secondaryTask = async () => {
        try {
          const commonResults = await Promise.allSettled([
            managementFeedbackApi.getProviderReports(feedbackId),
            managementFeedbackApi.getResolutions(feedbackId),
          ]);

          const [reportResult, resolutionsResult] = commonResults;

          const reportList = reportResult.status === 'fulfilled'
            ? normalizeProviderReports(reportResult.value)
            : [];
          const resolutionList = resolutionsResult.status === 'fulfilled'
            ? normalizeResolutions(resolutionsResult.value)
            : [];

          if (!isInteractionView) {
            const [
              slaDetailResult,
              slaStatusResult,
              slaTimelineResult,
            ] = await Promise.allSettled([
              slaApi.getCurrentFeedbackSla(feedbackId),
              slaApi.getFeedbackSlaStatus(feedbackId),
              slaApi.getFeedbackSlaTimeline(feedbackId),
            ]);

            setSlaDetail(slaDetailResult.status === 'fulfilled' ? slaDetailResult.value : null);
            setSlaStatus(slaStatusResult.status === 'fulfilled' ? slaStatusResult.value : null);
            setSlaTimeline(
              slaTimelineResult.status === 'fulfilled' && Array.isArray(slaTimelineResult.value)
                ? slaTimelineResult.value
                : []
            );
            setSlaError(
              slaDetailResult.status === 'rejected' && slaStatusResult.status === 'rejected'
                ? 'Phản ánh này chưa có SLA hoặc không thể tải dữ liệu SLA.'
                : ''
            );
          } else {
            setSlaDetail(null);
            setSlaStatus(null);
            setSlaTimeline([]);
            setSlaError('');
          }

          const selectedResolution = pickLatestResolution(resolutionList);
          const selectedReport = pickProviderReport(reportList, selectedResolution?.providerReportId);

          let nextDocuments = [];
          if (selectedReport?.providerReportId) {
            try {
              const documentResult = await managementFeedbackApi.getProviderReportCompletionDocuments(
                selectedReport.providerReportId
              );
              nextDocuments = normalizeDocuments(documentResult);
            } catch (documentError) {
              console.warn('Failed to load completion documents', documentError);
            }
          }

          setProviderReport(selectedReport);
          setResolutions(resolutionList);
          setDocuments(nextDocuments);

          if (isInteractionView) {
            writeInteractionSecondaryCache(feedbackId, {
              providerReport: selectedReport,
              resolutions: resolutionList,
              documents: nextDocuments,
            });
          }
        } finally {
          setSecondaryLoading(false);
        }
      };

      secondaryTask();
    } catch (err) {
      console.error('Failed to load approval detail', err);
      setMessage({ type: 'error', text: err?.message || 'Không thể tải chi tiết duyệt.' });
      setLoading(false);
      setSecondaryLoading(false);
    }
  }, [feedbackId, isInteractionView]);

  useEffect(() => {
    if (feedbackId) loadFeedback();
  }, [feedbackId, loadFeedback]);

  useEffect(() => {
    const incidentId = feedback?.incidentId;

    if (!isInteractionView || !incidentId) {
      setRelatedIncident(null);
      setRelatedIncidentLoading(false);
      return undefined;
    }

    let active = true;
    setRelatedIncidentLoading(true);

    incidentManagementApi.getIncidentById(incidentId)
      .then((response) => {
        if (!active) return;
        const payload = response?.data ?? response ?? {};
        const incident =
          payload?.data && typeof payload.data === 'object'
            ? payload.data
            : payload;
        setRelatedIncident(incident);
      })
      .catch((error) => {
        if (!active) return;
        console.warn('Không thể tải sự vụ liên quan của phản ánh', error);
        setRelatedIncident(null);
      })
      .finally(() => {
        if (active) setRelatedIncidentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [feedback?.incidentId, isInteractionView]);

  useEffect(() => {
  if (!slaStatus) return;

  setSlaClock({
    responseSeconds: Math.max(
      0,
      Number(slaStatus.responseRemainingSeconds) || 0
    ),
    resolutionSeconds: Math.max(
      0,
      Number(slaStatus.resolutionRemainingSeconds) || 0
    ),
    syncedAt: Date.now(),
    status: String(slaStatus.status || ''),
  });

  setClockTick(Date.now());
}, [slaStatus]);

  useEffect(() => {
    const isRunning =
      String(slaClock.status || '').toLowerCase() === 'running';

    if (!isRunning) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [slaClock.status, slaClock.syncedAt]);

  useEffect(() => {
    if (!feedbackId || isInteractionView) return undefined;

    const connection = createOptionalSignalRConnection({
      signalR,
      hubUrl: getSlaHubUrl(),
      accessTokenFactory: () => getSignalRAccessToken(),
    });

    let disposed = false;

    connection.on('SlaUpdated', async (payload) => {
      const updatedFeedbackId = String(
        payload?.feedbackId ??
        payload?.FeedbackId ??
        ''
      );

      if (
        !updatedFeedbackId ||
        updatedFeedbackId.toLowerCase() !== String(feedbackId).toLowerCase()
      ) {
        return;
      }

      try {
        await refreshSlaData();
      } catch (error) {
        console.warn('Không thể đồng bộ lại SLA sau SignalR event.', error);
      }
    });

    const startConnection = async () => {
      try {
        await connection.start();

        if (!disposed) {
          console.info('SLA SignalR connected.');
        }
      } catch (error) {
        if (!disposed) {
          console.warn('Không thể kết nối SLA SignalR.', error);
        }
      }
    };

    startConnection();

    return () => {
      disposed = true;
      connection.off('SlaUpdated');
      connection.stop().catch(() => {});
    };
  }, [feedbackId, isInteractionView, refreshSlaData]);

  const latestResolution = pickLatestResolution(
    resolutions.length > 0
      ? resolutions
      : feedback?.resolution
        ? [feedback.resolution]
        : []
  );

  const beforeImages = useMemo(() => {
    const attachments = Array.isArray(feedback?.attachments) ? feedback.attachments : [];
    return attachments
      .map((attachment) => typeof attachment === 'string' ? attachment : attachment?.fileUrl || attachment?.url || '')
      .filter(Boolean);
  }, [feedback]);

  const afterImages = useMemo(() => (
    documents
      .filter(isImageDocument)
      .map((document) => document?.fileUrl || '')
      .filter(Boolean)
  ), [documents]);

  const fallbackTimeline = useMemo(() => [
    { status: managementTypes.feedbackStatus.SUBMITTED, subtitle: 'Người dân đã gửi phản ánh' },
    { status: managementTypes.feedbackStatus.AI_REVIEWED, subtitle: 'AI hoàn tất phân loại sơ bộ' },
    { status: managementTypes.feedbackStatus.VERIFIED, subtitle: 'Quản lý đã xác minh thông tin' },
    { status: managementTypes.feedbackStatus.ASSIGNED, subtitle: 'Đã chuyển tới đơn vị phối hợp' },
    { status: managementTypes.feedbackStatus.IN_PROGRESS, subtitle: 'Đơn vị đang thực hiện xử lý' },
    { status: managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL, subtitle: 'Kết quả đang chờ người quản lý quyết định' },
  ], []);

  const activeTimelineIndex = useMemo(() => {
    const map = {
      [managementTypes.feedbackStatus.SUBMITTED]: 0,
      [managementTypes.feedbackStatus.AI_REVIEWED]: 1,
      [managementTypes.feedbackStatus.VERIFIED]: 2,
      [managementTypes.feedbackStatus.ASSIGNED]: 3,
      [managementTypes.feedbackStatus.IN_PROGRESS]: 4,
      [managementTypes.feedbackStatus.RESOLVED]: 5,
      [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: 5,
      [managementTypes.feedbackStatus.APPROVED]: 5,
      [managementTypes.feedbackStatus.NEED_REWORK]: 5,
      [managementTypes.feedbackStatus.REJECTED]: 5,
      [managementTypes.feedbackStatus.CLOSED]: 5,
      [managementTypes.feedbackStatus.CANCELLED]: 5,
    };
    return map[feedback?.status] ?? 0;
  }, [feedback?.status]);

  const timelineItems = useMemo(() => {
    const histories = Array.isArray(feedback?.statusHistories)
      ? feedback.statusHistories
      : [];

    if (histories.length > 0) {
      return [...histories]
        .sort(
          (a, b) =>
            new Date(a?.changedAt || 0) -
            new Date(b?.changedAt || 0)
        )
        .map(normalizeHistoryItem);
    }

    const visibleMilestones = fallbackTimeline.slice(0, Math.max(1, activeTimelineIndex + 1));
    const lastMilestone = visibleMilestones[visibleMilestones.length - 1];

    if (feedback?.status && lastMilestone?.status !== feedback.status) {
      visibleMilestones.push({
        status: feedback.status,
        subtitle: `Hồ sơ hiện ở trạng thái ${getStatusLabel(feedback.status)}`,
      });
    }

    return visibleMilestones;
  }, [activeTimelineIndex, fallbackTimeline, feedback]);

  const displayTimelineItems = useMemo(() => {
    if (!isInteractionView || timelineExpanded || timelineItems.length <= 6) {
      return timelineItems.map((item, originalIndex) => ({
        type: 'item',
        item,
        originalIndex,
      }));
    }

    const firstCount = 2;
    const lastCount = 3;
    const hiddenCount = timelineItems.length - firstCount - lastCount;

    return [
      ...timelineItems.slice(0, firstCount).map((item, originalIndex) => ({
        type: 'item',
        item,
        originalIndex,
      })),
      {
        type: 'gap',
        hiddenCount,
      },
      ...timelineItems.slice(-lastCount).map((item, index) => ({
        type: 'item',
        item,
        originalIndex: timelineItems.length - lastCount + index,
      })),
    ];
  }, [isInteractionView, timelineExpanded, timelineItems]);

  const runSlaAction = async (key, action, successText) => {
    if (slaActionLoading) return;
    setSlaActionLoading(key);
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await loadFeedback();
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Không thể cập nhật SLA.' });
    } finally {
      setSlaActionLoading('');
    }
  };

  const openSlaModal = (type) => {
    setMessage({ type: '', text: '' });
    setPauseReasonOpen(false);
    setSlaModalForm({
      reasonCode: type === 'pause' ? 'WaitingCitizen' : 'Other',
      note: '',
    });
    setSlaModal(type);
  };

  const closeSlaModal = () => {
    if (slaActionLoading) return;
    setPauseReasonOpen(false);
    setSlaModal(null);
    setSlaModalForm({
      reasonCode: 'WaitingCitizen',
      note: '',
    });
  };

  const handlePauseSla = () => openSlaModal('pause');
  const handleResumeSla = () => openSlaModal('resume');
  const handleCancelSla = () => openSlaModal('cancel');

  const handleSubmitSlaModal = async () => {
    const noteValue = String(slaModalForm.note || '').trim();

    if (slaModal === 'pause') {
      const allowedPauseReasons = new Set([
        'WaitingCitizen',
        'ForceMajeure',
        'ExternalDependency',
        'SystemMaintenance',
        'Other',
      ]);

      if (!allowedPauseReasons.has(slaModalForm.reasonCode)) {
        setMessage({ type: 'error', text: 'Vui lòng chọn lý do tạm dừng hợp lệ.' });
        return;
      }

      await runSlaAction(
        'pause',
        () => slaApi.pauseFeedbackSla(feedbackId, {
          ReasonCode: slaModalForm.reasonCode,
          ReasonNote: noteValue || null,
        }),
        'Đã tạm dừng SLA.'
      );
      setSlaModal(null);
      return;
    }

    if (slaModal === 'resume') {
      await runSlaAction(
        'resume',
        () => slaApi.resumeFeedbackSla(feedbackId, {
          Note: noteValue || null,
        }),
        'Đã tiếp tục SLA.'
      );
      setSlaModal(null);
      return;
    }

    if (slaModal === 'cancel') {
      if (!noteValue) {
        setMessage({ type: 'error', text: 'Vui lòng nhập lý do hủy SLA.' });
        return;
      }

      await runSlaAction(
        'cancel',
        () => slaApi.cancelFeedbackSla(feedbackId, noteValue),
        'Đã hủy SLA.'
      );
      setSlaModal(null);
    }
  };

  const handleCheckSlaViolation = async () => {
    const feedbackSlaId = slaDetail?.feedbackSlaId;
    if (!feedbackSlaId) {
      setMessage({ type: 'error', text: 'Không tìm thấy mã SLA của phản ánh.' });
      return;
    }
    await runSlaAction('check', () => slaApi.checkSlaViolation(feedbackSlaId), 'Đã kiểm tra vi phạm SLA.');
  };

  const handleDecision = async (decision) => {
  const normalizedReworkReason = (reworkReason || note).trim();

  if (decision === 'rework' && !normalizedReworkReason) {
    setMessage({
      type: 'error',
      text: 'Vui lòng nhập lý do yêu cầu làm lại.'
    });
    setConfirmingAction(null);
    return;
  }

  setSubmitting(true);

  try {
    if (decision === 'approve') {
  await managementFeedbackApi.approveFeedback(
    feedbackId,
    note
  );

  setMessage({
    type: 'success',
    text: 'Đã duyệt kết quả xử lý.'
  });
    } else {
      /*
       * Yêu cầu làm lại:
       * - KHÔNG complete SLA
       * - SLA vẫn Running
       */
      await managementFeedbackApi.requestRework(
        feedbackId,
        normalizedReworkReason
      );

      setMessage({
        type: 'success',
        text: 'Đã gửi yêu cầu làm lại. SLA tiếp tục được theo dõi.'
      });
    }

    await loadFeedback();

    navigate('/manager/approvals', {
      state: {
        refreshKey: Date.now(),
        approvalNotice: decision === 'approve'
          ? 'Đã duyệt kết quả xử lý.'
          : 'Đã gửi yêu cầu làm lại cho đơn vị xử lý.',
      }
    });
  } catch (err) {
    console.error(
      'Failed to complete approval decision',
      err
    );

    setMessage({
      type: 'error',
      text:
        err?.message ||
        'Không thể cập nhật quyết định duyệt.'
    });
  } finally {
    setSubmitting(false);
    setConfirmingAction(null);
    setReworkReason('');
  }
};

  if (loading) {
    return (
      <article className="admin-page-shell manager-ui-page space-y-6" aria-busy="true" aria-label="Đang tải chi tiết phản ánh">
        <button
          type="button"
          onClick={handleBack}
          className="admin-secondary-link inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold transition"
        >
          <Lucide.ArrowLeft size={16} aria-hidden="true" />
          {returningToIncident ? 'Quay lại sự vụ' : 'Quay lại danh sách'}
        </button>
        <header className="admin-page-hero h-40 animate-pulse" />
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <article className="admin-panel h-96 animate-pulse" />
          <aside className="admin-panel h-80 animate-pulse" />
        </section>
      </article>
    );
  }

  if (!feedback) {
    return (
      <article className="admin-page-shell space-y-6">
        <ManagerPageHeader
          title="Không tìm thấy hồ sơ"
          description="Hồ sơ có thể đã bị xóa hoặc tài khoản hiện tại không có quyền truy cập."
          icon={Lucide.FileQuestion}
        />
        <section className="admin-panel overflow-hidden">
          <ManagerEmptyState
            icon={Lucide.FileQuestion}
            title="Không có dữ liệu phản ánh"
            description={returningToIncident ? 'Quay lại sự vụ để tiếp tục theo dõi.' : 'Quay lại danh sách và chọn một hồ sơ khác.'}
            action={(
              <button type="button" className="btn admin-primary-action rounded-2xl" onClick={handleBack}>
                {returningToIncident ? 'Quay lại sự vụ' : 'Quay lại danh sách'}
              </button>
            )}
          />
        </section>
      </article>
    );
  }

  const isAwaitingApproval = feedback.status === managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL;
  const hasProcessingData = Boolean(latestResolution || providerReport || documents.length > 0);
  const hasImageComparison = afterImages.length > 0;
  const olderResolutions = resolutions.filter((resolution) => resolution !== latestResolution);

  const isSlaRunning =
    String(slaClock.status || '').toLowerCase() === 'running';

  const elapsedSeconds =
    isSlaRunning && slaClock.syncedAt
      ? Math.max(
          0,
          Math.floor(
            (clockTick - slaClock.syncedAt) / 1000
          )
        )
      : 0;

  const responseCountdownSeconds =
    String(slaStatus?.responseStatus || '').toLowerCase() === 'pending'
      ? Math.max(
          0,
          slaClock.responseSeconds - elapsedSeconds
        )
      : 0;

  const resolutionCountdownSeconds =
    String(slaStatus?.resolutionStatus || '').toLowerCase() === 'pending'
      ? Math.max(
          0,
          slaClock.resolutionSeconds - elapsedSeconds
        )
      : 0;

  const SLA_PAUSE_REASONS = [
    { value: 'WaitingCitizen', label: 'Chờ phản hồi từ người dân' },
    { value: 'ForceMajeure', label: 'Sự kiện bất khả kháng' },
    { value: 'ExternalDependency', label: 'Phụ thuộc đơn vị bên ngoài' },
    { value: 'SystemMaintenance', label: 'Bảo trì hệ thống' },
    { value: 'Other', label: 'Lý do khác' },
  ];

  const slaModalConfig = (() => {
    if (slaModal === 'pause') {
      return {
        title: 'Tạm dừng SLA',
        description: 'Đồng hồ SLA sẽ ngừng tính trong thời gian tạm dừng.',
        Icon: Lucide.PauseCircle,
        iconClass: 'bg-amber-50 text-amber-700',
        confirmLabel: 'Tạm dừng SLA',
        confirmClass: 'btn rounded-2xl bg-amber-600 text-white hover:bg-amber-700',
      };
    }

    if (slaModal === 'resume') {
      return {
        title: 'Tiếp tục SLA',
        description: 'SLA sẽ tiếp tục chạy và deadline được điều chỉnh theo tổng thời gian đã tạm dừng.',
        Icon: Lucide.PlayCircle,
        iconClass: 'bg-emerald-50 text-emerald-700',
        confirmLabel: 'Tiếp tục SLA',
        confirmClass: 'btn rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700',
      };
    }

    if (slaModal === 'cancel') {
      return {
        title: 'Hủy SLA',
        description: 'Thao tác này dừng SLA hiện tại. Chỉ sử dụng khi phản ánh thực sự không còn cần được theo dõi theo SLA.',
        Icon: Lucide.XCircle,
        iconClass: 'bg-rose-50 text-rose-700',
        confirmLabel: 'Xác nhận hủy SLA',
        confirmClass: 'btn rounded-2xl bg-rose-600 text-white hover:bg-rose-700',
      };
    }

    return null;
  })();

  return (
    <article className="admin-page-shell manager-ui-page space-y-5 pb-5">
      <ManagerToast
        type={message.type || 'success'}
        message={message.text}
        onClose={() => setMessage({ type: '', text: '' })}
      />

      <button
        type="button"
        onClick={handleBack}
        className="admin-secondary-link inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold transition"
      >
        <Lucide.ArrowLeft size={16} aria-hidden="true" />
        {returningToIncident ? 'Quay lại sự vụ' : 'Quay lại danh sách'}
      </button>

      {isInteractionView ? (
        <section className="interaction-detail-hero admin-page-hero overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="interaction-detail-hero-icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                <Lucide.MessageSquareText size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">
                    {formatFeedbackCode(feedback.feedbackId)}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {formatDateTime(feedback.createdAt)}
                  </span>
                </div>
                <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem] dark:text-white">
                  {feedback.title || 'Chi tiết phản ánh'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Lucide.MapPin size={14} aria-hidden="true" />
                    {feedback.areaName || 'Chưa xác định khu vực'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Lucide.Tags size={14} aria-hidden="true" />
                    {feedback.categoryName || 'Chưa phân loại'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[feedback.status] || 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                {getStatusLabel(feedback.status)}
              </span>
              <IncidentLevelBadge value={feedback.priority || 'Medium'} />
            </div>
          </div>
        </section>
      ) : (
        <ManagerPageHeader
          title={feedback.title || 'Chi tiết phản ánh'}
          description={`${feedback.areaName || 'Chưa xác định khu vực'} · ${feedback.categoryName || 'Chưa phân loại'}`}
          icon={Lucide.FileText}
          statusLabel="Trạng thái"
          statusValue={getStatusLabel(feedback.status)}
          statusTone={getHeaderStatusTone(feedback.status)}
        />
      )}


      {isInteractionView ? (
        feedback.incidentId ? (
          <section
            className="interaction-related-incident rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_26px_rgba(15,23,42,0.045)] sm:px-6 dark:border-slate-800 dark:bg-slate-950"
            aria-labelledby="related-incident-title"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Lucide.Siren size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span id="related-incident-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      Sự vụ liên quan
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
                    <span className="shrink-0 text-xs font-bold text-blue-600 dark:text-blue-300">
                      {formatIncidentCode(feedback.incidentId)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={relatedIncident?.title || 'Sự vụ đã liên kết'}>
                    {relatedIncidentLoading ? 'Đang tải sự vụ...' : relatedIncident?.title || 'Sự vụ đã liên kết'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {relatedIncident?.status ? <IncidentLevelBadge value={relatedIncident.status} type="status" /> : null}
                {relatedIncident?.priority ? <IncidentLevelBadge value={relatedIncident.priority} /> : null}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {Number(relatedIncident?.reportCount ?? feedback.incidentReportCount ?? 0) || 0} phản ánh
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/management/incidents/${feedback.incidentId}`)}
                  className="ml-0 inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:ml-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-blue-500/10"
                >
                  Xem sự vụ
                  <Lucide.ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section
            className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50"
            aria-label="Trạng thái liên kết sự vụ"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Lucide.Unlink size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Chưa liên kết với sự vụ
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Phản ánh này hiện chưa thuộc sự vụ nào.
                </p>
              </div>
            </div>
          </section>
        )
      ) : null}

      {!isInteractionView ? (
        <>
      <section className="admin-panel overflow-hidden" aria-labelledby="sla-detail-title">
          <ManagerSectionHeader
            id="sla-detail-title"
            title="SLA của phản ánh"
            description="Theo dõi chính sách, thời hạn phản hồi, thời hạn hoàn thành, cảnh báo, vi phạm và lịch sử SLA."
            icon={Lucide.TimerReset}
            actions={(
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSlaBadgeClass(slaStatus?.status || slaDetail?.status)}`}>
                  {getSlaStatusLabel(slaStatus?.status || slaDetail?.status || 'Chưa có SLA')}
                </span>
                {String(slaStatus?.status || slaDetail?.status || '').toLowerCase() === 'paused' ? (
                  <button type="button" className="btn admin-secondary-action rounded-xl" onClick={handleResumeSla} disabled={Boolean(slaActionLoading)}>
                    <Lucide.Play size={15} /> {slaActionLoading === 'resume' ? 'Đang tiếp tục...' : 'Tiếp tục SLA'}
                  </button>
                ) : (
                  <button type="button" className="btn admin-secondary-action rounded-xl" onClick={handlePauseSla} disabled={Boolean(slaActionLoading) || !slaDetail?.feedbackSlaId}>
                    <Lucide.Pause size={15} /> {slaActionLoading === 'pause' ? 'Đang tạm dừng...' : 'Tạm dừng SLA'}
                  </button>
                )}
                <button type="button" className="btn admin-secondary-action rounded-xl" onClick={handleCheckSlaViolation} disabled={Boolean(slaActionLoading) || !slaDetail?.feedbackSlaId}>
                  <Lucide.ShieldCheck size={15} /> {slaActionLoading === 'check' ? 'Đang kiểm tra...' : 'Kiểm tra vi phạm'}
                </button>
                <button type="button" className="btn rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={handleCancelSla} disabled={Boolean(slaActionLoading) || !slaDetail?.feedbackSlaId}>
                  <Lucide.XCircle size={15} /> {slaActionLoading === 'cancel' ? 'Đang hủy...' : 'Hủy SLA'}
                </button>
              </div>
            )}
          />

          {slaError && !slaDetail && !slaStatus ? (
            <div className="p-5 sm:p-6">
              <ErrorAlert title="Không có dữ liệu SLA" message={slaError} onClose={() => setSlaError('')} />
            </div>
          ) : (
            <section className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Chính sách SLA</p>
                  <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{slaDetail?.policyName || '—'}</h3>
                  <p className="mt-2 text-xs text-slate-500">{slaDetail?.priority || feedback.priority || '—'} · {slaDetail?.categoryName || feedback.categoryName || '—'}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mã SLA</p>
                  <h3 className="mt-2 font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">{slaDetail?.feedbackSlaId || '—'}</h3>
                  <p className="mt-2 text-xs text-slate-500">{slaDetail?.isCurrent === false ? 'SLA lịch sử' : 'SLA hiện tại'}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Bắt đầu</p>
                  <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatDateTime(slaDetail?.startedAt || slaStatus?.startedAt)}</h3>
                  <p className="mt-2 text-xs text-slate-500">{slaDetail?.startedByUserName || 'Hệ thống / không xác định'}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tổng thời gian tạm dừng</p>
                  <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{Number(slaDetail?.totalPausedMinutes || 0)} phút</h3>
                  <p className="mt-2 text-xs text-slate-500">{Array.isArray(slaDetail?.pauseHistories) ? slaDetail.pauseHistories.length : 0} lần tạm dừng</p>
                </article>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
                  <header className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Phản hồi đầu tiên</p><h3 className="mt-1 text-base font-semibold">Thời hạn phản hồi</h3></div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSlaBadgeClass(slaStatus?.responseStatus || slaDetail?.responseStatus)}`}>{getSlaStatusLabel(slaStatus?.responseStatus || slaDetail?.responseStatus || 'Pending')}</span>
                  </header>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <MetaItem label="Hạn xử lý">{formatDateTime(slaDetail?.responseDueAt || slaStatus?.responseDueAt)}</MetaItem>
                    <MetaItem label="Thời điểm phản hồi">{formatDateTime(slaDetail?.respondedAt)}</MetaItem>
                    <MetaItem label="Còn lại">
                      <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatSlaCountdown(responseCountdownSeconds)}
                      </span>
                    </MetaItem>
                    <MetaItem label="Vi phạm">{slaStatus?.isResponseBreached || slaDetail?.isResponseBreached ? 'Có' : 'Không'}</MetaItem>
                  </dl>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
                  <header className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Hoàn thành xử lý</p><h3 className="mt-1 text-base font-semibold">Thời hạn hoàn thành</h3></div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSlaBadgeClass(slaStatus?.resolutionStatus || slaDetail?.resolutionStatus)}`}>{getSlaStatusLabel(slaStatus?.resolutionStatus || slaDetail?.resolutionStatus || 'Pending')}</span>
                  </header>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <MetaItem label="Hạn xử lý">{formatDateTime(slaDetail?.resolutionDueAt || slaStatus?.resolutionDueAt)}</MetaItem>
                    <MetaItem label="Thời điểm hoàn thành">{formatDateTime(slaDetail?.resolvedAt)}</MetaItem>
                    <MetaItem label="Còn lại">
                      <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatSlaCountdown(resolutionCountdownSeconds)}
                      </span>
                    </MetaItem>
                    <MetaItem label="Vi phạm">{slaStatus?.isResolutionBreached || slaDetail?.isResolutionBreached ? 'Có' : 'Không'}</MetaItem>
                  </dl>
                </article>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <article>
                  <div className="flex items-center gap-2"><Lucide.History size={17} className="text-blue-600" /><h3 className="text-sm font-semibold">Lịch sử SLA</h3></div>
                  {slaTimeline.length > 0 ? (
                    <div className="mt-4 max-h-[410px] overflow-y-auto pr-2 [scrollbar-gutter:stable]"><ol className="space-y-3">
                      {slaTimeline.map((event, index) => (
                        <li key={event.slaEventId || `${event.eventType}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{event.eventType || 'Sự kiện SLA'}</strong><time className="text-[11px] text-slate-400">{formatDateTime(event.createdAt)}</time></div>
                          {event.note ? <p className="mt-2 text-xs leading-5 text-slate-500">{event.note}</p> : null}
                          <p className="mt-1 text-[11px] text-slate-400">{event.triggeredByUserName || event.triggerSource || 'Hệ thống'}</p>
                        </li>
                      ))}
                    </ol></div>
                  ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Chưa có sự kiện SLA.</p>}
                </article>

                <article>
                  <div className="flex items-center gap-2"><Lucide.PauseCircle size={17} className="text-amber-600" /><h3 className="text-sm font-semibold">Lịch sử tạm dừng</h3></div>
                  {Array.isArray(slaDetail?.pauseHistories) && slaDetail.pauseHistories.length > 0 ? (
                    <div className="mt-4 max-h-[410px] overflow-y-auto pr-2 [scrollbar-gutter:stable]"><ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                      {slaDetail.pauseHistories.map((pause, index) => (
                        <li key={pause.slaPauseHistoryId || index} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                          <dl className="grid gap-3 sm:grid-cols-2">
                            <MetaItem label="Thời điểm tạm dừng">{formatDateTime(pause.pausedAt)}</MetaItem>
                            <MetaItem label="Thời điểm tiếp tục">{formatDateTime(pause.resumedAt)}</MetaItem>
                            <MetaItem label="Thời gian tạm dừng">{formatPauseDuration(pause)}</MetaItem>
                            <MetaItem label="Lý do">{pause.reasonNote || pause.reasonCode || 'Không có ghi chú'}</MetaItem>
                          </dl>
                        </li>
                      ))}
                    </ul></div>
                  ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">SLA chưa từng được tạm dừng.</p>}
                </article>
              </div>
            </section>
          )}
        </section>

          </>
      ) : null}

      <section
        className={
          isInteractionView
            ? 'space-y-6'
            : 'grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]'
        }
      >
        <article className="admin-panel overflow-hidden" aria-labelledby="feedback-overview-title">
          <ManagerSectionHeader
            id="feedback-overview-title"
            title="Nội dung phản ánh"
            description={
              isInteractionView
                ? 'Nội dung, hình ảnh và thông tin gốc do người dân cung cấp.'
                : 'Thông tin gốc được gom trong một khu vực để dễ đọc và đối chiếu.'
            }
            icon={Lucide.MessageSquareText}
            actions={(
              isInteractionView ? (
                <IncidentLevelBadge value={feedback.priority || 'Medium'} />
              ) : (
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${PRIORITY_BADGE_CLASSES[feedback.priority] || PRIORITY_BADGE_CLASSES.Medium}`}>
                  {priorityLabels[feedback.priority] || feedback.priority || 'Trung bình'}
                </span>
              )
            )}
          />

          <section className={isInteractionView ? 'p-5 sm:p-6' : 'space-y-6 p-5 sm:p-6'}>
            {isInteractionView ? (
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
                <div className="min-w-0 space-y-5">
                  <div className="interaction-description-block rounded-2xl border border-slate-200 bg-slate-50/55 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <Lucide.Quote size={15} className="text-blue-500" aria-hidden="true" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Mô tả của người dân</p>
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-7 text-slate-800 dark:text-slate-100">
                      {feedback.description || 'Không có mô tả chi tiết.'}
                    </p>
                  </div>

                  {beforeImages.length > 0 ? (
                    <section aria-labelledby="feedback-images-title">
                      <div className="flex items-center justify-between gap-3">
                        <h3 id="feedback-images-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Hình ảnh người dân gửi
                        </h3>
                        <span className="text-xs font-medium text-slate-400">{beforeImages.length} ảnh</span>
                      </div>
                      <ul className={`mt-3 grid gap-3 ${beforeImages.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                        {beforeImages.map((image, index) => (
                          <li key={`${image}-${index}`}>
                            <button
                              type="button"
                              onClick={() => openEvidenceViewer(
                                beforeImages.map((url, imageIndex) => ({
                                  url,
                                  name: `Hình ảnh người dân gửi ${imageIndex + 1}`,
                                })),
                                index
                              )}
                              className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/30"
                              aria-label={`Xem hình ảnh phản ánh ${index + 1}`}
                            >
                              <img
                                src={image}
                                alt={`Hình ảnh phản ánh ${index + 1}`}
                                className={`w-full object-cover transition duration-300 group-hover:scale-[1.01] ${beforeImages.length === 1 ? 'h-[clamp(240px,32vw,390px)]' : 'h-56'}`}
                              />
                              <span className="pointer-events-none absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-90 backdrop-blur-sm transition group-hover:bg-blue-600">
                                <Lucide.Expand size={14} aria-hidden="true" />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Phản ánh này không có hình ảnh đính kèm.
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-4">
                  <aside className="interaction-facts-panel overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label="Thông tin phản ánh">
                    <div className="border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Thông tin phản ánh</h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Thông tin gốc dùng để đối chiếu.</p>
                    </div>
                    <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        [Lucide.UserRound, 'Người gửi', feedback.userName || 'Không xác định'],
                        [Lucide.Clock3, 'Thời điểm gửi', formatDateTime(feedback.createdAt)],
                        [Lucide.MapPinned, 'Phường / khu vực', feedback.areaName || 'Chưa xác định'],
                        [Lucide.Tags, 'Danh mục', feedback.categoryName || 'Chưa phân loại'],
                      ].map(([Icon, label, value]) => (
                        <div key={label} className="flex gap-3 px-4 py-3.5">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                            <Icon size={14} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
                            <dd className="mt-1 break-words text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">{value}</dd>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-3 px-4 py-3.5">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                          <Lucide.Navigation size={14} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Vị trí</dt>
                          <dd className="mt-1 break-words text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">
                            <address className="not-italic">{resolvedLocationText}</address>
                          </dd>
                        </div>
                      </div>
                      <div className="flex gap-3 px-4 py-3.5">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                          <Lucide.Hash size={14} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Mã phản ánh</dt>
                          <dd className="mt-1">
                            <code className="break-all text-[11px] font-semibold leading-5 text-blue-700 dark:text-blue-300">
                              {feedback.feedbackId}
                            </code>
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </aside>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Mô tả
                  </p>
                  <p className="whitespace-pre-wrap text-base leading-7 text-slate-800 dark:text-slate-100">
                    {feedback.description || 'Không có mô tả chi tiết.'}
                  </p>
                </div>

                {beforeImages.length > 0 ? (
                  <section aria-labelledby="feedback-images-title">
                    <h3 id="feedback-images-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hình ảnh người dân gửi</h3>
                    <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                      {beforeImages.map((image, index) => (
                        <li key={`${image}-${index}`}>
                          <button
                            type="button"
                            onClick={() => openEvidenceViewer(
                              beforeImages.map((url, imageIndex) => ({
                                url,
                                name: `Hình ảnh người dân gửi ${imageIndex + 1}`,
                              })),
                              index
                            )}
                            className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/30"
                            aria-label={`Xem hình ảnh phản ánh ${index + 1}`}
                          >
                            <img
                              src={image}
                              alt={`Hình ảnh phản ánh ${index + 1}`}
                              className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.015]"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}

            {!isInteractionView ? (
              <dl className="grid gap-x-8 gap-y-5 border-t border-slate-200 pt-5 sm:grid-cols-2 dark:border-slate-800">
                <MetaItem label="Người gửi">{feedback.userName || 'Không xác định'}</MetaItem>
                <MetaItem label="Thời điểm gửi">{formatDateTime(feedback.createdAt)}</MetaItem>
                <MetaItem label="Khu vực">{feedback.areaName || 'Chưa xác định'}</MetaItem>
                <MetaItem label="Danh mục">{feedback.categoryName || 'Chưa phân loại'}</MetaItem>
                <MetaItem label="Vị trí" wide>
                  <address className="not-italic">{resolvedLocationText}</address>
                  {feedback.areaName ? (
                    <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{feedback.areaName}</span>
                  ) : null}
                </MetaItem>
                <MetaItem label="Mã phản ánh" wide><code className="break-all text-xs text-blue-700 dark:text-blue-300">{feedback.feedbackId}</code></MetaItem>
              </dl>
            ) : null}
          </section>
        </article>

        {isInteractionView && hasCoordinates ? (
          <section className="admin-panel overflow-hidden" aria-labelledby="interaction-location-section">
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    <Lucide.MapPinned size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="interaction-location-section" className="text-base font-semibold text-slate-950 dark:text-slate-100">Vị trí phản ánh</h2>
                    <p className="mt-1 break-words text-sm font-medium text-slate-700 dark:text-slate-300">
                      {resolvedLocationText}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {feedback.areaName || feedback.wardName || 'Chưa xác định khu vực'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openLocationOnMap}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-blue-500/10"
                >
                  Mở bản đồ lớn
                  <Lucide.ArrowUpRight size={13} aria-hidden="true" />
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <FeedbackLocationMapCard
                  feedbackId={feedback.feedbackId}
                  latitude={feedback.latitude}
                  longitude={feedback.longitude}
                  locationText={resolvedLocationText}
                  areaName={feedback.areaName || feedback.wardName}
                  variant="admin"
                  compact
                  showHeader={false}
                  bare
                  returnTo={`${location.pathname}${location.search || ''}`}
                  returnLabel="Quay lại chi tiết phản ánh"
                  returnState={location.state || null}
                  className="h-full"
                />
              </div>
            </div>
          </section>
        ) : null}

        <aside className="space-y-6" aria-label="Tiến trình và quyết định">
          <section className="admin-panel overflow-hidden">
            <ManagerSectionHeader
              title={isInteractionView ? 'Tiến trình phản ánh' : 'Tiến trình xử lý'}
              description={
                isInteractionView
                  ? 'Theo dõi các mốc trạng thái đã phát sinh của phản ánh.'
                  : 'Chỉ hiển thị các mốc đã phát sinh.'
              }
              icon={Lucide.Workflow}
              actions={
                isInteractionView ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {timelineItems.length} mốc
                    </span>
                    {timelineItems.length > 6 ? (
                      <button
                        type="button"
                        onClick={() => setTimelineExpanded((value) => !value)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                      >
                        {timelineExpanded ? 'Thu gọn' : 'Xem toàn bộ'}
                        <Lucide.ChevronDown
                          size={13}
                          className={`transition-transform ${timelineExpanded ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </div>
                ) : null
              }
            />
            <ol
              className={
                isInteractionView
                  ? 'interaction-timeline-grid grid gap-0 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3'
                  : 'space-y-1 p-5 sm:p-6'
              }
            >
              {displayTimelineItems.map((entry) => {
                if (entry.type === 'gap') {
                  return (
                    <li key="timeline-gap" className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setTimelineExpanded(true)}
                        className="interaction-timeline-gap flex h-full min-h-[118px] w-full flex-col items-center justify-center gap-2 px-4 py-3.5 text-center"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          <Lucide.Ellipsis size={16} aria-hidden="true" />
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {entry.hiddenCount} mốc trung gian
                        </span>
                        <span className="text-[11px] text-blue-600 dark:text-blue-300">Bấm để xem toàn bộ</span>
                      </button>
                    </li>
                  );
                }

                const { item, originalIndex } = entry;
                const isCurrent = originalIndex === timelineItems.length - 1;
                return (
                  <li
                    key={`${item.status}-${item.changedAt || originalIndex}`}
                    className={
                      isInteractionView
                        ? 'min-w-0'
                        : 'relative flex gap-3 pb-4 last:pb-0'
                    }
                  >
                    {isInteractionView ? (
                      <article
                        className={`interaction-timeline-step relative h-full min-h-[118px] px-4 py-3.5 ${
                          isCurrent ? 'is-current' : ''
                        }`}
                      >
                        <header className="flex items-start gap-3">
                          <span
                            className={`relative z-10 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                              isCurrent
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                            }`}
                            aria-hidden="true"
                          >
                            {isCurrent ? <Lucide.Check size={13} /> : originalIndex + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                          </div>
                        </header>
                        {item.changedAt ? (
                          <time
                            className="mt-3 block pl-10 text-[11px] font-medium text-slate-400"
                            dateTime={item.changedAt}
                          >
                            {formatDateTime(item.changedAt)}
                          </time>
                        ) : null}
                      </article>
                    ) : (
                      <>
                        {originalIndex < timelineItems.length - 1 ? (
                          <span
                            className="absolute bottom-0 left-[7px] top-4 w-px bg-emerald-200 dark:bg-emerald-800"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span
                          className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                            isCurrent
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-emerald-500 bg-emerald-500'
                          }`}
                          aria-hidden="true"
                        />
                        <article className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 ${isCurrent ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                          {item.changedAt ? <time className="mt-1 block text-[11px] text-slate-400" dateTime={item.changedAt}>{formatDateTime(item.changedAt)}</time> : null}
                        </article>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

        </aside>
      </section>

      {hasProcessingData || isAwaitingApproval ? (
        <section className="admin-panel overflow-hidden" aria-labelledby="processing-result-title">
          <ManagerSectionHeader
            id="processing-result-title"
            title="Kết quả và đơn vị xử lý"
            description={
              secondaryLoading
                ? 'Đang bổ sung thông tin xử lý…'
                : 'Thông tin gần nhất phục vụ việc theo dõi hoặc ra quyết định.'
            }
            icon={Lucide.ClipboardCheck}
            actions={latestResolution ? (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                  Cập nhật gần nhất
                </p>
                <time
                  className="mt-1 block text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
                  dateTime={getResolutionDate(latestResolution) || undefined}
                >
                  {formatDateTime(getResolutionDate(latestResolution))}
                </time>
              </div>
            ) : null}
          />

          <section className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] sm:p-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">Kết quả mới nhất</h3>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[feedback.status] || STATUS_BADGE_CLASSES.SubmittedForApproval}`}>
                  {getStatusLabel(feedback.status)}
                </span>
              </header>

              {latestResolution ? (
                <div className="mt-5">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/55 p-4 dark:border-blue-500/20 dark:bg-blue-500/[0.07]">
                    <ResolutionField label="Tóm tắt kết quả" wide>{latestResolution.resolutionSummary}</ResolutionField>
                  </div>

                  <dl className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2">
                    <ResolutionField label="Hành động đã thực hiện">{latestResolution.actionTaken}</ResolutionField>
                    <ResolutionField label="Ghi chú kết quả">{latestResolution.resultNote}</ResolutionField>
                  </dl>

                  <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800">
                    <ResolutionField label="Người gửi kết quả">{latestResolution.createdByStaffUserName || 'Không xác định'}</ResolutionField>
                    <ResolutionField label="Mã kết quả xử lý">{latestResolution.providerReportId || 'Không liên kết'}</ResolutionField>
                  </dl>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Hồ sơ chưa có bản ghi kết quả xử lý. Chưa thể phê duyệt nếu thiếu nội dung này.
                </p>
              )}
            </article>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40" aria-label="Thông tin đơn vị xử lý">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Đơn vị phối hợp</h3>
              {providerReport ? (
                <dl className="mt-5 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <MetaItem label="Đơn vị">{providerReport.providerName || 'Chưa xác định'}</MetaItem>
                  </div>
                  <MetaItem label="Điều phối viên">{providerReport.coordinatorName || 'Chưa xác định'}</MetaItem>
                  <MetaItem label="Trạng thái kết quả xử lý">{getProviderReportStatusLabel(providerReport.reportStatus)}</MetaItem>
                  <MetaItem label="Thời điểm chuyển">{formatDateTime(providerReport.reportedAt)}</MetaItem>
                  {providerReport.reportNote ? <MetaItem label="Ghi chú phối hợp">{localizeOperationalNote(providerReport.reportNote)}</MetaItem> : null}
                </dl>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">Chưa có báo cáo xử lý được liên kết với phản ánh này.</p>
              )}
            </aside>
          </section>
        </section>
      ) : null}

      {hasImageComparison || documents.length > 0 ? (
        <section className="admin-panel overflow-hidden" aria-labelledby="processing-evidence-title">
          <ManagerSectionHeader
            id="processing-evidence-title"
            title="Bằng chứng hoàn thành"
            description="Đối chiếu tình trạng trước và sau xử lý, đồng thời kiểm tra toàn bộ tài liệu đơn vị xử lý đã gửi."
            icon={Lucide.Files}
          />

          <section className="grid items-stretch gap-5 p-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.45fr)] sm:p-6">
            <article className="flex min-h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="admin-mini-icon manager-detail-accent-icon shrink-0" aria-hidden="true"><Lucide.Images size={17} /></span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Đối chiếu hình ảnh</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">So sánh hình ảnh người dân gửi và hình ảnh hoàn thành sau xử lý.</p>
                  </div>
                </div>
              </header>

              <section className="grid flex-1 gap-5 p-5 md:grid-cols-2">
                <figure className="min-w-0">
                  <figcaption className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                    Trước xử lý
                  </figcaption>
                  <section className="mt-3 grid gap-3">
                    {beforeImages.length > 0 ? beforeImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => openEvidenceViewer(
                          [
                            ...beforeImages.map((url, imageIndex) => ({
                              url,
                              name: `Trước xử lý ${imageIndex + 1}`,
                            })),
                            ...afterImages.map((url, imageIndex) => ({
                              url,
                              name: `Sau xử lý ${imageIndex + 1}`,
                            })),
                          ],
                          index
                        )}
                        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                        aria-label={`Xem tình trạng trước xử lý ${index + 1}`}
                      >
                        <img
                          src={image}
                          alt={`Tình trạng trước xử lý ${index + 1}`}
                          className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                        <span className="pointer-events-none absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/55 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                          <Lucide.Expand size={15} aria-hidden="true" />
                        </span>
                      </button>
                    )) : (
                      <p className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Không có ảnh ban đầu.</p>
                    )}
                  </section>
                </figure>

                <figure className="min-w-0">
                  <figcaption className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Sau xử lý
                  </figcaption>
                  <section className="mt-3 grid gap-3">
                    {afterImages.length > 0 ? afterImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => openEvidenceViewer(
                          [
                            ...beforeImages.map((url, imageIndex) => ({
                              url,
                              name: `Trước xử lý ${imageIndex + 1}`,
                            })),
                            ...afterImages.map((url, imageIndex) => ({
                              url,
                              name: `Sau xử lý ${imageIndex + 1}`,
                            })),
                          ],
                          beforeImages.length + index
                        )}
                        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-slate-700 dark:bg-slate-950"
                        aria-label={`Xem bằng chứng sau xử lý ${index + 1}`}
                      >
                        <img
                          src={image}
                          alt={`Bằng chứng sau xử lý ${index + 1}`}
                          className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                        <span className="pointer-events-none absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/55 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                          <Lucide.Expand size={15} aria-hidden="true" />
                        </span>
                      </button>
                    )) : (
                      <p className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Chưa có ảnh hoàn thành.</p>
                    )}
                  </section>
                </figure>
              </section>
            </article>

            <article className="flex min-h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="admin-mini-icon manager-detail-accent-icon shrink-0" aria-hidden="true"><Lucide.Paperclip size={17} /></span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Tài liệu hoàn thành</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{documents.length} tài liệu do đơn vị xử lý gửi.</p>
                  </div>
                </div>
              </header>

              <div className="flex-1 p-5">
                {documents.length > 0 ? (
                  <ul className="space-y-3">
                    {documents.map((document, index) => (
                      <li key={document.completionDocumentId || document.fileUrl || index}>
                        <article className="p-4 transition hover:bg-blue-50/35 dark:hover:bg-blue-500/[0.05]">
                          <header className="flex items-start gap-3">
                            <span className="admin-mini-icon shrink-0" aria-hidden="true">
                              {isImageDocument(document) ? <Lucide.Image size={17} /> : <Lucide.FileText size={17} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <h4 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{getFileLabel(document, index)}</h4>
                              {document.description ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{document.description}</p> : null}
                            </span>
                          </header>
                          {document.fileUrl ? (
                            <footer className="mt-3 pl-11">
                              {isImageDocument(document) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const imageDocuments = documents.filter(isImageDocument);
                                    openEvidenceViewer(
                                      imageDocuments.map((item, imageIndex) => ({
                                        url: item.fileUrl,
                                        name: getFileLabel(item, imageIndex),
                                      })),
                                      imageDocuments.findIndex((item) => item.fileUrl === document.fileUrl)
                                    );
                                  }}
                                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
                                >
                                  <Lucide.Expand size={14} aria-hidden="true" />
                                  Xem hình ảnh
                                </button>
                              ) : (
                                <a
                                  href={document.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
                                >
                                  <Lucide.ExternalLink size={14} aria-hidden="true" />
                                  Mở tài liệu
                                </a>
                              )}
                            </footer>
                          ) : null}
                        </article>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Chưa có tài liệu hoàn thành.</p>
                )}
              </div>
            </article>
          </section>
        </section>
      ) : null}

      {olderResolutions.length > 0 ? (
        <details className="admin-panel overflow-hidden group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 sm:px-6">
            <span className="flex min-w-0 items-center gap-3">
              <span className="admin-mini-icon" aria-hidden="true"><Lucide.History size={17} /></span>
              <span>
                <strong className="block text-sm font-semibold text-slate-950 dark:text-white">Lịch sử kết quả trước đó</strong>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{olderResolutions.length} lần gửi cũ được giữ để truy vết.</span>
              </span>
            </span>
            <Lucide.ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ol className="space-y-3 border-t border-slate-200 p-5 sm:p-6 dark:border-slate-800">
            {olderResolutions.map((resolution, index) => (
              <li key={resolution.resolutionId || index}>
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Lần gửi trước</h3>
                    <time className="text-xs text-slate-500" dateTime={getResolutionDate(resolution) || undefined}>{formatDateTime(getResolutionDate(resolution))}</time>
                  </header>
                  <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <ResolutionField label="Tóm tắt" wide>{resolution.resolutionSummary}</ResolutionField>
                    <ResolutionField label="Hành động">{resolution.actionTaken}</ResolutionField>
                    <ResolutionField label="Ghi chú">{resolution.resultNote}</ResolutionField>
                  </dl>
                </article>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {isAwaitingApproval ? (
        <section className="sticky bottom-4 z-30" aria-label="Quyết định duyệt nhanh">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-blue-200 bg-white/95 p-3 shadow-[0_16px_45px_rgba(15,23,42,0.18)] backdrop-blur dark:border-blue-900/60 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" aria-hidden="true">
                <Lucide.Gavel size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Quyết định duyệt</h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Sau khi đối chiếu kết quả và bằng chứng, chọn duyệt hoặc yêu cầu đơn vị xử lý làm lại.</p>
              </div>
            </div>

            <div className="grid shrink-0 gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setConfirmingAction('rework')} disabled={submitting} className="btn admin-secondary-action rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50">
                <Lucide.RotateCcw size={16} aria-hidden="true" />
                Yêu cầu làm lại
              </button>
              <button type="button" onClick={() => setConfirmingAction('approve')} disabled={submitting} className="btn admin-primary-action rounded-xl">
                <Lucide.CheckCircle2 size={16} aria-hidden="true" />
                Duyệt kết quả
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {selectedEvidence && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black"
              role="dialog"
              aria-modal="true"
              aria-label={`Xem minh chứng ${selectedEvidence.index + 1}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedEvidence(null);
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent px-4 pb-16 pt-4 sm:px-6">
                <p className="text-sm font-semibold text-white">
                  {selectedEvidence.items[selectedEvidence.index]?.name || 'Minh chứng phản ánh'}
                </p>
                <p className="mt-1 text-xs text-white/65">
                  {selectedEvidence.index + 1} / {selectedEvidence.items.length}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="absolute right-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:right-6"
                aria-label="Đóng xem trước"
              >
                <Lucide.X size={21} aria-hidden="true" />
              </button>

              <div className="flex h-full w-full items-center justify-center px-4 py-4 sm:px-20 sm:py-6">
                <img
                  src={selectedEvidence.items[selectedEvidence.index]?.url}
                  alt={selectedEvidence.items[selectedEvidence.index]?.name || `Minh chứng ${selectedEvidence.index + 1}`}
                  className="max-h-full max-w-full select-none object-contain"
                  draggable="false"
                />
              </div>

              {selectedEvidence.items.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedEvidence((current) => ({
                      ...current,
                      index: (current.index - 1 + current.items.length) % current.items.length,
                    }))}
                    className="absolute left-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:left-6 sm:h-14 sm:w-14"
                    aria-label="Xem ảnh trước"
                  >
                    <Lucide.ChevronLeft size={28} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEvidence((current) => ({
                      ...current,
                      index: (current.index + 1) % current.items.length,
                    }))}
                    className="absolute right-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:right-6 sm:h-14 sm:w-14"
                    aria-label="Xem ảnh tiếp theo"
                  >
                    <Lucide.ChevronRight size={28} aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}

      {slaModal && slaModalConfig && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeSlaModal();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="sla-action-dialog-title"
              className="w-full max-w-xl overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <header className="flex items-start gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${slaModalConfig.iconClass}`} aria-hidden="true">
                  {slaModal === 'pause' ? <Lucide.PauseCircle size={21} /> : null}
                  {slaModal === 'resume' ? <Lucide.PlayCircle size={21} /> : null}
                  {slaModal === 'cancel' ? <Lucide.XCircle size={21} /> : null}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 id="sla-action-dialog-title" className="text-xl font-semibold text-slate-950 dark:text-white">
                        {slaModalConfig.title}
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {slaModalConfig.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={closeSlaModal}
                      disabled={Boolean(slaActionLoading)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
                      aria-label="Đóng"
                    >
                      <Lucide.X size={19} />
                    </button>
                  </div>
                </div>
              </header>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmitSlaModal();
                }}
              >
                <div className="space-y-5 px-6 py-5">
                  {slaModal === 'pause' ? (
                    <div className="relative">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Lý do tạm dừng <span className="text-rose-600">*</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setPauseReasonOpen((current) => !current)}
                        className={`mt-2 flex h-12 w-full items-center justify-between rounded-2xl border bg-white px-4 text-left text-sm font-medium transition dark:bg-slate-950 ${
                          pauseReasonOpen
                            ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/40'
                            : 'border-slate-300 hover:border-slate-400 dark:border-slate-700'
                        }`}
                        aria-haspopup="listbox"
                        aria-expanded={pauseReasonOpen}
                      >
                        <span className="truncate text-slate-800 dark:text-slate-100">
                          {SLA_PAUSE_REASONS.find((reason) => reason.value === slaModalForm.reasonCode)?.label || 'Chọn lý do tạm dừng'}
                        </span>
                        <Lucide.ChevronDown
                          size={17}
                          className={`shrink-0 text-slate-400 transition-transform ${pauseReasonOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {pauseReasonOpen ? (
                        <div
                          className="absolute left-0 right-0 top-full z-[10010] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                          role="listbox"
                        >
                          {SLA_PAUSE_REASONS.map((reason) => {
                            const selected = reason.value === slaModalForm.reasonCode;
                            return (
                              <button
                                key={reason.value}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                  setSlaModalForm((current) => ({
                                    ...current,
                                    reasonCode: reason.value,
                                  }));
                                  setPauseReasonOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                  selected
                                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span>{reason.label}</span>
                                {selected ? <Lucide.Check size={16} /> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {slaModal === 'cancel' ? 'Lý do hủy' : 'Ghi chú'}
                      {slaModal === 'cancel' ? <span className="text-rose-600"> *</span> : null}
                    </span>

                    <textarea
                      rows="4"
                      value={slaModalForm.note}
                      onChange={(event) => setSlaModalForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))}
                      placeholder={
                        slaModal === 'pause'
                          ? 'Nhập ghi chú chi tiết nếu cần...'
                          : slaModal === 'resume'
                            ? 'Nhập ghi chú khi tiếp tục nếu cần...'
                            : 'Nhập lý do hủy SLA...'
                      }
                      className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-900/40"
                      required={slaModal === 'cancel'}
                    />
                  </label>

                  {slaModal === 'cancel' ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
                      <Lucide.TriangleAlert size={18} className="mt-0.5 shrink-0" />
                      <p className="text-sm leading-6">
                        Sau khi xác nhận, SLA hiện tại sẽ chuyển sang trạng thái hủy.
                      </p>
                    </div>
                  ) : null}
                </div>

                <footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <button
                    type="button"
                    onClick={closeSlaModal}
                    disabled={Boolean(slaActionLoading)}
                    className="btn admin-secondary-action rounded-2xl"
                  >
                    Đóng
                  </button>

                  <button
                    type="submit"
                    disabled={Boolean(slaActionLoading)}
                    className={slaModalConfig.confirmClass}
                  >
                    {slaActionLoading ? <span className="loading loading-spinner loading-sm" /> : null}
                    {slaModalConfig.confirmLabel}
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body
        )
        : null}

      {isAwaitingApproval && confirmingAction && typeof document !== 'undefined'
        ? createPortal(
          <div className="fixed inset-0 z-[10030] flex items-center justify-center p-4 sm:p-6" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
              aria-label="Đóng hộp thoại"
              onClick={() => !submitting && setConfirmingAction(null)}
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="approval-dialog-title"
              className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${confirmingAction === 'approve' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`} aria-hidden="true">
                    {confirmingAction === 'approve' ? <Lucide.BadgeCheck size={20} /> : <Lucide.RotateCcw size={20} />}
                  </span>
                  <div>
                    <h2 id="approval-dialog-title" className="text-lg font-semibold text-slate-950 dark:text-white">
                      {confirmingAction === 'approve' ? 'Xác nhận duyệt kết quả' : 'Yêu cầu đơn vị xử lý làm lại'}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {confirmingAction === 'approve'
                        ? 'Xác nhận kết quả sau khi đã kiểm tra nội dung xử lý, hình ảnh và tài liệu hoàn thành.'
                        : 'Nêu rõ nội dung cần bổ sung hoặc chỉnh sửa. Lý do này sẽ được gửi lại cho đơn vị xử lý.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmingAction(null)}
                  disabled={submitting}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Đóng"
                >
                  <Lucide.X size={18} />
                </button>
              </header>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleDecision(confirmingAction);
                }}
              >
                <div className="space-y-5 px-6 py-5">
                  {confirmingAction === 'approve' ? (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ghi chú quyết định <span className="font-normal text-slate-400">(không bắt buộc)</span></span>
                      <textarea
                        rows="4"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Nhập ghi chú kèm quyết định nếu cần..."
                        className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-900/40"
                      />
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lý do làm lại <span className="text-rose-600">*</span></span>
                      <textarea
                        rows="4"
                        value={reworkReason}
                        onChange={(event) => setReworkReason(event.target.value)}
                        placeholder="Ví dụ: thiếu ảnh hoàn thành, mô tả kết quả chưa rõ..."
                        className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-amber-900/40"
                        required
                        autoFocus
                      />
                    </label>
                  )}

                  <div className={`flex items-start gap-3 rounded-2xl border p-4 ${confirmingAction === 'approve' ? 'border-blue-100 bg-blue-50/70 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200'}`}>
                    {confirmingAction === 'approve' ? <Lucide.Info size={18} className="mt-0.5 shrink-0" /> : <Lucide.TriangleAlert size={18} className="mt-0.5 shrink-0" />}
                    <p className="text-sm leading-6">
                      {confirmingAction === 'approve'
                        ? 'Sau khi duyệt, hồ sơ chuyển sang trạng thái đã duyệt và người dân có thể tiếp tục bước đánh giá/đóng phản ánh theo quy trình.'
                        : 'SLA tiếp tục được theo dõi trong thời gian đơn vị xử lý bổ sung và gửi lại kết quả.'}
                    </p>
                  </div>
                </div>

                <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/30 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setConfirmingAction(null)} className="btn admin-secondary-action rounded-2xl" disabled={submitting}>Hủy</button>
                  <button type="submit" className={`btn rounded-2xl text-white ${confirmingAction === 'approve' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`} disabled={submitting}>
                    {submitting ? <span className="loading loading-spinner loading-sm" /> : null}
                    {confirmingAction === 'approve' ? 'Xác nhận duyệt' : 'Gửi yêu cầu làm lại'}
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body
        )
        : null}
    </article>
  );
};
