export { axiosClient, extractApiErrorMessage } from './axiosClient.js';
export { authApi } from './authApi.js';
export { normalizePhone, formatPhone } from './phone.js';
export { ticketApi } from './ticketApi.js';
export { chatbotApi } from './chatbotApi.js';
export { analyticsApi } from './analyticsApi.js';
export { incidentDashboardApi, INCIDENT_DASHBOARD_RANGES } from './incidentDashboardApi.js';
export { assignmentApi } from './assignmentApi.js';
export { notificationApi } from './notificationApi.js';
export { userApi } from './userApi.js';
export { staffResponsibilityApi, normalizeStaffResponsibilityFilters, normalizeStaffResponsibilityCollection, normalizeStaffResponsibilityCreatePayload, normalizeStaffResponsibilityUpdatePayload } from './staffResponsibilityApi.js';
export { userAreaAlertApi } from './userAreaAlertApi.js';
export { messengerAccountLinkApi } from './messengerAccountLinkApi.js';
export { slaApi } from './slaApi.js';
// NOTE: `mockDb` is a development-only in-memory store. It is no longer exported
// from the public package index to avoid accidental inclusion in production bundles.
// Use `./dev/mockIndex.js` internally in development only when `VITE_USE_MOCK` is enabled.
export { getFeedbackBasePath, normalizeTicketsResponse, normalizeCommentsResponse } from './ticketApiHelpers.js';
export { toolsApi } from './toolsApi.js';
export {
  setAuthToken,
  removeAuthToken,
  setAuthRefreshToken,
  removeAuthRefreshToken,
  clearAuthTokens,
  setTokenStorage,
  setRefreshTokenStorage,
  setApiBaseUrl,
  setUnauthorizedHandler,
  setAuthSessionRefreshedHandler,
  refreshAuthSession,
} from './axiosClient.js';
export {
  managementFeedbackApi,
  normalizeAiReviewedPage,
  normalizeAiReviewedPayload,
  normalizeFeedbackListParams,
  normalizeProviderReportStatus,
  canTransitionProviderReportStatus,
} from './managementFeedbackApi.js';
export {
  duplicateManagementApi,
  incidentMatchApi,
  normalizeIncidentMatchPage,
  normalizeIncidentMatchParams,
  normalizeIncidentMatchSummary,
} from './duplicateManagementApi.js';
export {
  incidentManagementApi,
  INCIDENT_MANAGEMENT_CAPABILITIES,
  normalizeIncidentDetailResponse,
  normalizeIncidentAssigneeCandidates,
  normalizeAssignIncidentPayload,
  normalizeStartIncidentProcessingPayload,
  normalizeIncidentListParams,
  normalizeIncidentListResponse,
  normalizeIncidentTimelineParams,
  normalizeIncidentTimelineResponse,
} from './incidentManagementApi.js';


