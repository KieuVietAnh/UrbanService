export const TICKET_STATUS_STEPS = [
  { title: 'Đã gửi', sub: 'Submitted' },
  { title: 'Kiểm duyệt', sub: 'AI Reviewed' },
  { title: 'Điều phối', sub: 'Assigned' },
  { title: 'Đang xử lý', sub: 'In Progress' },
  { title: 'Đã xử lý', sub: 'Resolved' },
  { title: 'Đã đóng', sub: 'Closed' }
];

export const getStatusStep = (status) => {
  switch (status) {
    case 'Submitted':
      return 0;
    case 'AI Reviewed':
      return 1;
    case 'Assigned':
      return 2;
    case 'InProgress':
      return 3;
    case 'Resolved':
      return 4;
    case 'Closed':
      return 5;
    default:
      return 0;
  }
};

export const PRIORITY_BADGE_CLASSES = {
  Critical: 'bg-red-50 text-red-600 border-red-200',
  High: 'bg-amber-50 text-amber-600 border-amber-200',
  Medium: 'bg-blue-50 text-blue-600 border-blue-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-300'
};

export const STATUS_BADGE_CLASSES = {
  Resolved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Closed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  default: 'bg-slate-100 text-slate-600 border-slate-300'
};
