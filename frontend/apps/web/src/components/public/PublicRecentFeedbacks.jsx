import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { STATUS_BADGE_CLASSES } from '@urbanmind/shared-types';
import { getAttachmentUrl } from '@urbanmind/shared-utils';
import {
  getCommunityIncidentId,
  getCommunityItemDescription,
  getCommunityItemTitle,
  getCommunityReportCount,
  getResidentStatusMeta,
} from '../community/communityPresentation.js';
const CATEGORY_LABELS = {
  'garbage collection': 'Thu gom rác',
  'waste management': 'Môi trường',
  'road maintenance': 'Hạ tầng giao thông',
  'street lighting': 'Chiếu sáng đô thị',
  drainage: 'Thoát nước',
  'water supply': 'Cấp nước',
  'public safety': 'An toàn công cộng',
};

const getCategoryName = (item) => {
  const rawCategory = item?.categoryName || item?.category?.name || 'Sự vụ đô thị';
  const normalizedCategory = String(rawCategory)
    .trim()
    .toLocaleLowerCase('en-US');

  return CATEGORY_LABELS[normalizedCategory] || rawCategory;
};

const getAreaName = (item) => (
  item?.areaName ||
  item?.wardName ||
  item?.districtName ||
  item?.locationText ||
  'Chưa xác định khu vực'
);

const getCreatedAt = (item) => item?.createdAt || item?.createdDate || item?.submittedAt;

const formatRelativeTime = (value) => {
  if (!value) return 'Vừa cập nhật';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Vừa cập nhật';

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'Vừa xong';
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} giờ trước`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays} ngày trước`;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
};

const getMediaCandidates = (item) => {
  const attachments = Array.isArray(item?.attachments)
    ? item.attachments
    : [];
  const fallbackMedia = [
    item?.imageUrl,
    item?.image,
    item?.coverImageUrl,
    item?.thumbnailUrl,
    item?.mediaUrl,
    item?.attachmentUrl,
  ].filter(Boolean);

  return attachments.length > 0 ? attachments : fallbackMedia;
};

const isVideoAttachment = (attachment) => {
  const rawValue = typeof attachment === 'string'
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
  const normalizedUrl = String(rawValue).toLowerCase().split('?')[0];

  return (
    mimeType.startsWith('video/') ||
    ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
      .some((extension) => normalizedUrl.endsWith(extension))
  );
};

