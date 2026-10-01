import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { managementTypes } from '@urbanmind/shared-types';
import PublicPageMotion from '../../components/public/PublicPageMotion';
import useTicketDetail from '../../hooks/useTicketDetail';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  Drainage: 'Thoát nước',
  'Garbage Collection': 'Thu gom rác',
  'Public Safety': 'An toàn công cộng',
  'Road Maintenance': 'Bảo trì đường bộ',
  'Street Lighting': 'Chiếu sáng đô thị',
  'Water Supply': 'Cấp nước',
};



// ─── Utilities ────────────────────────────────────────────────────────────────

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (start, end) => {
  if (!start || !end) return '—';
  const diffMs = new Date(end) - new Date(start);
  if (Number.isNaN(diffMs) || diffMs < 0) return '—';
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  return diffDays === 1 ? '1 ngày' : `${diffDays} ngày`;
};

const isVideoUrl = (url = '') => {
  const v = String(url).toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].some((ext) => v.includes(ext));
};

const isImageDocument = (document) => {
  const fileType = String(document?.fileType || '').toLowerCase();
  const fileUrl = String(document?.fileUrl || '').toLowerCase();

  return (
    fileType.startsWith('image/') ||
    fileType === 'image' ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(fileUrl)
  );
};

const normalizeImageList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
};

const getCategoryLabel = (name) =>
  CATEGORY_LABELS[name] || name || 'Chưa phân loại';



