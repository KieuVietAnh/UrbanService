export const managementTypes = {
  feedbackStatus: {
    SUBMITTED: 'Submitted',
    AI_REVIEWED: 'AI Reviewed',
    VERIFIED: 'Verified',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'InProgress',
    RESOLVED: 'Resolved',
    SUBMITTED_FOR_APPROVAL: 'SubmittedForApproval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    NEED_REWORK: 'NeedRework',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
  },

  statusFlow: {
    'Submitted': ['AI Reviewed', 'Rejected'],
    'AI Reviewed': ['Verified', 'Rejected'],
    'Verified': ['Assigned', 'Rejected'],
    'Assigned': ['InProgress', 'Rejected'],
    'InProgress': ['SubmittedForApproval', 'NeedRework'],
    'SubmittedForApproval': ['Approved', 'NeedRework'],
    'Approved': ['Closed'],
    'NeedRework': ['InProgress', 'Rejected'],
    'Rejected': [],
    'Cancelled': [],
  },

  updatePayload: {
    edit: {
      categoryId: 0,
      title: '',
      description: '',
      locationText: '',
      latitude: 0,
      longitude: 0,
      priority: '',
      dueDate: '',
    },
    status: {
      status: '',
      note: '',
    },
    assignment: {
      feedbackId: '',
      operatorId: '',
      staffUserId: '',
      note: '',
    },
  },
};
