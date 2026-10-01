// src/pages/tickets/TicketDetailPage.jsx

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toolsApi } from '@urbanmind/shared-api';
import { managementTypes } from '@urbanmind/shared-types';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { getCommunityFeedDetail } from '../../services/api/feedApi';
import useTicketDetail from '../../hooks/useTicketDetail';
import { useResolvedLocationText } from '../../hooks/useResolvedLocationText';
import { LocationPicker } from '../../components/maps/LocationPicker';
import PublicPageMotion from '../../components/public/PublicPageMotion';
import FeedbackLocationMapCard from '../../components/maps/FeedbackLocationMapCard';
import { cacheTicketPreview, getFirstTicketImageUrl } from './ticketPreviewCache';

const CATEGORY_LABELS = {
  Drainage: 'Thoát nước',
  'Garbage Collection': 'Thu gom rác',
  'Public Safety': 'An toàn công cộng',
  'Road Maintenance': 'Bảo trì đường bộ',
  'Street Lighting': 'Chiếu sáng đô thị',
  'Water Supply': 'Cấp nước',
};

const MAX_EDIT_ATTACHMENT_COUNT = 5;
const MAX_EDIT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_EDIT_VIDEO_SIZE_BYTES = 10 * 1024 * 1024;

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
};

const getAreaId = (area) => area?.areaId ?? area?.id;
const getAreaName = (area) => (
  area?.areaName ?? area?.name ?? area?.displayName ?? 'Chưa xác định khu vực'
);

const getCitizenStatusLabel = (status) => {
  switch (status) {
    case managementTypes.feedbackStatus.SUBMITTED:
      return 'Đã gửi';
    case managementTypes.feedbackStatus.AI_REVIEWED:
      return 'Đang phân loại';
    case managementTypes.feedbackStatus.VERIFIED:
      return 'Đã xác minh';
    case managementTypes.feedbackStatus.ASSIGNED:
      return 'Đã phân công';
    case managementTypes.feedbackStatus.IN_PROGRESS:
      return 'Đang xử lý';
    case managementTypes.feedbackStatus.RESOLVED:
    case managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL:
      return 'Đang kiểm tra kết quả';
    case managementTypes.feedbackStatus.NEED_REWORK:
      return 'Cần xử lý bổ sung';
    case managementTypes.feedbackStatus.APPROVED:
      return 'Chờ bạn đánh giá';
    case managementTypes.feedbackStatus.CLOSED:
      return 'Đã đóng';
    case managementTypes.feedbackStatus.REJECTED:
      return 'Không tiếp nhận';
    case managementTypes.feedbackStatus.CANCELLED:
      return 'Đã hủy';
    default:
      return 'Đang cập nhật';
  }
};

const getStatusTone = (status) => {
  if (
    [
      managementTypes.feedbackStatus.APPROVED,
      managementTypes.feedbackStatus.CLOSED,
    ].includes(status)
  ) {
    return 'border-success/25 bg-success/10 text-success';
  }

  if (
    [
      managementTypes.feedbackStatus.REJECTED,
      managementTypes.feedbackStatus.CANCELLED,
    ].includes(status)
  ) {
    return 'border-error/25 bg-error/10 text-error';
  }

  if (
    [
      managementTypes.feedbackStatus.IN_PROGRESS,
      managementTypes.feedbackStatus.NEED_REWORK,
      managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
      managementTypes.feedbackStatus.RESOLVED,
    ].includes(status)
  ) {
    return 'border-warning/30 bg-warning/10 text-warning';
  }

  return 'border-info/25 bg-info/10 text-info';
};

const renderCitizenStatusIcon = (status) => {
  switch (status) {
    case managementTypes.feedbackStatus.SUBMITTED:
      return <Lucide.Send size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.AI_REVIEWED:
      return <Lucide.ScanSearch size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.VERIFIED:
      return <Lucide.BadgeCheck size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.ASSIGNED:
      return <Lucide.SendToBack size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.IN_PROGRESS:
      return <Lucide.LoaderCircle size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.RESOLVED:
    case managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL:
      return <Lucide.ClipboardCheck size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.NEED_REWORK:
      return <Lucide.RotateCcw size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.APPROVED:
      return <Lucide.CircleCheck size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.CLOSED:
      return <Lucide.Archive size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.REJECTED:
      return <Lucide.ShieldAlert size={18} aria-hidden="true" />;
    case managementTypes.feedbackStatus.CANCELLED:
      return <Lucide.CircleX size={18} aria-hidden="true" />;
    default:
      return <Lucide.Activity size={18} aria-hidden="true" />;
  }
};


const TICKET_DETAIL_SNAPSHOT_PREFIX =
  'urbanmind-service-user-ticket-detail:';

const getTicketDetailSnapshotKey = (feedbackId, userId) => {
  if (!feedbackId || !userId) return '';

  return `${TICKET_DETAIL_SNAPSHOT_PREFIX}${encodeURIComponent(String(userId))}:${encodeURIComponent(String(feedbackId))}`;
};

