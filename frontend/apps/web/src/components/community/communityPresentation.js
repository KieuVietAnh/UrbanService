const CATEGORY_LABELS = Object.freeze({
  'garbage collection': 'Thu gom rác',
  'waste management': 'Quản lý chất thải',
  'road maintenance': 'Bảo trì đường bộ',
  'street lighting': 'Chiếu sáng đô thị',
  drainage: 'Thoát nước',
  'water supply': 'Cấp nước',
  'public safety': 'An toàn công cộng',
});

const STATUS_META = Object.freeze({
  submitted: { label: 'Đang tiếp nhận', tone: 'neutral' },
  aireviewed: { label: 'Đang tiếp nhận', tone: 'neutral' },
  new: { label: 'Đã tiếp nhận', tone: 'info' },
  open: { label: 'Đã tiếp nhận', tone: 'info' },
  verified: { label: 'Đã tiếp nhận', tone: 'info' },
  pending: { label: 'Chờ xử lý', tone: 'warning' },
  assigned: { label: 'Đã chuyển xử lý', tone: 'info' },
  inprogress: { label: 'Đang được xử lý', tone: 'info' },
  needrework: { label: 'Đang bổ sung xử lý', tone: 'warning' },
  submittedforapproval: { label: 'Đang kiểm tra kết quả', tone: 'warning' },
  resolved: { label: 'Đã có kết quả', tone: 'success' },
  approved: { label: 'Đã xử lý xong', tone: 'success' },
  closed: { label: 'Đã xử lý xong', tone: 'success' },
  merged: { label: 'Đã gộp sự vụ', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  canceled: { label: 'Đã hủy', tone: 'neutral' },
  rejected: { label: 'Không công khai', tone: 'neutral' },
});

const HIDDEN_PUBLIC_STATUS_KEYS = new Set([
  'submitted',
  'aireviewed',
  'merged',
  'cancelled',
  'canceled',
  'rejected',
]);

const PROCESSING_STATUS_KEYS = new Set([
  'new',
  'open',
  'verified',
  'pending',
  'assigned',
  'inprogress',
  'needrework',
  'submittedforapproval',
  'resolved',
]);

const ENDED_STATUS_KEYS = new Set(['approved', 'closed']);

const normalizeCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const getCommunityStatusKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLocaleLowerCase('en-US');

export const getCommunityIncidentId = (item = {}) => (
  item?.incidentId ||
  item?.id ||
  ''
);

export const getCommunityInteractionFeedbackId = (item = {}) => (
  item?.primaryFeedbackId ||
  item?.representativeFeedbackId ||
  item?.primaryReportId ||
  item?.representativeReportId ||
  item?.interactionFeedbackId ||
  item?.interactionReportId ||
  ''
);

export const getCommunityReportCount = (item = {}) => {
  const explicitValue = (
    item?.reportCount ??
    item?.reportsCount ??
    item?.feedbackCount ??
    item?.linkedFeedbackCount
  );
  const explicitCount = Number(explicitValue);
  if (explicitValue !== undefined && explicitValue !== null && Number.isFinite(explicitCount)) {
    return Math.max(0, explicitCount);
  }

  if (Array.isArray(item?.reports)) return item.reports.length;
  if (Array.isArray(item?.feedbacks)) return item.feedbacks.length;

  const sourceCount = Number(item?.__feedSourceCount);
  return Number.isFinite(sourceCount) ? Math.max(0, sourceCount) : 0;
};

export const translateResidentCategory = (categoryName) => {
  const raw = String(categoryName || '').trim();
  const normalized = raw.toLocaleLowerCase('en-US');
  return CATEGORY_LABELS[normalized] || raw;
};

export const getResidentStatusMeta = (status) => (
  STATUS_META[getCommunityStatusKey(status)] || {
    label: 'Đang cập nhật',
    tone: 'neutral',
  }
);

export const isCommunityPublicIncidentStatus = (status) => {
  const key = getCommunityStatusKey(status);
  return Boolean(key) && !HIDDEN_PUBLIC_STATUS_KEYS.has(key);
};

export const isCommunityProcessingIncidentStatus = (status) => (
  PROCESSING_STATUS_KEYS.has(getCommunityStatusKey(status))
);

export const isCommunityEndedIncidentStatus = (status) => (
  ENDED_STATUS_KEYS.has(getCommunityStatusKey(status))
);

export const getCommunityItemTitle = (item = {}) => (
  item?.incidentTitle ||
  item?.title ||
  item?.incidentSummary ||
  item?.summary ||
  item?.incidentDescription ||
  item?.description ||
  'Sự vụ đô thị quanh bạn'
);

export const getCommunityItemDescription = (item = {}) => (
  item?.incidentDescription ||
  item?.description ||
  item?.incidentSummary ||
  item?.summary ||
  ''
);

export const getCommunityItemContext = (item = {}) => ({
  areaName: item?.incidentAreaName || item?.areaName || item?.wardName || item?.districtName || item?.locationText || 'Chưa xác định khu vực',
  categoryName: translateResidentCategory(item?.incidentCategoryName || item?.categoryName || item?.category?.name),
  supportCount: normalizeCount(item?.supportCount ?? item?.supports),
  commentCount: normalizeCount(item?.commentCount ?? (Array.isArray(item?.comments) ? item.comments.length : 0)),
  subscriberCount: normalizeCount(item?.subscriberCount ?? item?.subscribersCount),
  reportCount: getCommunityReportCount(item),
});
