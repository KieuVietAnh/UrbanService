// src/pages/tickets/TicketListPage.jsx
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { ticketApi } from '../../services/api/ticketApi';
import { toolsApi } from '@urbanmind/shared-api';
import { getStatusLabel, managementTypes } from '@urbanmind/shared-types';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import PublicPageMotion from '../../components/public/PublicPageMotion';
import ticketHeroArt from '../../assets/community-hero-option-a.png';
import ticketSideArt from '../../assets/citizen-tickets-side-art.png';
import {
  cacheTicketPreview,
  getCachedTicketPreviewUrl,
  hasSettledTicketPreview,
  readTicketPreviewCache,
  writeTicketPreviewCache,
} from './ticketPreviewCache';

const TICKET_LIST_SNAPSHOT_STORAGE_KEY =
  'urbanmind-service-user-ticket-list-snapshot';
const TICKET_CATEGORY_SNAPSHOT_STORAGE_KEY =
  'urbanmind-service-user-ticket-category-snapshot';
const TICKET_LIST_RETURN_STORAGE_KEY =
  'urbanmind-ticket-list-return';

const readSessionArray = (storageKey) => {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const writeSessionArray = (storageKey, items) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify(items)
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};


const readTicketListReturnContext = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.sessionStorage.getItem(
      TICKET_LIST_RETURN_STORAGE_KEY
    );
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object'
      ? parsedValue
      : null;
  } catch {
    return null;
  }
};

const writeTicketListReturnContext = (context) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      TICKET_LIST_RETURN_STORAGE_KEY,
      JSON.stringify(context)
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};

const STATUS_FILTER_VALUES = {
  ALL: '',
  PROCESSING: '__processing__',
  CHECKING: '__checking__',
  RESULTS: '__results__',
  AWAITING_REVIEW: managementTypes.feedbackStatus.APPROVED,
  ENDED: managementTypes.feedbackStatus.CLOSED,
};

const PROCESSING_STATUSES = new Set([
  managementTypes.feedbackStatus.SUBMITTED,
  managementTypes.feedbackStatus.AI_REVIEWED,
  managementTypes.feedbackStatus.VERIFIED,
  managementTypes.feedbackStatus.ASSIGNED,
  managementTypes.feedbackStatus.IN_PROGRESS,
  managementTypes.feedbackStatus.NEED_REWORK,
]);

const CHECKING_STATUSES = new Set([
  managementTypes.feedbackStatus.RESOLVED,
  managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
]);

const RESULT_STATUSES = new Set([
  managementTypes.feedbackStatus.RESOLVED,
  managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
  managementTypes.feedbackStatus.APPROVED,
  managementTypes.feedbackStatus.CLOSED,
]);

const STATUS_QUERY_VALUES = {
  processing: STATUS_FILTER_VALUES.PROCESSING,
  checking: STATUS_FILTER_VALUES.CHECKING,
  results: STATUS_FILTER_VALUES.RESULTS,
  'awaiting-review': STATUS_FILTER_VALUES.AWAITING_REVIEW,
  ended: STATUS_FILTER_VALUES.ENDED,
};

const getStatusFilterFromQuery = (queryValue) => (
  STATUS_QUERY_VALUES[queryValue] || ''
);

const getStatusQueryValue = (statusValue) => {
  const matchedEntry = Object.entries(STATUS_QUERY_VALUES)
    .find(([, value]) => String(value) === String(statusValue));

  return matchedEntry?.[0] || '';
};

const STATUS_OPTIONS = [
  { value: STATUS_FILTER_VALUES.ALL, label: 'Tất cả trạng thái' },
  { value: STATUS_FILTER_VALUES.PROCESSING, label: 'Đang xử lý' },
  { value: STATUS_FILTER_VALUES.CHECKING, label: 'Đang kiểm tra kết quả' },
  { value: STATUS_FILTER_VALUES.RESULTS, label: 'Có kết quả' },
  { value: STATUS_FILTER_VALUES.AWAITING_REVIEW, label: 'Chờ bạn đánh giá' },
  { value: STATUS_FILTER_VALUES.ENDED, label: 'Đã kết thúc' },
  { value: managementTypes.feedbackStatus.REJECTED, label: 'Không tiếp nhận' },
  { value: managementTypes.feedbackStatus.CANCELLED, label: 'Đã hủy' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Cập nhật mới nhất' },
  { value: 'oldest', label: 'Cũ nhất trước' },
  { value: 'status', label: 'Tiến trình xử lý' },
];

const CATEGORY_LABELS = {
  Drainage: 'Thoát nước',
  'Garbage Collection': 'Thu gom rác',
  'Public Safety': 'An toàn công cộng',
  'Road Maintenance': 'Bảo trì đường bộ',
  'Street Lighting': 'Chiếu sáng đô thị',
  'Water Supply': 'Cấp nước',
};

const getCategoryLabel = (categoryName) => (
  CATEGORY_LABELS[categoryName] || categoryName || 'Chưa phân loại'
);


const getTicketId = (ticket) => (
  ticket?.feedbackId ||
  ticket?.feedbackID ||
  ticket?.id ||
  ticket?.feedback?.feedbackId ||
  ticket?.feedback?.id ||
  ''
);


const formatDate = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không xác định';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const RECENT_STATUS_DOT_CLASSES = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-400',
};

