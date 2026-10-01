import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { managementTypes } from '@urbanmind/shared-types';
import { getAdminFeedbackCategories, loadAdminFeedbackDetail, peekAdminFeedbackDetail } from '../../services/cache/adminFeedbackDetailCache';
import FeedbackLocationMapCard from '../../components/maps/FeedbackLocationMapCard';
import { useResolvedLocationText } from '../../hooks/useResolvedLocationText';
import { ManagerSectionHeader } from '../../components/manager/ManagerPageElements';

const ADMIN_FEEDBACK_RETURN_STORAGE_KEY = 'urbanmind-admin-feedback-return';

const getFeedbackListReturnUrl = () => {
  if (typeof window === 'undefined') return '/management/feedbacks';

  try {
    const raw = window.sessionStorage.getItem(ADMIN_FEEDBACK_RETURN_STORAGE_KEY);
    if (!raw) return '/management/feedbacks';

    const context = JSON.parse(raw);
    const params = new URLSearchParams();

    if (context?.statusFilter && context.statusFilter !== 'all') {
      params.set('status', context.statusFilter);
    } else if (context?.metricFilter && context.metricFilter !== 'total') {
      params.set('metric', context.metricFilter);
    }
    if (String(context?.searchTerm || '').trim()) {
      params.set('search', String(context.searchTerm).trim());
    }
    if (context?.categoryFilter && context.categoryFilter !== 'all') {
      params.set('category', String(context.categoryFilter));
    }
    if (context?.locationFilter && context.locationFilter !== 'all') {
      params.set('locationFilter', String(context.locationFilter));
    }
    if (Number(context?.pageNumber) > 1) {
      params.set('page', String(context.pageNumber));
    }

    const query = params.toString();
    return query ? `/management/feedbacks?${query}` : '/management/feedbacks';
  } catch {
    return '/management/feedbacks';
  }
};

