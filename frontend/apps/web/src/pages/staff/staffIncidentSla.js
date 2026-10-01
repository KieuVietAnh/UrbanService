const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const durationLabel = (seconds) => {
  const totalMinutes = Math.floor(Math.abs(seconds) / 60);
  if (totalMinutes < 1) return 'dưới 1 phút';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} ngày` : '',
    hours ? `${hours} giờ` : '',
    minutes ? `${minutes} phút` : '',
  ].filter(Boolean).join(' ');
};

export const validateStaffIncidentSlaStatus = (value, expectedIncidentId) => {
  const expected = String(expectedIncidentId ?? '').trim();
  if (!value || typeof value !== 'object' || Array.isArray(value) || !expected) return null;

  const actual = String(value.incidentId ?? '').trim();
  if (!actual || actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('Trạng thái SLA không thuộc sự vụ đang xem.');
  }
  return value;
};

export const getStaffIncidentSlaMetric = (sla, type) => {
  const isResponse = type === 'response';
  const remainingSeconds = finiteNumber(
    isResponse ? sla?.responseRemainingSeconds : sla?.resolutionRemainingSeconds,
  );
  const progress = finiteNumber(
    isResponse ? sla?.responseProgressPercent : sla?.resolutionProgressPercent,
  );
  const warning = Boolean(isResponse ? sla?.isResponseWarning : sla?.isResolutionWarning);
  const breached = Boolean(
    (isResponse ? sla?.isResponseBreached : sla?.isResolutionBreached)
    || (remainingSeconds !== null && remainingSeconds < 0),
  );

  return {
    breached,
    dueAt: isResponse ? sla?.responseDueAt : sla?.resolutionDueAt,
    progressPercent: progress === null ? null : Math.min(100, Math.max(0, progress)),
    remainingSeconds,
    status: isResponse ? sla?.responseStatus : sla?.resolutionStatus,
    warning: !breached && warning,
  };
};

export const getStaffIncidentSlaState = (sla) => {
  const metrics = [
    getStaffIncidentSlaMetric(sla, 'response'),
    getStaffIncidentSlaMetric(sla, 'resolution'),
  ];
  if (metrics.some((metric) => metric.breached)) return 'breached';
  if (metrics.some((metric) => metric.warning)) return 'warning';
  return 'healthy';
};

export const formatStaffIncidentSlaRemaining = (metric) => {
  if (metric?.remainingSeconds === null || metric?.remainingSeconds === undefined) {
    return 'Chưa có dữ liệu thời gian';
  }
  const overdue = metric.breached || metric.remainingSeconds < 0;
  return `${overdue ? 'Quá hạn' : 'Còn'} ${durationLabel(metric.remainingSeconds)}`;
};

export const getStaffIncidentSlaStatusLabel = (value) => {
  const labels = {
    active: 'Đang theo dõi',
    running: 'Đang theo dõi',
    pending: 'Chờ xử lý',
    paused: 'Tạm dừng',
    completed: 'Hoàn thành',
    resolved: 'Đã hoàn thành',
    met: 'Đúng hạn',
    warning: 'Sắp quá hạn',
    breached: 'Đã quá hạn',
    violated: 'Đã quá hạn',
    cancelled: 'Đã hủy',
  };
  return labels[normalizeKey(value)] || String(value ?? '').trim() || 'Chưa có trạng thái';
};
