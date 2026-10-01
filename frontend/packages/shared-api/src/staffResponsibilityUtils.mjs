const positiveInteger = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TypeError(`${name} must be a positive integer`);
  return parsed;
};

const optionalCategoryId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return positiveInteger(value, 'categoryId');
};

const optionalDate = (value, name) => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new TypeError(`${name} must use YYYY-MM-DD`);
  return normalized;
};

const assignmentScopePayload = (payload = {}) => {
  const normalized = {
    areaId: positiveInteger(payload?.areaId, 'areaId'),
    categoryId: optionalCategoryId(payload?.categoryId),
    isPrimary: Boolean(payload?.isPrimary),
  };
  const startDate = optionalDate(payload?.startDate, 'startDate');
  const endDate = optionalDate(payload?.endDate, 'endDate');
  if (startDate) normalized.startDate = startDate;
  if (endDate) normalized.endDate = endDate;
  return normalized;
};

export const normalizeStaffResponsibilityFilters = (filters = {}) => {
  const normalized = {};
  const userId = String(filters?.userId || '').trim();
  if (userId) normalized.userId = userId;
  if (filters?.areaId !== undefined && filters?.areaId !== null && filters?.areaId !== '') normalized.areaId = positiveInteger(filters.areaId, 'areaId');
  if (filters?.categoryId !== undefined && filters?.categoryId !== null && filters?.categoryId !== '') normalized.categoryId = positiveInteger(filters.categoryId, 'categoryId');
  if (typeof filters?.isActive === 'boolean') normalized.isActive = filters.isActive;
  return normalized;
};

export const normalizeStaffResponsibilityCollection = (response = []) => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const normalizeStaffResponsibilityCreatePayload = (payload = {}) => {
  const userId = String(payload?.userId || '').trim();
  if (!userId) throw new TypeError('userId is required');
  return { userId, ...assignmentScopePayload(payload) };
};

export const normalizeStaffResponsibilityUpdatePayload = (payload = {}) => assignmentScopePayload(payload);

export const normalizeAssignmentId = (assignmentId) => positiveInteger(assignmentId, 'assignmentId');
