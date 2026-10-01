const normalizeStatus = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const STAGES = Object.freeze([
  Object.freeze({ id: 'assigned', label: 'Bắt đầu xử lý' }),
  Object.freeze({ id: 'in-progress', label: 'Thực hiện công việc' }),
  Object.freeze({ id: 'submitted', label: 'Gửi kết quả' }),
  Object.freeze({ id: 'approved', label: 'Hoàn tất' }),
]);

const STATUS_STAGE_INDEX = Object.freeze({
  assigned: 0,
  inprogress: 1,
  needrework: 1,
  submittedforapproval: 2,
  approved: 3,
  resolved: 3,
  closed: 3,
});

export const getIncidentProcessingSteps = (status) => {
  const normalizedStatus = normalizeStatus(status);
  const currentIndex = STATUS_STAGE_INDEX[normalizedStatus];
  const terminal = ['resolved', 'closed'].includes(normalizedStatus);

  return STAGES.map((stage, index) => ({
    ...stage,
    state: currentIndex === undefined
      ? 'pending'
      : index < currentIndex || terminal
        ? 'complete'
        : index === currentIndex
          ? 'current'
          : 'pending',
  }));
};

export const getIncidentNextActionCopy = (status) => {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 'assigned') {
    return 'Bắt đầu flow, sau đó chọn phối hợp đơn vị hoặc tự xử lý trực tiếp.';
  }
  if (normalizedStatus === 'inprogress') {
    return 'Tiếp tục đúng bước đang dở: liên hệ (nếu có đơn vị), minh chứng rồi gửi kết quả.';
  }
  if (normalizedStatus === 'submittedforapproval') {
    return 'Kết quả xử lý đang chờ Manager xem xét.';
  }
  if (normalizedStatus === 'needrework') {
    return 'Manager đã yêu cầu xử lý lại. Bổ sung minh chứng nếu cần và gửi lại kết quả trong flow bên dưới.';
  }
  if (['approved', 'resolved', 'closed'].includes(normalizedStatus)) {
    return 'Sự vụ đã hoàn tất bước xử lý hiện tại.';
  }
  if (normalizedStatus === 'merged') {
    return 'Sự vụ đã được gộp và không còn là đầu việc xử lý độc lập.';
  }

  return 'Chưa xác định được hành động xử lý tiếp theo từ trạng thái hiện tại.';
};

const normalizeIdentifier = (value) => String(value ?? '').trim().toLowerCase();

export const isIncidentAssignedToCurrentStaff = (incident, currentUser) => {
  const assignedStaffUserId = normalizeIdentifier(incident?.assignedStaffUserId);
  const currentUserId = normalizeIdentifier(currentUser?.userId ?? currentUser?.id);

  return Boolean(assignedStaffUserId && currentUserId && assignedStaffUserId === currentUserId);
};

export const isAssignedToAnotherStaff = (incident, currentUser) => {
  const assignedStaffUserId = normalizeIdentifier(incident?.assignedStaffUserId);
  const currentUserId = normalizeIdentifier(currentUser?.userId ?? currentUser?.id);

  return Boolean(assignedStaffUserId && currentUserId && assignedStaffUserId !== currentUserId);
};

export const canStartProviderAssignmentProcessing = (incident, assignment, currentUser) => (
  isIncidentAssignedToCurrentStaff(incident, currentUser)
  && normalizeStatus(incident?.status) === 'assigned'
  && Boolean(String(assignment?.providerAssignmentId ?? '').trim())
  && normalizeStatus(assignment?.reportStatus) === 'reported'
);

export const canManageIncidentExecution = (incident, currentUser) => (
  isIncidentAssignedToCurrentStaff(incident, currentUser)
  && ['assigned', 'inprogress', 'needrework'].includes(normalizeStatus(incident?.status))
);

const PROVIDER_STATUS_LABELS = Object.freeze({
  reported: 'Đã gửi yêu cầu',
  inprogress: 'Đang thực hiện',
  done: 'Hoàn thành',
  failed: 'Không hoàn thành',
  cancelled: 'Đã hủy',
});

export const getProviderStatusLabel = (status) => {
  if (status === null || status === undefined || status === '') return 'Chưa có dữ liệu';
  return PROVIDER_STATUS_LABELS[normalizeStatus(status)] || 'Chưa xác định';
};

export const getProviderStatusIntent = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'done') return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (normalized === 'inprogress') return 'info';
  if (normalized === 'reported') return 'warning';
  return 'neutral';
};
