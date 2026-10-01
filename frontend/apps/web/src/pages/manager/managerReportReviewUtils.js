const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const PRIORITY_LABELS = {
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  low: 'Thấp',
};

const CHANNEL_LABELS = {
  web: 'Cổng thông tin',
  mobile: 'Ứng dụng di động',
  chatbot: 'Trợ lý AI',
  ai: 'Trợ lý AI',
  hotline: 'Đường dây nóng',
  email: 'Email',
  manual: 'Nhập thủ công',
};

export const MISSING_VALUE = 'Chưa có dữ liệu';

export const formatReportCode = (value) => {
  const compact = String(value ?? '').replace(/-/g, '').trim().toUpperCase();
  return compact ? `PA-${compact.slice(0, 8)}` : MISSING_VALUE;
};

export const formatReviewDateTime = (value) => {
  if (!value) return MISSING_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING_VALUE;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const formatConfidence = (value) => {
  if (value === null || value === undefined || value === '') return MISSING_VALUE;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return MISSING_VALUE;
  const percentage = numericValue <= 1 ? numericValue * 100 : numericValue;
  return `${Math.round(Math.max(0, Math.min(100, percentage)))}%`;
};

export const getReviewPriority = (report = {}) => {
  const rawValue = report?.priority
    || report?.analysisResult?.urgencyLevel
    || report?.urgencyLevel
    || '';
  const key = normalizeKey(rawValue);
  if (key === 'critical' || key === 'urgent') return 'Urgent';
  if (key === 'high') return 'High';
  if (key === 'medium' || key === 'normal') return 'Medium';
  if (key === 'low') return 'Low';
  return '';
};

export const getPriorityLabel = (value) => (
  PRIORITY_LABELS[normalizeKey(value)] || MISSING_VALUE
);

export const getSubmissionChannelLabel = (value) => {
  if (!value) return MISSING_VALUE;
  return CHANNEL_LABELS[normalizeKey(value)] || String(value);
};

export const getAiCategoryId = (report = {}) => (
  report?.analysisResult?.detectedCategoryId
  ?? report?.detectedCategoryId
  ?? report?.categoryId
  ?? ''
);

export const getAiCategoryName = (report = {}) => (
  report?.analysisResult?.detectedCategoryName
  || report?.detectedCategoryName
  || report?.categoryName
  || MISSING_VALUE
);

export const isAiReviewedStatus = (value) => normalizeKey(value) === 'aireviewed';

export const findReviewReport = (items = [], feedbackId) => {
  const normalizedId = String(feedbackId ?? '').trim().toLowerCase();
  if (!normalizedId || !Array.isArray(items)) return null;
  return items.find((item) => (
    String(item?.feedbackId ?? item?.id ?? '').trim().toLowerCase() === normalizedId
  )) || null;
};

const normalizeAttachment = (attachment) => {
  if (!attachment) return null;
  if (typeof attachment === 'string') {
    return {
      id: attachment,
      url: attachment,
      fileType: '',
      name: attachment.split('/').pop() || 'Tệp đính kèm',
    };
  }

  const rawUrl = attachment.fileUrl
    || attachment.url
    || attachment.attachmentUrl
    || attachment.downloadUrl
    || '';
  if (!rawUrl) return null;

  const url = /^(https?:|blob:|data:|\/)/i.test(rawUrl) ? rawUrl : `/${rawUrl}`;
  return {
    ...attachment,
    id: attachment.attachmentId || attachment.id || url,
    url,
    fileType: attachment.fileType || attachment.mimeType || attachment.contentType || '',
    name: attachment.fileName || attachment.name || rawUrl.split('/').pop() || 'Tệp đính kèm',
  };
};

export const getReportAttachments = (report = {}) => {
  const collections = [
    report?.attachments,
    report?.feedbackAttachments,
    report?.files,
    report?.media,
  ];
  return collections.filter(Array.isArray).flat().map(normalizeAttachment).filter(Boolean);
};

export const isVideoAttachment = (attachment) => (
  /video\//i.test(attachment?.fileType || '')
  || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(attachment?.url || '')
);

export const isImageAttachment = (attachment) => (
  /image\//i.test(attachment?.fileType || '')
  || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(attachment?.url || '')
);

export const getRelatedIncidentId = (report = {}) => {
  const incidentId = report?.currentIncidentId ?? report?.incidentId;
  return incidentId === null || incidentId === undefined || incidentId === ''
    ? ''
    : String(incidentId);
};



export const getReviewQueueReturnContext = (state = {}) => {
  const from = typeof state?.from === 'string' ? state.from : '';
  if (from === '/management/map') {
    return {
      href: '/management/map',
      label: 'Quay lại bản đồ',
      state: { mapState: state?.mapState || null },
    };
  }
  if (from.startsWith('/analytics/sentiment')) {
    return {
      href: from,
      label: 'Quay lại Cảm xúc người dân',
      state: null,
    };
  }
  return null;
};

export const fetchAllAiReviewedPages = async (fetchPage, { pageSize = 100 } = {}) => {
  const firstPage = await fetchPage({ pageNumber: 1, pageSize });
  const firstItems = Array.isArray(firstPage?.items) ? firstPage.items : [];
  const totalPages = Math.max(1, Number(firstPage?.totalPages) || 1);
  const totalItems = Number.isFinite(Number(firstPage?.totalItems))
    ? Number(firstPage.totalItems)
    : firstItems.length;

  if (totalPages === 1) {
    return { items: firstItems, totalItems, partial: false };
  }

  const remaining = await Promise.allSettled(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      fetchPage({ pageNumber: index + 2, pageSize })
    )),
  );
  const fulfilled = remaining.filter((result) => result.status === 'fulfilled');

  return {
    items: [
      ...firstItems,
      ...fulfilled.flatMap((result) => (
        Array.isArray(result.value?.items) ? result.value.items : []
      )),
    ],
    totalItems,
    partial: fulfilled.length !== remaining.length,
  };
};
