import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { duplicateManagementApi, managementFeedbackApi } from '@urbanmind/shared-api';
import Badge from '../../components/design-system/Badge';
import { getBadgeIntent } from '../../components/design-system/badgeSemantics';
import * as Lucide from 'lucide-react';
import {
  ManagerConfirmDialog,
  ManagerPageHeader,
  ManagerToast,
} from '../../components/manager/ManagerPageElements';
import {
  extractImageUrls,
  getDuplicateCandidateDecisionState,
  normalizeDuplicateCandidatePayload,
  resolveDuplicateCandidateId,
} from './duplicateDetailUtils';
import { getScopedSessionKey } from '../../utils/scopedSessionKey';

// formatDate removed from this file; other pages use their own helpers

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTextValue = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return fallback;
};

const isMissingValue = (value) => {
  const text = String(value ?? '').trim();
  return !text || text === '—' || text === 'Không có mô tả' || text === 'Không có tiêu đề';
};

const localizePriority = (value) => {
  const key = String(value || '').trim().toLowerCase();
  const labels = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: 'Khẩn cấp',
    critical: 'Khẩn cấp',
  };
  return labels[key] || getTextValue(value, '—');
};


const compareExact = (a, b) => {
  if (isMissingValue(a) || isMissingValue(b)) return 'missing';
  return a === b ? 'same' : 'neutral';
};

const getImageSources = (feedback = {}) => extractImageUrls(feedback || {});

const isValidCoordinates = (coords) => (
  Array.isArray(coords)
  && coords.length >= 2
  && Number.isFinite(Number(coords[0]))
  && Number.isFinite(Number(coords[1]))
  && Number(coords[0]) >= -90
  && Number(coords[0]) <= 90
  && Number(coords[1]) >= -180
  && Number(coords[1]) <= 180
);

const parseCoordinates = (value, { geoJson = false } = {}) => {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 2) {
    const coords = geoJson
      ? [Number(value[1]), Number(value[0])]
      : [Number(value[0]), Number(value[1])];
    return isValidCoordinates(coords) ? coords : null;
  }

  if (typeof value === 'object') {
    const lat = value?.latitude ?? value?.lat;
    const lng = value?.longitude ?? value?.lng ?? value?.lon;
    if (lat != null && lng != null) {
      const coords = [Number(lat), Number(lng)];
      return isValidCoordinates(coords) ? coords : null;
    }

    if (Array.isArray(value?.coordinates) && value.coordinates.length >= 2) {
      return parseCoordinates(value.coordinates, { geoJson });
    }
  }

  if (typeof value === 'string') {
    const matches = value.match(/-?\d+(?:\.\d+)?/g);
    if (matches && matches.length >= 2) {
      const coords = [Number(matches[0]), Number(matches[1])];
      return isValidCoordinates(coords) ? coords : null;
    }
  }

  return null;
};

const getFeedbackCoordinates = (feedback = {}) => {
  const namedPairs = [
    [feedback?.latitude ?? feedback?.lat, feedback?.longitude ?? feedback?.lng ?? feedback?.lon],
    [
      feedback?.location?.latitude ?? feedback?.location?.lat,
      feedback?.location?.longitude ?? feedback?.location?.lng ?? feedback?.location?.lon,
    ],
  ];

  for (const [lat, lng] of namedPairs) {
    if (lat == null || lng == null) continue;
    const coords = [Number(lat), Number(lng)];
    if (isValidCoordinates(coords)) return coords;
  }

  for (const candidate of [
    feedback?.coordinates,
    feedback?.locationCoordinates,
    feedback?.geo,
  ]) {
    const coords = parseCoordinates(candidate);
    if (coords) return coords;
  }

  const geoJsonCoordinates =
    feedback?.geometry?.coordinates
    ?? feedback?.location?.geometry?.coordinates
    ?? feedback?.geoJson?.coordinates;
  const geoJsonCoords = parseCoordinates(geoJsonCoordinates, { geoJson: true });
  if (geoJsonCoords) return geoJsonCoords;

  return parseCoordinates(feedback?.locationText);
};