const getCategoryVisual = (categoryName) => {
  const normalizedCategory = String(categoryName || '').toLowerCase();

  if (normalizedCategory.includes('rác') || normalizedCategory.includes('môi trường')) {
    return {
      icon: Lucide.Leaf,
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }

  if (normalizedCategory.includes('đèn') || normalizedCategory.includes('chiếu sáng')) {
    return {
      icon: Lucide.Lightbulb,
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    };
  }

  if (normalizedCategory.includes('nước') || normalizedCategory.includes('thoát')) {
    return {
      icon: Lucide.Droplets,
      className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
    };
  }

  return {
    icon: Lucide.Construction,
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  };
};

const FeedbackMedia = ({ item }) => {
  const [mediaFailed, setMediaFailed] = useState(false);
  const primaryAttachment = getMediaCandidates(item)[0];
  const mediaUrl = getAttachmentUrl(primaryAttachment);
  const categoryName = getCategoryName(item);
  const categoryVisual = getCategoryVisual(categoryName);
  const CategoryIcon = categoryVisual.icon;

  if (!mediaUrl || mediaFailed) {
    return (
      <div className={`relative flex h-full min-h-44 items-center justify-center overflow-hidden ${categoryVisual.className}`}>
        <svg
          viewBox="0 0 460 250"
          className="absolute inset-0 h-full w-full opacity-40"
          aria-hidden="true"
        >
          <path d="M-20 195C68 153 92 78 174 87C252 96 273 179 351 159C407 145 434 93 484 88" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M-12 218C70 190 113 136 192 144C270 153 302 214 382 190C421 178 451 151 480 135" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 9" />
          <circle cx="174" cy="87" r="7" fill="currentColor" />
          <circle cx="351" cy="159" r="8" fill="currentColor" />
        </svg>
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-current/10 bg-white/65 shadow-sm backdrop-blur dark:bg-slate-950/45">
          <CategoryIcon size={25} aria-hidden="true" />
        </span>
      </div>
    );
  }

  if (isVideoAttachment(primaryAttachment)) {
    return (
      <video
        src={mediaUrl}
        className="h-full min-h-44 w-full object-cover"
        muted
        playsInline
        preload="metadata"
        onError={() => setMediaFailed(true)}
      />
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={getCommunityItemTitle(item) || 'Hình ảnh sự vụ đô thị'}
      className="h-full min-h-44 w-full object-cover transition duration-500 group-hover:scale-[1.025]"
      loading="lazy"
      onError={() => setMediaFailed(true)}
    />
  );
};

const FeedbackCard = ({ item }) => {
  const incidentId = getCommunityIncidentId(item);
  const categoryName = getCategoryName(item);
  const statusValue = item?.incidentStatus || item?.status;
  const statusClasses = STATUS_BADGE_CLASSES[statusValue] || STATUS_BADGE_CLASSES.default;
  const statusMeta = getResidentStatusMeta(statusValue);
  const subscriberCount = Number(item?.subscriberCount || 0);
  const reportCount = getCommunityReportCount(item);

  return (
    <article className="public-feedback-card group flex min-h-full flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.055)] transition duration-300 hover:-translate-y-1 hover:border-blue-200">
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-slate-800">
        <FeedbackMedia item={item} />
        <span className={`absolute left-3 top-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur ${statusClasses}`}>
          {statusMeta.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-medium text-blue-700 dark:text-blue-300">
            {categoryName}
          </span>
          <time className="shrink-0 text-slate-400" dateTime={getCreatedAt(item)}>
            {formatRelativeTime(getCreatedAt(item))}
          </time>
        </div>

        <h3 className="public-feedback-title mt-3 line-clamp-2 text-[17px] font-semibold leading-6 tracking-[-0.015em] text-slate-900">
          {getCommunityItemTitle(item)}
        </h3>

        <p className="public-feedback-copy mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
          {getCommunityItemDescription(item) || 'Thông tin chi tiết đang được cập nhật trong bảng tin cộng đồng.'}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="public-feedback-meta inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <Lucide.MapPin size={14} className="shrink-0 text-blue-600" aria-hidden="true" />
            <span className="truncate">{getAreaName(item)}</span>
          </span>

          <span className="public-feedback-meta flex shrink-0 items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Lucide.Bell size={13} aria-hidden="true" />
              {subscriberCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Lucide.MessagesSquare size={13} aria-hidden="true" />
              {reportCount}
            </span>
          </span>
        </div>

        <Link
          to={incidentId ? `/community/feed/${incidentId}` : '/community/feed'}
          className="public-feedback-title mt-4 inline-flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-slate-700 transition group-hover:text-blue-700"
        >
          Xem chi tiết sự vụ
          <Lucide.ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
};

const FeedbackSkeleton = () => (
  <article className="public-feedback-card public-loading-surface overflow-hidden rounded-[22px] border border-slate-200 bg-white" aria-hidden="true">
    <div className="aspect-[16/9] animate-pulse bg-slate-200/80 dark:bg-slate-800" />
    <div className="space-y-4 p-5">
      <div className="flex justify-between gap-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
      <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
    </div>
  </article>
);

export const PublicRecentFeedbacks = ({
  items,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <FeedbackSkeleton key={item} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-feedback-card flex min-h-56 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <Lucide.CloudOff size={20} aria-hidden="true" />
        </span>
        <h3 className="public-feedback-title mt-4 text-base font-semibold text-slate-900">
          Chưa tải được dữ liệu công khai
        </h3>
        <p className="public-feedback-copy mt-2 max-w-md text-sm leading-6 text-slate-500">
          Bảng tin cộng đồng đang tạm thời chưa phản hồi. Bạn vẫn có thể mở bảng tin để thử lại.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <Lucide.RefreshCw size={15} aria-hidden="true" />
          Tải lại dữ liệu
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="public-feedback-card flex min-h-56 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white px-6 text-center">
        <Lucide.Inbox size={24} className="text-slate-400" aria-hidden="true" />
        <h3 className="public-feedback-title mt-3 text-base font-semibold text-slate-900">
          Chưa có sự vụ công khai gần đây
        </h3>
        <p className="public-feedback-copy mt-2 text-sm text-slate-500">
          Các sự vụ đủ điều kiện công khai sẽ xuất hiện tại đây.
        </p>
      </div>
    );
  }

  const responsiveGridClass = items.length >= 4
    ? 'xl:grid-cols-4'
    : items.length === 3
      ? 'xl:max-w-6xl xl:grid-cols-3'
      : 'xl:max-w-4xl xl:grid-cols-2';

  return (
    <div className={`mx-auto grid w-full gap-5 sm:grid-cols-2 ${responsiveGridClass}`}>
      {items.map((item) => (
        <FeedbackCard key={getCommunityIncidentId(item)} item={item} />
      ))}
    </div>
  );
};

export default PublicRecentFeedbacks;
