import { memo, useEffect, useState } from 'react';
import * as Lucide from 'lucide-react';
import { getAttachmentUrl } from '@urbanmind/shared-utils';
import SupportButton from './SupportButton.jsx';
import {
  getCommunityIncidentId,
  getCommunityItemContext,
  getCommunityItemDescription,
  getCommunityItemTitle,
  getResidentStatusMeta,
} from './communityPresentation.js';

const loadedMediaUrls = new Set();
const mediaKeepers = new Map();

const rememberLoadedMedia = (mediaUrl, mediaElement) => {
  if (!mediaUrl) return;

  loadedMediaUrls.add(mediaUrl);

  if (mediaKeepers.has(mediaUrl)) return;

  if (mediaElement?.cloneNode) {
    mediaKeepers.set(mediaUrl, mediaElement.cloneNode(false));
    return;
  }

  if (typeof Image !== 'undefined') {
    const keeper = new Image();
    keeper.src = mediaUrl;
    mediaKeepers.set(mediaUrl, keeper);
  }
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

const isVideoAttachment = (attachment) => {
  const raw = typeof attachment === 'string'
    ? attachment
    : (
        attachment?.fileUrl ||
        attachment?.url ||
        attachment?.path ||
        attachment?.attachmentUrl ||
        ''
      );
  const mimeType = String(
    attachment?.mimeType ||
    attachment?.contentType ||
    attachment?.fileType ||
    ''
  ).toLowerCase();
  const normalized = String(raw)
    .toLowerCase()
    .split('?')[0];

  return (
    mimeType.startsWith('video/') ||
    ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
      .some((extension) => normalized.endsWith(extension))
  );
};

const MediaTile = ({
  attachment,
  itemTitle,
  index,
  onOpen,
  priority = false,
  className = '',
}) => {
  const mediaUrl = getAttachmentUrl(attachment);
  const video = isVideoAttachment(attachment);
  const [mediaStatus, setMediaStatus] = useState(() => (
    mediaUrl
      ? (loadedMediaUrls.has(mediaUrl) ? 'ready' : 'loading')
      : 'error'
  ));

  useEffect(() => {
    setMediaStatus(
      mediaUrl
        ? (loadedMediaUrls.has(mediaUrl) ? 'ready' : 'loading')
        : 'error'
    );

    if (!mediaUrl || loadedMediaUrls.has(mediaUrl)) return undefined;

    const timeoutId = globalThis.setTimeout(() => {
      setMediaStatus((currentStatus) => (
        currentStatus === 'loading' ? 'error' : currentStatus
      ));
    }, 15000);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [mediaUrl]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group/media relative min-h-0 overflow-hidden bg-base-200 text-left ${className}`}
      aria-label={`Mở ${itemTitle || `minh chứng ${index + 1}`}`}
    >
      {mediaUrl ? (
        <>
          {video ? (
            <>
              <video
                src={mediaUrl}
                className={`h-full w-full object-cover transition-opacity duration-200 ${
                  mediaStatus === 'ready' ? 'opacity-100' : 'opacity-0'
                }`}
                muted
                playsInline
                preload="metadata"
                onLoadedData={(event) => {
                  rememberLoadedMedia(mediaUrl, event.currentTarget);
                  setMediaStatus('ready');
                }}
                onError={() => {
                  loadedMediaUrls.delete(mediaUrl);
                  mediaKeepers.delete(mediaUrl);
                  setMediaStatus('error');
                }}
              />
              {mediaStatus === 'ready' ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-white transition group-hover/media:bg-black/25">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 shadow-lg backdrop-blur">
                    <Lucide.Play
                      size={17}
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              ) : null}
            </>
          ) : (
            <img
              src={mediaUrl}
              alt={itemTitle || `Minh chứng ${index + 1}`}
              className={`h-full w-full object-cover transition duration-200 group-hover/media:scale-[1.012] ${
                mediaStatus === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              onLoad={(event) => {
                rememberLoadedMedia(mediaUrl, event.currentTarget);
                setMediaStatus('ready');
              }}
              onError={() => {
                loadedMediaUrls.delete(mediaUrl);
                mediaKeepers.delete(mediaUrl);
                setMediaStatus('error');
              }}
            />
          )}

          {mediaStatus === 'loading' ? (
            <span className="absolute inset-0 animate-pulse bg-base-300/55" aria-hidden="true">
              <span className="absolute inset-x-6 bottom-5 h-3 rounded-full bg-base-100/55" />
              <span className="absolute bottom-10 left-6 h-3 w-2/5 rounded-full bg-base-100/45" />
            </span>
          ) : null}

          {mediaStatus === 'error' ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base-200 px-4 text-center text-sm text-base-content/45">
              <Lucide.ImageOff size={19} aria-hidden="true" />
              Không thể hiển thị tệp
            </span>
          ) : null}
        </>
      ) : (
        <span className="flex h-full min-h-28 items-center justify-center text-sm text-base-content/40">
          Không thể hiển thị tệp
        </span>
      )}
    </button>
  );
};

