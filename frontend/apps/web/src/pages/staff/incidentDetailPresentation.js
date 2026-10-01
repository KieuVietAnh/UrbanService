const EMPTY_VALUE = 'Chưa có dữ liệu';

const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const REPORT_STATUS_LABELS = Object.freeze({
  submitted: 'Đã gửi',
  aireviewed: 'Đang xem xét',
  verified: 'Đã xác minh',
  assigned: 'Đã phân công',
  inprogress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  submittedforapproval: 'Chờ nghiệm thu',
  approved: 'Đã duyệt',
  needrework: 'Cần làm lại',
  rejected: 'Bị từ chối',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
});

const INCIDENT_STATUS_LABELS = Object.freeze({
  new: 'Mới',
  verified: 'Đã xác nhận',
  assigned: 'Đã phân công',
  inprogress: 'Đang xử lý',
  submittedforapproval: 'Chờ duyệt kết quả',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  merged: 'Đã gộp',
});

export const formatReportCode = (feedbackId) => {
  const compact = String(feedbackId ?? '').replace(/-/g, '').trim().toUpperCase();
  return compact ? `UM-${compact.slice(0, 8)}` : EMPTY_VALUE;
};

export const formatIncidentCode = (incidentId) => {
  const compact = String(incidentId ?? '').replace(/-/g, '').trim().toUpperCase();
  return compact ? `SV-${compact.slice(0, 8)}` : EMPTY_VALUE;
};

