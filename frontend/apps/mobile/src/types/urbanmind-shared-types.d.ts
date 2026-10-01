declare module '@urbanmind/shared-types' {
  export const APP_ROLES: {
    readonly SERVICE_USER: 'service-user';
    readonly SYSTEM_STAFF: 'system-staff';
    readonly SERVICE_PROVIDER: 'service-provider';
    readonly INTERACTION_MANAGER: 'interaction-manager';
    readonly ADMINISTRATOR: 'administrator';
  };

  export const ROLE_MAP: Record<string, string>;

  export function getInternalRole(role?: string | null): string;
  export function getRoleLabel(role?: string | null): string;

  export const managementTypes: {
    feedbackStatus: {
      readonly SUBMITTED: 'Submitted';
      readonly AI_REVIEWED: 'AI Reviewed';
      readonly VERIFIED: 'Verified';
      readonly ASSIGNED: 'Assigned';
      readonly IN_PROGRESS: 'InProgress';
      readonly RESOLVED: 'Resolved';
      readonly SUBMITTED_FOR_APPROVAL: 'SubmittedForApproval';
      readonly APPROVED: 'Approved';
      readonly REJECTED: 'Rejected';
      readonly NEED_REWORK: 'NeedRework';
      readonly CLOSED: 'Closed';
      readonly CANCELLED: 'Cancelled';
    };
    statusFlow: Record<string, string[]>;
    updatePayload: {
      edit: Record<string, string | number>;
      status: { status: string; note: string };
      assignment: Record<string, string>;
    };
  };

  export const TICKET_STATUS_STEPS: Array<{ title: string; sub: string }>;
  export function getStatusStep(status?: string | null): number;
  export function getStatusLabel(status?: string | null, fallback?: string): string;

  export const PRIORITY_BADGE_CLASSES: Record<string, string>;
  export const STATUS_BADGE_CLASSES: Record<string, string>;

  export type SharedSemanticIntent = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | string;

  export const STATUS_SEMANTICS: Record<string, { intent: SharedSemanticIntent; stage: string }>;
  export function getStatusIntent(value?: string | null): SharedSemanticIntent;
  export function getStatusSemantic(value?: string | null): { intent: SharedSemanticIntent; stage: string };

  export const PRIORITY_SEMANTICS: Record<string, { intent: SharedSemanticIntent; urgency: string }>;
  export function getPriorityIntent(value?: string | null): SharedSemanticIntent;
  export function getPrioritySemantic(value?: string | null): { intent: SharedSemanticIntent; urgency: string };
}
