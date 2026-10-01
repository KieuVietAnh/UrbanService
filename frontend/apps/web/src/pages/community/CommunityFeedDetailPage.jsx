import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { managementTypes } from '@urbanmind/shared-types';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import useTicketDetail from '../../hooks/useTicketDetail';
import SupportButton from '../../components/community/SupportButton';

const CATEGORY_LABELS = {
  'garbage collection': 'Thu gom rác',
  'waste management': 'Quản lý chất thải',
  'road maintenance': 'Bảo trì đường bộ',
  'street lighting': 'Chiếu sáng đô thị',
  drainage: 'Thoát nước',
  'water supply': 'Cấp nước',
  'public safety': 'An toàn công cộng',
};

const STATUS_META = {
  [managementTypes.feedbackStatus.VERIFIED]: {
    label: 'Đã xác minh',
    description: 'Thông tin phản ánh đã được kiểm tra và công khai.',
    icon: Lucide.BadgeCheck,
    className: 'border-info/20 bg-info/10 text-info',
  },
  [managementTypes.feedbackStatus.ASSIGNED]: {
    label: 'Đã chuyển xử lý',
    description: 'Phản ánh đã được chuyển đến đơn vị phụ trách.',
    icon: Lucide.SendToBack,
    className: 'border-secondary/20 bg-secondary/10 text-secondary',
  },
  [managementTypes.feedbackStatus.IN_PROGRESS]: {
    label: 'Đang xử lý',
    description: 'Đơn vị phụ trách đang thực hiện xử lý.',
    icon: Lucide.LoaderCircle,
    className: 'border-warning/25 bg-warning/10 text-warning',
  },
  [managementTypes.feedbackStatus.NEED_REWORK]: {
    label: 'Đang bổ sung kết quả',
    description: 'Kết quả đang được bổ sung hoặc thực hiện lại.',
    icon: Lucide.RotateCcw,
    className: 'border-warning/25 bg-warning/10 text-warning',
  },
  [managementTypes.feedbackStatus.RESOLVED]: {
    label: 'Đã có kết quả',
    description: 'Đơn vị xử lý đã gửi kết quả để kiểm tra.',
    icon: Lucide.ClipboardCheck,
    className: 'border-success/20 bg-success/10 text-success',
  },
  [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: {
    label: 'Đang kiểm tra kết quả',
    description: 'Kết quả xử lý đang được rà soát.',
    icon: Lucide.SearchCheck,
    className: 'border-secondary/20 bg-secondary/10 text-secondary',
  },
  [managementTypes.feedbackStatus.APPROVED]: {
    label: 'Đã phê duyệt',
    description: 'Kết quả xử lý đã được phê duyệt.',
    icon: Lucide.CircleCheck,
    className: 'border-success/20 bg-success/10 text-success',
  },
  [managementTypes.feedbackStatus.CLOSED]: {
    label: 'Đã đóng',
    description: 'Phản ánh đã hoàn tất toàn bộ quy trình.',
    icon: Lucide.Archive,
    className: 'border-base-300 bg-base-200 text-base-content/65',
  },
};

const JOURNEY_STEPS = [
  {
    title: 'Đã xác minh',
    description: 'Thông tin được công khai',
    statuses: [managementTypes.feedbackStatus.VERIFIED],
    icon: Lucide.BadgeCheck,
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
    description: 'Kết quả đã được duyệt',
    statuses: [
      managementTypes.feedbackStatus.APPROVED,
      managementTypes.feedbackStatus.CLOSED,
    ],
    icon: Lucide.CircleCheckBig,
  },
];

const translateCategoryName = (categoryName) => {
  const normalizedCategory = String(categoryName || '')
    .trim()
    .toLocaleLowerCase('en-US');

  return CATEGORY_LABELS[normalizedCategory] ||
    categoryName ||
    'Chưa phân loại';
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa rõ thời gian';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ thời gian';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const isVideoAttachment = (attachment, resolvedUrl = '') => {
  const mimeType = String(
    attachment?.mimeType ||
    attachment?.contentType ||
    attachment?.fileType ||
    ''
  ).toLowerCase();
  const normalizedUrl = String(resolvedUrl)
    .toLowerCase()
    .split('?')[0];

  return (
    mimeType.startsWith('video/') ||
    ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].some(
      (extension) => normalizedUrl.endsWith(extension)
    )
  );
};

const getCommentId = (comment, index) => (
  comment?.commentId || comment?.id || `${comment?.createdAt || 'comment'}-${index}`
);

const getCommentAuthor = (comment) => (
  comment?.userName ||
  comment?.authorName ||
  comment?.createdByName ||
  comment?.fullName ||
  'Người dân'
);

const getCommentContent = (comment) => (
  comment?.content ||
  comment?.text ||
  comment?.comment ||
  comment?.message ||
  ''
);

const getCommentTimestamp = (comment) => {
  const timestamp = new Date(
    comment?.createdAt ||
    comment?.createdDate ||
    comment?.timestamp ||
    0
  ).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeCommentText = (value) => (
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi-VN')
);

const dedupeComments = (commentItems = []) => {
  const uniqueComments = [];
  const seenIds = new Set();
  const recentFingerprints = new Map();

  commentItems.forEach((comment, index) => {
    const rawId = comment?.commentId || comment?.id;
    const commentId = rawId ? String(rawId) : '';
    const author = normalizeCommentText(getCommentAuthor(comment));
    const content = normalizeCommentText(getCommentContent(comment));
    const timestamp = getCommentTimestamp(comment);
    const fingerprint = `${author}::${content}`;

    if (commentId && seenIds.has(commentId)) return;

    const previousTimestamp = recentFingerprints.get(fingerprint);
    const likelyOptimisticDuplicate = (
      fingerprint !== '::' &&
      previousTimestamp !== undefined &&
      (
        timestamp === 0 ||
        previousTimestamp === 0 ||
        Math.abs(timestamp - previousTimestamp) <= 10000
      )
    );

    if (likelyOptimisticDuplicate) return;

    if (commentId) seenIds.add(commentId);
    recentFingerprints.set(fingerprint, timestamp);
    uniqueComments.push({
      ...comment,
      __communityRenderKey: commentId || `${fingerprint}-${timestamp || index}`,
    });
  });

  return uniqueComments;
};

export const CommunityFeedDetailPage = () => {
  const params = useParams();
  const feedbackId = params.feedbackId || params.id;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const returnTo = location.state?.from || '/community/feed';
  const returnLabel =
    location.state?.returnLabel ||
    (
      returnTo === '/community/map'
        ? 'Quay lại bản đồ sự cố'
        : 'Quay lại bảng tin'
    );

  const handleBack = () => {
    const returningToMap = returnTo === '/community/map';

    navigate(returnTo, {
      state: returningToMap
        ? {
          mapState: location.state?.mapState || null,
          focusFeedbackId: location.state?.focusFeedbackId || feedbackId,
          focusLatitude: location.state?.focusLatitude,
          focusLongitude: location.state?.focusLongitude,
          preserveScrollOnEnter: true,
        }
        : {
          restoreFeedbackId: feedbackId,
          preserveScrollOnEnter: true,
        },
    });
  };

  const {
    ticket,
    comments,
    chatInput,
    setChatInput,
    loading,
    error,
    handleSendChat,
    getAttachmentUrl,
  } = useTicketDetail(feedbackId, user);

  const [previewIndex, setPreviewIndex] = useState(null);
  const [visibleCommentCount, setVisibleCommentCount] = useState(3);

  const attachments = Array.isArray(ticket?.attachments)
    ? ticket.attachments
    : [];
  const activeAttachment = Number.isInteger(previewIndex)
    ? attachments[previewIndex]
    : null;
  const activeAttachmentUrl = activeAttachment
    ? getAttachmentUrl(activeAttachment)
    : '';
  const activeAttachmentIsVideo = activeAttachment
    ? isVideoAttachment(activeAttachment, activeAttachmentUrl)
    : false;

  useEffect(() => {
    setVisibleCommentCount(3);
  }, [feedbackId]);

  useEffect(() => {
    if (!activeAttachment) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewIndex(null);
        return;
      }

      if (
        attachments.length > 1 &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;

        setPreviewIndex((currentIndex) => {
          const safeIndex = Number.isInteger(currentIndex)
            ? currentIndex
            : 0;
          return (
            safeIndex + direction + attachments.length
          ) % attachments.length;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeAttachment, attachments.length]);

  const statusMeta = STATUS_META[ticket?.status] || {
    label: 'Đang cập nhật',
    description: 'Tiến độ xử lý đang được cập nhật.',
    icon: Lucide.Clock3,
    className: 'border-base-300 bg-base-200 text-base-content/60',
  };
  const StatusIcon = statusMeta.icon;
  const categoryLabel = translateCategoryName(
    ticket?.categoryName || ticket?.category?.name
  );
  const areaName = (
    ticket?.areaName ||
    ticket?.wardName ||
    ticket?.districtName ||
    'Chưa xác định khu vực'
  );
  const authorName = (
    ticket?.userName ||
    ticket?.reporterName ||
    ticket?.createdByName ||
    'Người dân'
  );
  const createdAt = ticket?.createdAt || ticket?.submittedAt;
  const updatedAt = ticket?.updatedAt || ticket?.lastUpdatedAt || createdAt;
  const uniqueComments = dedupeComments(
    Array.isArray(comments) ? comments : []
  );
  const commentCount = uniqueComments.length > 0
    ? uniqueComments.length
    : Number(ticket?.commentCount || 0);
  const supportCount = Number(ticket?.supportCount || ticket?.supports || 0);
  const orderedComments = [...uniqueComments].sort((firstComment, secondComment) => (
    getCommentTimestamp(secondComment) - getCommentTimestamp(firstComment)
  ));
  const visibleComments = orderedComments.slice(0, visibleCommentCount);
  const hiddenCommentCount = Math.max(
    0,
    orderedComments.length - visibleComments.length
  );
  const latestCommentAt = (
    orderedComments[0]?.createdAt ||
    orderedComments[0]?.createdDate ||
    updatedAt
  );

  const matchedJourneyIndex = JOURNEY_STEPS.findIndex((step) => (
    step.statuses.includes(ticket?.status)
  ));
  const currentJourneyIndex = matchedJourneyIndex >= 0
    ? matchedJourneyIndex
    : 0;

  const movePreview = (direction) => {
    if (attachments.length <= 1) return;

    setPreviewIndex((currentIndex) => {
      const safeIndex = Number.isInteger(currentIndex)
        ? currentIndex
        : 0;
      return (
        safeIndex + direction + attachments.length
      ) % attachments.length;
    });
  };

  if (loading) {
    return (
      <main className="space-y-4" aria-busy="true" aria-label="Đang tải chi tiết phản ánh cộng đồng">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-base-300/60" />
        <section className="h-64 animate-pulse rounded-[28px] border border-base-300 bg-base-100 shadow-sm" />
        <section className="h-40 animate-pulse rounded-[28px] border border-base-300 bg-base-100 shadow-sm" />
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="h-96 animate-pulse rounded-[28px] border border-base-300 bg-base-100 shadow-sm" />
          <div className="h-80 animate-pulse rounded-[28px] border border-base-300 bg-base-100 shadow-sm" />
        </section>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="rounded-[28px] border border-base-300 bg-base-100 px-6 py-16 text-center shadow-sm">
        <Lucide.FileWarning
          size={34}
          className="mx-auto text-base-content/35"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-lg font-bold">
          Không thể tải phản ánh cộng đồng
        </h1>
        <p className="mt-2 text-sm text-base-content/55">
          {error || 'Phản ánh có thể đã bị ẩn hoặc không còn công khai.'}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="btn admin-primary-action mt-5 rounded-2xl"
        >
          {returnLabel}
        </button>
      </main>
    );
  }

  return (
    <>
      <main className="space-y-4 text-base-content">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-base-content/55 transition hover:bg-base-100 hover:text-primary"
        >
          <Lucide.ArrowLeft size={17} aria-hidden="true" />
          {returnLabel}
        </button>

        <article className="overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-[0_16px_40px_rgba(15,23,42,0.09)]">
          <div className="grid gap-6 px-5 py-5 sm:px-7 sm:py-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <header className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/15 bg-secondary/8 px-3 py-1.5 text-xs font-semibold text-secondary">
                  <Lucide.Tag size={13} aria-hidden="true" />
                  {categoryLabel}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusMeta.className}`}>
                  <StatusIcon size={13} aria-hidden="true" />
                  {statusMeta.label}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {ticket.title || 'Phản ánh đô thị'}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-base-content/55">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-content">
                    {authorName.charAt(0).toUpperCase()}
                  </span>
                  <strong className="font-semibold text-base-content">
                    {authorName}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lucide.MapPin size={15} aria-hidden="true" />
                  {areaName}
                </span>
                <time
                  dateTime={createdAt || undefined}
                  className="inline-flex items-center gap-1.5"
                >
                  <Lucide.CalendarDays size={15} aria-hidden="true" />
                  Đăng {formatDateTime(createdAt)}
                </time>
                {updatedAt && updatedAt !== createdAt ? (
                  <time
                    dateTime={updatedAt}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Lucide.Clock3 size={15} aria-hidden="true" />
                    Cập nhật {formatDateTime(updatedAt)}
                  </time>
                ) : null}
              </div>
            </header>

            <aside className="rounded-[22px] border border-base-300 bg-base-200/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/45">
                  Trạng thái hiện tại
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusMeta.className}`}>
                  <StatusIcon size={13} aria-hidden="true" />
                  {statusMeta.label}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-base-content/60">
                {statusMeta.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SupportButton
                  feedbackId={feedbackId}
                  initialCount={supportCount}
                  initialSupported={ticket?.isSupportedByCurrentUser}
                  className="h-10"
                />
                <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 text-sm font-semibold text-base-content/60">
                  <Lucide.MessageCircle size={16} aria-hidden="true" />
                  {commentCount} bình luận
                </span>
              </div>
            </aside>
          </div>
        </article>

        <section className="rounded-[28px] border border-base-300 bg-base-100 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] sm:p-5" aria-labelledby="community-progress-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="community-progress-title" className="text-lg font-bold">
                Tiến độ xử lý công khai
              </h2>
              <p className="mt-1 text-sm text-base-content/55">
                Các mốc chính giúp cộng đồng theo dõi quá trình xử lý.
              </p>
            </div>
            <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
              Bước {currentJourneyIndex + 1}/{JOURNEY_STEPS.length}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <ol className="grid min-w-[680px] grid-cols-4">
              {JOURNEY_STEPS.map((step, index) => {
                const Icon = step.icon;
                const completed = index < currentJourneyIndex;
                const active = index === currentJourneyIndex;

                return (
                  <li key={step.title} className="relative px-2 text-center">
                    {index < JOURNEY_STEPS.length - 1 ? (
                      <span
                        className={`absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-[18px] h-0.5 ${
                          index < currentJourneyIndex
                            ? 'bg-primary'
                            : 'bg-base-300'
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}

                    <span
                      className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border ${
                        completed
                          ? 'border-primary bg-primary text-primary-content'
                          : active
                            ? 'border-primary bg-primary/10 text-primary ring-4 ring-primary/10'
                            : 'border-base-300 bg-base-100 text-base-content/30'
                      }`}
                    >
                      {completed ? (
                        <Lucide.Check size={16} aria-hidden="true" />
                      ) : (
                        <Icon size={16} aria-hidden="true" />
                      )}
                    </span>
                    <p className={`mt-2 text-sm font-semibold ${
                      active || completed
                        ? 'text-base-content'
                        : 'text-base-content/40'
                    }`}>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-base-content/45">
                      {step.description}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <article className="rounded-[28px] border border-base-300 bg-base-100 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] sm:p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Nội dung phản ánh</h2>
                <p className="mt-1 text-sm text-base-content/55">
                  Thông tin và minh chứng đã được công khai.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-200/45 px-3 py-1.5 text-xs font-semibold text-base-content/55">
                <Lucide.Paperclip size={13} aria-hidden="true" />
                {attachments.length} tệp
              </span>
            </header>

            <div className="mt-4 rounded-2xl border border-base-300 bg-base-200/45 px-4 py-4 sm:px-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-base-content/75">
                {ticket.description || 'Không có mô tả chi tiết.'}
              </p>
            </div>

            <section className="mt-4" aria-labelledby="community-evidence-title">
              <h3 id="community-evidence-title" className="text-sm font-semibold">
                Hình ảnh và video
              </h3>

              {attachments.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {attachments.map((attachment, index) => {
                    const attachmentUrl = getAttachmentUrl(attachment);
                    const video = isVideoAttachment(
                      attachment,
                      attachmentUrl
                    );

                    return (
                      <button
                        key={attachment?.attachmentId || attachment?.id || index}
                        type="button"
                        onClick={() => setPreviewIndex(index)}
                        className="group overflow-hidden rounded-2xl border border-base-300 bg-base-200 text-left transition hover:border-primary/25 hover:shadow-md"
                      >
                        <span className="relative flex h-44 items-center justify-center overflow-hidden sm:h-48">
                          {attachmentUrl ? (
                            video ? (
                              <>
                                <video
                                  src={attachmentUrl}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/15 text-white transition group-hover:bg-black/30">
                                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 backdrop-blur">
                                    <Lucide.Play size={18} fill="currentColor" aria-hidden="true" />
                                  </span>
                                </span>
                              </>
                            ) : (
                              <img
                                src={attachmentUrl}
                                alt={`Minh chứng ${index + 1}`}
                                className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                            )
                          ) : (
                            <Lucide.ImageOff
                              size={24}
                              className="text-base-content/30"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="flex items-center justify-between gap-2 border-t border-base-300 bg-base-100 px-3 py-2.5">
                          <span className="truncate text-xs font-semibold">
                            Tệp {index + 1}
                          </span>
                          <Lucide.Expand size={14} className="text-base-content/35" aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-base-300 bg-base-200/30 px-4 py-5 text-sm text-base-content/45">
                  <Lucide.ImageOff size={19} aria-hidden="true" />
                  Phản ánh chưa có minh chứng công khai.
                </div>
              )}
            </section>
          </article>

          <section
            className="overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
            aria-labelledby="community-comments-title"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 px-5 py-5 sm:px-6">
              <div>
                <h2 id="community-comments-title" className="text-lg font-bold">
                  Trao đổi cộng đồng
                </h2>
                <p className="mt-1 text-sm text-base-content/55">
                  Chia sẻ thông tin hữu ích và trao đổi văn minh về phản ánh.
                </p>
              </div>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/15 bg-primary/8 px-3 text-xs font-semibold text-primary">
                <Lucide.MessageCircle size={14} aria-hidden="true" />
                {commentCount} bình luận
              </span>
            </header>

            <div className="grid gap-5 bg-base-200/18 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
              <div className="min-w-0 space-y-4">
                <form
                  onSubmit={handleSendChat}
                  className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-content shadow-sm">
                      {(user?.fullName || user?.name || 'Bạn').charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <label htmlFor="community-detail-comment" className="sr-only">
                        Viết bình luận công khai
                      </label>
                      <textarea
                        id="community-detail-comment"
                        rows="2"
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Bạn nghĩ gì về phản ánh này?"
                        className="textarea textarea-bordered min-h-[72px] max-h-40 w-full resize-y rounded-xl border-base-300 bg-base-100 px-4 py-3 text-sm leading-6 focus:border-primary/40 focus:outline-none"
                      />

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-1.5 text-xs text-base-content/42">
                          <Lucide.Globe2 size={13} aria-hidden="true" />
                          Nội dung được hiển thị công khai.
                        </p>
                        <button
                          type="submit"
                          disabled={!chatInput?.trim()}
                          className="btn admin-primary-action h-10 min-h-10 rounded-xl px-4"
                        >
                          <Lucide.Send size={14} aria-hidden="true" />
                          Gửi bình luận
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                <div className="space-y-3">
                  {visibleComments.length > 0 ? (
                    visibleComments.map((comment, index) => {
                      const commentAuthor = getCommentAuthor(comment);
                      const commentContent = getCommentContent(comment);

                      return (
                        <article
                          key={comment.__communityRenderKey || getCommentId(comment, index)}
                          className="grid grid-cols-[40px_minmax(0,1fr)] gap-3"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-xs font-bold text-secondary">
                            {commentAuthor.charAt(0).toUpperCase()}
                          </span>

                          <div className="min-w-0 rounded-2xl rounded-tl-md border border-base-300 bg-base-100 px-4 py-3 shadow-sm transition hover:border-primary/15">
                            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                              <p className="truncate text-sm font-semibold text-base-content">
                                {commentAuthor}
                              </p>
                              <time
                                dateTime={comment?.createdAt || undefined}
                                className="shrink-0 text-xs text-base-content/42"
                              >
                                {formatDateTime(comment?.createdAt)}
                              </time>
                            </header>
                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-base-content/68">
                              {commentContent || 'Bình luận không có nội dung.'}
                            </p>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 bg-base-100 px-4 py-6 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                        <Lucide.MessageCircle size={20} aria-hidden="true" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-base-content/65">
                        Chưa có bình luận nào
                      </p>
                      <p className="mt-1 text-xs text-base-content/42">
                        Hãy là người đầu tiên chia sẻ thông tin hữu ích.
                      </p>
                    </div>
                  )}
                </div>

                {hiddenCommentCount > 0 || (
                  visibleCommentCount > 3 &&
                  orderedComments.length > 3
                ) ? (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {hiddenCommentCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setVisibleCommentCount((currentCount) => (
                          currentCount + 5
                        ))}
                        className="btn btn-outline btn-sm rounded-xl px-4"
                      >
                        <Lucide.MessageSquareMore size={15} aria-hidden="true" />
                        Xem thêm {Math.min(5, hiddenCommentCount)} bình luận
                      </button>
                    ) : null}

                    {visibleCommentCount > 3 && orderedComments.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setVisibleCommentCount(3)}
                        className="btn btn-ghost btn-sm rounded-xl px-4 text-base-content/55"
                      >
                        <Lucide.ChevronUp size={15} aria-hidden="true" />
                        Thu gọn
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside className="space-y-4 xl:sticky xl:top-24">
                <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 via-base-100 to-secondary/8 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Lucide.ChartNoAxesColumnIncreasing size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">Tổng quan thảo luận</h3>
                      <p className="mt-0.5 text-xs text-base-content/45">
                        Mức độ tương tác của cộng đồng.
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-base-300/80 bg-base-100/85 px-3 py-3">
                      <dt className="text-[11px] text-base-content/45">
                        Bình luận
                      </dt>
                      <dd className="mt-1 text-xl font-bold">
                        {commentCount}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-base-300/80 bg-base-100/85 px-3 py-3">
                      <dt className="text-[11px] text-base-content/45">
                        Lượt hỗ trợ
                      </dt>
                      <dd className="mt-1 text-xl font-bold text-error">
                        {supportCount}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-2 rounded-xl border border-base-300/80 bg-base-100/85 px-3 py-3">
                    <p className="text-[11px] text-base-content/45">
                      Hoạt động gần nhất
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/68">
                      <Lucide.Clock3 size={13} aria-hidden="true" />
                      {formatDateTime(latestCommentAt)}
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                      <Lucide.ShieldCheck size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">Trao đổi văn minh</h3>
                      <p className="mt-0.5 text-xs text-base-content/45">
                        Giữ cuộc thảo luận hữu ích.
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-3 text-xs leading-5 text-base-content/58">
                    <li className="flex gap-2">
                      <Lucide.Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                      Chia sẻ thông tin đúng với sự việc.
                    </li>
                    <li className="flex gap-2">
                      <Lucide.Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                      Tôn trọng người tham gia trao đổi.
                    </li>
                    <li className="flex gap-2">
                      <Lucide.Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                      Không đăng nội dung spam hoặc không liên quan.
                    </li>
                  </ul>
                </section>
              </aside>
            </div>
          </section>
        </section>
      </main>

      {activeAttachment && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black"
              role="dialog"
              aria-modal="true"
              aria-label={`Xem minh chứng ${previewIndex + 1}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setPreviewIndex(null);
                }
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent px-4 pb-16 pt-4 sm:px-6">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Minh chứng phản ánh
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    {previewIndex + 1} / {attachments.length}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="absolute right-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:right-6"
                aria-label="Đóng xem trước"
              >
                <Lucide.X size={21} aria-hidden="true" />
              </button>

              <div className="flex h-full w-full items-center justify-center px-4 py-4 sm:px-20 sm:py-6">
                {activeAttachmentIsVideo ? (
                  <video
                    key={activeAttachmentUrl}
                    src={activeAttachmentUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full object-contain"
                  >
                    Trình duyệt của bạn không hỗ trợ phát video.
                  </video>
                ) : (
                  <img
                    src={activeAttachmentUrl}
                    alt={`Minh chứng ${previewIndex + 1}`}
                    className="max-h-full max-w-full select-none object-contain"
                    draggable="false"
                  />
                )}
              </div>

              {attachments.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => movePreview(-1)}
                    className="absolute left-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:left-6 sm:h-14 sm:w-14"
                    aria-label="Xem tệp trước"
                  >
                    <Lucide.ChevronLeft size={28} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePreview(1)}
                    className="absolute right-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/80 sm:right-6 sm:h-14 sm:w-14"
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

export const CommunityFeedbackDetailPage = CommunityFeedDetailPage;

export default CommunityFeedDetailPage;