export const formatOperationalDateTime = (value) => {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const formatConfidence = (value) => {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return EMPTY_VALUE;

  const percentage = parsed >= 0 && parsed <= 1 ? parsed * 100 : parsed;
  return `${Math.max(0, Math.min(100, percentage)).toLocaleString('vi-VN', {
    maximumFractionDigits: 1,
  })}%`;
};

export const getReportStatusLabel = (value) => (
  value ? REPORT_STATUS_LABELS[normalizeKey(value)] || 'Chưa xác định' : EMPTY_VALUE
);

export const getIncidentStatusLabel = (value) => (
  value ? INCIDENT_STATUS_LABELS[normalizeKey(value)] || 'Chưa xác định' : EMPTY_VALUE
);

const firstPresentValue = (...values) => values.find((value) => (
  value !== null
  && value !== undefined
  && String(value).trim() !== ''
)) ?? null;

export const getIncidentLifecycleMilestones = (
  incident = {},
  sla = null,
  { slaLoading = false } = {},
) => {
  const status = normalizeKey(incident?.status);
  const isResolved = ['approved', 'resolved', 'closed'].includes(status);
  const isClosed = status === 'closed';

  return {
    dueAt: firstPresentValue(incident?.dueDate, sla?.resolutionDueAt),
    duePlaceholder: slaLoading ? 'Đang tải hạn SLA…' : 'Chưa thiết lập hạn xử lý',
    resolvedAt: firstPresentValue(incident?.resolvedAt),
    resolvedPlaceholder: isResolved ? 'Backend chưa ghi nhận thời điểm' : 'Chưa giải quyết',
    closedAt: firstPresentValue(incident?.closedAt),
    closedPlaceholder: isClosed ? 'Backend chưa ghi nhận thời điểm' : 'Chưa đóng',
  };
};

export const getSubmissionChannelLabel = (value) => {
  const key = normalizeKey(value);
  if (!key) return EMPTY_VALUE;
  if (key.includes('mobile') || key === 'app') return 'Ứng dụng di động';
  if (key.includes('web')) return 'Cổng thông tin';
  if (key.includes('hotline') || key.includes('phone')) return 'Điện thoại';
  if (key.includes('email')) return 'Email';
  if (key.includes('staff') || key.includes('internal')) return 'Nội bộ';
  return 'Kênh khác';
};

export const getReportLinkMethodLabel = (value) => {
  const key = normalizeKey(value);
  if (!key) return EMPTY_VALUE;
  if (key.includes('ai') && (key.includes('manager') || key.includes('confirm'))) {
    return 'AI đề xuất, Manager xác nhận';
  }
  if (key.includes('ai')) return 'AI đề xuất';
  if (key.includes('manual')) return 'Ghép thủ công';
  if (
    key.includes('initial')
    || key.includes('origin')
    || key.includes('primary')
    || key.includes('created')
  ) {
    return 'Phản ánh khởi tạo sự vụ';
  }
  return 'Chưa xác định';
};

export const getReportLinkRoleLabel = (value) => {
  const key = normalizeKey(value);
  if (!key) return EMPTY_VALUE;
  if (key.includes('primary') || key.includes('origin') || key.includes('initial')) {
    return 'Phản ánh khởi tạo sự vụ';
  }
  if (key.includes('support') || key.includes('related') || key.includes('additional')) {
    return 'Phản ánh bổ sung thông tin';
  }
  return 'Chưa xác định';
};

export const getReportLinkStatusLabel = (value) => {
  const key = normalizeKey(value);
  if (!key) return EMPTY_VALUE;
  if (key.includes('confirm')) return 'Đã xác nhận';
  if (key.includes('active') && !key.includes('inactive')) return 'Đang liên kết';
  if (key.includes('unlink') || key.includes('remove') || key.includes('inactive')) {
    return 'Đã ngừng liên kết';
  }
  return 'Chưa xác định';
};

export const parseIncidentEventPayload = (payloadJson) => {
  if (!payloadJson) return null;
  if (payloadJson && typeof payloadJson === 'object' && !Array.isArray(payloadJson)) {
    return payloadJson;
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const getIncidentEventTitle = (eventType) => {
  const key = normalizeKey(eventType);
  if (!key) return 'Hoạt động sự vụ';

  const referencesReport = key.includes('report') || key.includes('feedback');
  if (referencesReport && (key.includes('unlink') || key.includes('remove'))) {
    return 'Liên kết phản ánh được cập nhật';
  }
  if (referencesReport && (key.includes('link') || key.includes('attach') || key.includes('add'))) {
    return 'Phản ánh được liên kết';
  }
  if (referencesReport && (key.includes('submit') || key.includes('create') || key.includes('receive'))) {
    return 'Phản ánh được ghi nhận';
  }
  if (key.includes('assign')) return 'Sự vụ được phân công';
  if (key.includes('status')) return 'Trạng thái sự vụ thay đổi';
  if (key.includes('merge')) return 'Sự vụ được gộp';
  if (key.includes('ai') || key.includes('analysis')) return 'AI phân tích sự vụ';
  if (key.includes('create')) return 'Sự vụ được tạo';
  if (key.includes('update')) return 'Thông tin sự vụ được cập nhật';
  return 'Hoạt động sự vụ';
};

export const getIncidentEventDescription = (event) => {
  const payload = parseIncidentEventPayload(event?.payloadJson);
  const note = payload?.note || payload?.reason || payload?.description;
  if (typeof note === 'string' && note.trim()) return note.trim();
  if (event?.feedbackId) return `Liên quan đến ${formatReportCode(event.feedbackId)}.`;
  return 'Hoạt động được ghi nhận trên sự vụ.';
};

export const getIncidentEventMetadata = (event) => {
  const payload = parseIncidentEventPayload(event?.payloadJson);
  if (!payload) return [];

  const metadata = [];
  const add = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'object') return;
    metadata.push({ label, value: String(value) });
  };

  if (payload.oldStatus) add('Trạng thái trước', getIncidentStatusLabel(payload.oldStatus));
  if (payload.newStatus) add('Trạng thái sau', getIncidentStatusLabel(payload.newStatus));
  if (!payload.newStatus && payload.status) add('Trạng thái', getIncidentStatusLabel(payload.status));
  add('Staff phụ trách', payload.assignedStaffName || payload.staffName || payload.assigneeName);
  if (payload.feedbackId || payload.reportId) {
    add('Mã phản ánh', formatReportCode(payload.feedbackId || payload.reportId));
  }
  if (payload.sourceIncidentId) add('Sự vụ nguồn', formatIncidentCode(payload.sourceIncidentId));
  if (payload.targetIncidentId) add('Sự vụ đích', formatIncidentCode(payload.targetIncidentId));
  add('Khu vực', payload.areaName);
  add('Danh mục', payload.categoryName);

  return metadata;
};

export { EMPTY_VALUE };
