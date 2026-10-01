export const MISSING_INCIDENT_VALUE = 'Chưa có dữ liệu';

const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const STATUS_LABELS = Object.freeze({
  new: 'Mới',
  open: 'Đang mở',
  verified: 'Đã xác nhận',
  assigned: 'Đã phân công',
  inprogress: 'Đang xử lý',
  submittedforapproval: 'Chờ duyệt kết quả',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
  rejected: 'Đã từ chối',
  merged: 'Đã gộp',
});

const PRIORITY_LABELS = Object.freeze({
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  low: 'Thấp',
});

const SEVERITY_LABELS = Object.freeze({
  critical: 'Nghiêm trọng',
  urgent: 'Nghiêm trọng',
  major: 'Cao',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  minor: 'Thấp',
  low: 'Thấp',
});

const getMappedLabel = (value, labels) => {
  if (value === null || value === undefined || value === '') return MISSING_INCIDENT_VALUE;
  return labels[normalizeKey(value)] || 'Chưa xác định';
};

export const getManagerIncidentStatusLabel = (value) => getMappedLabel(value, STATUS_LABELS);
export const getManagerIncidentPriorityLabel = (value) => getMappedLabel(value, PRIORITY_LABELS);
export const getManagerIncidentSeverityLabel = (value) => getMappedLabel(value, SEVERITY_LABELS);

export const formatManagerIncidentCode = (incidentId) => {
  const compact = String(incidentId ?? '').replace(/-/g, '').trim().toUpperCase();
  return compact ? `SV-${compact.slice(0, 8)}` : MISSING_INCIDENT_VALUE;
};

export const formatManagerIncidentDateTime = (value) => {
  if (!value) return MISSING_INCIDENT_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING_INCIDENT_VALUE;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const formatManagerIncidentCount = (value) => {
  if (value === null || value === undefined || value === '') return MISSING_INCIDENT_VALUE;
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('vi-VN') : MISSING_INCIDENT_VALUE;
};

export const collectIncidentEnumValues = (incidents = [], field, selectedValue = '') => {
  const values = new Set();
  incidents.forEach((incident) => {
    const value = String(incident?.[field] ?? '').trim();
    if (value) values.add(value);
  });
  if (selectedValue) values.add(selectedValue);
  return Array.from(values).sort((left, right) => left.localeCompare(right, 'vi'));
};

export const hasManagerIncidentFilters = (filters = {}) => Boolean(
  String(filters.search ?? '').trim()
  || filters.areaId
  || filters.categoryId
  || filters.status
  || filters.priority
  || filters.severity
  || filters.includeMerged,
);

export const getCandidateDisplayName = (candidate = {}) => (
  String(candidate?.staffName ?? '').trim() || 'Staff chưa có tên hiển thị'
);

export const getCandidateId = (candidate = {}) => String(candidate?.userId ?? '').trim();
