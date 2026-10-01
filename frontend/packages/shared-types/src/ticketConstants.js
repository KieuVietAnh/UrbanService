import { managementTypes } from './managementTypes.js';

const normalizeStatusKey = (value) => `${value ?? ''}`.trim().replace(/[_\s]+/g, '').toLowerCase();

export const TICKET_STATUS_STEPS = [
  { title: 'Đã gửi', sub: managementTypes.feedbackStatus.SUBMITTED },
  { title: 'Đã xác minh', sub: managementTypes.feedbackStatus.VERIFIED },
  { title: 'Đã phân công', sub: managementTypes.feedbackStatus.ASSIGNED },
  { title: 'Đang xử lý', sub: managementTypes.feedbackStatus.IN_PROGRESS },
  { title: 'Chờ duyệt', sub: managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL },
  { title: 'Đã duyệt', sub: managementTypes.feedbackStatus.APPROVED },
  { title: 'Đã đóng', sub: managementTypes.feedbackStatus.CLOSED },
];

export const getStatusLabel = (status, fallback = 'Không xác định') => {
  const labels = {
    [managementTypes.feedbackStatus.SUBMITTED]: 'Đã gửi',
    [managementTypes.feedbackStatus.AI_REVIEWED]: 'Đang xem xét',
    [managementTypes.feedbackStatus.VERIFIED]: 'Đã xác minh',
    [managementTypes.feedbackStatus.ASSIGNED]: 'Đã phân công',
    [managementTypes.feedbackStatus.IN_PROGRESS]: 'Đang xử lý',
    [managementTypes.feedbackStatus.RESOLVED]: 'Đã xử lý',
    [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: 'Chờ nghiệm thu',
    [managementTypes.feedbackStatus.APPROVED]: 'Đã duyệt',
    [managementTypes.feedbackStatus.NEED_REWORK]: 'Cần làm lại',
    [managementTypes.feedbackStatus.REJECTED]: 'Bị từ chối',
    [managementTypes.feedbackStatus.CLOSED]: 'Đã đóng',
    [managementTypes.feedbackStatus.CANCELLED]: 'Đã hủy',
  };

  if (!status) return fallback;

  if (labels[status]) return labels[status];

  const normalizedKey = normalizeStatusKey(status);
  const normalizedLabels = new Map(Object.entries(labels).map(([key, label]) => [normalizeStatusKey(key), label]));
  return normalizedLabels.get(normalizedKey) || fallback;
};

export const getStatusStep = (status) => {
  switch (status) {
    case managementTypes.feedbackStatus.SUBMITTED:
    case managementTypes.feedbackStatus.AI_REVIEWED:
      return 0;
    case managementTypes.feedbackStatus.VERIFIED:
      return 1;
    case managementTypes.feedbackStatus.ASSIGNED:
      return 2;
    case managementTypes.feedbackStatus.IN_PROGRESS:
    case managementTypes.feedbackStatus.NEED_REWORK:
      return 3;
    case managementTypes.feedbackStatus.RESOLVED:
    case managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL:
      return 4;
    case managementTypes.feedbackStatus.APPROVED:
      return 5;
    case managementTypes.feedbackStatus.CLOSED:
      return 6;
    default:
      return 0;
  }
};

const COMMON_BADGE_CLASS = 'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm whitespace-nowrap';

export const PRIORITY_BADGE_CLASSES = {
  Urgent: COMMON_BADGE_CLASS,
  Critical: COMMON_BADGE_CLASS,
  High: COMMON_BADGE_CLASS,
  Medium: COMMON_BADGE_CLASS,
  Low: COMMON_BADGE_CLASS,
};

export const STATUS_BADGE_CLASSES = {
  [managementTypes.feedbackStatus.SUBMITTED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.AI_REVIEWED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.VERIFIED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.ASSIGNED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.IN_PROGRESS]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.RESOLVED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.APPROVED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.NEED_REWORK]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.REJECTED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.CLOSED]: COMMON_BADGE_CLASS,
  [managementTypes.feedbackStatus.CANCELLED]: COMMON_BADGE_CLASS,
  default: COMMON_BADGE_CLASS,
};
