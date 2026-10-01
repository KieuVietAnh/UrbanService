import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { toolsApi } from '@urbanmind/shared-api';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { ManagerSelectMenu } from '../../components/manager/ManagerPageElements';
import {
  LocationPicker,
  isLocationInsideBoundaryGeoJson,
  reverseGeocodeApproximateAddress,
} from '../../components/maps/LocationPicker';

const STEPS = [
  { id: 1, label: 'Mô tả', description: 'Nêu rõ vấn đề', icon: Lucide.FileText },
  { id: 2, label: 'Vị trí', description: 'Chọn địa chỉ hoặc bản đồ', icon: Lucide.MapPin },
  { id: 3, label: 'Minh chứng', description: 'Thêm ảnh hoặc video', icon: Lucide.Images },
  { id: 4, label: 'Xem lại', description: 'Kiểm tra trước khi gửi', icon: Lucide.ClipboardCheck },
];

const STEP_FIELDS = {
  1: ['title', 'description'],
  2: ['areaId', 'location'],
  3: ['attachments'],
  4: [],
};


const MAX_ATTACHMENT_COUNT = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const DRAFT_STORAGE_PREFIX = 'urbanmind:create-ticket-draft';

const looksLikeCoordinateOnlyLocation = (value = '') => {
  const normalized = String(value).trim().toLowerCase();
  return (
    !normalized ||
    normalized.startsWith('vị trí đã chọn:') ||
    normalized.startsWith('vị trí gần đúng:')
  );
};

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

const normalizeAiDraftPayload = (payload) => payload?.data ?? payload?.draft ?? payload ?? null;


const getAreaBoundaryGeoJson = (area) => (
  area?.BoundaryGeoJson ??
  area?.boundaryGeoJson ??
  area?.boundaryGeoJSON ??
  area?.boundary ??
  area?.geoJson ??
  area?.geoJSON ??
  null
);


const isVideo = (attachment) => (
  attachment?.type?.startsWith('video/') || attachment?.file?.type?.startsWith('video/')
);

