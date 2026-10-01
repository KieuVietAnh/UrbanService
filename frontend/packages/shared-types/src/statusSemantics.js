import { managementTypes } from './managementTypes.js';

const normalizeStatusKey = (value) => `${value ?? ''}`.trim().replace(/[_\s]+/g, '').toLowerCase();

const STATUS_SEMANTICS = {
  [managementTypes.feedbackStatus.SUBMITTED]: { intent: 'info', stage: 'initial' },
  [managementTypes.feedbackStatus.AI_REVIEWED]: { intent: 'info', stage: 'initial' },
  [managementTypes.feedbackStatus.VERIFIED]: { intent: 'info', stage: 'ready' },
  [managementTypes.feedbackStatus.ASSIGNED]: { intent: 'warning', stage: 'active' },
  [managementTypes.feedbackStatus.IN_PROGRESS]: { intent: 'warning', stage: 'active' },
  [managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL]: { intent: 'warning', stage: 'review' },
  [managementTypes.feedbackStatus.NEED_REWORK]: { intent: 'warning', stage: 'review' },
  [managementTypes.feedbackStatus.RESOLVED]: { intent: 'success', stage: 'complete' },
  [managementTypes.feedbackStatus.APPROVED]: { intent: 'success', stage: 'complete' },
  [managementTypes.feedbackStatus.CLOSED]: { intent: 'success', stage: 'complete' },
  [managementTypes.feedbackStatus.REJECTED]: { intent: 'danger', stage: 'closed' },
  [managementTypes.feedbackStatus.CANCELLED]: { intent: 'neutral', stage: 'closed' },
  Pending: { intent: 'info', stage: 'initial' },
  Confirmed: { intent: 'success', stage: 'complete' },
  Reported: { intent: 'info', stage: 'initial' },
  Contacted: { intent: 'warning', stage: 'active' },
  Accepted: { intent: 'warning', stage: 'active' },
  InProgress: { intent: 'warning', stage: 'active' },
  Done: { intent: 'success', stage: 'complete' },
  Failed: { intent: 'danger', stage: 'closed' },
  Cancelled: { intent: 'danger', stage: 'closed' },
};

const STATUS_LOOKUP = new Map(
  Object.entries(STATUS_SEMANTICS).map(([status, semantic]) => [normalizeStatusKey(status), semantic])
);

export function getStatusIntent(value) {
  return STATUS_LOOKUP.get(normalizeStatusKey(value))?.intent || 'neutral';
}

export function getStatusSemantic(value) {
  return STATUS_LOOKUP.get(normalizeStatusKey(value)) || { intent: 'neutral', stage: 'unknown' };
}

export { STATUS_SEMANTICS };
