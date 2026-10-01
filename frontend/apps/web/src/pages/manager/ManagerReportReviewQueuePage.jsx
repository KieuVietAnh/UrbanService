
// src/pages/manager/FeedbackReviewQueuePage.jsx
import { useState, useEffect, useMemo, useRef, useCallback} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { managementTypes } from '@urbanmind/shared-types';
import { signalrService } from '../../services/socket/signalrService';
import { duplicateManagementApi, extractApiErrorMessage, toolsApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { ManagerConfirmDialog, ManagerSelectMenu, ManagerToast } from '../../components/manager/ManagerPageElements';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { getScopedSessionKey } from '../../utils/scopedSessionKey';
import { FeedbackLocationMapCard } from '../../components/maps/FeedbackLocationMapCard';
import { fetchAllAiReviewedPages, getReviewQueueReturnContext } from './managerReportReviewUtils';

const normalizePriority = (value = '') => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized === 'urgent' || normalized === 'critical') return 'Urgent';
  if (normalized === 'high') return 'High';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'low') return 'Low';
  return '';
};

const getUrgencyBadgeClass = (urgency = '') => {
  const normalized = normalizePriority(urgency);
  if (normalized === 'Urgent') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (normalized === 'High') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-500';
};

const getTicketPriority = (ticket = {}) => {
  // In the AI review queue, the AI urgency is the proposal being reviewed by the current role.
  // Fall back to the persisted feedback priority only when the AI result has no urgency.
  return normalizePriority(
    ticket.analysisResult?.urgencyLevel
      || ticket.urgencyLevel
      || ticket.urgency
      || ticket.priority
  );
};

const getUrgencyLabel = (urgency = '') => {
  const normalized = normalizePriority(urgency);
  if (normalized === 'Urgent') return 'Khẩn cấp';
  if (normalized === 'High') return 'Cao';
  if (normalized === 'Medium') return 'Trung bình';
  if (normalized === 'Low') return 'Thấp';
  return 'Chưa xác định';
};

const normalizeSeverity = (value = '') => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'urgent') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'low') return 'Low';
  return '';
};

const getSeverityLabel = (value = '') => {
  const normalized = normalizeSeverity(value);
  if (normalized === 'Critical') return 'Nghiêm trọng';
  if (normalized === 'High') return 'Cao';
  if (normalized === 'Medium') return 'Trung bình';
  if (normalized === 'Low') return 'Thấp';
  return 'Chưa xác định';
};

const getTicketSeverity = (ticket = {}) => normalizeSeverity(
  ticket.analysisResult?.severity
    || ticket.analysisResult?.severityLevel
    || ticket.severity
    || ticket.severityLevel
);

const REVIEW_SEVERITY_OPTIONS = [
  { value: 'Low', label: 'Thấp' },
  { value: 'Medium', label: 'Trung bình' },
  { value: 'High', label: 'Cao' },
  { value: 'Critical', label: 'Nghiêm trọng' },
];

const REVIEW_PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Thấp' },
  { value: 'Medium', label: 'Trung bình' },
  { value: 'High', label: 'Cao' },
  { value: 'Urgent', label: 'Khẩn cấp' },
];

const ReviewChoiceSelect = ({ label, value, options, onChange, disabled = false, helper = '' }) => (
  <div className="min-w-0">
    <span className="mb-2 block whitespace-nowrap text-[13px] font-semibold leading-5 text-slate-700 dark:text-slate-200">{label}</span>
    <ManagerSelectMenu
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Chọn giá trị"
      ariaLabel={label}
      disabled={disabled}
      className="w-full"
    />
    {helper ? <p className="mt-1.5 text-xs leading-5 text-slate-400 dark:text-slate-500">{helper}</p> : null}
  </div>
);

const shortenFeedbackId = (value = '') => {
  const text = `${value || ''}`;
  if (text.length <= 18) return text || '—';
  return `${text.slice(0, 8)}…${text.slice(-5)}`;
};

const getDuplicateCandidateId = (candidate = {}) => (
  candidate?.duplicateCandidateId ?? candidate?.candidateId ?? candidate?.id ?? null
);

const getDuplicateCandidateFeedbackId = (candidate = {}) => (
  candidate?.primaryFeedback?.feedbackId
    ?? candidate?.primaryFeedback?.id
    ?? candidate?.feedback?.feedbackId
    ?? candidate?.feedback?.id
    ?? candidate?.primaryFeedbackId
    ?? candidate?.feedbackId
    ?? null
);

const getDuplicateConfidencePercent = (candidate = {}) => {
  const raw = candidate?.confidenceScore ?? candidate?.confidence;
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed > 1 ? parsed : parsed * 100);
};

const getDuplicateCandidateStatus = (candidate = {}) => (
  String(candidate?.status || 'Pending').trim()
);

const getDuplicateCandidateUi = (candidate = {}) => {
  const status = getDuplicateCandidateStatus(candidate);
  const confidence = getDuplicateConfidencePercent(candidate);

  if (status === 'Confirmed') {
    return {
      label: 'Đã liên kết',
      shortLabel: 'Đã liên kết',
      confidence,
      tone: 'emerald',
      icon: Lucide.BadgeCheck,
      buttonLabel: 'Xem kết quả trùng',
      title: 'Phản ánh đã được liên kết với sự vụ',
      description: 'Quyết định trùng lặp đã được ghi nhận. Manager vẫn có thể xem lại kết quả đối chiếu.',
    };
  }

  if (status === 'Rejected') {
    return {
      label: 'Không trùng',
      shortLabel: 'Không trùng',
      confidence,
      tone: 'slate',
      icon: Lucide.Unlink,
      buttonLabel: 'Xem kết quả trùng',
      title: 'Phản ánh đã được xác định không trùng',
      description: 'Đề xuất trùng lặp đã được xử lý và không liên kết phản ánh này vào sự vụ gợi ý.',
    };
  }

  return {
    label: confidence !== null ? `Nghi trùng ${confidence}%` : 'Nghi trùng',
    shortLabel: 'Nghi trùng',
    confidence,
    tone: 'violet',
    icon: Lucide.GitCompareArrows,
    buttonLabel: 'Xử lý nghi trùng',
    title: 'AI phát hiện khả năng trùng',
    description: 'Mở đề xuất để đối chiếu với sự vụ gợi ý. Phản ánh vẫn có thể được xác minh độc lập tại đây.',
  };
};

const AI_QUEUE_CACHE_KEY_BASE = 'urbanservice-ai-review-queue-v3';
const AI_REVIEW_DETAIL_CACHE_KEY_BASE = 'urbanservice-ai-review-detail-v2';
const AI_REVIEW_DETAIL_CACHE_TTL = 10 * 60 * 1000;
const AI_QUEUE_VIEW_KEY_BASE = 'urbanservice-ai-review-view-v1';
const AI_QUEUE_CACHE_TTL = 60 * 1000;

