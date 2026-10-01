import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole } from '../../utils/roleMap';
import {
  getTimelinePresentation,
  isAdminIncidentReadOnly,
  localizeIncidentSystemText,
} from './adminIncidentReadOnly.mjs';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import { ManagerConfirmDialog, ManagerListRefreshIndicator, ManagerSectionHeader, ManagerSelectMenu, ManagerToast } from '../../components/manager/ManagerPageElements';
import IncidentLocationMapCard from '../../components/maps/IncidentLocationMapCard';
import { IncidentSlaSection } from '../../components/manager/IncidentSlaSection';
import { IncidentEvidenceComparison } from '../../components/manager/IncidentEvidenceComparison';
import {
  extractApiErrorMessage,
  managementFeedbackApi,
  incidentManagementApi,
} from '@urbanmind/shared-api';

const getPayload = (response) => response?.data ?? response ?? {};

const isActiveReportLink = (report) => {
  const status = normalizeKey(report?.linkStatus ?? report?.status ?? 'active');
  return !['unlinked', 'inactive', 'removed', 'deleted'].includes(status);
};

const getFeedbackIncidentId = (feedback) => feedback?.incidentId ?? feedback?.activeIncidentId ?? feedback?.incident?.incidentId ?? feedback?.incident?.id ?? '';

const hasActiveIncidentLink = (feedback) => {
  const incidentId = getFeedbackIncidentId(feedback);
  const linkStatus = normalizeKey(feedback?.incidentLinkStatus ?? feedback?.linkStatus ?? '');
  if (['unlinked', 'inactive', 'removed', 'deleted'].includes(linkStatus)) return false;
  if (incidentId) return true;
  return ['active', 'linked'].includes(linkStatus);
};

const MERGE_LOCKED_STATUS_KEYS = new Set([
  'assigned', 'inprogress', 'submittedforapproval', 'approved', 'needrework',
  'resolved', 'closed', 'cancelled', 'canceled', 'merged',
]);

const hasIncidentStaffAssignment = (item) => Boolean(
  item?.assignedStaffUserId ?? item?.assignedStaffId ?? item?.assigneeUserId ?? item?.assigneeId
);

const isIncidentPastMergeStage = (item) => {
  if (!item) return false;
  return hasIncidentStaffAssignment(item) || MERGE_LOCKED_STATUS_KEYS.has(normalizeKey(item?.status));
};

const isImageAttachment = (attachment) => {
  const url = String(attachment?.fileUrl ?? attachment?.url ?? '').trim();
  const fileType = String(attachment?.fileType ?? attachment?.mimeType ?? '').toLowerCase();
  if (!url) return false;
  if (fileType.startsWith('image/')) return true;
  return /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url);
};

const getAttachmentUrl = (attachment) => String(attachment?.fileUrl ?? attachment?.url ?? '').trim();
const normalizeKey = (value) => String(value ?? '').replace(/[-_\s]/g, '').toLowerCase();

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

const LEVEL_LABELS = {
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  moderate: 'Trung bình',
  normal: 'Bình thường',
  low: 'Thấp',
  none: 'Chưa đặt',
  unset: 'Chưa đặt',
};

const LINK_ROLE_LABELS = {
  primary: 'Phản ánh chính',
  secondary: 'Phản ánh liên quan',
  related: 'Phản ánh liên quan',
  duplicate: 'Phản ánh trùng',
};

const LINK_METHOD_LABELS = {
  created: 'Tạo cùng sự vụ',
  staffconfirmed: 'Quản lý xác nhận',
  aiproposed: 'AI đề xuất',
  automatic: 'Tự động',
  manual: 'Thủ công',
  backfill: 'Liên kết bổ sung',
};

const EVENT_LABELS = {
  incidentcreated: 'Đã tạo sự vụ',
  incidentupdated: 'Đã cập nhật sự vụ',
  incidentstatuschanged: 'Đã thay đổi trạng thái',
  statuschanged: 'Đã thay đổi trạng thái',
  reportlinked: 'Đã liên kết phản ánh',
  reportunlinked: 'Đã gỡ liên kết phản ánh',
  incidentassigned: 'Đã phân công xử lý',
  assigned: 'Đã phân công xử lý',
  incidentmerged: 'Đã gộp sự vụ',
  merged: 'Đã gộp sự vụ',
  prioritychanged: 'Đã thay đổi độ ưu tiên',
  severitychanged: 'Đã thay đổi mức nghiêm trọng',
  subscriberadded: 'Có người theo dõi mới',
  subscriberremoved: 'Đã ngừng theo dõi sự vụ',
};

const CHANNEL_LABELS = {
  web: 'Trang web',
  mobile: 'Ứng dụng di động',
  app: 'Ứng dụng di động',
  messenger: 'Messenger',
  facebook: 'Facebook',
  citizen: 'Người dân',
  resident: 'Người dân',
  staff: 'Nhân viên',
  system: 'Hệ thống',
  phone: 'Điện thoại',
  hotline: 'Đường dây nóng',
  email: 'Email',
  api: 'Tích hợp hệ thống',
  import: 'Nhập dữ liệu',
  manual: 'Nhập thủ công',
};

// Endpoint đổi trạng thái Incident dùng vòng đời xử lý sự vụ; chỉ cho chọn
// các trạng thái nghiệp vụ mà endpoint status của Incident chấp nhận.
const INCIDENT_STATUS_ACTION_OPTIONS = [
  ['Open', 'Đang mở'],
  ['Pending', 'Chờ xử lý'],
  ['Assigned', 'Đã phân công'],
  ['InProgress', 'Đang xử lý'],
  ['Resolved', 'Đã xử lý'],
  ['Closed', 'Đã đóng'],
];

const PRIORITY_OPTIONS = [
  ['Low', 'Thấp'], ['Medium', 'Trung bình'], ['High', 'Cao'], ['Urgent', 'Khẩn cấp'],
];

const SEVERITY_OPTIONS = [
  ['Low', 'Thấp'], ['Medium', 'Trung bình'], ['High', 'Cao'], ['Critical', 'Khẩn cấp'],
];

const CANDIDATE_PAGE_SIZE = 100;

const TAB_ITEMS = [
  { id: 'reports', label: 'Phản ánh', icon: Lucide.MessagesSquare },
  { id: 'subscribers', label: 'Người theo dõi', icon: Lucide.Users },
  { id: 'events', label: 'Lịch sử hoạt động', icon: Lucide.History },
];

const getLevelLabel = (value) => {
  if (!value) return 'Chưa đặt';
  return LEVEL_LABELS[normalizeKey(value)] || 'Chưa xác định';
};

const getLinkRoleLabel = (value) => {
  if (!value) return 'Phản ánh liên quan';
  return LINK_ROLE_LABELS[normalizeKey(value)] || 'Phản ánh liên quan';
};

const isPrimaryReportLink = (report) => {
  const linkRole = report?.linkRole ?? report?.role ?? report?.relationType;
  return normalizeKey(linkRole) === 'primary';
};

const getLinkMethodLabel = (value) => {
  if (!value) return '—';
  return LINK_METHOD_LABELS[normalizeKey(value)] || 'Khác';
};

const getReportLinkMethodLabel = (report) => {
  const value = report?.linkMethod ?? report?.method;
  if (!value) return '';
  if (normalizeKey(value) === 'backfill' && isPrimaryReportLink(report)) return 'Tạo cùng sự vụ';
  return getLinkMethodLabel(value);
};

const INCIDENT_API_ERROR_TRANSLATIONS = [
  {
    match: 'incident can only be merged before staff assignment and provider processing',
    text: 'Chỉ có thể gộp sự vụ trước khi phân công nhân viên và bắt đầu xử lý với đơn vị cung cấp dịch vụ.',
  },
  {
    match: 'duplicate reports can only be merged before staff assignment and provider processing',
    text: 'Chỉ có thể xử lý phản ánh trùng trước khi phân công nhân viên và bắt đầu xử lý với đơn vị cung cấp dịch vụ.',
  },
];

const localizeIncidentApiError = (value, fallback) => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().replace(/[.!?]+$/g, '').trim();
  const translated = INCIDENT_API_ERROR_TRANSLATIONS.find(({ match }) => normalized.includes(match));
  if (translated) return translated.text;
  return raw;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};

const formatIncidentId = (incidentId) => {
  if (!incidentId) return '—';
  const value = String(incidentId);
  const suffix = value.split('-').pop() || value;
  return `INC-${suffix.slice(0, 8).toUpperCase()}`;
};

const formatConfidence = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
};

const normalizeCollection = (response) => {
  const payload = getPayload(response);
  const nested = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  if (Array.isArray(nested)) return nested;
  if (Array.isArray(nested?.items)) return nested.items;
  if (Array.isArray(nested?.records)) return nested.records;
  if (Array.isArray(nested?.events)) return nested.events;
  if (Array.isArray(nested?.subscribers)) return nested.subscribers;
  if (Array.isArray(nested?.candidates)) return nested.candidates;
  if (Array.isArray(nested?.assigneeCandidates)) return nested.assigneeCandidates;
  if (Array.isArray(nested?.incidents)) return nested.incidents;
  return [];
};

const getFeedbackId = (report) => report?.feedbackId ?? report?.feedback?.feedbackId ?? report?.feedback?.id ?? report?.id ?? '';
const getFeedbackTitle = (report) => report?.title ?? report?.feedback?.title ?? report?.feedbackTitle ?? 'Phản ánh';
const getFeedbackReporter = (report) => report?.reporterName ?? report?.userName ?? report?.feedback?.reporterName ?? report?.feedback?.userName ?? 'Chưa có thông tin';
const getFeedbackStatus = (report) => report?.feedbackStatus ?? report?.status ?? report?.feedback?.feedbackStatus ?? report?.feedback?.status ?? '';
const getFeedbackChannel = (report) => {
  const value = report?.submissionChannel ?? report?.channel ?? report?.source ?? report?.feedback?.submissionChannel ?? report?.feedback?.channel ?? report?.feedback?.source;
  if (!value) return '';
  return CHANNEL_LABELS[normalizeKey(value)] || 'Kênh khác';
};

const getEventLabel = (value) => {
  if (!value) return 'Cập nhật sự vụ';
  return EVENT_LABELS[normalizeKey(value)] || 'Cập nhật sự vụ';
};

const parseEventPayload = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getStatusLabel = (value) => {
  if (!value) return 'Chưa xác định';
  return STATUS_META[normalizeKey(value)]?.label || 'Chưa xác định';
};

const getEventDetails = (event) => {
  const eventType = normalizeKey(event?.eventType ?? event?.type ?? event?.action);
  const payload = parseEventPayload(event?.payloadJson ?? event?.payload);
  const details = [];

  if (eventType === 'statuschanged' || eventType === 'incidentstatuschanged') {
    const oldStatus = getStatusLabel(payload.oldStatus);
    const newStatus = getStatusLabel(payload.newStatus);
    if (payload.oldStatus || payload.newStatus) {
      details.push({
        label: oldStatus === newStatus ? 'Trạng thái' : 'Thay đổi',
        value: oldStatus === newStatus ? newStatus : `${oldStatus} → ${newStatus}`,
      });
    }
    const note = localizeIncidentSystemText(payload.note);
    if (note) details.push({ label: 'Ghi chú', value: note });
  } else if (eventType === 'reportlinked' || eventType === 'reportunlinked') {
    if (payload.role) details.push({ label: 'Vai trò', value: getLinkRoleLabel(payload.role) });
    if (payload.method) details.push({ label: 'Cách liên kết', value: getLinkMethodLabel(payload.method) });
  } else if (eventType === 'prioritychanged') {
    if (payload.oldPriority || payload.newPriority) {
      details.push({ label: 'Thay đổi', value: `${getLevelLabel(payload.oldPriority)} → ${getLevelLabel(payload.newPriority)}` });
    }
  } else if (eventType === 'severitychanged') {
    if (payload.oldSeverity || payload.newSeverity) {
      details.push({ label: 'Thay đổi', value: `${getLevelLabel(payload.oldSeverity)} → ${getLevelLabel(payload.newSeverity)}` });
    }
  } else if (eventType === 'incidentassigned' || eventType === 'assigned') {
    const staffName =
      payload.staffName ??
      payload.assigneeName ??
      payload.assignedStaffName ??
      payload.userName ??
      payload.staffUserName;

    const staffId =
      payload.staffId ??
      payload.assigneeId ??
      payload.assignedStaffUserId ??
      payload.userId;

    if (staffName) details.push({ label: 'Người phụ trách', value: String(staffName) });
    else if (staffId) details.push({ label: 'Người phụ trách', value: String(staffId) });

    const note = localizeIncidentSystemText(payload.note);
    if (note) details.push({ label: 'Ghi chú', value: note });
  } else if (eventType === 'incidentcreated' && (payload.feedbackId || event?.feedbackId)) {
    details.push({ label: 'Nguồn', value: 'Tạo từ phản ánh liên quan' });
  }

  return details;
};