const getRatingText = (value) => {
  switch (value) {
    case 1: return 'Rất không hài lòng';
    case 2: return 'Không hài lòng';
    case 3: return 'Bình thường';
    case 4: return 'Hài lòng';
    case 5: return 'Rất hài lòng';
    default: return '';
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ResultPageShell = ({ children }) => (
  <PublicPageMotion>
    <div data-public-reveal className="text-[var(--public-title)]">
      {children}
    </div>
  </PublicPageMotion>
);

const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-base-content/[0.075] ${className}`} aria-hidden="true" />
);

const ResultSkeleton = () => (
  <ResultPageShell>
    <main className="relative isolate space-y-4" aria-busy="true" aria-label="Đang tải kết quả xử lý">
      <div
        className="pointer-events-none absolute -inset-x-3 -inset-y-4 -z-10 overflow-hidden rounded-[36px] border border-[var(--public-border-soft)] bg-[linear-gradient(180deg,var(--public-surface-soft),transparent)] sm:-inset-x-5 sm:-inset-y-5"
        aria-hidden="true"
      />

      <div className="h-1 overflow-hidden rounded-full bg-blue-100/70" aria-hidden="true">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500/55" />
      </div>

      {/* Match the real overview geometry to avoid a large layout jump when data arrives. */}
      <article className="relative overflow-hidden rounded-[28px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_82%_0%,rgba(37,99,235,0.09),transparent_44%)]" aria-hidden="true" />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-9 w-36" />
              <div className="mt-4 flex gap-2">
                <SkeletonBlock className="h-8 w-28 rounded-full" />
                <SkeletonBlock className="h-8 w-36 rounded-full" />
                <SkeletonBlock className="h-8 w-24 rounded-full" />
              </div>
              <SkeletonBlock className="mt-4 h-10 w-[min(520px,78%)]" />
              <SkeletonBlock className="mt-3 h-4 w-[min(680px,92%)]" />
              <SkeletonBlock className="mt-2 h-4 w-[min(560px,74%)]" />
            </div>

            <aside className="w-full shrink-0 xl:w-[320px]">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/45 p-4">
                <div className="flex items-start gap-3">
                  <SkeletonBlock className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-5 w-32" />
                    <SkeletonBlock className="h-3 w-full" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <SkeletonBlock className="h-14" />
                  <SkeletonBlock className="h-14" />
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-6 grid gap-4 border-t border-[var(--public-border)] pt-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-2.5 w-16" />
                  <SkeletonBlock className="h-4 w-36 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      {/* Progress skeleton mirrors the four-step tracker instead of one large pulsing slab. */}
      <section className="rounded-[22px] border border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
          <SkeletonBlock className="h-8 w-24 rounded-full" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="relative flex items-center gap-3 md:flex-col md:items-start">
              {item < 3 && (
                <div className="absolute left-5 top-10 hidden h-px w-[calc(100%+1rem)] bg-blue-100 md:block" aria-hidden="true" />
              )}
              <SkeletonBlock className="relative z-10 h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2 md:w-full">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-32 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.95fr)] xl:items-start">
        <div className="space-y-4">
          <section className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-11 w-11 shrink-0" />
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-32" />
                <SkeletonBlock className="h-3 w-52" />
              </div>
            </div>
            <SkeletonBlock className="mt-5 h-20 w-full" />
          </section>

          <section className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="mt-2 h-3 w-80 max-w-full" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <SkeletonBlock className="mb-3 h-4 w-28" />
                <SkeletonBlock className="aspect-[16/10] w-full rounded-2xl" />
                <div className="mt-3 flex gap-2">
                  <SkeletonBlock className="h-14 w-20" />
                  <SkeletonBlock className="h-14 w-20" />
                </div>
              </div>
              <div>
                <SkeletonBlock className="mb-3 h-4 w-24" />
                <SkeletonBlock className="aspect-[16/10] w-full rounded-2xl" />
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[24px] border border-blue-100 bg-[var(--public-surface)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="flex items-start gap-3">
            <SkeletonBlock className="h-11 w-11 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="h-3 w-full" />
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[var(--public-border)] p-4">
              <SkeletonBlock className="h-3 w-28" />
              <div className="mt-4 flex justify-between gap-2">
                {[0, 1, 2, 3, 4].map((item) => <SkeletonBlock key={item} className="h-10 w-10" />)}
              </div>
            </div>
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-28 w-full" />
            <SkeletonBlock className="h-11 w-full" />
          </div>
        </section>
      </div>

      <p className="sr-only" role="status">Đang tải thông tin kết quả xử lý…</p>
    </main>
  </ResultPageShell>
);

// ─── Journey Steps (progress tracker) ────────────────────────────────────────

const JOURNEY_STEPS = [
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const ResolutionResultPage = () => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mediaViewer, setMediaViewer] = useState(null);

  const {
    ticket,
    loading,
    error,
    resolutionError,
    handleRateSubmit,
    rating,
    setRating,
    satisfied,
    setSatisfied,
    reviewComment,
    setReviewComment,
    ratingLoading,
    reviewError,
    submittedReview,
    getAttachmentUrl,
  } = useTicketDetail(feedbackId, user, undefined, { cacheTicketDetails: true });

  // ── Derived images ──────────────────────────────────────────────────────────
  const beforeImages = useMemo(() => {
    return normalizeImageList(ticket?.attachments || [])
      .map((f) => getAttachmentUrl(f))
      .filter(Boolean);
  }, [ticket, getAttachmentUrl]);

  const afterImages = useMemo(() => {
    const documents = Array.isArray(ticket?.resolution?.completionDocuments)
      ? ticket.resolution.completionDocuments
      : [];

    return documents
      .filter((document) => {
        const fileType = String(document?.fileType || '').toLowerCase();
        const fileUrl = String(document?.fileUrl || '').toLowerCase();
        return (
          isImageDocument(document) ||
          fileType.startsWith('video/') ||
          fileType === 'video' ||
          /\.(mp4|webm|ogg|mov|m4v)(\?|$)/.test(fileUrl)
        );
      })
      .map((document) => getAttachmentUrl(document))
      .filter(Boolean);
  }, [ticket, getAttachmentUrl]);

  const openMediaViewer = (items, index = 0) => {
    if (!Array.isArray(items) || items.length === 0) return;
    setMediaViewer({ items, index });
  };

  const moveMediaViewer = (direction) => {
    setMediaViewer((current) => {
      if (!current?.items?.length) return current;
      const nextIndex = (current.index + direction + current.items.length) % current.items.length;
      return { ...current, index: nextIndex };
    });
  };

  // ── Derived resolution data ─────────────────────────────────────────────────
  const hasResolution = Boolean(ticket?.resolution);

  const latestResolutionHistory = useMemo(() => {
    const items = Array.isArray(ticket?.statusHistories) ? [...ticket.statusHistories] : [];
    const relevant = new Set([
      managementTypes.feedbackStatus.RESOLVED,
      managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL,
      managementTypes.feedbackStatus.APPROVED,
      managementTypes.feedbackStatus.CLOSED,
    ]);
    return items
      .filter((h) => relevant.has(h?.newStatus || h?.status))
      .sort((a, b) => new Date(b?.changedAt || 0) - new Date(a?.changedAt || 0))[0] || null;
  }, [ticket]);

  const resolutionDate = hasResolution
    ? (ticket?.resolution?.resolvedAt || latestResolutionHistory?.changedAt || null)
    : null;

  const resolutionSummary = hasResolution
    ? (ticket?.resolution?.resolutionSummary || ticket?.resolution?.summary || latestResolutionHistory?.note || '')
    : '';

  const processingDuration = useMemo(
    () => formatDuration(ticket?.createdAt, resolutionDate),
    [ticket, resolutionDate],
  );

  // ── Status/journey ──────────────────────────────────────────────────────────
  const journeyIndex = Math.max(
    0,
    JOURNEY_STEPS.findIndex((step) => step.statuses.includes(ticket?.status)),
  );

  const isCompleted = [
    managementTypes.feedbackStatus.APPROVED,
    managementTypes.feedbackStatus.CLOSED,
  ].includes(ticket?.status);

  const canSubmitReview = ticket?.status === managementTypes.feedbackStatus.APPROVED && hasResolution;
  const alreadyRated = ticket?.status === managementTypes.feedbackStatus.CLOSED;

  // ── Author / metadata ───────────────────────────────────────────────────────


  const locationText =
    ticket?.locationText ||
    ticket?.areaName ||
    ticket?.wardName ||
    'Chưa có thông tin địa điểm';

  const createdAt = ticket?.createdAt || ticket?.submittedAt;
  const operatorName = ticket?.assignment?.operatorName || ticket?.resolution?.operatorName || '';

  // ── Status label/tone for aside card ───────────────────────────────────────
  const statusLabel = isCompleted
    ? (alreadyRated ? 'Đã đóng' : 'Chờ đánh giá')
    : (ticket?.status === managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL
        ? 'Đang kiểm duyệt'
        : 'Đang xử lý');

  const statusTone = alreadyRated
    ? 'border-base-300 bg-base-200/55 text-base-content/65'
    : isCompleted
      ? 'border-success/25 bg-success/10 text-success'
      : 'border-warning/30 bg-warning/10 text-warning';

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading && !ticket) {
    return <ResultSkeleton />;
  }

  if (!ticket) {
    return (
      <ResultPageShell>
        <main className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] px-6 py-16 text-center shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
          <Lucide.FileWarning size={34} className="mx-auto text-base-content/35" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-bold">Không thể xem kết quả</h1>
          <p className="mt-2 text-sm text-base-content/55">
            {error || 'Chúng tôi không tìm thấy phản ánh này hoặc bạn chưa có quyền xem.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/tickets')}
            className="btn admin-primary-action mt-5 rounded-2xl"
          >
            Quay lại danh sách
          </button>
        </main>
      </ResultPageShell>
    );
  }

  return (
    <ResultPageShell>
      <main className="relative isolate space-y-4 text-[var(--public-title)]">
        {/* Page-level soft background */}
        <div
          className="pointer-events-none absolute -inset-x-3 -inset-y-4 -z-10 overflow-hidden rounded-[36px] border border-[var(--public-border-soft)] bg-[linear-gradient(180deg,var(--public-surface-soft),transparent)] sm:-inset-x-5 sm:-inset-y-5"
          aria-hidden="true"
        />

        {/* ── RESULT OVERVIEW ───────────────────────────────────────────── */}
        <article className="relative overflow-hidden rounded-[28px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_82%_0%,rgba(37,99,235,0.11),transparent_44%)]" aria-hidden="true" />

          <div className="relative p-5 sm:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <header className="min-w-0 max-w-4xl">
                <button
                  type="button"
                  onClick={() => navigate(`/tickets/${feedbackId}`)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3 text-sm font-semibold text-[var(--public-copy)] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  <Lucide.ArrowLeft size={15} aria-hidden="true" />
                  Quay lại chi tiết
                </button>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-600">
                    <Lucide.ClipboardCheck size={13} aria-hidden="true" />
                    Kết quả xử lý
                  </span>
                  {ticket.categoryName && (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3 text-xs font-semibold text-[var(--public-copy)]">
                      <Lucide.Tag size={13} aria-hidden="true" />
                      {getCategoryLabel(ticket.categoryName)}
                    </span>
                  )}
                  <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${statusTone}`}>
                    <Lucide.CircleCheck size={13} aria-hidden="true" />
                    {statusLabel}
                  </span>
                </div>

                <h1 className="mt-4 text-[2rem] font-bold leading-[1.12] tracking-[-0.025em] sm:text-[2.35rem]">
                  {ticket.title || 'Kết quả xử lý phản ánh'}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--public-copy)]">
                  {resolutionSummary || (hasResolution
                    ? 'Kết quả xử lý đã được cập nhật. Bạn có thể xem minh chứng và gửi đánh giá ở bên dưới.'
                    : 'Kết quả xử lý chưa sẵn sàng để hiển thị. Thông tin phản ánh của bạn vẫn được giữ nguyên.')}
                </p>
              </header>

              <aside className="w-full shrink-0 xl:w-[320px]">
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${statusTone}`}>
                      {alreadyRated
                        ? <Lucide.Archive size={18} aria-hidden="true" />
                        : <Lucide.CircleCheck size={18} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--public-muted)]">Trạng thái kết quả</p>
                      <p className="mt-1 text-base font-bold text-[var(--public-title)]">{statusLabel}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">
                        {alreadyRated
                          ? 'Phản ánh đã hoàn tất quy trình.'
                          : canSubmitReview
                            ? 'Kết quả đã được duyệt và đang chờ đánh giá của bạn.'
                            : hasResolution
                              ? 'Kết quả đang trong quá trình hoàn tất.'
                              : 'Chưa có kết quả xử lý công khai để đánh giá.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] px-3 py-2.5">
                      <p className="text-[10px] text-[var(--public-muted)]">Hoàn tất</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--public-title)]">{formatDate(resolutionDate)}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] px-3 py-2.5">
                      <p className="text-[10px] text-[var(--public-muted)]">Thời gian xử lý</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--public-title)]">{processingDuration}</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-6 grid gap-3 border-t border-[var(--public-border)] pt-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Lucide.MapPin size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--public-muted)]">Vị trí</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-[var(--public-title)]" title={locationText}>{locationText}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Lucide.CalendarDays size={16} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--public-muted)]">Ngày gửi</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--public-title)]">{formatDate(createdAt)}</p>
                </div>
              </div>

              {operatorName && (
                <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Lucide.Building2 size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--public-muted)]">Đơn vị xử lý</p>
                    <p className="mt-0.5 text-sm font-medium text-[var(--public-title)]">{operatorName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </article>

        {/* ── COMPACT PROGRESS ───────────────────────────────────────────── */}
        <section
          className="rounded-[22px] border border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] sm:px-6"
          aria-labelledby="result-progress-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="result-progress-title" className="text-sm font-bold">Tiến độ xử lý</h2>
              <p className="mt-0.5 text-xs text-[var(--public-muted)]">Theo dõi 4 mốc chính của phản ánh.</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              {isCompleted ? 'Đã hoàn tất' : `Bước ${journeyIndex + 1}/${JOURNEY_STEPS.length}`}
            </span>
          </div>

          <ol className="mt-5 grid gap-4 sm:grid-cols-4 sm:gap-0">
            {JOURNEY_STEPS.map((step, index) => {
              const completed = isCompleted ? true : index < journeyIndex;
              const active = !isCompleted && index === journeyIndex;
              const reached = completed || active;

              return (
                <li key={step.title} className="relative flex min-w-0 items-start gap-3 sm:block sm:text-center">
                  {index < JOURNEY_STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-[17px] hidden h-[2px] sm:block ${
                        completed ? 'bg-blue-500' : 'bg-[var(--public-border)]'
                      }`}
                    />
                  )}

                  <span
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:mx-auto ${
                      completed
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : active
                          ? 'border-blue-600 bg-white text-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.10)] dark:bg-base-100'
                          : 'border-[var(--public-border)] bg-[var(--public-surface-strong)] text-[var(--public-muted)]'
                    }`}
                  >
                    {completed ? (
                      <Lucide.Check size={16} strokeWidth={2.5} aria-hidden="true" />
                    ) : active ? (
                      <step.icon size={15} strokeWidth={2.3} aria-hidden="true" />
                    ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                    )}
                  </span>

                  <div className="min-w-0 sm:mt-2 sm:px-2">
                    <p className={`text-xs font-semibold ${reached ? 'text-[var(--public-title)]' : 'text-[var(--public-muted)]'}`}>
                      {step.title}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--public-muted)]">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ── SECTION 3: 2-COLUMN MAIN GRID ───────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] xl:items-stretch">

          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <div className="flex h-full flex-col gap-4">

            {/* Resolution Summary */}
            <section
              className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] sm:p-5"
              aria-labelledby="resolution-summary-title"
            >
              <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success" aria-hidden="true">
                  <Lucide.CheckCircle2 size={19} />
                </span>
                <div>
                  <h2 id="resolution-summary-title" className="text-lg font-bold">Kết quả xử lý</h2>
                  <p className="mt-0.5 text-xs text-base-content/55">Mô tả chính thức từ đơn vị phụ trách</p>
                </div>
              </header>

              {resolutionError && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.07] px-4 py-3 text-sm text-warning-content">
                  <Lucide.TriangleAlert size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                  <p className="leading-6 text-[var(--public-copy)]">{resolutionError}</p>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 py-4 sm:px-5">
                {resolutionSummary ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-base-content/75">
                    {resolutionSummary}
                  </p>
                ) : (
                  <p className="text-sm leading-7 text-base-content/55 italic">
                    {hasResolution
                      ? 'Đơn vị xử lý chưa cung cấp mô tả chi tiết cho kết quả này.'
                      : 'Chưa có kết quả xử lý công khai cho phản ánh này.'}
                  </p>
                )}
              </div>

              {operatorName && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] px-4 py-3">
                  <Lucide.Building2 size={16} className="shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--public-muted)]">Đơn vị xử lý</span>
                  <span className="ml-auto text-sm font-semibold text-[var(--public-title)]">{operatorName}</span>
                </div>
              )}
            </section>

            {/* Before / After Evidence */}
            <section
              className="flex flex-1 flex-col rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] sm:p-5"
              aria-labelledby="evidence-title"
            >
              <h2 id="evidence-title" className="text-lg font-bold">So sánh trước và sau</h2>
              <p className="mt-1 text-sm text-base-content/55">
                Hình ảnh giúp bạn thấy sự thay đổi thực tế sau khi đơn vị xử lý hoàn tất.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {/* Before */}
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-base-content/80">
                    <Lucide.ImagePlus size={15} className="text-rose-500" aria-hidden="true" />
                    Trước khi xử lý
                  </div>
                  {beforeImages[0] ? (
                    <div className="overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)]">
                      {isVideoUrl(beforeImages[0]) ? (
                        <video
                          controls
                          className="h-56 w-full object-cover sm:h-64"
                          src={beforeImages[0]}
                          aria-label="Video trước khi xử lý"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMediaViewer(beforeImages, 0)}
                          className="group relative block w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          aria-label="Mở lớn hình ảnh trước khi xử lý"
                        >
                          <img
                            src={beforeImages[0]}
                            alt="Hình ảnh trước khi xử lý"
                            className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.015] sm:h-64"
                            loading="eager"
                            fetchPriority="high"
                          />
                          <span className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950/65 px-3 text-xs font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                            <Lucide.Maximize2 size={14} aria-hidden="true" />
                            Xem lớn
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--public-border)] bg-[var(--public-surface-soft)] text-center sm:h-64">
                      <Lucide.ImageOff size={22} className="text-base-content/25" aria-hidden="true" />
                      <p className="text-xs text-base-content/45">Không có hình ảnh trước xử lý</p>
                    </div>
                  )}

                  {/* Additional before images */}
                  {beforeImages.length > 1 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {beforeImages.slice(1, 4).map((img, idx) => (
                        <button
                          key={`before-extra-${idx}`}
                          type="button"
                          onClick={() => openMediaViewer(beforeImages, idx + 1)}
                          className="cursor-zoom-in overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          aria-label={`Mở lớn hình ảnh trước ${idx + 2}`}
                        >
                          <img
                            src={img}
                            alt={`Hình ảnh trước ${idx + 2}`}
                            className="h-20 w-full object-cover transition hover:scale-[1.02]"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* After */}
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-base-content/80">
                    <Lucide.CheckCircle2 size={15} className="text-success" aria-hidden="true" />
                    Sau khi xử lý
                  </div>
                  {afterImages[0] ? (
                    <div className="overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)]">
                      {isVideoUrl(afterImages[0]) ? (
                        <video
                          controls
                          className="h-56 w-full object-cover sm:h-64"
                          src={afterImages[0]}
                          aria-label="Video sau khi xử lý"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMediaViewer(afterImages, 0)}
                          className="group relative block w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          aria-label="Mở lớn hình ảnh sau khi xử lý"
                        >
                          <img
                            src={afterImages[0]}
                            alt="Hình ảnh sau khi xử lý"
                            className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.015] sm:h-64"
                            loading="eager"
                          />
                          <span className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950/65 px-3 text-xs font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                            <Lucide.Maximize2 size={14} aria-hidden="true" />
                            Xem lớn
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--public-border)] bg-[var(--public-surface-soft)] text-center sm:h-64">
                      <Lucide.ImagePlus size={22} className="text-base-content/25" aria-hidden="true" />
                      <p className="text-xs font-semibold text-base-content/55">Chưa có minh chứng ảnh/video sau xử lý</p>
                      <p className="max-w-[220px] text-[11px] text-base-content/40 leading-4">
                        Đơn vị xử lý chưa cung cấp ảnh hoặc video hoàn tất cho kết quả này.
                      </p>
                    </div>
                  )}

                  {/* Additional after images */}
                  {afterImages.length > 1 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {afterImages.slice(1, 4).map((img, idx) => (
                        <button
                          key={`after-extra-${idx}`}
                          type="button"
                          onClick={() => openMediaViewer(afterImages, idx + 1)}
                          className="cursor-zoom-in overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          aria-label={`Mở lớn hình ảnh sau ${idx + 2}`}
                        >
                          <img
                            src={img}
                            alt={`Hình ảnh sau ${idx + 2}`}
                            className="h-20 w-full object-cover transition hover:scale-[1.02]"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div className="h-full">

            {/* Resident Rating */}
            <section
              className={`relative h-full overflow-hidden rounded-[24px] border bg-[var(--public-surface)] shadow-[0_14px_34px_rgba(15,23,42,0.07)] ${
                alreadyRated
                  ? 'border-[var(--public-border)]'
                  : canSubmitReview
                    ? 'border-blue-200'
                    : 'border-[var(--public-border)]'
              }`}
              aria-labelledby="rating-title"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_90%_0%,rgba(37,99,235,0.10),transparent_45%)]" aria-hidden="true" />
              <div className="relative p-4 sm:p-5">
                <header className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      alreadyRated ? 'bg-base-content/5 text-base-content/45' : 'bg-blue-100 text-blue-600'
                    }`}
                    aria-hidden="true"
                  >
                    <Lucide.Star size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--public-muted)]">Phản hồi của bạn</p>
                    <h2 id="rating-title" className="mt-1 text-lg font-bold">Đánh giá kết quả xử lý</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">
                      Đánh giá của bạn giúp cải thiện chất lượng xử lý phản ánh.
                    </p>
                  </div>
                </header>

                {canSubmitReview ? (
                  <form onSubmit={handleRateSubmit} className="mt-5 space-y-4">
                    <fieldset className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 py-4">
                      <legend className="px-1 text-xs font-semibold text-[var(--public-muted)]">Mức độ hài lòng</legend>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <label key={value} className="group flex flex-1 cursor-pointer justify-center">
                            <input
                              type="radio"
                              name="result-rating"
                              value={value}
                              checked={rating === value}
                              onChange={() => {
                                setRating(value);
                                if (value <= 2) setSatisfied(false);
                                else if (value >= 4) setSatisfied(true);
                                else setSatisfied(null);
                              }}
                              className="peer sr-only"
                              aria-label={`${value} sao`}
                            />
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:bg-warning/8 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300">
                              <Lucide.Star
                                size={28}
                                className={`transition ${
                                  rating >= value
                                    ? 'fill-warning text-warning'
                                    : 'text-base-content/18'
                                }`}
                                aria-hidden="true"
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 min-h-5 text-center">
                        <p className={`text-xs font-semibold ${rating > 0 ? 'text-warning' : 'text-[var(--public-muted)]'}`}>
                          {rating > 0 ? getRatingText(rating) : 'Chọn từ 1 đến 5 sao'}
                        </p>
                      </div>
                    </fieldset>

                    <fieldset className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] p-3.5">
                      <legend className="px-1 text-xs font-semibold text-[var(--public-muted)]">Bạn có hài lòng với kết quả không?</legend>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {[
                          { value: true, label: 'Hài lòng', icon: Lucide.ThumbsUp, tone: 'success' },
                          { value: false, label: 'Chưa hài lòng', icon: Lucide.ThumbsDown, tone: 'error' },
                        ].map((option) => {
                          const selected = satisfied === option.value;
                          const Icon = option.icon;
                          return (
                            <label
                              key={option.label}
                              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                                selected
                                  ? option.tone === 'success'
                                    ? 'border-success/30 bg-success/[0.07] text-success'
                                    : 'border-error/30 bg-error/[0.06] text-error'
                                  : 'border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-copy)] hover:border-blue-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name="result-satisfaction"
                                className="sr-only"
                                checked={selected}
                                onChange={() => setSatisfied(option.value)}
                              />
                              <Icon size={16} aria-hidden="true" />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <label className="block rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] p-3.5">
                      <span className="text-sm font-semibold">Ý kiến thêm</span>
                      <span className="mt-0.5 block text-[11px] text-[var(--public-muted)]">Không bắt buộc, nhưng sẽ hữu ích cho đơn vị xử lý.</span>
                      <textarea
                        rows="4"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Chia sẻ nhận xét về kết quả xử lý..."
                        className="textarea textarea-bordered mt-3 min-h-[104px] w-full resize-y rounded-xl border-[var(--public-border)] bg-[var(--public-surface)] text-sm focus:border-blue-400 focus:outline-none"
                      />
                    </label>

                    {reviewError && (
                      <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/20 bg-error/[0.055] px-3.5 py-3 text-xs leading-5 text-error">
                        <Lucide.CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{reviewError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={ratingLoading || rating < 1 || typeof satisfied !== 'boolean'}
                      className="btn admin-primary-action h-11 min-h-11 w-full rounded-xl disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {ratingLoading
                        ? <span className="loading loading-spinner loading-sm" />
                        : <Lucide.Send size={15} aria-hidden="true" />}
                      Gửi đánh giá
                    </button>
                  </form>
                ) : alreadyRated ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-success/20 bg-success/[0.055] px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                          <Lucide.CircleCheck size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Đánh giá đã được ghi nhận</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">Cảm ơn bạn đã phản hồi. Ý kiến của bạn giúp cải thiện chất lượng xử lý phản ánh.</p>
                        </div>
                      </div>
                    </div>

                    {submittedReview ? (
                      <div className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--public-muted)]">Đánh giá của bạn</p>
                            <div className="mt-2 flex items-center gap-1.5" aria-label={`${submittedReview.rating} trên 5 sao`}>
                              {[1, 2, 3, 4, 5].map((value) => (
                                <Lucide.Star
                                  key={value}
                                  size={21}
                                  className={value <= submittedReview.rating ? 'fill-warning text-warning' : 'text-base-content/15'}
                                  aria-hidden="true"
                                />
                              ))}
                              <span className="ml-1 text-sm font-bold text-[var(--public-title)]">{submittedReview.rating}/5</span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[var(--public-muted)]">{getRatingText(submittedReview.rating)}</p>
                          </div>

                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold ${
                            submittedReview.isSatisfied
                              ? 'border-success/25 bg-success/[0.07] text-success'
                              : 'border-error/25 bg-error/[0.055] text-error'
                          }`}>
                            {submittedReview.isSatisfied
                              ? <Lucide.ThumbsUp size={14} aria-hidden="true" />
                              : <Lucide.ThumbsDown size={14} aria-hidden="true" />}
                            {submittedReview.isSatisfied ? 'Hài lòng' : 'Chưa hài lòng'}
                          </span>
                        </div>

                        {submittedReview.comment?.trim() && (
                          <div className="mt-4 border-t border-[var(--public-border)] pt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--public-muted)]">Nhận xét</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--public-copy)]">“{submittedReview.comment.trim()}”</p>
                          </div>
                        )}

                        {submittedReview.createdAt && (
                          <div className="mt-4 flex items-center gap-2 border-t border-[var(--public-border)] pt-3 text-[11px] text-[var(--public-muted)]">
                            <Lucide.Clock3 size={13} aria-hidden="true" />
                            <span>Đã gửi {formatDate(submittedReview.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 py-4 text-xs leading-5 text-[var(--public-muted)]">
                        Phản ánh đã được đánh giá và đóng. Hệ thống hiện chưa trả lại chi tiết đánh giá cũ để hiển thị lại trên trang này.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 py-4 text-sm text-[var(--public-muted)]">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
                        <Lucide.Info size={16} aria-hidden="true" />
                      </span>
                      <p className="leading-6">
                        {ticket?.status === managementTypes.feedbackStatus.APPROVED && !hasResolution
                          ? 'Kết quả xử lý chưa sẵn sàng để hiển thị. Bạn chưa thể đánh giá lúc này.'
                          : 'Kết quả cần được phê duyệt trước khi bạn có thể gửi đánh giá.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </main>

      {mediaViewer && typeof document !== 'undefined' ? createPortal((() => {
        const currentUrl = mediaViewer.items[mediaViewer.index];
        const isVideo = isVideoUrl(currentUrl);
        return (
          <div
            className="fixed inset-0 z-[99990] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/95 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Xem minh chứng xử lý"
            onClick={() => setMediaViewer(null)}
          >
            <button
              type="button"
              onClick={() => setMediaViewer(null)}
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Đóng"
            >
              <Lucide.X size={22} />
            </button>

            {mediaViewer.items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); moveMediaViewer(-1); }}
                  className="absolute left-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
                  aria-label="Ảnh trước"
                >
                  <Lucide.ChevronLeft size={26} />
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); moveMediaViewer(1); }}
                  className="absolute right-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
                  aria-label="Ảnh tiếp theo"
                >
                  <Lucide.ChevronRight size={26} />
                </button>
              </>
            ) : null}

            <div className="flex max-h-full max-w-[min(1200px,92vw)] items-center justify-center" onClick={(event) => event.stopPropagation()}>
              {isVideo ? (
                <video src={currentUrl} controls autoPlay className="max-h-[88dvh] max-w-full rounded-2xl bg-black shadow-2xl" />
              ) : (
                <img src={currentUrl} alt="Minh chứng xử lý phóng to" className="max-h-[88dvh] max-w-full rounded-2xl object-contain shadow-2xl" />
              )}
            </div>

            {mediaViewer.items.length > 1 ? (
              <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                {mediaViewer.index + 1}/{mediaViewer.items.length}
              </span>
            ) : null}
          </div>
        );
      })(), document.body) : null}
    </ResultPageShell>
  );
};