export const CreateTicketPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${user?.userId || 'anonymous'}`;

  const [step, setStep] = useState(1);
  const [reviewEditStep, setReviewEditStep] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaId, setAreaId] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [areasError, setAreasError] = useState('');
  const [areasReloadKey, setAreasReloadKey] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedFeedbackId, setSubmittedFeedbackId] = useState(null);
  const [blockedReason, setBlockedReason] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [previewAttachmentId, setPreviewAttachmentId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingFocusField, setPendingFocusField] = useState(null);
  const [draftNotice, setDraftNotice] = useState('');
  const [aiDraftNotice, setAiDraftNotice] = useState('');
  const [aiMissingFields, setAiMissingFields] = useState([]);
  const [aiImageUrls, setAiImageUrls] = useState([]);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingExit, setPendingExit] = useState(null);
  const [pendingAreaChange, setPendingAreaChange] = useState(null);
  const draftHydratedRef = useRef(false);
  const draftSaveTimerRef = useRef(null);
  const aiAttachmentsHydratedRef = useRef(false);
  const reviewAttachmentsRef = useRef([]);

  const formStageRef = useRef(null);
  const titleFieldRef = useRef(null);
  const descriptionFieldRef = useRef(null);
  const areaFieldRef = useRef(null);
  const locationFieldRef = useRef(null);
  const attachmentFieldRef = useRef(null);


  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);

      if (!rawDraft) {
        draftHydratedRef.current = true;
        return;
      }

      const draft = JSON.parse(rawDraft);
      const restoredStep = Math.min(STEPS.length, Math.max(1, Number(draft.step) || 1));

      setStep(restoredStep);
      setTitle(typeof draft.title === 'string' ? draft.title : '');
      setDescription(typeof draft.description === 'string' ? draft.description : '');
      setAreaId(draft.areaId ? String(draft.areaId) : '');
      setLocationText(typeof draft.locationText === 'string' ? draft.locationText : '');
      setLatitude(Number.isFinite(draft.latitude) ? draft.latitude : null);
      setLongitude(Number.isFinite(draft.longitude) ? draft.longitude : null);
      setDraftNotice(
        draft.hadAttachments
          ? 'Đã khôi phục phản ánh đang làm dở. Hình ảnh hoặc video cần được chọn lại.'
          : 'Đã khôi phục phản ánh đang làm dở.'
      );
    } catch (error) {
      console.warn('Unable to restore create-ticket draft', error);
      window.localStorage.removeItem(draftStorageKey);
    } finally {
      draftHydratedRef.current = true;
    }
  }, [draftStorageKey]);

  useEffect(() => {
    const aiDraft = normalizeAiDraftPayload(routeLocation.state?.aiDraft);
    if (!aiDraft) return;

    const nextTitle = aiDraft.title || aiDraft.summary || '';
    const nextDescription = aiDraft.description || aiDraft.summary || '';
    const nextLocation = aiDraft.location || routeLocation.state?.aiDraftSource?.location || '';
    const nextImageUrls = Array.isArray(aiDraft.imageUrls) ? aiDraft.imageUrls : [];
    const nextMissingFields = Array.isArray(aiDraft.missingFields) ? aiDraft.missingFields : [];

    if (nextTitle) setTitle(nextTitle);
    if (nextDescription) setDescription(nextDescription);
    if (nextLocation) setLocationText(nextLocation);
    if (Number.isFinite(Number(aiDraft.latitude))) setLatitude(Number(aiDraft.latitude));
    if (Number.isFinite(Number(aiDraft.longitude))) setLongitude(Number(aiDraft.longitude));
    if (nextImageUrls.length > 0) setAiImageUrls(nextImageUrls);
    setAiMissingFields(nextMissingFields);


    setStep(1);
    setDraftNotice('');
    setAiDraftNotice(
      aiDraft.confirmationMessage ||
      'AI đã tạo bản nháp phản ánh. Vui lòng xem trước, bổ sung thông tin còn thiếu và xác nhận gửi.'
    );
    window.history.replaceState({}, document.title);
  }, [routeLocation.state]);

  useEffect(() => {
    if (aiAttachmentsHydratedRef.current) return;

    const sourceAttachments = Array.isArray(routeLocation.state?.aiDraftSource?.attachments)
      ? routeLocation.state.aiDraftSource.attachments.filter((file) => file instanceof File)
      : [];
    if (sourceAttachments.length === 0) return;

    aiAttachmentsHydratedRef.current = true;
    Promise.all(sourceAttachments.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID?.() || Date.now()}`,
        file,
        preview: reader.result,
        type: file.type,
        name: file.name,
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })))
      .then((restoredAttachments) => setAttachments((current) => [
        ...current,
        ...restoredAttachments,
      ]))
      .catch(() => {
        aiAttachmentsHydratedRef.current = false;
        setAttachmentError('Không thể chuyển ảnh từ trợ lý sang biểu mẫu. Vui lòng chọn lại ảnh.');
      });
  }, [routeLocation.state]);

  useEffect(() => {
    if (!draftHydratedRef.current || submitted) return undefined;

    window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = window.setTimeout(() => {
      const hasDraftContent = Boolean(
        title.trim() ||
        description.trim() ||
        areaId ||
        locationText ||
        latitude != null ||
        longitude != null ||
        attachments.length > 0 ||
        step > 1
      );

      if (!hasDraftContent) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }

      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          step,
          title,
          description,
          areaId,
          locationText,
          latitude,
          longitude,
          hadAttachments: attachments.length > 0,
          attachmentNames: attachments.map((item) => item.name),
          savedAt: new Date().toISOString(),
        })
      );
    }, 350);

    return () => window.clearTimeout(draftSaveTimerRef.current);
  }, [
    areaId,
    attachments,
    description,
    draftStorageKey,
    latitude,
    locationText,
    longitude,
    step,
    submitted,
    title,
  ]);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      setAreasLoading(true);
      setAreasError('');

      try {
        const result = await toolsApi.getAreas();
        if (!active) return;

        setAreas(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!active) return;
        console.warn('Unable to load active areas for create ticket', error);
        setAreas([]);
        setAreasError('Không tải được danh sách khu vực. Vui lòng thử lại.');
      } finally {
        if (active) setAreasLoading(false);
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [areasReloadKey]);

  useEffect(() => {
    if (!previewAttachmentId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handlePreviewKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewAttachmentId(null);
        return;
      }

      if (
        attachments.length > 1 &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;

        setPreviewAttachmentId((currentId) => {
          const currentIndex = attachments.findIndex(
            (attachment) => attachment.id === currentId
          );
          const safeIndex = currentIndex >= 0 ? currentIndex : 0;
          const nextIndex = (
            safeIndex + direction + attachments.length
          ) % attachments.length;

          return attachments[nextIndex]?.id || null;
        });
      }
    };

    document.addEventListener('keydown', handlePreviewKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handlePreviewKeyDown);
    };
  }, [attachments, previewAttachmentId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      formStageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (!pendingFocusField) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const fieldTargets = {
        title: titleFieldRef.current,
        description: descriptionFieldRef.current,
        areaId: areaFieldRef.current,
        location: locationFieldRef.current,
        attachments: attachmentFieldRef.current,
      };
      const target = fieldTargets[pendingFocusField];

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        window.setTimeout(() => {
          target.focus?.({ preventScroll: true });
        }, 280);
      }

      setPendingFocusField(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocusField, step]);

  const selectedArea = useMemo(
    () => areas.find((area) => String(getAreaId(area)) === String(areaId)),
    [areaId, areas]
  );

  const selectedAreaBoundaryGeoJson = getAreaBoundaryGeoJson(selectedArea);

  const normalizeAreaLookupText = (value) => (
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('vi-VN')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const findAreaFromAddressText = (address) => {
    const normalizedAddress = normalizeAreaLookupText(address);
    if (!normalizedAddress) return null;

    return (
      areas.find((area) => {
        const normalizedName = normalizeAreaLookupText(getAreaName(area));
        if (!normalizedName) return false;

        const compactName = normalizedName.replace(/^phuong\s+/, '').trim();
        return (
          normalizedAddress.includes(normalizedName) ||
          (compactName.length >= 4 && normalizedAddress.includes(compactName))
        );
      }) || null
    );
  };

  const findAreaForCoordinates = (lat, lng) => (
    areas.find((area) => {
      const boundary = getAreaBoundaryGeoJson(area);
      return (
        boundary &&
        isLocationInsideBoundaryGeoJson(Number(lat), Number(lng), boundary)
      );
    }) || null
  );

  const resolveAreaForLocation = (lat, lng, address) => (
    findAreaFromAddressText(address) ||
    findAreaForCoordinates(lat, lng)
  );

  const isSelectedLocationInsideArea = useMemo(() => {
    if (latitude == null || longitude == null) return false;
    if (!selectedAreaBoundaryGeoJson) return true;

    return isLocationInsideBoundaryGeoJson(
      Number(latitude),
      Number(longitude),
      selectedAreaBoundaryGeoJson
    );
  }, [latitude, longitude, selectedAreaBoundaryGeoJson]);

  const resolvedSelectedLocationArea = (
    latitude == null || longitude == null
      ? null
      : resolveAreaForLocation(latitude, longitude, locationText)
  );

  const selectedLocationMatchesArea = useMemo(() => {
    if (!selectedArea || !resolvedSelectedLocationArea) {
      return isSelectedLocationInsideArea;
    }

    return (
      String(getAreaId(selectedArea)) ===
      String(getAreaId(resolvedSelectedLocationArea))
    );
  }, [
    isSelectedLocationInsideArea,
    resolvedSelectedLocationArea,
    selectedArea,
  ]);

  useEffect(() => {
    if (
      step !== 4 ||
      latitude == null ||
      longitude == null ||
      !selectedArea ||
      !looksLikeCoordinateOnlyLocation(locationText)
    ) {
      return undefined;
    }

    let cancelled = false;

    const resolveReviewLocation = async () => {
      const resolvedAddress = await reverseGeocodeApproximateAddress(
        Number(latitude),
        Number(longitude),
        getAreaName(selectedArea)
      );

      if (!cancelled && resolvedAddress) {
        setLocationText(resolvedAddress);
      }
    };

    resolveReviewLocation();

    return () => {
      cancelled = true;
    };
  }, [step, latitude, longitude, selectedArea, locationText]);


  const totalAttachmentSize = useMemo(
    () => attachments.reduce(
      (total, attachment) => total + (attachment.file?.size || 0),
      0
    ),
    [attachments]
  );

  const previewAttachmentIndex = useMemo(
    () => attachments.findIndex(
      (attachment) => attachment.id === previewAttachmentId
    ),
    [attachments, previewAttachmentId]
  );

  const previewAttachment = previewAttachmentIndex >= 0
    ? attachments[previewAttachmentIndex]
    : null;

  const openAttachmentPreview = (attachmentId) => {
    setPreviewAttachmentId(attachmentId);
  };

  const closeAttachmentPreview = () => {
    setPreviewAttachmentId(null);
  };

  const moveAttachmentPreview = (direction) => {
    if (attachments.length <= 1) return;

    const safeIndex = previewAttachmentIndex >= 0
      ? previewAttachmentIndex
      : 0;
    const nextIndex = (
      safeIndex + direction + attachments.length
    ) % attachments.length;

    setPreviewAttachmentId(attachments[nextIndex]?.id || null);
  };

  const stepCompletion = useMemo(() => ({
    1: Boolean(title.trim() && description.trim()),
    2: Boolean(
      areaId &&
      latitude != null &&
      longitude != null &&
      selectedLocationMatchesArea
    ),
    3: Boolean(
      attachments.length > 0 &&
      attachments.length <= MAX_ATTACHMENT_COUNT &&
      totalAttachmentSize <= MAX_TOTAL_ATTACHMENT_SIZE_BYTES
    ),
    4: Boolean(
      title.trim() &&
      description.trim() &&
      areaId &&
      latitude != null &&
      longitude != null &&
      selectedLocationMatchesArea &&
      attachments.length > 0 &&
      attachments.length <= MAX_ATTACHMENT_COUNT &&
      totalAttachmentSize <= MAX_TOTAL_ATTACHMENT_SIZE_BYTES
    ),
  }), [
    areaId,
    attachments.length,
    description,
    latitude,
    longitude,
    selectedLocationMatchesArea,
    title,
    totalAttachmentSize,
  ]);

  const validateStep = (stepId) => {
    const errors = {};

    if (stepId === 1) {
      if (!title.trim()) {
        errors.title = 'Vui lòng nhập tiêu đề phản ánh.';
      }
      if (!description.trim()) {
        errors.description = 'Vui lòng mô tả chi tiết vấn đề.';
      }
    }

    if (stepId === 2) {
      if (!areaId) {
        errors.areaId = 'Vui lòng chọn khu vực xảy ra vấn đề.';
      }
      if (latitude == null || longitude == null) {
        errors.location = 'Vui lòng tìm địa chỉ hoặc đánh dấu vị trí cụ thể trên bản đồ.';
      } else if (!selectedLocationMatchesArea) {
        errors.location = (
          selectedArea && resolvedSelectedLocationArea
            ? `Địa chỉ đã chọn thuộc ${getAreaName(resolvedSelectedLocationArea)}, không thuộc ${getAreaName(selectedArea)}.`
            : selectedArea
              ? `Vị trí đã chọn không thuộc ${getAreaName(selectedArea)}. Vui lòng chọn lại vị trí trong khu vực này.`
              : 'Vị trí đã chọn không thuộc khu vực đã chọn. Vui lòng chọn lại.'
        );
      }
    }

    if (stepId === 3) {
      if (attachments.length === 0) {
        errors.attachments = 'Vui lòng thêm ít nhất 1 ảnh hoặc video để xác thực phản ánh.';
      } else if (
        attachments.length > MAX_ATTACHMENT_COUNT ||
        totalAttachmentSize > MAX_TOTAL_ATTACHMENT_SIZE_BYTES
      ) {
        errors.attachments = `Tối đa ${MAX_ATTACHMENT_COUNT} tệp và tổng dung lượng không quá ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}.`;
      }
    }

    return errors;
  };

  const replaceStepErrors = (stepId, nextErrors) => {
    setFieldErrors((current) => {
      const next = { ...current };
      STEP_FIELDS[stepId].forEach((fieldName) => {
        delete next[fieldName];
      });
      return { ...next, ...nextErrors };
    });
  };

  const clearFieldError = (fieldName) => {
    setFieldErrors((current) => {
      if (!current[fieldName]) return current;
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  };

  const validateStepAndFocus = (stepId) => {
    const errors = validateStep(stepId);
    replaceStepErrors(stepId, errors);

    const firstInvalidField = STEP_FIELDS[stepId].find(
      (fieldName) => errors[fieldName]
    );

    if (!firstInvalidField) {
      setSubmitError('');
      return true;
    }

    setSubmitError('Vui lòng kiểm tra các thông tin còn thiếu trước khi tiếp tục.');
    setPendingFocusField(firstInvalidField);
    return false;
  };

  const goToStep = (nextStep) => {
    setSubmitError('');
    setStep(nextStep);
  };

  const beginReviewEdit = (targetStep) => {
    reviewAttachmentsRef.current = attachments;
    setReviewEditStep(targetStep);
    goToStep(targetStep);
  };

  const restoreReviewAttachmentsIfNeeded = () => {
    if (
      attachments.length === 0 &&
      reviewAttachmentsRef.current.length > 0
    ) {
      setAttachments(reviewAttachmentsRef.current);
    }
  };

  const hasUnsavedDraft = useMemo(() => Boolean(
    !submitted && (
      title.trim() ||
      description.trim() ||
      areaId ||
      locationText ||
      latitude != null ||
      longitude != null ||
      attachments.length > 0 ||
      step > 1
    )
  ), [
    areaId,
    attachments.length,
    description,
    latitude,
    locationText,
    longitude,
    step,
    submitted,
    title,
  ]);

  useEffect(() => {
    if (!hasUnsavedDraft) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingExit({ type: 'path', value: `${destination.pathname}${destination.search}${destination.hash}` });
      setShowLeaveDialog(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [hasUnsavedDraft]);

  const stayOnPage = () => {
    setShowLeaveDialog(false);
    setPendingExit(null);
  };

  const leavePage = () => {
    const destination = pendingExit;
    setShowLeaveDialog(false);
    setPendingExit(null);

    if (destination?.type === 'history') {
      navigate(-1);
      return;
    }

    navigate(destination?.value || '/');
  };

  const handleReturnToSource = () => {
    if (hasUnsavedDraft) {
      setPendingExit({ type: window.history.length > 1 ? 'history' : 'path', value: '/' });
      setShowLeaveDialog(true);
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  const handleFileUpload = async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = '';

    if (files.length === 0) return;

    setAttachmentError('');

    const acceptedFiles = [];
    const validationMessages = [];
    const existingFiles = new Set(
      attachments.map(
        (attachment) => (
          `${attachment.file?.name}-${attachment.file?.size}-${attachment.file?.lastModified}`
        )
      )
    );

    let nextCount = attachments.length;
    let nextTotalSize = totalAttachmentSize;

    files.forEach((file) => {
      const fileIdentity = `${file.name}-${file.size}-${file.lastModified}`;
      const imageFile = file.type.startsWith('image/');
      const videoFile = file.type.startsWith('video/');

      if (existingFiles.has(fileIdentity)) {
        validationMessages.push(`${file.name}: tệp này đã được chọn.`);
        return;
      }

      if (!imageFile && !videoFile) {
        validationMessages.push(
          `${file.name}: chỉ hỗ trợ tệp hình ảnh hoặc video.`
        );
        return;
      }

      if (nextCount >= MAX_ATTACHMENT_COUNT) {
        validationMessages.push(
          `Chỉ được chọn tối đa ${MAX_ATTACHMENT_COUNT} tệp minh chứng.`
        );
        return;
      }

      const fileSizeLimit = videoFile
        ? MAX_VIDEO_SIZE_BYTES
        : MAX_IMAGE_SIZE_BYTES;

      if (file.size > fileSizeLimit) {
        validationMessages.push(
          `${file.name}: ${videoFile ? 'video' : 'ảnh'} không được vượt quá ${formatFileSize(fileSizeLimit)}.`
        );
        return;
      }

      if (nextTotalSize + file.size > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
        validationMessages.push(
          `Tổng dung lượng minh chứng không được vượt quá ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}.`
        );
        return;
      }

      acceptedFiles.push(file);
      existingFiles.add(fileIdentity);
      nextCount += 1;
      nextTotalSize += file.size;
    });

    if (validationMessages.length > 0) {
      const firstMessage = validationMessages[0];
      const remainingCount = validationMessages.length - 1;

      setAttachmentError(
        remainingCount > 0
          ? `${firstMessage} Và ${remainingCount} tệp khác không được thêm.`
          : firstMessage
      );
    }

    if (acceptedFiles.length === 0) return;

    try {
      const nextAttachments = await Promise.all(
        acceptedFiles.map(
          (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              resolve({
                id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID?.() || Date.now()}`,
                file,
                preview: reader.result,
                type: file.type,
                name: file.name,
              });
            };

            reader.onerror = () => reject(
              new Error(`Không thể đọc tệp ${file.name}.`)
            );

            reader.readAsDataURL(file);
          })
        )
      );

      setAttachments((current) => [...current, ...nextAttachments]);
      clearFieldError('attachments');
      setSubmitError('');
    } catch (error) {
      setAttachmentError(
        error?.message || 'Không thể đọc tệp đã chọn. Vui lòng thử lại.'
      );
    }
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((current) => (
      current.filter((item) => item.id !== attachmentId)
    ));
    setAttachmentError('');
    clearFieldError('attachments');
  };

  const handleDescriptionNext = () => {
    if (!validateStepAndFocus(1)) return;

    setSubmitError('');

    if (reviewEditStep === 1) {
      restoreReviewAttachmentsIfNeeded();
      setReviewEditStep(null);
      goToStep(4);
      return;
    }

    goToStep(2);
  };

  const applyResolvedLocation = (lat, lng, address, area = selectedArea) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationText(
      address ||
      (area
        ? `${getAreaName(area)} (vị trí gần đúng)`
        : 'Vị trí đã được xác định trên bản đồ')
    );
    clearFieldError('location');
    clearFieldError('areaId');
    setSubmitError('');
  };

  const handleLocationSelect = async (lat, lng, address) => {
    const resolvedArea = resolveAreaForLocation(lat, lng, address);
    const selectedAreaId = String(getAreaId(selectedArea) || '');
    const resolvedAreaId = String(getAreaId(resolvedArea) || '');

    if (
      selectedArea &&
      resolvedArea &&
      selectedAreaId &&
      resolvedAreaId &&
      selectedAreaId !== resolvedAreaId
    ) {
      setPendingAreaChange({
        lat,
        lng,
        address,
        fromArea: selectedArea,
        toArea: resolvedArea,
      });
      setFieldErrors((current) => ({
        ...current,
        location: '',
      }));
      setSubmitError('');
      return;
    }

    if (
      selectedAreaBoundaryGeoJson &&
      !isLocationInsideBoundaryGeoJson(lat, lng, selectedAreaBoundaryGeoJson)
    ) {
      setFieldErrors((current) => ({
        ...current,
        location: selectedArea
          ? `Vị trí này nằm ngoài ${getAreaName(selectedArea)} và chưa xác định được khu vực phù hợp trong hệ thống.`
          : 'Vị trí này nằm ngoài khu vực đã chọn.',
      }));
      setSubmitError('Vị trí chưa khớp với khu vực đã chọn.');
      return;
    }

    applyResolvedLocation(lat, lng, address, selectedArea);
  };

  const confirmAreaChangeForLocation = () => {
    if (!pendingAreaChange?.toArea) return;

    const { lat, lng, address, toArea } = pendingAreaChange;
    setAreaId(String(getAreaId(toArea)));
    applyResolvedLocation(lat, lng, address, toArea);
    setPendingAreaChange(null);
  };

  const keepCurrentAreaForLocation = () => {
    if (!pendingAreaChange) return;

    const currentAreaName = pendingAreaChange.fromArea
      ? getAreaName(pendingAreaChange.fromArea)
      : 'khu vực hiện tại';
    const detectedAreaName = pendingAreaChange.toArea
      ? getAreaName(pendingAreaChange.toArea)
      : 'khu vực khác';

    setFieldErrors((current) => ({
      ...current,
      location: `Địa chỉ đã chọn thuộc ${detectedAreaName}, không thuộc ${currentAreaName}. Vui lòng chọn vị trí khác trong ${currentAreaName}.`,
    }));
    setSubmitError('Địa chỉ không thuộc khu vực đang chọn.');
    setPendingAreaChange(null);
  };

  const handleClearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationText('');
    setPendingAreaChange(null);
    clearFieldError('location');
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError('');

    const allErrors = {};
    [1, 2, 3].forEach((stepId) => {
      Object.assign(allErrors, validateStep(stepId));
    });

    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors);

      const firstInvalidStep = [1, 2, 3].find((stepId) => (
        STEP_FIELDS[stepId].some((fieldName) => allErrors[fieldName])
      ));
      const firstInvalidField = STEP_FIELDS[firstInvalidStep].find(
        (fieldName) => allErrors[fieldName]
      );

      setSubmitError('Phản ánh còn thiếu thông tin. Hệ thống đã đưa bạn tới mục cần bổ sung.');
      setStep(firstInvalidStep);
      setPendingFocusField(firstInvalidField);
      return;
    }

    setSubmitting(true);

    try {
      const createResponse = await ticketApi.createTicket(
        user?.userId,
        user?.fullName,
        {
          areaId: Number(areaId),
          title: title.trim(),
          description: description.trim(),
          locationText,
          latitude,
          longitude,
          attachments: attachments.map((item) => item.file),
        },
        { role: user?.role || 'service-user' }
      );
      const createdPayload = createResponse?.data ?? createResponse?.item ?? createResponse?.result ?? createResponse;
      const createdFeedbackId = createdPayload?.feedbackId ?? createdPayload?.id ?? null;
      setSubmittedFeedbackId(createdFeedbackId ? String(createdFeedbackId) : null);

      window.localStorage.removeItem(draftStorageKey);
      const aiDraftStorageKey = routeLocation.state?.aiDraftSource?.storageKey;
      if (aiDraftStorageKey) {
        window.localStorage.removeItem(aiDraftStorageKey);
      }
      reviewAttachmentsRef.current = [];
      setDraftNotice('');
      setSubmitted(true);
    } catch (error) {
      console.error('createTicket error', error);

      /*
       * Backend trả mã nghiệp vụ trong data.code để client rẽ nhánh. Hai trường hợp
       * này không phải lỗi kỹ thuật mà là trạng thái tài khoản, nên hiện một màn
       * riêng giải thích việc cần làm thay vì một dòng đỏ cạnh nút gửi.
       */
      const businessCode = error?.response?.data?.data?.code;
      if (businessCode === 'PHONE_NOT_VERIFIED' || businessCode === 'DAILY_FEEDBACK_LIMIT_REACHED') {
        setBlockedReason(businessCode);
        setBlockedMessage(
          error?.response?.data?.msg || error?.response?.data?.message || ''
        );
        setSubmitting(false);
        return;
      }

      const networkUploadError = error?.message === 'Network Error';
      const responseMessage = error?.response?.data?.message || error?.response?.data?.msg;
      setSubmitError(
        networkUploadError
          ? 'Không thể kết nối tới hệ thống. Hãy kiểm tra mạng rồi thử gửi lại.'
          : responseMessage || error?.message || 'Không thể gửi phản ánh. Vui lòng thử lại sau.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const clearDraft = () => {
    window.localStorage.removeItem(draftStorageKey);
    setDraftNotice('');
    setStep(1);
    setTitle('');
    setDescription('');
    setAreaId('');
    setLocationText('');
    setLatitude(null);
    setLongitude(null);
    setAttachments([]);
    reviewAttachmentsRef.current = [];
    setAttachmentError('');
    setSubmitError('');
    setFieldErrors({});
    setPendingFocusField(null);
  };

  const resetForm = () => {
    window.localStorage.removeItem(draftStorageKey);
    setDraftNotice('');
    setStep(1);
    setTitle('');
    setDescription('');
    setAreaId('');
    setLocationText('');
    setLatitude(null);
    setLongitude(null);
    setAttachments([]);
    reviewAttachmentsRef.current = [];
    setAttachmentError('');
    setSubmitError('');
    setSubmitted(false);
    setSubmittedFeedbackId(null);
    setBlockedReason(null);
    setBlockedMessage('');
    setPreviewAttachmentId(null);
    setFieldErrors({});
    setPendingFocusField(null);
  };

  if (blockedReason === 'PHONE_NOT_VERIFIED') {
    return (
      <main className="flex min-h-[calc(100vh-220px)] items-center justify-center py-8 text-base-content">
        <section className="w-full max-w-2xl rounded-[28px] border border-base-300 bg-base-100 p-6 text-center shadow-sm sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/12 text-warning" aria-hidden="true">
            <Lucide.ShieldAlert size={30} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
            Tài khoản chưa xác thực số điện thoại
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-base-content/60">
            {blockedMessage || 'Bạn cần xác thực số điện thoại trước khi gửi phản ánh.'}
            {' '}Chúng tôi gửi một mã OTP qua tin nhắn SMS để xác nhận số của bạn. Nội dung
            bạn vừa nhập vẫn được giữ lại, xác thực xong quay lại gửi là được.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/verify-phone', { state: { from: '/tickets/create' } })}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <Lucide.ShieldCheck size={16} aria-hidden="true" />
              Xác thực số điện thoại
            </button>
            <button
              type="button"
              onClick={() => setBlockedReason(null)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Lucide.ArrowLeft size={16} aria-hidden="true" />
              Quay lại nội dung
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (blockedReason === 'DAILY_FEEDBACK_LIMIT_REACHED') {
    return (
      <main className="flex min-h-[calc(100vh-220px)] items-center justify-center py-8 text-base-content">
        <section className="w-full max-w-2xl rounded-[28px] border border-base-300 bg-base-100 p-6 text-center shadow-sm sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/12 text-warning" aria-hidden="true">
            <Lucide.CalendarClock size={30} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
            Bạn đã gửi đủ số phản ánh hôm nay
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-base-content/60">
            {blockedMessage || 'Bạn đã gửi đủ số phản ánh cho phép trong hôm nay.'}
            {' '}Giới hạn này giúp đội ngũ tiếp nhận xử lý kịp các phản ánh đang chờ. Bạn có
            thể quay lại vào ngày mai, hoặc theo dõi những phản ánh đã gửi.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/tickets')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <Lucide.ListChecks size={16} aria-hidden="true" />
              Xem phản ánh của tôi
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Lucide.Home size={16} aria-hidden="true" />
              Về trang chủ
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-[calc(100vh-220px)] items-center justify-center py-8 text-base-content">
        <section className="w-full max-w-2xl rounded-[28px] border border-base-300 bg-base-100 p-6 text-center shadow-sm sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-success/12 text-success" aria-hidden="true">
            <Lucide.CircleCheckBig size={30} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
            Phản ánh đã được gửi
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-base-content/60">
            Hệ thống đã tiếp nhận thông tin. Bạn có thể theo dõi tiến trình xử lý trong mục Phản ánh của tôi.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(submittedFeedbackId ? `/tickets/${submittedFeedbackId}` : '/tickets')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50"
            >
              <Lucide.ListChecks size={16} aria-hidden="true" />
              {submittedFeedbackId ? 'Xem phản ánh vừa gửi' : 'Xem phản ánh của tôi'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/60 dark:hover:bg-slate-700"
            >
              <Lucide.Plus size={16} aria-hidden="true" />
              Gửi phản ánh khác
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="create-ticket-page text-base-content">
      <style>{`
        .create-step-current {
          border-color: rgba(147, 197, 253, 0.85);
          background: rgba(239, 246, 255, 0.92);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .create-step-current-label { color: #1d4ed8; }
        .create-step-complete {
          border-color: rgba(167, 243, 208, 0.9);
          background: rgba(236, 253, 245, 0.82);
        }
        .create-step-complete-icon {
          background: #d1fae5;
          color: #047857;
        }
        .create-step-complete-label { color: #047857; }
        .create-draft-notice {
          border-color: rgba(191, 219, 254, 0.9);
          background: rgba(239, 246, 255, 0.88);
          color: #1e3a8a;
        }
        .create-draft-action {
          border-color: rgba(191, 219, 254, 0.95);
          background: rgba(255,255,255,0.88);
          color: #1d4ed8;
        }
        .create-ai-notice {
          border-color: rgba(167, 243, 208, 0.9);
          background: rgba(236, 253, 245, 0.86);
          color: #064e3b;
        }
        .create-description-tip {
          border-color: rgba(219, 234, 254, 0.95);
          background: linear-gradient(160deg, #eff6ff 0%, #f8fbff 100%);
        }
        .create-form-footer {
          border-color: rgba(226,232,240,.9);
          background: rgba(255,255,255,.96);
        }
        html[data-theme="dark"] .create-step-current {
          border-color: rgba(96,165,250,.42) !important;
          background: rgba(30, 64, 175, .20) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important;
        }
        html[data-theme="dark"] .create-step-current-label { color: #93c5fd !important; }
        html[data-theme="dark"] .create-step-complete {
          border-color: rgba(52,211,153,.22) !important;
          background: rgba(5,150,105,.10) !important;
        }
        html[data-theme="dark"] .create-step-complete-icon {
          background: rgba(16,185,129,.14) !important;
          color: #6ee7b7 !important;
        }
        html[data-theme="dark"] .create-step-complete-label { color: #6ee7b7 !important; }
        html[data-theme="dark"] .create-draft-notice {
          border-color: rgba(96,165,250,.20) !important;
          background: rgba(30,58,138,.12) !important;
          color: #bfdbfe !important;
        }
        html[data-theme="dark"] .create-draft-action {
          border-color: rgba(96,165,250,.22) !important;
          background: rgba(8,23,43,.72) !important;
          color: #bfdbfe !important;
        }
        html[data-theme="dark"] .create-ai-notice {
          border-color: rgba(52,211,153,.20) !important;
          background: rgba(6,78,59,.18) !important;
          color: #a7f3d0 !important;
        }
        html[data-theme="dark"] .create-description-tip {
          border-color: rgba(96,165,250,.15) !important;
          background: linear-gradient(160deg, rgba(14,29,51,.96), rgba(9,22,39,.96)) !important;
        }
        html[data-theme="dark"] .create-form-footer {
          border-color: rgba(96,165,250,.14) !important;
          background: rgba(8,23,43,.90) !important;
        }
        .create-ticket-hero {
          background:
            linear-gradient(135deg, rgba(239,247,255,.98), rgba(248,251,255,.98)),
            radial-gradient(circle at 78% 18%, rgba(56,189,248,.10), transparent 28%);
        }
        .create-ticket-hero-orb {
          background: radial-gradient(circle, rgba(186,230,253,.44), rgba(186,230,253,.10) 66%, transparent 100%);
        }
        .create-ticket-hero-wave { color: rgba(59,130,246,.20); }
        .create-ticket-hero-float {
          border-color: rgba(147,197,253,.62);
          background: rgba(255,255,255,.72);
          color: #2563eb;
        }
        html[data-theme="dark"] .create-ticket-hero {
          background:
            linear-gradient(135deg, rgba(8,25,49,.98), rgba(6,20,40,.98)),
            radial-gradient(circle at 78% 18%, rgba(34,211,238,.07), transparent 30%) !important;
        }
        html[data-theme="dark"] .create-ticket-hero-orb {
          background: radial-gradient(circle, rgba(125,211,252,.10), rgba(125,211,252,.03) 66%, transparent 100%) !important;
        }
        html[data-theme="dark"] .create-ticket-hero-wave { color: rgba(96,165,250,.16) !important; }
        html[data-theme="dark"] .create-ticket-hero-float {
          border-color: rgba(96,165,250,.18) !important;
          background: rgba(8,25,49,.72) !important;
          color: #7dd3fc !important;
        }
      `}</style>
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="create-ticket-shell relative isolate rounded-[34px] border p-4 sm:p-5 lg:p-6">

        <header className="create-ticket-hero mb-4 overflow-hidden rounded-[26px] border border-[var(--public-border)] shadow-[0_16px_44px_rgba(37,99,235,0.08)]">
          <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="create-ticket-hero-orb absolute -left-20 -top-24 h-64 w-64 rounded-full" />
              <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border border-blue-300/25 bg-blue-400/[0.04]" />
              <div className="absolute right-24 top-4 h-20 w-20 rounded-full border border-cyan-300/25" />
              <svg className="create-ticket-hero-wave absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 1200 110" preserveAspectRatio="none">
                <path d="M0,72 C160,34 302,96 470,60 C642,24 756,83 920,49 C1035,24 1114,35 1200,19" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M0,94 C185,58 330,108 520,82 C710,54 828,101 1004,68 C1090,52 1148,54 1200,48" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="9 12" opacity="0.7" />
              </svg>
              <span className="create-ticket-hero-float absolute left-[46%] top-5 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm backdrop-blur">
                <Lucide.Sparkles size={13} />
              </span>
              <span className="create-ticket-hero-float absolute bottom-5 right-[27%] hidden h-7 w-7 items-center justify-center rounded-full border shadow-sm backdrop-blur sm:flex">
                <Lucide.MapPin size={13} />
              </span>
            </div>

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={handleReturnToSource}
                  className="mb-4 inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3 text-sm font-semibold text-[var(--public-copy)] shadow-sm transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                >
                  <Lucide.ArrowLeft size={14} aria-hidden="true" />
                  Quay lại
                </button>

                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.20)]" aria-hidden="true">
                    <Lucide.MessageSquarePlus size={20} />
                  </span>
                  <div>
                    <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-[var(--public-title)] sm:text-[34px]">Gửi phản ánh</h1>
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--public-copy)]">
                      Mô tả vấn đề, chọn đúng vị trí và thêm minh chứng để phản ánh được tiếp nhận nhanh hơn.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                to="/tickets"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-4 text-sm font-semibold text-[var(--public-title)] shadow-sm transition hover:border-blue-300 hover:text-blue-600 sm:self-center"
              >
                <Lucide.ListChecks size={16} aria-hidden="true" />
                Phản ánh của tôi
              </Link>
            </div>
          </div>

          <div className="border-t border-[var(--public-border)] bg-[var(--public-surface-soft)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-blue-600 px-2 text-xs font-bold text-white shadow-sm">
                  {step}/{STEPS.length}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--public-title)]">{STEPS[step - 1]?.label}</p>
                  <p className="text-xs text-[var(--public-muted)]">{STEPS[step - 1]?.description}</p>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--public-muted)]">
                <Lucide.Clock3 size={12} aria-hidden="true" />
                Khoảng 2–3 phút
              </span>
            </div>

            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Tiến trình gửi phản ánh">
              {STEPS.map(({ id, label, icon: Icon }) => {
                const isCurrent = step === id;
                const isComplete = stepCompletion[id];
                const previousStepsComplete = STEPS
                  .filter((item) => item.id < id)
                  .every((item) => stepCompletion[item.id]);
                const isEnabled = id <= step || previousStepsComplete;

                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => isEnabled && goToStep(id)}
                      disabled={!isEnabled}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                        isCurrent
                          ? 'create-step-current'
                          : isComplete
                            ? 'create-step-complete'
                            : 'border-[var(--public-border)] bg-[var(--public-surface-strong)]'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isComplete
                            ? 'create-step-complete-icon'
                            : 'bg-[var(--public-surface-soft)] text-[var(--public-muted)]'
                      }`} aria-hidden="true">
                        {isComplete && !isCurrent ? <Lucide.Check size={14} /> : <Icon size={14} />}
                      </span>
                      <span className={`truncate text-xs font-semibold sm:text-sm ${
                        isCurrent
                          ? 'create-step-current-label'
                          : isComplete
                            ? 'create-step-complete-label'
                            : 'text-[var(--public-copy)]'
                      }`}>
                        {label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </header>

      {aiDraftNotice ? (
        <aside className="create-ai-notice mb-5 rounded-2xl border px-4 py-3 text-sm" role="status">
          <div className="flex gap-3">
            <Lucide.Sparkles size={18} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <div>
              <p className="font-semibold">Bản nháp phản ánh từ AI đã sẵn sàng</p>
              <p className="mt-1 leading-5">{aiDraftNotice}</p>
              {aiMissingFields.length > 0 ? (
                <p className="mt-2 text-xs font-medium">
                  Cần bổ sung: {aiMissingFields.join(', ')}
                </p>
              ) : null}
              {aiImageUrls.length > 0 ? (
                <p className="mt-2 text-xs">
                  AI trả về {aiImageUrls.length} ảnh đã upload. Nếu muốn gửi kèm minh chứng, vui lòng chọn lại ảnh ở bước Minh chứng.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      ) : null}

      {draftNotice ? (
        <aside className="create-draft-notice mb-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center" role="status">
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <Lucide.History size={18} className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
            <span className="leading-5">{draftNotice}</span>
          </span>
          <button
            type="button"
            onClick={clearDraft}
            className="create-draft-action inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition hover:brightness-105"
          >
            <Lucide.Trash2 size={14} aria-hidden="true" />
            Xóa bản nháp
          </button>
        </aside>
      ) : null}

      {submitError ? (
        <aside className="flex items-start gap-3 rounded-2xl border border-error/25 bg-error/8 px-4 py-3 text-sm text-error" role="alert">
          <Lucide.CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{submitError}</span>
          <button
            type="button"
            onClick={() => setSubmitError('')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-lg hover:bg-error/10"
            aria-label="Đóng thông báo lỗi"
          >
            <Lucide.X size={14} aria-hidden="true" />
          </button>
        </aside>
      ) : null}

      <section>
        <article ref={formStageRef} className="create-ticket-form scroll-mt-24 overflow-hidden rounded-[24px] border">
          {step === 1 ? (
            <section aria-labelledby="description-step-title">
              <header className="create-ticket-form-header border-b px-5 py-4 sm:px-7">
                <h2 id="description-step-title" className="text-lg font-semibold dark:text-slate-100">
                  Bạn đang gặp vấn đề gì?
                </h2>
                <p className="mt-1 text-xs leading-5 text-base-content/50">
                  Nêu ngắn gọn vấn đề và mô tả mức độ ảnh hưởng thực tế.
                </p>
              </header>

              <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-8">
                <div className="space-y-6">
                <label className="block">
                  <span className="text-sm font-semibold dark:text-slate-100">Tiêu đề phản ánh</span>
                  <span className="ml-1 text-error">*</span>
                  <input
                    ref={titleFieldRef}
                    type="text"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      clearFieldError('title');
                    }}
                    maxLength={160}
                    placeholder="Ví dụ: Đèn đường trước số 123 không hoạt động"
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                    className={`mt-2.5 h-[52px] w-full rounded-xl border bg-base-100 px-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 text-[15px] outline-none transition placeholder:text-base-content/35 focus:ring-2 ${
                      fieldErrors.title
                        ? 'border-error focus:border-error focus:ring-error/15'
                        : 'border-base-300 focus:border-primary focus:ring-primary/15'
                    }`}
                  />
                  <span className="mt-1.5 flex items-start justify-between gap-3">
                    {fieldErrors.title ? (
                      <span id="title-error" className="text-xs font-medium text-error" role="alert">
                        {fieldErrors.title}
                      </span>
                    ) : <span />}
                    <span className="shrink-0 text-[11px] text-base-content/40">
                      {title.length}/160
                    </span>
                  </span>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold dark:text-slate-100">Mô tả chi tiết</span>
                  <span className="ml-1 text-error">*</span>
                  <textarea
                    ref={descriptionFieldRef}
                    rows={5}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      clearFieldError('description');
                    }}
                    placeholder="Vấn đề bắt đầu từ khi nào? Ảnh hưởng đến người dân hoặc giao thông ra sao?"
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={fieldErrors.description ? 'description-error' : undefined}
                    className={`mt-2.5 min-h-[150px] w-full resize-y rounded-xl border bg-base-100 px-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 py-3.5 text-[15px] leading-6 outline-none transition placeholder:text-base-content/35 focus:ring-2 ${
                      fieldErrors.description
                        ? 'border-error focus:border-error focus:ring-error/15'
                        : 'border-base-300 focus:border-primary focus:ring-primary/15'
                    }`}
                  />
                  {fieldErrors.description ? (
                    <span id="description-error" className="mt-1.5 block text-xs font-medium text-error" role="alert">
                      {fieldErrors.description}
                    </span>
                  ) : null}
                </label>

                </div>

                <aside className="create-description-tip h-fit rounded-[20px] border p-5 lg:sticky lg:top-24" aria-label="Gợi ý mô tả">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                    <Lucide.Lightbulb size={16} aria-hidden="true" />
                    Mô tả tốt nên có
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Thông tin được tự động lưu trên thiết bị này để bạn có thể quay lại tiếp tục.</p>
                  <ul className="mt-4 grid gap-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    <li className="flex gap-2"><Lucide.Check size={14} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" /> Dấu hiệu hoặc tình trạng cụ thể</li>
                    <li className="flex gap-2"><Lucide.Check size={14} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" /> Thời điểm bạn phát hiện</li>
                    <li className="flex gap-2"><Lucide.Check size={14} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" /> Mức độ ảnh hưởng thực tế</li>
                  </ul>
                </aside>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section aria-labelledby="location-step-title">
              <header className="create-ticket-form-header border-b px-5 py-4 sm:px-7">
                <h2 id="location-step-title" className="text-lg font-semibold dark:text-slate-100">
                  Khu vực và vị trí sự cố
                </h2>
                <p className="mt-1 text-xs leading-5 text-base-content/50">
                  Chọn khu vực, sau đó tìm địa chỉ hoặc đánh dấu điểm chính xác trên bản đồ.
                </p>
              </header>

              <div className="space-y-5 p-5 sm:p-7 lg:p-8">
                <div className="block">
                  <span className="text-sm font-semibold dark:text-slate-100">Khu vực</span>
                  <span className="ml-1 text-error">*</span>
                  <div
                    ref={areaFieldRef}
                    tabIndex={-1}
                    aria-invalid={Boolean(fieldErrors.areaId)}
                    aria-describedby={fieldErrors.areaId ? 'area-error' : undefined}
                    className={`mt-2.5 rounded-xl outline-none transition ${
                      fieldErrors.areaId ? 'ring-2 ring-error/15' : ''
                    }`}
                  >
                    <ManagerSelectMenu
                      value={areaId}
                      onChange={(value) => {
                        setAreaId(String(value || ''));
                        setLatitude(null);
                        setLongitude(null);
                        setLocationText('');
                        setPendingAreaChange(null);
                        clearFieldError('areaId');
                        clearFieldError('location');
                      }}
                      disabled={areasLoading || Boolean(areasError) || areas.length === 0}
                      ariaLabel="Chọn khu vực xảy ra sự cố"
                      placeholder={
                        areasLoading
                          ? 'Đang tải khu vực...'
                          : areasError
                            ? 'Không tải được khu vực'
                            : areas.length === 0
                              ? 'Chưa có khu vực khả dụng'
                              : 'Chọn khu vực xảy ra sự cố'
                      }
                      options={areas.map((area) => ({
                        value: getAreaId(area),
                        label: getAreaName(area),
                      }))}
                    />
                  </div>
                  {fieldErrors.areaId ? (
                    <span id="area-error" className="mt-1.5 block text-xs font-medium text-error" role="alert">
                      {fieldErrors.areaId}
                    </span>
                  ) : null}
                  {areasError ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-error" role="alert">
                      <span>{areasError}</span>
                      <button
                        type="button"
                        onClick={() => setAreasReloadKey((current) => current + 1)}
                        className="font-semibold text-blue-600 hover:underline dark:text-blue-300"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : areasLoading ? (
                    <span className="mt-2 block text-xs leading-5 text-base-content/45">
                      Đang tải danh sách khu vực từ hệ thống...
                    </span>
                  ) : areas.length === 0 ? (
                    <span className="mt-2 block text-xs leading-5 text-base-content/45">
                      Chưa có khu vực đang hoạt động để gửi phản ánh.
                    </span>
                  ) : (
                    <span className="mt-2 block text-xs leading-5 text-base-content/45">
                      Danh sách khu vực được cập nhật tự động từ hệ thống.
                    </span>
                  )}
                </div>

                <div>
                  <div
                    ref={locationFieldRef}
                    tabIndex={-1}
                    aria-invalid={Boolean(fieldErrors.location)}
                    aria-describedby={fieldErrors.location ? 'location-error' : undefined}
                    className={`rounded-[24px] border bg-base-100 p-2 dark:border-slate-700 dark:bg-slate-950 outline-none transition ${
                      fieldErrors.location
                        ? 'border-error ring-2 ring-error/15'
                        : 'border-base-300'
                    }`}
                  >
                    <LocationPicker
                      latitude={latitude}
                      longitude={longitude}
                      onSelectLocation={handleLocationSelect}
                      onClearLocation={handleClearLocation}
                      selectedAddress={locationText}
                      boundaryGeoJson={selectedAreaBoundaryGeoJson}
                      boundaryName={selectedArea ? getAreaName(selectedArea) : ''}
                    />

                  </div>
                  {fieldErrors.location ? (
                    <span id="location-error" className="mt-1.5 block text-xs font-medium text-error" role="alert">
                      {fieldErrors.location}
                    </span>
                  ) : null}
                </div>

              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section aria-labelledby="evidence-step-title">
              <header className="create-ticket-form-header border-b px-5 py-4 sm:px-7">
                <h2 id="evidence-step-title" className="text-lg font-semibold dark:text-slate-100">
                  Thêm minh chứng
                </h2>
                <p className="mt-1 text-xs leading-5 text-base-content/50">
                  Vui lòng thêm ít nhất 1 ảnh hoặc video để hỗ trợ xác thực và xử lý phản ánh.
                </p>
              </header>

              <div className="space-y-5 p-5 sm:p-7 lg:p-8">
                <label
                  ref={attachmentFieldRef}
                  tabIndex={-1}
                  aria-invalid={Boolean(fieldErrors.attachments)}
                  className={`group relative flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed bg-base-200/30 dark:border-slate-700 dark:bg-slate-950/70 p-4 text-center outline-none transition hover:bg-blue-50/60 dark:hover:bg-blue-500/5 ${
                    fieldErrors.attachments
                      ? 'border-error ring-2 ring-error/15'
                      : 'border-base-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="sr-only"
                    aria-describedby="evidence-upload-rules"
                  />
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" aria-hidden="true">
                    <Lucide.UploadCloud size={20} />
                  </span>
                  <strong className="mt-3 text-sm font-semibold">
                    Chọn hình ảnh hoặc video
                  </strong>
                  <span id="evidence-upload-rules" className="mt-1 text-xs leading-5 text-base-content/45">
                    Tối đa {MAX_ATTACHMENT_COUNT} tệp · Ảnh {formatFileSize(MAX_IMAGE_SIZE_BYTES)} · Video {formatFileSize(MAX_VIDEO_SIZE_BYTES)} · Tổng {formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}
                  </span>
                </label>

                {fieldErrors.attachments || attachmentError ? (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
                  >
                    <Lucide.CircleAlert
                      size={17}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="leading-5">
                      {fieldErrors.attachments || attachmentError}
                    </span>
                  </div>
                ) : null}

                {attachments.length > 0 ? (
                  <section aria-labelledby="selected-evidence-title">
                    <div className="flex items-center justify-between gap-3">
                      <h3 id="selected-evidence-title" className="text-sm font-semibold dark:text-slate-100">
                        Minh chứng đã chọn
                      </h3>
                      <span className="text-xs text-base-content/45">
                        {attachments.length}/{MAX_ATTACHMENT_COUNT} tệp · {formatFileSize(totalAttachmentSize)}/{formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}
                      </span>
                    </div>

                    <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {attachments.map((attachment) => (
                        <li key={attachment.id} className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() => openAttachmentPreview(attachment.id)}
                            className="group relative block h-36 w-full overflow-hidden bg-base-200"
                            aria-label={`Xem trước ${attachment.name}`}
                          >
                            {isVideo(attachment) ? (
                              <video src={attachment.preview} className="h-full w-full object-cover" muted />
                            ) : (
                              <img
                                src={attachment.preview}
                                alt={attachment.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100 group-focus-visible:bg-black/35 group-focus-visible:opacity-100">
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                                {isVideo(attachment) ? (
                                  <Lucide.Play size={18} fill="currentColor" aria-hidden="true" />
                                ) : (
                                  <Lucide.Expand size={18} aria-hidden="true" />
                                )}
                              </span>
                            </span>
                          </button>
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                {attachment.name}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-base-content/40">
                                {formatFileSize(attachment.file?.size || 0)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment.id)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-error transition hover:bg-error/10"
                              aria-label={`Xóa ${attachment.name}`}
                            >
                              <Lucide.Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}


              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="create-form-section border-b border-base-200 px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="step-review-heading">
              <div className="mb-5">
                <h2 id="step-review-heading" className="text-xl font-bold text-[var(--public-title)]">
                  Xem lại và xác nhận
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">
                  Kiểm tra lần cuối toàn bộ thông tin trước khi gửi phản ánh.
                </p>
              </div>

                <section
                  className="overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-cyan-50/40 shadow-[0_12px_32px_rgba(37,99,235,0.07)] dark:border-blue-500/20 dark:from-blue-950/30 dark:via-slate-900 dark:to-cyan-950/20"
                  aria-labelledby="submission-review-title"
                >
                  <div className="flex flex-col gap-3 border-b border-blue-100/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-blue-500/15">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)]" aria-hidden="true">
                        <Lucide.ClipboardCheck size={18} />
                      </span>
                      <div>
                        <h3 id="submission-review-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          Xem lại thông tin phản ánh
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          Kiểm tra lại nội dung, vị trí và minh chứng trước khi gửi.
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Lucide.ShieldCheck size={13} aria-hidden="true" />
                      Sẵn sàng kiểm tra
                    </span>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    <article className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-950/45">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Lucide.FileText size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Nội dung phản ánh
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => beginReviewEdit(1)}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                        >
                          <Lucide.Pencil size={12} aria-hidden="true" />
                          Chỉnh sửa
                        </button>
                      </div>

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Tiêu đề
                          </dt>
                          <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                            {title.trim() || 'Chưa nhập tiêu đề'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Nội dung
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-slate-600 dark:text-slate-300">
                            {description.trim() || 'Chưa nhập nội dung'}
                          </dd>
                        </div>
                      </dl>
                    </article>

                    <article className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-950/45">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Lucide.MapPinned size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Vị trí
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => beginReviewEdit(2)}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                        >
                          <Lucide.Pencil size={12} aria-hidden="true" />
                          Chỉnh sửa
                        </button>
                      </div>

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Khu vực
                          </dt>
                          <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                            {selectedArea ? getAreaName(selectedArea) : 'Chưa chọn khu vực'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Địa chỉ / vị trí gần đúng
                          </dt>
                          <dd className="mt-1 break-words leading-6 text-slate-600 dark:text-slate-300">
                            {locationText || 'Chưa có địa chỉ'}
                          </dd>
                        </div>
                      </dl>
                    </article>

                    <article className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 lg:col-span-2 dark:border-slate-700 dark:bg-slate-950/45">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Lucide.Images size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Minh chứng
                          </h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {attachments.length} tệp · {formatFileSize(totalAttachmentSize)}
                          </span>
                          <button
                            type="button"
                            onClick={() => beginReviewEdit(3)}
                            disabled={submitting}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                          >
                            <Lucide.Pencil size={12} aria-hidden="true" />
                            Chỉnh sửa
                          </button>
                        </div>
                      </div>

                      {attachments.length > 0 ? (
                        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                          {attachments.map((attachment) => (
                            <button
                              key={`review-${attachment.id}`}
                              type="button"
                              onClick={() => openAttachmentPreview(attachment.id)}
                              className="group relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800"
                              aria-label={`Xem lại ${attachment.name}`}
                            >
                              {isVideo(attachment) ? (
                                <>
                                  <video src={attachment.preview} className="h-full w-full object-cover" muted />
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                                    <Lucide.Play size={18} fill="currentColor" aria-hidden="true" />
                                  </span>
                                </>
                              ) : (
                                <img
                                  src={attachment.preview}
                                  alt={attachment.name}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Vui lòng quay lại bước Minh chứng và thêm ít nhất 1 ảnh hoặc video.
                        </p>
                      )}
                    </article>
                  </div>
                </section>
            </section>
          ) : null}

          <footer className={`create-form-footer flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:px-7 ${step === 1 ? 'sm:justify-end' : 'sm:justify-between'}`}>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/60 dark:hover:bg-slate-700"
              >
                <Lucide.ArrowLeft size={16} aria-hidden="true" />
                Quay lại
              </button>
            ) : null}

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1) {
                    handleDescriptionNext();
                    return;
                  }

                  if (validateStepAndFocus(step)) {
                    if (reviewEditStep === step) {
                      if (step !== 3) {
                        restoreReviewAttachmentsIfNeeded();
                      }
                      setReviewEditStep(null);
                      goToStep(4);
                      return;
                    }

                    goToStep(Math.min(STEPS.length, step + 1));
                  }
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50"
              >
                Tiếp tục
                <Lucide.ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                ) : (
                  <Lucide.Send size={16} aria-hidden="true" />
                )}
                {submitting ? 'Đang gửi...' : 'Gửi phản ánh'}
              </button>
            )}
          </footer>
        </article>

      </section>
        </div>

      {pendingAreaChange && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[99997] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" role="presentation">
              <section
                className="w-full max-w-md rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-base-300 dark:bg-base-100"
                role="dialog"
                aria-modal="true"
                aria-labelledby="location-area-change-title"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300" aria-hidden="true">
                  <Lucide.MapPinned size={22} />
                </span>
                <h2 id="location-area-change-title" className="mt-4 text-xl font-semibold tracking-tight">
                  Địa chỉ thuộc khu vực khác
                </h2>
                <p className="mt-2 text-sm leading-6 text-base-content/60">
                  Vị trí bạn vừa chọn thuộc <strong>{getAreaName(pendingAreaChange.toArea)}</strong>,
                  khác với <strong>{getAreaName(pendingAreaChange.fromArea)}</strong> đang chọn.
                </p>
                <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/8 dark:text-blue-200">
                  Nếu đổi khu vực, hệ thống sẽ giữ nguyên địa chỉ vừa chọn và cập nhật bản đồ theo khu vực mới.
                </p>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={keepCurrentAreaForLocation}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-blue-200 hover:text-blue-700"
                  >
                    Giữ {getAreaName(pendingAreaChange.fromArea)}
                  </button>
                  <button
                    type="button"
                    onClick={confirmAreaChangeForLocation}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:bg-blue-700"
                  >
                    Đổi sang {getAreaName(pendingAreaChange.toArea)}
                    <Lucide.ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      {showLeaveDialog && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" role="presentation">
              <section className="w-full max-w-md rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-base-300 dark:bg-base-100" role="dialog" aria-modal="true" aria-labelledby="leave-draft-title">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300" aria-hidden="true">
                  <Lucide.FileClock size={22} />
                </span>
                <h2 id="leave-draft-title" className="mt-4 text-xl font-semibold tracking-tight">Rời khỏi phản ánh đang làm?</h2>
                <p className="mt-2 text-sm leading-6 text-base-content/60">
                  Nội dung mô tả và vị trí đã được lưu tự động. Bạn có thể quay lại trang Gửi phản ánh để tiếp tục từ bước hiện tại.
                </p>
                {attachments.length > 0 ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-200">
                    Ảnh hoặc video không được lưu trong bản nháp và cần chọn lại khi quay lại.
                  </p>
                ) : null}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={stayOnPage} className="inline-flex h-11 items-center justify-center rounded-xl border border-base-300 bg-base-100 px-4 text-sm font-semibold transition hover:border-blue-200 hover:text-blue-700">
                    Tiếp tục chỉnh sửa
                  </button>
                  <button type="button" onClick={leavePage} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:bg-blue-700">
                    Rời trang
                    <Lucide.ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
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
              aria-labelledby="attachment-preview-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeAttachmentPreview();
                }
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pb-16 pt-4 sm:px-6 sm:pt-5"
                aria-hidden="true"
              >
                <div className="min-w-0">
                  <h2
                    id="attachment-preview-title"
                    className="max-w-[70vw] truncate text-sm font-semibold text-white sm:text-base"
                  >
                    {previewAttachment.name}
                  </h2>
                  <p className="mt-1 text-xs text-white/65">
                    {previewAttachmentIndex + 1} / {attachments.length}
                    <span className="hidden sm:inline">
                      {' '}· Dùng phím ← → để chuyển tệp
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAttachmentPreview}
                className="absolute right-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-6 sm:top-5"
                aria-label="Đóng xem trước"
              >
                <Lucide.X size={21} aria-hidden="true" />
              </button>

              <div
                className="flex h-full w-full items-center justify-center overflow-hidden px-3 py-3 sm:px-16 sm:py-5"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    closeAttachmentPreview();
                  }
                }}
              >
                {isVideo(previewAttachment) ? (
                  <video
                    key={previewAttachment.id}
                    src={previewAttachment.preview}
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
                    key={previewAttachment.id}
                    src={previewAttachment.preview}
                    alt={previewAttachment.name}
                    className="block max-h-[calc(100dvh-24px)] max-w-[calc(100vw-24px)] select-none object-contain sm:max-h-[calc(100dvh-40px)] sm:max-w-[calc(100vw-128px)]"
                    draggable="false"
                  />
                )}
              </div>

              {attachments.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => moveAttachmentPreview(-1)}
                    className="absolute left-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:left-6 sm:h-14 sm:w-14"
                    aria-label="Xem tệp trước"
                  >
                    <Lucide.ChevronLeft size={28} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => moveAttachmentPreview(1)}
                    className="absolute right-3 top-1/2 z-30 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-xl backdrop-blur transition hover:scale-105 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-6 sm:h-14 sm:w-14"
                    aria-label="Xem tệp tiếp theo"
                  >
                    <Lucide.ChevronRight size={28} aria-hidden="true" />
                  </button>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/75 via-black/20 to-transparent px-4 pb-4 pt-14">
                    <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
                      {previewAttachmentIndex + 1} / {attachments.length}
                    </span>
                  </div>
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}
      </div>
    </main>
  );
};