const getCandidateId = (candidate) => candidate?.staffId ?? candidate?.assigneeId ?? candidate?.userId ?? candidate?.id ?? '';
const getCandidateName = (candidate) => candidate?.fullName ?? candidate?.staffName ?? candidate?.name ?? candidate?.userName ?? candidate?.displayName ?? 'Nhân viên';

const getIncidentAssigneeId = (incident) => (
  incident?.assignedStaffUserId ??
  incident?.assignedStaffId ??
  incident?.assigneeUserId ??
  incident?.assigneeId ??
  incident?.assignedStaff?.userId ??
  incident?.assignedStaff?.staffId ??
  incident?.assignee?.userId ??
  incident?.assignee?.id ??
  ''
);

const getIncidentAssigneeName = (incident) => (
  incident?.assignedStaffName ??
  incident?.assigneeName ??
  incident?.assignedStaff?.fullName ??
  incident?.assignedStaff?.name ??
  incident?.assignee?.fullName ??
  incident?.assignee?.name ??
  ''
);

const getCandidateWorkload = (candidate) => {
  const value =
    candidate?.activeIncidentCount ??
    candidate?.currentIncidentCount ??
    candidate?.assignedIncidentCount ??
    candidate?.workloadCount ??
    candidate?.openIncidentCount;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const Badge = ({ value, type }) => {
  const source = type === 'priority' ? PRIORITY_META : STATUS_META;
  const meta = source[normalizeKey(value)] || {
    label: 'Chưa xác định',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
};


const LinkFilterDropdown = ({ value, options, onChange, icon: Icon, ariaLabel }) => {
  const detailsRef = useRef(null);
  const selected = options.find(([optionValue]) => String(optionValue) === String(value)) ?? options[0];

  useEffect(() => {
    const handlePointerDown = (event) => {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target)) return;
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
      <summary
        aria-label={ariaLabel}
        className="flex h-10 min-w-0 cursor-pointer list-none items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 [&::-webkit-details-marker]:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Icon size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{selected?.[1] ?? ariaLabel}</span>
        <Lucide.ChevronDown size={15} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="absolute left-0 top-[calc(100%+8px)] z-[120] w-full min-w-[210px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900">
        <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
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
                {isSelected ? <Lucide.Check size={15} className="shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
};


const GalleryPreview = ({ item, onOpen }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:border-slate-800 dark:bg-slate-900"
    >
      {!loaded ? <span className="absolute inset-0 animate-pulse bg-slate-100 dark:bg-slate-900" aria-hidden="true" /> : null}
      <img
        src={item.url}
        alt={`Hình ảnh từ ${item.title}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`h-full w-full object-cover transition duration-200 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      <span className="absolute inset-x-2 bottom-2 rounded-xl bg-slate-950/72 px-2.5 py-2 text-[11px] font-semibold text-white backdrop-blur-sm">
        <span className="block truncate">{item.title}</span>
        <span className="mt-0.5 block text-[10px] font-medium text-white/75">{item.isPrimary ? 'Phản ánh chính' : `Phản ánh ${String(item.feedbackId).slice(0, 8)}`}</span>
      </span>
    </button>
  );
};

const InfoItem = ({ label, value, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
    <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">{label}</p>
    <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{children ?? value ?? '—'}</div>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
      <Icon size={23} />
    </span>
    <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
    {description ? <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
  </div>
);

const PanelSkeleton = () => (
  <div className="space-y-3 p-5 sm:p-6">
    {Array.from({ length: 4 }, (_, index) => (
      <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
    ))}
  </div>
);

export const IncidentDetailPage = () => {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentRole = normalizeRole(user?.role ?? user?.roleName ?? user?.roles?.[0]);
  const adminReadOnly = isAdminIncidentReadOnly(currentRole);
  const requestIdRef = useRef(0);
  const resolutionRequestIdRef = useRef(0);
  const timelineRequestIdRef = useRef(0);
  const feedbackRequestIdRef = useRef(0);
  const mergeRequestIdRef = useRef(0);
  const reportDetailsRef = useRef({});

  const [incident, setIncident] = useState(() => location.state?.incident || null);
  const [loading, setLoading] = useState(() => !location.state?.incident);
  const [reportDetails, setReportDetails] = useState({});
  const [reportMediaLoading, setReportMediaLoading] = useState(false);
  const [reportMediaError, setReportMediaError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [detailResolved, setDetailResolved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('reports');

  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLoaded, setTimelineLoaded] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelineVisibleCount, setTimelineVisibleCount] = useState(6);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackAreaFilter, setFeedbackAreaFilter] = useState('');
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('');
  const [feedbackCandidates, setFeedbackCandidates] = useState([]);
  const [feedbackPageNumber, setFeedbackPageNumber] = useState(1);
  const [feedbackHasMore, setFeedbackHasMore] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [linkingFeedbackId, setLinkingFeedbackId] = useState('');
  const [unlinkingFeedbackId, setUnlinkingFeedbackId] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: '', severity: '' });
  const [statusValue, setStatusValue] = useState('');
  const [assigneeCandidates, setAssigneeCandidates] = useState([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [mergePageNumber, setMergePageNumber] = useState(1);
  const [mergeHasMore, setMergeHasMore] = useState(false);
  const [mergeMode, setMergeMode] = useState('into-current');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeLoadingMore, setMergeLoadingMore] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeSameAreaOnly, setMergeSameAreaOnly] = useState(false);
  const [mergeSameCategoryOnly, setMergeSameCategoryOnly] = useState(false);
  const [selectedMergeIncidentId, setSelectedMergeIncidentId] = useState('');
  const [selectedMergeIncidentIds, setSelectedMergeIncidentIds] = useState([]);
  const [mergeReason, setMergeReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [approvalDecision, setApprovalDecision] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalResolution, setApprovalResolution] = useState(null);
  const [approvalResolutionLoading, setApprovalResolutionLoading] = useState(false);
  const [approvalResolutionError, setApprovalResolutionError] = useState('');

  const isApprovalView = location.pathname.startsWith('/manager/approvals/');
  const anyModalOpen = linkModalOpen || editModalOpen || statusModalOpen || assignModalOpen || mergeModalOpen || Boolean(confirmAction) || Boolean(approvalDecision);

  useEffect(() => {
    if (!anyModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [anyModalOpen]);

  const loadIncident = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (background) {
      setRefreshing(true);
      setRefreshError('');
    } else {
      setLoading(true);
      setError('');
    }
    try {
      const response = await incidentManagementApi.getIncidentById(incidentId);
      if (requestId !== requestIdRef.current) return;
      const payload = getPayload(response);
      const detail = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
      setIncident((current) => ({ ...(current || {}), ...(detail || {}) }));
      setDetailResolved(true);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      const message = extractApiErrorMessage(loadError, 'Không thể tải chi tiết sự vụ.');
      if (background) setRefreshError(message);
      else setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [incidentId]);

  useEffect(() => {
    loadIncident({ background: Boolean(location.state?.incident) });
    return () => { requestIdRef.current += 1; };
  }, [loadIncident, location.state?.incident]);

  /*
   * Kết quả xử lý được nạp ở cả trang chi tiết sự vụ lẫn màn duyệt. Sau khi
   * duyệt xong, sự vụ rời hàng đợi duyệt nên chỉ còn mở được từ danh sách sự
   * vụ; nếu chỉ nạp ở màn duyệt thì từ đó về sau không xem lại được ảnh hoàn
   * thành nữa.
   */
  const loadApprovalResolution = useCallback(async () => {
    const requestId = ++resolutionRequestIdRef.current;
    setApprovalResolutionLoading(true);
    setApprovalResolutionError('');
    try {
      const resolution = await incidentManagementApi.getLatestIncidentResolution(incidentId);
      if (requestId !== resolutionRequestIdRef.current) return;
      setApprovalResolution(resolution && typeof resolution === 'object' ? resolution : null);
    } catch (resolutionError) {
      if (requestId !== resolutionRequestIdRef.current) return;
      setApprovalResolutionError(extractApiErrorMessage(resolutionError, 'Không thể tải kết quả xử lý cần duyệt.'));
    } finally {
      if (requestId === resolutionRequestIdRef.current) setApprovalResolutionLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void loadApprovalResolution();
    return () => { resolutionRequestIdRef.current += 1; };
  }, [loadApprovalResolution]);

  const goBack = useCallback(() => {
    const returnPath = location.state?.from;
    const canReturnInApp = typeof returnPath === 'string' && (
      returnPath.startsWith('/manager/incidents')
      || returnPath.startsWith('/management/incidents')
      || returnPath.startsWith('/manager/approvals')
      || returnPath.startsWith('/manager/incident-matches/')
      || returnPath.startsWith('/manager/duplicates/')
      || returnPath.startsWith('/staff/duplicates/')
      || returnPath.startsWith('/analytics/sla')
      || returnPath.startsWith('/analytics/sentiment')
      || returnPath === '/dashboard'
    );

    if (canReturnInApp) {
      navigate(-1);
      return;
    }

    const incidentBasePath = isApprovalView
      ? '/manager/approvals'
      : location.pathname.startsWith('/management/incidents')
        ? '/management/incidents'
        : '/manager/incidents';

    navigate(incidentBasePath, {
      state: { restoreIncidentId: incident?.incidentId ?? incident?.id ?? incidentId },
    });
  }, [incident, incidentId, isApprovalView, location.pathname, location.state?.from, navigate]);

  const backLabel = location.state?.from === '/dashboard'
    ? 'Quay lại Tổng quan hệ thống'
    : typeof location.state?.from === 'string' && location.state.from.startsWith('/analytics/sla')
      ? 'Quay lại Phân tích SLA'
      : typeof location.state?.from === 'string' && location.state.from.startsWith('/analytics/sentiment')
        ? 'Quay lại Cảm xúc người dân'
        : 'Quay lại danh sách';

  const reports = useMemo(() => {
    if (Array.isArray(incident?.reports)) return incident.reports;
    if (Array.isArray(incident?.relatedReports)) return incident.relatedReports;
    return [];
  }, [incident]);

  const subscribers = useMemo(() => {
    if (Array.isArray(incident?.subscribers)) return incident.subscribers;
    if (Array.isArray(incident?.followers)) return incident.followers;
    return [];
  }, [incident]);

  const orderedReports = useMemo(() => reports
    .map((report, index) => ({ report, index }))
    .sort((left, right) => {
      const primaryDelta = Number(isPrimaryReportLink(right.report)) - Number(isPrimaryReportLink(left.report));
      return primaryDelta || left.index - right.index;
    })
    .map(({ report }) => report), [reports]);

  const activeReports = useMemo(() => orderedReports.filter(isActiveReportLink), [orderedReports]);
  const mapFocusFeedbackId = useMemo(() => {
    const primary = activeReports.find(isPrimaryReportLink);
    return getFeedbackId(primary || activeReports[0]) || null;
  }, [activeReports]);
  const linkedFeedbackIds = useMemo(() => new Set(
    activeReports.map((report) => String(getFeedbackId(report))).filter(Boolean)
  ), [activeReports]);
  const linkableFeedbackCandidates = useMemo(() => feedbackCandidates.filter((feedback) => {
    const feedbackId = String(getFeedbackId(feedback) ?? '');
    if (!feedbackId || linkedFeedbackIds.has(feedbackId)) return false;
    return !hasActiveIncidentLink(feedback);
  }), [feedbackCandidates, linkedFeedbackIds]);
  const feedbackFilterOptions = useMemo(() => {
    const areas = new Map();
    const categories = new Map();
    const statuses = new Map();

    linkableFeedbackCandidates.forEach((feedback) => {
      const areaValue = String(feedback?.areaId ?? feedback?.area?.areaId ?? feedback?.area?.id ?? feedback?.areaName ?? feedback?.wardName ?? '');
      const areaLabel = feedback?.areaName ?? feedback?.wardName ?? feedback?.area?.name ?? '';
      if (areaValue && areaLabel) areas.set(areaValue, areaLabel);

      const categoryValue = String(feedback?.categoryId ?? feedback?.category?.categoryId ?? feedback?.category?.id ?? feedback?.categoryName ?? '');
      const categoryLabel = feedback?.categoryName ?? feedback?.category?.name ?? '';
      if (categoryValue && categoryLabel) categories.set(categoryValue, categoryLabel);

      const statusValue = String(getFeedbackStatus(feedback) ?? '');
      if (statusValue) statuses.set(statusValue, STATUS_META[normalizeKey(statusValue)]?.label ?? statusValue);
    });

    return {
      areas: [...areas.entries()],
      categories: [...categories.entries()],
      statuses: [...statuses.entries()],
    };
  }, [linkableFeedbackCandidates]);
  const availableFeedbackCandidates = useMemo(() => linkableFeedbackCandidates.filter((feedback) => {
    const areaValue = String(feedback?.areaId ?? feedback?.area?.areaId ?? feedback?.area?.id ?? feedback?.areaName ?? feedback?.wardName ?? '');
    const categoryValue = String(feedback?.categoryId ?? feedback?.category?.categoryId ?? feedback?.category?.id ?? feedback?.categoryName ?? '');
    const statusValue = String(getFeedbackStatus(feedback) ?? '');

    if (feedbackAreaFilter && areaValue !== feedbackAreaFilter) return false;
    if (feedbackCategoryFilter && categoryValue !== feedbackCategoryFilter) return false;
    if (feedbackStatusFilter && normalizeKey(statusValue) !== normalizeKey(feedbackStatusFilter)) return false;
    return true;
  }), [feedbackAreaFilter, feedbackCategoryFilter, feedbackStatusFilter, linkableFeedbackCandidates]);
  const hasFeedbackFilters = Boolean(feedbackAreaFilter || feedbackCategoryFilter || feedbackStatusFilter);
  const reportGalleryItems = useMemo(() => activeReports.flatMap((report) => {
    const feedbackId = String(getFeedbackId(report) ?? '');
    const detail = reportDetails[feedbackId];
    const attachments = Array.isArray(detail?.attachments) ? detail.attachments : [];
    return attachments.filter(isImageAttachment).map((attachment) => ({
      url: getAttachmentUrl(attachment),
      feedbackId,
      title: detail?.title ?? report?.title ?? 'Phản ánh',
      isPrimary: isPrimaryReportLink(report),
    }));
  }).filter((item) => item.url), [activeReports, reportDetails]);

  const approvalDocuments = Array.isArray(approvalResolution?.completionDocuments) ? approvalResolution.completionDocuments : [];
  const approvalImageDocuments = approvalDocuments.filter((document) => isImageAttachment(document) && getAttachmentUrl(document));

  /*
   * Hai phía của khối đối chiếu lấy từ hai nguồn khác nhau: ảnh "trước" là do
   * người dân gửi kèm phản ánh, ảnh "sau" nằm trong minh chứng hoàn thành của
   * nhân viên. Số lượng hai bên thường lệch nhau nên không ghép cặp 1-1.
   */
  const comparisonBeforeItems = reportGalleryItems.map((item) => ({
    url: item.url,
    title: item.title,
    subtitle: item.isPrimary ? 'Phản ánh chính' : `Phản ánh ${String(item.feedbackId).slice(0, 8)}`,
  }));

  /*
   * Ảnh hoàn thành đã nằm trong khối đối chiếu nên khối tài liệu bên dưới chỉ
   * còn giữ những tệp không phải ảnh, tránh hiện cùng một ảnh hai lần.
   */
  const approvalFileDocuments = approvalDocuments.filter(
    (document) => !(isImageAttachment(document) && getAttachmentUrl(document)),
  );

  const comparisonAfterItems = approvalImageDocuments
    .map((document, index) => ({
      url: getAttachmentUrl(document),
      title: document?.description || `Minh chứng ${index + 1}`,
      subtitle: document?.uploadedByUserName || document?.providerName || 'Ảnh hoàn thành',
    }))
    .filter((item) => item.url);

  /*
   * Khối đối chiếu đã bao trọn cả ảnh trước lẫn ảnh sau, nên khi nó hiện thì
   * khối "Hình ảnh từ các phản ánh" bên dưới là thừa và phải ẩn đi.
   */
  const showEvidenceComparison = isApprovalView || comparisonAfterItems.length > 0;

  useEffect(() => {
    const ids = activeReports.map(getFeedbackId).filter(Boolean).map(String);
    if (ids.length === 0) {
      reportDetailsRef.current = {};
      setReportDetails({});
      setReportMediaLoading(false);
      setReportMediaError('');
      return undefined;
    }

    const activeIdSet = new Set(ids);
    const cachedDetails = Object.fromEntries(
      Object.entries(reportDetailsRef.current).filter(([feedbackId]) => activeIdSet.has(feedbackId))
    );
    reportDetailsRef.current = cachedDetails;
    setReportDetails(cachedDetails);

    const missingIds = ids.filter((feedbackId) => !cachedDetails[feedbackId]);
    if (missingIds.length === 0) {
      setReportMediaLoading(false);
      setReportMediaError('');
      return undefined;
    }

    let cancelled = false;
    setReportMediaLoading(true);
    setReportMediaError('');

    Promise.allSettled(missingIds.map(async (feedbackId) => {
      const detail = await managementFeedbackApi.getFeedbackById(feedbackId);
      return [String(feedbackId), detail];
    }))
      .then((results) => {
        if (cancelled) return;
        const nextDetails = { ...reportDetailsRef.current };
        let failedCount = 0;
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [feedbackId, detail] = result.value;
            nextDetails[feedbackId] = detail;
          } else {
            failedCount += 1;
          }
        });
        reportDetailsRef.current = nextDetails;
        setReportDetails(nextDetails);
        if (failedCount > 0) {
          setReportMediaError(`Không thể tải đầy đủ hình ảnh của ${failedCount} phản ánh.`);
        }
      })
      .finally(() => {
        if (!cancelled) setReportMediaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeReports]);

  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
        return;
      }
      if (reportGalleryItems.length <= 1) return;
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((current) => (current - 1 + reportGalleryItems.length) % reportGalleryItems.length);
      } else if (event.key === 'ArrowRight') {
        setLightboxIndex((current) => (current + 1) % reportGalleryItems.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, reportGalleryItems.length]);

  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex >= reportGalleryItems.length) {
      setLightboxIndex(reportGalleryItems.length > 0 ? reportGalleryItems.length - 1 : null);
    }
  }, [lightboxIndex, reportGalleryItems.length]);

  const incidentStatusKey = normalizeKey(incident?.status);
  const isMergedIncident = incidentStatusKey === 'merged';
  const isClosedIncident = incidentStatusKey === 'closed';
  const isAwaitingApproval = incidentStatusKey === 'submittedforapproval';
  const approvalResolutionId = Number(approvalResolution?.resolutionId);
  const hasApprovalResolution = Number.isSafeInteger(approvalResolutionId) && approvalResolutionId > 0;
  const approvalDecisionEnabled = isAwaitingApproval && hasApprovalResolution && !approvalResolutionLoading;
  const structureActionsLocked = isMergedIncident || isClosedIncident;
  const mutationActionsLocked = isMergedIncident;
  const mergeActionLocked = structureActionsLocked || isIncidentPastMergeStage(incident);

  const loadTimeline = useCallback(async () => {
    const requestId = ++timelineRequestIdRef.current;
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const firstResponse = await incidentManagementApi.getIncidentTimeline(incidentId, {
        pageNumber: 1,
        pageSize: 50,
      });
      if (requestId !== timelineRequestIdRef.current) return;

      const totalPages = Math.max(1, Number(firstResponse?.totalPages) || 1);
      const remainingResults = totalPages > 1
        ? await Promise.allSettled(
            Array.from({ length: totalPages - 1 }, (_, index) => (
              incidentManagementApi.getIncidentTimeline(incidentId, {
                pageNumber: index + 2,
                pageSize: 50,
              })
            )),
          )
        : [];
      if (requestId !== timelineRequestIdRef.current) return;

      const fulfilledResponses = remainingResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      const failedPageCount = remainingResults.length - fulfilledResponses.length;

      setTimeline([
        ...normalizeCollection(firstResponse),
        ...fulfilledResponses.flatMap(normalizeCollection),
      ]);
      setTimelineVisibleCount(6);
      setTimelineLoaded(true);
      if (failedPageCount > 0) {
        setTimelineError(`Không thể tải đầy đủ ${failedPageCount} trang lịch sử. Các sự kiện đã tải vẫn được giữ lại.`);
      }
    } catch (timelineLoadError) {
      if (requestId !== timelineRequestIdRef.current) return;
      setTimelineError(extractApiErrorMessage(timelineLoadError, 'Không thể tải lịch sử hoạt động.'));
      setTimelineLoaded(true);
    } finally {
      if (requestId === timelineRequestIdRef.current) setTimelineLoading(false);
    }
  }, [incidentId]);

  const timelinePresentation = useMemo(
    () => getTimelinePresentation(timeline, timelineVisibleCount),
    [timeline, timelineVisibleCount],
  );

  useEffect(() => {
    if (activeTab === 'events' && !timelineLoaded && !timelineLoading) {
      void loadTimeline();
    }
  }, [activeTab, loadTimeline, timelineLoaded, timelineLoading]);

  const loadFeedbackCandidates = useCallback(async ({ pageNumber = 1, append = false } = {}) => {
    const requestId = ++feedbackRequestIdRef.current;
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const response = await managementFeedbackApi.getFeedbacks({
        PageNumber: pageNumber,
        PageSize: CANDIDATE_PAGE_SIZE,
        Search: feedbackSearch.trim(),
      });
      if (requestId !== feedbackRequestIdRef.current) return;

      const nextItems = normalizeCollection(response);
      setFeedbackCandidates((current) => {
        if (!append) return nextItems;

        const byId = new Map();
        [...current, ...nextItems].forEach((item) => {
          const id = String(getFeedbackId(item) || '');
          if (id) byId.set(id, item);
        });
        return [...byId.values()];
      });

      const payload = getPayload(response);
      const totalPages = Math.max(1, Number(payload?.totalPages) || 1);
      const hasNextPage = typeof payload?.hasNextPage === 'boolean'
        ? payload.hasNextPage
        : pageNumber < totalPages;
      setFeedbackPageNumber(pageNumber);
      setFeedbackHasMore(hasNextPage);
    } catch (candidateError) {
      if (requestId !== feedbackRequestIdRef.current) return;
      setFeedbackError(extractApiErrorMessage(candidateError, 'Không thể tải danh sách phản ánh.'));
    } finally {
      if (requestId === feedbackRequestIdRef.current) setFeedbackLoading(false);
    }
  }, [feedbackSearch]);

  useEffect(() => {
    if (!linkModalOpen) return undefined;
    const timer = window.setTimeout(() => {
      setFeedbackPageNumber(1);
      setFeedbackHasMore(false);
      void loadFeedbackCandidates({ pageNumber: 1, append: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [linkModalOpen, loadFeedbackCandidates]);

  const handleLinkReport = useCallback((feedback) => {
    const feedbackId = getFeedbackId(feedback);
    if (!feedbackId) return;
    if (structureActionsLocked) {
      setFeedbackError(isMergedIncident
        ? 'Sự vụ đã được gộp nên không thể liên kết thêm phản ánh.'
        : 'Sự vụ đã đóng nên không thể liên kết thêm phản ánh.');
      return;
    }
    if (linkedFeedbackIds.has(String(feedbackId)) || hasActiveIncidentLink(feedback)) {
      setFeedbackError('Phản ánh này đã thuộc một sự vụ đang hoạt động nên không thể liên kết thủ công.');
      return;
    }

    setFeedbackError('');
    setConfirmAction({
      type: 'link-report',
      feedbackId,
      title: 'Liên kết phản ánh vào sự vụ?',
      description: `Phản ánh “${getFeedbackTitle(feedback)}” sẽ được liên kết bổ sung vào ${formatIncidentId(incidentId)}. Nội dung và dữ liệu gốc vẫn được giữ nguyên.`,
    });
  }, [incidentId, isMergedIncident, linkedFeedbackIds, structureActionsLocked]);

  const confirmLinkReport = useCallback(async () => {
    const feedbackId = confirmAction?.feedbackId;
    if (!feedbackId || structureActionsLocked) {
      setConfirmAction(null);
      return;
    }

    setLinkingFeedbackId(String(feedbackId));
    setFeedbackError('');
    try {
      await incidentManagementApi.linkReport(incidentId, {
        feedbackId,
        linkMethod: 'StaffConfirmed',
        confidenceScore: null,
        reason: 'Liên kết thủ công từ màn chi tiết sự vụ',
      });
      setConfirmAction(null);
      setLinkModalOpen(false);
      setFeedbackSearch('');
      setFeedbackAreaFilter('');
      setFeedbackCategoryFilter('');
      setFeedbackStatusFilter('');
      setNotice('Đã liên kết phản ánh vào sự vụ.');
      void loadIncident({ background: true });
      if (timelineLoaded) void loadTimeline();
    } catch (linkError) {
      setConfirmAction(null);
      setFeedbackError(localizeIncidentApiError(extractApiErrorMessage(linkError, 'Không thể liên kết phản ánh vào sự vụ.'), 'Không thể liên kết phản ánh vào sự vụ.'));
    } finally {
      setLinkingFeedbackId('');
    }
  }, [confirmAction?.feedbackId, incidentId, loadIncident, loadTimeline, structureActionsLocked, timelineLoaded]);

  const handleUnlinkReport = useCallback((report) => {
    const feedbackId = getFeedbackId(report);
    if (!feedbackId || isPrimaryReportLink(report) || structureActionsLocked) return;

    setConfirmAction({
      type: 'unlink',
      feedbackId,
      title: 'Gỡ phản ánh khỏi sự vụ?',
      description: `Phản ánh “${getFeedbackTitle(report)}” sẽ được gỡ liên kết nhưng không bị xóa khỏi hệ thống.`,
    });
  }, [structureActionsLocked]);

  const confirmUnlinkReport = useCallback(async () => {
    const feedbackId = confirmAction?.feedbackId;
    if (!feedbackId || structureActionsLocked) {
      setConfirmAction(null);
      return;
    }

    setUnlinkingFeedbackId(String(feedbackId));
    setError('');
    try {
      await incidentManagementApi.unlinkReport(incidentId, feedbackId);
      setConfirmAction(null);
      setNotice('Đã gỡ phản ánh khỏi sự vụ.');
      void loadIncident({ background: true });
      if (timelineLoaded) void loadTimeline();
    } catch (unlinkError) {
      setConfirmAction(null);
      setActionError(localizeIncidentApiError(
        extractApiErrorMessage(unlinkError, 'Không thể gỡ phản ánh khỏi sự vụ.'),
        'Không thể gỡ phản ánh khỏi sự vụ.',
      ));
    } finally {
      setUnlinkingFeedbackId('');
    }
  }, [confirmAction?.feedbackId, incidentId, loadIncident, loadTimeline, structureActionsLocked, timelineLoaded]);

  const refreshAfterAction = useCallback(async (message) => {
    setNotice(message);
    await loadIncident({ background: true });
    if (timelineLoaded) void loadTimeline();
  }, [loadIncident, loadTimeline, timelineLoaded]);

  const openEditModal = useCallback(() => {
    if (mutationActionsLocked) return;
    setActionError('');
    setEditForm({
      title: incident?.title ?? incident?.summary ?? '',
      description: incident?.description ?? '',
      priority: incident?.priority === 'Critical' ? 'Urgent' : (incident?.priority || 'Medium'),
      severity: incident?.severity ?? incident?.severityLevel ?? 'Medium',
    });
    setEditModalOpen(true);
  }, [incident, mutationActionsLocked]);

  const handleUpdateIncident = useCallback(async () => {
    if (mutationActionsLocked) return;
    setActionLoading('edit');
    setActionError('');
    try {
      await incidentManagementApi.updateIncident(incidentId, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority === 'Critical' ? 'Urgent' : editForm.priority,
        severity: editForm.severity,
      });
      setEditModalOpen(false);
      await refreshAfterAction('Đã cập nhật độ ưu tiên và mức nghiêm trọng.');
    } catch (updateError) {
      setActionError(localizeIncidentApiError(extractApiErrorMessage(updateError, 'Không thể cập nhật sự vụ.'), 'Không thể cập nhật sự vụ.'));
    } finally {
      setActionLoading('');
    }
  }, [editForm.description, editForm.priority, editForm.severity, editForm.title, incidentId, mutationActionsLocked, refreshAfterAction]);

  const openStatusModal = useCallback(() => {
    if (mutationActionsLocked) return;
    setActionError('');
    const currentStatus = String(incident?.status || '');
    const selectableCurrentStatus = INCIDENT_STATUS_ACTION_OPTIONS.some(([value]) => value === currentStatus);
    setStatusValue(selectableCurrentStatus ? currentStatus : 'Open');
    setStatusModalOpen(true);
  }, [incident?.status, mutationActionsLocked]);

  const handleUpdateStatus = useCallback(async () => {
    if (mutationActionsLocked) return;
    setActionLoading('status');
    setActionError('');
    try {
      await incidentManagementApi.updateIncidentStatus(incidentId, { status: statusValue });
      setStatusModalOpen(false);
      await refreshAfterAction('Đã cập nhật trạng thái sự vụ.');
    } catch (statusError) {
      setActionError(localizeIncidentApiError(extractApiErrorMessage(statusError, 'Không thể cập nhật trạng thái sự vụ.'), 'Không thể cập nhật trạng thái sự vụ.'));
    } finally {
      setActionLoading('');
    }
  }, [incidentId, mutationActionsLocked, refreshAfterAction, statusValue]);

  const openAssignModal = useCallback(async () => {
    if (structureActionsLocked) return;
    setActionError('');
    setAssigneeCandidates([]);
    setSelectedAssigneeId(String(getIncidentAssigneeId(incident) || ''));
    setAssignModalOpen(true);
    setAssigneeLoading(true);
    try {
      const response = await incidentManagementApi.getIncidentAssigneeCandidates(incidentId, { pageNumber: 1, pageSize: 100 });
      setAssigneeCandidates(normalizeCollection(response));
    } catch (candidateError) {
      setActionError(localizeIncidentApiError(extractApiErrorMessage(candidateError, 'Không thể tải danh sách nhân viên phù hợp.'), 'Không thể tải danh sách nhân viên phù hợp.'));
      setAssigneeCandidates([]);
    } finally {
      setAssigneeLoading(false);
    }
  }, [incident, incidentId, structureActionsLocked]);

  const handleAssignIncident = useCallback(async () => {
    if (structureActionsLocked) return;
    if (!selectedAssigneeId) return;

    const currentAssigneeId = String(getIncidentAssigneeId(incident) || '');
    if (currentAssigneeId && currentAssigneeId === String(selectedAssigneeId)) {
      setActionError('Nhân viên này đang là người phụ trách sự vụ.');
      return;
    }

    setActionLoading('assign');
    setActionError('');
    try {
      await incidentManagementApi.assignIncident(incidentId, {
        staffUserId: selectedAssigneeId,
      });
      setAssignModalOpen(false);
      await refreshAfterAction(currentAssigneeId ? 'Đã đổi người phụ trách sự vụ.' : 'Đã phân công nhân viên phụ trách sự vụ.');
    } catch (assignError) {
      setActionError(localizeIncidentApiError(extractApiErrorMessage(assignError, 'Không thể phân công nhân viên phụ trách.'), 'Không thể phân công nhân viên phụ trách.'));
    } finally {
      setActionLoading('');
    }
  }, [incident, incidentId, refreshAfterAction, selectedAssigneeId, structureActionsLocked]);

  const loadMergeCandidates = useCallback(async ({
    search = '',
    sameAreaOnly = false,
    sameCategoryOnly = false,
    pageNumber = 1,
    append = false,
  } = {}) => {
    const requestId = ++mergeRequestIdRef.current;
    const areaId = incident?.areaId ?? incident?.area?.areaId ?? incident?.area?.id;
    const categoryId = incident?.categoryId ?? incident?.category?.categoryId ?? incident?.category?.id;

    if (append) setMergeLoadingMore(true);
    else setMergeLoading(true);
    setActionError('');
    try {
      const response = await incidentManagementApi.getIncidents({
        pageNumber,
        pageSize: CANDIDATE_PAGE_SIZE,
        includeMerged: false,
        search: search.trim() || undefined,
        areaId: sameAreaOnly && areaId ? areaId : undefined,
        categoryId: sameCategoryOnly && categoryId ? categoryId : undefined,
      });
      if (requestId !== mergeRequestIdRef.current) return;

      const nextItems = normalizeCollection(response).filter((item) => String(item?.incidentId ?? item?.id) !== String(incidentId));
      setMergeCandidates((current) => {
        if (!append) return nextItems;

        const byId = new Map();
        [...current, ...nextItems].forEach((item) => {
          const id = String(item?.incidentId ?? item?.id ?? '');
          if (id) byId.set(id, item);
        });
        return [...byId.values()];
      });

      const totalPages = Math.max(1, Number(response?.totalPages) || 1);
      const hasNextPage = typeof response?.hasNextPage === 'boolean'
        ? response.hasNextPage
        : pageNumber < totalPages;
      setMergePageNumber(pageNumber);
      setMergeHasMore(hasNextPage);

      if (!append) {
        setSelectedMergeIncidentId((current) => nextItems.some((item) => String(item?.incidentId ?? item?.id) === String(current)) ? current : '');
        setSelectedMergeIncidentIds((current) => current.filter((currentId) => nextItems.some((item) => String(item?.incidentId ?? item?.id) === String(currentId))));
      }
    } catch (mergeLoadError) {
      if (requestId !== mergeRequestIdRef.current) return;
      setActionError(localizeIncidentApiError(extractApiErrorMessage(mergeLoadError, 'Không thể tải danh sách sự vụ để gộp.'), 'Không thể tải danh sách sự vụ để gộp.'));
      if (!append) {
        setMergeCandidates([]);
        setSelectedMergeIncidentId('');
        setSelectedMergeIncidentIds([]);
      }
    } finally {
      if (requestId === mergeRequestIdRef.current) {
        setMergeLoading(false);
        setMergeLoadingMore(false);
      }
    }
  }, [incident, incidentId]);

  const openMergeModal = useCallback(() => {
    if (mergeActionLocked) return;
    setActionError('');
    setSelectedMergeIncidentId('');
    setSelectedMergeIncidentIds([]);
    setMergeReason('');
    setMergeMode('into-current');
    setMergeSearch('');
    setMergeSameAreaOnly(false);
    setMergeSameCategoryOnly(false);
    setMergeCandidates([]);
    setMergePageNumber(1);
    setMergeHasMore(false);
    setMergeModalOpen(true);
  }, [mergeActionLocked]);

  useEffect(() => {
    if (!mergeModalOpen) return undefined;
    const timer = window.setTimeout(() => {
      setMergePageNumber(1);
      setMergeHasMore(false);
      loadMergeCandidates({
        search: mergeSearch,
        sameAreaOnly: mergeSameAreaOnly,
        sameCategoryOnly: mergeSameCategoryOnly,
        pageNumber: 1,
        append: false,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadMergeCandidates, mergeModalOpen, mergeSameAreaOnly, mergeSameCategoryOnly, mergeSearch]);

  const handleMergeIncident = useCallback(() => {
    if (mergeActionLocked) return;

    const currentId = incident?.incidentId ?? incident?.id ?? incidentId;
    const currentTitle = incident?.title ?? incident?.summary ?? 'Sự vụ hiện tại';
    const reasonText = mergeReason.trim();
    const mergeIntoCurrent = mergeMode === 'into-current';

    if (mergeIntoCurrent) {
      if (selectedMergeIncidentIds.length === 0) return;
      const selectedIncidents = selectedMergeIncidentIds
        .map((selectedId) => mergeCandidates.find((item) => String(item?.incidentId ?? item?.id) === String(selectedId)))
        .filter(Boolean);

      if (selectedIncidents.length !== selectedMergeIncidentIds.length || selectedIncidents.some(isIncidentPastMergeStage)) {
        setActionError('Có sự vụ đã chọn đã được phân công hoặc bước vào xử lý nên không thể gộp.');
        return;
      }

      const sourceIncidentIds = selectedIncidents.map((item) => String(item?.incidentId ?? item?.id));
      setConfirmAction({
        type: 'merge',
        sourceIncidentIds,
        targetIncidentId: String(currentId),
        mergeMode,
        title: `Gộp ${sourceIncidentIds.length} sự vụ vào sự vụ này?`,
        description: `${sourceIncidentIds.length} sự vụ đã chọn sẽ được gộp lần lượt vào ${currentTitle} (${formatIncidentId(currentId)}). Sự vụ hiện tại được giữ làm sự vụ chính.${reasonText ? ` Lý do: ${reasonText}` : ''}`,
      });
      return;
    }

    if (!selectedMergeIncidentId) return;
    const selectedIncident = mergeCandidates.find((item) => String(item?.incidentId ?? item?.id) === String(selectedMergeIncidentId));
    if (!selectedIncident || isIncidentPastMergeStage(selectedIncident)) {
      setActionError('Sự vụ đã chọn đã được phân công hoặc bước vào xử lý nên không thể gộp.');
      return;
    }

    const selectedId = selectedIncident?.incidentId ?? selectedIncident?.id ?? selectedMergeIncidentId;
    const selectedTitle = selectedIncident?.title ?? selectedIncident?.summary ?? 'Sự vụ đã chọn';
    setConfirmAction({
      type: 'merge',
      sourceIncidentId: String(currentId),
      targetIncidentId: String(selectedId),
      mergeMode,
      title: 'Gộp sự vụ này vào sự vụ đã chọn?',
      description: `${currentTitle} (${formatIncidentId(currentId)}) sẽ được gộp vào ${selectedTitle} (${formatIncidentId(selectedId)}). Sự vụ đích được giữ làm sự vụ chính và các liên kết phản ánh có thể thay đổi.${reasonText ? ` Lý do: ${reasonText}` : ''}`,
    });
  }, [incident, incidentId, mergeActionLocked, mergeCandidates, mergeMode, mergeReason, selectedMergeIncidentId, selectedMergeIncidentIds]);

  const confirmMergeIncident = useCallback(async () => {
    if (mergeActionLocked) {
      setConfirmAction(null);
      return;
    }

    const sourceIncidentIds = Array.isArray(confirmAction?.sourceIncidentIds)
      ? confirmAction.sourceIncidentIds.filter(Boolean)
      : confirmAction?.sourceIncidentId
        ? [confirmAction.sourceIncidentId]
        : [];
    const targetIncidentId = confirmAction?.targetIncidentId;
    if (sourceIncidentIds.length === 0 || !targetIncidentId) return;

    setActionLoading('merge');
    setActionError('');
    let completedCount = 0;
    try {
      for (const sourceIncidentId of sourceIncidentIds) {
        await incidentManagementApi.mergeIncident(sourceIncidentId, {
          targetIncidentId,
          reason: mergeReason.trim() || null,
        });
        completedCount += 1;
      }

      const mergedIntoCurrent = confirmAction?.mergeMode === 'into-current';
      setConfirmAction(null);
      setMergeModalOpen(false);
      setSelectedMergeIncidentIds([]);
      setNotice(sourceIncidentIds.length > 1 ? `Đã gộp ${sourceIncidentIds.length} sự vụ.` : 'Đã gộp sự vụ.');

      if (mergedIntoCurrent) {
        await loadIncident({ background: true });
        if (timelineLoaded) void loadTimeline();
      } else {
        const incidentBasePath = location.pathname.startsWith('/management/incidents')
          ? '/management/incidents'
          : '/manager/incidents';
        navigate(`${incidentBasePath}/${targetIncidentId}`, { replace: true, state: { from: incidentBasePath } });
      }
    } catch (mergeError) {
      setConfirmAction(null);
      if (completedCount > 0) {
        setSelectedMergeIncidentIds((current) => current.slice(completedCount));
        await loadIncident({ background: true });
        setActionError(`Đã gộp ${completedCount}/${sourceIncidentIds.length} sự vụ. Thao tác dừng lại vì: ${localizeIncidentApiError(extractApiErrorMessage(mergeError, 'Không thể gộp sự vụ tiếp theo.'), 'Không thể gộp sự vụ tiếp theo.')}`);
      } else {
        setActionError(localizeIncidentApiError(extractApiErrorMessage(mergeError, 'Không thể gộp sự vụ.'), 'Không thể gộp sự vụ.'));
      }
    } finally {
      setActionLoading('');
    }
  }, [confirmAction, loadIncident, loadTimeline, location.pathname, mergeActionLocked, mergeReason, navigate, timelineLoaded]);

  const handleApprovalDecision = useCallback(async () => {
    if (!approvalDecision || approvalSubmitting) return;
    if (!hasApprovalResolution) {
      setActionError('Chưa có kết quả xử lý hợp lệ để ra quyết định.');
      return;
    }
    const note = approvalNote.trim();
    if (approvalDecision === 'rework' && !note) {
      setActionError('Vui lòng nhập lý do yêu cầu làm lại.');
      return;
    }

    setApprovalSubmitting(true);
    setActionError('');
    try {
      if (approvalDecision === 'approve') {
        await incidentManagementApi.approveIncidentResolution(incidentId, approvalResolutionId, {
          note: note || undefined,
        });
      } else {
        await incidentManagementApi.requestIncidentResolutionRework(incidentId, approvalResolutionId, {
          reason: note,
        });
      }
      const approvalNotice = approvalDecision === 'approve'
        ? 'Đã phê duyệt kết quả xử lý sự vụ.'
        : 'Đã yêu cầu làm lại kết quả xử lý sự vụ.';
      setApprovalDecision('');
      setApprovalNote('');
      navigate('/manager/approvals', {
        replace: true,
        state: { refreshKey: Date.now(), approvalNotice },
      });
    } catch (approvalError) {
      setActionError(localizeIncidentApiError(
        extractApiErrorMessage(approvalError, 'Không thể cập nhật quyết định duyệt sự vụ.'),
        'Không thể cập nhật quyết định duyệt sự vụ.',
      ));
    } finally {
      setApprovalSubmitting(false);
    }
  }, [approvalDecision, approvalNote, approvalResolutionId, approvalSubmitting, hasApprovalResolution, incidentId, navigate]);

  if (loading && !incident) {
    return (
      <div className="admin-page-shell manager-ui-page space-y-5 pb-4">
        <button type="button" onClick={goBack} className="admin-secondary-link inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold transition">
          <Lucide.ArrowLeft size={16} />{backLabel}
        </button>
        <section className="admin-page-hero">
          <div className="relative space-y-3">
            <div className="h-3 w-28 animate-pulse rounded-full bg-blue-100 dark:bg-blue-500/20" />
            <div className="h-9 w-full max-w-xl animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800" />
            <div className="h-4 w-64 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 h-5 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </section>
        <section className="min-h-[420px] rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
          <div className="h-6 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />)}
          </div>
        </section>
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div className="admin-page-shell">
        <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white px-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Lucide.WifiOff size={24} /></div>
          <h1 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">Không thể tải chi tiết sự vụ</h1>
          <p className="mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">{error || 'Không tìm thấy dữ liệu sự vụ.'}</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={goBack} className="btn admin-secondary-action h-10 rounded-xl px-5 text-sm font-semibold normal-case">{backLabel}</button>
            <button type="button" onClick={() => loadIncident()} className="btn h-10 rounded-xl border-0 bg-blue-600 text-white hover:bg-blue-700">Thử lại</button>
          </div>
        </section>
      </div>
    );
  }

  const title = incident?.title ?? incident?.summary ?? 'Sự vụ chưa có tiêu đề';
  const areaName = incident?.areaName ?? incident?.wardName ?? incident?.area?.name ?? 'Chưa xác định';
  const categoryName = incident?.categoryName ?? incident?.category?.name ?? 'Chưa phân loại';
  const severity = getLevelLabel(incident?.severity ?? incident?.severityLevel);
  const dueDateLabel = incident?.dueDate ? formatDateTime(incident.dueDate) : 'Chưa đặt';
  const reportCount = Number(incident?.reportCount ?? incident?.reportsCount ?? reports.length) || 0;
  const subscriberCount = Number(incident?.subscriberCount ?? incident?.followersCount ?? subscribers.length) || 0;
  const currentAssigneeId = getIncidentAssigneeId(incident);
  const currentAssigneeName = getIncidentAssigneeName(incident);
  const hasCurrentAssignee = Boolean(currentAssigneeId || currentAssigneeName);
  const incidentLatitude = incident?.latitude ?? incident?.lat;
  const incidentLongitude = incident?.longitude ?? incident?.lng ?? incident?.long;
  const incidentLocationText = incident?.locationText ?? incident?.address ?? '';
  const openInternalIncidentMap = () => {
    const mapPath = location.pathname.startsWith('/management/incidents') ? '/management/map' : '/manager/map';
    navigate(mapPath, {
      state: {
        from: location.pathname,
        mapState: {
          focusMap: true,
          focusFeedbackId: mapFocusFeedbackId,
          focusLatitude: incidentLatitude,
          focusLongitude: incidentLongitude,
        },
      },
    });
  };


  return (
    <div className="admin-page-shell manager-ui-page space-y-5 pb-4">
      <button type="button" onClick={goBack} className="admin-secondary-link inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold transition">
        <Lucide.ArrowLeft size={16} />{backLabel}
      </button>

      <ManagerToast
        type="success"
        message={notice}
        onClose={() => setNotice('')}
      />
      {detailResolved && error ? (
        <ManagerToast
          type="error"
          message={error}
          onClose={() => setError('')}
        />
      ) : null}

      <section className="incident-detail-hero admin-page-hero overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Lucide.Siren size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">
                {formatIncidentId(incident?.incidentId ?? incident?.id ?? incidentId)}
              </p>
              <h1 className="mt-1.5 truncate text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem] dark:text-white" title={title}>
                {title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><Lucide.MapPin size={14} />{areaName}</span>
                <span className="inline-flex items-center gap-1.5"><Lucide.Tags size={14} />{categoryName}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <ManagerListRefreshIndicator visible={refreshing} label="Đang cập nhật" />
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Trạng thái:</span>
              <Badge value={incident?.status} type="status" />
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Ưu tiên:</span>
              <Badge value={incident?.priority} type="priority" />
            </div>
            <button
              type="button"
              onClick={() => loadIncident({ background: true })}
              disabled={refreshing}
              className="btn admin-secondary-action ml-0 h-9 rounded-xl px-3 text-xs font-semibold normal-case lg:ml-1"
            >
              <Lucide.RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        </div>
      </section>

      {refreshError ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" role="status">
          <Lucide.TriangleAlert size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1">Không thể cập nhật dữ liệu mới. Thông tin đang hiển thị vẫn được giữ nguyên.</span>
          <button type="button" onClick={() => loadIncident({ background: true })} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/10">
            <Lucide.RefreshCcw size={13} />Thử lại
          </button>
        </div>
      ) : null}

      {adminReadOnly ? (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Lucide.Eye size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Chế độ giám sát chỉ đọc</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Quản trị viên theo dõi toàn hệ thống nhưng không thực hiện phân công, gộp, đổi trạng thái hay thay đổi liên kết phản ánh thay Manager.</p>
          </div>
        </section>
      ) : isApprovalView ? (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <div className="mr-auto min-w-[240px]">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quyết định duyệt kết quả xử lý</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {isAwaitingApproval
                ? hasApprovalResolution
                  ? 'Kết quả xử lý mới nhất đã sẵn sàng để xem xét và ra quyết định.'
                  : approvalResolutionLoading
                    ? 'Đang tải kết quả xử lý mới nhất…'
                    : 'Chưa có kết quả xử lý hợp lệ để phê duyệt.'
                : 'Sự vụ này không còn ở trạng thái chờ phê duyệt.'}
            </p>
          </div>
          <button type="button" onClick={() => { setApprovalNote(''); setApprovalDecision('rework'); setActionError(''); }} disabled={!approvalDecisionEnabled || approvalSubmitting} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:bg-slate-950 dark:text-amber-300">
            <Lucide.RotateCcw size={15} />Yêu cầu làm lại
          </button>
          <button type="button" onClick={() => { setApprovalNote(''); setApprovalDecision('approve'); setActionError(''); }} disabled={!approvalDecisionEnabled || approvalSubmitting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Lucide.BadgeCheck size={16} />Phê duyệt kết quả
          </button>
        </section>
      ) : (
        <section className="incident-action-bar flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mr-auto min-w-[220px] px-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Thao tác sự vụ</p>
            {isMergedIncident ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sự vụ đã được gộp vào sự vụ khác và hiện ở chế độ chỉ đọc.</p>
            ) : isClosedIncident ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sự vụ đã đóng; các thao tác thay đổi liên kết và phân công đã bị khóa.</p>
            ) : null}
          </div>
          <button type="button" onClick={openEditModal} disabled={mutationActionsLocked} title={mutationActionsLocked ? 'Sự vụ đã gộp chỉ được xem lịch sử.' : undefined} className="manager-detail-action disabled:cursor-not-allowed disabled:opacity-50"><Lucide.Pencil size={15} />Sửa mức độ</button>
          <button type="button" onClick={openStatusModal} disabled={mutationActionsLocked} title={mutationActionsLocked ? 'Sự vụ đã gộp chỉ được xem lịch sử.' : undefined} className="manager-detail-action disabled:cursor-not-allowed disabled:opacity-50"><Lucide.RefreshCw size={15} />Đổi trạng thái</button>
          <button type="button" onClick={openMergeModal} disabled={mergeActionLocked} title={mergeActionLocked ? (structureActionsLocked ? 'Không thể gộp thêm sự vụ đã đóng hoặc đã gộp.' : 'Chỉ có thể gộp trước khi sự vụ được phân công và bắt đầu xử lý.') : undefined} className="manager-detail-action disabled:cursor-not-allowed disabled:opacity-50"><Lucide.Merge size={15} />Gộp sự vụ</button>
          <button type="button" onClick={openAssignModal} disabled={structureActionsLocked} title={structureActionsLocked ? 'Không thể thay đổi phân công của sự vụ đã đóng hoặc đã gộp.' : undefined} className="manager-detail-action manager-detail-action--primary disabled:cursor-not-allowed disabled:opacity-50"><Lucide.UserRoundCheck size={15} />{hasCurrentAssignee ? 'Đổi người phụ trách' : 'Phân công nhân viên'}</button>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <InfoItem label="Trạng thái"><Badge value={incident?.status} type="status" /></InfoItem>
        <InfoItem label="Ưu tiên"><Badge value={incident?.priority} type="priority" /></InfoItem>
        <InfoItem label="Mức nghiêm trọng" value={detailResolved ? severity : 'Đang tải…'} />
        <InfoItem label="Hạn xử lý" value={detailResolved ? dueDateLabel : 'Đang tải…'} />
        <InfoItem label="Số phản ánh" value={reportCount} />
        <InfoItem label="Người theo dõi" value={subscriberCount} />
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
        <ManagerSectionHeader
          id="incident-information-title"
          title="Thông tin sự vụ"
          description="Thông tin quản lý và phạm vi xử lý hiện tại."
          icon={Lucide.FileText}
        />
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <InfoItem label="Phường / khu vực" value={areaName} />
          <InfoItem label="Danh mục" value={categoryName} />
          <InfoItem label="Người phụ trách">
            {hasCurrentAssignee ? (
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <Lucide.UserRound size={14} />
                </span>
                <span className="truncate" title={currentAssigneeName || String(currentAssigneeId)}>
                  {currentAssigneeName || `Nhân viên ${String(currentAssigneeId).slice(0, 8)}`}
                </span>
              </span>
            ) : (
              <span className="font-medium text-amber-700">Chưa phân công</span>
            )}
          </InfoItem>
          <InfoItem label="Cập nhật gần nhất" value={formatDateTime(incident?.updatedAt ?? incident?.updatedDate)} />
          <InfoItem label="Ngày tạo" value={formatDateTime(incident?.createdAt)} />
        </div>
        {!detailResolved ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-4 w-3/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : incident?.description ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Mô tả</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{incident.description}</p>
          </div>
        ) : null}
        </div>
      </section>

      <IncidentSlaSection
        incidentId={incidentId}
        incidentStatus={incident?.status}
        canManage={currentRole === 'interaction-manager' && !isMergedIncident && !isApprovalView}
        onChanged={(message) => {
          if (message) setNotice(message);
          if (timelineLoaded) void loadTimeline();
        }}
      />

      {isApprovalView ? (
        <section className="overflow-hidden rounded-[24px] border border-indigo-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-indigo-500/20 dark:bg-slate-950">
          <ManagerSectionHeader
            id="incident-resolution-review-title"
            title="Kết quả xử lý cần duyệt"
            description="Phiên bản kết quả mới nhất do nhân viên gửi cho sự vụ này."
            icon={Lucide.ClipboardCheck}
            actions={approvalResolution && !approvalResolutionLoading ? <Badge value={approvalResolution?.status || incident?.status} type="status" /> : null}
          />
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {approvalResolutionLoading && !approvalResolution ? (
              <div className="space-y-4" aria-label="Đang tải kết quả xử lý">
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />)}
                </div>
                <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
                <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
              </div>
            ) : approvalResolutionError && !approvalResolution ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                <div className="flex items-start gap-3"><Lucide.TriangleAlert size={18} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Không thể tải kết quả xử lý</p><p className="mt-1 leading-6">{approvalResolutionError}</p></div></div>
                <button type="button" onClick={() => void loadApprovalResolution()} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold hover:bg-amber-100 dark:bg-transparent"><Lucide.RefreshCcw size={14} />Thử lại</button>
              </div>
            ) : approvalResolution ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoItem label="Nhân viên gửi" value={approvalResolution?.createdByStaffUserName || 'Chưa xác định'} />
                  <InfoItem label="Thời gian gửi" value={formatDateTime(approvalResolution?.resolvedAt)} />
                  <InfoItem label="Đơn vị xử lý" value={approvalDocuments.find((document) => document?.providerName)?.providerName || 'Không có đơn vị bên ngoài'} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Tóm tắt kết quả</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{approvalResolution?.resolutionSummary || 'Chưa có tóm tắt kết quả.'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Hành động đã thực hiện</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{approvalResolution?.actionTaken || 'Chưa có mô tả hành động.'}</p>
                  </div>
                </div>
                {approvalResolution?.resultNote ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Ghi chú kết quả</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{approvalResolution.resultNote}</p>
                  </div>
                ) : null}
                {approvalFileDocuments.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tài liệu kèm theo</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {approvalFileDocuments.length} tệp không phải ảnh. Ảnh hoàn thành xem ở khối đối chiếu bên dưới.
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {approvalFileDocuments.map((document, index) => {
                        const url = getAttachmentUrl(document);
                        if (!url) return null;
                        const key = document?.completionDocumentId ?? `${url}-${index}`;
                        const label = document?.description || `Tài liệu ${index + 1}`;
                        return (
                          <a key={key} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex aspect-[4/3] items-center justify-center text-slate-400"><Lucide.FileText size={28} /></div>
                            <div className="px-3 py-2"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200" title={label}>{label}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{document?.uploadedByUserName || document?.providerName || 'Tệp hoàn thành'}</p></div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {approvalResolutionError ? <p className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300"><Lucide.TriangleAlert size={14} />Không thể cập nhật phiên bản mới nhất; đang giữ dữ liệu đã tải.</p> : null}
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl bg-slate-50 px-6 text-center dark:bg-slate-900/60">
                <div><Lucide.ClipboardX size={28} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Chưa có kết quả xử lý để duyệt</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-400">Sự vụ đang chờ phê duyệt nhưng API chưa trả về kết quả xử lý hiện tại. Các nút quyết định được khóa để tránh duyệt nhầm.</p></div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/*
        * Đặt sau khối kết quả để người duyệt đọc lời khai của nhân viên trước,
        * rồi mới soi bằng chứng. Ở màn duyệt luôn hiện vì thiếu ảnh hoàn thành
        * cũng là thông tin cần biết; ở trang chi tiết chỉ hiện khi đã có ảnh
        * sau, tránh bày khối đối chiếu rỗng trên sự vụ chưa xử lý.
        */}
      {showEvidenceComparison ? (
        <IncidentEvidenceComparison
          beforeItems={comparisonBeforeItems}
          afterItems={comparisonAfterItems}
          beforeLoading={reportMediaLoading}
        />
      ) : null}

      <section className={showEvidenceComparison ? 'grid gap-5' : 'grid gap-5 xl:grid-cols-[0.95fr_1.05fr]'}>
        <IncidentLocationMapCard
          incidentId={incidentId}
          latitude={incidentLatitude}
          longitude={incidentLongitude}
          locationText={incidentLocationText}
          areaName={areaName}
          tone="blue"
          onOpenInternalMap={openInternalIncidentMap}
        />

        {showEvidenceComparison ? null : (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
          <ManagerSectionHeader
            id="incident-evidence-title"
            title="Hình ảnh từ các phản ánh"
            description="Bằng chứng hình ảnh được giữ theo từng phản ánh nguồn."
            icon={Lucide.Images}
          />
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
            {reportMediaLoading && reportGalleryItems.length === 0 ? (
              <div className="flex min-h-[320px] flex-1 flex-col justify-center" aria-label="Đang tải hình ảnh từ các phản ánh">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: Math.min(6, Math.max(3, activeReports.length)) }, (_, index) => (
                    <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
                  ))}
                </div>
                <div className="mx-auto mt-5 h-3 w-36 animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
              </div>
            ) : reportGalleryItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {reportGalleryItems.map((item, index) => (
                  <GalleryPreview
                    key={`${item.feedbackId}-${item.url}-${index}`}
                    item={item}
                    onOpen={() => setLightboxIndex(index)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-800 dark:bg-slate-900/60">
                <div>
                  <Lucide.ImageOff size={26} className="mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa có hình ảnh từ các phản ánh</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Các ảnh người dân gửi kèm phản ánh sẽ xuất hiện tại đây.</p>
                </div>
              </div>
            )}
            {reportMediaLoading && reportGalleryItems.length > 0 ? (
              <div className="mt-3"><ManagerListRefreshIndicator visible label="Đang tải thêm hình ảnh" /></div>
            ) : null}
            {reportMediaError ? (
              <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Lucide.TriangleAlert size={14} aria-hidden="true" />
                {reportMediaError}
              </p>
            ) : null}
          </div>
        </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 dark:border-slate-800">
          <ManagerSectionHeader
            id="incident-management-title"
            title="Quản lý sự vụ"
            description="Theo dõi phản ánh, người theo dõi và lịch sử thay đổi của sự vụ."
            icon={Lucide.Layers3}
            actions={activeTab === 'reports' && !adminReadOnly ? (
              <button
                type="button"
                onClick={() => !structureActionsLocked && setLinkModalOpen(true)}
                disabled={structureActionsLocked}
                title={structureActionsLocked ? 'Không thể thay đổi liên kết phản ánh của sự vụ đã đóng hoặc đã gộp.' : undefined}
                className="btn h-9 shrink-0 rounded-xl border-0 bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {structureActionsLocked ? <Lucide.LockKeyhole size={15} /> : <Lucide.Link2 size={15} />}Liên kết phản ánh
              </button>
            ) : null}
          />
          <div className="-mt-2 flex w-full gap-1 overflow-x-auto px-5 sm:px-6">
            {TAB_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              const count = id === 'reports' ? reportCount : id === 'subscribers' ? subscriberCount : null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative inline-flex h-12 shrink-0 items-center gap-2 px-3 text-sm font-semibold transition ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  <Icon size={16} />{label}
                  {count !== null ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-900'}`}>{count}</span> : null}
                  {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[360px]">
          {activeTab === 'reports' ? (
            !detailResolved ? <PanelSkeleton /> : activeReports.length === 0 ? (
              <EmptyState icon={Lucide.Inbox} title="Chưa có phản ánh liên quan" description={reportCount > 0 ? 'Dữ liệu chi tiết chưa trả danh sách phản ánh dù tổng số phản ánh lớn hơn 0.' : adminReadOnly ? 'Sự vụ này hiện chưa có phản ánh liên quan để quản trị viên theo dõi.' : 'Bấm “Liên kết phản ánh” để thêm phản ánh của người dân vào sự vụ này.'} />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeReports.map((report, index) => {
                  const feedbackId = getFeedbackId(report) || index;
                  const linkRole = report?.linkRole ?? report?.role ?? report?.relationType;
                  const confidence = report?.confidenceScore ?? report?.confidence;
                  const linkedAt = report?.linkedAt ?? report?.createdAt ?? report?.feedback?.createdAt;
                  const feedbackChannel = getFeedbackChannel(report);
                  const primaryReport = isPrimaryReportLink(report);
                  const linkMethodLabel = primaryReport ? '' : getReportLinkMethodLabel(report);
                  const hasConfidence = confidence !== null && confidence !== undefined && confidence !== '' && Number.isFinite(Number(confidence));
                  const reportMetaItems = [
                    feedbackChannel ? { label: 'Kênh gửi', value: feedbackChannel } : null,
                    linkMethodLabel ? { label: 'Cách liên kết', value: linkMethodLabel } : null,
                    !primaryReport && hasConfidence ? { label: 'Độ tin cậy', value: formatConfidence(confidence) } : null,
                  ].filter(Boolean);
                  const rawLinkReason = typeof report?.reason === 'string' ? report.reason.trim() : '';
                  const linkReason = !primaryReport && rawLinkReason ? localizeIncidentSystemText(rawLinkReason) : '';
                  const busy = String(unlinkingFeedbackId) === String(feedbackId);
                  return (
                    <div key={feedbackId} className="px-5 py-5 sm:px-6">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const reportFeedbackId = getFeedbackId(report);
                                if (!reportFeedbackId) return;
                                const feedbackDetailPath = currentRole === 'interaction-manager'
                                  ? `/manager/interactions/${reportFeedbackId}`
                                  : `/management/feedbacks/${reportFeedbackId}`;
                                navigate(feedbackDetailPath, { state: { from: location.pathname } });
                              }}
                              className="truncate text-left text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
                            >
                              {getFeedbackTitle(report)}
                            </button>
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">{getLinkRoleLabel(linkRole)}</span>
                            {getFeedbackStatus(report) ? <Badge value={getFeedbackStatus(report)} type="status" /> : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{getFeedbackReporter(report)} · {formatDateTime(linkedAt)}</p>
                          {reportMetaItems.length > 0 ? (
                            <div
                              className={`mt-3 grid gap-x-8 gap-y-3 text-xs ${
                                reportMetaItems.length === 1
                                  ? 'sm:max-w-xs sm:grid-cols-1'
                                  : reportMetaItems.length === 2
                                    ? 'sm:max-w-xl sm:grid-cols-2'
                                    : 'sm:grid-cols-3'
                              }`}
                            >
                              {reportMetaItems.map((item) => (
                                <div key={item.label} className="min-w-0">
                                  <span className="text-slate-400">{item.label}</span>
                                  <p className="mt-1 break-words font-semibold text-slate-700 dark:text-slate-200">{item.value}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {linkReason ? (
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              <span className="font-medium text-slate-400">Lý do liên kết: </span>
                              <span className="font-medium text-slate-600 dark:text-slate-300">{linkReason}</span>
                            </p>
                          ) : null}
                        </div>
                        {isPrimaryReportLink(report) ? (
                          <span
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                            title="Phản ánh chính là nguồn tạo sự vụ và không thể gỡ liên kết tại đây."
                          >
                            <Lucide.LockKeyhole size={14} />
                            Phản ánh chính
                          </span>
                        ) : adminReadOnly ? (
                          <span className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <Lucide.Eye size={14} />
                            Chỉ xem
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || structureActionsLocked}
                            title={structureActionsLocked ? 'Không thể gỡ liên kết khỏi sự vụ đã đóng hoặc đã gộp.' : undefined}
                            onClick={() => handleUnlinkReport(report)}
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? <Lucide.LoaderCircle className="animate-spin" size={14} /> : structureActionsLocked ? <Lucide.LockKeyhole size={14} /> : <Lucide.Unlink size={14} />}
                            Gỡ liên kết
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

          {activeTab === 'subscribers' ? (
            subscribers.length === 0 ? (
              <EmptyState icon={Lucide.Users} title="Chưa có dữ liệu người theo dõi" description={subscriberCount > 0 ? 'Dữ liệu chi tiết hiện chỉ có số lượng người theo dõi, chưa có danh sách cụ thể.' : 'Sự vụ này hiện chưa có người theo dõi.'} />
            ) : (
              <div>
                <div className="border-b border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-6 dark:border-slate-800">
                  Người dân trong danh sách này đã đăng ký nhận cập nhật của sự vụ. Đây là thông tin theo dõi mức độ quan tâm, không phải danh sách người xử lý.
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subscribers.map((subscriber, index) => {
                    const name = subscriber?.fullName ?? subscriber?.name ?? subscriber?.userName ?? subscriber?.displayName ?? 'Người theo dõi';
                    const contact = subscriber?.email ?? subscriber?.phoneNumber ?? subscriber?.phone ?? '';
                    const subscribedAt = subscriber?.subscribedAt ?? subscriber?.createdAt ?? subscriber?.followedAt;
                    const meta = [contact, subscribedAt ? `Theo dõi từ ${formatDateTime(subscribedAt)}` : ''].filter(Boolean).join(' · ');
                    return (
                      <div key={subscriber?.subscriberId ?? subscriber?.userId ?? subscriber?.id ?? index} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{String(name).trim().slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                          {meta ? <p className="mt-1 truncate text-xs text-slate-500">{meta}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : null}

          {activeTab === 'events' ? (
            timelineLoading && timeline.length === 0 ? <PanelSkeleton /> : timelineError && timeline.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <Lucide.TriangleAlert size={28} className="text-amber-500" />
                <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Không thể tải lịch sử hoạt động</p>
                <p className="mt-1 text-sm text-slate-500">{timelineError}</p>
                <button type="button" onClick={loadTimeline} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Lucide.RefreshCcw size={14} />Thử lại</button>
              </div>
            ) : timeline.length === 0 ? (
              <EmptyState icon={Lucide.History} title="Chưa có lịch sử hoạt động" description="Các thay đổi của sự vụ sẽ được hiển thị tại đây khi có dữ liệu lịch sử." />
            ) : (
              <div className="px-5 py-5 sm:px-6">
                {(timelineLoading || timelineError) ? (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {timelineLoading ? <ManagerListRefreshIndicator visible label="Đang cập nhật lịch sử" /> : null}
                    {timelineError ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
                        <Lucide.TriangleAlert size={12} />Không thể cập nhật lịch sử mới
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="relative space-y-5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                  {timelinePresentation.visibleEvents.map((event, index) => {
                    const rawTitle = event?.title ?? event?.eventName ?? event?.eventType ?? event?.type ?? event?.action;
                    const payload = parseEventPayload(event?.payloadJson ?? event?.payload);
                    const isNoopStatusChange = normalizeKey(rawTitle) === 'statuschanged'
                      && payload.oldStatus
                      && payload.newStatus
                      && normalizeKey(payload.oldStatus) === normalizeKey(payload.newStatus);
                    const titleText = isNoopStatusChange ? 'Đã cập nhật trạng thái' : getEventLabel(rawTitle);
                    const rawDescription = event?.description ?? event?.message ?? event?.note ?? event?.details ?? '';
                    const description = localizeIncidentSystemText(rawDescription);
                    const actor = event?.actorUserName ?? event?.actorName ?? event?.userName ?? event?.createdByName ?? event?.performedBy ?? '';
                    const eventTime = event?.createdAt ?? event?.occurredAt ?? event?.timestamp ?? event?.eventAt;
                    const eventDetails = getEventDetails(event);
                    return (
                      <div key={event?.incidentEventId ?? event?.eventId ?? event?.id ?? index} className="relative flex gap-4 pl-0">
                        <span className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-blue-600 bg-white dark:bg-slate-950" />
                        <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titleText}</p>
                            <span className="text-xs text-slate-400">{formatDateTime(eventTime)}</span>
                          </div>
                          {description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
                          {eventDetails.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                              {eventDetails.map((detail) => (
                                <p key={`${detail.label}-${detail.value}`} className="text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-medium text-slate-400 dark:text-slate-500">{detail.label}: </span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{detail.value}</span>
                                </p>
                              ))}
                            </div>
                          ) : null}
                          {actor ? <p className="mt-2 text-xs font-medium text-slate-500">Thực hiện bởi: {actor}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {timelinePresentation.remainingCount > 0 || timelinePresentation.canCollapse ? (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {timelinePresentation.remainingCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setTimelineVisibleCount((current) => current + 6)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
                      >
                        <Lucide.ChevronDown size={15} />
                        Xem thêm {Math.min(6, timelinePresentation.remainingCount)} sự kiện
                      </button>
                    ) : null}
                    {timelinePresentation.canCollapse ? (
                      <button
                        type="button"
                        onClick={() => setTimelineVisibleCount(6)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Lucide.ChevronUp size={15} />Thu gọn
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </section>

      {lightboxIndex !== null && reportGalleryItems[lightboxIndex] && typeof document !== 'undefined' ? createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-md sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Xem hình ảnh phản ánh"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxIndex(null);
          }}
        >
          <button type="button" onClick={() => setLightboxIndex(null)} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur hover:bg-slate-900" aria-label="Đóng ảnh">
            <Lucide.X size={20} />
          </button>
          {reportGalleryItems.length > 1 ? (
            <>
              <button type="button" onClick={() => setLightboxIndex((current) => (current - 1 + reportGalleryItems.length) % reportGalleryItems.length)} className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur hover:bg-slate-900 sm:left-6" aria-label="Ảnh trước">
                <Lucide.ChevronLeft size={24} />
              </button>
              <button type="button" onClick={() => setLightboxIndex((current) => (current + 1) % reportGalleryItems.length)} className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur hover:bg-slate-900 sm:right-6" aria-label="Ảnh tiếp theo">
                <Lucide.ChevronRight size={24} />
              </button>
            </>
          ) : null}
          <div className="flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-3">
            <img src={reportGalleryItems[lightboxIndex].url} alt={`Hình ảnh từ ${reportGalleryItems[lightboxIndex].title}`} className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            <div className="rounded-xl bg-slate-950/55 px-3 py-2 text-center text-xs font-medium text-white/90 backdrop-blur">
              {reportGalleryItems[lightboxIndex].title} · {lightboxIndex + 1}/{reportGalleryItems.length}
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {!adminReadOnly && editModalOpen ? createPortal(
        <div className="fixed inset-0 z-[11000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="edit-incident-title">
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div>
                <h3 id="edit-incident-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">Sửa mức độ sự vụ</h3>
                <p className="mt-1 text-sm text-slate-500">Cập nhật thông tin, độ ưu tiên và mức nghiêm trọng.</p>
              </div>
              <button type="button" onClick={() => setEditModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Đóng"><Lucide.X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="space-y-4">
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Tiêu đề<input value={editForm.title} onChange={(e) => setEditForm((v) => ({ ...v, title: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-800 dark:bg-slate-900" /></label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Mô tả<textarea value={editForm.description} onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal leading-5 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-800 dark:bg-slate-900" /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span>Độ ưu tiên</span>
                    <ManagerSelectMenu
                      value={editForm.priority}
                      options={PRIORITY_OPTIONS.map(([value, label]) => ({ value, label }))}
                      onChange={(value) => setEditForm((current) => ({ ...current, priority: value }))}
                      ariaLabel="Chọn độ ưu tiên sự vụ"
                      className="w-full font-normal"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span>Mức nghiêm trọng</span>
                    <ManagerSelectMenu
                      value={editForm.severity}
                      options={SEVERITY_OPTIONS.map(([value, label]) => ({ value, label }))}
                      onChange={(value) => setEditForm((current) => ({ ...current, severity: value }))}
                      ariaLabel="Chọn mức nghiêm trọng sự vụ"
                      className="w-full font-normal"
                    />
                  </label>
                </div>
                {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <button type="button" onClick={() => setEditModalOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200">Hủy</button>
              <button type="button" onClick={handleUpdateIncident} disabled={actionLoading === 'edit'} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">{actionLoading === 'edit' ? <Lucide.LoaderCircle size={15} className="animate-spin" /> : null}Lưu thay đổi</button>
            </div>
          </div>
        </div>
      , document.body) : null}

      {!adminReadOnly && statusModalOpen ? createPortal(
        <div className="fixed inset-0 z-[11000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="status-incident-title">
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div><h3 id="status-incident-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">Đổi trạng thái sự vụ</h3><p className="mt-1 text-sm text-slate-500">Chọn trạng thái nghiệp vụ mới cho sự vụ.</p></div>
              <button type="button" onClick={() => setStatusModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Đóng"><Lucide.X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span>Trạng thái mới</span>
                <ManagerSelectMenu
                  value={statusValue}
                  options={INCIDENT_STATUS_ACTION_OPTIONS.map(([value, label]) => ({ value, label }))}
                  onChange={setStatusValue}
                  ariaLabel="Chọn trạng thái mới cho sự vụ"
                  className="w-full font-normal"
                />
              </label>
              {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800"><button type="button" onClick={() => setStatusModalOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200">Hủy</button><button type="button" onClick={handleUpdateStatus} disabled={actionLoading === 'status'} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">{actionLoading === 'status' ? <Lucide.LoaderCircle size={15} className="animate-spin" /> : null}Cập nhật</button></div>
          </div>
        </div>
      , document.body) : null}

      {!adminReadOnly && assignModalOpen ? createPortal(
        <div className="fixed inset-0 z-[11000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="assign-incident-title">
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div>
                <h3 id="assign-incident-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">{hasCurrentAssignee ? 'Đổi người phụ trách' : 'Phân công nhân viên'}</h3>
                <p className="mt-1 text-sm text-slate-500">Chọn nhân viên phù hợp với phường và danh mục của sự vụ.</p>
              </div>
              <button type="button" onClick={() => setAssignModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Đóng"><Lucide.X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {hasCurrentAssignee ? (
                <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-blue-500">Đang phụ trách</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{currentAssigneeName || `Nhân viên ${String(currentAssigneeId).slice(0, 8)}`}</p>
                </div>
              ) : null}
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                {assigneeLoading ? (
                  <PanelSkeleton />
                ) : assigneeCandidates.length === 0 ? (
                  <EmptyState
                    icon={Lucide.UserRoundX}
                    title="Không có nhân viên phù hợp"
                    description="Không tìm thấy nhân viên phù hợp với phạm vi phường và danh mục của sự vụ."
                  />
                ) : assigneeCandidates.map((candidate, index) => {
                  const id = getCandidateId(candidate);
                  const name = getCandidateName(candidate);
                  const workload = getCandidateWorkload(candidate);
                  const isCurrent = String(currentAssigneeId) && String(currentAssigneeId) === String(id);
                  return (
                    <label
                      key={id || index}
                      className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0 transition dark:border-slate-800 ${
                        String(selectedAssigneeId) === String(id)
                          ? 'bg-blue-50/80 dark:bg-blue-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="assignee"
                        value={id}
                        checked={String(selectedAssigneeId) === String(id)}
                        onChange={() => setSelectedAssigneeId(String(id))}
                      />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <Lucide.UserRound size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                          {isCurrent ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Hiện tại</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {candidate?.areaName ?? candidate?.wardName ?? areaName} · {candidate?.categoryName ?? candidate?.specialtyName ?? categoryName}
                          {workload !== null ? ` · ${workload} sự vụ đang phụ trách` : ''}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <button type="button" onClick={() => setAssignModalOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200">Hủy</button>
              <button
                type="button"
                onClick={handleAssignIncident}
                disabled={!selectedAssigneeId || actionLoading === 'assign' || (Boolean(currentAssigneeId) && String(selectedAssigneeId) === String(currentAssigneeId))}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === 'assign' ? <Lucide.LoaderCircle size={15} className="animate-spin" /> : null}
                {hasCurrentAssignee ? 'Cập nhật phân công' : 'Phân công'}
              </button>
            </div>
          </div>
        </div>
      , document.body) : null}

      {approvalDecision && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[11020] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="incident-approval-decision-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !approvalSubmitting) { setApprovalDecision(''); setApprovalNote(''); setActionError(''); } }}>
          <section className="w-full max-w-lg overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.32)] dark:border-slate-700 dark:bg-slate-950">
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${approvalDecision === 'approve' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {approvalDecision === 'approve' ? <Lucide.BadgeCheck size={21} /> : <Lucide.RotateCcw size={21} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="incident-approval-decision-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">{approvalDecision === 'approve' ? 'Phê duyệt kết quả xử lý?' : 'Yêu cầu làm lại kết quả?'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{approvalDecision === 'approve' ? 'Xác nhận sự vụ đã được xử lý đạt yêu cầu. Quyết định sẽ được lưu vào lịch sử sự vụ.' : 'Nêu rõ nội dung cần bổ sung hoặc xử lý lại để nhân viên tiếp tục thực hiện.'}</p>
                </div>
              </div>
              <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                {approvalDecision === 'approve' ? 'Ghi chú (không bắt buộc)' : 'Lý do yêu cầu làm lại'}
                <textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} rows={4} placeholder={approvalDecision === 'approve' ? 'Ghi chú thêm cho quyết định duyệt...' : 'Ví dụ: ảnh minh chứng chưa thể hiện rõ kết quả xử lý...'} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              </label>
              {actionError ? <p className="mt-3 text-sm font-medium text-rose-600">{actionError}</p> : null}
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <button type="button" disabled={approvalSubmitting} onClick={() => { setApprovalDecision(''); setApprovalNote(''); setActionError(''); }} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200">Hủy</button>
              <button type="button" disabled={approvalSubmitting || (approvalDecision === 'rework' && !approvalNote.trim())} onClick={handleApprovalDecision} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${approvalDecision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {approvalSubmitting ? <Lucide.LoaderCircle size={15} className="animate-spin" /> : null}
                {approvalDecision === 'approve' ? 'Xác nhận phê duyệt' : 'Gửi yêu cầu làm lại'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}

      <ManagerConfirmDialog
        open={!adminReadOnly && Boolean(confirmAction)}
        title={confirmAction?.title || 'Xác nhận thao tác'}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.type === 'merge' ? 'Gộp sự vụ' : confirmAction?.type === 'link-report' ? 'Xác nhận liên kết' : 'Gỡ liên kết'}
        tone={confirmAction?.type === 'merge' || confirmAction?.type === 'link-report' ? 'warning' : 'danger'}
        loading={actionLoading === 'merge' || Boolean(unlinkingFeedbackId) || Boolean(linkingFeedbackId)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirmAction?.type === 'merge' ? confirmMergeIncident : confirmAction?.type === 'link-report' ? confirmLinkReport : confirmUnlinkReport}
      />

      {!adminReadOnly && mergeModalOpen ? createPortal(
        <div className="fixed inset-0 z-[11000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="merge-incident-title">
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div><h3 id="merge-incident-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">Gộp sự vụ</h3><p className="mt-1 text-sm text-slate-500">Chọn chiều gộp trước, sau đó chọn sự vụ còn lại.</p></div>
              <button type="button" onClick={() => setMergeModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Đóng"><Lucide.X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="mb-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setMergeMode('into-current'); setSelectedMergeIncidentId(''); setSelectedMergeIncidentIds([]); }}
                    className={`rounded-2xl border p-3 text-left transition ${mergeMode === 'into-current' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'} dark:border-slate-800 dark:bg-slate-900`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Lucide.ArrowDownToLine size={16} className="text-blue-600" />Gộp sự vụ khác vào sự vụ này</span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-500">Giữ {formatIncidentId(incident?.incidentId ?? incident?.id ?? incidentId)} làm sự vụ chính.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMergeMode('current-into-other'); setSelectedMergeIncidentId(''); setSelectedMergeIncidentIds([]); }}
                    className={`rounded-2xl border p-3 text-left transition ${mergeMode === 'current-into-other' ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'} dark:border-slate-800 dark:bg-slate-900`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Lucide.ArrowUpFromLine size={16} className="text-amber-600" />Gộp sự vụ này vào sự vụ khác</span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-500">Sự vụ được chọn sẽ được giữ làm sự vụ chính.</span>
                  </button>
                </div>
                <div className={`rounded-xl border px-3.5 py-2.5 text-xs leading-5 ${mergeMode === 'into-current' ? 'border-blue-100 bg-blue-50/70 text-blue-700' : 'border-amber-100 bg-amber-50/70 text-amber-700'}`}>
                  {mergeMode === 'into-current'
                    ? 'Chọn sự vụ nguồn muốn đưa vào sự vụ đang mở.'
                    : 'Chọn sự vụ đích sẽ nhận sự vụ đang mở.'}
                </div>
                <label className="relative block">
                  <Lucide.Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={mergeSearch}
                    onChange={(event) => setMergeSearch(event.target.value)}
                    placeholder="Tìm mã, tiêu đề, nội dung hoặc khu vực..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Lọc nhanh</span>
                  <button
                    type="button"
                    onClick={() => setMergeSameAreaOnly((value) => !value)}
                    disabled={!incident?.areaId && !incident?.area?.areaId && !incident?.area?.id}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${mergeSameAreaOnly ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Lucide.MapPin size={13} />Cùng phường
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergeSameCategoryOnly((value) => !value)}
                    disabled={!incident?.categoryId && !incident?.category?.categoryId && !incident?.category?.id}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${mergeSameCategoryOnly ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Lucide.Tags size={13} />Cùng danh mục
                  </button>
                  {(mergeSearch || mergeSameAreaOnly || mergeSameCategoryOnly) ? (
                    <button type="button" onClick={() => { setMergeSearch(''); setMergeSameAreaOnly(false); setMergeSameCategoryOnly(false); }} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">Xóa lọc</button>
                  ) : null}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">{mergeLoading ? <PanelSkeleton /> : mergeCandidates.length === 0 ? <EmptyState icon={Lucide.SearchX} title="Không tìm thấy sự vụ phù hợp" description="Thử từ khóa khác hoặc xóa bộ lọc để xem thêm sự vụ." /> : mergeCandidates.map((item, index) => { const id = item?.incidentId ?? item?.id; const mergeLocked = isIncidentPastMergeStage(item); return <label key={id || index} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800 ${mergeLocked ? 'cursor-not-allowed bg-slate-50/70 opacity-65 dark:bg-slate-900/40' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900'}`}><input
                  type={mergeMode === 'into-current' ? 'checkbox' : 'radio'}
                  name={mergeMode === 'into-current' ? undefined : 'merge-incident'}
                  value={id}
                  disabled={mergeLocked}
                  checked={mergeMode === 'into-current' ? selectedMergeIncidentIds.includes(String(id)) : String(selectedMergeIncidentId) === String(id)}
                  onChange={() => {
                    if (mergeMode === 'into-current') {
                      setSelectedMergeIncidentIds((current) => current.includes(String(id)) ? current.filter((currentId) => currentId !== String(id)) : [...current, String(id)]);
                      return;
                    }
                    setSelectedMergeIncidentId(String(id));
                  }}
                /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item?.title ?? item?.summary ?? 'Sự vụ chưa có tiêu đề'}</p>{mergeLocked ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Đã qua giai đoạn gộp</span> : null}</div><p className="mt-1 text-xs text-slate-500">{formatIncidentId(id)} · {item?.areaName ?? item?.wardName ?? 'Chưa rõ khu vực'} · {item?.categoryName ?? 'Chưa phân loại'}</p></div><Badge value={item?.status} type="status" /></label>; })}</div>
              {mergeHasMore ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => loadMergeCandidates({
                      search: mergeSearch,
                      sameAreaOnly: mergeSameAreaOnly,
                      sameCategoryOnly: mergeSameCategoryOnly,
                      pageNumber: mergePageNumber + 1,
                      append: true,
                    })}
                    disabled={mergeLoading || mergeLoadingMore}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {mergeLoadingMore ? <Lucide.LoaderCircle size={14} className="animate-spin" /> : <Lucide.Plus size={14} />}
                    {mergeLoadingMore ? 'Đang tải thêm...' : 'Tải thêm sự vụ'}
                  </button>
                </div>
              ) : null}
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Lý do gộp <span className="font-normal text-slate-400">(không bắt buộc)</span></span>
                <textarea value={mergeReason} onChange={(event) => setMergeReason(event.target.value)} rows={3} placeholder="Ví dụ: Hai sự vụ phản ánh cùng một vấn đề tại cùng khu vực." className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-amber-950/30" />
                <span className="mt-1.5 block text-xs text-slate-500">Lý do sẽ được gửi cùng thao tác gộp để hỗ trợ theo dõi lịch sử xử lý.</span>
              </label>
              {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800"><span className="text-xs font-medium text-slate-500">{mergeMode === 'into-current' && selectedMergeIncidentIds.length > 0 ? `Đã chọn ${selectedMergeIncidentIds.length} sự vụ` : ''}</span><div className="flex gap-2"><button type="button" onClick={() => setMergeModalOpen(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200">Hủy</button><button type="button" onClick={handleMergeIncident} disabled={(mergeMode === 'into-current' ? selectedMergeIncidentIds.length === 0 : !selectedMergeIncidentId) || actionLoading === 'merge'} className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60">{actionLoading === 'merge' ? <Lucide.LoaderCircle size={15} className="animate-spin" /> : null}{mergeMode === 'into-current' ? (selectedMergeIncidentIds.length > 1 ? `Gộp ${selectedMergeIncidentIds.length} sự vụ vào sự vụ này` : 'Gộp vào sự vụ này') : 'Gộp sang sự vụ đã chọn'}</button></div></div>
          </div>
        </div>
      , document.body) : null}

      {!adminReadOnly && linkModalOpen ? createPortal(
        <div className="fixed inset-0 z-[11000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="link-report-title">
          <div className="flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div><h3 id="link-report-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">Liên kết phản ánh vào sự vụ</h3><p className="mt-1 text-sm text-slate-500">Chỉ hiển thị phản ánh chưa thuộc sự vụ đang hoạt động. Liên kết thủ công sẽ được lưu vào lịch sử sự vụ.</p></div>
              <button type="button" onClick={() => setLinkModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Đóng"><Lucide.X size={18} /></button>
            </div>
            <div className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <label className="relative block"><Lucide.Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={feedbackSearch} onChange={(event) => setFeedbackSearch(event.target.value)} placeholder="Tìm theo tiêu đề hoặc nội dung phản ánh..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 dark:border-slate-800 dark:bg-slate-900" /></label>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <LinkFilterDropdown
                  value={feedbackAreaFilter}
                  options={[["", "Tất cả phường"], ...feedbackFilterOptions.areas]}
                  onChange={setFeedbackAreaFilter}
                  icon={Lucide.MapPin}
                  ariaLabel="Lọc theo phường"
                />
                <LinkFilterDropdown
                  value={feedbackCategoryFilter}
                  options={[["", "Tất cả danh mục"], ...feedbackFilterOptions.categories]}
                  onChange={setFeedbackCategoryFilter}
                  icon={Lucide.Shapes}
                  ariaLabel="Lọc theo danh mục"
                />
                <LinkFilterDropdown
                  value={feedbackStatusFilter}
                  options={[["", "Tất cả trạng thái"], ...feedbackFilterOptions.statuses]}
                  onChange={setFeedbackStatusFilter}
                  icon={Lucide.CircleDotDashed}
                  ariaLabel="Lọc theo trạng thái"
                />
              </div>
              {hasFeedbackFilters ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setFeedbackAreaFilter(''); setFeedbackCategoryFilter(''); setFeedbackStatusFilter(''); }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900"
                  >
                    <Lucide.RotateCcw size={13} aria-hidden="true" />
                    Xóa bộ lọc
                  </button>
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {feedbackLoading && feedbackCandidates.length === 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Đang tải phản ánh có thể liên kết">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
                        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
                        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
                      </div>
                      <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
                    </div>
                  ))}
                </div>
              ) : feedbackError && feedbackCandidates.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-rose-600">{feedbackError}</div>
              ) : availableFeedbackCandidates.length === 0 ? <EmptyState icon={Lucide.SearchX} title="Không có phản ánh có thể liên kết" description={hasFeedbackFilters ? 'Không có phản ánh phù hợp với bộ lọc hiện tại. Hãy thử xóa bớt bộ lọc.' : feedbackCandidates.length > 0 ? 'Các phản ánh trong kết quả hiện đã thuộc sự vụ đang hoạt động. Hãy tìm phản ánh khác.' : 'Thử từ khóa khác hoặc xóa nội dung tìm kiếm.'} /> : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {availableFeedbackCandidates.map((feedback, index) => {
                    const feedbackId = getFeedbackId(feedback) || index;
                    const areaName = feedback?.areaName ?? feedback?.wardName ?? feedback?.area?.name ?? 'Chưa rõ khu vực';
                    const categoryName = feedback?.categoryName ?? feedback?.category?.name ?? 'Chưa phân loại';
                    return (
                      <div key={feedbackId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{getFeedbackTitle(feedback)}</p><Badge value={getFeedbackStatus(feedback)} type="status" /></div>
                          <p className="mt-1 text-xs text-slate-500">{getFeedbackReporter(feedback)} · {formatDateTime(feedback?.createdAt)}</p>
                          <p className="mt-1 truncate text-xs text-slate-400" title={`${areaName} · ${categoryName}`}>{areaName} · {categoryName}</p>
                        </div>
                        <button type="button" disabled={Boolean(linkingFeedbackId)} onClick={() => handleLinkReport(feedback)} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Lucide.Link2 size={14} />Liên kết phản ánh</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {feedbackHasMore && feedbackCandidates.length > 0 ? (
                <div className="border-t border-slate-100 px-5 py-3 text-center sm:px-6 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => loadFeedbackCandidates({ pageNumber: feedbackPageNumber + 1, append: true })}
                    disabled={feedbackLoading}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {feedbackLoading ? <Lucide.LoaderCircle size={14} className="animate-spin" /> : <Lucide.Plus size={14} />}
                    {feedbackLoading ? 'Đang tải thêm...' : 'Tải thêm phản ánh'}
                  </button>
                </div>
              ) : null}
              {feedbackLoading && feedbackCandidates.length > 0 && !feedbackHasMore ? (
                <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-2.5 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-950/95">
                  <ManagerListRefreshIndicator visible label="Đang cập nhật danh sách" />
                </div>
              ) : null}
              {feedbackError && feedbackCandidates.length > 0 ? (
                <div className="sticky bottom-0 border-t border-amber-100 bg-amber-50/95 px-5 py-2.5 text-xs font-medium text-amber-700 backdrop-blur sm:px-6 dark:border-amber-900/40 dark:bg-amber-950/90 dark:text-amber-200">
                  Không thể cập nhật danh sách mới. Kết quả hiện tại vẫn được giữ nguyên.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      , document.body) : null}
    </div>
  );
};

export const ManagerIncidentDetailPage = IncidentDetailPage;