const getFeedbackLocationText = (feedback = {}) => {
  const candidates = [
    feedback?.locationText,
    feedback?.address,
    feedback?.locationName,
    typeof feedback?.location === 'string' ? feedback.location : null,
    feedback?.location?.address,
    feedback?.location?.name,
    feedback?.areaName,
    feedback?.area?.name,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '—';
};

const formatCoordinates = (coords) => {
  if (!isValidCoordinates(coords)) return '—';
  return `${Number(coords[0]).toFixed(5)}, ${Number(coords[1]).toFixed(5)}`;
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

const getDistanceKm = (coordsA, coordsB) => {
  if (!coordsA || !coordsB) return Infinity;
  const [lat1, lon1] = coordsA;
  const [lat2, lon2] = coordsB;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getStatusClass = (s) => {
  if (!s) return 'border-slate-200 bg-slate-50 text-slate-700';
  const key = String(s).trim().toLowerCase();
  switch (key) {
    case 'pending':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

const getNormalizedConfidence = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return score > 1 ? score : score * 100;
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'Pending':
      return 'Chờ xử lý';
    case 'Confirmed':
      return 'Đã xác nhận trùng';
    case 'Rejected':
      return 'Không trùng';
    default:
      return status || 'Không xác định';
  }
};

const getRecommendationText = (confidence) => {
  if (confidence === null) return 'Cần phân tích thêm';
  if (confidence >= 90) return 'Độ tin cậy cao';
  if (confidence >= 75) return 'Khả năng trùng';
  return 'Cần kiểm tra cẩn thận';
};

const TOO_LATE_FOR_DUPLICATE_CONFIRM_STATUSES = new Set([
  'assigned',
  'inprogress',
  'resolved',
  'submittedforapproval',
  'approved',
  'needrework',
  'closed',
  'cancelled',
  'merged',
]);

const localizeDuplicateActionError = (message, fallback) => {
  const text = String(message || '').trim();
  if (!text) return fallback;

  const normalized = text.toLowerCase();
  if (normalized.includes('duplicate reports can only be merged before staff assignment and provider processing')) {
    return 'Không thể xác nhận trùng vì sự vụ đã được phân công nhân viên hoặc đã bắt đầu xử lý với đơn vị cung cấp dịch vụ.';
  }
  if (normalized.includes('before staff assignment') || normalized.includes('provider processing')) {
    return 'Đề xuất trùng chỉ có thể được xác nhận trước khi sự vụ được phân công nhân viên hoặc bắt đầu xử lý.';
  }

  return text;
};

export const DuplicateDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeParams = useParams();
  const duplicateCandidateId = resolveDuplicateCandidateId(routeParams);
  const duplicateDirtyKey = useMemo(
    () => getScopedSessionKey('urbanservice-duplicate-cache-dirty-v2', user),
    [user],
  );
  const duplicateBasePath = location.pathname.startsWith('/manager/')
    ? '/manager/incident-matches'
    : '/staff/duplicates';
  const returnTo = location.state?.returnTo || duplicateBasePath;
  const returnLabel = location.state?.returnLabel || 'Quay lại danh sách';
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState({ type: '', text: '' });
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const loadCandidate = useCallback(async () => {
    if (!duplicateCandidateId) {
      setError('Thiếu mã đề xuất ghép Incident.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await duplicateManagementApi.getDuplicateById(duplicateCandidateId);

      const normalizedCandidate = normalizeDuplicateCandidatePayload(response || null);

      if (normalizedCandidate) {
        setCandidate(normalizedCandidate);
        setLoading(false);
      }

      // If attachments are stored on the referenced feedback resources, fetch them by id
      const fbId = response?.feedbackId || response?.feedback?.feedbackId || response?.feedback?.id || response?.feedback?.feedback_id || null;
      const parentId = response?.potentialParentFeedbackId || response?.potentialParentFeedback?.feedbackId || response?.potentialParentFeedback?.id || response?.potentialParentFeedback?.feedback_id || null;

      let fetchedFb = null;
      let fetchedParent = null;

      const detailRequests = [
        fbId ? managementFeedbackApi.getFeedbackById(fbId) : Promise.resolve(null),
        parentId ? managementFeedbackApi.getFeedbackById(parentId) : Promise.resolve(null),
      ];
      const [feedbackResult, parentResult] = await Promise.allSettled(detailRequests);

      fetchedFb = feedbackResult.status === 'fulfilled' ? feedbackResult.value : null;
      fetchedParent = parentResult.status === 'fulfilled' ? parentResult.value : null;

      const fbUrls = extractImageUrls(fetchedFb || response?.feedback || {});
      const parentUrls = extractImageUrls(fetchedParent || response?.potentialParentFeedback || {});


      // Merge richer Feedback detail into both sides so fields such as
      // latitude/longitude/address are not lost when the candidate DTO is compact.
      const hasPrimaryImages = normalizedCandidate?.primaryFeedback?.images?.length;
      const hasDuplicateImages = normalizedCandidate?.duplicateFeedback?.images?.length;

      setCandidate({
        ...normalizedCandidate,
        primaryFeedback: {
          ...(fetchedFb || {}),
          ...(normalizedCandidate?.primaryFeedback || {}),
          images: hasPrimaryImages ? normalizedCandidate.primaryFeedback.images : fbUrls,
        },
        duplicateFeedback: {
          ...(fetchedParent || {}),
          ...(normalizedCandidate?.duplicateFeedback || {}),
          images: hasDuplicateImages ? normalizedCandidate.duplicateFeedback.images : parentUrls,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Không thể tải chi tiết đề xuất cùng Incident.');
    } finally {
      setLoading(false);
    }
  }, [duplicateCandidateId]);

  useEffect(() => {
    loadCandidate();
  }, [loadCandidate]);

  const primaryFeedback = useMemo(() => candidate?.primaryFeedback || null, [candidate]);
  const duplicateFeedback = useMemo(() => candidate?.duplicateFeedback || null, [candidate]);
  // reasoning not displayed here; keep helper available in utils if needed
  const primaryImages = useMemo(() => getImageSources(primaryFeedback), [primaryFeedback]);
  const duplicateImages = useMemo(() => getImageSources(duplicateFeedback), [duplicateFeedback]);
  const imageSources = useMemo(() => [...primaryImages, ...duplicateImages], [primaryImages, duplicateImages]);

  useEffect(() => {
    if (!selectedImage) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedImage(null);
      if (event.key === 'ArrowLeft' && imageSources.length > 1) {
        const currentIndex = Math.max(0, imageSources.indexOf(selectedImage));
        setSelectedImage(imageSources[(currentIndex - 1 + imageSources.length) % imageSources.length]);
      }
      if (event.key === 'ArrowRight' && imageSources.length > 1) {
        const currentIndex = Math.max(0, imageSources.indexOf(selectedImage));
        setSelectedImage(imageSources[(currentIndex + 1) % imageSources.length]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [imageSources, selectedImage]);

  // refreshImages removed — reload handled by page reload or candidate load

  const confidenceValue = getNormalizedConfidence(candidate?.confidenceScore ?? candidate?.confidence);
  const confidenceLabel = getRecommendationText(confidenceValue);
  const statusLabel = getStatusLabel(candidate?.status);
  const decisionState = getDuplicateCandidateDecisionState(candidate);
  const candidateIsPending = decisionState === 'pending';
  const candidateIsProcessed = decisionState === 'processed';
  const currentIncidentId = candidate?.currentIncidentId || candidate?.incidentId || primaryFeedback?.incidentId;
  const suggestedIncidentId = candidate?.suggestedIncidentId || duplicateFeedback?.incidentId;
  const areInSameIncident = candidate?.areInSameIncident
    ?? Boolean(currentIncidentId && suggestedIncidentId && currentIncidentId === suggestedIncidentId);
  const parentStatus = String(duplicateFeedback?.status || '').trim();
  const parentStatusKey = parentStatus.toLowerCase();
  const parentIsPastDuplicateConfirmStage = TOO_LATE_FOR_DUPLICATE_CONFIRM_STATUSES.has(parentStatusKey);
  const canConfirmDuplicate = candidateIsPending && !parentIsPastDuplicateConfirmStage;
  const confirmBlockedMessage = !candidateIsPending
    ? 'Đề xuất này không còn ở trạng thái chờ xử lý.'
    : parentIsPastDuplicateConfirmStage
      ? 'Không thể xác nhận trùng vì sự vụ đã được phân công nhân viên hoặc đã bước vào giai đoạn xử lý. Đề xuất trùng chỉ được xác nhận trước giai đoạn này.'
      : '';

  const comparisonRows = useMemo(() => {
    const titleA = getTextValue(primaryFeedback?.title, '—');
    const titleB = getTextValue(duplicateFeedback?.title, '—');
    const descriptionA = getTextValue(primaryFeedback?.description, 'Không có mô tả');
    const descriptionB = getTextValue(duplicateFeedback?.description, 'Không có mô tả');
    const categoryA = getTextValue(primaryFeedback?.categoryName || primaryFeedback?.category?.name, '—');
    const categoryB = getTextValue(duplicateFeedback?.categoryName || duplicateFeedback?.category?.name, '—');
    const areaA = getTextValue(primaryFeedback?.areaName || primaryFeedback?.area?.name, '—');
    const areaB = getTextValue(duplicateFeedback?.areaName || duplicateFeedback?.area?.name, '—');
    const priorityA = localizePriority(primaryFeedback?.priority);
    const priorityB = localizePriority(duplicateFeedback?.priority);
    const createdRawA = primaryFeedback?.createdAt || primaryFeedback?.createdDate;
    const createdRawB = duplicateFeedback?.createdAt || duplicateFeedback?.createdDate;
    const createdA = formatDateTime(createdRawA);
    const createdB = formatDateTime(createdRawB);
    const coordsA = getFeedbackCoordinates(primaryFeedback);
    const coordsB = getFeedbackCoordinates(duplicateFeedback);
    const locationTextA = getFeedbackLocationText(primaryFeedback);
    const locationTextB = getFeedbackLocationText(duplicateFeedback);
    const distance = getDistanceKm(coordsA, coordsB);
    const distanceLabel = formatDistance(distance);

    const locationA = coordsA
      ? `${locationTextA !== '—' ? `${locationTextA} · ` : ''}${formatCoordinates(coordsA)}`
      : locationTextA;
    const locationB = coordsB
      ? `${locationTextB !== '—' ? `${locationTextB} · ` : ''}${formatCoordinates(coordsB)}`
      : locationTextB;

    const sameArea = !isMissingValue(areaA) && !isMissingValue(areaB) && areaA === areaB;
    const locationMatch = coordsA && coordsB
      ? (distance <= 0.5 ? 'same' : distance <= 5 ? 'similar' : 'neutral')
      : (sameArea ? 'similar' : (isMissingValue(locationA) || isMissingValue(locationB) ? 'missing' : 'neutral'));

    const locationCompareLabel = coordsA && coordsB && distanceLabel
      ? (distance <= 0.5
        ? `Rất gần · ${distanceLabel}`
        : distance <= 5
          ? `Gần nhau · ${distanceLabel}`
          : `Cách nhau · ${distanceLabel}`)
      : (sameArea ? 'Cùng khu vực' : null);

    const timeA = createdRawA ? new Date(createdRawA).getTime() : Number.NaN;
    const timeB = createdRawB ? new Date(createdRawB).getTime() : Number.NaN;
    const dateMatch = Number.isFinite(timeA) && Number.isFinite(timeB)
      ? (Math.abs(timeA - timeB) <= 24 * 60 * 60 * 1000 ? 'similar' : 'neutral')
      : 'missing';

    return [
      { label: 'Tiêu đề', a: titleA, b: titleB, match: compareExact(titleA, titleB) },
      { label: 'Mô tả', a: descriptionA, b: descriptionB, match: compareExact(descriptionA, descriptionB) },
      { label: 'Danh mục', a: categoryA, b: categoryB, match: compareExact(categoryA, categoryB) },
      { label: 'Khu vực', a: areaA, b: areaB, match: compareExact(areaA, areaB) },
      { label: 'Ưu tiên', a: priorityA, b: priorityB, match: compareExact(priorityA, priorityB) },
      { label: 'Ngày tạo', a: createdA, b: createdB, match: dateMatch },
      {
        label: 'Vị trí',
        a: locationA,
        b: locationB,
        match: locationMatch,
        compareLabel: locationCompareLabel,
      },
    ];
  }, [primaryFeedback, duplicateFeedback]);

  const evidenceItems = useMemo(() => {
    const getRow = (label) => comparisonRows.find((row) => row.label === label);
    const category = getRow('Danh mục');
    const area = getRow('Khu vực');
    const location = getRow('Vị trí');
    const description = getRow('Mô tả');

    const describe = (row, messages) => {
      if (!row || row.match === 'missing') return messages.missing;
      if (row.match === 'same') return messages.same;
      if (row.match === 'similar') return messages.similar || messages.same;
      return messages.neutral;
    };

    return [
      {
        title: 'Danh mục',
        description: describe(category, {
          same: 'Hai phản ánh cùng danh mục.',
          neutral: 'Danh mục đang khác nhau.',
          missing: 'Không đủ dữ liệu để đối chiếu danh mục.',
        }),
        state: category?.match || 'missing',
      },
      {
        title: 'Khu vực',
        description: describe(area, {
          same: 'Hai phản ánh cùng khu vực.',
          neutral: 'Khu vực đang khác nhau.',
          missing: 'Không đủ dữ liệu để đối chiếu khu vực.',
        }),
        state: area?.match || 'missing',
      },
      {
        title: 'Vị trí',
        description: location?.compareLabel || describe(location, {
          same: 'Hai phản ánh ở vị trí rất gần nhau.',
          similar: 'Hai phản ánh cùng khu vực; chưa đủ tọa độ để tính chính xác khoảng cách.',
          neutral: 'Vị trí hiện tại không cho thấy mức độ gần đáng kể.',
          missing: 'Chưa đủ dữ liệu vị trí để đối chiếu.',
        }),
        state: location?.match || 'missing',
      },
      {
        title: 'Nội dung',
        description: describe(description, {
          same: 'Mô tả đang trùng khớp.',
          neutral: 'Mô tả đang khác nhau.',
          missing: 'Không đủ mô tả để đối chiếu nội dung.',
        }),
        state: description?.match || 'missing',
      },
    ];
  }, [comparisonRows]);

  const handleConfirmDuplicate = async () => {
    if (!duplicateCandidateId) return;

    if (!canConfirmDuplicate) {
      setPageMessage({ type: 'error', text: confirmBlockedMessage });
      return;
    }

    setConfirmLoading(true);
    setPageMessage({ type: '', text: '' });

    try {
      await duplicateManagementApi.confirmDuplicateCandidate(duplicateCandidateId);
      sessionStorage.setItem(duplicateDirtyKey, '1');
      setConfirmModalOpen(false);
      navigate(returnTo, {
        replace: true,
        state: returnTo === duplicateBasePath
          ? {
              successMessage: 'Đã liên kết phản ánh vào sự vụ hiện có. Dữ liệu gốc của phản ánh vẫn được giữ nguyên.',
            }
          : undefined,
      });
    } catch (err) {
      console.error(err);
      setPageMessage({
        type: 'error',
        text: localizeDuplicateActionError(
          err?.message,
          'Không thể liên kết phản ánh vào sự vụ lúc này.',
        ),
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleRejectDuplicate = async () => {
    if (!duplicateCandidateId) return;

    setRejectLoading(true);
    setPageMessage({ type: '', text: '' });

    try {
      await duplicateManagementApi.rejectDuplicateCandidate(duplicateCandidateId);
      sessionStorage.setItem(duplicateDirtyKey, '1');
      setRejectModalOpen(false);
      navigate(returnTo, {
        replace: true,
        state: returnTo === duplicateBasePath
          ? {
              successMessage: 'Đã xác nhận đề xuất không trùng. Phản ánh sẽ tiếp tục luồng xác minh độc lập.',
            }
          : undefined,
      });
    } catch (err) {
      console.error(err);
      setPageMessage({
        type: 'error',
        text: err?.message || 'Không thể xác nhận đề xuất không trùng lúc này.',
      });
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="admin-page-shell space-y-6 pb-6">
      <ManagerToast
        type={pageMessage.type || 'success'}
        message={pageMessage.text}
        onClose={() => setPageMessage({ type: '', text: '' })}
      />

      <ManagerPageHeader
        title="Đối chiếu phản ánh với sự vụ"
        description="Xem gợi ý của AI, đối chiếu dữ liệu thực tế và tự quyết định liên kết hoặc tạo sự vụ riêng."
        icon={Lucide.ScanSearch}
        statusLabel="MÃ ĐỀ XUẤT"
        statusValue={duplicateCandidateId ? `${String(duplicateCandidateId).slice(0, 8)}…` : '—'}
        actions={(
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="btn admin-secondary-action h-11 rounded-xl px-4 text-sm font-semibold normal-case"
          >
            <Lucide.ArrowLeft size={16} aria-hidden="true" />
            {returnLabel}
          </button>
        )}
      />

      {candidate ? (
        <section className="manager-flow-strip" aria-label="Luồng xử lý đề xuất trùng lặp">
          <div className="manager-flow-step is-complete">
            <span className="manager-flow-step-index"><Lucide.Check size={14} /></span>
            <div>
              <p className="manager-flow-step-label">Bước 1</p>
              <p className="manager-flow-step-title">AI phát hiện nghi trùng</p>
            </div>
          </div>
          <Lucide.ChevronRight className="manager-flow-arrow" size={17} aria-hidden="true" />
          <div className={`manager-flow-step ${candidateIsPending ? 'is-current' : 'is-complete'}`}>
            <span className="manager-flow-step-index">
              {candidateIsPending ? '2' : <Lucide.Check size={14} />}
            </span>
            <div>
              <p className="manager-flow-step-label">Bước 2</p>
              <p className="manager-flow-step-title">Manager đối chiếu</p>
            </div>
          </div>
          <Lucide.ChevronRight className="manager-flow-arrow" size={17} aria-hidden="true" />
          <div className={`manager-flow-step ${candidateIsPending ? '' : 'is-complete'}`}>
            <span className="manager-flow-step-index">
              {candidateIsPending ? '3' : <Lucide.Check size={14} />}
            </span>
            <div>
              <p className="manager-flow-step-label">Bước 3</p>
              <p className="manager-flow-step-title">
                {candidateIsPending
                  ? 'Ra quyết định'
                  : candidate?.status === 'Confirmed'
                    ? (areInSameIncident ? 'Đã liên kết vào sự vụ' : 'Đã xác nhận trùng · liên kết đã thay đổi')
                    : 'Không trùng · tiếp tục xác minh'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl border border-blue-100 bg-blue-50/55 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/[0.07] dark:text-blue-200">
        <strong>AI chỉ gợi ý.</strong> Quyết định trùng hay không trùng luôn do Manager xác nhận sau khi đối chiếu nội dung, hình ảnh, vị trí và sự vụ gợi ý.
      </div>

      {loading ? (
        <div className="card bg-white border border-slate-200 rounded-3xl p-10 text-center text-sm text-slate-500">
          <span className="loading loading-spinner loading-sm mr-2" />
          Đang tải đề xuất cùng sự vụ...
        </div>
      ) : error ? (
        <div className="card bg-rose-50 border border-rose-200 rounded-3xl p-10 text-center text-sm text-rose-700">
          {error}
        </div>
      ) : !candidate ? (
        <div className="card bg-white border border-slate-200 rounded-3xl p-10 text-center text-sm text-slate-500">
          Không tìm thấy dữ liệu cho trường hợp này.
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng quan đề xuất đối chiếu">
            <article className="admin-stat-card flex min-h-[168px] flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Độ tương đồng</p>
                  <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
                    {confidenceValue !== null ? `${Math.round(confidenceValue)}%` : '—'}
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Lucide.ScanSearch size={19} aria-hidden="true" />
                </span>
              </div>
              <div className="mt-auto pt-4">
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {confidenceLabel}
                </span>
              </div>
            </article>

            <article className="admin-stat-card flex min-h-[168px] flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sự vụ gợi ý</p>
                  <p className="mt-2 truncate text-2xl font-bold tracking-[-0.03em] text-slate-950" title={String(suggestedIncidentId || currentIncidentId || '')}>
                    {suggestedIncidentId
                      ? String(suggestedIncidentId).slice(0, 8)
                      : currentIncidentId
                        ? String(currentIncidentId).slice(0, 8)
                        : '—'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {areInSameIncident
                      ? 'Đang liên kết với sự vụ này'
                      : candidate?.status === 'Confirmed'
                        ? 'Liên kết hiện tại đã thay đổi'
                        : 'Sự vụ đang được đề xuất'}
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <Lucide.Siren size={19} aria-hidden="true" />
                </span>
              </div>

              <div className="mt-auto pt-4">
                {suggestedIncidentId || currentIncidentId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/manager/incidents/${suggestedIncidentId || currentIncidentId}`, {
                      state: { from: location.pathname },
                    })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50"
                  >
                    Xem sự vụ
                    <Lucide.ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Chưa có sự vụ gợi ý</span>
                )}
              </div>
            </article>

            <article className="admin-stat-card flex min-h-[168px] flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Phản ánh mới</p>
                  <p
                    className="mt-2 truncate text-2xl font-bold tracking-[-0.03em] text-slate-950"
                    title={String(primaryFeedback?.feedbackId || primaryFeedback?.id || '')}
                  >
                    {primaryFeedback?.feedbackId || primaryFeedback?.id
                      ? `${String(primaryFeedback?.feedbackId || primaryFeedback?.id).slice(0, 8)}…`
                      : '—'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500" title={primaryFeedback?.title || ''}>
                    {primaryFeedback?.title || 'Không có tiêu đề'}
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Lucide.MessageSquareText size={19} aria-hidden="true" />
                </span>
              </div>

              <div className="mt-auto pt-4">
                {primaryFeedback?.feedbackId || primaryFeedback?.id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/manager/interactions/${primaryFeedback.feedbackId || primaryFeedback.id}`, {
                      state: { fromInteractionList: true },
                    })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-2.5 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-50"
                  >
                    Xem chi tiết phản ánh
                    <Lucide.ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Chưa có mã phản ánh</span>
                )}
              </div>
            </article>

            <article className="admin-stat-card flex min-h-[168px] flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Trạng thái</p>
                  <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                    {statusLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {candidateIsPending
                      ? 'Đang chờ quyết định của Manager'
                      : candidate?.status === 'Confirmed'
                        ? (areInSameIncident ? 'Đã xác nhận trùng · liên kết đang hoạt động' : 'Đã xác nhận trùng · liên kết hiện tại đã thay đổi')
                        : 'Quyết định không trùng đã được ghi nhận'}
                  </p>
                </div>
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  candidate?.status === 'Confirmed'
                    ? 'bg-emerald-50 text-emerald-700'
                    : candidate?.status === 'Rejected'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {candidate?.status === 'Confirmed'
                    ? <Lucide.BadgeCheck size={19} aria-hidden="true" />
                    : candidate?.status === 'Rejected'
                      ? <Lucide.XCircle size={19} aria-hidden="true" />
                      : <Lucide.Clock3 size={19} aria-hidden="true" />}
                </span>
              </div>

              <div className="mt-auto pt-4">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  candidate?.status === 'Confirmed'
                    ? 'bg-emerald-50 text-emerald-700'
                    : candidate?.status === 'Rejected'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {candidateIsPending ? 'Chờ xử lý' : 'Chỉ xem'}
                </span>
              </div>
            </article>
          </section>

          {parentIsPastDuplicateConfirmStage && candidateIsPending && (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl status-warning">
                <Lucide.AlertTriangle size={16} />
              </div>
              <div>
                <div className="font-semibold">Chưa thể liên kết phản ánh vào sự vụ</div>
                <p className="mt-1 text-slate-700">{confirmBlockedMessage}</p>
              </div>
            </div>
          )}

          <section className="admin-panel overflow-hidden">
            <div className="manager-soft-section-header px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Đối chiếu phản ánh</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Phản ánh mới có thuộc sự vụ được gợi ý không?</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Ưu tiên đối chiếu nội dung, hình ảnh, danh mục, khu vực và vị trí; người gửi hoặc trạng thái xử lý không phải bằng chứng trùng lặp.
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-500">Giống / Khác được tính theo dữ liệu hiện tại</div>
              </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-slate-200">
              <article className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">Phản ánh mới</div>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-950">
                      {getTextValue(primaryFeedback?.title, '—')}
                    </h3>
                  </div>
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-50 px-2 text-xs font-semibold text-blue-700">A</span>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {primaryImages.length ? (
                    <button
                      type="button"
                      onClick={() => setSelectedImage(primaryImages[0])}
                      className="group relative block h-56 w-full cursor-zoom-in overflow-hidden"
                      aria-label="Mở ảnh phản ánh mới"
                    >
                      <img src={primaryImages[0]} alt="Phản ánh mới" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01]" />
                      <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/65 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                        <Lucide.Maximize2 size={13} aria-hidden="true" /> Xem ảnh
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-56 items-center justify-center text-slate-500">
                      <div className="text-center text-sm">
                        <Lucide.ImageOff size={26} className="mx-auto mb-2 text-slate-400" />
                        Không có ảnh
                      </div>
                    </div>
                  )}
                </div>
              </article>

              <article className="border-t border-slate-200 p-5 sm:p-6 xl:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Phản ánh đại diện sự vụ</div>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-950">
                      {getTextValue(duplicateFeedback?.title, '—')}
                    </h3>
                  </div>
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 px-2 text-xs font-semibold text-emerald-700">B</span>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {duplicateImages.length ? (
                    <button
                      type="button"
                      onClick={() => setSelectedImage(duplicateImages[0])}
                      className="group relative block h-56 w-full cursor-zoom-in overflow-hidden"
                      aria-label="Mở ảnh phản ánh đại diện sự vụ"
                    >
                      <img src={duplicateImages[0]} alt="Phản ánh đại diện sự vụ" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01]" />
                      <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/65 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                        <Lucide.Maximize2 size={13} aria-hidden="true" /> Xem ảnh
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-56 items-center justify-center text-slate-500">
                      <div className="text-center text-sm">
                        <Lucide.ImageOff size={26} className="mx-auto mb-2 text-slate-400" />
                        Không có ảnh
                      </div>
                    </div>
                  )}
                </div>
              </article>
            </div>

            <div className="border-t border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[34%]" />
                    <col className="w-[16%]" />
                    <col className="w-[34%]" />
                  </colgroup>
                  <thead className="bg-slate-50/85">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Thuộc tính</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Phản ánh mới</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">So sánh</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Phản ánh chính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {comparisonRows.map((row) => (
                      <tr key={row.label} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{row.label}</td>
                        <td className="px-5 py-3.5 text-slate-600">{row.a}</td>
                        <td className="px-5 py-3.5 text-center">
                          <Badge
                            intent={
                              row.match === 'same'
                                ? 'success'
                                : row.match === 'similar'
                                  ? 'info'
                                  : 'neutral'
                            }
                            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
                          >
                            {row.compareLabel || (
                              row.match === 'same'
                                ? 'Giống'
                                : row.match === 'similar'
                                  ? row.label === 'Ngày tạo' ? 'Gần nhau' : 'Tương đồng'
                                  : row.match === 'missing'
                                    ? 'Không đủ dữ liệu'
                                    : 'Khác'
                            )}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="admin-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 md:flex-row md:items-center md:justify-between sm:px-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Đối chiếu nhanh</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Tóm tắt đối chiếu</div>
              </div>
              <div className="text-sm text-slate-500">Tóm tắt trực tiếp từ dữ liệu đang hiển thị; không phải điểm số AI riêng.</div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
              {evidenceItems.slice(0, 4).map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                      item.state === 'same'
                        ? 'status-success'
                        : item.state === 'similar'
                          ? 'status-info'
                          : 'status-neutral'
                    }`}>
                      {item.state === 'same'
                        ? <Lucide.CheckCircle2 size={18} />
                        : item.state === 'missing'
                          ? <Lucide.CircleHelp size={18} />
                          : <Lucide.Search size={18} />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {selectedImage && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[12000] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Xem hình ảnh đối chiếu"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedImage(null);
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="fixed right-4 top-4 z-[12002] inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 sm:right-6 sm:top-6"
                aria-label="Đóng ảnh"
              >
                <Lucide.X size={22} />
              </button>

              {imageSources.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = Math.max(0, imageSources.indexOf(selectedImage));
                      setSelectedImage(imageSources[(currentIndex - 1 + imageSources.length) % imageSources.length]);
                    }}
                    className="fixed left-4 top-1/2 z-[12002] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/65 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 sm:left-6"
                    aria-label="Ảnh trước"
                  >
                    <Lucide.ChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = Math.max(0, imageSources.indexOf(selectedImage));
                      setSelectedImage(imageSources[(currentIndex + 1) % imageSources.length]);
                    }}
                    className="fixed right-4 top-1/2 z-[12002] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/65 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 sm:right-6"
                    aria-label="Ảnh tiếp theo"
                  >
                    <Lucide.ChevronRight size={24} />
                  </button>
                </>
              ) : null}

              <div className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] items-center justify-center sm:h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)]">
                <img
                  src={selectedImage}
                  alt="Hình ảnh đối chiếu"
                  className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                />
              </div>

              {imageSources.length > 1 ? (
                <span className="fixed bottom-4 left-1/2 z-[12002] -translate-x-1/2 rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md sm:bottom-6">
                  {Math.max(0, imageSources.indexOf(selectedImage)) + 1}/{imageSources.length}
                </span>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      <ManagerConfirmDialog
        open={confirmModalOpen}
        title="Liên kết phản ánh vào sự vụ này?"
        description="Phản ánh mới sẽ được liên kết vào sự vụ hiện có. Nội dung, hình ảnh và dữ liệu gốc vẫn được giữ nguyên để đối chiếu."
        confirmLabel="Xác nhận liên kết"
        tone="warning"
        loading={confirmLoading}
        onCancel={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmDuplicate}
      />

      <ManagerConfirmDialog
        open={rejectModalOpen}
        title="Xác nhận phản ánh không trùng?"
        description="Đề xuất sẽ được đánh dấu Không trùng. Phản ánh mới chưa được liên kết và sẽ tiếp tục luồng xác minh độc lập; hệ thống không tạo sự vụ mới ngay tại bước này."
        confirmLabel="Xác nhận không trùng"
        tone="danger"
        loading={rejectLoading}
        onCancel={() => setRejectModalOpen(false)}
        onConfirm={handleRejectDuplicate}
      />

      {candidateIsPending ? (
        <div className="sticky bottom-4 z-30 rounded-[22px] border border-slate-200 bg-white/95 px-4 py-3.5 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {location.pathname.startsWith('/manager/') ? 'Kết luận của quản lý' : 'Kết luận của Staff'}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-600">
                AI đề xuất độ tương đồng <strong className="text-slate-900">{confidenceValue !== null ? `${Math.round(confidenceValue)}%` : '—'}</strong>. Hãy kiểm tra dữ liệu trước khi quyết định.
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(true)}
                className="btn btn-outline min-h-0 rounded-xl px-4 py-2.5"
              >
                <Lucide.XCircle size={15} className="mr-1.5" />
                Xác nhận không trùng
              </button>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                disabled={!canConfirmDuplicate || confirmLoading}
                title={!canConfirmDuplicate ? confirmBlockedMessage : undefined}
                className="btn btn-primary min-h-0 rounded-xl px-4 py-2.5 shadow-md shadow-blue-500/15"
              >
                <Lucide.CheckCircle2 size={15} className="mr-1.5" />
                Xác nhận liên kết
              </button>
            </div>
          </div>
        </div>
      ) : candidateIsProcessed ? (
        <div className="admin-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${candidate?.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {candidate?.status === 'Confirmed' ? <Lucide.BadgeCheck size={18} /> : <Lucide.XCircle size={18} />}
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Trường hợp đã được xử lý</div>
              <div className="mt-0.5 text-xs text-slate-500">Đề xuất đã được xử lý và chuyển sang chế độ chỉ xem.</div>
            </div>
          </div>
          <Badge intent={getBadgeIntent(candidate?.status)} className={`${getStatusClass(candidate?.status)} px-3 py-1 text-[11px] font-semibold`}>
            {statusLabel}
          </Badge>
        </div>
      ) : decisionState === 'unsupported' ? (
        <div className="admin-panel flex items-center gap-3 border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <Lucide.TriangleAlert size={18} aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold">Không thể xác định trạng thái đề xuất</div>
            <div className="mt-0.5 text-xs">Vui lòng tải lại trang hoặc liên hệ quản trị viên để kiểm tra dữ liệu.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const IncidentMatchDetailPage = DuplicateDetailPage;
