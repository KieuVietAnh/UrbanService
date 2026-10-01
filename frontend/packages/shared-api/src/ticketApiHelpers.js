import { managementTypes } from '@urbanmind/shared-types';

const FEEDBACK_ROLES_MANAGEMENT = new Set([
  'system-staff',
  'interaction-manager',
  'administrator',
  'service-provider',
]);

const normalizeRole = (role) => {
  if (!role) return null;
  const normalized = String(role).trim().replace(/[-_\s]/g, '').toLowerCase();
  switch (normalized) {
    case 'serviceuser':
      return 'service-user';
    case 'systemstaff':
      return 'system-staff';
    case 'serviceprovider':
    case 'serviceoperator':
      return 'service-provider';
    case 'interactionmanager':
      return 'interaction-manager';
    case 'systemadmin':
    case 'administrator':
    case 'admin':
      return 'administrator';
    default:
      return role;
  }
};

export const getFeedbackBasePath = (role) => {
  const resolvedRole = normalizeRole(role || null);
  if (FEEDBACK_ROLES_MANAGEMENT.has(resolvedRole)) {
    return '/api/management/feedbacks';
  }
  return '/api/user/feedbacks';
};

export const normalizeRoleForFeedback = normalizeRole;

export const normalizeTicketsResponse = (response) => {
  const arr =
    Array.isArray(response) ? response
      : Array.isArray(response?.data) ? response.data
      : Array.isArray(response?.content) ? response.content
      : Array.isArray(response?.items) ? response.items
      : [];

  // Normalize status variants to canonical managementTypes values
  const normalizeStatus = (s) => {
    if (!s && s !== 0) return s;
    const raw = String(s).trim();
    const key = raw.replace(/[-_\s]/g, '').toLowerCase();
    switch (key) {
      case 'submitted': return managementTypes.feedbackStatus.SUBMITTED;
      case 'aireviewed':
      case 'aireview':
        return managementTypes.feedbackStatus.AI_REVIEWED;
      case 'verified': return managementTypes.feedbackStatus.VERIFIED;
      case 'assigned': return managementTypes.feedbackStatus.ASSIGNED;
      case 'inprogress':
      case 'in progress':
      case 'on the way':
      case 'accepted':
        return managementTypes.feedbackStatus.IN_PROGRESS;
      case 'resolved':
      case 'completed':
        return managementTypes.feedbackStatus.RESOLVED;
      case 'submittedforapproval':
      case 'submittedforapproval':
        return managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL;
      case 'approved': return managementTypes.feedbackStatus.APPROVED;
      case 'rejected': return managementTypes.feedbackStatus.REJECTED;
      case 'needrework': return managementTypes.feedbackStatus.NEED_REWORK;
      case 'closed': return managementTypes.feedbackStatus.CLOSED;
      case 'cancelled': return managementTypes.feedbackStatus.CANCELLED;
      default:
        return raw;
    }
  };

  return arr.map((item) => ({
    ...(item || {}),
    status: normalizeStatus(item?.status),
    assignment: item?.assignment ? { ...item.assignment, status: normalizeStatus(item.assignment.status) } : item?.assignment,
  }));
};

export const normalizeCommentsResponse = (resp) => {
  const top = resp?.data ?? resp;
  const payload = top?.data ?? top;

  if (Array.isArray(top)) return top;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.comments)) return payload.comments;
  if (Array.isArray(payload?.commentList)) return payload.commentList;
  if (Array.isArray(payload?.comment)) return payload.comment;
  if (Array.isArray(top?.comments)) return top.comments;
  if (Array.isArray(top?.commentList)) return top.commentList;
  if (Array.isArray(top?.comment)) return top.comment;

  return [];
};