const STATUS_PRESENTATION = {
  info: {
    className: 'border-blue-200/90 bg-blue-50/95 text-blue-700 dark:border-blue-400/30 dark:bg-slate-950/85 dark:text-blue-200',
    icon: Lucide.BadgeCheck,
  },
  secondary: {
    className: 'border-blue-200/90 bg-blue-50/95 text-blue-700 dark:border-blue-400/30 dark:bg-slate-950/85 dark:text-blue-200',
    icon: Lucide.Route,
  },
  warning: {
    className: 'border-amber-200/90 bg-amber-50/95 text-amber-800 dark:border-amber-400/30 dark:bg-slate-950/85 dark:text-amber-200',
    icon: Lucide.Clock3,
  },
  success: {
    className: 'border-emerald-200/90 bg-emerald-50/95 text-emerald-700 dark:border-emerald-400/30 dark:bg-slate-950/85 dark:text-emerald-200',
    icon: Lucide.CircleCheckBig,
  },
  neutral: {
    className: 'border-slate-200/90 bg-white/95 text-slate-700 dark:border-slate-500/40 dark:bg-slate-950/85 dark:text-slate-200',
    icon: Lucide.RefreshCw,
  },
};

const CommunityFeedItem = ({
  item,
  priority = false,
  highlighted = false,
  onOpen,
  onSupportChange,
}) => {
  const incidentId = getCommunityIncidentId(item);
  const itemTitle = getCommunityItemTitle(item);
  const itemDescription = getCommunityItemDescription(item);
  const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
  const fallbackAttachment = (
    item?.coverImageThumbnailUrl ||
    item?.coverImageUrl ||
    item?.thumbnailUrl ||
    item?.imageUrl ||
    item?.image ||
    item?.mediaUrl ||
    item?.attachmentUrl
  );
  const mediaItems = attachments.length > 0
    ? attachments
    : fallbackAttachment
      ? [fallbackAttachment]
      : [];
  const mediaState = item?.__mediaState || (
    mediaItems.length > 0
      ? 'ready'
      : Number(item?.attachmentCount || 0) > 0
        ? 'loading'
        : 'empty'
  );
  const context = getCommunityItemContext(item);
  const statusMeta = getResidentStatusMeta(item?.incidentStatus || item?.status);
  const statusPresentation = STATUS_PRESENTATION[statusMeta.tone] || STATUS_PRESENTATION.neutral;
  const StatusIcon = statusPresentation.icon;

  const renderMedia = () => {
    if (mediaState === 'loading') {
      return (
        <div className="h-52 animate-pulse overflow-hidden bg-base-200 sm:h-56 lg:h-[196px]" role="status" aria-label="Đang tải hình ảnh">
          <span className="sr-only">Đang tải hình ảnh</span>
        </div>
      );
    }

    if (mediaState === 'error') {
      return (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="flex h-52 w-full flex-col items-center justify-center gap-2 bg-base-200 px-4 text-center text-sm text-base-content/50 sm:h-56 lg:h-[196px]"
        >
          <Lucide.ImageOff size={22} className="text-base-content/35" aria-hidden="true" />
          <span className="font-semibold">Hình ảnh tạm thời chưa hiển thị</span>
          <span className="text-xs text-base-content/40">Mở chi tiết để xem lại</span>
        </button>
      );
    }

    if (mediaItems.length === 0) {
      return (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="flex h-48 w-full items-center justify-center gap-2 bg-[linear-gradient(135deg,var(--public-surface-soft),var(--public-surface-strong))] text-sm text-[var(--public-muted)] sm:h-52 lg:h-[196px]"
        >
          <Lucide.MapPinned size={19} aria-hidden="true" />
          Chưa có hình ảnh công khai
        </button>
      );
    }

    if (mediaItems.length === 1) {
      return (
        <div className="h-52 overflow-hidden bg-base-200 sm:h-56 lg:h-[196px]">
          <MediaTile
            attachment={mediaItems[0]}
            itemTitle={itemTitle}
            index={0}
            priority={priority}
            onOpen={() => onOpen(item)}
            className="h-full w-full"
          />
        </div>
      );
    }

    return (
      <div className="grid h-52 grid-cols-[minmax(0,1.7fr)_minmax(110px,0.7fr)] gap-1 bg-base-200 sm:h-56 lg:h-[196px]">
        <MediaTile
          attachment={mediaItems[0]}
          itemTitle={itemTitle}
          index={0}
          priority={priority}
          onOpen={() => onOpen(item)}
          className="h-full w-full"
        />
        <div className="grid min-h-0 grid-rows-2 gap-1">
          <MediaTile
            attachment={mediaItems[1]}
            itemTitle={itemTitle}
            index={1}
            onOpen={() => onOpen(item)}
            className="h-full w-full"
          />
          <div className="relative min-h-0 overflow-hidden">
            {mediaItems[2] ? (
              <MediaTile
                attachment={mediaItems[2]}
                itemTitle={itemTitle}
                index={2}
                onOpen={() => onOpen(item)}
                className="h-full w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex h-full w-full items-center justify-center bg-base-200 text-sm font-semibold text-base-content/45"
              >
                Xem chi tiết
              </button>
            )}
            {mediaItems.length > 3 ? (
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white backdrop-blur-[1px] transition hover:bg-black/65"
                aria-label={`Xem thêm ${mediaItems.length - 3} tệp`}
              >
                +{mediaItems.length - 3}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <article
      data-community-incident-id={incidentId}
      className={`group/feed-card relative overflow-hidden rounded-[18px] border bg-[var(--public-surface)] shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-300/70 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] ${
        highlighted ? 'border-blue-400/70 ring-2 ring-blue-200/70 dark:ring-blue-500/20' : 'border-[var(--public-border)]'
      }`}
    >
      <div className="pointer-events-none absolute right-4 top-4 z-20 hidden lg:block">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-[0_6px_18px_rgba(15,23,42,0.10)] backdrop-blur-md ${statusPresentation.className}`}>
          <StatusIcon size={12} aria-hidden="true" />
          {statusMeta.label}
        </span>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="relative min-h-0">
          {renderMedia()}
        </div>

        <div className="flex min-w-0 flex-col px-5 py-4 sm:px-5 sm:py-4">
          <div className="min-w-0 lg:pr-44">
            <div className="mb-2 flex justify-end lg:hidden">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-[0_4px_14px_rgba(15,23,42,0.08)] ${statusPresentation.className}`}>
                <StatusIcon size={12} aria-hidden="true" />
                {statusMeta.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--public-muted)]">
              <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-[var(--public-copy)]">
                <Lucide.MapPin size={13} className="shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <span className="truncate">{context.areaName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lucide.Clock3 size={12} aria-hidden="true" />
                {formatDateTime(item?.createdAt || item?.createdDate)}
              </span>
            </div>

            <button type="button" onClick={() => onOpen(item)} className="mt-1.5 block w-full text-left">
              <h2 className="text-[17px] font-bold leading-6 tracking-[-0.015em] text-[var(--public-title)] transition group-hover/feed-card:text-blue-600 dark:group-hover/feed-card:text-blue-300 sm:text-lg">
                {itemTitle}
              </h2>
            </button>

            {itemDescription ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[var(--public-copy)]">
                {itemDescription}
              </p>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {context.categoryName ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <Lucide.Tag size={12} aria-hidden="true" />
                  {context.categoryName}
                </span>
              ) : null}
              {context.reportCount > 1 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-300">
                  <Lucide.MessagesSquare size={12} aria-hidden="true" />
                  {context.reportCount} phản ánh liên quan
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--public-border-soft)] pt-2.5">
            <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-[var(--public-copy)]">
              <SupportButton
                incidentId={incidentId}
                initialCount={context.supportCount}
                initialSupported={Boolean(item?.isSupportedByCurrentUser)}
                entityLabel="sự vụ"
                className="h-8 rounded-lg border-transparent bg-transparent px-2 text-[var(--public-copy)] shadow-none hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                onChange={({ isSupported, count }) => onSupportChange?.(incidentId, { isSupported, count })}
              />
              <span className="inline-flex h-8 items-center gap-2 rounded-lg px-2" title="Số bình luận trên sự vụ">
                <Lucide.MessageCircle size={16} aria-hidden="true" />
                {context.commentCount} bình luận
              </span>
              <span className="inline-flex h-8 items-center gap-2 rounded-lg px-2" title="Số người đang theo dõi sự vụ">
                <Lucide.Bell size={16} aria-hidden="true" />
                {context.subscriberCount} theo dõi
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpen(item)}
              className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              Xem chi tiết
              <Lucide.ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default memo(CommunityFeedItem);
