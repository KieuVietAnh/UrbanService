export const APP_ROLES: {
  SYSTEM_ADMIN: 'system-admin';
  SERVICE_USER: 'service-user';
  SYSTEM_STAFF: 'system-staff';
  SERVICE_PROVIDER: 'service-provider';
  INTERACTION_MANAGER: 'interaction-manager';
};

export const managementTypes: {
  feedbackStatus: {
    SUBMITTED: 'Submitted';
    AI_REVIEWED: 'AI Reviewed';
    VERIFIED: 'Verified';
    ASSIGNED: 'Assigned';
    IN_PROGRESS: 'InProgress';
    RESOLVED: 'Resolved';
    SUBMITTED_FOR_APPROVAL: 'SubmittedForApproval';
    APPROVED: 'Approved';
    REJECTED: 'Rejected';
    NEED_REWORK: 'NeedRework';
    CLOSED: 'Closed';
    CANCELLED: 'Cancelled';
  };
  statusFlow: Record<string, string[]>;
  updatePayload: Record<string, any>;
};

export function getStatusIntent(status?: string | null): string;
export function getStatusSemantic(status?: string | null): { intent: string; stage: string };
export function getStatusLabel(status?: string | null, fallback?: string): string;

export function getPriorityIntent(priority?: string | null): string;
export function getPrioritySemantic(priority?: string | null): { intent: string; urgency: string };

export function getSeverityIntent(severity?: string | null): string;
export function getSeveritySemantic(severity?: string | null): { intent: string; level: string };

export function getInternalRole(role?: string | null): string;
export function getRoleLabel(role?: string | null): string;

export const ROLE_MAP: Record<string, string>;
export const TICKET_STATUS_STEPS: Array<{ title: string; sub: string }>;
export function getStatusStep(status?: string | null): number;
export const PRIORITY_BADGE_CLASSES: Record<string, string>;
export const STATUS_BADGE_CLASSES: Record<string, string>;