const getCitizenStatusMeta = (status) => {
  const statusMap = {
    [managementTypes.feedbackStatus.SUBMITTED]: {
      label: 'Đã tiếp nhận',
      icon: Lucide.Inbox,
      tone: 'blue',
    },
    [managementTypes.feedbackStatus.AI_REVIEWED]: {
      label: 'Đang phân loại',
      icon: Lucide.ScanSearch,
      tone: 'violet',
    },
    [managementTypes.feedbackStatus.VERIFIED]: {
      label: 'Đã xác minh',
      icon: Lucide.BadgeCheck,
      tone: 'blue',
    },
    [managementTypes.feedbackStatus.ASSIGNED]: {
      label: 'Đã chuyển xử lý',
      icon: Lucide.Send,
      tone: 'blue',
    },
    [managementTypes.feedbackStatus.IN_PROGRESS]: {
      label: 'Đang xử lý',
      icon: Lucide.LoaderCircle,
      tone: 'amber',
    },
    [managementTypes.feedbackStatus.RESOLVED]: {
      label: 'Đang kiểm tra kết quả',
      icon: Lucide.ClipboardCheck,
      tone: 'amber',
    },
    [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: {
      label: 'Đang kiểm tra kết quả',
      icon: Lucide.ClipboardCheck,
      tone: 'amber',
    },
    [managementTypes.feedbackStatus.NEED_REWORK]: {
      label: 'Cần bổ sung xử lý',
      icon: Lucide.RotateCcw,
      tone: 'amber',
    },
    [managementTypes.feedbackStatus.APPROVED]: {
      label: 'Chờ bạn đánh giá',
      icon: Lucide.Star,
      tone: 'green',
    },
    [managementTypes.feedbackStatus.CLOSED]: {
      label: 'Đã kết thúc',
      icon: Lucide.CircleCheckBig,
      tone: 'green',
    },
    [managementTypes.feedbackStatus.REJECTED]: {
      label: 'Không tiếp nhận',
      icon: Lucide.CircleX,
      tone: 'red',
    },
    [managementTypes.feedbackStatus.CANCELLED]: {
      label: 'Đã hủy',
      icon: Lucide.Ban,
      tone: 'slate',
    },
  };

  return statusMap[status] || {
    label: getStatusLabel(status, 'Đang cập nhật'),
    icon: Lucide.Clock3,
    tone: 'slate',
  };
};

const CitizenTicketThemeStyles = () => (
  <style>{`
    .citizen-ticket-page {
      overflow-anchor: none;
      --ticket-blue: #2563eb;
      --ticket-blue-soft: rgba(37, 99, 235, 0.08);
      --ticket-blue-border: rgba(37, 99, 235, 0.2);
      --ticket-amber: #b45309;
      --ticket-amber-soft: rgba(245, 158, 11, 0.1);
      --ticket-amber-border: rgba(245, 158, 11, 0.24);
      --ticket-green: #047857;
      --ticket-green-soft: rgba(16, 185, 129, 0.1);
      --ticket-green-border: rgba(16, 185, 129, 0.22);
      --ticket-red: #b91c1c;
      --ticket-red-soft: rgba(239, 68, 68, 0.08);
      --ticket-red-border: rgba(239, 68, 68, 0.2);
      --ticket-slate: #64748b;
      --ticket-slate-soft: rgba(100, 116, 139, 0.08);
      --ticket-slate-border: rgba(100, 116, 139, 0.18);
    }

    .citizen-ticket-hero,
    .citizen-ticket-panel,
    .citizen-ticket-side-card {
      border-color: var(--public-border);
      background: var(--public-surface);
      box-shadow: 0 16px 44px rgba(15, 23, 42, 0.055);
    }

    .citizen-ticket-hero {
      background:
        radial-gradient(circle at 88% 18%, rgba(56, 189, 248, 0.13), transparent 30%),
        radial-gradient(circle at 10% 0%, rgba(37, 99, 235, 0.08), transparent 30%),
        linear-gradient(145deg, rgba(255,255,255,0.99), rgba(247,251,255,0.98));
    }

    .citizen-ticket-hero-art {
      mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.32) 20%, #000 58%);
      -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.32) 20%, #000 58%);
    }

    .citizen-ticket-thumb {
      border-color: rgba(148, 163, 184, .24);
      background: linear-gradient(145deg, rgba(239,246,255,.96), rgba(248,250,252,.98));
    }

    .citizen-ticket-side-visual {
      background:
        radial-gradient(circle at 16% 18%, rgba(37, 99, 235, .08), transparent 26%),
        linear-gradient(155deg, rgba(255,255,255,.99), rgba(241,248,255,.96));
    }

    .citizen-ticket-attention {
      border-color: rgba(245, 158, 11, 0.3);
      background: linear-gradient(90deg, rgba(255, 251, 235, 0.98), rgba(255, 247, 214, 0.86));
      color: #92400e;
    }

    .citizen-ticket-tab {
      color: var(--public-copy);
      border-bottom: 2px solid transparent;
    }

    .citizen-ticket-tab:hover {
      color: var(--ticket-blue);
      background: rgba(37, 99, 235, 0.035);
    }

    .citizen-ticket-tab.is-active {
      color: var(--ticket-blue);
      border-bottom-color: var(--ticket-blue);
      background: rgba(37, 99, 235, 0.045);
    }

    .citizen-ticket-tab-count {
      background: rgba(148, 163, 184, 0.14);
      color: var(--public-copy);
    }

    .citizen-ticket-tab.is-active .citizen-ticket-tab-count {
      background: var(--ticket-blue);
      color: #fff;
    }

    .citizen-ticket-control,
    .citizen-ticket-input {
      border-color: var(--public-border);
      background: var(--public-surface-strong);
      color: var(--public-title);
    }

    .citizen-ticket-control:hover,
    .citizen-ticket-control:focus-visible,
    .citizen-ticket-input:focus {
      border-color: rgba(37, 99, 235, 0.45);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
    }

    .citizen-ticket-input::placeholder { color: var(--public-muted); }

    .citizen-ticket-menu {
      border-color: var(--public-border);
      background: var(--public-surface-strong);
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
    }

    .citizen-ticket-option { color: var(--public-copy); }
    .citizen-ticket-option:hover { background: var(--public-surface-soft); color: var(--public-title); }
    .citizen-ticket-option.is-selected { background: var(--ticket-blue-soft); color: var(--ticket-blue); }

    .citizen-ticket-divider { border-color: var(--public-border); }

    .citizen-ticket-card {
      border-color: var(--public-border);
      background: var(--public-surface-strong);
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.035);
    }

    .citizen-ticket-card:hover {
      border-color: rgba(37, 99, 235, 0.28);
      transform: translateY(-1px);
      box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
    }

    .citizen-ticket-card.is-returned {
      animation: citizen-ticket-return-highlight 2.5s ease-out both;
    }

    @keyframes citizen-ticket-return-highlight {
      0%, 68% {
        border-color: rgba(37, 99, 235, 0.42);
        background: rgba(239, 246, 255, 0.72);
        box-shadow: 0 0 0 3px rgba(37,99,235,.1), 0 14px 34px rgba(15,23,42,.07);
      }
      100% {
        border-color: var(--public-border);
        background: var(--public-surface-strong);
        box-shadow: 0 8px 28px rgba(15,23,42,.035);
      }
    }

    .citizen-ticket-row-icon {
      border-color: rgba(37, 99, 235, 0.16);
      background: rgba(37, 99, 235, 0.07);
      color: var(--ticket-blue);
    }

    .citizen-status {
      border-color: var(--status-border);
      background: var(--status-soft);
      color: var(--status-color);
    }
    .citizen-status-blue { --status-color: var(--ticket-blue); --status-soft: var(--ticket-blue-soft); --status-border: var(--ticket-blue-border); }
    .citizen-status-violet { --status-color: #6d28d9; --status-soft: rgba(109,40,217,.08); --status-border: rgba(109,40,217,.18); }
    .citizen-status-amber { --status-color: var(--ticket-amber); --status-soft: var(--ticket-amber-soft); --status-border: var(--ticket-amber-border); }
    .citizen-status-green { --status-color: var(--ticket-green); --status-soft: var(--ticket-green-soft); --status-border: var(--ticket-green-border); }
    .citizen-status-red { --status-color: var(--ticket-red); --status-soft: var(--ticket-red-soft); --status-border: var(--ticket-red-border); }
    .citizen-status-slate { --status-color: var(--ticket-slate); --status-soft: var(--ticket-slate-soft); --status-border: var(--ticket-slate-border); }

    .citizen-ticket-primary-button {
      background: #2563eb;
      color: #fff;
      box-shadow: 0 10px 22px rgba(37,99,235,.18);
    }
    .citizen-ticket-primary-button:hover { background: #1d4ed8; transform: translateY(-1px); }

    .citizen-ticket-secondary-button {
      border-color: var(--public-border);
      background: var(--public-surface-strong);
      color: var(--public-title);
    }
    .citizen-ticket-secondary-button:hover { border-color: rgba(37,99,235,.3); color: var(--ticket-blue); background: var(--public-surface-soft); }

    .citizen-ticket-skeleton-strong { background: rgba(203,213,225,.78); }
    .citizen-ticket-skeleton-soft { background: rgba(226,232,240,.78); }

    .citizen-ticket-results-shell {
      transition: opacity 120ms ease;
    }


    .citizen-ticket-thumb-loading {
      background: linear-gradient(100deg, rgba(226,232,240,.78) 20%, rgba(248,250,252,.98) 42%, rgba(226,232,240,.78) 64%);
      background-size: 220% 100%;
      animation: citizen-ticket-thumb-shimmer 1.2s ease-in-out infinite;
    }

    @keyframes citizen-ticket-thumb-shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    html[data-theme="dark"] .citizen-ticket-page {
      --ticket-blue: #7db5ff;
      --ticket-blue-soft: rgba(37,99,235,.18);
      --ticket-blue-border: rgba(96,165,250,.28);
      --ticket-amber: #fbbf24;
      --ticket-amber-soft: rgba(217,119,6,.16);
      --ticket-amber-border: rgba(251,191,36,.26);
      --ticket-green: #6ee7b7;
      --ticket-green-soft: rgba(5,150,105,.17);
      --ticket-green-border: rgba(110,231,183,.24);
      --ticket-red: #fca5a5;
      --ticket-red-soft: rgba(220,38,38,.16);
      --ticket-red-border: rgba(248,113,113,.24);
      --ticket-slate: #a8b6ca;
      --ticket-slate-soft: rgba(100,116,139,.16);
      --ticket-slate-border: rgba(148,163,184,.2);
    }

    html[data-theme="dark"] .citizen-ticket-hero,
    html[data-theme="dark"] .citizen-ticket-panel,
    html[data-theme="dark"] .citizen-ticket-side-card,
    html[data-theme="dark"] .citizen-ticket-card {
      border-color: rgba(96,165,250,.16);
      background: linear-gradient(145deg, rgba(13,29,54,.98), rgba(8,20,40,.98));
      box-shadow: 0 20px 50px rgba(0,0,0,.24);
    }

    html[data-theme="dark"] .citizen-ticket-attention {
      border-color: rgba(251,191,36,.24);
      background: linear-gradient(90deg, rgba(120,53,15,.24), rgba(92,48,9,.16));
      color: #fcd34d;
    }

    html[data-theme="dark"] .citizen-ticket-control,
    html[data-theme="dark"] .citizen-ticket-input,
    html[data-theme="dark"] .citizen-ticket-menu,
    html[data-theme="dark"] .citizen-ticket-secondary-button {
      border-color: rgba(71,85,105,.62);
      background: rgba(7,18,36,.88);
      color: #f8fafc;
    }
  `}</style>
);
const FilterDropdown = ({
  menuId,
  value,
  options,
  onChange,
  icon: Icon,
  label,
  openMenu,
  setOpenMenu,
}) => {
  const isOpen = openMenu === menuId;
  const selectedOption = options.find(
    (option) => String(option.value) === String(value)
  ) || options[0];
  const useWideMenu = options.length > 4;

  return (
    <section className="relative min-w-0" data-ticket-menu>
      <button
        type="button"
        onClick={() => setOpenMenu(isOpen ? null : menuId)}
        className="citizen-ticket-control flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium outline-none transition"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon
          size={15}
          className="shrink-0 text-[var(--public-muted)]"
          aria-hidden="true"
        />
        <span
          className="min-w-0 flex-1 whitespace-nowrap text-left text-[13px] sm:text-sm"
          title={selectedOption?.label}
        >
          {selectedOption?.label}
        </span>
        <Lucide.ChevronDown
          size={15}
          className={`shrink-0 text-[var(--public-muted)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <menu
          className={`citizen-ticket-menu absolute z-50 mt-2 rounded-xl border p-1.5 ${
            menuId === 'status' || menuId === 'sort' ? 'right-0' : 'left-0'
          } ${
            useWideMenu
              ? 'w-[420px] max-w-[calc(100vw-2rem)] sm:grid sm:grid-cols-2 sm:gap-1'
              : 'w-full min-w-[220px]'
          }`}
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);

            return (
              <li key={String(option.value || 'all')}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpenMenu(null);
                  }}
                  className={`citizen-ticket-option flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected ? 'is-selected font-semibold' : ''
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="whitespace-nowrap">{option.label}</span>
                  {isSelected ? (
                    <Lucide.Check
                      size={15}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </menu>
      ) : null}
    </section>
  );
};

const StatusTab = ({ label, value, icon: Icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`citizen-ticket-tab flex min-h-14 items-center gap-2 px-4 text-sm font-semibold transition ${
      active ? 'is-active' : ''
    }`}
  >
    <Icon size={15} aria-hidden="true" />
    <span>{label}</span>
    <span className="citizen-ticket-tab-count inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold">
      {value}
    </span>
  </button>
);
const TicketThumbnail = ({ src, loading = false, className = 'h-[68px] w-[88px] rounded-[16px]' }) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !imageFailed;
  const showSkeleton = loading && !src;

  return (
    <span className={`citizen-ticket-thumb relative flex shrink-0 overflow-hidden border ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      {showSkeleton ? (
        <span className="citizen-ticket-thumb-loading absolute inset-0" aria-hidden="true" />
      ) : null}
      {!showImage && !showSkeleton ? (
        <span className="absolute inset-0 flex items-center justify-center bg-blue-500/5 text-blue-600" aria-hidden="true">
          <Lucide.Image size={18} />
        </span>
      ) : null}
    </span>
  );
};


const TicketListSkeleton = () => (
  <ol className="space-y-2.5" aria-hidden="true">
    {[0, 1, 2, 3].map((item) => (
      <li key={item}>
        <div className="citizen-ticket-card grid animate-pulse gap-4 rounded-[20px] border p-4 sm:px-5 sm:py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="citizen-ticket-skeleton-soft h-[68px] w-[88px] shrink-0 rounded-[16px]" />
            <div className="min-w-0 flex-1 pt-1">
              <div className="citizen-ticket-skeleton-strong h-4 w-72 max-w-[76%] rounded" />
              <div className="mt-3 flex flex-wrap gap-2.5">
                <div className="citizen-ticket-skeleton-soft h-3 w-44 rounded" />
                <div className="citizen-ticket-skeleton-soft h-3 w-24 rounded" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-[102px] lg:min-w-[330px] lg:justify-end lg:pl-0">
            <div className="citizen-ticket-skeleton-soft h-7 w-32 rounded-full" />
            <div className="citizen-ticket-skeleton-soft h-10 w-32 rounded-xl" />
          </div>
        </div>
      </li>
    ))}
  </ol>
);

export const TicketListPage = () => {
  const pageRootRef = useRef(null);
  const filtersSectionRef = useRef(null);
  const listSectionRef = useRef(null);
  const listScrollTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restoredContext] = useState(() => {
    const storedContext = readTicketListReturnContext();
    const restoreTicketId = location.state?.restoreTicketId;

    if (!restoreTicketId) return storedContext;

    return {
      ...(storedContext || {}),
      ticketId: restoreTicketId,
      pendingRestore: true,
    };
  });
  const restoreContextRef = useRef(restoredContext);
  const [cachedTickets] = useState(() => (
    readSessionArray(TICKET_LIST_SNAPSHOT_STORAGE_KEY)
  ));
  const [cachedCategories] = useState(() => (
    readSessionArray(TICKET_CATEGORY_SNAPSHOT_STORAGE_KEY)
  ));
  const [tickets, setTickets] = useState(cachedTickets);
  const [categories, setCategories] = useState(cachedCategories);
  const [search, setSearch] = useState(
    () => searchParams.get('search') || ''
  );
  const [status, setStatus] = useState(
    () => getStatusFilterFromQuery(
      searchParams.get('status')
    )
  );
  const [categoryId, setCategoryId] = useState(
    () => searchParams.get('category') || ''
  );
  const [sortKey, setSortKey] = useState(() => {
    const requestedSort = searchParams.get('sort');

    return SORT_OPTIONS.some(
      (option) => option.value === requestedSort
    )
      ? requestedSort
      : 'newest';
  });
  const [openMenu, setOpenMenu] = useState(null);
  const [loading, setLoading] = useState(
    cachedTickets.length === 0
  );
  const [refreshing, setRefreshing] = useState(
    cachedTickets.length > 0
  );
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(() => (
    Math.max(1, Number(restoredContext?.page) || 1)
  ));
  const [highlightedTicketId, setHighlightedTicketId] = useState('');
  const [ticketPreviewCache, setTicketPreviewCache] = useState(() => (
    readTicketPreviewCache()
  ));
  const [previewImageLoading, setPreviewImageLoading] = useState({});
  const previewRequestedIdsRef = useRef(new Set());
  const deferredSearch = useDeferredValue(search);
  const pageSize = 6;

  const loadTickets = useCallback(async () => {
    const hasCachedTickets = cachedTickets.length > 0;

    if (hasCachedTickets) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await ticketApi.getAllTickets(
        { pageSize: 100 },
        { role: 'service-user' }
      );
      const nextTickets = Array.isArray(response) ? response : [];

      setTickets(nextTickets);
      writeSessionArray(
        TICKET_LIST_SNAPSHOT_STORAGE_KEY,
        nextTickets
      );
    } catch (err) {
      console.error('Không thể tải danh sách phản ánh', err);

      if (!hasCachedTickets) {
        setTickets([]);
      }

      setError(err?.message || 'Không thể tải danh sách phản ánh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cachedTickets.length]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const nextSearchParams = new URLSearchParams();
    const trimmedSearch = search.trim();
    const statusQueryValue = getStatusQueryValue(status);

    if (trimmedSearch) {
      nextSearchParams.set('search', trimmedSearch);
    }
    if (statusQueryValue) {
      nextSearchParams.set('status', statusQueryValue);
    }
    if (categoryId) {
      nextSearchParams.set('category', String(categoryId));
    }
    if (sortKey !== 'newest') {
      nextSearchParams.set('sort', sortKey);
    }

    if (nextSearchParams.toString() === searchParams.toString()) {
      return;
    }

    setSearchParams(nextSearchParams, {
      replace: true,
      state: location.state,
      preventScrollReset: true,
    });
  }, [
    categoryId,
    location.state,
    search,
    searchParams,
    setSearchParams,
    sortKey,
    status,
  ]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const response = await toolsApi.getCategories();
        const nextCategories = Array.isArray(response)
          ? response
          : [];

        if (active) {
          setCategories(nextCategories);
          writeSessionArray(
            TICKET_CATEGORY_SNAPSHOT_STORAGE_KEY,
            nextCategories
          );
        }
      } catch (err) {
        console.warn('Không thể tải danh mục phản ánh', err);
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const closeMenus = (event) => {
      if (!event.target.closest('[data-ticket-menu]')) setOpenMenu(null);
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);


  const categoryOptions = useMemo(() => [
    { value: '', label: 'Tất cả danh mục' },
    ...categories.map((category) => ({
      value: category.categoryId,
      label: getCategoryLabel(category.categoryName),
    })),
  ], [categories]);

  const summary = useMemo(() => ({
    total: tickets.length,
    inProgress: tickets.filter(
      (ticket) => PROCESSING_STATUSES.has(ticket.status)
    ).length,
    checking: tickets.filter(
      (ticket) => CHECKING_STATUSES.has(ticket.status)
    ).length,
    awaitingReview: tickets.filter(
      (ticket) => ticket.status === managementTypes.feedbackStatus.APPROVED
    ).length,
    ended: tickets.filter(
      (ticket) => ticket.status === managementTypes.feedbackStatus.CLOSED
    ).length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const statusOrder = {
      [managementTypes.feedbackStatus.SUBMITTED]: 1,
      [managementTypes.feedbackStatus.AI_REVIEWED]: 2,
      [managementTypes.feedbackStatus.VERIFIED]: 3,
      [managementTypes.feedbackStatus.ASSIGNED]: 4,
      [managementTypes.feedbackStatus.IN_PROGRESS]: 5,
      [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: 6,
      [managementTypes.feedbackStatus.NEED_REWORK]: 7,
      [managementTypes.feedbackStatus.APPROVED]: 8,
      [managementTypes.feedbackStatus.CLOSED]: 9,
      [managementTypes.feedbackStatus.REJECTED]: 10,
      [managementTypes.feedbackStatus.CANCELLED]: 11,
    };

    return [...tickets]
      .filter((ticket) => {
        const matchesSearch = !query || [
          ticket.title,
          ticket.areaName,
          getCategoryLabel(ticket.categoryName),
        ].some((value) => String(value || '').toLowerCase().includes(query));

        const matchesStatus = (() => {
          if (!status) return true;
          if (status === STATUS_FILTER_VALUES.PROCESSING) {
            return PROCESSING_STATUSES.has(ticket.status);
          }
          if (status === STATUS_FILTER_VALUES.CHECKING) {
            return CHECKING_STATUSES.has(ticket.status);
          }
          if (status === STATUS_FILTER_VALUES.RESULTS) {
            return RESULT_STATUSES.has(ticket.status);
          }
          return ticket.status === status;
        })();
        const matchesCategory = categoryId
          ? String(ticket.categoryId) === String(categoryId)
          : true;

        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (sortKey === 'oldest') {
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        }

        if (sortKey === 'status') {
          return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        }

        return new Date(b.updatedAt || b.createdAt || 0)
          - new Date(a.updatedAt || a.createdAt || 0);
      });
  }, [categoryId, deferredSearch, sortKey, status, tickets]);

  const isFilterPending = deferredSearch !== search;
  const totalItems = filteredTickets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTickets = useMemo(
    () => filteredTickets.slice(startIndex, endIndex),
    [endIndex, filteredTickets, startIndex]
  );
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const savedContext = restoreContextRef.current;
    if (
      !savedContext?.pendingRestore ||
      loading ||
      filteredTickets.length === 0
    ) {
      return undefined;
    }

    const restoreTicketId = String(savedContext.ticketId || '');
    const restoredIndex = filteredTickets.findIndex((ticket) => (
      String(ticket.feedbackId || ticket.id) === restoreTicketId
    ));

    if (restoredIndex < 0) {
      writeTicketListReturnContext({
        ...savedContext,
        pendingRestore: false,
      });
      restoreContextRef.current = null;
      return undefined;
    }

    const restoredPage = Math.floor(restoredIndex / pageSize) + 1;
    if (safeCurrentPage !== restoredPage) {
      setCurrentPage(restoredPage);
      return undefined;
    }

    let cancelled = false;
    let retryCount = 0;
    let retryTimer = null;

    const consumeReturnContext = () => {
      try {
        window.sessionStorage.removeItem(TICKET_LIST_RETURN_STORAGE_KEY);
      } catch {
        // Storage can be unavailable in private mode.
      }
      restoreContextRef.current = null;
    };

    const restorePosition = () => {
      if (cancelled) return;

      const escapedTicketId = (
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(restoreTicketId)
          : restoreTicketId.replace(/["\\]/g, '\\$&')
      );
      const targetRow = document.querySelector(
        `[data-ticket-id="${escapedTicketId}"]`
      );
      const scrollContainer = document.querySelector(
        '[data-dashboard-scroll-container]'
      );

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
        setHighlightedTicketId(restoreTicketId);
        consumeReturnContext();
      });
    };

    restorePosition();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [
    filteredTickets,
    loading,
    pageSize,
    safeCurrentPage,
  ]);

  useEffect(() => {
    if (!highlightedTicketId) return undefined;

    const timer = window.setTimeout(() => {
      setHighlightedTicketId('');
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [highlightedTicketId]);

  const currentListPath = `${location.pathname}${location.search}`;
  const handleOpenTicket = (ticketId) => {
    writeTicketListReturnContext({
      from: currentListPath,
      scrollY: document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0,
      ticketId: String(ticketId),
      page: safeCurrentPage,
      pendingRestore: true,
    });
  };

  const openTicketDetail = (ticket, destination = 'detail') => {
    const feedbackId = getTicketId(ticket);
    if (!feedbackId) {
      setError('Không xác định được mã phản ánh để mở chi tiết.');
      return;
    }

    handleOpenTicket(feedbackId);
    navigate(
      destination === 'result' ? `/tickets/${feedbackId}/result` : `/tickets/${feedbackId}`,
      {
        state: {
          from: currentListPath,
          returnLabel: 'Quay lại phản ánh của tôi',
          ticketId: feedbackId,
        },
      }
    );
  };

  const cancelPendingReturnRestore = () => {
    if (!restoreContextRef.current?.pendingRestore) return;

    try {
      window.sessionStorage.removeItem(TICKET_LIST_RETURN_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private mode.
    }

    restoreContextRef.current = null;
  };

  const requestListScrollAfterFilter = () => {
    if (listScrollTimerRef.current !== null) {
      window.clearTimeout(listScrollTimerRef.current);
    }

    listScrollTimerRef.current = window.setTimeout(() => {
      const target = listSectionRef.current;
      const scrollContainer = document.querySelector(
        '[data-dashboard-scroll-container]'
      );

      if (!target || !scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop = Math.max(
        0,
        scrollContainer.scrollTop + targetRect.top - containerRect.top - 18
      );

      scrollContainer.scrollTo({
        top: targetTop,
        left: 0,
        behavior: 'smooth',
      });
    }, 90);
  };

  const handleSummaryFilter = (nextStatus) => {
    cancelPendingReturnRestore();
    requestListScrollAfterFilter();
    setStatus(nextStatus);
    setOpenMenu(null);
    setCurrentPage(1);
  };

  useEffect(() => () => {
    if (listScrollTimerRef.current !== null) {
      window.clearTimeout(listScrollTimerRef.current);
    }
  }, []);

  const clearFilters = () => {
    cancelPendingReturnRestore();
    requestListScrollAfterFilter();
    setSearch('');
    setStatus('');
    setCategoryId('');
    setSortKey('newest');
    setOpenMenu(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    search || status || categoryId || sortKey !== 'newest'
  );
  const awaitingReviewTickets = useMemo(() => (
    tickets
      .filter((ticket) => (
        ticket.status === managementTypes.feedbackStatus.APPROVED
      ))
      .slice(0, 2)
  ), [tickets]);
  const recentTickets = useMemo(() => (
    [...tickets]
      .sort((a, b) => (
        new Date(b.updatedAt || b.createdAt || 0)
        - new Date(a.updatedAt || a.createdAt || 0)
      ))
      .slice(0, 4)
  ), [tickets]);

  useEffect(() => {
    const candidates = [...paginatedTickets, ...awaitingReviewTickets];
    const uniqueCandidates = new Map();

    candidates.forEach((ticket) => {
      const feedbackId = String(getTicketId(ticket) || '');
      if (feedbackId) uniqueCandidates.set(feedbackId, ticket);
    });

    const missingTickets = [...uniqueCandidates.values()].filter((ticket) => {
      const feedbackId = String(getTicketId(ticket) || '');
      const hasAttachment = Number(ticket?.attachmentCount || 0) > 0;

      return (
        feedbackId &&
        hasAttachment &&
        !hasSettledTicketPreview(ticketPreviewCache, ticket) &&
        !previewRequestedIdsRef.current.has(feedbackId)
      );
    });

    if (missingTickets.length === 0) return;

    missingTickets.forEach((ticket) => {
      const feedbackId = String(getTicketId(ticket));
      previewRequestedIdsRef.current.add(feedbackId);
    });

    setPreviewImageLoading((current) => {
      const next = { ...current };
      missingTickets.forEach((ticket) => {
        next[String(getTicketId(ticket))] = true;
      });
      return next;
    });

    Promise.allSettled(
      missingTickets.map(async (ticket) => {
        const feedbackId = String(getTicketId(ticket));
        const detail = await ticketApi.getTicketById(feedbackId, { role: 'service-user' });
        const mergedTicket = {
          ...ticket,
          ...detail,
          feedbackId: detail?.feedbackId || feedbackId,
        };
        return { feedbackId, mergedTicket };
      })
    ).then((results) => {
      setTicketPreviewCache((current) => {
        let next = { ...current };

        results.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          const { mergedTicket } = result.value;
          const cached = cacheTicketPreview(mergedTicket);
          if (cached) next = { ...next, ...cached };
        });

        writeTicketPreviewCache(next);
        return next;
      });

      setPreviewImageLoading((current) => {
        const next = { ...current };
        missingTickets.forEach((ticket) => {
          delete next[String(getTicketId(ticket))];
        });
        return next;
      });
    });
  }, [awaitingReviewTickets, paginatedTickets, ticketPreviewCache]);

  return (
    <PublicPageMotion>
      <CitizenTicketThemeStyles />
      <main
        ref={pageRootRef}
        data-public-reveal
        className="citizen-ticket-page text-[var(--public-title)]"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="min-w-0 space-y-5">
            <section
              data-public-reveal
              className="citizen-ticket-hero relative overflow-hidden rounded-[28px] border"
              aria-labelledby="my-feedback-title"
            >
              <img
                src={ticketHeroArt}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-3 hidden h-[136px] w-[56%] object-contain object-right-top opacity-85 lg:block"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/94 to-white/20 dark:from-slate-950 dark:via-slate-950/94 dark:to-slate-950/28" aria-hidden="true" />
              <div className="relative px-5 py-6 sm:px-7 sm:py-7">
                <header className="flex max-w-2xl items-start gap-3.5">
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.20)]">
                    <Lucide.ClipboardList size={21} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h1
                      id="my-feedback-title"
                      className="text-3xl font-bold tracking-tight sm:text-4xl"
                    >
                      Phản ánh của tôi
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--public-copy)] sm:text-base">
                      Theo dõi tiến trình, xem kết quả và quản lý các phản ánh bạn đã gửi.
                    </p>
                  </div>
                </header>

                {summary.awaitingReview > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleSummaryFilter(STATUS_FILTER_VALUES.AWAITING_REVIEW)}
                    className="citizen-ticket-attention mt-6 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm sm:px-5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-600">
                      <Lucide.Star size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-bold">
                        {summary.awaitingReview} phản ánh đang chờ bạn đánh giá
                      </strong>
                      <span className="mt-0.5 block text-xs opacity-80 sm:text-sm">
                        Hãy xem kết quả xử lý và gửi đánh giá để hoàn tất phản ánh.
                      </span>
                    </span>
                    <span className="hidden items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm sm:inline-flex">
                      Xem ngay
                      <Lucide.ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </button>
                ) : null}
              </div>
            </section>

            <section
              ref={filtersSectionRef}
              data-public-reveal
              className="citizen-ticket-panel relative z-20 scroll-mt-28 overflow-visible rounded-[24px] border"
              aria-labelledby="ticket-filters-title"
            >
              <div className="citizen-ticket-divider flex flex-wrap border-b px-2 sm:px-3" aria-label="Lọc nhanh theo tình trạng phản ánh">
                <StatusTab
                  label="Tất cả"
                  value={summary.total}
                  icon={Lucide.LayoutList}
                  active={status === STATUS_FILTER_VALUES.ALL}
                  onClick={() => handleSummaryFilter(STATUS_FILTER_VALUES.ALL)}
                />
                <StatusTab
                  label="Đang xử lý"
                  value={summary.inProgress + summary.checking}
                  icon={Lucide.LoaderCircle}
                  active={status === STATUS_FILTER_VALUES.PROCESSING || status === STATUS_FILTER_VALUES.CHECKING}
                  onClick={() => handleSummaryFilter(STATUS_FILTER_VALUES.PROCESSING)}
                />
                <StatusTab
                  label="Chờ bạn"
                  value={summary.awaitingReview}
                  icon={Lucide.Star}
                  active={status === STATUS_FILTER_VALUES.AWAITING_REVIEW}
                  onClick={() => handleSummaryFilter(STATUS_FILTER_VALUES.AWAITING_REVIEW)}
                />
                <StatusTab
                  label="Hoàn tất"
                  value={summary.ended}
                  icon={Lucide.CircleCheckBig}
                  active={status === STATUS_FILTER_VALUES.ENDED}
                  onClick={() => handleSummaryFilter(STATUS_FILTER_VALUES.ENDED)}
                />
              </div>

              <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                <div className="mb-2.5 flex min-h-5 items-center justify-between gap-3">
                  <h2 id="ticket-filters-title" className="sr-only">Tìm và lọc phản ánh</h2>
                  <p className="min-w-0 text-xs text-[var(--public-muted)]">
                    Tìm theo tiêu đề, khu vực hoặc thu hẹp danh sách bằng bộ lọc.
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      <Lucide.RotateCcw size={13} aria-hidden="true" />
                      Xóa bộ lọc
                    </button>
                  ) : null}
                  <span className="sr-only" role="status" aria-live="polite">
                    {refreshing ? 'Đang cập nhật danh sách phản ánh' : isFilterPending ? 'Đang tìm phản ánh' : ''}
                  </span>
                </div>

                <div className="grid min-w-0 gap-2.5 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="relative block" htmlFor="ticket-search">
                    <span className="sr-only">Tìm phản ánh</span>
                    <Lucide.Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--public-muted)]"
                      aria-hidden="true"
                    />
                    <input
                      id="ticket-search"
                      type="search"
                      value={search}
                      onChange={(event) => {
                        cancelPendingReturnRestore();
                        setSearch(event.target.value);
                        setCurrentPage(1);
                      }}
                      className="citizen-ticket-input h-11 w-full rounded-xl border pl-9 pr-9 text-sm outline-none transition"
                      placeholder="Tìm theo tiêu đề hoặc khu vực"
                      autoComplete="off"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => { cancelPendingReturnRestore(); setSearch(''); setCurrentPage(1); }}
                        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--public-muted)] transition hover:bg-blue-500/10 hover:text-blue-600"
                        aria-label="Xóa từ khóa tìm kiếm"
                      >
                        <Lucide.X size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </label>

                  <FilterDropdown
                    menuId="category"
                    value={categoryId}
                    options={categoryOptions}
                    onChange={(nextValue) => {
                      cancelPendingReturnRestore();
                      requestListScrollAfterFilter();
                      setCategoryId(nextValue);
                      setCurrentPage(1);
                    }}
                    icon={Lucide.Tags}
                    label="Lọc theo danh mục"
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                  />
                  <FilterDropdown
                    menuId="status"
                    value={status}
                    options={STATUS_OPTIONS}
                    onChange={(nextValue) => {
                      cancelPendingReturnRestore();
                      requestListScrollAfterFilter();
                      setStatus(nextValue);
                      setCurrentPage(1);
                    }}
                    icon={Lucide.ListFilter}
                    label="Lọc theo trạng thái"
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                  />
                  <FilterDropdown
                    menuId="sort"
                    value={sortKey}
                    options={SORT_OPTIONS}
                    onChange={(nextValue) => {
                      cancelPendingReturnRestore();
                      requestListScrollAfterFilter();
                      setSortKey(nextValue);
                      setCurrentPage(1);
                    }}
                    icon={Lucide.ArrowUpDown}
                    label="Sắp xếp danh sách"
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                  />
                </div>

              </div>
            </section>

            {error ? (
              <aside aria-live="assertive">
                <ErrorAlert
                  title="Không thể tải dữ liệu"
                  message={error}
                  onClose={() => setError('')}
                />
              </aside>
            ) : null}

            <section
              data-public-reveal
              aria-labelledby="ticket-list-title"
              aria-busy={loading || isFilterPending}
            >
              <h2 id="ticket-list-title" className="sr-only">Danh sách phản ánh</h2>

              <div className="relative">
                <div ref={listSectionRef} className="citizen-ticket-results-shell scroll-mt-28">
              {loading ? (
                <div className="citizen-ticket-panel overflow-hidden rounded-[24px] border">
                  <TicketListSkeleton />
                </div>
              ) : paginatedTickets.length === 0 ? (
                <section className="citizen-ticket-panel flex min-h-72 flex-col items-center justify-center rounded-[24px] border px-6 py-12 text-center">
                  <span className="citizen-ticket-row-icon flex h-14 w-14 items-center justify-center rounded-2xl border" aria-hidden="true">
                    {hasActiveFilters ? <Lucide.SearchX size={24} /> : <Lucide.FilePlus2 size={24} />}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">
                    {hasActiveFilters ? 'Không có phản ánh phù hợp' : 'Bạn chưa gửi phản ánh nào'}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[var(--public-copy)]">
                    {hasActiveFilters
                      ? 'Hãy thay đổi từ khóa hoặc bộ lọc để mở rộng kết quả.'
                      : 'Khi phát hiện vấn đề đô thị, hãy gửi thông tin và hình ảnh để theo dõi tiến độ xử lý tại đây.'}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="citizen-ticket-secondary-button mt-5 inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition"
                    >
                      <Lucide.RotateCcw size={15} aria-hidden="true" />
                      Xóa bộ lọc
                    </button>
                  ) : (
                    <Link
                      to="/tickets/create"
                      className="citizen-ticket-primary-button mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition"
                    >
                      <Lucide.Plus size={16} aria-hidden="true" />
                      Gửi phản ánh đầu tiên
                    </Link>
                  )}
                </section>
              ) : (
                <ol className="space-y-2.5">
                  {paginatedTickets.map((ticket) => {
                    const feedbackId = getTicketId(ticket);
                    const previewImage = getCachedTicketPreviewUrl(ticketPreviewCache, ticket);
                    const statusMeta = getCitizenStatusMeta(ticket.status);
                    const StatusIcon = statusMeta.icon;
                    const updatedAt = ticket.updatedAt || ticket.createdAt;
                    const parentTicketId = ticket.parentTicketId || ticket.parentFeedbackId || null;
                    const isConfirmedDuplicate = Boolean(parentTicketId);
                    const isPotentialDuplicate = Boolean(ticket.duplicateWarning && !isConfirmedDuplicate);
                    const needsReview = ticket.status === managementTypes.feedbackStatus.APPROVED;

                    return (
                      <li key={feedbackId || `${ticket.title}-${ticket.createdAt}`}>
                        <article
                          data-ticket-id={feedbackId || undefined}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            if (event.target.closest('button, a, input, select, textarea')) return;
                            openTicketDetail(ticket);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openTicketDetail(ticket);
                            }
                          }}
                          className={`citizen-ticket-card group cursor-pointer rounded-[20px] border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 sm:px-5 sm:py-4 ${
                            String(highlightedTicketId) === String(feedbackId) ? 'is-returned' : ''
                          }`}
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="flex min-w-0 items-start gap-3.5">
                              <button
                                type="button"
                                onClick={() => openTicketDetail(ticket)}
                                className="mt-0.5 shrink-0 rounded-[16px] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                aria-label={`Mở chi tiết phản ánh ${ticket.title || ''}`}
                              >
                                <TicketThumbnail
                                  src={previewImage}
                                  loading={Boolean(previewImageLoading[feedbackId])}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => openTicketDetail(ticket)}
                                className="min-w-0 flex-1 text-left focus-visible:outline-none"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="min-w-0 text-[15px] font-bold leading-6 text-[var(--public-title)] transition group-hover:text-blue-600 sm:text-base">
                                    {ticket.title || 'Phản ánh chưa có tiêu đề'}
                                  </h3>
                                  <span className="rounded-full border border-[var(--public-border)] bg-[var(--public-surface-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--public-copy)]">
                                    {getCategoryLabel(ticket.categoryName)}
                                  </span>
                                  {isConfirmedDuplicate ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/70 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300">
                                      <Lucide.GitMerge size={12} aria-hidden="true" />
                                      Phản ánh trùng
                                    </span>
                                  ) : isPotentialDuplicate ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
                                      <Lucide.ScanSearch size={12} aria-hidden="true" />
                                      Nghi trùng
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--public-muted)]">
                                  <span className="inline-flex min-w-0 items-center gap-1.5">
                                    <Lucide.MapPin size={13} className="shrink-0" aria-hidden="true" />
                                    <span className="max-w-xl truncate" title={ticket.locationText || ticket.areaName || ''}>
                                      {ticket.locationText || ticket.areaName || 'Chưa xác định vị trí'}
                                    </span>
                                  </span>
                                  <time className="inline-flex items-center gap-1.5" dateTime={ticket.createdAt || undefined}>
                                    <Lucide.CalendarDays size={13} aria-hidden="true" />
                                    Gửi {formatDate(ticket.createdAt)}
                                  </time>
                                </div>
                              </button>
                            </div>

                            <aside className="flex flex-wrap items-center gap-3 pl-[102px] lg:min-w-[330px] lg:justify-end lg:pl-0" aria-label="Trạng thái phản ánh">
                              <div className="text-left lg:text-right">
                                <span className={`citizen-status citizen-status-${statusMeta.tone} inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold`}>
                                  <StatusIcon size={13} aria-hidden="true" />
                                  {statusMeta.label}
                                </span>
                                <time className="mt-1.5 block text-[11px] text-[var(--public-muted)]" dateTime={updatedAt || undefined}>
                                  Cập nhật {formatDate(updatedAt)}
                                </time>
                              </div>

                              {needsReview ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openTicketDetail(ticket)}
                                    className="citizen-ticket-secondary-button inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition"
                                  >
                                    Xem chi tiết
                                    <Lucide.ArrowRight size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openTicketDetail(ticket, 'result')}
                                    className="citizen-ticket-primary-button inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition"
                                  >
                                    <Lucide.Star size={14} aria-hidden="true" />
                                    Đánh giá kết quả
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openTicketDetail(ticket)}
                                  className="citizen-ticket-secondary-button inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition"
                                >
                                  Xem chi tiết
                                  <Lucide.ArrowRight size={14} aria-hidden="true" />
                                </button>
                              )}
                            </aside>
                          </div>
                        </article>
                      </li>
                    );
                  })}                </ol>
              )}

              {totalItems > 0 ? (
                <footer className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--public-muted)]">
                    Hiển thị <strong className="text-[var(--public-title)]">{startIndex + 1}–{endIndex}</strong> trong tổng số <strong className="text-[var(--public-title)]">{totalItems}</strong> phản ánh
                  </p>
                  <nav className="flex items-center gap-2" aria-label="Phân trang danh sách phản ánh">
                    <button
                      type="button"
                      className="citizen-ticket-secondary-button inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    >
                      <Lucide.ChevronLeft size={15} aria-hidden="true" />
                      Trước
                    </button>
                    <span className="citizen-ticket-control inline-flex h-9 min-w-16 items-center justify-center rounded-xl border px-3 text-xs font-medium text-[var(--public-copy)]">
                      {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="citizen-ticket-secondary-button inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    >
                      Sau
                      <Lucide.ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </nav>
                </footer>
              ) : null}
                </div>
              </div>
            </section>
          </div>

          <aside className="h-full space-y-5 self-stretch" aria-label="Thông tin hỗ trợ phản ánh">
            <section className="citizen-ticket-side-card citizen-ticket-side-visual relative min-h-[198px] overflow-hidden rounded-[24px] border">
              <img
                src={ticketSideArt}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 h-[176px] w-[150px] object-cover object-left-bottom"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,255,255,.98)_48%,rgba(255,255,255,.70)_67%,rgba(255,255,255,.05)_100%)] dark:bg-[linear-gradient(90deg,rgba(7,18,36,1)_0%,rgba(7,18,36,.98)_48%,rgba(7,18,36,.76)_68%,rgba(7,18,36,.18)_100%)]"
                aria-hidden="true"
              />
              <div className="relative flex min-h-[198px] max-w-[66%] flex-col justify-center px-6 py-6">
                <h2 className="text-[19px] font-bold leading-6 tracking-tight">
                  Mỗi phản ánh là một thay đổi tích cực
                </h2>
                <p className="mt-2 max-w-[210px] text-sm leading-6 text-[var(--public-copy)]">
                  Cảm ơn bạn đã chung tay xây dựng đô thị văn minh, sạch đẹp hơn.
                </p>
              </div>
            </section>

            <div className="space-y-5 xl:sticky xl:top-[88px]">
            {summary.awaitingReview > 0 ? (
              <section className="citizen-ticket-side-card overflow-hidden rounded-[24px] border" aria-labelledby="ticket-attention-title">
                <div className="p-5 pb-4">
                  <header className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                        <Lucide.BellRing size={16} aria-hidden="true" />
                      </span>
                      <h2 id="ticket-attention-title" className="text-[17px] font-bold">Cần bạn chú ý</h2>
                    </div>
                    <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-600">
                      {summary.awaitingReview}
                    </span>
                  </header>
                  <p className="mt-3 text-xs leading-5 text-[var(--public-copy)]">
                    {summary.awaitingReview} phản ánh đã có kết quả xử lý. Hãy xem và đánh giá để hoàn tất phản ánh của bạn.
                  </p>
                </div>

                <div className="px-3 pb-3">
                  <div className="space-y-1">
                    {awaitingReviewTickets.map((ticket) => {
                      const feedbackId = getTicketId(ticket);
                      const previewImage = getCachedTicketPreviewUrl(ticketPreviewCache, ticket);
                      return (
                        <Link
                          key={feedbackId}
                          to={`/tickets/${feedbackId}`}
                          state={{ from: currentListPath, returnLabel: 'Quay lại phản ánh của tôi', ticketId: feedbackId }}
                          onClick={() => handleOpenTicket(feedbackId)}
                          className="group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition hover:bg-blue-500/[0.055]"
                        >
                          <TicketThumbnail
                            src={previewImage}
                            loading={Boolean(previewImageLoading[feedbackId])}
                            className="h-11 w-11 rounded-xl"
                          />
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-semibold leading-5 group-hover:text-blue-600">
                              {ticket.title || 'Phản ánh chưa có tiêu đề'}
                            </strong>
                            <span className="mt-0.5 block text-[11px] text-[var(--public-muted)]">
                              Cập nhật {formatDate(ticket.updatedAt || ticket.createdAt)}
                            </span>
                          </span>
                          <Lucide.ChevronRight size={15} className="shrink-0 text-[var(--public-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSummaryFilter(STATUS_FILTER_VALUES.AWAITING_REVIEW)}
                    className="mt-2.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300"
                  >
                    Xem tất cả phản ánh chờ đánh giá
                    <Lucide.ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </section>
            ) : null}

            <section className="citizen-ticket-side-card rounded-[24px] border p-5" aria-labelledby="recent-ticket-title">
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                    <Lucide.Clock3 size={16} aria-hidden="true" />
                  </span>
                  <h2 id="recent-ticket-title" className="font-bold">Cập nhật gần đây</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    window.requestAnimationFrame(() => {
                      filtersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Xem tất cả
                  <Lucide.ArrowRight size={12} aria-hidden="true" />
                </button>
              </header>

              {recentTickets.length > 0 ? (
                <ol className="mt-4 space-y-0">
                  {recentTickets.map((ticket, index) => {
                    const feedbackId = getTicketId(ticket);
                    const statusMeta = getCitizenStatusMeta(ticket.status);
                    const updatedAt = ticket.updatedAt || ticket.createdAt;
                    const dotClass = RECENT_STATUS_DOT_CLASSES[statusMeta.tone] || RECENT_STATUS_DOT_CLASSES.blue;
                    return (
                      <li key={feedbackId} className="relative pl-5">
                        {index < recentTickets.length - 1 ? (
                          <span className="absolute left-[4px] top-4 h-[calc(100%-2px)] w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                        ) : null}
                        <span className={`absolute left-0 top-[9px] h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm dark:border-slate-900 ${dotClass}`} aria-hidden="true" />
                        <Link
                          to={`/tickets/${feedbackId}`}
                          state={{ from: currentListPath, returnLabel: 'Quay lại phản ánh của tôi', ticketId: feedbackId }}
                          onClick={() => handleOpenTicket(feedbackId)}
                          className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl py-2.5"
                        >
                          <span className="min-w-0">
                            <strong className="block truncate text-[13px] font-semibold leading-5 group-hover:text-blue-600">
                              {ticket.title || 'Phản ánh chưa có tiêu đề'}
                            </strong>
                            <span className="mt-0.5 block truncate text-[11px] text-[var(--public-copy)]">
                              {statusMeta.label}
                            </span>
                          </span>
                          <time
                            className="pt-0.5 text-right text-[10px] leading-4 text-[var(--public-muted)]"
                            dateTime={updatedAt || undefined}
                          >
                            <span className="block">{formatDate(updatedAt)}</span>
                            {formatTime(updatedAt) ? <span className="block">{formatTime(updatedAt)}</span> : null}
                          </time>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-[var(--public-muted)]">Chưa có cập nhật mới.</p>
              )}
            </section>
            </div>
          </aside>
        </div>
      </main>
    </PublicPageMotion>
  );
};
