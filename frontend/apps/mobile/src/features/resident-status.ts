const normalize = (status?: string | null) =>
  String(status ?? '').trim().replace(/[_\s-]+/g, '').toLowerCase();

export type ResidentStage = 'submitted' | 'received' | 'processing' | 'reviewing' | 'completed' | 'rejected';

export const getResidentStage = (status?: string | null): ResidentStage => {
  switch (normalize(status)) {
    case 'submitted':
    case 'aireviewed':
    case 'pending':
    case 'new':
      return 'submitted';
    case 'verified':
    case 'assigned':
      return 'received';
    case 'inprogress':
    case 'needrework':
    case 'processing':
      return 'processing';
    case 'resolved':
    case 'submittedforapproval':
      return 'reviewing';
    case 'approved':
    case 'closed':
    case 'completed':
      return 'completed';
    case 'rejected':
    case 'cancelled':
      return 'rejected';
    default:
      return 'submitted';
  }
};

export const getResidentStatusLabel = (status?: string | null) => {
  switch (getResidentStage(status)) {
    case 'submitted': return 'Đã gửi';
    case 'received': return 'Đã tiếp nhận';
    case 'processing': return 'Đang xử lý';
    case 'reviewing': return 'Đang kiểm tra kết quả';
    case 'completed': return 'Hoàn thành';
    case 'rejected': return normalize(status) === 'cancelled' ? 'Đã hủy' : 'Không tiếp nhận';
  }
};

export const isApprovedPublicResult = (status?: string | null) => {
  const key = normalize(status);
  return key === 'approved' || key === 'closed' || key === 'completed';
};

export const getResidentStageIndex = (status?: string | null) => {
  const stage = getResidentStage(status);
  return ['submitted', 'received', 'processing', 'reviewing', 'completed'].indexOf(stage);
};

export const normalizeResidentStatus = normalize;
