import { useState, useEffect, useRef } from 'react';
import { ticketApi } from '../services/api/ticketApi';
import { signalrService } from '../services/socket/signalrService';
import { readTicketDetailCache, writeTicketDetailCache } from './ticketDetailCache';

const resolveRole = (r) => {
  if (!r) return undefined;
  const raw = String(r || '').toLowerCase();
  if (raw.includes('service-user') || raw.includes('serviceuser') || raw.includes('citizen') || raw.includes('user')) return 'service-user';
  if (raw.includes('service-provider') || raw.includes('serviceprovider') || raw.includes('operator')) return 'service-provider';
  if (raw.includes('system-staff') || raw.includes('systemstaff') || raw.includes('staff')) return 'system-staff';
  if (raw.includes('administrator') || raw.includes('admin')) return 'administrator';
  if (raw.includes('interaction-manager') || raw.includes('interactionmanager')) return 'interaction-manager';
  return undefined;
};

const getLatestResolution = (resolutions) => {
  if (!Array.isArray(resolutions) || resolutions.length === 0) return null;
  return [...resolutions]
    .filter(Boolean)
    .sort((a, b) => new Date(b?.resolvedAt || 0).getTime() - new Date(a?.resolvedAt || 0).getTime())[0] || null;
};

const attachLatestResolution = (ticketData, resolutions) => {
  if (!ticketData) return ticketData;
  const safeResolutions = Array.isArray(resolutions) ? resolutions.filter(Boolean) : [];
  const latestResolution = getLatestResolution(safeResolutions);
  return {
    ...ticketData,
    resolutions: safeResolutions,
    resolution: ticketData.resolution || latestResolution || null,
  };
};

const getRequestStatus = (error) => {
  const rawStatus = error?.status ?? error?.response?.status;
  const status = Number(rawStatus);
  const message = String(error?.message || '').toLowerCase();
  const notFoundMessage = (
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('không tìm thấy')
  );

  if (status === 400 && notFoundMessage) return 404;
  if (Number.isFinite(status) && status > 0) return status;

  if (notFoundMessage) return 404;

  if (
    error?.code === 'REFRESH_TOKEN_MISSING' ||
    error?.code === 'INVALID_REFRESH_RESPONSE'
  ) return 401;

  return null;
};

const getApiErrorMessage = (error, fallback) => {
  const payload = error?.response?.data;
  const candidates = [
    payload?.message,
    payload?.detail,
    payload?.title,
    error?.message,
  ];
  const message = candidates.find((value) => typeof value === 'string' && value.trim());
  return message?.trim() || fallback;
};


const REVIEW_CACHE_PREFIX = 'urbanmind:resident-resolution-review';

const getReviewCacheKey = (feedbackId, ownerId) =>
  `${REVIEW_CACHE_PREFIX}:${ownerId || 'anonymous'}:${feedbackId || ''}`;

const normalizeReview = (value) => {
  if (!value || typeof value !== 'object') return null;
  const rating = Number(value.rating ?? value.score ?? value.stars);
  const isSatisfied = value.isSatisfied ?? value.satisfied ?? value.isSatisfaction;
  const comment = value.comment ?? value.reviewComment ?? value.note ?? '';
  const createdAt = value.createdAt ?? value.reviewedAt ?? value.submittedAt ?? value.updatedAt ?? null;

  if (!Number.isFinite(rating) || rating < 1 || rating > 5 || typeof isSatisfied !== 'boolean') {
    return null;
  }

  return {
    ...value,
    rating,
    isSatisfied,
    comment: typeof comment === 'string' ? comment : String(comment ?? ''),
    createdAt,
  };
};

