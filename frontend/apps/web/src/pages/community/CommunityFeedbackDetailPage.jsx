import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { getAttachmentUrl } from '@urbanmind/shared-utils';
import { useAuth } from '../../contexts/AuthContext';
import PublicPageMotion from '../../components/public/PublicPageMotion';
import CompactPublicIncidentMap from '../../components/public/CompactPublicIncidentMap';
import SupportButton from '../../components/community/SupportButton.jsx';
import {
  getCommunityFeedDetail,
  getCommunityIncidentReports,
  getCommunityIncidentResolution,
  getCommunityIncidentComments,
  setCommunityIncidentSubscription,
  postCommunityIncidentComment,
} from '../../services/api/feedApi';
import {
  getCommunityReportCount,
  getCommunityStatusKey,
  getResidentStatusMeta,
  translateResidentCategory,
} from '../../components/community/communityPresentation.js';

const COMMUNITY_COMMENT_PAGE_SIZE = 50;

const normalizeCommentPage = (page, fallbackPage = 1) => ({
  items: Array.isArray(page?.items) ? page.items : [],
  pageNumber: Math.max(1, Number(page?.pageNumber) || fallbackPage),
  totalPages: Math.max(1, Number(page?.totalPages) || 1),
});

const mergeComments = (current = [], incoming = []) => {
  const merged = new Map();
  [...current, ...incoming].forEach((comment, index) => {
    const key = String(
      comment?.commentId
      ?? comment?.id
      ?? `${comment?.createdAt || 'unknown'}:${comment?.userName || comment?.authorName || 'anonymous'}:${index}`
    );
    merged.set(key, comment);
  });
  return [...merged.values()];
};

const STATUS_ICONS = {
  new: Lucide.Inbox,
  verified: Lucide.BadgeCheck,
  assigned: Lucide.UserRoundCheck,
  inprogress: Lucide.LoaderCircle,
  submittedforapproval: Lucide.ClipboardCheck,
  needrework: Lucide.RotateCcw,
  approved: Lucide.CircleCheckBig,
  resolved: Lucide.CircleCheckBig,
  closed: Lucide.Archive,
  merged: Lucide.GitMerge,
};

const JOURNEY_STEPS = [
  {
    key: 'received',
    label: 'Đã tiếp nhận',
    description: 'Sự vụ đã được ghi nhận',
    statuses: ['new', 'verified'],
    icon: Lucide.Inbox,
  },
  {
    key: 'processing',
    label: 'Đang xử lý',
    description: 'Đơn vị phụ trách thực hiện',
    statuses: ['assigned', 'inprogress', 'needrework'],
    icon: Lucide.Wrench,
  },
  {
    key: 'approval',
    label: 'Kiểm tra kết quả',
    description: 'Kết quả đang được rà soát',
    statuses: ['submittedforapproval'],
    icon: Lucide.ClipboardCheck,
  },
  {
    key: 'done',
    label: 'Hoàn tất',
    description: 'Sự vụ đã hoàn thành xử lý',
    statuses: ['approved', 'resolved', 'closed'],
    icon: Lucide.CircleCheckBig,
  },
];

const REPORT_STATUS_LABELS = Object.freeze({
  submitted: 'Đã gửi',
  aireviewed: 'Đã AI phân tích',
  verified: 'Đã xác minh',
  assigned: 'Đã phân công',
  inprogress: 'Đang xử lý',
  submittedforapproval: 'Chờ duyệt kết quả',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
});

const normalizeKey = (value) => String(value || '').trim().replace(/[-_\s]+/g, '').toLowerCase();
const getReportStatusLabel = (value) => REPORT_STATUS_LABELS[normalizeKey(value)] || (value ? 'Đang cập nhật' : 'Chưa cập nhật');