const readReviewViewState = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeReviewViewState = (key, patch) => {
  try {
    const current = readReviewViewState(key);
    sessionStorage.setItem(key, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Ignore storage failures.
  }
};

const hasPreciseLocation = (ticket = {}) => {
  const latitude = ticket?.latitude ?? ticket?.lat;
  const longitude = ticket?.longitude ?? ticket?.lng ?? ticket?.long;
  return latitude !== null
    && latitude !== undefined
    && latitude !== ''
    && longitude !== null
    && longitude !== undefined
    && longitude !== ''
    && Number.isFinite(Number(latitude))
    && Number.isFinite(Number(longitude));
};

const readAiQueueCache = (cacheKey) => {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readReviewDetailCache = (cacheKey, feedbackId) => {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store?.[feedbackId];
    if (!entry?.data || !entry?.savedAt) return null;
    return {
      data: entry.data,
      fresh: Date.now() - Number(entry.savedAt) <= AI_REVIEW_DETAIL_CACHE_TTL,
    };
  } catch {
    return null;
  }
};

const writeReviewDetailCache = (cacheKey, feedbackId, data) => {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    const store = raw ? JSON.parse(raw) : {};
    store[feedbackId] = { data, savedAt: Date.now() };
    sessionStorage.setItem(cacheKey, JSON.stringify(store));
  } catch {
    // Ignore storage failures.
  }
};

const mergeAiQueueCache = (cacheKey, patch) => {
  try {
    const current = readAiQueueCache(cacheKey) || {};
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ ...current, ...patch, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage failures.
  }
};


const resolveReviewMediaUrl = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  const candidates = [
    item.url, item.fileUrl, item.imageUrl, item.src, item.path, item.link,
    item.data?.url, item.attributes?.url, item.file?.url, item.file?.fileUrl,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
};

const getReviewMediaUrls = (ticket = {}) => {
  const sources = [
    ticket.attachments, ticket.images, ticket.photos, ticket.media,
    ticket.files, ticket.imageUrls, ticket.pictures,
  ];
  return [...new Set(
    sources.flatMap((value) => Array.isArray(value) ? value : [])
      .map(resolveReviewMediaUrl)
      .filter(Boolean)
  )];
};

export const ManagerReportReviewQueuePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reviewReturnContext = getReviewQueueReturnContext(location.state);
  const isManagerFlow = location.pathname.startsWith('/manager/');
  const { user } = useAuth();
  const aiQueueCacheKey = useMemo(
    () => getScopedSessionKey(AI_QUEUE_CACHE_KEY_BASE, user),
    [user],
  );
  const reviewDetailCacheKey = useMemo(
    () => getScopedSessionKey(AI_REVIEW_DETAIL_CACHE_KEY_BASE, user),
    [user],
  );
  const reviewViewStateKey = useMemo(
    () => getScopedSessionKey(AI_QUEUE_VIEW_KEY_BASE, user),
    [user],
  );
  const [initialQueueCache] = useState(() => readAiQueueCache(aiQueueCacheKey));
  const [initialReviewViewState] = useState(() => readReviewViewState(reviewViewStateKey));
  const initialTickets = Array.isArray(initialQueueCache?.tickets) ? initialQueueCache.tickets : [];
  const initialSelectedTicket = initialTickets.find(
    (ticket) => ticket.feedbackId === initialReviewViewState?.selectedFeedbackId
  ) || initialTickets[0] || null;

  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicket, setSelectedTicket] = useState(initialSelectedTicket);
  const [categories, setCategories] = useState(() => (
    Array.isArray(initialQueueCache?.categories) ? initialQueueCache.categories : []
  ));
  const [urgencyFilter, setUrgencyFilter] = useState(initialReviewViewState?.urgencyFilter || '');
  const [severityFilter, setSeverityFilter] = useState(initialReviewViewState?.severityFilter || '');
  const [wardFilter, setWardFilter] = useState(initialReviewViewState?.wardFilter || '');
  const [locationFilter, setLocationFilter] = useState(initialReviewViewState?.locationFilter || '');
  const [kpiFilter, setKpiFilter] = useState(initialReviewViewState?.kpiFilter || '');
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  const queueListRef = useRef(null);

  // Edit variables
  const [editCategoryId, setEditCategoryId] = useState(() => {
    const detectedCategoryId = initialSelectedTicket?.analysisResult?.detectedCategoryId
      || initialSelectedTicket?.detectedCategoryId
      || initialSelectedTicket?.categoryId;
    return detectedCategoryId ? Number(detectedCategoryId) : '';
  });
  const [editPriority, setEditPriority] = useState(() => (
    initialSelectedTicket ? getTicketPriority(initialSelectedTicket) : ''
  ));
  const [editSeverity, setEditSeverity] = useState(() => (
    initialSelectedTicket ? getTicketSeverity(initialSelectedTicket) : ''
  ));
  const [loading, setLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [queueWarning, setQueueWarning] = useState('');
  const [categoriesError, setCategoriesError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionToast, setActionToast] = useState({ type: '', text: '' });
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [duplicateCandidatesByFeedbackId, setDuplicateCandidatesByFeedbackId] = useState({});
  const [duplicateLookupLoading, setDuplicateLookupLoading] = useState(false);
  const detailRequestRef = useRef(0);

  const handleSelectTicket = useCallback((t) => {
    const detectedCategoryId = t?.analysisResult?.detectedCategoryId || t?.detectedCategoryId || t?.categoryId;
    setSelectedTicket(t);
    setEditCategoryId(detectedCategoryId ? Number(detectedCategoryId) : '');
    setEditPriority(getTicketPriority(t));
    setEditSeverity(getTicketSeverity(t));
    setActionError('');
    setDetailError('');
    setSelectedMediaIndex(0);
    setMediaPreviewOpen(false);
    writeReviewViewState(reviewViewStateKey, { selectedFeedbackId: t.feedbackId });
  }, [reviewViewStateKey]);

  useEffect(() => {
    const cacheIsFresh =
      Number(initialQueueCache?.savedAt) > 0
      && Date.now() - Number(initialQueueCache.savedAt) < AI_QUEUE_CACHE_TTL;

    if (cacheIsFresh) return undefined;

    const loadQueue = async () => {
      setQueueError('');
      setQueueWarning('');
      try {
        const result = await fetchAllAiReviewedPages(
          ({ pageNumber, pageSize }) => managementFeedbackApi.getAiReviewedFeedbackPage({ pageNumber, pageSize }),
          { pageSize: 100 },
        );
        const normalized = result.items;
        setTickets(normalized);
        mergeAiQueueCache(aiQueueCacheKey, { tickets: normalized });
        if (result.partial) {
          setQueueWarning(`Đã tải ${normalized.length}/${result.totalItems} phản ánh. Một số trang dữ liệu chưa tải được; hãy thử làm mới trước khi xử lý hàng chờ còn lại.`);
        }
        if (normalized.length > 0) {
          const focusedFeedbackId = location.state?.mapState?.focusFeedbackId;
          const focusedTicket = focusedFeedbackId
            ? normalized.find((ticket) => String(ticket.feedbackId) === String(focusedFeedbackId))
            : null;
          handleSelectTicket(focusedTicket || normalized[0]);
        } else {
          setSelectedTicket(null);
        }
      } catch (err) {
        console.error('Failed to load AI reviewed queue', err);
        const hasStaleQueue = initialTickets.length > 0;
        if (!hasStaleQueue) {
          setTickets([]);
          setSelectedTicket(null);
        }
        const message = extractApiErrorMessage(
          err,
          'Không thể tải hàng chờ duyệt phản ánh. Vui lòng thử lại.',
        );
        setQueueError(hasStaleQueue ? `${message} Đang hiển thị dữ liệu gần nhất đã lưu trên trình duyệt.` : message);
      }
    };

    const loadCategories = async () => {
      try {
        setCategoriesError('');
        const res = await toolsApi.getCategories();
        const resolved = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
            ? res.items
            : Array.isArray(res?.data)
              ? res.data
              : [];

        if (resolved.length === 0) {
          setCategories([]);
          setCategoriesError('Không thể tải danh mục thật từ hệ thống. Vui lòng tải lại trước khi xác nhận.');
          return;
        }

        setCategories(resolved);
        mergeAiQueueCache(aiQueueCacheKey, { categories: resolved });
      } catch (err) {
        console.error('Failed to load categories', err);
        setCategories([]);
        setCategoriesError('Không thể tải danh mục thật từ hệ thống. Vui lòng tải lại trước khi xác nhận.');
      }
    };

    loadQueue();
    loadCategories();
  }, [aiQueueCacheKey, initialQueueCache, initialTickets.length, location.state?.mapState?.focusFeedbackId, handleSelectTicket]);

  useEffect(() => {
    if (!isManagerFlow) {
      setDuplicateCandidatesByFeedbackId({});
      return undefined;
    }

    let cancelled = false;

    const loadDuplicateCandidates = async () => {
      setDuplicateLookupLoading(true);
      try {
        const summary = await duplicateManagementApi.getDuplicateSummary();
        const groups = [
          ['Pending', Number(summary?.pending ?? 0) || 0],
          ['Confirmed', Number(summary?.confirmed ?? 0) || 0],
          ['Rejected', Number(summary?.rejected ?? 0) || 0],
        ];

        const fetchStatus = async (status, count) => {
          if (!count) return [];
          const pageSize = 50;
          const totalPages = Math.max(1, Math.ceil(count / pageSize));
          const responses = await Promise.all(
            Array.from({ length: totalPages }, (_, index) => (
              duplicateManagementApi.getDuplicateCandidates({
                status,
                page: index + 1,
                pageSize,
              })
            ))
          );
          return responses.flatMap((response) => (
            Array.isArray(response?.items) ? response.items : []
          ));
        };

        const grouped = await Promise.all(
          groups.map(([status, count]) => fetchStatus(status, count))
        );

        if (cancelled) return;

        const map = {};
        grouped.flat().forEach((candidate) => {
          const feedbackId = getDuplicateCandidateFeedbackId(candidate);
          const candidateId = getDuplicateCandidateId(candidate);
          if (!feedbackId || !candidateId) return;

          const key = String(feedbackId);
          const existing = map[key];

          // Pending is most actionable; otherwise keep the newest/first resolved record.
          if (!existing || getDuplicateCandidateStatus(candidate) === 'Pending') {
            map[key] = candidate;
          }
        });

        setDuplicateCandidatesByFeedbackId(map);
      } catch (error) {
        console.warn('Failed to load duplicate candidate hints for review queue', error);
        if (!cancelled) setDuplicateCandidatesByFeedbackId({});
      } finally {
        if (!cancelled) setDuplicateLookupLoading(false);
      }
    };

    void loadDuplicateCandidates();

    return () => {
      cancelled = true;
    };
  }, [isManagerFlow]);

  useEffect(() => {
    const feedbackId = selectedTicket?.feedbackId;
    if (!feedbackId) return undefined;

    const mergeDetail = (detail) => {
      if (!detail) return;
      setSelectedTicket((current) => {
        if (!current || String(current.feedbackId) !== String(feedbackId)) return current;
        return {
          ...current,
          ...detail,
          feedbackId: current.feedbackId,
          analysisResult: current.analysisResult || detail.analysisResult,
          parentTicketId: detail.parentTicketId || current.parentTicketId,
          parentFeedbackId: detail.parentFeedbackId || current.parentFeedbackId,
        };
      });
    };

    const cached = readReviewDetailCache(reviewDetailCacheKey, feedbackId);
    if (cached?.data) {
      mergeDetail(cached.data);
      setDetailLoading(false);
      setDetailError('');
      if (cached.fresh) return undefined;
    }

    const requestId = ++detailRequestRef.current;
    let cancelled = false;

    setDetailLoading(!cached?.data);
    setDetailError('');

    managementFeedbackApi.getFeedbackById(feedbackId)
      .then((detail) => {
        if (cancelled || requestId !== detailRequestRef.current || !detail) return;
        writeReviewDetailCache(reviewDetailCacheKey, feedbackId, detail);
        mergeDetail(detail);
      })
      .catch((error) => {
        if (cancelled || requestId !== detailRequestRef.current) return;
        console.error('Failed to load feedback detail for review', error);
        if (!cached?.data) {
          setDetailError('Không thể tải đầy đủ chi tiết và hình ảnh của phản ánh.');
        }
      })
      .finally(() => {
        if (!cancelled && requestId === detailRequestRef.current) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewDetailCacheKey, selectedTicket?.feedbackId]);

  const URGENCY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

  useEffect(() => {
    const focusedFeedbackId = location.state?.mapState?.focusFeedbackId;
    if (!focusedFeedbackId || tickets.length === 0) return;

    const focusedTicket = tickets.find(
      (ticket) => String(ticket.feedbackId) === String(focusedFeedbackId)
    );
    if (focusedTicket && String(selectedTicket?.feedbackId) !== String(focusedFeedbackId)) {
      handleSelectTicket(focusedTicket);
    }
  }, [location.state?.mapState?.focusFeedbackId, selectedTicket?.feedbackId, tickets, handleSelectTicket]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!showUrgencyDropdown) return;
      try {
        const target = event.target;
        if (!target.closest('.urgency-dropdown') && !target.closest('.urgency-filter-button')) {
          setShowUrgencyDropdown(false);
        }
      } catch {
        setShowUrgencyDropdown(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showUrgencyDropdown]);

  const wardOptions = useMemo(() => {
    const uniqueNames = new Set(
      tickets
        .map((ticket) => ticket.areaName || ticket.wardName || ticket.area?.name || '')
        .map((name) => String(name).trim())
        .filter(Boolean)
    );

    return [...uniqueNames]
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ value: name, label: name }));
  }, [tickets]);

  const displayedTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (urgencyFilter) {
        const urgency = getTicketPriority(t);
        if (urgency !== normalizePriority(urgencyFilter)) return false;
      }

      if (severityFilter) {
        const severity = getTicketSeverity(t);
        if (severity !== normalizeSeverity(severityFilter)) return false;
      }

      if (wardFilter) {
        const wardName = String(t.areaName || t.wardName || t.area?.name || '').trim();
        if (wardName !== wardFilter) return false;
      }

      if (locationFilter === 'withoutPreciseLocation' && hasPreciseLocation(t)) {
        return false;
      }

      if (kpiFilter === 'severityHigh') {
        const severity = getTicketSeverity(t);
        if (severity !== 'High' && severity !== 'Critical') return false;
      }

      if (kpiFilter === 'urgent' && getTicketPriority(t) !== 'Urgent') {
        return false;
      }

      return true;
    });
  }, [tickets, urgencyFilter, severityFilter, wardFilter, locationFilter, kpiFilter]);

  useEffect(() => {
    writeReviewViewState(reviewViewStateKey, {
      selectedFeedbackId: selectedTicket?.feedbackId || '',
      urgencyFilter,
      severityFilter,
      wardFilter,
      locationFilter,
      kpiFilter,
    });
  }, [
    kpiFilter,
    locationFilter,
    reviewViewStateKey,
    selectedTicket?.feedbackId,
    severityFilter,
    urgencyFilter,
    wardFilter,
  ]);

  useEffect(() => {
    const list = queueListRef.current;
    const savedScrollTop = Number(initialReviewViewState?.listScrollTop);
    if (!list || !Number.isFinite(savedScrollTop) || savedScrollTop <= 0) return undefined;

    const frame = window.requestAnimationFrame(() => {
      list.scrollTop = savedScrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialReviewViewState?.listScrollTop]);

  useEffect(() => {
    if (!displayedTickets || displayedTickets.length === 0) {
      setSelectedTicket(null);
      return;
    }
    // Keep selection and editable reviewer corrections in sync with the visible ticket.
    const isSelectedVisible = selectedTicket && displayedTickets.some((d) => d.feedbackId === selectedTicket.feedbackId);
    if (!isSelectedVisible) {
      const nextTicket = displayedTickets[0];
      const detectedCategoryId = nextTicket?.analysisResult?.detectedCategoryId
        || nextTicket?.detectedCategoryId
        || nextTicket?.categoryId;
      setSelectedTicket(nextTicket);
      setEditCategoryId(detectedCategoryId ? Number(detectedCategoryId) : '');
      setEditPriority(getTicketPriority(nextTicket));
      setEditSeverity(getTicketSeverity(nextTicket));
      setActionError('');
    }
  }, [displayedTickets, selectedTicket]);

  const handleDeny = () => {
    if (!selectedTicket || loading) return;
    setRejectConfirmOpen(true);
  };

  const confirmDeny = async () => {
    if (!selectedTicket || loading) return;

    setLoading(true);
    setActionError('');
    try {
      await managementFeedbackApi.updateStatus(selectedTicket.feedbackId, {
        status: managementTypes.feedbackStatus.REJECTED,
        note: isManagerFlow ? 'Manager rejected from AI review queue' : 'Staff denied from AI review queue',
      });
      sessionStorage.removeItem(aiQueueCacheKey);
      try {
        signalrService.notifyStatusChanged(selectedTicket.feedbackId, selectedTicket.status, managementTypes.feedbackStatus.REJECTED, user);
      } catch (e) {
        console.warn('SignalR notify failed', e);
      }

      setTickets((current) => current.filter((ticket) => ticket.feedbackId !== selectedTicket.feedbackId));
      setSelectedTicket(null);
      setRejectConfirmOpen(false);
      setActionToast({ type: 'success', text: 'Đã từ chối phản ánh.' });
    } catch (err) {
      console.error(err);
      setActionToast({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Không thể từ chối phản ánh. Vui lòng thử lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  const requestApproveConfirmation = () => {
    if (!selectedTicket || loading) return;

    const categoryId = Number(editCategoryId);
    const priority = normalizePriority(editPriority);
    const categoryExists = categories.some((category) => Number(category?.categoryId ?? category?.id) === categoryId);

    if (!Number.isInteger(categoryId) || categoryId <= 0 || !categoryExists) {
      setActionError('Vui lòng chọn một danh mục hợp lệ từ dữ liệu hệ thống trước khi xác nhận.');
      return;
    }

    if (!priority) {
      setActionError('Vui lòng chọn mức độ ưu tiên trước khi xác nhận.');
      return;
    }

    setActionError('');
    setApproveConfirmOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedTicket || loading) return;

    const categoryId = Number(editCategoryId);
    const priority = normalizePriority(editPriority);
    const categoryExists = categories.some((category) => Number(category?.categoryId ?? category?.id) === categoryId);

    if (!Number.isInteger(categoryId) || categoryId <= 0 || !categoryExists) {
      setActionError('Vui lòng chọn một danh mục hợp lệ từ dữ liệu hệ thống trước khi xác nhận.');
      return;
    }

    if (!priority) {
      setActionError('Vui lòng chọn mức độ ưu tiên trước khi xác nhận.');
      return;
    }

    setLoading(true);
    setActionError('');
    try {
      // Swagger separates classification edits from workflow verification:
      // 1) Manager persists category/priority inside the assigned area.
      // 2) Dedicated /verify endpoint performs the Verified transition.
      await managementFeedbackApi.updateFeedback(selectedTicket.feedbackId, {
        categoryId,
        priority,
        severity: editSeverity || null,
      });

      await managementFeedbackApi.verifyFeedback(selectedTicket.feedbackId);

      sessionStorage.removeItem(aiQueueCacheKey);
      try {
        signalrService.notifyStatusChanged(
          selectedTicket.feedbackId,
          selectedTicket.status,
          managementTypes.feedbackStatus.VERIFIED,
          user
        );
      } catch (e) {
        console.warn('SignalR notify failed', e);
      }

      if (isManagerFlow) {
        setApproveConfirmOpen(false);
        setTickets((current) => current.filter(
          (ticket) => ticket.feedbackId !== selectedTicket.feedbackId
        ));
        setSelectedTicket(null);
        setActionToast({ type: 'success', text: 'Đã xác minh phản ánh.' });
      } else {
        navigate(`/tickets/assign/${selectedTicket.feedbackId}`);
      }
    } catch (err) {
      console.error(err);
      setActionToast({
        type: 'error',
        text:
          err?.response?.data?.message
          || err?.response?.data?.title
          || extractApiErrorMessage(
            err,
            'Không thể lưu điều chỉnh và xác nhận phản ánh. Vui lòng thử lại.',
          ),
      });
    } finally {
      setLoading(false);
    }
  };

  const severeCount = useMemo(() => tickets.filter((ticket) => {
    const severity = getTicketSeverity(ticket);
    return severity === 'High' || severity === 'Critical';
  }).length, [tickets]);
  const criticalCount = useMemo(
    () => tickets.filter((ticket) => getTicketPriority(ticket) === 'Urgent').length,
    [tickets],
  );

  const selectKpiFilter = (nextFilter) => {
    setKpiFilter((current) => current === nextFilter ? '' : nextFilter);
  };

  const selectedDuplicateCandidate = selectedTicket?.feedbackId
    ? duplicateCandidatesByFeedbackId[String(selectedTicket.feedbackId)] || null
    : null;
  const selectedDuplicateUi = selectedDuplicateCandidate
    ? getDuplicateCandidateUi(selectedDuplicateCandidate)
    : null;

  const openDuplicateCandidate = (candidate) => {
    const candidateId = getDuplicateCandidateId(candidate);
    if (!candidateId) return;

    writeReviewViewState(reviewViewStateKey, {
      selectedFeedbackId: selectedTicket?.feedbackId || '',
      urgencyFilter,
      severityFilter,
      wardFilter,
      locationFilter,
      kpiFilter,
    });

    navigate(`/manager/incident-matches/${candidateId}`, {
      state: {
        returnTo: '/manager/reports/review',
        returnLabel: 'Quay lại duyệt phản ánh',
      },
    });
  };

  useEffect(() => {
    if (!mediaPreviewOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMediaPreviewOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mediaPreviewOpen]);

  return (
    <div className="admin-page-shell manager-ui-page space-y-5 text-slate-800">
      <ManagerToast
        type={actionToast.type || 'success'}
        message={actionToast.text}
        onClose={() => setActionToast({ type: '', text: '' })}
      />

      <ManagerConfirmDialog
        open={rejectConfirmOpen}
        title="Từ chối phản ánh?"
        description="Phản ánh sẽ được chuyển sang trạng thái Đã từ chối. Hành động này chỉ nên dùng khi nội dung không hợp lệ hoặc không đủ điều kiện tiếp nhận."
        confirmLabel="Từ chối phản ánh"
        tone="danger"
        loading={loading}
        onCancel={() => setRejectConfirmOpen(false)}
        onConfirm={confirmDeny}
      />
      <ManagerConfirmDialog
        open={approveConfirmOpen}
        title="Xác nhận phản ánh?"
        description="Phản ánh sẽ được chuyển sang trạng thái Đã xác minh với danh mục, mức độ nghiêm trọng và mức độ ưu tiên đang chọn. Bạn có muốn tiếp tục?"
        confirmLabel="Xác nhận phản ánh"
        tone="success"
        loading={loading}
        onCancel={() => setApproveConfirmOpen(false)}
        onConfirm={handleApprove}
      />
      <section className="admin-page-hero">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_16px_36px_rgba(37,99,235,0.24)]">
              <Lucide.Cpu size={25} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="admin-hero-title">Duyệt phản ánh</h1>
              <p className="admin-hero-description mt-2 max-w-3xl">
                Kiểm tra kết quả AI và xác minh phản ánh.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {reviewReturnContext ? (
              <button
                type="button"
                onClick={() => navigate(
                  reviewReturnContext.href,
                  reviewReturnContext.state ? { state: reviewReturnContext.state } : undefined,
                )}
                className="btn admin-secondary-action h-10 rounded-xl px-3.5 text-sm font-semibold normal-case"
              >
                <Lucide.ArrowLeft size={15} aria-hidden="true" />
                {reviewReturnContext.label}
              </button>
            ) : null}

            <div className="min-w-[240px] rounded-[24px] border border-emerald-200 bg-emerald-50/90 px-5 py-4 shadow-[0_10px_28px_rgba(16,185,129,0.08)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Đang chờ xác minh
            </div>
            <div className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-slate-950">
              {displayedTickets.length}
              <span className="ml-2 text-base font-semibold tracking-normal text-slate-700">phản ánh</span>
            </div>
          </div>
          </div>
        </div>
      </section>

      {queueError ? (
        <ErrorAlert
          title="Không thể tải hàng chờ duyệt"
          message={queueError}
          onClose={() => setQueueError('')}
        />
      ) : null}

      {queueWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          <span className="inline-flex items-start gap-2"><Lucide.TriangleAlert size={16} className="mt-0.5 shrink-0" />{queueWarning}</span>
        </div>
      ) : null}

      <section className="manager-kpi-grid grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setKpiFilter('')}
          aria-pressed={!kpiFilter}
          className={`admin-stat-card group flex items-stretch justify-between gap-4 p-5 text-left transition ${
            !kpiFilter ? 'border-blue-300 ring-2 ring-blue-100/80' : 'hover:border-blue-200'
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <p className="admin-section-description">Tổng phản ánh</p>
              {!kpiFilter ? <span className="manager-kpi-active-label">Đang xem</span> : null}
            </div>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{tickets.length}</p>
            <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">Toàn bộ phản ánh đang chờ Manager xác minh.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 self-center items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Lucide.Files size={20} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectKpiFilter('severityHigh')}
          aria-pressed={kpiFilter === 'severityHigh'}
          className={`admin-stat-card group flex items-stretch justify-between gap-4 p-5 text-left transition ${
            kpiFilter === 'severityHigh' ? 'border-blue-300 ring-2 ring-blue-100/80' : 'hover:border-blue-200'
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <p className="admin-section-description">Nghiêm trọng cao</p>
              {kpiFilter === 'severityHigh' ? <span className="manager-kpi-active-label">Đang lọc</span> : null}
            </div>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{severeCount}</p>
            <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">Phản ánh có mức nghiêm trọng Cao hoặc Nghiêm trọng.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 self-center items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <Lucide.TriangleAlert size={20} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => selectKpiFilter('urgent')}
          aria-pressed={kpiFilter === 'urgent'}
          className={`admin-stat-card group flex items-stretch justify-between gap-4 p-5 text-left transition ${
            kpiFilter === 'urgent' ? 'border-blue-300 ring-2 ring-blue-100/80' : 'hover:border-blue-200'
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <p className="admin-section-description">Ưu tiên khẩn cấp</p>
              {kpiFilter === 'urgent' ? <span className="manager-kpi-active-label">Đang lọc</span> : null}
            </div>
            <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{criticalCount}</p>
            <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">Phản ánh cần được ưu tiên xem xét ngay.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 self-center items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Lucide.Siren size={20} aria-hidden="true" />
          </span>
        </button>
      </section>

      {tickets.length === 0 && !queueError ? (
        <div className="admin-empty-panel p-12 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Lucide.CheckCircle2 size={30} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-950">Hàng chờ đang trống</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Hiện không có phản ánh nào cần Manager xác minh kết quả phân loại AI.</p>
        </div>
      ) : queueError && tickets.length === 0 ? (
        <div className="admin-panel p-8 text-center text-sm text-slate-500">
          Không thể hiển thị danh sách phản ánh cho đến khi dữ liệu được tải thành công.
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="admin-panel flex min-h-[570px] flex-col overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100vh-6rem)] xl:min-h-[570px] xl:max-h-none">
            <div className="shrink-0 border-b border-slate-200/80 p-5 2xl:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="admin-section-title">Phản ánh chờ xác nhận</h2>
                  <p className="admin-section-description mt-1">Chọn một phản ánh để kiểm tra dữ liệu AI trước khi xác minh.</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    Hiển thị {displayedTickets.length} / {tickets.length} phản ánh
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUrgencyDropdown((value) => !value)}
                  className="urgency-filter-button inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  <Lucide.SlidersHorizontal size={15} aria-hidden="true" />
                  Lọc
                </button>
              </div>

              {showUrgencyDropdown ? (
                <div className="urgency-dropdown mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.035)]">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Phường</p>
                      <ReviewChoiceSelect
                        label=""
                        value={wardFilter}
                        options={[{ value: '', label: 'Tất cả phường' }, ...wardOptions]}
                        onChange={setWardFilter}
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mức độ nghiêm trọng</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSeverityFilter('')}
                          className={`manager-filter-chip px-3 py-1.5 ${severityFilter === '' ? 'is-active' : ''}`}
                        >
                          Tất cả
                        </button>
                        {REVIEW_SEVERITY_OPTIONS.map(({ value: severity, label }) => (
                          <button
                            key={severity}
                            type="button"
                            onClick={() => setSeverityFilter(severity)}
                            className={`manager-filter-chip px-3 py-1.5 ${severityFilter === severity ? 'is-active' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mức độ ưu tiên</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setUrgencyFilter('')}
                          className={`manager-filter-chip px-3 py-1.5 ${urgencyFilter === '' ? 'is-active' : ''}`}
                        >
                          Tất cả
                        </button>
                        {URGENCY_OPTIONS.map((urgency) => (
                          <button
                            key={urgency}
                            type="button"
                            onClick={() => setUrgencyFilter(urgency)}
                            className={`manager-filter-chip px-3 py-1.5 ${urgencyFilter === urgency ? 'is-active' : ''}`}
                          >
                            {getUrgencyLabel(urgency)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tọa độ</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setLocationFilter('')}
                          className={`manager-filter-chip px-3 py-1.5 ${locationFilter === '' ? 'is-active' : ''}`}
                        >
                          Tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationFilter('withoutPreciseLocation')}
                          className={`manager-filter-chip px-3 py-1.5 ${locationFilter === 'withoutPreciseLocation' ? 'is-active' : ''}`}
                        >
                          Thiếu tọa độ
                        </button>
                      </div>
                    </div>

                    {(wardFilter || severityFilter || urgencyFilter || locationFilter) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setWardFilter('');
                          setSeverityFilter('');
                          setUrgencyFilter('');
                          setLocationFilter('');
                        }}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Lucide.RotateCcw size={13} aria-hidden="true" />
                        Xóa bộ lọc
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              ref={queueListRef}
              onScroll={(event) => writeReviewViewState(reviewViewStateKey, { listScrollTop: event.currentTarget.scrollTop })}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3"
            >
              {displayedTickets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Không có phản ánh phù hợp với bộ lọc.
                </div>
              ) : displayedTickets.map((ticket) => {
                const isActive = selectedTicket?.feedbackId === ticket.feedbackId;
                const urgency = getTicketPriority(ticket);

                return (
                  <button
                    key={ticket.feedbackId}
                    type="button"
                    onClick={() => handleSelectTicket(ticket)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`manager-list-card w-full p-3.5 text-left ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-blue-700" title={ticket.feedbackId}>{shortenFeedbackId(ticket.feedbackId)}</span>
                      <span className="shrink-0 text-xs font-medium text-slate-400">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-slate-900">{ticket.title || 'Không có tiêu đề'}</h3>
                    <p className="mt-1 truncate text-xs text-slate-500">{ticket.locationText || 'Chưa có địa điểm'}</p>
                    {!hasPreciseLocation(ticket) ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <Lucide.MapPinOff size={11} aria-hidden="true" />
                        Chưa có tọa độ chính xác
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getUrgencyBadgeClass(urgency)}`}>
                        {getUrgencyLabel(urgency)}
                      </span>
                      {(() => {
                        const duplicateCandidate = duplicateCandidatesByFeedbackId[String(ticket.feedbackId)];
                        if (!duplicateCandidate) return null;
                        const duplicateUi = getDuplicateCandidateUi(duplicateCandidate);

                        const DuplicateIcon = duplicateUi.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            duplicateUi.tone === 'violet'
                              ? 'border-violet-200 bg-violet-50 text-violet-700'
                              : duplicateUi.tone === 'emerald'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}>
                            <DuplicateIcon size={11} aria-hidden="true" />
                            {duplicateUi.label}
                          </span>
                        );
                      })()}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            {selectedTicket ? (
              <>
<section className="admin-panel overflow-hidden">
                  <div className="border-b border-slate-200/80 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                          <Lucide.Sparkles size={14} aria-hidden="true" />
                          Phân tích từ AI
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-slate-950">Kết quả AI đề xuất</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Kiểm tra và điều chỉnh kết quả AI trước khi xác minh.</p>
                      </div>

                      <div className="admin-inset-panel min-w-[190px] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Lucide.BarChart3 size={19} aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Độ tin cậy AI</p>
                            <p className="mt-1 text-2xl font-bold tracking-[-0.025em] text-slate-950">{Math.round((selectedTicket.confidenceScore || 0) * 100)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 p-5 sm:p-6">
                    <div className="admin-inset-panel p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tóm tắt sự cố</p>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getUrgencyBadgeClass(getTicketPriority(selectedTicket))}`}>
                          {getUrgencyLabel(getTicketPriority(selectedTicket))}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold leading-7 text-slate-800">{selectedTicket.summary || selectedTicket.description || 'Không có tóm tắt từ AI.'}</p>
                    </div>

                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Lucide.ShieldCheck size={16} /></span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">Độ tin cậy</p>
                            <p className="mt-0.5 text-base font-bold leading-6 tracking-[-0.01em] text-slate-900">{Math.round((selectedTicket.confidenceScore || 0) * 100)}%</p>
                          </div>
                        </div>
                      </div>
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Lucide.TriangleAlert size={16} /></span>
                          <div className="min-w-0">
                            <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Nghiêm trọng</p>
                            <p className="mt-0.5 whitespace-nowrap text-[15px] font-bold leading-6 tracking-[-0.01em] text-slate-900">{getSeverityLabel(editSeverity || getTicketSeverity(selectedTicket))}</p>
                          </div>
                        </div>
                      </div>
                      <div className="admin-inset-panel px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Lucide.TrendingUp size={16} /></span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">Ưu tiên</p>
                            <p className="mt-0.5 text-base font-bold leading-6 tracking-[-0.01em] text-slate-900">{getUrgencyLabel(getTicketPriority(selectedTicket))}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedDuplicateCandidate && selectedDuplicateUi ? (() => {
                      const DuplicateIcon = selectedDuplicateUi.icon;
                      const pending = getDuplicateCandidateStatus(selectedDuplicateCandidate) === 'Pending';

                      return (
                        <div className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                          pending
                            ? 'border-violet-200 bg-violet-50/70'
                            : selectedDuplicateUi.tone === 'emerald'
                              ? 'border-emerald-200 bg-emerald-50/65'
                              : 'border-slate-200 bg-slate-50'
                        }`}>
                          <div className="flex min-w-0 items-start gap-3">
                            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              pending
                                ? 'bg-violet-100 text-violet-700'
                                : selectedDuplicateUi.tone === 'emerald'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-600'
                            }`}>
                              <DuplicateIcon size={18} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-sm font-bold ${
                                  pending
                                    ? 'text-violet-900'
                                    : selectedDuplicateUi.tone === 'emerald'
                                      ? 'text-emerald-900'
                                      : 'text-slate-900'
                                }`}>
                                  {selectedDuplicateUi.title}
                                </p>
                                {selectedDuplicateUi.confidence !== null ? (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    pending
                                      ? 'bg-violet-100 text-violet-700'
                                      : 'bg-white/80 text-slate-600'
                                  }`}>
                                    {selectedDuplicateUi.confidence}% tương đồng
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {selectedDuplicateUi.description}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openDuplicateCandidate(selectedDuplicateCandidate)}
                            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition ${
                              pending
                                ? 'border-violet-300 bg-white text-violet-700 hover:bg-violet-100'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                          >
                            {pending ? <Lucide.GitCompareArrows size={15} /> : <Lucide.ExternalLink size={15} />}
                            {selectedDuplicateUi.buttonLabel}
                          </button>
                        </div>
                      );
                    })() : duplicateLookupLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
                        <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                        Đang kiểm tra đề xuất trùng lặp...
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-[18px] dark:border-slate-800 dark:bg-slate-900/35">
                      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Điều chỉnh kết quả AI</h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Manager có thể sửa đề xuất trước khi xác minh phản ánh.</p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                          <Lucide.PencilLine size={12} aria-hidden="true" /> Có thể chỉnh sửa
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <ReviewChoiceSelect
                            label="Danh mục"
                            value={editCategoryId}
                            disabled={categories.length === 0 || loading}
                            options={categories.map((category) => ({
                              value: Number(category?.categoryId ?? category?.id),
                              label: category?.categoryName ?? category?.name ?? 'Chưa đặt tên',
                            }))}
                            onChange={(value) => {
                              setEditCategoryId(Number(value));
                              setActionError('');
                            }}
                          />
                          {categoriesError ? <p className="mt-2 text-xs font-medium text-red-600">{categoriesError}</p> : null}
                        </div>

                        <div>
                          <span className="mb-2 block text-[13px] font-semibold leading-5 text-slate-700 dark:text-slate-200">Khu vực</span>
                          <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                            <Lucide.MapPin size={15} className="mr-2 shrink-0 text-slate-400" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate leading-5" title={selectedTicket.areaName || 'Chưa có khu vực'}>
                              {selectedTicket.areaName || 'Chưa có khu vực'}
                            </span>
                          </div>
                        </div>

                        <ReviewChoiceSelect
                          label="Mức độ nghiêm trọng"
                          value={editSeverity}
                          disabled={loading}
                          options={REVIEW_SEVERITY_OPTIONS}
                          onChange={(value) => {
                            setEditSeverity(value);
                            setActionError('');
                          }}
                        />

                        <ReviewChoiceSelect
                          label="Mức độ ưu tiên"
                          value={editPriority}
                          disabled={loading}
                          options={REVIEW_PRIORITY_OPTIONS}
                          onChange={(value) => {
                            setEditPriority(value);
                            setActionError('');
                          }}
                        />
                      </div>
                    </div>

                    <div className="admin-inset-panel p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900">Rủi ro và hành động đề xuất</h3>
                          <p className="mt-1 text-sm text-slate-500">Thông tin hỗ trợ từ kết quả phân tích AI trước khi Manager xác nhận.</p>
                        </div>
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Thông tin AI</span>
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">Rủi ro / lưu ý</p>
                          {selectedTicket.riskNotes?.length > 0 ? (
                            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                              {selectedTicket.riskNotes.map((note) => <li key={note}>{note}</li>)}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">Không có ghi chú rủi ro cụ thể.</p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Hành động đề xuất</p>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                            <li className="flex gap-2"><Lucide.Check size={15} className="mt-1 shrink-0 text-emerald-600" />Kiểm tra danh mục, độ ưu tiên và mức nghiêm trọng AI đề xuất.</li>
                            <li className="flex gap-2"><Lucide.Check size={15} className="mt-1 shrink-0 text-emerald-600" />Điều chỉnh nếu cần rồi xác nhận phản ánh.</li>
                            <li className="flex gap-2"><Lucide.Check size={15} className="mt-1 shrink-0 text-emerald-600" />Xem lại các lưu ý rủi ro trước khi xác nhận.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {actionError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
                        {actionError}
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleDeny}
                          disabled={loading}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-bold text-red-700 shadow-[0_12px_28px_rgba(239,68,68,0.12)] transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.XCircle size={18} aria-hidden="true" />}
                          Từ chối phản ánh
                        </button>
                        <button
                          type="button"
                          onClick={requestApproveConfirmation}
                          disabled={loading || categories.length === 0 || !editCategoryId || !normalizePriority(editPriority)}
                          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.20)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.CheckCircle2 size={18} aria-hidden="true" />}
                          {loading ? 'Đang xử lý...' : 'Xác nhận phản ánh'}
                        </button>
                      </div>
                  </div>
                </section>

                <section className="admin-panel overflow-hidden">
                  <div className="flex items-start gap-3 border-b border-slate-200/80 px-5 py-4 sm:px-6">
                    <span className="manager-section-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                      <Lucide.FileText size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="admin-section-title">Chi tiết phản ánh</h2>
                      <p className="admin-section-description mt-1">Thông tin gốc dùng để đối chiếu với kết quả AI.</p>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid gap-3 xl:grid-cols-[1.5fr_0.8fr]">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/45 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-500">Tiêu đề phản ánh</p>
                        <p className="mt-2 text-base font-semibold leading-6 text-slate-900">{selectedTicket.title || 'Không có tiêu đề'}</p>
                      </div>
                      <div className="admin-inset-panel p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mã phản ánh</p>
                        <p className="mt-2 whitespace-nowrap text-sm font-semibold text-blue-700" title={selectedTicket.feedbackId}>{shortenFeedbackId(selectedTicket.feedbackId)}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="admin-inset-panel p-3.5">
                        <div className="flex items-center gap-2 text-slate-400"><Lucide.UserRound size={14} /><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Người báo cáo</p></div>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{selectedTicket.reporterName || 'Không rõ'}</p>
                      </div>
                      <div className="admin-inset-panel p-3.5">
                        <div className="flex items-center gap-2 text-slate-400"><Lucide.MapPinned size={14} /><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Phường / khu vực</p></div>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{selectedTicket.areaName || 'Không có khu vực'}</p>
                      </div>
                      <div className="admin-inset-panel p-3.5">
                        <div className="flex items-center gap-2 text-slate-400"><Lucide.Tags size={14} /><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Danh mục</p></div>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{selectedTicket.categoryName || 'Không có danh mục'}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                          <Lucide.MapPin size={15} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Địa điểm</p>
                          <p className="mt-1.5 text-sm font-medium leading-6 text-slate-700">{selectedTicket.locationText || 'Không có địa điểm'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Lucide.MapPinned size={15} className="text-blue-500" aria-hidden="true" />
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Vị trí trên bản đồ</p>
                        </div>
                        <span className="text-xs text-slate-400">Bấm bản đồ để mở toàn màn hình</span>
                      </div>
                      <FeedbackLocationMapCard
                        feedbackId={selectedTicket.feedbackId}
                        latitude={selectedTicket.latitude ?? selectedTicket.lat}
                        longitude={selectedTicket.longitude ?? selectedTicket.lng ?? selectedTicket.long}
                        locationText={selectedTicket.locationText}
                        areaName={selectedTicket.areaName || selectedTicket.wardName || selectedTicket.area?.name}
                        variant="admin"
                        internalMapPath="/manager/map"
                        compact
                        bare
                        showHeader={false}
                        className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
                        returnTo="/manager/reports/review"
                        returnLabel="Quay lại duyệt phản ánh"
                        returnState={{
                          reviewState: {
                            selectedFeedbackId: selectedTicket.feedbackId,
                            urgencyFilter,
                            severityFilter,
                            wardFilter,
                            locationFilter,
                            kpiFilter,
                          },
                        }}
                      />
                    </div>

                    {(() => {
                      const mediaUrls = getReviewMediaUrls(selectedTicket);
                      const activeMediaIndex = Math.min(selectedMediaIndex, Math.max(mediaUrls.length - 1, 0));
                      return (
                        <div className={`mt-5 grid items-stretch gap-5 ${mediaUrls.length > 0 ? 'lg:grid-cols-[1.05fr_0.95fr]' : 'grid-cols-1'}`}>
                          <div className="flex min-w-0 flex-col">
                            <div className="flex items-center gap-2">
                              <Lucide.Quote size={15} className="text-blue-500" aria-hidden="true" />
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Nội dung phản ánh</p>
                            </div>
                            <div className={`mt-2 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 text-[15px] font-medium leading-7 text-slate-700 ${mediaUrls.length > 0 ? 'lg:h-[240px]' : 'min-h-28'}`}>
                              {selectedTicket.description || selectedTicket.title || 'Không có nội dung phản ánh.'}
                            </div>
                            {detailLoading ? (
                              <p className="mt-2 text-xs font-medium text-slate-400">Đang tải đầy đủ nội dung và hình ảnh...</p>
                            ) : detailError ? (
                              <p className="mt-2 text-xs font-medium text-rose-600">{detailError}</p>
                            ) : mediaUrls.length === 0 ? (
                              <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500">
                                <Lucide.ImageOff size={15} aria-hidden="true" />
                                Người dân không gửi hình ảnh kèm phản ánh này.
                              </div>
                            ) : null}
                          </div>

                          {mediaUrls.length > 0 ? (
                            <div className="flex min-w-0 flex-col">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Lucide.ImageIcon size={15} className="text-blue-500" aria-hidden="true" />
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Hình ảnh người dân gửi</p>
                                </div>
                                <span className="text-xs font-semibold text-slate-400">{activeMediaIndex + 1}/{mediaUrls.length}</span>
                              </div>

                              <div className="relative mt-2 h-[240px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => setMediaPreviewOpen(true)}
                                  className="group block h-full w-full cursor-zoom-in"
                                  aria-label={`Mở ảnh ${activeMediaIndex + 1} toàn màn hình`}
                                >
                                  <img
                                    src={mediaUrls[activeMediaIndex]}
                                    alt={`Hình ảnh người dân gửi ${activeMediaIndex + 1}`}
                                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01]"
                                  />
                                  <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/65 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                                    <Lucide.Maximize2 size={13} />
                                    Xem ảnh
                                  </span>
                                </button>

                                {mediaUrls.length > 1 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMediaIndex((index) => (index - 1 + mediaUrls.length) % mediaUrls.length)}
                                      className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white"
                                      aria-label="Ảnh trước"
                                    >
                                      <Lucide.ChevronLeft size={18} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMediaIndex((index) => (index + 1) % mediaUrls.length)}
                                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white"
                                      aria-label="Ảnh tiếp theo"
                                    >
                                      <Lucide.ChevronRight size={18} />
                                    </button>
                                  </>
                                ) : null}
                              </div>

                              {mediaPreviewOpen && typeof document !== 'undefined'
                                ? createPortal(
                                    <div
                                      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md sm:p-6"
                                      role="dialog"
                                      aria-modal="true"
                                      aria-label="Xem hình ảnh phản ánh"
                                      onMouseDown={(event) => {
                                        if (event.target === event.currentTarget) setMediaPreviewOpen(false);
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setMediaPreviewOpen(false)}
                                        className="fixed right-4 top-4 z-[10001] inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 sm:right-6 sm:top-6"
                                        aria-label="Đóng ảnh"
                                      >
                                        <Lucide.X size={22} />
                                      </button>

                                      {mediaUrls.length > 1 ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedMediaIndex((index) => (index - 1 + mediaUrls.length) % mediaUrls.length)}
                                            className="fixed left-4 top-1/2 z-[10001] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/65 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 sm:left-6"
                                            aria-label="Ảnh trước"
                                          >
                                            <Lucide.ChevronLeft size={24} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedMediaIndex((index) => (index + 1) % mediaUrls.length)}
                                            className="fixed right-4 top-1/2 z-[10001] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/65 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 sm:right-6"
                                            aria-label="Ảnh tiếp theo"
                                          >
                                            <Lucide.ChevronRight size={24} />
                                          </button>
                                        </>
                                      ) : null}

                                      <div className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] items-center justify-center sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)]">
                                        <img
                                          src={mediaUrls[activeMediaIndex]}
                                          alt={`Hình ảnh người dân gửi ${activeMediaIndex + 1}`}
                                          className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                                        />
                                      </div>

                                      <span className="fixed bottom-4 left-1/2 z-[10001] -translate-x-1/2 rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md sm:bottom-6">
                                        {activeMediaIndex + 1}/{mediaUrls.length}
                                      </span>
                                    </div>,
                                    document.body,
                                  )
                                : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                </section>
              </>
            ) : (
              <div className="admin-empty-panel p-12 text-center">
                <Lucide.MousePointerClick size={30} className="mx-auto text-slate-300" aria-hidden="true" />
                <h2 className="mt-3 font-bold text-slate-900">Chọn một phản ánh</h2>
                <p className="mt-1 text-sm text-slate-500">Chọn hồ sơ ở danh sách bên trái để bắt đầu kiểm duyệt.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

};