const getTicketReview = (ticketData) => {
  if (!ticketData || typeof ticketData !== 'object') return null;
  const candidates = [
    ticketData.review,
    ticketData.resolutionReview,
    ticketData.feedbackResolutionReview,
    Array.isArray(ticketData.reviews) ? ticketData.reviews[0] : null,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeReview(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const readReviewCache = (feedbackId, ownerId) => {
  if (typeof window === 'undefined' || !feedbackId) return null;
  try {
    return normalizeReview(JSON.parse(window.sessionStorage.getItem(getReviewCacheKey(feedbackId, ownerId)) || 'null'));
  } catch {
    return null;
  }
};

const writeReviewCache = (feedbackId, ownerId, review) => {
  if (typeof window === 'undefined' || !feedbackId) return;
  const normalized = normalizeReview(review);
  if (!normalized) return;
  try {
    window.sessionStorage.setItem(getReviewCacheKey(feedbackId, ownerId), JSON.stringify(normalized));
  } catch {
    // sessionStorage is only a convenience cache; ignore quota/privacy failures.
  }
};

const getResidentResolutions = async (feedbackId, role, skipResolutions) => {
  if (role !== 'service-user' || skipResolutions || !feedbackId) {
    return { resolutions: [], error: '' };
  }

  try {
    const resolutions = await ticketApi.getResolutions(feedbackId, { role });
    return { resolutions, error: '' };
  } catch (error) {
    const status = getRequestStatus(error);

    // A missing/not-yet-public resolution must never make the whole feedback
    // detail/result screen fail. 400/404 are treated as no public result yet.
    if (status === 400 || status === 404) {
      return { resolutions: [], error: '' };
    }

    console.error('Failed to load feedback resolutions', error);
    return {
      resolutions: [],
      error: 'Không thể tải kết quả xử lý lúc này. Thông tin phản ánh vẫn được giữ nguyên.',
    };
  }
};

export function useTicketDetail(feedbackId, user, detailFetcher, options = {}) {
  const interactionFeedbackId = Object.prototype.hasOwnProperty.call(options || {}, 'interactionFeedbackId')
    ? options.interactionFeedbackId
    : feedbackId;
  const skipResolutions = Boolean(options?.skipResolutions);
  const disableInteractions = Boolean(options?.disableInteractions);
  const cacheTicketDetails = Boolean(options?.cacheTicketDetails);
  const cacheOwnerId = user?.userId || user?.id || 'anonymous';
  const initialCache = cacheTicketDetails
    ? readTicketDetailCache(feedbackId, cacheOwnerId)
    : null;
  const [ticket, setTicket] = useState(() => initialCache?.ticket || null);
  const [comments, setComments] = useState(() => (
    Array.isArray(initialCache?.ticket?.comments) ? initialCache.ticket.comments.filter(Boolean) : []
  ));
  const [history, setHistory] = useState(() => (
    Array.isArray(initialCache?.ticket?.statusHistories) ? initialCache.ticket.statusHistories.filter(Boolean) : []
  ));
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(() => !initialCache?.ticket);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [errorFeedbackId, setErrorFeedbackId] = useState(null);
  const [resolutionError, setResolutionError] = useState(() => initialCache?.resolutionError || '');

  const [rating, setRating] = useState(0);
  const [satisfied, setSatisfied] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [submittedReview, setSubmittedReview] = useState(() => (
    getTicketReview(initialCache?.ticket) || readReviewCache(feedbackId, cacheOwnerId)
  ));

  const chatEndRef = useRef(null);
  const ticketRef = useRef(initialCache?.ticket || null);
  const cacheIdentityRef = useRef(`${cacheOwnerId}:${feedbackId || ''}`);

  useEffect(() => {
    let active = true;

    const nextCacheIdentity = `${cacheOwnerId}:${feedbackId || ''}`;
    if (cacheIdentityRef.current !== nextCacheIdentity) {
      const nextCache = cacheTicketDetails
        ? readTicketDetailCache(feedbackId, cacheOwnerId)
        : null;
      const nextTicket = nextCache?.ticket || null;

      cacheIdentityRef.current = nextCacheIdentity;
      ticketRef.current = nextTicket;
      setTicket(nextTicket);
      setComments(Array.isArray(nextTicket?.comments) ? nextTicket.comments.filter(Boolean) : []);
      setHistory(Array.isArray(nextTicket?.statusHistories) ? nextTicket.statusHistories.filter(Boolean) : []);
      setResolutionError(nextCache?.resolutionError || '');
      setSubmittedReview(getTicketReview(nextTicket) || readReviewCache(feedbackId, cacheOwnerId));
      setLoading(!nextTicket);
    }

    const fetchDetails = async ({ foreground = false } = {}) => {
      if (!active) return;

      setError('');
      setErrorStatus(null);
      setErrorFeedbackId(null);
      if (foreground || !ticketRef.current) setLoading(true);
      try {
        const role = resolveRole(user?.role);
        const ticketRequest = detailFetcher
          ? detailFetcher(feedbackId)
          : ticketApi.getTicketById(feedbackId, { role });
        const resolutionRequest = getResidentResolutions(
          interactionFeedbackId,
          role,
          skipResolutions,
        );
        const [resTicket, resolutionResult] = await Promise.all([ticketRequest, resolutionRequest]);
        const ticketData = attachLatestResolution(resTicket, resolutionResult.resolutions);
        if (!ticketData) throw new Error('Empty ticket data received');
        if (!active) return;

        setResolutionError(resolutionResult.error);
        ticketRef.current = ticketData;
        setTicket(ticketData);
        setComments(Array.isArray(ticketData.comments) ? ticketData.comments.filter(Boolean) : []);
        setHistory(Array.isArray(ticketData.statusHistories) ? ticketData.statusHistories.filter(Boolean) : []);
        const ticketReview = getTicketReview(ticketData);
        if (ticketReview) {
          setSubmittedReview(ticketReview);
          writeReviewCache(feedbackId, cacheOwnerId, ticketReview);
        }
        if (cacheTicketDetails) {
          writeTicketDetailCache(feedbackId, cacheOwnerId, ticketData, resolutionResult.error);
        }
      } catch (err) {
        if (!active) return;

        console.error('Failed to load ticket details', err);
        if (!ticketRef.current) {
          setErrorStatus(getRequestStatus(err));
          setErrorFeedbackId(feedbackId);
          setError('Unable to load feedback details.');
          setTicket(null);
          setComments([]);
          setHistory([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const load = async () => await fetchDetails();
    load();

    signalrService.start();
    const handleReceiveMessage = (incomingFeedbackId, comment) => {
      if (String(incomingFeedbackId) === String(interactionFeedbackId)) setComments((prev) => [...prev, comment]);
    };
    signalrService.on('ReceiveChatMessage', handleReceiveMessage);
    signalrService.on('CommentAdded', handleReceiveMessage);

    const handleStatusChange = async (incomingFeedbackId) => {
      if (String(incomingFeedbackId) === String(interactionFeedbackId)) {
        // refresh details to pick up status, history and related changes
        await fetchDetails();
      }
    };
    signalrService.on('FeedbackStatusChanged', handleStatusChange);
    signalrService.on('FeedbackStatusChangedNotificationReceived', handleStatusChange);

    const handleAssignment = async (incomingFeedbackId) => {
      if (String(incomingFeedbackId) === String(interactionFeedbackId)) {
        await fetchDetails();
      }
    };
    signalrService.on('AssignmentUpdated', handleAssignment);
    signalrService.on('AssignmentCreated', handleAssignment);

    const handleSupport = (incomingFeedbackId, payload) => {
      if (String(incomingFeedbackId) === String(interactionFeedbackId)) {
        setTicket((prev) => ({ ...(prev || {}), supportCount: payload?.supportCount ?? (prev?.supportCount || 0) }));
      }
    };
    signalrService.on('SupportAdded', handleSupport);

    const handleResolutionEvents = async (incomingFeedbackId) => {
      if (String(incomingFeedbackId) === String(interactionFeedbackId)) {
        await fetchDetails();
      }
    };
    signalrService.on('ResolutionSubmitted', handleResolutionEvents);
    signalrService.on('ResolutionApproved', handleResolutionEvents);
    signalrService.on('ResolutionRejected', handleResolutionEvents);

    return () => {
      active = false;
      signalrService.off('ReceiveChatMessage', handleReceiveMessage);
      signalrService.off('CommentAdded', handleReceiveMessage);
      signalrService.off('FeedbackStatusChanged', handleStatusChange);
      signalrService.off('FeedbackStatusChangedNotificationReceived', handleStatusChange);
      signalrService.off('AssignmentUpdated', handleAssignment);
      signalrService.off('AssignmentCreated', handleAssignment);
      signalrService.off('SupportAdded', handleSupport);
      signalrService.off('ResolutionSubmitted', handleResolutionEvents);
      signalrService.off('ResolutionApproved', handleResolutionEvents);
      signalrService.off('ResolutionRejected', handleResolutionEvents);
      signalrService.stop();
    };
  }, [cacheOwnerId, cacheTicketDetails, detailFetcher, feedbackId, interactionFeedbackId, skipResolutions, user?.id, user?.role, user?.userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendChat = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (disableInteractions || !interactionFeedbackId || !chatInput || !chatInput.trim()) return;
    const text = chatInput;
    setChatInput('');
    await signalrService.sendChatMessage(interactionFeedbackId, user, text);
    const role = (user && (String(user.role || '').toLowerCase().includes('staff') || String(user.role || '').toLowerCase().includes('service-provider'))) ? String(user.role) : undefined;
    const resHist = await ticketApi.getHistory(interactionFeedbackId, { role });
    setHistory(Array.isArray(resHist) ? resHist : []);
  };

  const handleRateSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setReviewError('');

    if (disableInteractions || !interactionFeedbackId) return false;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setReviewError('Vui lòng chọn từ 1 đến 5 sao trước khi gửi đánh giá.');
      return false;
    }

    if (typeof satisfied !== 'boolean') {
      setReviewError('Vui lòng cho biết bạn có hài lòng với kết quả xử lý hay không.');
      return false;
    }

    if ((rating <= 2 && satisfied) || (rating >= 4 && !satisfied)) {
      setReviewError('Số sao và mức độ hài lòng đang chưa nhất quán. Vui lòng kiểm tra lại.');
      return false;
    }

    setRatingLoading(true);
    try {
      const role = resolveRole(user?.role) || 'service-user';
      const reviewResponse = await ticketApi.submitReview(
        interactionFeedbackId,
        user?.userId || user?.id,
        rating,
        satisfied,
        reviewComment,
        { role },
      );
      const normalizedResponseReview = normalizeReview(
        reviewResponse?.data ?? reviewResponse?.result ?? reviewResponse,
      ) || {
        rating,
        isSatisfied: satisfied,
        comment: reviewComment.trim(),
        createdAt: new Date().toISOString(),
      };
      setSubmittedReview(normalizedResponseReview);
      writeReviewCache(feedbackId, cacheOwnerId, normalizedResponseReview);

      setError('');
      setErrorStatus(null);
      setErrorFeedbackId(null);
      setLoading(true);

      try {
        const resTicket = detailFetcher
          ? await detailFetcher(feedbackId)
          : await ticketApi.getTicketById(feedbackId, { role });
        const resolutionResult = await getResidentResolutions(
          interactionFeedbackId,
          role,
          skipResolutions,
        );
        const ticketData = attachLatestResolution(resTicket, resolutionResult.resolutions);
        if (!ticketData) throw new Error('Empty ticket data received');

        setResolutionError(resolutionResult.error);
        ticketRef.current = ticketData;
        setTicket(ticketData);
        setComments(Array.isArray(ticketData.comments) ? ticketData.comments.filter(Boolean) : []);
        setHistory(Array.isArray(ticketData.statusHistories) ? ticketData.statusHistories.filter(Boolean) : []);
        const ticketReview = getTicketReview(ticketData);
        if (ticketReview) {
          setSubmittedReview(ticketReview);
          writeReviewCache(feedbackId, cacheOwnerId, ticketReview);
        }
        if (cacheTicketDetails) {
          writeTicketDetailCache(feedbackId, cacheOwnerId, ticketData, resolutionResult.error);
        }
        return true;
      } catch (err) {
        console.error('Failed to refresh ticket after review', err);
        setReviewError('Đánh giá đã được gửi nhưng chưa thể làm mới trạng thái. Vui lòng tải lại trang.');
        return true;
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to submit feedback review', err);
      setReviewError(getApiErrorMessage(err, 'Không thể gửi đánh giá lúc này. Vui lòng thử lại.'));
      return false;
    } finally {
      setRatingLoading(false);
    }
  };

  const getAttachmentUrl = (file) => {
    try {
      if (!file) return '';
      if (typeof file === 'string') return file;
      if (typeof file === 'object') {
        if (file.url) return file.url;
        if (file.path) return file.path;
        if (file.fileUrl) return file.fileUrl;
        if (file.link) return file.link;
        if (file.attributes && (file.attributes.url || file.attributes.path)) {
          return file.attributes.url || file.attributes.path;
        }
        const id = file.id || file.attachmentId || file.fileId || file.uuid;
        if (id) return `/api/attachments/${id}`;
        return String(file);
      }
    } catch (e) {
      console.warn('getAttachmentUrl error', e, file);
    }
    return String(file);
  };

  return {
    ticket,
    comments,
    history,
    chatInput,
    setChatInput,
    loading,
    error,
    errorStatus,
    errorFeedbackId,
    resolutionError,
    chatEndRef,
    handleSendChat,
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
  };
}

export default useTicketDetail;
