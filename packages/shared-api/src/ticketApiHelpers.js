const FEEDBACK_ROLES_MANAGEMENT = new Set([
  'system-staff',
  'interaction-manager',
  'administrator',
  'service-provider',
]);

export const getFeedbackBasePath = (role, storedRole) => {
  const resolvedRole = role || storedRole;
  if (FEEDBACK_ROLES_MANAGEMENT.has(resolvedRole)) {
    return '/api/management/feedbacks';
  }
  return '/api/user/feedbacks';
};

export const normalizeTicketsResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.items)) return response.items;
  return [];
};

export const normalizeCommentsResponse = (resp) => {
  const payload = resp?.data ?? resp;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};