const removeLegacyTicketDetailSnapshot = (feedbackId) => {
  if (typeof window === 'undefined' || !feedbackId) return;

  try {
    window.sessionStorage.removeItem(
      `${TICKET_DETAIL_SNAPSHOT_PREFIX}${feedbackId}`
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};

const readTicketDetailSnapshot = (feedbackId, userId) => {
  if (
    typeof window === 'undefined' ||
    !feedbackId ||
    !userId
  ) {
    return null;
  }

  try {
    // Snapshots created before user scoping are unsafe to reuse.
    removeLegacyTicketDetailSnapshot(feedbackId);

    const snapshotKey = getTicketDetailSnapshotKey(feedbackId, userId);
    const rawSnapshot = window.sessionStorage.getItem(
      snapshotKey
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

const writeTicketDetailSnapshot = (feedbackId, userId, ticket) => {
  if (
    typeof window === 'undefined' ||
    !feedbackId ||
    !userId ||
    !ticket
  ) {
    return;
  }

  try {
    removeLegacyTicketDetailSnapshot(feedbackId);

    window.sessionStorage.setItem(
      getTicketDetailSnapshotKey(feedbackId, userId),
      JSON.stringify(ticket)
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};

const removeTicketDetailSnapshot = (feedbackId, userId) => {
  if (typeof window === 'undefined' || !feedbackId) return;

  try {
    removeLegacyTicketDetailSnapshot(feedbackId);

    const snapshotKey = getTicketDetailSnapshotKey(feedbackId, userId);
    if (snapshotKey) window.sessionStorage.removeItem(snapshotKey);
  } catch {
    // Storage can be unavailable in private mode.
  }
};

const DetailSmartCityBackdrop = () => (
  <div
    className="pointer-events-none absolute inset-0 overflow-hidden"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 1400 320"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full text-primary"
      fill="none"
    >
      <path
        d="M-40 250C135 210 185 72 365 96C515 116 515 260 690 243C836 229 856 81 1018 90C1165 98 1192 214 1445 142"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.075"
      />
      <path
        d="M-15 278C180 238 222 129 397 145C564 160 614 294 786 262C934 234 964 126 1131 124C1250 122 1320 171 1435 188"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="9 12"
        strokeOpacity="0.06"
      />
      <path
        d="M722 -25C761 70 742 145 802 207C872 278 1014 280 1075 194C1129 118 1091 38 1173 -28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.055"
      />
      <circle cx="365" cy="96" r="7" fill="currentColor" fillOpacity="0.075" />
      <circle cx="690" cy="243" r="9" fill="currentColor" fillOpacity="0.06" />
      <circle cx="1018" cy="90" r="6" fill="currentColor" fillOpacity="0.09" />
      <circle cx="1131" cy="124" r="18" stroke="currentColor" strokeOpacity="0.06" />
    </svg>

    <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-secondary/[0.045] blur-3xl" />
    <div className="absolute -bottom-28 right-[10%] h-72 w-72 rounded-full bg-info/[0.065] blur-3xl" />

    <span className="absolute left-[56%] top-[18%] hidden h-8 w-8 items-center justify-center rounded-full border border-primary/10 bg-base-100/55 text-primary/35 shadow-sm backdrop-blur lg:flex">
      <Lucide.MapPin size={14} />
    </span>
    <span className="absolute bottom-[16%] left-[66%] hidden h-7 w-7 items-center justify-center rounded-full border border-success/10 bg-base-100/55 text-success/35 shadow-sm backdrop-blur lg:flex">
      <Lucide.Check size={13} />
    </span>
    <span className="absolute right-[22%] top-[16%] hidden h-7 w-7 items-center justify-center rounded-full border border-secondary/10 bg-base-100/55 text-secondary/35 shadow-sm backdrop-blur lg:flex">
      <Lucide.Radio size={13} />
    </span>
  </div>
);

const TicketDetailShell = ({ children }) => (
  <PublicPageMotion>
    <div data-public-reveal className="text-[var(--public-title)]">
      {children}
    </div>
  </PublicPageMotion>
);

const DetailBackButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3 text-sm font-semibold text-[var(--public-copy)] shadow-sm transition hover:border-primary/25 hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  >
    <Lucide.ArrowLeft size={15} aria-hidden="true" />
    {label}
  </button>
);

const TicketDetailSkeleton = () => (
  <TicketDetailShell>
    <main
      className="space-y-4"
      aria-busy="true"
      aria-label="Đang tải chi tiết phản ánh"
    >
      <section className="relative h-[224px] overflow-hidden rounded-[30px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[var(--public-shadow)]">
        <DetailSmartCityBackdrop />
        <div className="relative grid h-full gap-6 px-6 py-7 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
          <div className="space-y-4">
            <div className="h-7 w-32 animate-pulse rounded-full bg-base-content/8" />
            <div className="h-9 w-[min(520px,78%)] animate-pulse rounded-xl bg-base-content/10" />
            <div className="flex flex-wrap gap-3">
              <div className="h-8 w-32 animate-pulse rounded-xl bg-base-content/8" />
              <div className="h-8 w-44 animate-pulse rounded-xl bg-base-content/8" />
              <div className="h-8 w-36 animate-pulse rounded-xl bg-base-content/8" />
            </div>
          </div>
          <div className="hidden h-36 animate-pulse rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] xl:block" />
        </div>
      </section>

      <section className="h-44 animate-pulse rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm" />

      <section className="h-[420px] animate-pulse rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm" />
    </main>
  </TicketDetailShell>
);

export const TicketDetailPage = () => {
  const { id: feedbackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const {
    ticket: fetchedTicket,
    loading,
    error,
    errorStatus,
    errorFeedbackId,
    getAttachmentUrl,
  } = useTicketDetail(feedbackId, user, undefined, { cacheTicketDetails: true });

  const snapshotUserId = user?.userId ?? user?.id ?? '';
  const ticketSnapshotKey = useMemo(
    () => getTicketDetailSnapshotKey(feedbackId, snapshotUserId),
    [feedbackId, snapshotUserId]
  );
  const [ticketState, setTicketState] = useState(() => ({
    snapshotKey: getTicketDetailSnapshotKey(feedbackId, snapshotUserId),
    value: readTicketDetailSnapshot(feedbackId, snapshotUserId),
  }));
  const hasBlockingLoadError = (
    errorFeedbackId &&
    String(errorFeedbackId) === String(feedbackId) &&
    [401, 403, 404].includes(errorStatus)
  );
  const ticket = (
    ticketState.snapshotKey === ticketSnapshotKey &&
    !hasBlockingLoadError
  )
    ? ticketState.value
    : null;
  const resolvedLocationText = useResolvedLocationText({
    locationText: ticket?.locationText,
    areaName: ticket?.areaName || ticket?.wardName || ticket?.districtName,
    latitude: ticket?.latitude,
    longitude: ticket?.longitude,
  });

  const setTicket = useCallback((updater) => {
    setTicketState((current) => {
      const currentValue = current.snapshotKey === ticketSnapshotKey
        ? current.value
        : null;
      const nextValue = typeof updater === 'function'
        ? updater(currentValue)
        : updater;

      return {
        snapshotKey: ticketSnapshotKey,
        value: nextValue,
      };
    });
  }, [ticketSnapshotKey]);
  const [updateNotice, setUpdateNotice] = useState('');
  const [previewAttachmentIndex, setPreviewAttachmentIndex] = useState(null);
  const [previewSource, setPreviewSource] = useState('detail');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);
  const [editAttachments, setEditAttachments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const selectedFilesRef = useRef([]);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState(null);
  const [, setRelatedFeedbacks] = useState([]);
  const [, setRelatedFeedbacksLoading] = useState(false);
  const [, setRelatedFeedbacksError] = useState('');
  const relatedParentFeedbackId = ticket?.parentTicketId || ticket?.parentFeedbackId || null;
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationPickerError, setLocationPickerError] = useState('');
  const [locationDraft, setLocationDraft] = useState({
    areaId: '',
    locationText: '',
    latitude: null,
    longitude: null,
  });
  const editInitialSnapshotRef = useRef('');
  const [editForm, setEditForm] = useState({
    areaId: '',
    categoryId: '',
    title: '',
    description: '',
    locationText: '',
    latitude: null,
    longitude: null,
    priority: '',
  });

  useEffect(() => {
    setTicketState({
      snapshotKey: ticketSnapshotKey,
      value: readTicketDetailSnapshot(feedbackId, snapshotUserId),
    });
  }, [feedbackId, snapshotUserId, ticketSnapshotKey]);


  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const scrollContainer = document.querySelector(
      '[data-dashboard-scroll-container]'
    );
    if (!scrollContainer) return undefined;

    scrollContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frameId = window.requestAnimationFrame(() => {
      scrollContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [feedbackId]);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    const loadRelatedFeedbacks = async () => {
      const linkedIncidentId = ticket?.incidentId;
      if (!linkedIncidentId) {
        setRelatedFeedbacks([]);
        setRelatedFeedbacksError('');
        setRelatedFeedbacksLoading(false);
        return;
      }

      setRelatedFeedbacksLoading(true);
      setRelatedFeedbacksError('');

      try {
        const parentFeedback = await getCommunityFeedDetail(
          linkedIncidentId,
          { signal: abortController.signal },
        );
        if (active) {
          setRelatedFeedbacks(parentFeedback ? [{
            ...parentFeedback,
            incidentId: parentFeedback.incidentId || linkedIncidentId,
            relationType: 'incident',
          }] : []);
        }
      } catch (relatedError) {
        if (abortController.signal.aborted) return;
        console.error('Không thể tải sự vụ cộng đồng liên quan', relatedError);
        if (active) {
          setRelatedFeedbacks([]);
          setRelatedFeedbacksError(
            relatedError?.message || 'Không thể tải sự vụ cộng đồng liên quan.'
          );
        }
      } finally {
        if (active) setRelatedFeedbacksLoading(false);
      }
    };

    loadRelatedFeedbacks();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [ticket?.incidentId]);

  const attachments = Array.isArray(ticket?.attachments)
    ? ticket.attachments
    : [];


  useEffect(() => {
    if (!ticket || !feedbackId) return;

    const previewUrl = getFirstTicketImageUrl(ticket);
    cacheTicketPreview(ticket, previewUrl);
  }, [feedbackId, ticket]);

  const editPreviewItems = [
    ...editAttachments,
    ...selectedFiles,
  ];
  const previewItems = previewSource === 'edit'
    ? editPreviewItems
    : attachments;
  const previewAttachment = previewAttachmentIndex === null
    ? null
    : previewItems[previewAttachmentIndex] || null;

  const readReturnContext = () => {
    let storedContext;

    try {
      storedContext = JSON.parse(
        sessionStorage.getItem('urbanmind-ticket-list-return') || 'null'
      );
    } catch {
      storedContext = null;
    }

    const matchingStoredContext = (
      storedContext?.ticketId &&
      String(storedContext.ticketId) === String(feedbackId)
    )
      ? storedContext
      : null;

    const from = location.state?.from || matchingStoredContext?.from || '/tickets';

    return {
      from,
      returnLabel:
        location.state?.returnLabel ||
        (
          from === '/community/map'
            ? 'Quay lại bản đồ sự cố'
            : 'Quay lại phản ánh của tôi'
        ),
      scrollY: Number(matchingStoredContext?.scrollY || 0),
      ticketId:
        location.state?.ticketId ||
        matchingStoredContext?.ticketId ||
        feedbackId,
      mapState: location.state?.mapState || null,
    };
  };

  const returnContext = readReturnContext();

  const handleBackToList = ({ replace = false, highlight = true } = {}) => {
    const returningToMap = returnContext.from === '/community/map';

    if (!highlight && typeof window !== 'undefined') {
      try {
        const rawContext = window.sessionStorage.getItem(
          'urbanmind-ticket-list-return'
        );
        const storedContext = rawContext ? JSON.parse(rawContext) : null;

        if (storedContext) {
          window.sessionStorage.setItem(
            'urbanmind-ticket-list-return',
            JSON.stringify({
              ...storedContext,
              pendingRestore: false,
            })
          );
        }
      } catch {
        // Storage can be unavailable in private mode.
      }
    }

    navigate(returnContext.from, {
      replace,
      state: returningToMap
        ? {
          mapState: returnContext.mapState,
        }
        : {
          restoreScrollY: returnContext.scrollY,
          restoreTicketId: highlight ? returnContext.ticketId : null,
        },
    });
  };


  const serializeEditState = (form = editForm, files = selectedFiles) => JSON.stringify({
    areaId: String(form.areaId || ''),
    categoryId: String(form.categoryId || ''),
    title: form.title || '',
    description: form.description || '',
    locationText: form.locationText || '',
    latitude: form.latitude ?? null,
    longitude: form.longitude ?? null,
    priority: form.priority || '',
    selectedFiles: files.map((item) => {
      const file = item.file || item;
      return `${file.name}-${file.size}-${file.lastModified}`;
    }),
    attachmentIds: editAttachments.map((file) => resolveAttachmentId(file)),
  });

  const requestCloseEdit = () => {
    const currentSnapshot = serializeEditState();

    if (
      editInitialSnapshotRef.current &&
      currentSnapshot !== editInitialSnapshotRef.current
    ) {
      const shouldClose = window.confirm(
        'Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng trình chỉnh sửa?'
      );

      if (!shouldClose) return;
    }

    clearSelectedFiles();
    setLocationPickerError('');
    setLocationPickerOpen(false);
    setActionError('');
    setEditOpen(false);
  };

  useEffect(() => {
    const fetchedFeedbackId = (
      fetchedTicket?.feedbackId ??
      fetchedTicket?.ticketId ??
      fetchedTicket?.id
    );

    if (
      !fetchedTicket ||
      !fetchedFeedbackId ||
      String(fetchedFeedbackId) !== String(feedbackId)
    ) {
      return;
    }

    setTicket(fetchedTicket);
    writeTicketDetailSnapshot(
      feedbackId,
      snapshotUserId,
      fetchedTicket
    );
  }, [feedbackId, fetchedTicket, setTicket, snapshotUserId]);

  useEffect(() => {
    const requestFailedForCurrentFeedback = (
      errorFeedbackId &&
      String(errorFeedbackId) === String(feedbackId)
    );

    if (
      !requestFailedForCurrentFeedback ||
      ![401, 403, 404].includes(errorStatus)
    ) {
      return;
    }

    removeTicketDetailSnapshot(feedbackId, snapshotUserId);
    setTicket(null);
    setEditOpen(false);
    setDeleteOpen(false);
    setAttachmentDeleteTarget(null);
    setPreviewAttachmentIndex(null);
  }, [
    errorFeedbackId,
    errorStatus,
    feedbackId,
    setTicket,
    snapshotUserId,
  ]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    if (!updateNotice) return undefined;

    const timer = window.setTimeout(() => {
      setUpdateNotice('');
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [updateNotice]);

  useEffect(() => () => {
    selectedFilesRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  useEffect(() => {
    if (!previewAttachment) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handlePreviewKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewAttachmentIndex(null);
        return;
      }

      if (
        previewItems.length > 1 &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        setPreviewAttachmentIndex((currentIndex) => {
          const safeIndex = Number.isInteger(currentIndex) ? currentIndex : 0;
          return (safeIndex + direction + previewItems.length) % previewItems.length;
        });
      }
    };

    document.addEventListener('keydown', handlePreviewKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handlePreviewKeyDown);
    };
  }, [previewAttachment, previewItems.length]);

  useEffect(() => {
    const actionOverlayOpen = Boolean(
      editOpen || deleteOpen || attachmentDeleteTarget || locationPickerOpen
    );

    if (!actionOverlayOpen || previewAttachment) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleOverlayKeyDown = (event) => {
      if (event.key !== 'Escape' || actionLoading) return;

      if (locationPickerOpen) {
        setLocationPickerError('');
        setLocationPickerOpen(false);
      } else if (attachmentDeleteTarget) {
        setAttachmentDeleteTarget(null);
      } else if (deleteOpen) {
        setDeleteOpen(false);
      } else if (editOpen) {
        setSelectedFiles((items) => {
          items.forEach((item) => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          });
          return [];
        });
        setActionError('');
        setEditOpen(false);
      }
    };

    document.addEventListener('keydown', handleOverlayKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleOverlayKeyDown);
    };
  }, [
    actionLoading,
    attachmentDeleteTarget,
    deleteOpen,
    editOpen,
    locationPickerOpen,
    previewAttachment,
  ]);

  const formatDate = (value) => {
    if (!value) return 'Chưa có';

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return 'Chưa có';

    return parsedDate.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isVideoFile = (fileUrl = '') => {
    const url = String(fileUrl).toLowerCase();
    return [
      '.mp4',
      '.webm',
      '.ogg',
      '.mov',
      '.m4v',
    ].some((extension) => url.includes(extension));
  };

  const isImageFile = (fileUrl = '') => {
    const url = String(fileUrl).toLowerCase();
    return [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.bmp',
      '.svg',
      '.avif',
    ].some((extension) => url.includes(extension));
  };

  const statusDescription = (status) => {
    switch (status) {
      case managementTypes.feedbackStatus.SUBMITTED:
        return 'Phản ánh đã được gửi và đang chờ tiếp nhận.';
      case managementTypes.feedbackStatus.AI_REVIEWED:
        return 'Hệ thống đã tiếp nhận và đang phân loại phản ánh.';
      case managementTypes.feedbackStatus.VERIFIED:
        return 'Thông tin phản ánh đã được xác minh.';
      case managementTypes.feedbackStatus.ASSIGNED:
        return 'Phản ánh đã được chuyển đến đơn vị phụ trách.';
      case managementTypes.feedbackStatus.IN_PROGRESS:
        return 'Đơn vị phụ trách đang tiến hành xử lý.';
      case managementTypes.feedbackStatus.RESOLVED:
      case managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL:
        return 'Kết quả xử lý đang được kiểm tra và phê duyệt.';
      case managementTypes.feedbackStatus.APPROVED:
        return 'Kết quả đã được phê duyệt. Bạn có thể xem và đánh giá.';
      case managementTypes.feedbackStatus.NEED_REWORK:
        return 'Đơn vị phụ trách cần xử lý hoặc bổ sung kết quả.';
      case managementTypes.feedbackStatus.CLOSED:
        return 'Phản ánh đã hoàn tất và được đóng.';
      case managementTypes.feedbackStatus.REJECTED:
        return 'Phản ánh chưa đủ điều kiện để tiếp nhận xử lý.';
      case managementTypes.feedbackStatus.CANCELLED:
        return 'Phản ánh đã được hủy.';
      default:
        return 'Tiến trình xử lý đang được cập nhật.';
    }
  };

  const getCategoryLabel = (categoryName) => (
    CATEGORY_LABELS[categoryName] || categoryName || 'Chưa phân loại'
  );

  const normalizedRole = String(user?.role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  const isServiceUser = normalizedRole.includes('serviceuser') ||
    normalizedRole.includes('citizen');
  const parentTicketId = relatedParentFeedbackId;
  const isConfirmedDuplicate = Boolean(parentTicketId);

  const canEditTicket = !isConfirmedDuplicate && isServiceUser && [
    managementTypes.feedbackStatus.SUBMITTED,
    managementTypes.feedbackStatus.AI_REVIEWED,
  ].includes(ticket?.status);

  const canDeleteTicket = !isConfirmedDuplicate && isServiceUser &&
    ticket?.status === managementTypes.feedbackStatus.SUBMITTED;

  const canViewResolution = [
    managementTypes.feedbackStatus.RESOLVED,
    managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
    managementTypes.feedbackStatus.APPROVED,
    managementTypes.feedbackStatus.CLOSED,
  ].includes(ticket?.status);

  const resolveAttachmentId = (file) => {
    if (!file || typeof file === 'string') return null;
    return file.attachmentId ||
      file.id ||
      file.fileId ||
      file.feedbackAttachmentId ||
      null;
  };

  const resolveAttachmentName = (file, index) => {
    if (!file) return `Tệp ${index + 1}`;
    if (typeof file === 'string') {
      return file.split('/').pop() || `Tệp ${index + 1}`;
    }

    return file.fileName ||
      file.name ||
      file.originalFileName ||
      file.file?.name ||
      `Tệp ${index + 1}`;
  };

  const resolvePreviewUrl = (file) => (
    file?.previewUrl || getAttachmentUrl(file)
  );

  const isVideoAttachment = (file) => {
    const mimeType = (
      file?.type ||
      file?.mimeType ||
      file?.fileType ||
      file?.file?.type ||
      ''
    );
    return mimeType.startsWith('video/') || isVideoFile(resolvePreviewUrl(file));
  };

  const isImageAttachment = (file) => {
    const mimeType = (
      file?.type ||
      file?.mimeType ||
      file?.fileType ||
      file?.file?.type ||
      ''
    );
    return mimeType.startsWith('image/') || isImageFile(resolvePreviewUrl(file));
  };

  const isMediaAttachment = (file) => (
    isImageAttachment(file) || isVideoAttachment(file)
  );

  const releaseSelectedFileItems = (items) => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  };

  const clearSelectedFiles = () => {
    setSelectedFiles((items) => {
      releaseSelectedFileItems(items);
      return [];
    });
  };

  const removeSelectedFile = (itemId) => {
    setSelectedFiles((items) => {
      const target = items.find((item) => item.id === itemId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return items.filter((item) => item.id !== itemId);
    });
  };

  const handleSelectEditFiles = (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = '';

    if (files.length === 0) return;

    setActionError('');

    const availableSlots = Math.max(
      0,
      MAX_EDIT_ATTACHMENT_COUNT - editAttachments.length - selectedFiles.length
    );

    if (availableSlots === 0) {
      setActionError(`Chỉ được giữ tối đa ${MAX_EDIT_ATTACHMENT_COUNT} tệp minh chứng.`);
      return;
    }

    const acceptedFiles = [];
    const rejectedMessages = [];

    files.slice(0, availableSlots).forEach((file) => {
      const imageFile = file.type.startsWith('image/');
      const videoFile = file.type.startsWith('video/');

      if (!imageFile && !videoFile) {
        rejectedMessages.push(`${file.name}: chỉ hỗ trợ hình ảnh hoặc video.`);
        return;
      }

      const sizeLimit = videoFile
        ? MAX_EDIT_VIDEO_SIZE_BYTES
        : MAX_EDIT_IMAGE_SIZE_BYTES;

      if (file.size > sizeLimit) {
        rejectedMessages.push(
          `${file.name}: vượt quá giới hạn ${formatFileSize(sizeLimit)}.`
        );
        return;
      }

      acceptedFiles.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID?.() || Date.now()}`,
        file,
        name: file.name,
        type: file.type,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (files.length > availableSlots) {
      rejectedMessages.push(
        `Chỉ còn có thể thêm ${availableSlots} tệp minh chứng.`
      );
    }

    if (acceptedFiles.length > 0) {
      setSelectedFiles((items) => [...items, ...acceptedFiles]);
    }

    if (rejectedMessages.length > 0) {
      setActionError(rejectedMessages[0]);
    }
  };

  const openLocationEditor = () => {
    setLocationPickerError('');
    setLocationDraft({
      areaId: editForm.areaId || ticket?.areaId || '',
      locationText: editForm.locationText || ticket?.locationText || '',
      latitude: editForm.latitude ?? ticket?.latitude ?? null,
      longitude: editForm.longitude ?? ticket?.longitude ?? null,
    });
    setLocationPickerOpen(true);
  };

  const handleLocationDraftSelect = (latitude, longitude, address) => {
    setLocationDraft((draft) => ({
      ...draft,
      latitude,
      longitude,
      locationText: address || `Vị trí đã chọn: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    }));
    setLocationPickerError('');
  };

  const confirmLocationChange = () => {
    if (!locationDraft.areaId) {
      setLocationPickerError('Vui lòng chọn khu vực xảy ra vấn đề.');
      return;
    }

    if (locationDraft.latitude == null || locationDraft.longitude == null) {
      setLocationPickerError('Vui lòng chọn một điểm cụ thể trên bản đồ.');
      return;
    }

    setEditForm((form) => ({
      ...form,
      areaId: locationDraft.areaId,
      locationText: locationDraft.locationText,
      latitude: locationDraft.latitude,
      longitude: locationDraft.longitude,
    }));
    setLocationPickerOpen(false);
    setLocationPickerError('');
  };

  const openEditDialog = async () => {
    setActionError('');
    clearSelectedFiles();
    setEditForm({
      areaId: ticket?.areaId || '',
      categoryId: ticket?.categoryId || '',
      title: ticket?.title || '',
      description: ticket?.description || '',
      locationText: ticket?.locationText || '',
      latitude: ticket?.latitude ?? null,
      longitude: ticket?.longitude ?? null,
      priority: ticket?.priority || '',
    });
    setEditAttachments(attachments);
    setLocationPickerOpen(false);
    setEditOpen(true);

    window.requestAnimationFrame(() => {
      editInitialSnapshotRef.current = JSON.stringify({
        areaId: String(ticket?.areaId || ''),
        categoryId: String(ticket?.categoryId || ''),
        title: ticket?.title || '',
        description: ticket?.description || '',
        locationText: ticket?.locationText || '',
        latitude: ticket?.latitude ?? null,
        longitude: ticket?.longitude ?? null,
        priority: ticket?.priority || '',
        selectedFiles: [],
        attachmentIds: attachments.map((file) => resolveAttachmentId(file)),
      });
    });

    const requests = [];
    if (categories.length === 0) requests.push(['categories', toolsApi.getCategories()]);
    if (areas.length === 0) requests.push(['areas', toolsApi.getAreas()]);

    if (requests.length > 0) {
      const results = await Promise.allSettled(requests.map(([, request]) => request));
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const [type] = requests[index];
        const values = Array.isArray(result.value) ? result.value : [];
        if (type === 'categories') setCategories(values);
        if (type === 'areas') setAreas(values);
      });
    }
  };

  const handleUpdateTicket = async (event) => {
    event.preventDefault();

    if (!editForm.title.trim() || !editForm.description.trim()) {
      setActionError('Vui lòng nhập đầy đủ tiêu đề và mô tả phản ánh.');
      return;
    }

    const mediaAttachmentCount = (
      editAttachments.filter(isMediaAttachment).length +
      selectedFiles.filter(isMediaAttachment).length
    );

    if (mediaAttachmentCount === 0) {
      setActionError('Phản ánh phải có ít nhất một hình ảnh hoặc video minh chứng.');
      return;
    }

    setActionLoading(true);
    setActionError('');
    setUpdateNotice('');

    try {
      const addedFileCount = selectedFiles.length;
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        locationText: editForm.locationText.trim(),
      };

      if (editForm.areaId !== '') payload.areaId = Number(editForm.areaId);
      if (editForm.categoryId !== '') payload.categoryId = Number(editForm.categoryId);
      if (editForm.priority) payload.priority = editForm.priority;
      if (editForm.latitude !== null && editForm.latitude !== '') {
        payload.latitude = Number(editForm.latitude);
      }
      if (editForm.longitude !== null && editForm.longitude !== '') {
        payload.longitude = Number(editForm.longitude);
      }

      await ticketApi.updateTicket(feedbackId, payload, { role: 'service-user' });

      let attachmentUploadError = null;

      if (addedFileCount > 0) {
        try {
          await ticketApi.addAttachments(
            feedbackId,
            selectedFiles.map((item) => item.file),
            { role: 'service-user' }
          );
        } catch (uploadError) {
          console.error(
            'Thông tin đã cập nhật nhưng không thể tải thêm tệp minh chứng',
            uploadError
          );
          attachmentUploadError = uploadError;
        }
      }

      let refreshedTicket = null;

      try {
        const refreshedResponse = await ticketApi.getTicketById(feedbackId, {
          role: 'service-user',
        });

        refreshedTicket = (
          refreshedResponse?.data ||
          refreshedResponse?.ticket ||
          refreshedResponse
        );
      } catch (refreshError) {
        console.warn(
          'Cập nhật thành công nhưng chưa thể tải lại chi tiết phản ánh',
          refreshError
        );
      }

      if (refreshedTicket && typeof refreshedTicket === 'object') {
        setTicket(refreshedTicket);
        writeTicketDetailSnapshot(
          feedbackId,
          snapshotUserId,
          refreshedTicket
        );
        setEditAttachments(
          Array.isArray(refreshedTicket.attachments)
            ? refreshedTicket.attachments
            : []
        );
      } else {
        const nextTicket = ticket
          ? { ...ticket, ...payload }
          : null;

        if (nextTicket) {
          setTicket(nextTicket);
          writeTicketDetailSnapshot(
            feedbackId,
            snapshotUserId,
            nextTicket
          );
        }
      }

      clearSelectedFiles();
      setEditOpen(false);
      setUpdateNotice(
        attachmentUploadError
          ? 'Thông tin đã được cập nhật, nhưng chưa thể tải thêm tệp minh chứng. Vui lòng mở Chỉnh sửa và thử lại.'
          : addedFileCount > 0
            ? `Đã cập nhật phản ánh và thêm ${addedFileCount} tệp minh chứng.`
            : 'Đã cập nhật phản ánh.'
      );
    } catch (updateError) {
      console.error('Không thể cập nhật phản ánh', updateError);
      setActionError(
        updateError?.response?.data?.message ||
        updateError?.message ||
        'Không thể cập nhật phản ánh.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTicket = async () => {
    setActionLoading(true);
    setActionError('');

    try {
      await ticketApi.deleteTicket(feedbackId, { role: 'service-user' });
      removeTicketDetailSnapshot(feedbackId, snapshotUserId);
      setTicket(null);
      handleBackToList({ replace: true, highlight: false });
    } catch (deleteError) {
      console.error('Không thể xóa phản ánh', deleteError);
      setActionError(
        deleteError?.response?.data?.message ||
        deleteError?.message ||
        'Không thể xóa phản ánh.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAttachment = async () => {
    if (!attachmentDeleteTarget) return;

    const attachmentId = resolveAttachmentId(attachmentDeleteTarget);
    if (!attachmentId) {
      setActionError('Không xác định được tệp đính kèm cần xóa.');
      setAttachmentDeleteTarget(null);
      return;
    }

    const remainingAttachments = editAttachments.filter(
      (item) => resolveAttachmentId(item) !== attachmentId
    );
    const remainingMediaCount = (
      remainingAttachments.filter(isMediaAttachment).length +
      selectedFiles.filter(isMediaAttachment).length
    );

    if (remainingMediaCount === 0) {
      setActionError('Phản ánh phải giữ lại ít nhất một hình ảnh hoặc video minh chứng.');
      setAttachmentDeleteTarget(null);
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await ticketApi.deleteAttachment(feedbackId, attachmentId, {
        role: 'service-user',
      });
      const nextAttachments = remainingAttachments;
      setEditAttachments(nextAttachments);

      if (ticket) {
        const nextTicket = {
          ...ticket,
          attachments: nextAttachments,
        };
        setTicket(nextTicket);
        writeTicketDetailSnapshot(
          feedbackId,
          snapshotUserId,
          nextTicket
        );
      }

      try {
        const baseline = JSON.parse(editInitialSnapshotRef.current || '{}');
        editInitialSnapshotRef.current = JSON.stringify({
          ...baseline,
          attachmentIds: nextAttachments.map((item) => resolveAttachmentId(item)),
        });
      } catch {
        // Keep the current snapshot if it cannot be parsed.
      }

      setAttachmentDeleteTarget(null);
    } catch (deleteAttachmentError) {
      console.error('Không thể xóa tệp đính kèm', deleteAttachmentError);
      setActionError(
        deleteAttachmentError?.response?.data?.message ||
        deleteAttachmentError?.message ||
        'Không thể xóa tệp đính kèm.'
      );
    } finally {
      setActionLoading(false);
    }
  };


  const citizenJourneySteps = [
    {
      title: 'Đã tiếp nhận',
      description: 'Hồ sơ đã được ghi nhận',
      statuses: [
        managementTypes.feedbackStatus.SUBMITTED,
        managementTypes.feedbackStatus.AI_REVIEWED,
        managementTypes.feedbackStatus.VERIFIED,
      ],
      icon: Lucide.Inbox,
    },
    {
      title: 'Đang xử lý',
      description: 'Đơn vị phụ trách thực hiện',
      statuses: [
        managementTypes.feedbackStatus.ASSIGNED,
        managementTypes.feedbackStatus.IN_PROGRESS,
        managementTypes.feedbackStatus.NEED_REWORK,
      ],
      icon: Lucide.Wrench,
    },
    {
      title: 'Kiểm tra kết quả',
      description: 'Kết quả đang được rà soát',
      statuses: [
        managementTypes.feedbackStatus.RESOLVED,
        managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
      ],
      icon: Lucide.ClipboardCheck,
    },
    {
      title: 'Hoàn tất',
      description: 'Chờ đánh giá hoặc đã đóng',
      statuses: [
        managementTypes.feedbackStatus.APPROVED,
        managementTypes.feedbackStatus.CLOSED,
      ],
      icon: Lucide.CircleCheckBig,
    },
  ];

  const citizenJourneyIndex = Math.max(
    0,
    citizenJourneySteps.findIndex((step) => step.statuses.includes(ticket?.status))
  );

  const openPreview = (source, index) => {
    setPreviewSource(source);
    setPreviewAttachmentIndex(index);
  };

  const movePreview = (direction) => {
    if (previewItems.length <= 1) return;

    setPreviewAttachmentIndex((currentIndex) => {
      const safeIndex = Number.isInteger(currentIndex) ? currentIndex : 0;
      return (safeIndex + direction + previewItems.length) % previewItems.length;
    });
  };

  const fetchedFeedbackId = (
    fetchedTicket?.feedbackId ??
    fetchedTicket?.ticketId ??
    fetchedTicket?.id
  );
  const hookHasCurrentResult = (
    (fetchedFeedbackId && String(fetchedFeedbackId) === String(feedbackId)) ||
    (errorFeedbackId && String(errorFeedbackId) === String(feedbackId))
  );
  const detailSyncing = loading || !hookHasCurrentResult;
  const activeErrorStatus = (
    errorFeedbackId && String(errorFeedbackId) === String(feedbackId)
  )
    ? errorStatus
    : null;
  const loadErrorState = (() => {
    switch (activeErrorStatus) {
      case 401:
        return {
          title: 'Phiên đăng nhập đã hết hạn',
          description: 'Vui lòng đăng nhập lại để tiếp tục xem phản ánh của bạn.',
          icon: Lucide.LogIn,
        };
      case 403:
        return {
          title: 'Bạn không có quyền xem phản ánh này',
          description: 'Chỉ tài khoản đã tạo phản ánh mới có thể truy cập trang chi tiết này.',
          icon: Lucide.ShieldAlert,
        };
      case 404:
        return {
          title: 'Không tìm thấy phản ánh',
          description: 'Phản ánh có thể đã bị xóa hoặc đường dẫn không còn hợp lệ.',
          icon: Lucide.FileQuestion,
        };
      default:
        return {
          title: 'Không thể tải chi tiết phản ánh',
          description: error || 'Vui lòng thử lại hoặc quay về danh sách phản ánh.',
          icon: Lucide.FileWarning,
        };
    }
  })();

  if (detailSyncing && !ticket) {
    return <TicketDetailSkeleton />;
  }

  if (!ticket) {
    const LoadErrorIcon = loadErrorState.icon;

    return (
      <TicketDetailShell>
        <main className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] px-6 py-16 text-center shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
          <LoadErrorIcon
            size={34}
            className="mx-auto text-base-content/35"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-lg font-bold text-base-content">
            {loadErrorState.title}
          </h1>
          <p className="mt-2 text-sm text-base-content/55">
            {loadErrorState.description}
          </p>
          <button
            type="button"
            onClick={() => handleBackToList()}
            className="btn admin-primary-action mt-5 rounded-2xl"
          >
            {returnContext.returnLabel}
          </button>
        </main>
      </TicketDetailShell>
    );
  }

  const createdAt = ticket.createdAt || ticket.submittedAt;
  const authorName = (
    ticket?.userName ||
    ticket?.reporterName ||
    ticket?.createdByName ||
    user?.fullName ||
    user?.name ||
    'Bạn'
  );
  const isPotentialDuplicate = Boolean(
    ticket?.duplicateWarning && !isConfirmedDuplicate
  );
  const primaryEvidenceIndex = attachments.findIndex((attachment) => (
    getAttachmentUrl(attachment) && !isVideoAttachment(attachment)
  ));
  const resolvedPrimaryEvidenceIndex = primaryEvidenceIndex >= 0
    ? primaryEvidenceIndex
    : (attachments.length > 0 ? 0 : -1);
  const primaryEvidence = resolvedPrimaryEvidenceIndex >= 0
    ? attachments[resolvedPrimaryEvidenceIndex]
    : null;
  const primaryEvidenceUrl = primaryEvidence ? getAttachmentUrl(primaryEvidence) : '';
  const primaryEvidenceIsVideo = primaryEvidence ? isVideoAttachment(primaryEvidence) : false;

  return (
    <>
      {detailSyncing && ticket ? (
        <div
          className="fixed right-5 top-24 z-40 inline-flex items-center gap-2 rounded-full border border-info/20 bg-base-100/95 px-3 py-2 text-xs font-semibold text-info shadow-lg backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <span className="loading loading-spinner loading-xs" />
          Đang đồng bộ chi tiết
        </div>
      ) : null}

      {updateNotice && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed right-4 top-4 z-[100000] flex max-w-sm items-start gap-3 rounded-2xl border border-success/25 bg-base-100 px-4 py-3 text-base-content shadow-2xl sm:right-6 sm:top-6"
              role="status"
              aria-live="polite"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success"
                aria-hidden="true"
              >
                <Lucide.CircleCheck size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Cập nhật thành công</p>
                <p className="mt-0.5 text-xs leading-5 text-base-content/55">
                  {updateNotice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpdateNotice('')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base-content/55 transition hover:bg-base-200 hover:text-base-content"
                aria-label="Đóng thông báo"
              >
                <Lucide.X size={16} aria-hidden="true" />
              </button>
            </div>,
            document.body
          )
        : null}

      <TicketDetailShell>
        <main className="text-slate-950 dark:text-white">
          <div className="mx-auto max-w-[1320px] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DetailBackButton
                label={returnContext.returnLabel}
                onClick={() => handleBackToList()}
              />
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <Lucide.Hash size={13} aria-hidden="true" />
                {String(ticket?.feedbackId || feedbackId || '').slice(0, 8) || '—'}
              </span>
            </div>

            <article className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_82%_0%,rgba(37,99,235,0.11),transparent_42%)] dark:opacity-40" aria-hidden="true" />

              <div className="relative p-5 sm:p-7 lg:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 max-w-4xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                        <Lucide.Tag size={13} aria-hidden="true" />
                        {getCategoryLabel(ticket.categoryName)}
                      </span>
                      <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${getStatusTone(ticket.status)}`}>
                        {renderCitizenStatusIcon(ticket.status)}
                        {isConfirmedDuplicate ? 'Phản ánh trùng' : getCitizenStatusLabel(ticket.status)}
                      </span>
                    </div>

                    <h1 className="mt-4 text-[2rem] font-bold leading-[1.12] tracking-[-0.025em] sm:text-[2.35rem]">
                      {ticket.title || 'Phản ánh đô thị'}
                    </h1>
                    <p className="mt-3 max-w-3xl whitespace-pre-wrap text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                      {ticket.description || 'Bạn chưa cung cấp mô tả chi tiết cho phản ánh này.'}
                    </p>
                  </div>

                  <div className="w-full shrink-0 xl:w-[300px]">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/25">
                      <div className="flex items-start gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${getStatusTone(ticket.status)}`}>
                          {renderCitizenStatusIcon(ticket.status)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Tình trạng hiện tại</p>
                          <p className="mt-1 text-base font-bold">{isConfirmedDuplicate ? 'Phản ánh trùng' : getCitizenStatusLabel(ticket.status)}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {isConfirmedDuplicate ? 'Đang được theo dõi chung với sự vụ liên quan.' : statusDescription(ticket.status)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-500">Tiến trình</span>
                          <span className="font-semibold text-blue-600">{citizenJourneySteps[citizenJourneyIndex]?.title}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
                          {citizenJourneySteps.map((step, index) => (
                            <span key={step.title} className={`h-1.5 rounded-full ${index <= citizenJourneyIndex ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-300">
                      <Lucide.MapPin size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vị trí</p>
                      <p className="mt-0.5 line-clamp-1 text-sm font-medium text-slate-700 dark:text-slate-200">{resolvedLocationText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-blue-600 dark:bg-slate-900 dark:text-blue-300">
                      <Lucide.CalendarDays size={16} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Đã gửi</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(createdAt)}</p>
                    </div>
                  </div>

                  {(canViewResolution && isServiceUser) || canEditTicket || (isServiceUser && [managementTypes.feedbackStatus.NEED_REWORK, managementTypes.feedbackStatus.REJECTED].includes(ticket.status)) ? (
                    <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1 xl:justify-end">
                      {canViewResolution && isServiceUser ? (
                        <button type="button" onClick={() => navigate(`/tickets/${feedbackId}/result`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)] transition hover:bg-blue-700">
                          <Lucide.ClipboardCheck size={16} aria-hidden="true" />
                          {ticket?.status === managementTypes.feedbackStatus.APPROVED ? 'Xem kết quả & đánh giá' : 'Xem kết quả xử lý'}
                        </button>
                      ) : null}
                      {isServiceUser && [managementTypes.feedbackStatus.NEED_REWORK, managementTypes.feedbackStatus.REJECTED].includes(ticket.status) ? (
                        <button type="button" onClick={() => navigate(`/tickets/${feedbackId}/rework`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                          <Lucide.RefreshCw size={16} aria-hidden="true" />
                          Bổ sung thông tin
                        </button>
                      ) : null}
                      {canEditTicket ? (
                        <button type="button" onClick={openEditDialog} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <Lucide.Pencil size={15} aria-hidden="true" />
                          Chỉnh sửa
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>

            {isConfirmedDuplicate || isPotentialDuplicate ? (
              <section className={`rounded-[22px] border px-4 py-3.5 ${isConfirmedDuplicate ? 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isConfirmedDuplicate ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
                    {isConfirmedDuplicate ? <Lucide.GitMerge size={17} /> : <Lucide.ScanSearch size={17} />}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">{isConfirmedDuplicate ? 'Phản ánh đã được gộp' : 'Đang kiểm tra phản ánh trùng'}</h2>
                    <p className="mt-1 text-sm leading-6 opacity-75">{isConfirmedDuplicate ? 'Nội dung này đang được theo dõi chung với sự vụ đã có trước đó.' : 'Hệ thống đang kiểm tra xem phản ánh này có trùng với sự việc đã được ghi nhận hay không.'}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {ticket?.incidentId ? (
              <section className="flex flex-col gap-3 rounded-[22px] border border-blue-200 bg-blue-50/75 px-4 py-4 shadow-[0_10px_24px_rgba(37,99,235,0.05)] dark:border-blue-900/60 dark:bg-blue-950/25 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600 shadow-sm dark:border-blue-900/50 dark:bg-slate-900"><Lucide.Link2 size={18} /></span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold">Sự vụ cộng đồng liên quan</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Phản ánh này đang được xử lý chung trong một sự vụ. Thảo luận công khai được tập trung ở trang sự vụ.</p>
                  </div>
                </div>
                <button type="button" onClick={() => navigate(`/community/feed/${ticket.incidentId}`, { state: { from: location.pathname, returnLabel: 'Quay lại phản ánh của tôi' } })} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">Xem sự vụ <Lucide.ArrowUpRight size={14} /></button>
              </section>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
              <div className="min-w-0 space-y-5">
                <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">Minh chứng đã gửi</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ảnh và video đính kèm trong phản ánh ban đầu.</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900">{attachments.length} tệp</span>
                  </div>

                  {attachments.length > 0 ? (
                    <>
                      <button type="button" onClick={() => openPreview('detail', resolvedPrimaryEvidenceIndex)} className="group relative mt-4 block aspect-[16/9] max-h-[380px] min-h-[240px] w-full overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950 text-left dark:border-slate-800">
                        {primaryEvidenceIsVideo ? (
                          <video src={primaryEvidenceUrl} className="h-full w-full object-contain" muted playsInline preload="metadata" />
                        ) : (
                          <img src={primaryEvidenceUrl} alt="Ảnh minh chứng chính" className="h-full w-full object-contain" />
                        )}
                        <span className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950/65 px-3 text-sm font-semibold text-white backdrop-blur">
                          <Lucide.Maximize2 size={15} aria-hidden="true" />
                          Xem lớn
                        </span>
                      </button>
                      {attachments.length > 1 ? (
                        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                          {attachments.map((attachment, index) => {
                            const url = getAttachmentUrl(attachment);
                            const video = isVideoAttachment(attachment);
                            return (
                              <button key={resolveAttachmentId(attachment) || url || index} type="button" onClick={() => openPreview('detail', index)} className={`group relative aspect-[4/3] overflow-hidden rounded-xl border ${index === resolvedPrimaryEvidenceIndex ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 dark:border-slate-800'} bg-slate-100 dark:bg-slate-900`}>
                                {url ? (video ? <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={url} alt={`Minh chứng ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />) : <Lucide.ImageOff size={20} className="absolute inset-0 m-auto text-slate-400" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-9 text-center dark:border-slate-800 dark:bg-slate-900/50">
                      <Lucide.ImageOff size={24} className="mx-auto text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-500">Không có minh chứng đính kèm</p>
                    </div>
                  )}
                </section>

                <FeedbackLocationMapCard
                  feedbackId={feedbackId}
                  latitude={ticket?.latitude}
                  longitude={ticket?.longitude}
                  locationText={resolvedLocationText}
                  areaName={ticket?.areaName || ticket?.wardName || ticket?.districtName}
                />

              </div>

              <aside className="space-y-4 xl:sticky xl:top-24">
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="mt-2 text-base font-bold">Theo dõi tiến trình</h2>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">{citizenJourneyIndex + 1}/{citizenJourneySteps.length}</span>
                  </div>
                  <ol className="mt-5">
                    {citizenJourneySteps.map((step, index) => {
                      const StepIcon = step.icon;
                      const terminalClosed = ticket?.status === managementTypes.feedbackStatus.CLOSED;
                      const completed = index < citizenJourneyIndex || (terminalClosed && index === citizenJourneyIndex);
                      const active = index === citizenJourneyIndex && !completed;
                      return (
                        <li key={step.title} className="relative grid grid-cols-[34px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                          {index !== citizenJourneySteps.length - 1 ? <span className={`absolute bottom-0 left-[16px] top-8 w-px ${index < citizenJourneyIndex ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`} aria-hidden="true" /> : null}
                          <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border ${completed ? 'border-blue-600 bg-blue-600 text-white' : active ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/40' : 'border-slate-200 bg-white text-slate-300 dark:border-slate-800 dark:bg-slate-950'}`}>{completed ? <Lucide.Check size={14} /> : <StepIcon size={14} />}</span>
                          <div><p className={`text-sm font-semibold ${active || completed ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{step.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-400">{step.description}</p></div>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <Lucide.FileText size={16} className="text-blue-600" aria-hidden="true" />
                    <h2 className="text-sm font-bold">Thông tin phản ánh</h2>
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Khu vực</dt><dd className="text-right font-medium">{ticket?.areaName || ticket?.wardName || 'Chưa xác định'}</dd></div>
                    <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Kênh gửi</dt><dd className="font-medium">{ticket?.submissionChannel || 'Web'}</dd></div>
                    <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Người gửi</dt><dd className="text-right font-medium">{authorName}</dd></div>
                  </dl>
                  {canDeleteTicket ? <button type="button" onClick={() => { setActionError(''); setDeleteOpen(true); }} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"><Lucide.Trash2 size={14} /> Xóa phản ánh</button> : null}
                </section>
              </aside>
            </section>

          </div>
        </main>
      </TicketDetailShell>
      {editOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[99980] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/70 p-0 backdrop-blur-sm lg:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-ticket-title"
          >
            <section className="flex h-full w-full flex-col overflow-hidden bg-base-100 text-base-content shadow-2xl lg:h-[min(92dvh,860px)] lg:max-w-6xl lg:rounded-[28px] lg:border lg:border-base-300">
              <header className="flex shrink-0 items-center justify-between gap-4 border-b border-base-300 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <h2 id="edit-ticket-title" className="text-lg font-bold sm:text-xl">
                    Chỉnh sửa phản ánh
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-base-content/60 sm:text-sm">
                    Cập nhật thông tin và minh chứng trước khi phản ánh được xác minh.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestCloseEdit}
                  disabled={actionLoading}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-base-300 text-base-content/55 transition hover:bg-base-200 hover:text-base-content disabled:opacity-50"
                  aria-label="Đóng trình chỉnh sửa"
                >
                  <Lucide.X size={19} aria-hidden="true" />
                </button>
              </header>

              <form
                onSubmit={handleUpdateTicket}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:overflow-hidden">
                  {actionError ? (
                    <p className="mb-4 rounded-2xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">
                      {actionError}
                    </p>
                  ) : null}

                  <div className="grid min-h-full gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
                    <section className="grid content-start gap-3 rounded-[22px] border border-base-300 bg-base-100 p-4">
                      <label className="form-control">
                        <span className="mb-1.5 text-sm font-semibold">Tiêu đề</span>
                        <input
                          value={editForm.title}
                          onChange={(event) => setEditForm((form) => ({ ...form, title: event.target.value }))}
                          className="input input-bordered h-11 w-full rounded-xl bg-base-100"
                          required
                        />
                      </label>

                      <label className="form-control">
                        <span className="mb-1.5 text-sm font-semibold">Mô tả</span>
                        <textarea
                          rows="4"
                          value={editForm.description}
                          onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))}
                          className="textarea textarea-bordered min-h-32 w-full resize-none rounded-xl bg-base-100"
                          required
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="form-control">
                          <span className="mb-1.5 text-sm font-semibold">Danh mục</span>
                          <select
                            value={editForm.categoryId}
                            onChange={(event) => setEditForm((form) => ({ ...form, categoryId: event.target.value }))}
                            className="select select-bordered h-11 w-full rounded-xl bg-base-100"
                          >
                            <option value="">Chưa phân loại</option>
                            {categories.map((category) => (
                              <option key={category.categoryId} value={category.categoryId}>
                                {getCategoryLabel(category.categoryName)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="form-control">
                          <span className="mb-1.5 text-sm font-semibold">Mức độ ảnh hưởng</span>
                          <select
                            value={editForm.priority}
                            onChange={(event) => setEditForm((form) => ({ ...form, priority: event.target.value }))}
                            className="select select-bordered h-11 w-full rounded-xl bg-base-100"
                          >
                            <option value="Low">Thấp</option>
                            <option value="Medium">Trung bình</option>
                            <option value="High">Cao</option>
                            <option value="Urgent">Khẩn cấp</option>
                          </select>
                        </label>
                      </div>

                      <section className="rounded-2xl border border-base-300 bg-base-200/30 p-3.5" aria-labelledby="edit-location-title">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 id="edit-location-title" className="text-sm font-semibold">Vị trí phản ánh</h3>
                            <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-base-content/55">
                              <Lucide.MapPin size={13} className="shrink-0 text-primary" aria-hidden="true" />
                              <span className="truncate">
                                {areas.find((area) => String(getAreaId(area)) === String(editForm.areaId))
                                  ? getAreaName(areas.find((area) => String(getAreaId(area)) === String(editForm.areaId)))
                                  : ticket?.areaName || 'Chưa xác định khu vực'}
                              </span>
                            </p>
                            <p className="mt-1.5 text-xs leading-5 text-base-content/55">
                              {editForm.latitude != null && editForm.longitude != null
                                ? 'Điểm đã được đánh dấu trên bản đồ.'
                                : 'Chưa có điểm cụ thể trên bản đồ.'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={openLocationEditor}
                            className="btn admin-secondary-action btn-sm shrink-0 rounded-xl"
                          >
                            <Lucide.MapPinned size={14} aria-hidden="true" />
                            Thay đổi vị trí
                          </button>
                        </div>
                      </section>
                    </section>

                    <section className="flex min-h-0 flex-col rounded-[22px] border border-base-300 bg-base-200/25 p-4">
                      <header className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Tệp minh chứng</h3>
                          <p className="mt-1 text-xs leading-5 text-base-content/48">
                            Bấm vào ảnh hoặc video để xem lại trước khi lưu.
                          </p>
                        </div>
                        <span className="rounded-full border border-base-300 bg-base-100 px-2.5 py-1 text-xs font-semibold text-base-content/55">
                          {editAttachments.length + selectedFiles.length}/{MAX_EDIT_ATTACHMENT_COUNT} tệp
                        </span>
                      </header>

                      <div className="mt-3 grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {editAttachments.map((file, index) => {
                          const previewUrl = resolvePreviewUrl(file);
                          const video = isVideoAttachment(file);

                          return (
                            <article
                              key={resolveAttachmentId(file) || previewUrl || index}
                              className="overflow-hidden rounded-xl border border-base-300 bg-base-100"
                            >
                              <button
                                type="button"
                                onClick={() => openPreview('edit', index)}
                                className="group relative block h-24 w-full overflow-hidden bg-base-200/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                aria-label={`Xem ${resolveAttachmentName(file, index)}`}
                              >
                                {video ? (
                                  <video
                                    src={previewUrl}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <img
                                    src={previewUrl}
                                    alt=""
                                    className="h-full w-full object-contain"
                                  />
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100 group-focus-visible:bg-black/30 group-focus-visible:opacity-100">
                                  {video ? <Lucide.Play size={20} fill="currentColor" /> : <Lucide.Expand size={20} />}
                                </span>
                              </button>

                              <footer className="flex items-center gap-2 px-2.5 py-2">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-medium">
                                    {resolveAttachmentName(file, index)}
                                  </span>
                                  <span className="mt-0.5 block text-[10px] font-semibold text-success">
                                    Đã tải lên
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setAttachmentDeleteTarget(file)}
                                  disabled={actionLoading || editAttachments.length <= 1}
                                  title={editAttachments.length <= 1 ? 'Phản ánh phải giữ lại ít nhất một tệp đã tải lên.' : 'Xóa tệp'}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-error transition hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-35"
                                  aria-label={`Xóa ${resolveAttachmentName(file, index)}`}
                                >
                                  <Lucide.Trash2 size={14} aria-hidden="true" />
                                </button>
                              </footer>
                            </article>
                          );
                        })}

                        {selectedFiles.map((item, index) => {
                          const galleryIndex = editAttachments.length + index;
                          const video = isVideoAttachment(item);

                          return (
                            <article
                              key={item.id}
                              className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5"
                            >
                              <button
                                type="button"
                                onClick={() => openPreview('edit', galleryIndex)}
                                className="group relative block h-24 w-full overflow-hidden bg-base-200/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                aria-label={`Xem ${item.name}`}
                              >
                                {video ? (
                                  <video
                                    src={item.previewUrl}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <img
                                    src={item.previewUrl}
                                    alt=""
                                    className="h-full w-full object-contain"
                                  />
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100 group-focus-visible:bg-black/30 group-focus-visible:opacity-100">
                                  {video ? <Lucide.Play size={20} fill="currentColor" /> : <Lucide.Expand size={20} />}
                                </span>
                                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-content">
                                  Mới
                                </span>
                              </button>

                              <footer className="flex items-center gap-2 px-2.5 py-2">
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-medium">{item.name}</span>
                                  <span className="mt-0.5 block text-[10px] text-base-content/55">
                                    {formatFileSize(item.file.size)} · Chờ lưu
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeSelectedFile(item.id)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-error transition hover:bg-error/10"
                                  aria-label={`Bỏ ${item.name}`}
                                >
                                  <Lucide.X size={14} aria-hidden="true" />
                                </button>
                              </footer>
                            </article>
                          );
                        })}
                      </div>

                      {editAttachments.length + selectedFiles.length === 0 ? (
                        <div className="mt-3 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-100/70 text-center text-xs text-base-content/55">
                          Chưa có tệp minh chứng.
                        </div>
                      ) : null}

                      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3.5 transition hover:border-primary/55 hover:bg-primary/8">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleSelectEditFiles}
                          className="sr-only"
                          disabled={actionLoading || editAttachments.length + selectedFiles.length >= MAX_EDIT_ATTACHMENT_COUNT}
                        />
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary" aria-hidden="true">
                          <Lucide.ImagePlus size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-sm font-semibold text-primary">
                            Chọn ảnh hoặc video từ thiết bị
                          </strong>
                          <span className="mt-0.5 block text-xs leading-5 text-base-content/55">
                            Ảnh tối đa 5 MB · Video tối đa 10 MB · Tệp mới được tải lên khi bấm Lưu thay đổi.
                          </span>
                        </span>
                        <Lucide.ChevronRight size={16} className="shrink-0 text-primary" aria-hidden="true" />
                      </label>
                    </section>
                  </div>
                </div>

                <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-base-300 bg-base-100 px-4 py-3 sm:px-6">
                  <button
                    type="button"
                    onClick={requestCloseEdit}
                    disabled={actionLoading}
                    className="btn admin-secondary-action rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="btn admin-primary-action rounded-xl"
                  >
                    {actionLoading ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <Lucide.Save size={15} aria-hidden="true" />
                    )}
                    Lưu thay đổi
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body
        )
        : null}

      {locationPickerOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[100020] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-location-picker-title"
          >
            <section className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-base-100 shadow-2xl sm:h-[min(92dvh,860px)] sm:rounded-[28px]">
              <header className="flex shrink-0 items-center justify-between gap-4 border-b border-base-300 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <h2 id="edit-location-picker-title" className="text-lg font-bold sm:text-xl">
                    Thay đổi vị trí phản ánh
                  </h2>
                  <p className="mt-0.5 text-xs text-base-content/60 sm:text-sm">
                    Chọn khu vực và đánh dấu lại đúng điểm xảy ra vấn đề trên bản đồ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationPickerError('');
                    setLocationPickerOpen(false);
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-base-300 text-base-content/55 transition hover:bg-base-200 hover:text-base-content"
                  aria-label="Đóng trình chọn vị trí"
                >
                  <Lucide.X size={19} aria-hidden="true" />
                </button>
              </header>

              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:overflow-hidden">
                <aside className="space-y-4 rounded-[22px] border border-base-300 bg-base-200/25 p-4">
                  <label className="block">
                    <span className="text-sm font-semibold">Khu vực</span>
                    <select
                      value={locationDraft.areaId}
                      onChange={(event) => {
                        setLocationDraft((draft) => ({
                          ...draft,
                          areaId: event.target.value,
                        }));
                        setLocationPickerError('');
                      }}
                      className="select select-bordered mt-2 h-11 w-full rounded-xl bg-base-100"
                    >
                      <option value="">Chọn khu vực</option>
                      {areas.map((area) => (
                        <option key={getAreaId(area)} value={getAreaId(area)}>
                          {getAreaName(area)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <section className="rounded-2xl border border-base-300 bg-base-100 p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
                        <Lucide.MapPin size={17} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">Điểm đang chọn</h3>
                        <p className="mt-1 text-xs leading-5 text-base-content/60">
                          {locationDraft.latitude != null && locationDraft.longitude != null
                            ? 'Đã đánh dấu một điểm trên bản đồ.'
                            : 'Nhấp vào bản đồ để chọn vị trí.'}
                        </p>
                      </div>
                    </div>
                  </section>

                  <p className="text-xs leading-5 text-base-content/55">
                    Vị trí mới chỉ được áp dụng sau khi bấm <strong>Xác nhận vị trí</strong>, sau đó bấm <strong>Lưu thay đổi</strong> trong trình chỉnh sửa.
                  </p>

                  {locationPickerError ? (
                    <p className="rounded-xl border border-error/25 bg-error/10 px-3 py-2.5 text-xs font-medium text-error" role="alert">
                      {locationPickerError}
                    </p>
                  ) : null}
                </aside>

                <div className="min-h-[360px] overflow-hidden rounded-[22px] border border-base-300 bg-base-200 p-2 lg:min-h-0">
                  <LocationPicker
                    latitude={locationDraft.latitude}
                    longitude={locationDraft.longitude}
                    onSelectLocation={handleLocationDraftSelect}
                  />
                </div>
              </div>

              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-base-300 bg-base-100 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    setLocationPickerError('');
                    setLocationPickerOpen(false);
                  }}
                  className="btn admin-secondary-action rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmLocationChange}
                  className="btn admin-primary-action rounded-xl"
                >
                  <Lucide.MapPinned size={15} aria-hidden="true" />
                  Xác nhận vị trí
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )
        : null}

      {deleteOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[99990] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ticket-title"
          >
            <section className="w-full max-w-md rounded-[24px] border border-base-300 bg-base-100 p-5 text-base-content shadow-2xl sm:p-6">
              <header className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-error/10 text-error" aria-hidden="true">
                  <Lucide.Trash2 size={20} />
                </span>
                <div className="min-w-0">
                  <h2 id="delete-ticket-title" className="text-lg font-bold">
                    Xóa phản ánh?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-base-content/60">
                    Phản ánh <strong className="break-words">{ticket.title}</strong> sẽ bị xóa vĩnh viễn và không thể khôi phục.
                  </p>
                </div>
              </header>

              {actionError ? (
                <p className="mt-4 rounded-2xl border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">
                  {actionError}
                </p>
              ) : null}

              <footer className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  disabled={actionLoading}
                  autoFocus
                  className="btn admin-secondary-action rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTicket}
                  disabled={actionLoading}
                  className="btn rounded-xl border-none bg-error text-error-content hover:bg-error/90"
                >
                  {actionLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Lucide.Trash2 size={15} aria-hidden="true" />
                  )}
                  Xóa phản ánh
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )
        : null}

      {attachmentDeleteTarget && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[99995] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-attachment-title"
          >
            <section className="w-full max-w-sm rounded-[22px] border border-base-300 bg-base-100 p-5 text-base-content shadow-2xl">
              <h2 id="delete-attachment-title" className="text-lg font-bold">
                Xóa tệp minh chứng?
              </h2>
              <p className="mt-2 text-sm leading-6 text-base-content/60">
                Bạn có chắc muốn xóa <strong className="break-words">{resolveAttachmentName(attachmentDeleteTarget, 0)}</strong>?
              </p>
              <footer className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAttachmentDeleteTarget(null)}
                  disabled={actionLoading}
                  autoFocus
                  className="btn admin-secondary-action rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAttachment}
                  disabled={actionLoading}
                  className="btn rounded-xl border-none bg-error text-error-content hover:bg-error/90"
                >
                  Xóa tệp
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )
        : null}

      {previewAttachment && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[99999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-media-preview-title"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pb-16 pt-4 sm:px-6 sm:pt-5">
              <div className="min-w-0">
                <h2
                  id="detail-media-preview-title"
                  className="max-w-[72vw] truncate text-sm font-semibold text-white sm:text-base"
                >
                  {resolveAttachmentName(previewAttachment, previewAttachmentIndex)}
                </h2>
                <p className="mt-1 text-xs text-white/65">
                  {previewAttachmentIndex + 1} / {previewItems.length}
                  <span className="hidden sm:inline"> · Dùng phím ← → để chuyển tệp</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPreviewAttachmentIndex(null)}
              className="absolute right-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-6 sm:top-5"
              aria-label="Đóng xem trước"
            >
              <Lucide.X size={21} aria-hidden="true" />
            </button>

            <div
              className="flex h-full w-full items-center justify-center overflow-hidden px-3 py-3 sm:px-16 sm:py-5"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setPreviewAttachmentIndex(null);
                }
              }}
            >
              {isVideoAttachment(previewAttachment) ? (
                <video
                  key={resolvePreviewUrl(previewAttachment)}
                  src={resolvePreviewUrl(previewAttachment)}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="block max-h-[calc(100dvh-24px)] max-w-[calc(100vw-24px)] object-contain sm:max-h-[calc(100dvh-40px)] sm:max-w-[calc(100vw-128px)]"
                >
                  Trình duyệt của bạn không hỗ trợ phát video.
                </video>
              ) : (
                <img
                  key={resolvePreviewUrl(previewAttachment)}
                  src={resolvePreviewUrl(previewAttachment)}
                  alt={resolveAttachmentName(previewAttachment, previewAttachmentIndex)}
                  className="block max-h-[calc(100dvh-24px)] max-w-[calc(100vw-24px)] select-none object-contain sm:max-h-[calc(100dvh-40px)] sm:max-w-[calc(100vw-128px)]"
                  draggable="false"
                />
              )}
            </div>

            {previewItems.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => movePreview(-1)}
                  className="absolute left-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:left-6 sm:h-14 sm:w-14"
                  aria-label="Xem tệp trước"
                >
                  <Lucide.ChevronLeft size={28} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => movePreview(1)}
                  className="absolute right-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-6 sm:h-14 sm:w-14"
                  aria-label="Xem tệp tiếp theo"
                >
                  <Lucide.ChevronRight size={28} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>,
          document.body
        )
        : null}

    </>
  );
};
