// src/pages/staff/ManagementFeedbackDetailPage.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useResolvedLocationText } from '../../hooks/useResolvedLocationText';
import { useFeedbackMessages } from '../../contexts/FeedbackMessagesContextHook';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { toolsApi } from '@urbanmind/shared-api';
import { managementTypes } from '@urbanmind/shared-types';
import { LoadingSpinner, EmptyState } from '@urbanmind/shared-ui';
import { ErrorAlert, SuccessAlert } from '../../components/alerts/ErrorAlert';
import DelightToast from '../../components/delight/DelightToast';
import IncidentMap from '../../components/maps/IncidentMap';
import { getCategoryLabel } from '../../utils/categoryLabels';
import * as Lucide from 'lucide-react';
import Button from '../../components/design-system/Button';
import RelatedIncidentCard from '../../components/staff/RelatedIncidentCard';
import { buildExternalMapUrl } from '../../config/mapConfig';
import { getSubmissionChannelLabel } from './incidentDetailPresentation';
import { getRelatedIncidentId } from './reportDetailPresentation';

export const ManagementFeedbackDetailPage = () => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState({ type: '', text: '' });
  const [categories, setCategories] = useState([]);

  const resolvedLocationText = useResolvedLocationText({
    locationText: feedback?.locationText,
    areaName: feedback?.areaName || feedback?.wardName || feedback?.area?.name,
    latitude: feedback?.latitude,
    longitude: feedback?.longitude,
  });

  const getUrgencyLevel = (currentFeedback) => {
    const urgency = currentFeedback?.priority || currentFeedback?.analysisResult?.urgencyLevel || currentFeedback?.urgencyLevel || currentFeedback?.urgency || '';
    return `${urgency}`.trim();
  };

  const getSuggestedSeverity = (urgency = '') => {
    const normalized = `${urgency || ''}`.trim().toLowerCase();
    if (normalized === 'critical') return 'Critical';
    if (normalized === 'high') return 'High';
    return 'Medium';
  };

  const getFeedbackAreaId = (currentFeedback) => {
    return currentFeedback?.areaId ?? currentFeedback?.area?.areaId ?? '';
  };

  const getFeedbackCategoryId = (currentFeedback) => {
    return currentFeedback?.categoryId ?? currentFeedback?.category?.categoryId ?? '';
  };

  // Area alert creation
  const [showAreaAlertModal, setShowAreaAlertModal] = useState(false);
  const [areaAlertForm, setAreaAlertForm] = useState({
    title: '',
    message: '',
    severity: 'Medium',
    startAt: '',
    endAt: '',
    radiusMeters: '',
    areaId: '',
    categoryId: '',
  });
  const [areaAlertErrors, setAreaAlertErrors] = useState({});
  const [areaAlertLoading, setAreaAlertLoading] = useState(false);
  const [areaAlertToast, setAreaAlertToast] = useState({ open: false, message: '', sub: '' });

  // Preview attachment
  const [previewAttachmentIndex, setPreviewAttachmentIndex] = useState(null);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState(null);

  // Internal communication
  const [messageDraft, setMessageDraft] = useState('');
  const [composerMode, setComposerMode] = useState('public');
  const messageViewportRef = useRef(null);
  const exchangeSectionRef = useRef(null);
  const initialExchangeFocusHandledRef = useRef(false);
  const [activeViewTab, setActiveViewTab] = useState(() => location.state?.focusExchange ? 'exchange' : 'detail');

  const {
    messages,
    messagesLoading,
    messagesError,
    messageSubmitting,
    loadMessages: reloadFeedbackMessages,
    sendMessage: sendFeedbackMessage,
  } = useFeedbackMessages();

  // Load feedback details
  useEffect(() => {
    let active = true;

    const loadFeedback = async () => {
      setLoading(true);
      setError('');
      try {
        const feedbackRes = await managementFeedbackApi.getFeedbackById(feedbackId);

        if (!active) return;

        setFeedback(feedbackRes);
        setLoading(false);

        let categoryOptions = [];
        try {
          const categoriesRes = await toolsApi.getCategories();
          categoryOptions = Array.isArray(categoriesRes) ? categoriesRes : [];
        } catch (categoryError) {
          console.warn('Failed to load categories for the area alert form', categoryError);
        }

        if (!active) return;

        setCategories(categoryOptions);
        setAreaAlertForm({
          title: feedbackRes?.title || feedbackRes?.description || '',
          message: feedbackRes?.description || feedbackRes?.title || '',
          severity: getSuggestedSeverity(getUrgencyLevel(feedbackRes)),
          startAt: '',
          endAt: '',
          radiusMeters: '',
          areaId: String(getFeedbackAreaId(feedbackRes) || ''),
          categoryId: String(getFeedbackCategoryId(feedbackRes) || ''),
        });
      } catch (err) {
        if (!active) return;
        console.error('Failed to load feedback details', err);
        setError('Không thể tải chi tiết phản ánh. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (feedbackId) {
      loadFeedback();
    }

    return () => {
      active = false;
    };
  }, [feedbackId]);

  useEffect(() => {
    if (!feedbackId) {
      return;
    }

    reloadFeedbackMessages();
  }, [feedbackId, reloadFeedbackMessages]);

  const handleMessageSend = async () => {
    if (!feedbackId || !messageDraft.trim()) return;

    try {
      const refreshed = await sendFeedbackMessage({
        messageText: messageDraft.trim(),
        isInternal: composerMode === 'internal',
      });

      if (refreshed) {
        sessionStorage.setItem('staff-conversation-count-dirty', '1');
        setMessageDraft('');
        setPageMessage({ type: '', text: '' });
      } else {
        setPageMessage({ type: '', text: '' });
      }
    } catch (err) {
      console.error('Failed to send feedback message', err);
      setPageMessage({ type: 'error', text: 'Không thể gửi trao đổi. Vui lòng thử lại.' });
    }
  };

  const handleAreaAlertFieldChange = (field, value) => {
    setAreaAlertForm((current) => ({ ...current, [field]: value }));
    setAreaAlertErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateAreaAlertForm = () => {
    const nextErrors = {};
    if (!areaAlertForm.title?.trim()) nextErrors.title = 'Vui lòng nhập tiêu đề cảnh báo.';
    if (!areaAlertForm.message?.trim()) nextErrors.message = 'Vui lòng nhập nội dung cảnh báo.';
    if (!areaAlertForm.severity?.trim()) nextErrors.severity = 'Vui lòng chọn mức độ nghiêm trọng.';
    if (!areaAlertForm.startAt?.trim()) nextErrors.startAt = 'Vui lòng chọn thời gian bắt đầu.';
    return nextErrors;
  };

  const handleCreateAreaAlert = async () => {
    const validationErrors = validateAreaAlertForm();
    if (Object.keys(validationErrors).length > 0) {
      setAreaAlertErrors(validationErrors);
      return;
    }

    setAreaAlertLoading(true);
    try {
      const payload = {
        title: areaAlertForm.title?.trim(),
        message: areaAlertForm.message?.trim(),
        severity: areaAlertForm.severity,
        startAt: areaAlertForm.startAt ? new Date(areaAlertForm.startAt).toISOString() : undefined,
        endAt: areaAlertForm.endAt ? new Date(areaAlertForm.endAt).toISOString() : undefined,
        radiusMeters: areaAlertForm.radiusMeters ? Number(areaAlertForm.radiusMeters) : undefined,
      };
      await managementFeedbackApi.createAreaAlertFromFeedback(feedbackId, payload);
      setShowAreaAlertModal(false);
      setAreaAlertToast({ open: true, message: 'Cảnh báo khu vực đã được tạo', sub: 'Cảnh báo mới đã gửi thành công từ phản ánh.' });
    } catch (err) {
      console.error('Failed to create area alert', err);
      const submitMessage = err?.message || 'Không thể tạo cảnh báo khu vực. Vui lòng thử lại.';
      setAreaAlertErrors({ submit: submitMessage });
      setAreaAlertToast({ open: true, message: 'Tạo cảnh báo khu vực thất bại', sub: submitMessage });
    } finally {
      setAreaAlertLoading(false);
    }
  };

  const getStatusLabel = (s) => {
    const labels = {
      [managementTypes.feedbackStatus.SUBMITTED]: 'Đã gửi',
      [managementTypes.feedbackStatus.AI_REVIEWED]: 'AI đã xem xét',
      [managementTypes.feedbackStatus.VERIFIED]: 'Đã xác minh',
      [managementTypes.feedbackStatus.ASSIGNED]: 'Đã giao',
      [managementTypes.feedbackStatus.IN_PROGRESS]: 'Đang xử lý',
      [managementTypes.feedbackStatus.RESOLVED]: 'Hoàn thành',
      [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: 'Chờ duyệt',
      [managementTypes.feedbackStatus.APPROVED]: 'Đã duyệt',
      [managementTypes.feedbackStatus.REJECTED]: 'Bị từ chối',
      [managementTypes.feedbackStatus.NEED_REWORK]: 'Cần sửa lại',
      [managementTypes.feedbackStatus.CLOSED]: 'Đã đóng',
      [managementTypes.feedbackStatus.CANCELLED]: 'Đã hủy',
    };
    return labels[s] || 'Chưa xác định';
  };

  const getPriorityLabel = (p) => {
    const labels = {
      'Low': 'Thấp',
      'Medium': 'Trung bình',
      'High': 'Cao',
      'Urgent': 'Khẩn cấp',
      'Critical': 'Khẩn cấp',
    };
    return labels[p] || 'Chưa có dữ liệu';
  };

  const isHighOrCriticalUrgency = (currentFeedback) => {
    const urgency = getUrgencyLevel(currentFeedback).toLowerCase();
    // Match common variants like 'High', 'high (ai)', 'HIGH', 'HighUrgency', etc.
    return urgency.includes('high') || urgency.includes('urgent') || urgency.includes('critical');
  };

  const forceShowAreaAlert = (() => {
    try {
      return typeof window !== 'undefined' && window.location.search.includes('forceAreaAlert');
    } catch {
      return false;
    }
  })();

  const formatDate = (date) => {
    if (!date) return '';
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return parsedDate.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isVideoFile = (fileUrl = '') => {
    const url = fileUrl.toLowerCase();
    return url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg') || url.includes('.mov') || url.includes('.m4v');
  };

  const getAttachmentUrl = (attachment) => {
    if (typeof attachment === 'string') return attachment;
    return attachment?.fileUrl || attachment?.url || attachment?.path || '';
  };

  const relatedIncidentId = getRelatedIncidentId(feedback);

  const attachments = useMemo(
    () => (Array.isArray(feedback?.attachments) ? feedback.attachments : []),
    [feedback]
  );
  const previewItems = useMemo(
    () => attachments.filter((attachment) => Boolean(getAttachmentUrl(attachment))),
    [attachments]
  );
  const previewAttachment = (
    previewAttachmentIndex !== null
    && previewAttachmentIndex >= 0
    && previewAttachmentIndex < previewItems.length
  )
    ? previewItems[previewAttachmentIndex]
    : null;
  const previewAttachmentUrl = previewAttachment ? getAttachmentUrl(previewAttachment) : '';

  const movePreview = useCallback((direction) => {
    if (previewItems.length < 2) return;

    setPreviewAttachmentIndex((currentIndex) => {
      if (currentIndex === null) return null;
      return (currentIndex + direction + previewItems.length) % previewItems.length;
    });
  }, [previewItems.length]);

  useEffect(() => {
    if (previewAttachmentIndex === null) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handlePreviewKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewAttachmentIndex(null);
      } else if (event.key === 'ArrowLeft') {
        movePreview(-1);
      } else if (event.key === 'ArrowRight') {
        movePreview(1);
      }
    };

    document.addEventListener('keydown', handlePreviewKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handlePreviewKeyDown);
    };
  }, [previewAttachmentIndex, movePreview]);


  useEffect(() => {
    if (activeViewTab !== 'exchange') return;
    const viewport = messageViewportRef.current;
    if (!viewport) return;

    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }, [activeViewTab, messages.length]);

  useEffect(() => {
    if (
      loading
      || activeViewTab !== 'exchange'
      || !location.state?.focusExchange
      || initialExchangeFocusHandledRef.current
    ) {
      return;
    }

    initialExchangeFocusHandledRef.current = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        exchangeSectionRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      });
    });
  }, [activeViewTab, loading, location.state]);

  const handleViewTabChange = (tabId) => {
    setActiveViewTab(tabId);

    if (tabId !== 'exchange') return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        exchangeSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    });
  };

  const comments = Array.isArray(feedback?.comments) ? feedback.comments : [];

  const statusHistories = useMemo(
    () => Array.isArray(feedback?.statusHistories) ? feedback.statusHistories : [],
    [feedback]
  );
  const sortedStatusHistories = useMemo(
    () => [...statusHistories].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt)),
    [statusHistories]
  );

  const timelineEvents = useMemo(() => {
    const events = [];
    const statusMeta = {
      [managementTypes.feedbackStatus.SUBMITTED]: {
        title: 'Đã gửi',
        subtitle: 'Phản ánh được tiếp nhận',
        accent: 'blue',
        icon: 'Send',
      },
      [managementTypes.feedbackStatus.AI_REVIEWED]: {
        title: 'AI đã xem xét',
        subtitle: 'Tự động phân loại và kiểm tra',
        accent: 'violet',
        icon: 'Sparkles',
      },
      [managementTypes.feedbackStatus.VERIFIED]: {
        title: 'Đã xác minh',
        subtitle: 'Thông tin được kiểm chứng',
        accent: 'sky',
        icon: 'BadgeCheck',
      },
      [managementTypes.feedbackStatus.ASSIGNED]: {
        title: 'Đã phân công',
        subtitle: 'Đơn vị xử lý được chỉ định',
        accent: 'indigo',
        icon: 'UserRoundCheck',
      },
      [managementTypes.feedbackStatus.IN_PROGRESS]: {
        title: 'Đang xử lý',
        subtitle: 'Đội xử lý đã bắt đầu công việc',
        accent: 'amber',
        icon: 'Wrench',
      },
      [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: {
        title: 'Đã nộp duyệt',
        subtitle: 'Kết quả sẵn sàng chờ phê duyệt',
        accent: 'amber',
        icon: 'FileCheck2',
      },
      [managementTypes.feedbackStatus.APPROVED]: {
        title: 'Đã duyệt',
        subtitle: 'Kết quả được chấp thuận',
        accent: 'emerald',
        icon: 'CheckCircle2',
      },
      [managementTypes.feedbackStatus.REJECTED]: {
        title: 'Đã từ chối',
        subtitle: 'Yêu cầu cần điều chỉnh',
        accent: 'rose',
        icon: 'XCircle',
      },
      [managementTypes.feedbackStatus.NEED_REWORK]: {
        title: 'Yêu cầu làm lại',
        subtitle: 'Bổ sung thông tin hoặc chỉnh sửa',
        accent: 'orange',
        icon: 'RefreshCw',
      },
      [managementTypes.feedbackStatus.CLOSED]: {
        title: 'Đã đóng',
        subtitle: 'Hồ sơ đã hoàn tất',
        accent: 'slate',
        icon: 'Archive',
      },
    };

    const pushEvent = (item) => {
      if (!item) return;
      events.push({
        id: item.id,
        type: item.type || 'status',
        title: item.title,
        subtitle: item.subtitle,
        actor: item.actor || 'Hệ thống',
        timestamp: item.timestamp,
        note: item.note || '',
        accent: item.accent || 'slate',
        icon: item.icon || 'CircleDot',
      });
    };

    if (feedback?.createdAt) {
      pushEvent({
        id: 'creation',
        type: 'status',
        title: 'Đã gửi',
        subtitle: 'Phản ánh được tạo và nhập vào hệ thống',
        actor: feedback?.submittedByName || feedback?.submittedBy || 'Công dân',
        timestamp: feedback.createdAt,
        note: feedback?.description || 'Phản ánh đã được ghi nhận trong hệ thống.',
        accent: 'blue',
        icon: 'Send',
      });
    }

    sortedStatusHistories.forEach((history, index) => {
      const meta = statusMeta[history.newStatus] || {
        title: getStatusLabel(history.newStatus),
        subtitle: 'Cập nhật trạng thái',
        accent: 'slate',
        icon: 'CircleDot',
      };
      const eventType = history.newStatus === managementTypes.feedbackStatus.ASSIGNED || history.newStatus === managementTypes.feedbackStatus.IN_PROGRESS
        ? 'assignment'
        : history.newStatus === managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL || history.newStatus === managementTypes.feedbackStatus.APPROVED || history.newStatus === managementTypes.feedbackStatus.REJECTED || history.newStatus === managementTypes.feedbackStatus.NEED_REWORK
          ? 'approval'
          : 'status';

      pushEvent({
        id: `history-${index}`,
        type: eventType,
        title: meta.title,
        subtitle: meta.subtitle,
        actor: history.changedByUserName || 'Hệ thống',
        timestamp: history.changedAt,
        note: history.note || '',
        accent: meta.accent,
        icon: meta.icon,
      });
    });

    if (feedback?.assignment?.operatorName) {
      const hasAssignmentEvent = events.some((event) => event.title === 'Đã phân công' || event.title === 'Đang xử lý');
      if (!hasAssignmentEvent) {
        pushEvent({
          id: 'assignment',
          type: 'assignment',
          title: 'Thay đổi phân công',
          subtitle: `Đã giao cho ${feedback.assignment.operatorName}`,
          actor: feedback.assignment.assignedByName || 'Hệ thống',
          timestamp: feedback.assignment.assignedAt || feedback.updatedAt || feedback.createdAt,
          note: feedback.assignment.note || 'Đơn vị xử lý đã được cập nhật.',
          accent: 'indigo',
          icon: 'UserRoundCheck',
        });
      }
    }

    if (feedback?.resolution?.resolutionSummary || feedback?.resolution?.notes) {
      pushEvent({
        id: 'resolution',
        type: 'approval',
        title: 'Kết quả xử lý',
        subtitle: 'Đơn vị xử lý đã nộp kết quả',
        actor: feedback?.assignment?.operatorName || 'Đơn vị xử lý',
        timestamp: feedback?.resolution?.submittedAt || feedback?.updatedAt || feedback?.createdAt,
        note: feedback?.resolution?.resolutionSummary || feedback?.resolution?.notes || '',
        accent: 'emerald',
        icon: 'FileCheck2',
      });
    }

    return events;
  }, [feedback, sortedStatusHistories]);

  useEffect(() => {
    if (timelineEvents.length > 0 && !selectedTimelineEventId) {
      setSelectedTimelineEventId(timelineEvents[0].id);
    }
  }, [timelineEvents, selectedTimelineEventId]);

  const isStaffMessage = (message) => {
    const normalizedRole = `${message?.userRole || ''}`.toLowerCase();
    const senderType = `${message?.senderType || ''}`.toLowerCase();
    return normalizedRole.includes('staff')
      || normalizedRole.includes('manager')
      || normalizedRole.includes('admin')
      || normalizedRole.includes('system')
      || senderType.includes('staff')
      || senderType.includes('system');
  };

  const getMessageAuthor = (message) => {
    return message?.userFullName || message?.userName || message?.author || 'Hệ thống';
  };

  const getMessageBody = (message) => {
    return message?.messageText || message?.message || message?.note || '';
  };

  const getMessageAvatar = (label) => {
    return (label || '')
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const messageItems = useMemo(() => {
    return Array.isArray(messages)
      ? [...messages].sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0))
      : [];
  }, [messages]);

  const groupedMessageBlocks = useMemo(() => {
    const blocks = [];
    let currentBlock = null;

    messageItems.forEach((message) => {
      const author = getMessageAuthor(message);
      const isInternal = Boolean(message?.isInternal);
      const isStaff = isStaffMessage(message) && !isInternal;
      const senderKey = `${isInternal ? 'internal' : isStaff ? 'staff' : 'resident'}|${author}`;

      if (!currentBlock || currentBlock.senderKey !== senderKey) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          senderKey,
          author,
          isInternal,
          isStaff,
          messages: [],
        };
      }

      currentBlock.messages.push(message);
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }, [messageItems]);

  const historyEvents = useMemo(() => {
    const accentPalette = {
      blue: { dot: 'bg-blue-600', pill: 'bg-blue-50 text-blue-700' },
      violet: { dot: 'bg-violet-600', pill: 'bg-violet-50 text-violet-700' },
      sky: { dot: 'bg-sky-600', pill: 'bg-sky-50 text-sky-700' },
      indigo: { dot: 'bg-indigo-600', pill: 'bg-indigo-50 text-indigo-700' },
      amber: { dot: 'bg-amber-600', pill: 'bg-amber-50 text-amber-700' },
      teal: { dot: 'bg-teal-600', pill: 'bg-teal-50 text-teal-700' },
      emerald: { dot: 'bg-emerald-600', pill: 'bg-emerald-50 text-emerald-700' },
      rose: { dot: 'bg-rose-600', pill: 'bg-rose-50 text-rose-700' },
      orange: { dot: 'bg-orange-600', pill: 'bg-orange-50 text-orange-700' },
      slate: { dot: 'bg-slate-500', pill: 'bg-slate-100 text-slate-700' },
    };

    const getActivityAccent = (accent) => accentPalette[accent] || accentPalette.slate;

    const mappedTimelineEvents = timelineEvents.map((event) => ({
      ...event,
      accentTone: getActivityAccent(event.accent),
      label: event.type === 'assignment' ? 'Phân công' : event.type === 'approval' ? 'Duyệt' : 'Trạng thái',
    }));

    return mappedTimelineEvents.sort(
      (left, right) => new Date(left.timestamp || 0) - new Date(right.timestamp || 0)
    );
  }, [timelineEvents]);

  const formatHistoryLabel = (event) => {
    if (event.type === 'assignment') return 'Phân công';
    if (event.type === 'approval') return 'Duyệt';
    return 'Trạng thái';
  };

  const returnToFeedbackList = useCallback(() => {
    if (location.state?.fromIncidentId) {
      navigate(-1);
      return;
    }

    if (location.state?.fromStaffConversations || location.state?.fromStaffFeedbackList) {
      navigate(-1);
      return;
    }

    navigate('/staff/feedbacks', {
      state: {
        restoreFeedbackId: String(feedbackId || ''),
      },
    });
  }, [location.state, navigate, feedbackId]);

  const detailParentLabel = location.state?.fromIncidentId
    ? 'Các phản ánh của sự vụ'
    : location.state?.fromStaffConversations
      ? 'Quản lý trao đổi'
      : 'Phản ánh';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="space-y-4">
        <ErrorAlert 
          title="Không thể tải chi tiết phản ánh"
          message={error || 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại hoặc quay lại danh sách.'}
        />
        <Button
          type="button"
          onClick={returnToFeedbackList}
          variant="outline"
          size="sm"
        >
          <Lucide.ArrowLeft size={16} />
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-page-shell space-y-6 p-4">
      {pageMessage.type === 'success' && (
        <SuccessAlert
          message={pageMessage.text}
          onClose={() => setPageMessage({ type: '', text: '' })}
        />
      )}
      {pageMessage.type === 'error' && (
        <ErrorAlert
          message={pageMessage.text}
          onClose={() => setPageMessage({ type: '', text: '' })}
        />
      )}
      <button
        type="button"
        onClick={returnToFeedbackList}
        className="inline-flex min-h-9 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:hidden"
        aria-label={`Quay lại ${detailParentLabel.toLowerCase()}`}
      >
        <Lucide.ArrowLeft size={15} aria-hidden="true" />
        {detailParentLabel}
      </button>
      <div className="admin-panel p-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Nội dung chi tiết phản ánh">
          {[
            { id: 'detail', label: 'Thông tin phản ánh', icon: Lucide.FileText },
            { id: 'exchange', label: 'Trao đổi về phản ánh', icon: Lucide.MessageSquareText },
            { id: 'history', label: 'Lịch sử', icon: Lucide.Clock3 },
          ].map((tab) => {
            const selected = activeViewTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => handleViewTabChange(tab.id)}
                className={`flex items-center gap-2 rounded-[0.9rem] px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${selected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeViewTab === 'detail' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.75fr)]" role="tabpanel" aria-label="Thông tin phản ánh">
        {/* Main Content */}
        <div className="min-w-0 space-y-6">
          <header className="admin-page-hero p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm" aria-hidden="true">
                <Lucide.FileText size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="admin-section-description uppercase tracking-[0.2em]">Chi tiết phản ánh</div>
                <h1 className="admin-hero-title mt-1 break-words">{feedback.title || 'Phản ánh chưa có tiêu đề'}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Phản ánh này là nguồn thông tin của người dân thuộc sự vụ đang được xử lý.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-blue-200 bg-white/80 px-3 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Trạng thái phản ánh</span>
                    <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <Lucide.CircleCheck size={14} aria-hidden="true" />
                      {getStatusLabel(feedback.status) || 'Chưa có dữ liệu'}
                    </span>
                  </div>
                  <div className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Mức ưu tiên</span>
                    <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <Lucide.Gauge size={14} aria-hidden="true" />
                      {getPriorityLabel(feedback.priority) || 'Chưa có dữ liệu'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Feedback summary */}
          <div className="space-y-4">
            <div className="admin-inset-panel p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Lucide.AlignLeft size={17} />
                </div>
                <div className="min-w-0">
                  <div className="admin-section-description uppercase tracking-[0.18em]">Nội dung phản ánh</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-900 whitespace-pre-line">
                    {feedback.description || 'Chưa có nội dung'}
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-panel overflow-hidden">
              <div className="border-b border-slate-200/80 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Lucide.Info size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Thông tin gửi phản ánh</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Dữ liệu được lưu tại thời điểm người dân gửi phản ánh.</p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2">
                {[
                  {
                    label: 'Người gửi',
                    value: feedback.userName || feedback.reporterName || 'Chưa có dữ liệu',
                    icon: Lucide.UserRound,
                  },
                  {
                    label: 'Thời gian gửi',
                    value: formatDate(feedback.createdAt) || 'Chưa có dữ liệu',
                    icon: Lucide.CalendarDays,
                  },
                  {
                    label: 'Kênh gửi',
                    value: getSubmissionChannelLabel(feedback.submissionChannel),
                    icon: Lucide.Radio,
                  },
                  {
                    label: 'Danh mục',
                    value: getCategoryLabel(feedback.categoryName || feedback.category?.name || feedback.categoryType || feedback.type) || 'Chưa có dữ liệu',
                    icon: Lucide.Tags,
                  },
                  {
                    label: 'Mã phản ánh',
                    value: feedback.feedbackCode || feedback.code || feedback.feedbackId || feedback.id || 'Chưa có dữ liệu',
                    icon: Lucide.Hash,
                  },
                  {
                    label: 'Cập nhật gần nhất',
                    value: formatDate(feedback.updatedAt) || 'Chưa có dữ liệu',
                    icon: Lucide.Clock3,
                  },
                ].map(({ label, value, icon: Icon }, index) => (
                  <div
                    key={label}
                    className={`flex min-w-0 items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 ${index % 2 === 0 ? 'sm:border-r sm:border-slate-100' : ''}`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
                      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
                    </div>
                  </div>
                ))}

                <div className="flex min-w-0 items-start gap-3 border-t border-slate-100 px-5 py-4 sm:col-span-2 sm:px-6">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <Lucide.MapPin size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Địa điểm</div>
                    <div className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900">{resolvedLocationText}</div>
                    {feedback?.areaName || feedback?.wardName || feedback?.area?.name ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {feedback?.areaName || feedback?.wardName || feedback?.area?.name}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          {feedback.latitude && feedback.longitude && (
            <div className="admin-panel relative overflow-visible p-4 rounded-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="admin-section-description uppercase tracking-[0.2em]">Vị trí phản ánh</div>
                    <div className="admin-section-title mt-1">Bản đồ vị trí</div>
                  <div className="mt-1 text-sm text-slate-500">Xem vị trí trên bản đồ hoặc mở nhanh bằng Google Maps.</div>
                </div>
                <a
                  href={buildExternalMapUrl(feedback.latitude, feedback.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <Lucide.MapPin size={12} />
                  Google Maps
                </a>
              </div>
              <div className="h-[300px] rounded-3xl overflow-hidden">
                <IncidentMap incidents={[feedback]} />
              </div>
              <div className="mt-4 flex items-center justify-end">
                {(isHighOrCriticalUrgency(feedback) || forceShowAreaAlert) && (
                  <div className="relative">
                    <Button
                      type="button"
                      onClick={() => setShowAreaAlertModal(true)}
                      disabled={areaAlertLoading}
                      variant="primary"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      <Lucide.BellRing size={14} />
                      Tạo cảnh báo khu vực
                    </Button>

                    {showAreaAlertModal && (
                      <div className="absolute right-0 bottom-full mb-3 z-50 w-[min(100vw-2rem,36rem)] admin-panel shadow-xl">
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-900">Tạo cảnh báo khu vực</h2>
                              <p className="mt-1 text-sm text-slate-500">Giữ lại thông tin từ phản ánh và điều chỉnh trước khi gửi.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowAreaAlertModal(false)}
                              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                              aria-label="Đóng"
                            >
                              <Lucide.X size={18} />
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                              <span>Tiêu đề</span>
                              <input
                                value={areaAlertForm.title}
                                onChange={(e) => handleAreaAlertFieldChange('title', e.target.value)}
                                className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                              />
                              {areaAlertErrors.title && <span className="text-xs font-medium text-rose-600">{areaAlertErrors.title}</span>}
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                              <span>Mức độ</span>
                              <select
                                value={areaAlertForm.severity}
                                onChange={(e) => handleAreaAlertFieldChange('severity', e.target.value)}
                                className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                              >
                                <option value="Critical">Khẩn cấp</option>
                                <option value="High">Cao</option>
                                <option value="Medium">Trung bình</option>
                                <option value="Low">Thấp</option>
                              </select>
                              {areaAlertErrors.severity && <span className="text-xs font-medium text-rose-600">{areaAlertErrors.severity}</span>}
                            </label>
                          </div>

                          <label className="flex flex-col gap-2 mt-3 text-sm font-semibold text-slate-700">
                            <span>Nội dung cảnh báo</span>
                            <textarea
                              value={areaAlertForm.message}
                              onChange={(e) => handleAreaAlertFieldChange('message', e.target.value)}
                              rows={2}
                              className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                            />
                            {areaAlertErrors.message && <span className="text-xs font-medium text-rose-600">{areaAlertErrors.message}</span>}
                          </label>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                              <span>Bán kính (m)</span>
                              <input
                                type="number"
                                value={areaAlertForm.radiusMeters}
                                onChange={(e) => handleAreaAlertFieldChange('radiusMeters', e.target.value)}
                                className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                              <span>Danh mục</span>
                              <select
                                value={areaAlertForm.categoryId}
                                onChange={(e) => handleAreaAlertFieldChange('categoryId', e.target.value)}
                                className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                              >
                                <option value="">Không chọn</option>
                                {categories.map((cat) => (
                                  <option key={cat.categoryId} value={cat.categoryId}>{getCategoryLabel(cat.categoryName || cat.name || cat.categoryType || cat.type)}</option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                              <span>Bắt đầu</span>
                              <input
                                type="datetime-local"
                                value={areaAlertForm.startAt}
                                onChange={(e) => handleAreaAlertFieldChange('startAt', e.target.value)}
                                className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                              />
                              {areaAlertErrors.startAt && <span className="text-xs font-medium text-rose-600">{areaAlertErrors.startAt}</span>}
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                              <span>Kết thúc</span>
                              <input
                                type="datetime-local"
                                value={areaAlertForm.endAt}
                                onChange={(e) => handleAreaAlertFieldChange('endAt', e.target.value)}
                                className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-slate-400"
                              />
                            </label>
                          </div>

                          {areaAlertErrors.submit && (
                            <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mt-4">
                              {areaAlertErrors.submit}
                            </div>
                          )}

                          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              onClick={() => setShowAreaAlertModal(false)}
                              variant="ghost"
                            >
                              Hủy
                            </Button>
                            <Button
                              type="button"
                              onClick={handleCreateAreaAlert}
                              disabled={areaAlertLoading}
                              variant="primary"
                            >
                              {areaAlertLoading ? <span className="loading loading-spinner loading-xs" /> : 'Tạo cảnh báo'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          {activeViewTab === 'detail' && (
            <div className="admin-panel p-6 space-y-4">
              <h3 className="font-bold text-slate-900">Hình ảnh và tệp đính kèm ({previewItems.length})</h3>
              {previewItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {previewItems.map((attachment, idx) => {
                  const fileUrl = getAttachmentUrl(attachment);
                  const isVideo = isVideoFile(fileUrl);
                  const attachmentKey = attachment?.attachmentId || attachment?.id || fileUrl || `attachment-${idx}`;
                  return (
                    <button
                      type="button"
                      key={attachmentKey}
                      className="group relative overflow-hidden rounded-xl bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                      onClick={() => setPreviewAttachmentIndex(idx)}
                      aria-label={`Xem tệp đính kèm ${idx + 1}`}
                    >
                      {isVideo ? (
                        <div className="w-full aspect-video bg-primary/80 flex items-center justify-center group-hover:bg-primary/90">
                          <Lucide.Play className="text-white" size={32} />
                        </div>
                      ) : (
                        <img
                          src={fileUrl}
                          alt={attachment?.fileName || attachment?.name || `Tệp đính kèm ${idx + 1}`}
                          className="w-full aspect-video object-cover group-hover:opacity-75"
                        />
                      )}
                      <span className="absolute inset-0 bg-primary/0 transition group-hover:bg-primary/20" aria-hidden="true" />
                    </button>
                  );
                })}
                </div>
              ) : (
                <EmptyState
                  title="Chưa có hình ảnh hoặc tệp đính kèm"
                  description="Phản ánh này chưa có minh chứng được người dân gửi kèm."
                />
              )}
            </div>
          )}

          {/* Comments */}
          {activeViewTab === 'detail' ? (
            <div className="admin-panel p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">Bình luận</h3>
                <span className="text-xs text-slate-500">{comments.length} bình luận</span>
              </div>
              {comments.length === 0 ? (
                <EmptyState
                  title="Chưa có bình luận nào"
                  description="Phản ánh này hiện chưa có bình luận nào."
                />
              ) : (
                <div className="space-y-4">
                  {comments.map((comment, idx) => (
                    <div key={comment.commentId || comment.id || idx} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-slate-800">{comment.userName || comment.author || 'Người dùng'}</div>
                        <div className="text-[10px] text-slate-500">
                          {formatDate(comment.createdAt) || 'Chưa có dữ liệu'}
                        </div>
                      </div>
                      <div className="mt-2 text-slate-700 whitespace-pre-line">{comment.content || comment.message || comment.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}


        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-6">
          <RelatedIncidentCard
            incidentId={relatedIncidentId}
          />

          <section className="admin-panel overflow-hidden" aria-labelledby="report-context-title">
            <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700" aria-hidden="true">
                <Lucide.BookOpenText size={17} />
              </span>
              <div className="min-w-0">
                <h2 id="report-context-title" className="font-bold text-slate-900">Nguồn thông tin phản ánh</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Mọi thao tác xử lý được thực hiện tại trang chi tiết sự vụ.</p>
              </div>
            </header>
            <div className="space-y-2.5 p-5">
              <Button
                type="button"
                onClick={() => handleViewTabChange('exchange')}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Lucide.MessageSquareText size={15} aria-hidden="true" />
                Trao đổi về phản ánh
              </Button>
              <Button
                type="button"
                onClick={() => navigate(`/staff/feedbacks/${feedbackId}/request-info`)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Lucide.MessageSquarePlus size={15} aria-hidden="true" />
                Yêu cầu thêm thông tin
              </Button>
            </div>
          </section>

        </div>
      </div>
      ) : null}

      {activeViewTab === 'exchange' ? (
        <section ref={exchangeSectionRef} className="admin-panel scroll-mt-5 overflow-hidden" role="tabpanel" aria-label="Trao đổi về phản ánh">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">Trao đổi về phản ánh</div>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Hội thoại với người dân</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Phản hồi người dân và lưu ghi chú nội bộ trong cùng hồ sơ phản ánh.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Lucide.MessagesSquare size={16} className="text-blue-600" aria-hidden="true" />
                <span className="text-sm font-semibold text-slate-700">{messages.length} tin nhắn</span>
              </div>
            </div>
          </div>

          <div className="grid h-[560px] min-h-0 grid-rows-[minmax(0,1fr)_auto]">
            <div className="min-h-0 px-5 pt-5">
              {messagesLoading ? (
                <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <span className="loading loading-spinner loading-sm mr-2" />
                  Đang tải trao đổi...
                </div>
              ) : messagesError ? (
                <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 text-center text-sm text-rose-700">
                  {messagesError}
                </div>
              ) : groupedMessageBlocks.length === 0 ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                    <Lucide.MessagesSquare size={21} aria-hidden="true" />
                  </span>
                  <div className="mt-3 text-base font-semibold text-slate-900">Chưa có trao đổi</div>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Bắt đầu bằng một phản hồi cho người dân hoặc tạo ghi chú nội bộ cho cán bộ phụ trách.
                  </p>
                </div>
              ) : (
                <div
                  ref={messageViewportRef}
                  className="h-full min-h-[260px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 sm:px-5"
                >
                  <div className="space-y-5">
                    {groupedMessageBlocks.map((block) => {
                      const blockKey = `${block.senderKey}-${block.messages[0]?.interactionMessageId || block.messages[0]?.id}`;
                      const isStaffPublic = block.isStaff && !block.isInternal;

                      return (
                        <div
                          key={blockKey}
                          className={`flex ${
                            block.isInternal
                              ? 'justify-center'
                              : isStaffPublic
                                ? 'justify-end'
                                : 'justify-start'
                          }`}
                        >
                          <div className={block.isInternal ? 'w-full max-w-[92%]' : 'w-full max-w-[72%]'}>
                            <div className={`mb-1.5 flex items-center gap-2 ${isStaffPublic ? 'justify-end' : ''}`}>
                              {!isStaffPublic ? (
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                    block.isInternal
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {block.isInternal ? (
                                    <Lucide.LockKeyhole size={14} aria-hidden="true" />
                                  ) : (
                                    getMessageAvatar(block.author)
                                  )}
                                </div>
                              ) : null}

                              <span className="text-xs font-semibold text-slate-800">{block.author}</span>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  block.isInternal
                                    ? 'bg-amber-100 text-amber-700'
                                    : block.isStaff
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {block.isInternal ? 'Nội bộ' : block.isStaff ? 'Nhân viên' : 'Người dân'}
                              </span>

                              {isStaffPublic ? (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                                  {getMessageAvatar(block.author)}
                                </div>
                              ) : null}
                            </div>

                            {block.isInternal ? (
                              <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <Lucide.LockKeyhole size={14} className="shrink-0" aria-hidden="true" />
                                Chỉ quản lý và nhân viên có thể xem.
                              </div>
                            ) : null}

                            <div className="space-y-2">
                              {block.messages.map((message) => {
                                const body = getMessageBody(message);

                                return (
                                  <div key={message?.interactionMessageId || message?.id}>
                                    <div
                                      className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                                        block.isInternal
                                          ? 'border border-amber-200 bg-amber-50 text-amber-950'
                                          : block.isStaff
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-slate-200 bg-white text-slate-800'
                                      }`}
                                    >
                                      <div className="whitespace-pre-line break-words">{body || 'Chưa có nội dung'}</div>
                                    </div>

                                    <div
                                      className={`mt-1 px-1 text-[11px] text-slate-400 ${
                                        isStaffPublic ? 'text-right' : ''
                                      }`}
                                    >
                                      {formatDate(message?.createdAt) || 'Chưa có dữ liệu'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'public', label: 'Trả lời người dân', icon: Lucide.Send },
                  { id: 'internal', label: 'Ghi chú nội bộ', icon: Lucide.LockKeyhole },
                ].map((mode) => {
                  const selected = composerMode === mode.id;
                  const ModeIcon = mode.icon;

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setComposerMode(mode.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                        selected
                          ? mode.id === 'internal'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <ModeIcon size={14} aria-hidden="true" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-end gap-3">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">
                    {composerMode === 'internal' ? 'Nội dung ghi chú' : 'Nội dung phản hồi'}
                  </span>
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.shiftKey) return;
                      if (event.nativeEvent?.isComposing) return;

                      event.preventDefault();

                      if (!messageSubmitting && messageDraft.trim()) {
                        handleMessageSend();
                      }
                    }}
                    rows={2}
                    placeholder={
                      composerMode === 'internal'
                        ? 'Nhập ghi chú nội bộ...'
                        : 'Nhập phản hồi cho người dân...'
                    }
                    className="min-h-[72px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <Button
                  type="button"
                  onClick={handleMessageSend}
                  disabled={messageSubmitting || !messageDraft.trim()}
                  variant="primary"
                  size="sm"
                  className="mb-1 shrink-0"
                >
                  {messageSubmitting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Lucide.Send size={14} />
                  )}
                  {composerMode === 'internal' ? 'Lưu' : 'Gửi'}
                </Button>
              </div>

              <div className="mt-1 text-xs text-slate-400">{messageDraft.length} ký tự</div>
            </div>
          </div>
        </section>
      ) : null}

      {activeViewTab === 'history' ? (
        <div className="space-y-6" role="tabpanel" aria-label="Lịch sử phản ánh">
          <div className="admin-panel p-6 space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Theo dõi hồ sơ</div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Dòng sự kiện phản ánh</h3>
              <p className="mt-1 text-sm text-slate-500">Xem lại các cập nhật và quyết định đã được ghi nhận cho phản ánh từ lúc tiếp nhận đến hiện tại.</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Tổng số</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{historyEvents.length}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Theo dõi từ đầu đến cuối</div>
              </div>

              <ol className="mt-6 space-y-6">
                {historyEvents.map((event, index) => {
                  const isLast = index === historyEvents.length - 1;
                  return (
                    <li key={event.id || `${event.title}-${index}`} className="relative flex gap-4">
                      <div className="flex flex-col items-center text-center">
                        <div className={`${event.accentTone.dot} h-3.5 w-3.5 rounded-full`} aria-hidden="true" />
                        {!isLast && <div className="mt-2 h-full w-px bg-slate-200" aria-hidden="true" />}
                      </div>
                      <div className="flex-1 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                            {event.subtitle ? <div className="mt-1 text-sm text-slate-500">{event.subtitle}</div> : null}
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${event.accentTone.pill}`}>
                            {formatHistoryLabel(event)}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Người thực hiện</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{event.actor || 'Hệ thống'}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Thời gian</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(event.timestamp) || 'Chưa có dữ liệu'}</div>
                          </div>
                        </div>

                        {event.note ? (
                          <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-line">
                            {event.note === 'Phản ánh được tạo' ? 'Phản ánh được tạo' : event.note}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      ) : null}

      {/* Attachment Preview */}
      {previewAttachment && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[99999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/20 p-4 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-detail-media-preview-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setPreviewAttachmentIndex(null);
              }
            }}
          >
            <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/95 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2
                    id="staff-detail-media-preview-title"
                    className="truncate text-sm font-semibold text-slate-900 sm:text-base"
                  >
                    {previewAttachment?.fileName || previewAttachment?.name || `Tệp đính kèm ${previewAttachmentIndex + 1}`}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {previewAttachmentIndex + 1} / {previewItems.length}
                    {previewItems.length > 1 ? (
                      <span className="hidden sm:inline"> · Dùng phím ← → để chuyển tệp</span>
                    ) : null}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewAttachmentIndex(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  aria-label="Đóng xem trước"
                >
                  <Lucide.X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-50/70 p-3 sm:p-5">
                {isVideoFile(previewAttachmentUrl) ? (
                  <video
                    key={previewAttachmentUrl}
                    src={previewAttachmentUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="block max-h-full max-w-full rounded-xl object-contain"
                  >
                    Trình duyệt của bạn không hỗ trợ phát video.
                  </video>
                ) : (
                  <img
                    key={previewAttachmentUrl}
                    src={previewAttachmentUrl}
                    alt={previewAttachment?.fileName || previewAttachment?.name || `Tệp đính kèm ${previewAttachmentIndex + 1}`}
                    className="block max-h-full max-w-full select-none rounded-xl object-contain shadow-sm"
                    draggable="false"
                  />
                )}

                {previewItems.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => movePreview(-1)}
                      className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 sm:left-5"
                      aria-label="Xem tệp trước"
                    >
                      <Lucide.ChevronLeft size={24} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => movePreview(1)}
                      className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 sm:right-5"
                      aria-label="Xem tệp tiếp theo"
                    >
                      <Lucide.ChevronRight size={24} aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )
        : null}

      <DelightToast open={areaAlertToast.open} message={areaAlertToast.message} sub={areaAlertToast.sub} onClose={() => setAreaAlertToast({ open: false, message: '', sub: '' })} />
    </div>
  );
};
