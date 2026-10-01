export const SYSTEM_STAFF_REPORT_ACTIONS = Object.freeze({
  VIEW_REPORT: 'viewReport',
  REQUEST_INFORMATION: 'requestInformation',
  MESSAGE_RESIDENT: 'messageResident',
  VIEW_PROCESSING_HISTORY: 'viewProcessingHistory',
  VERIFY_REPORT: 'verifyReport',
  REJECT_REPORT: 'rejectReport',
  ASSIGN_STAFF: 'assignStaff',
  ASSIGN_PROVIDER_FROM_REPORT: 'assignProviderFromReport',
  UPDATE_GENERIC_STATUS: 'updateGenericStatus',
  DECIDE_INCIDENT_MATCH: 'decideIncidentMatch',
  APPROVE_RESOLUTION: 'approveResolution',
  REQUEST_REWORK: 'requestRework',
});

const allowedActions = new Set([
  SYSTEM_STAFF_REPORT_ACTIONS.VIEW_REPORT,
  SYSTEM_STAFF_REPORT_ACTIONS.REQUEST_INFORMATION,
  SYSTEM_STAFF_REPORT_ACTIONS.MESSAGE_RESIDENT,
  SYSTEM_STAFF_REPORT_ACTIONS.VIEW_PROCESSING_HISTORY,
]);

export const canSystemStaffPerformReportAction = (action) => allowedActions.has(action);

export const SYSTEM_STAFF_LEGACY_ROUTE_REDIRECTS = Object.freeze([
  { pattern: /^\/staff\/queue(?:\/.*)?$/, destination: '/staff/feedbacks' },
  { pattern: /^\/staff\/duplicates(?:\/.*)?$/, destination: '/staff/incidents' },
  { pattern: /^\/tickets\/assign\/[^/]+$/, destination: '/staff/incidents' },
  { pattern: /^\/staff\/provider-reports\/[^/]+$/, destination: '/staff/incidents' },
  { pattern: /^\/staff\/provider-candidates-checker$/, destination: '/staff/coordinators' },
]);

export const getSystemStaffLegacyRouteRedirect = (pathname = '') => (
  SYSTEM_STAFF_LEGACY_ROUTE_REDIRECTS.find(({ pattern }) => pattern.test(pathname))?.destination || null
);

const systemStaffPermissions = ['ticket:view-all', 'ticket:chat'];

export default systemStaffPermissions;