const getSubmissionChannelLabel = (value) => {
  const key = normalizeKey(value);
  if (!key) return 'Chưa cập nhật';
  if (key.includes('web')) return 'Cổng thông tin';
  if (key.includes('mobile') || key === 'app') return 'Ứng dụng di động';
  if (key.includes('phone') || key.includes('hotline')) return 'Điện thoại';
  if (key.includes('email')) return 'Email';
  return 'Kênh khác';
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const isVideo = (attachment) => {
  const url = String(getAttachmentUrl(attachment) || '').split('?')[0].toLowerCase();
  const mime = String(attachment?.mimeType || attachment?.contentType || '').toLowerCase();
  return mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v', '.ogg'].some((ext) => url.endsWith(ext));
};

const getReportMedia = (report) => (
  (Array.isArray(report?.attachments) ? report.attachments : [])
    .map((attachment) => ({
      attachment,
      url: getAttachmentUrl(attachment),
      video: isVideo(attachment),
    }))
    .filter((item) => Boolean(item.url))
);

const getResolutionDocumentUrl = (document) => String(
  getAttachmentUrl(document) || document?.fileUrl || document?.url || ''
).trim();

const getResolutionDocumentKind = (document) => {
  const url = getResolutionDocumentUrl(document).split('?')[0].toLowerCase();
  const fileType = String(document?.fileType || document?.mimeType || document?.contentType || '').toLowerCase();
  if (fileType.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v', '.ogg'].some((ext) => url.endsWith(ext))) return 'video';
  if (fileType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp'].some((ext) => url.endsWith(ext))) return 'image';
  return 'file';
};

const getResolutionMedia = (resolution) => (
  (Array.isArray(resolution?.completionDocuments) ? resolution.completionDocuments : [])
    .map((document) => {
      const url = getResolutionDocumentUrl(document);
      const kind = getResolutionDocumentKind(document);
      return { attachment: document, url, video: kind === 'video', kind };
    })
    .filter((item) => item.url && item.kind !== 'file')
);

const getResolutionFiles = (resolution) => (
  (Array.isArray(resolution?.completionDocuments) ? resolution.completionDocuments : [])
    .map((document) => ({ document, url: getResolutionDocumentUrl(document), kind: getResolutionDocumentKind(document) }))
    .filter((item) => item.url && item.kind === 'file')
);

const hasCoordinate = (value, min, max) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
};

const hasIncidentCoordinates = (incident) => (
  hasCoordinate(incident?.latitude ?? incident?.lat ?? incident?.location?.latitude ?? incident?.location?.lat, -90, 90) &&
  hasCoordinate(incident?.longitude ?? incident?.lng ?? incident?.lon ?? incident?.location?.longitude ?? incident?.location?.lng ?? incident?.location?.lon, -180, 180)
);

const DetailSkeleton = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Đang tải chi tiết sự vụ cộng đồng">
    <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-200/75 dark:bg-slate-800" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-200/90 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="h-4 w-56 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-4 w-28 animate-pulse rounded bg-blue-100 dark:bg-blue-950/50" />
              <div className="h-9 w-4/5 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-6 w-3/5 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
              <div className="flex gap-2 pt-2">
                <div className="h-7 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
            <div className="hidden w-44 shrink-0 space-y-2 lg:block">
              <div className="h-10 animate-pulse rounded-xl bg-blue-50 dark:bg-blue-950/30" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200/90 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
          <div className="mt-5 h-56 animate-pulse rounded-[20px] bg-slate-100 dark:bg-slate-800/70" />
        </div>
      </div>
      <div className="space-y-5">
        <div className="rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-28 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="mt-4 h-48 animate-pulse rounded-[18px] bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-36 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="mt-4 space-y-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />)}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ReportMediaGallery = ({ report, mediaItems, onOpen }) => {
  const media = Array.isArray(mediaItems) ? mediaItems : getReportMedia(report);
  if (media.length === 0) return null;

  const renderMedia = (item, index, className, showMore = false) => {
    const key = item.attachment?.attachmentId || item.url || index;
    if (item.video) {
      return (
        <video
          key={key}
          src={item.url}
          controls
          preload="metadata"
          className={`${className} bg-black object-cover`}
        />
      );
    }

    return (
      <button
        key={key}
        type="button"
        onClick={() => onOpen(media, index)}
        className={`group relative overflow-hidden bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
        aria-label={`Mở ảnh minh chứng ${index + 1}`}
      >
        <img
          src={item.url}
          alt={`Minh chứng phản ánh ${index + 1}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/68 text-white opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Lucide.Maximize2 size={14} />
        </span>
        {showMore ? (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/48 text-base font-bold text-white backdrop-blur-[1px]">
            +{media.length - 3} ảnh
          </span>
        ) : null}
      </button>
    );
  };

  if (media.length === 1) {
    return (
      <div className="mt-4 overflow-hidden rounded-[18px]">
        {renderMedia(media[0], 0, 'block aspect-[16/9] max-h-[390px] w-full')}
      </div>
    );
  }

  return (
    <div className="mt-4 grid h-[230px] grid-cols-2 gap-2.5 sm:h-[280px] sm:grid-cols-[minmax(0,1.65fr)_minmax(150px,0.75fr)]">
      {renderMedia(media[0], 0, 'h-full w-full rounded-[18px]')}
      <div className={`grid min-h-0 gap-2.5 ${media.length > 2 ? 'grid-rows-2' : 'grid-rows-1'}`}>
        {renderMedia(media[1], 1, 'h-full min-h-0 w-full rounded-[16px]')}
        {media.length > 2
          ? renderMedia(media[2], 2, 'h-full min-h-0 w-full rounded-[16px]', media.length > 3)
          : null}
      </div>
    </div>
  );
};

export const CommunityFeedbackDetailPage = () => {
  const { id: incidentIdParam } = useParams();
  const incidentId = String(incidentIdParam || '').trim();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [incident, setIncident] = useState(null);
  const [reports, setReports] = useState([]);
  const [resolution, setResolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [resolutionLoading, setResolutionLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportsError, setReportsError] = useState('');
  const [resolutionError, setResolutionError] = useState('');
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [viewer, setViewer] = useState(null);
  const [incidentComments, setIncidentComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [commentNotice, setCommentNotice] = useState('');
  const [commentLoadWarning, setCommentLoadWarning] = useState('');
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotalPages, setCommentTotalPages] = useState(1);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const run = () => {
      setLoading(true);
      setReportsLoading(true);
      setResolutionLoading(true);
      setError('');
      setReportsError('');
      setResolutionError('');

      getCommunityFeedDetail(incidentId, { signal: controller.signal })
        .then((detail) => {
          if (!active) return;
          setIncident(detail);
        })
        .catch((loadError) => {
          if (!active || controller.signal.aborted) return;
          setIncident(null);
          setError(loadError?.message || 'Không thể tải chi tiết sự vụ cộng đồng.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      getCommunityIncidentResolution(incidentId, { signal: controller.signal })
        .then((result) => {
          if (!active) return;
          setResolution(result || null);
        })
        .catch((loadError) => {
          if (!active || controller.signal.aborted) return;
          setResolution(null);
          setResolutionError(loadError?.message || 'Chưa thể tải kết quả xử lý công khai.');
        })
        .finally(() => {
          if (active) setResolutionLoading(false);
        });
      setCommentLoadWarning('');
      setCommentPage(1);
      setCommentTotalPages(1);
      getCommunityIncidentComments(incidentId, {
        pageNumber: 1,
        pageSize: COMMUNITY_COMMENT_PAGE_SIZE,
        signal: controller.signal,
      })
        .then((commentResponse) => {
          if (!active) return;
          const normalizedPage = normalizeCommentPage(commentResponse, 1);
          setIncidentComments(normalizedPage.items);
          setCommentPage(normalizedPage.pageNumber);
          setCommentTotalPages(normalizedPage.totalPages);
        })
        .catch((loadError) => {
          if (!active || controller.signal.aborted) return;
          console.error('Community incident comments failed to load', loadError);
          setIncidentComments([]);
          setCommentLoadWarning('Chưa thể tải bình luận của sự vụ.');
        });

      getCommunityIncidentReports(incidentId, { signal: controller.signal })
        .then((reportItems) => {
          if (!active) return;
          setReports(Array.isArray(reportItems) ? reportItems : []);
        })
        .catch((loadError) => {
          if (!active || controller.signal.aborted) return;
          setReports([]);
          setReportsError(loadError?.message || 'Chưa thể tải các phản ánh liên quan.');
        })
        .finally(() => {
          if (active) setReportsLoading(false);
        });

    };

    if (incidentId) run();
    else {
      setError('Định danh sự vụ không hợp lệ.');
      setLoading(false);
      setReportsLoading(false);
      setResolutionLoading(false);
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [incidentId]);

  useEffect(() => {
    if (!viewer) return undefined;

    const scrollContainer = document.querySelector('[data-dashboard-scroll-container]');
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousScrollOverflow = scrollContainer?.style.overflow || '';

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollContainer) scrollContainer.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setViewer(null);
      if (event.key === 'ArrowRight') {
        setViewer((current) => current ? { ...current, index: (current.index + 1) % current.items.length } : current);
      }
      if (event.key === 'ArrowLeft') {
        setViewer((current) => current ? { ...current, index: (current.index - 1 + current.items.length) % current.items.length } : current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      if (scrollContainer) scrollContainer.style.overflow = previousScrollOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewer]);

  const statusKey = getCommunityStatusKey(incident?.status);
  const statusMeta = getResidentStatusMeta(incident?.status);
  const StatusIcon = STATUS_ICONS[statusKey] || Lucide.Clock3;
  const reportCount = getCommunityReportCount(incident);
  const subscriberCount = Math.max(0, Number(incident?.subscriberCount) || 0);
  const supportCount = Math.max(0, Number(incident?.supportCount ?? incident?.supports) || 0);
  const commentCount = Math.max(incidentComments.length, Number(incident?.commentCount) || 0);
  const categoryName = translateResidentCategory(incident?.categoryName) || 'Chưa phân loại';
  const currentJourneyIndex = useMemo(() => {
    const index = JOURNEY_STEPS.findIndex((step) => step.statuses.includes(statusKey));
    return index >= 0 ? index : 0;
  }, [statusKey]);

  const publicMedia = useMemo(() => {
    const seen = new Set();
    return reports.flatMap((report) => getReportMedia(report)).filter((item) => {
      const key = String(item?.url || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [reports]);

  const resolutionMedia = useMemo(() => getResolutionMedia(resolution), [resolution]);
  const resolutionFiles = useMemo(() => getResolutionFiles(resolution), [resolution]);
  const showResolutionSection = Boolean(
    resolutionLoading || resolution || resolutionError
  ) && ['approved', 'resolved', 'closed'].includes(statusKey);

  const backDestination = location.state?.from || '/community/feed';
  const backLabel = backDestination === '/community/map' ? 'Quay lại bản đồ' : 'Quay lại bảng tin';

  const handleBack = () => {
    const state = backDestination === '/community/map'
      ? {
          ...(location.state?.mapState ? { mapState: location.state.mapState } : {}),
          focusIncidentId: incidentId,
          preserveScroll: true,
        }
      : { restoreIncidentId: incidentId, preserveScroll: true };
    navigate(backDestination, { state });
  };

  const handleSubscription = async () => {
    if (!user) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
        state: { from: redirect, intent: 'community-subscribe' },
      });
      return;
    }

    const nextSubscribed = !incident?.isSubscribedByCurrentUser;
    setSubscriptionBusy(true);
    setSubscriptionError('');
    try {
      const subscriptionState = await setCommunityIncidentSubscription(incidentId, nextSubscribed);
      setIncident((current) => {
        if (!current) return current;
        const currentCount = Math.max(0, Number(current.subscriberCount) || 0);
        const serverCount = Number(subscriptionState?.subscriberCount);
        const resolvedCount = Number.isFinite(serverCount)
          ? Math.max(0, serverCount)
          : Math.max(0, currentCount + (nextSubscribed ? 1 : -1));
        const resolvedSubscribed = typeof subscriptionState?.isSubscribedByCurrentUser === 'boolean'
          ? subscriptionState.isSubscribedByCurrentUser
          : nextSubscribed;
        return {
          ...current,
          isSubscribedByCurrentUser: resolvedSubscribed,
          subscriberCount: resolvedCount,
        };
      });
    } catch (subscriptionFailure) {
      if (Number(subscriptionFailure?.status) === 401) {
        const redirect = `${location.pathname}${location.search}`;
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
          state: { from: redirect, intent: 'community-subscribe' },
        });
        return;
      }
      setSubscriptionError(subscriptionFailure?.message || 'Không thể cập nhật trạng thái theo dõi.');
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const handleLoadMoreComments = async () => {
    if (commentsLoadingMore || commentPage >= commentTotalPages) return;

    const nextPage = commentPage + 1;
    setCommentsLoadingMore(true);
    setCommentLoadWarning('');
    try {
      const commentResponse = await getCommunityIncidentComments(incidentId, {
        pageNumber: nextPage,
        pageSize: COMMUNITY_COMMENT_PAGE_SIZE,
      });
      const normalizedPage = normalizeCommentPage(commentResponse, nextPage);
      setIncidentComments((current) => mergeComments(current, normalizedPage.items));
      setCommentPage(normalizedPage.pageNumber);
      setCommentTotalPages(normalizedPage.totalPages);
    } catch (loadError) {
      console.error('Community incident comments failed to load more', loadError);
      setCommentLoadWarning('Chưa thể tải thêm bình luận. Vui lòng thử lại.');
    } finally {
      setCommentsLoadingMore(false);
    }
  };

  const handleIncidentCommentSubmit = async (event) => {
    event.preventDefault();
    const content = commentInput.trim();
    if (!content || commentBusy) return;

    if (!user) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
        state: { from: redirect, intent: 'community-comment' },
      });
      return;
    }

    setCommentBusy(true);
    setCommentError('');
    setCommentNotice('');
    try {
      const createdComment = await postCommunityIncidentComment(incidentId, content);
      const nowIso = new Date().toISOString();
      const optimisticComment = createdComment && typeof createdComment === 'object'
        ? createdComment
        : {
            commentId: `local-${Date.now()}`,
            content,
            createdAt: nowIso,
            userName: user?.fullName || user?.name || 'Bạn',
          };
      setIncidentComments((current) => mergeComments(current, [optimisticComment]));
      setIncident((current) => current
        ? { ...current, commentCount: Math.max(0, Number(current.commentCount) || 0) + 1 }
        : current);
      setCommentInput('');
      setCommentNotice('Đã gửi bình luận vào sự vụ.');
    } catch (commentFailure) {
      if (Number(commentFailure?.status) === 401) {
        const redirect = `${location.pathname}${location.search}`;
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
          state: { from: redirect, intent: 'community-comment' },
        });
        return;
      }
      setCommentError(commentFailure?.message || 'Không thể gửi bình luận.');
    } finally {
      setCommentBusy(false);
    }
  };


  if (loading) return <PublicPageMotion><DetailSkeleton /></PublicPageMotion>;

  if (!incident) {
    return (
      <PublicPageMotion>
        <main className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] px-6 py-16 text-center shadow-[var(--public-shadow)]">
          <Lucide.FileWarning size={34} className="mx-auto text-base-content/35" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold">Không thể tải sự vụ cộng đồng</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-base-content/55">{error || 'Sự vụ có thể không còn được công khai.'}</p>
          <button type="button" onClick={handleBack} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
            <Lucide.ArrowLeft size={16} />{backLabel}
          </button>
        </main>
      </PublicPageMotion>
    );
  }

  return (
    <PublicPageMotion className="community-detail-page">
      <main className="text-[var(--public-title)]">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10"
        >
          <Lucide.ArrowLeft size={16} />
          {backLabel}
        </button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0 space-y-6">
            <article className="relative overflow-hidden rounded-[28px] border border-blue-100/90 bg-gradient-to-br from-blue-50/80 via-white to-cyan-50/55 px-5 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-blue-500/15 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 sm:px-7 sm:py-7">
              <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-400" aria-hidden="true" />
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 sm:text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <Lucide.MapPin size={15} className="text-blue-600" />
                      {incident?.areaName || 'Chưa xác định khu vực'}
                    </span>
                    <time className="inline-flex items-center gap-1.5" dateTime={incident?.createdAt || undefined}>
                      <Lucide.Clock3 size={15} />
                      {formatDateTime(incident?.createdAt)}
                    </time>
                  </div>

                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600/80 dark:text-blue-300/80">Sự vụ cộng đồng</p>
                  <h1 className="mt-2 max-w-4xl text-[28px] font-bold leading-[1.2] tracking-tight sm:text-[34px]">
                    {incident?.title || incident?.description || 'Sự vụ đô thị'}
                  </h1>

                  {incident?.description ? (
                    <p className="mt-4 max-w-4xl whitespace-pre-wrap text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                      {incident.description}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">Sự vụ này chưa có mô tả tổng hợp công khai.</p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/5 dark:bg-slate-800/80 dark:text-slate-200">
                      <Lucide.Tag size={13} />
                      {categoryName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/5 dark:bg-slate-800/80 dark:text-slate-200">
                      <Lucide.MessagesSquare size={13} />
                      {reportCount} phản ánh
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/5 dark:bg-slate-800/80 dark:text-slate-200">
                      <Lucide.Bell size={13} />
                      {subscriberCount} theo dõi
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-row items-center gap-2 lg:w-[190px] lg:flex-col lg:items-stretch">
                  <span className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                    <StatusIcon size={15} />
                    {statusMeta.label}
                  </span>
                  <button
                    type="button"
                    onClick={handleSubscription}
                    disabled={subscriptionBusy}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-all ${
                      incident?.isSubscribedByCurrentUser
                        ? 'border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] hover:border-blue-700 hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400'
                        : 'border-blue-200 bg-white text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-500/10'
                    } disabled:cursor-wait disabled:opacity-60`}
                  >
                    {subscriptionBusy ? <Lucide.LoaderCircle size={16} className="animate-spin" /> : <Lucide.Bell size={16} />}
                    {incident?.isSubscribedByCurrentUser ? 'Đang theo dõi' : 'Theo dõi sự vụ'}
                  </button>
                  <SupportButton
                    incidentId={incidentId}
                    initialCount={supportCount}
                    initialSupported={Boolean(incident?.isSupportedByCurrentUser)}
                    entityLabel="sự vụ"
                    showLabel
                    className="h-10 justify-center rounded-xl border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-500/10"
                    onChange={({ isSupported, count }) => {
                      setIncident((current) => current ? {
                        ...current,
                        isSupportedByCurrentUser: isSupported,
                        supportCount: count,
                      } : current);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('incident-community-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                    aria-label={`Đi tới ${commentCount} bình luận của sự vụ`}
                  >
                    <Lucide.MessageCircle size={16} />
                    {commentCount} bình luận
                  </button>
                </div>
              </div>

              <div className="mt-5 border-t border-blue-100/80 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Cập nhật gần nhất {formatDateTime(incident?.updatedAt || incident?.createdAt)}
              </div>
              {subscriptionError ? <p className="mt-2 text-xs leading-5 text-error">{subscriptionError}</p> : null}
            </article>

            <section className="rounded-[28px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.055)] dark:border-slate-800 dark:bg-slate-900 sm:px-7 sm:py-6" aria-labelledby="incident-reports-title">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <h2 id="incident-reports-title" className="text-xl font-bold">Phản ánh của người dân</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Các phản ánh công khai đã được xác nhận thuộc cùng sự vụ này.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{reportCount} phản ánh</span>
              </div>

              {reportsError && !reportsLoading ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" role="status">
                  {reportsError}
                </div>
              ) : null}

              {reportsLoading ? (
                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/30" aria-busy="true">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-3 grid h-[210px] grid-cols-[minmax(0,1.65fr)_minmax(130px,0.75fr)] gap-2.5">
                    <div className="animate-pulse rounded-[18px] bg-slate-200/70 dark:bg-slate-800" />
                    <div className="grid grid-rows-2 gap-2.5">
                      <div className="animate-pulse rounded-[16px] bg-slate-200/70 dark:bg-slate-800" />
                      <div className="animate-pulse rounded-[16px] bg-slate-200/70 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              ) : publicMedia.length > 0 ? (
                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/35">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Ảnh hiện trường</h3>
                      <p className="mt-0.5 text-xs text-slate-400">Tổng hợp từ các phản ánh liên quan.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">{publicMedia.length} ảnh</span>
                  </div>
                  <ReportMediaGallery mediaItems={publicMedia} onOpen={(items, index) => setViewer({ items, index })} />
                </div>
              ) : null}

              {reportsLoading ? (
                <div className="mt-5 space-y-3" aria-hidden="true">
                  {[0, 1].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/55 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/25">
                      <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                      <div className="mt-4 h-4 w-5/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                    </div>
                  ))}
                </div>
              ) : reports.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {reports.map((report) => {
                    const description = String(report?.description || '').trim();
                    return (
                      <article key={report?.feedbackId || report?.id} className="rounded-2xl border border-slate-200 bg-slate-50/55 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/35 dark:border-slate-800 dark:bg-slate-950/25 dark:hover:border-blue-500/20 dark:hover:bg-blue-500/5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[15px] font-bold leading-6">{report?.title || 'Phản ánh liên quan'}</h3>
                            <p className="mt-1 text-xs text-slate-400">
                              {formatDateTime(report?.createdAt)} · {getSubmissionChannelLabel(report?.submissionChannel)}
                            </p>
                          </div>
                          <span className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-slate-900 dark:text-blue-300">
                            {getReportStatusLabel(report?.status)}
                          </span>
                        </div>
                        {description.length >= 3 ? (
                          <p className="mt-3 max-w-4xl whitespace-pre-wrap text-[14px] leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-9 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50">
                  Chưa có phản ánh công khai để hiển thị.
                </div>
              )}
            </section>

            {showResolutionSection ? (
              <section className="rounded-[28px] border border-emerald-100 bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.055)] dark:border-emerald-500/15 dark:bg-slate-900 sm:px-7 sm:py-6" aria-labelledby="incident-resolution-title">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 pb-4 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <Lucide.CircleCheckBig size={18} />
                      </span>
                      <div>
                        <h2 id="incident-resolution-title" className="text-xl font-bold">Kết quả xử lý</h2>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Kết quả đã được phê duyệt và công khai cho sự vụ này.</p>
                      </div>
                    </div>
                  </div>
                  {resolution?.resolvedAt ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Hoàn tất {formatDateTime(resolution.resolvedAt)}
                    </span>
                  ) : null}
                </div>

                {resolutionLoading ? (
                  <div className="mt-5 space-y-3" aria-busy="true">
                    <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                    <div className="h-48 animate-pulse rounded-[20px] bg-slate-100 dark:bg-slate-800" />
                  </div>
                ) : resolutionError ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    {resolutionError}
                  </div>
                ) : resolution ? (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/55 px-4 py-3 dark:border-emerald-500/15 dark:bg-emerald-500/5">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                          <Lucide.BadgeCheck size={15} aria-hidden="true" />
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Trạng thái</span>
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">Đã hoàn tất xử lý</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Lucide.Clock3 size={15} aria-hidden="true" />
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Hoàn tất lúc</span>
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">{resolution?.resolvedAt ? formatDateTime(resolution.resolvedAt) : 'Chưa cập nhật'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Lucide.Files size={15} aria-hidden="true" />
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Minh chứng</span>
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">{resolutionMedia.length + resolutionFiles.length} tệp công khai</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.035)] dark:border-slate-800 dark:bg-slate-950/25">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                            <Lucide.ClipboardCheck size={16} aria-hidden="true" />
                          </span>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Kết quả cuối cùng</p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-slate-600 dark:text-slate-300">
                          {resolution.resolutionSummary || 'Đơn vị xử lý đã xác nhận hoàn tất sự vụ.'}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.035)] dark:border-slate-800 dark:bg-slate-950/25">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                            <Lucide.Wrench size={16} aria-hidden="true" />
                          </span>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Biện pháp đã thực hiện</p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-slate-600 dark:text-slate-300">
                          {resolution.actionTaken || 'Đơn vị xử lý chưa công khai mô tả chi tiết biện pháp đã thực hiện.'}
                        </p>
                      </div>
                    </div>

                    {resolutionMedia.length > 0 ? (
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/35">
                        <div className="flex items-center justify-between gap-3 px-1 pb-1">
                          <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Minh chứng sau xử lý</h3>
                            <p className="mt-0.5 text-xs text-slate-400">Bấm vào ảnh để xem lớn; video có thể phát trực tiếp.</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">{resolutionMedia.length} tệp</span>
                        </div>
                        <ReportMediaGallery mediaItems={resolutionMedia} onOpen={(items, index) => setViewer({ items, index })} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/55 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/25 dark:text-slate-400">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm dark:bg-slate-900">
                          <Lucide.ImageOff size={17} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-700 dark:text-slate-200">Chưa có ảnh hoặc video sau xử lý</p>
                          <p className="mt-0.5 text-xs leading-5">Kết quả vẫn được công khai theo nội dung đã phê duyệt ở phía trên.</p>
                        </div>
                      </div>
                    )}

                    {resolutionFiles.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Tài liệu hoàn thành</p>
                          <span className="text-xs text-slate-400">{resolutionFiles.length} tệp</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {resolutionFiles.map(({ document, url }, index) => (
                            <a
                              key={`${url}-${index}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/35 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-white group-hover:text-blue-600 dark:bg-slate-800">
                                <Lucide.FileText size={16} aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{document?.description || `Tài liệu hoàn thành ${index + 1}`}</span>
                                <span className="mt-0.5 block text-[11px] text-slate-400">Mở tài liệu trong tab mới</span>
                              </span>
                              <Lucide.ExternalLink size={14} className="shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section id="incident-community-comments" className="scroll-mt-28 rounded-[28px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.055)] dark:border-slate-800 dark:bg-slate-900 sm:px-7 sm:py-6" aria-labelledby="incident-community-comments-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="incident-community-comments-title" className="text-xl font-bold">Trao đổi cộng đồng</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Bình luận công khai được gắn với sự vụ này, không tách theo từng phản ánh.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <Lucide.MessageCircle size={13} />
                  {commentCount} bình luận
                </span>
              </div>

              <form onSubmit={handleIncidentCommentSubmit} className="mt-5">
                <label htmlFor="incident-community-comment" className="sr-only">Bình luận về sự vụ</label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-2.5 transition focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] dark:border-slate-800 dark:bg-slate-950/30 dark:focus-within:border-blue-700 dark:focus-within:bg-slate-900">
                  <textarea
                    id="incident-community-comment"
                    rows="2"
                    value={commentInput}
                    onChange={(event) => setCommentInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return;
                      event.preventDefault();
                      if (!commentInput.trim() || commentBusy) return;
                      event.currentTarget.form?.requestSubmit();
                    }}
                    placeholder="Viết bình luận về sự vụ..."
                    className="min-h-[72px] w-full resize-y border-0 bg-transparent px-2.5 py-2 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/75 px-2.5 pt-2.5 dark:border-slate-800">
                    <p className="text-[11px] leading-5 text-slate-400">Enter để gửi · Shift + Enter để xuống dòng</p>
                    <button
                      type="submit"
                      disabled={!commentInput.trim() || commentBusy}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                    >
                      {commentBusy ? <Lucide.LoaderCircle size={14} className="animate-spin" /> : <Lucide.Send size={14} />}
                      Gửi bình luận
                    </button>
                  </div>
                </div>
                {commentError ? <p className="mt-2 text-xs text-red-600">{commentError}</p> : null}
                {commentNotice ? <p className="mt-2 text-xs font-medium text-emerald-600">{commentNotice}</p> : null}
              </form>

              {commentLoadWarning ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" role="status">
                  <Lucide.TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{commentLoadWarning}</span>
                </div>
              ) : null}

              {incidentComments.length > 0 ? (
                <div className="mt-5 divide-y divide-slate-200/80 border-t border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
                  {incidentComments.map((comment, index) => {
                    const author = comment?.userName || comment?.authorName || comment?.createdByName || 'Người dân';
                    const content = comment?.content || comment?.message || comment?.text || '';
                    const initials = author
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(-2)
                      .map((part) => part.charAt(0))
                      .join('')
                      .toUpperCase() || 'ND';

                    return (
                      <article key={comment?.commentId || comment?.id || `${comment?.createdAt}-${index}`} className="flex gap-3 py-4 first:pt-4 last:pb-1">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20" aria-hidden="true">
                          {initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{author}</p>
                            <time className="text-[11px] text-slate-400" dateTime={comment?.createdAt || undefined}>{formatDateTime(comment?.createdAt)}</time>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{content || 'Bình luận không có nội dung.'}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 border-t border-slate-200/80 py-7 text-center dark:border-slate-800">
                  <Lucide.MessagesSquare size={21} className="mx-auto text-blue-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Chưa có bình luận</p>
                  <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-400">Hãy chia sẻ thêm thông tin nếu bạn biết điều gì hữu ích về sự vụ này.</p>
                </div>
              )}

              {incidentComments.length > 0 && commentPage < commentTotalPages ? (
                <div className="mt-4 flex justify-center border-t border-slate-200/80 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleLoadMoreComments}
                    disabled={commentsLoadingMore}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/60"
                  >
                    {commentsLoadingMore ? <Lucide.LoaderCircle size={15} className="animate-spin" /> : <Lucide.ChevronDown size={15} />}
                    {commentsLoadingMore ? 'Đang tải bình luận' : 'Tải thêm bình luận'}
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="min-w-0 space-y-3 xl:sticky xl:top-5">
            <section className="rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.055)] dark:border-slate-800 dark:bg-slate-900" aria-labelledby="incident-location-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="incident-location-title" className="text-lg font-bold">Vị trí sự vụ</h2>
                  <p className="mt-1 text-xs text-slate-400">Xem nhanh khu vực xảy ra sự vụ.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/community/map#incident-map', { state: { focusMap: true, focusIncidentId: incidentId } })}
                  className="shrink-0 text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300"
                >
                  Mở bản đồ
                </button>
              </div>

              {hasIncidentCoordinates(incident) ? (
                <button
                  type="button"
                  onClick={() => navigate('/community/map#incident-map', { state: { focusMap: true, focusIncidentId: incidentId } })}
                  className="group relative mt-3 block w-full overflow-hidden rounded-[18px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Mở vị trí sự vụ trên bản đồ lớn"
                >
                  <CompactPublicIncidentMap
                    items={[incident]}
                    fullMapPath="/community/map#incident-map"
                    detailPathBuilder={() => location.pathname}
                    mapLabel="Vị trí sự vụ"
                    showOpenMapCard={false}
                    minHeight={190}
                    compact
                    deferUntilTilesReady
                    interactive={false}
                    showPopup={false}
                  />
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl border border-white/80 bg-white/92 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100">
                    Xem trên bản đồ lớn
                    <Lucide.ArrowUpRight size={14} className="text-blue-600" />
                  </span>
                </button>
              ) : (
                <div className="mt-3 flex min-h-36 items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-5 text-center dark:border-slate-700 dark:bg-slate-800/60">
                  <div>
                    <Lucide.MapPinOff size={20} className="mx-auto text-blue-500" />
                    <p className="mt-2 text-sm font-semibold">Chưa có tọa độ công khai</p>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3 text-sm leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <Lucide.MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <span>{incident?.locationText || incident?.areaName || 'Chưa cập nhật vị trí'}</span>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200/90 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.055)] dark:border-slate-800 dark:bg-slate-900" aria-labelledby="incident-progress-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="incident-progress-title" className="text-base font-bold">Theo dõi tiến trình</h2>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                  {currentJourneyIndex + 1}/{JOURNEY_STEPS.length}
                </span>
              </div>

              <ol className="mt-3.5">
                {JOURNEY_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const terminalDone = JOURNEY_STEPS[JOURNEY_STEPS.length - 1].statuses.includes(statusKey);
                  const completed = index < currentJourneyIndex || (terminalDone && index === currentJourneyIndex);
                  const active = index === currentJourneyIndex && !completed;
                  return (
                    <li key={step.key} className="relative grid grid-cols-[34px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                      {index !== JOURNEY_STEPS.length - 1 ? (
                        <span className={`absolute bottom-0 left-[16px] top-8 w-px ${index < currentJourneyIndex ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`} aria-hidden="true" />
                      ) : null}
                      <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border ${completed ? 'border-blue-600 bg-blue-600 text-white' : active ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/40' : 'border-slate-200 bg-white text-slate-300 dark:border-slate-800 dark:bg-slate-950'}`}>
                        {completed ? <Lucide.Check size={14} /> : <StepIcon size={14} />}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${active || completed ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{step.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-400">{step.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </aside>
        </div>

        {error ? <p className="mt-5 rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</p> : null}
      </main>
      {viewer && typeof document !== 'undefined' ? createPortal((() => {
        const current = viewer.items[viewer.index];
        return (
          <div
            className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/95 p-3 backdrop-blur-sm sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Xem hình ảnh phản ánh"
            onClick={() => setViewer(null)}
          >
            <button type="button" onClick={() => setViewer(null)} className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Đóng"><Lucide.X size={22} /></button>
            {viewer.items.length > 1 ? (
              <>
                <button type="button" onClick={(event) => { event.stopPropagation(); setViewer((currentViewer) => ({ ...currentViewer, index: (currentViewer.index - 1 + currentViewer.items.length) % currentViewer.items.length })); }} className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6" aria-label="Ảnh trước"><Lucide.ChevronLeft size={28} /></button>
                <button type="button" onClick={(event) => { event.stopPropagation(); setViewer((currentViewer) => ({ ...currentViewer, index: (currentViewer.index + 1) % currentViewer.items.length })); }} className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6" aria-label="Ảnh tiếp theo"><Lucide.ChevronRight size={28} /></button>
              </>
            ) : null}
            <div className="flex h-full w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
              {current.video ? (
                <video src={current.url} controls autoPlay className="max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-3rem)] bg-black object-contain sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100vw-7rem)]" />
              ) : (
                <img src={current.url} alt={`Minh chứng ${viewer.index + 1}`} className="max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-3rem)] object-contain shadow-2xl sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100vw-7rem)]" />
              )}
              {viewer.items.length > 1 ? <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">{viewer.index + 1} / {viewer.items.length}</span> : null}
            </div>
          </div>
        );
      })(), document.body) : null}
    </PublicPageMotion>
  );

};

export const CommunityFeedDetailPage = CommunityFeedbackDetailPage;
export default CommunityFeedbackDetailPage;