const STATUS_META = {
  [managementTypes.feedbackStatus.SUBMITTED]: { label: 'Mới gửi', className: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/20' },
  [managementTypes.feedbackStatus.AI_REVIEWED]: { label: 'AI đã phân loại', className: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20' },
  [managementTypes.feedbackStatus.VERIFIED]: { label: 'Đã xác minh', className: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20' },
  [managementTypes.feedbackStatus.ASSIGNED]: { label: 'Đã phân công', className: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20' },
  [managementTypes.feedbackStatus.IN_PROGRESS]: { label: 'Đang xử lý', className: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/20' },
  [managementTypes.feedbackStatus.RESOLVED]: { label: 'Đã xử lý', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20' },
  [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: { label: 'Chờ nghiệm thu', className: 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/20' },
  [managementTypes.feedbackStatus.APPROVED]: { label: 'Đã duyệt', className: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/20' },
  [managementTypes.feedbackStatus.NEED_REWORK]: { label: 'Cần xử lý lại', className: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20' },
  [managementTypes.feedbackStatus.REJECTED]: { label: 'Đã từ chối', className: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20' },
  [managementTypes.feedbackStatus.CANCELLED]: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
  [managementTypes.feedbackStatus.CLOSED]: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
};

const PRIORITY_META = {
  Urgent: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20' },
  Critical: { label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20' },
  High: { label: 'Cao', className: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/20' },
  Medium: { label: 'Trung bình', className: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20' },
  Low: { label: 'Thấp', className: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
};

const CATEGORY_TRANSLATIONS = {
  'street lighting': 'Chiếu sáng công cộng',
  lighting: 'Chiếu sáng công cộng',
  'road damage': 'Hư hỏng đường bộ',
  roads: 'Đường bộ',
  sanitation: 'Vệ sinh môi trường',
  waste: 'Rác thải',
  drainage: 'Thoát nước',
  traffic: 'Giao thông',
};

const normalizeResponse = (response) => response?.data || response?.item || response?.result || response?.record || response;

const formatFeedbackId = (feedbackId) => {
  if (!feedbackId) return '—';
  const value = String(feedbackId);
  const suffix = value.split('-').pop();
  return suffix ? `UM-${suffix.slice(0, 8).toUpperCase()}` : value;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const localizeCategoryName = (value) => {
  if (!value) return 'Chưa phân loại';
  return CATEGORY_TRANSLATIONS[String(value).trim().toLowerCase()] || value;
};

const getCategoryName = (feedback, categories) => {
  const value = feedback?.categoryName
    || categories.find((item) => String(item.categoryId) === String(feedback?.categoryId))?.categoryName;
  return localizeCategoryName(value);
};

const getReporter = (feedback) => feedback?.userName || feedback?.reporterName || feedback?.citizenName || feedback?.createdBy || feedback?.email || 'Chưa có thông tin';

const getSubmissionChannel = (feedback) => feedback?.submissionChannel || feedback?.sourceChannel || feedback?.channel || feedback?.source || '';

const formatConfidence = (feedback) => {
  const raw = feedback?.confidence ?? feedback?.confidenceScore ?? feedback?.aiConfidence;
  if (raw === undefined || raw === null || raw === '') return '';
  const value = Number(raw);
  if (!Number.isFinite(value)) return String(raw);
  const percent = value <= 1 ? value * 100 : value;
  return `${Math.round(percent)}%`;
};

const normalizeAttachment = (file) => {
  if (!file) return null;
  if (typeof file === 'string') return { id: file, url: file, name: file.split('/').pop() || 'Tệp đính kèm', mimeType: '' };
  const url = file.fileUrl || file.url || file.path || file.attachmentUrl || file.mediaUrl || file.publicUrl || file.downloadUrl || '';
  if (!url) return null;
  return {
    id: file.attachmentId || file.feedbackAttachmentId || file.fileId || file.id || url,
    url: url.startsWith('http') || url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:') ? url : `/${url}`,
    name: file.fileName || file.name || file.originalName || url.split('/').pop() || 'Tệp đính kèm',
    mimeType: file.mimeType || file.contentType || file.type || '',
  };
};

const getAttachments = (feedback) => [
  feedback?.attachments,
  feedback?.feedbackAttachments,
  feedback?.files,
  feedback?.media,
  feedback?.medias,
  feedback?.mediaFiles,
  feedback?.uploadedFiles,
  feedback?.evidenceFiles,
  feedback?.images,
  feedback?.videos,
  feedback?.attachmentUrls,
  feedback?.mediaUrls,
].filter(Array.isArray).flat().map(normalizeAttachment).filter(Boolean);

const isVideo = (file) => /video\/|\.mp4|\.webm|\.mov|\.m4v|\.ogg/i.test(`${file?.mimeType || ''} ${file?.url || ''}`);

const Badge = ({ type, value }) => {
  const meta = type === 'status'
    ? STATUS_META[value] || { label: value || 'Chưa rõ', className: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' }
    : PRIORITY_META[value] || PRIORITY_META.Medium;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.className}`}>{meta.label}</span>;
};

const InfoItem = ({ label, value, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
    <div className="mt-2 min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{children ?? value ?? '—'}</div>
  </div>
);

export const FeedbackDetailPage = () => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialCachedDetail] = useState(() => peekAdminFeedbackDetail(feedbackId));
  const [feedback, setFeedback] = useState(() => {
    const initialFeedback = {
      ...(location.state?.feedback || {}),
      ...(normalizeResponse(initialCachedDetail) || {}),
    };
    return Object.keys(initialFeedback).length > 0 ? initialFeedback : null;
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(() => !initialCachedDetail);
  const [detailResolved, setDetailResolved] = useState(() => Boolean(initialCachedDetail));
  const [error, setError] = useState('');
  const [activeMedia, setActiveMedia] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [failedMedia, setFailedMedia] = useState(() => new Set());
  const [reloadNonce, setReloadNonce] = useState(0);
  const detailRequestIdRef = useRef(0);
  const resolvedLocationText = useResolvedLocationText({
    locationText: feedback?.locationText || feedback?.address,
    areaName: feedback?.areaName || feedback?.wardName,
    latitude: feedback?.latitude,
    longitude: feedback?.longitude,
  });

  useEffect(() => {
    let mounted = true;
    const requestId = ++detailRequestIdRef.current;

    const isLatestRequest = () => mounted && requestId === detailRequestIdRef.current;

    const loadDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const detailResponse = await loadAdminFeedbackDetail(feedbackId, {
          force: reloadNonce > 0,
        });
        if (!isLatestRequest()) return;
        setFeedback((current) => ({
          ...(current || {}),
          ...(normalizeResponse(detailResponse) || {}),
        }));
        setDetailResolved(true);
      } catch (err) {
        if (!isLatestRequest()) return;
        const status = Number(err?.status ?? err?.response?.status);
        if (status === 400 || status === 404) {
          setFeedback(null);
          setDetailResolved(false);
        }
        setError(err?.message || 'Không thể tải chi tiết phản ánh.');
      } finally {
        if (isLatestRequest()) setLoading(false);
      }
    };

    const loadCategories = async () => {
      try {
        const categoryResponse = await getAdminFeedbackCategories();
        if (mounted) setCategories(categoryResponse);
      } catch {
        if (mounted) setCategories([]);
      }
    };

    void loadDetail();
    void loadCategories();

    return () => { mounted = false; };
  }, [feedbackId, reloadNonce]);

  const attachments = useMemo(() => getAttachments(feedback), [feedback]);
  const mediaLoading = loading && !detailResolved && attachments.length === 0;
  const safeActiveIndex = Math.min(activeMedia, Math.max(attachments.length - 1, 0));
  const activePreview = previewIndex === null ? null : attachments[previewIndex];
  const activePreviewIsVideo = isVideo(activePreview);

  const movePreview = (direction) => {
    if (attachments.length < 2) return;
    setPreviewIndex((current) => {
      const safeCurrent = Number.isInteger(current) ? current : 0;
      return (safeCurrent + direction + attachments.length) % attachments.length;
    });
  };
  const latitude = feedback?.latitude ?? feedback?.lat ?? feedback?.location?.latitude ?? feedback?.location?.lat;
  const longitude = feedback?.longitude ?? feedback?.lng ?? feedback?.location?.longitude ?? feedback?.location?.lng;

  useEffect(() => {
    setActiveMedia(0);
    setPreviewIndex(null);
    setFailedMedia(new Set());
  }, [feedbackId]);

  useEffect(() => {
    if (previewIndex === null) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPreviewIndex(null);
      if (event.key === 'ArrowLeft') {
        setPreviewIndex((current) => (current - 1 + attachments.length) % attachments.length);
      }
      if (event.key === 'ArrowRight') {
        setPreviewIndex((current) => (current + 1) % attachments.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewIndex, attachments.length]);

  const returnPath = location.state?.from;
  const returnMapState = location.state?.mapState;
  const isManagerContext = location.pathname.startsWith('/manager/') || returnPath?.startsWith('/manager/');
  const feedbackMapPath = isManagerContext ? '/manager/map' : '/management/map';

  const goBack = () => {
    if (returnPath === '/management/map' || returnPath === '/manager/map') {
      navigate(returnPath, {
        state: { mapState: returnMapState },
      });
      return;
    }

    if (returnPath?.startsWith('/manager/interactions')) {
      navigate(returnPath, {
        state: {
          restoreFeedbackId: feedbackId,
          preserveScrollOnEnter: true,
        },
      });
      return;
    }

    if (returnPath === '/dashboard') {
      navigate('/dashboard');
      return;
    }

    navigate(getFeedbackListReturnUrl(), {
      state: {
        restoreFeedbackId: feedbackId,
        preserveScrollOnEnter: true,
      },
    });
  };

  const markMediaFailed = (file) => {
    setFailedMedia((current) => {
      const next = new Set(current);
      next.add(file?.id || file?.url);
      return next;
    });
  };

  if (loading && !feedback) {
    return (
      <div className="admin-page-shell space-y-5 pb-4" aria-busy="true" aria-label="Đang tải chi tiết phản ánh">
        <div className="h-10 w-44 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
        <div className="admin-page-hero animate-pulse">
          <div className="h-4 w-52 rounded-full bg-slate-200 dark:bg-white/10" />
          <div className="mt-4 h-9 w-3/4 max-w-3xl rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="mt-5 flex gap-4">
            <div className="h-4 w-56 rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="h-4 w-40 rounded-full bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="space-y-5">
            <div className="admin-panel h-52 animate-pulse bg-slate-100 dark:bg-white/[0.04]" />
            <div className="admin-panel h-[420px] animate-pulse bg-slate-100 dark:bg-white/[0.04]" />
            <div className="admin-panel h-72 animate-pulse bg-slate-100 dark:bg-white/[0.04]" />
          </div>
          <div className="admin-panel h-80 animate-pulse bg-slate-100 dark:bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (error && !feedback) {
    return (
      <div className="admin-page-shell">
        <div className="admin-panel mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Lucide.CircleAlert size={24} /></span>
          <h1 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Không thể mở phản ánh</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => setReloadNonce((value) => value + 1)} className="btn admin-primary-action h-10 rounded-xl px-5 text-sm font-semibold normal-case">
              <Lucide.RefreshCw size={16} />
              Thử tải lại
            </button>
            <button type="button" onClick={goBack} className="btn admin-secondary-action h-10 rounded-xl px-5 text-sm font-semibold normal-case">{returnPath === '/management/map' || returnPath === '/manager/map' ? 'Quay lại bản đồ' : returnPath === '/dashboard' ? 'Quay lại tổng quan' : 'Quay lại danh sách'}</button>
          </div>
        </div>
      </div>
    );
  }

  const title = feedback?.title || 'Phản ánh không có tiêu đề';
  const description = feedback?.description || feedback?.content || 'Chưa có nội dung chi tiết.';

  return (
    <div className="admin-page-shell manager-ui-page space-y-5 pb-4">
      <button type="button" onClick={goBack} className="admin-secondary-link inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold transition">
        <Lucide.ArrowLeft size={16} />
        {returnPath === '/management/map' || returnPath === '/manager/map' ? 'Quay lại bản đồ' : returnPath === '/dashboard' ? 'Quay lại tổng quan' : 'Quay lại danh sách'}
      </button>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          <Lucide.TriangleAlert className="mt-0.5 shrink-0" size={17} />
          <p>Không thể cập nhật dữ liệu mới nhất. Trang đang hiển thị thông tin đã tải trước đó.</p>
        </div>
      ) : null}

      <section className="incident-detail-hero admin-page-hero overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Lucide.MessageSquareText size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">{formatFeedbackId(feedbackId)}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem] dark:text-white">{title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex min-w-0 items-center gap-1.5"><Lucide.MapPin size={14} />{resolvedLocationText}</span>
                <span className="inline-flex items-center gap-1.5"><Lucide.Clock3 size={14} />{formatDateTime(feedback?.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {loading ? <span className="loading loading-spinner loading-xs text-blue-600" aria-label="Đang cập nhật" /> : null}
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><span>Trạng thái:</span><Badge type="status" value={feedback?.status} /></div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><span>Ưu tiên:</span><Badge type="priority" value={feedback?.priority} /></div>
            <button type="button" onClick={() => setReloadNonce((value) => value + 1)} disabled={loading} className="btn admin-secondary-action ml-0 h-9 rounded-xl px-3 text-xs font-semibold normal-case lg:ml-1">
              <Lucide.RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />Làm mới
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoItem label="Danh mục" value={getCategoryName(feedback, categories)} />
        <InfoItem label="Người gửi" value={getReporter(feedback)} />
        <InfoItem label="Ngày tiếp nhận" value={formatDateTime(feedback?.createdAt)} />
        <InfoItem label="Cập nhật gần nhất" value={formatDateTime(feedback?.updatedAt || feedback?.updatedDate)} />
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
        <ManagerSectionHeader id="feedback-information-title" title="Thông tin phản ánh" description="Thông tin người dân cung cấp và dữ liệu tiếp nhận hiện tại." icon={Lucide.FileText} />
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
            <InfoItem label="Phường / khu vực" value={feedback?.areaName || feedback?.wardName || 'Chưa xác định'} />
            <InfoItem label="Danh mục" value={getCategoryName(feedback, categories)} />
            {getSubmissionChannel(feedback) ? <InfoItem label="Kênh gửi" value={getSubmissionChannel(feedback)} /> : null}
            {formatConfidence(feedback) ? <InfoItem label="Độ tin cậy" value={formatConfidence(feedback)} /> : null}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Nội dung phản ánh</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-300">{description}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <FeedbackLocationMapCard
          feedbackId={feedbackId}
          latitude={latitude}
          longitude={longitude}
          locationText={resolvedLocationText}
          areaName={feedback?.areaName || feedback?.wardName}
          variant="admin"
          internalMapPath={feedbackMapPath}
        />

        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950">
          <ManagerSectionHeader
            id="feedback-evidence-title"
            title="Hình ảnh và video"
            description={mediaLoading ? 'Đang tải tệp đính kèm…' : attachments.length ? `${attachments.length} tệp đính kèm` : 'Không có tệp đính kèm'}
            icon={Lucide.Images}
            actions={attachments.length > 1 ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">{safeActiveIndex + 1}/{attachments.length}</span> : null}
          />
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
            {mediaLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Đang tải hình ảnh và video">
                {Array.from({ length: 3 }, (_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />)}
              </div>
            ) : attachments.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachments.map((file, index) => {
                  const failed = failedMedia.has(file.id || file.url);
                  return (
                    <button key={file.id || `${file.url}-${index}`} type="button" onClick={() => setPreviewIndex(index)} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950">
                        {failed ? <Lucide.ImageOff className="m-auto h-full text-slate-400" size={26} /> : isVideo(file) ? <><video src={file.url} preload="metadata" onError={() => markMediaFailed(file)} className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-slate-950/25 text-white"><Lucide.PlayCircle size={26} /></span></> : <img src={file.url} alt={file.name || `Minh chứng ${index + 1}`} loading="lazy" onError={() => markMediaFailed(file)} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />}
                      </div>
                      <div className="px-3 py-2"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{file.name || `Minh chứng ${index + 1}`}</p></div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-800 dark:bg-slate-900/60">
                <div><Lucide.ImageOff size={26} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa có hình ảnh hoặc video</p><p className="mt-1 text-xs text-slate-400">Phản ánh này không kèm theo tệp minh chứng.</p></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {activePreview && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black"
              role="dialog"
              aria-modal="true"
              aria-label={`Xem tệp đính kèm ${previewIndex + 1}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setPreviewIndex(null);
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent px-4 pb-16 pt-4 sm:px-6">
                <p className="text-sm font-semibold text-white">Minh chứng phản ánh</p>
                <p className="mt-1 text-xs text-white/65">{previewIndex + 1} / {attachments.length}</p>
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
                {activePreviewIsVideo ? (
                  <video
                    key={activePreview.url}
                    src={activePreview.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full object-contain"
                  >
                    Trình duyệt của bạn không hỗ trợ phát video.
                  </video>
                ) : (
                  <img
                    src={activePreview.url}
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
    </div>
  );
};

export default FeedbackDetailPage;
