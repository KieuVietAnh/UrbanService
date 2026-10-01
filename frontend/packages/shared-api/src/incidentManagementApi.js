import { axiosClient } from './axiosClient.js';

const INCIDENT_LIST_ENDPOINT = '/api/management/incidents';
const INCIDENT_DETAIL_ENDPOINT = '/api/management/incidents/{incidentId}';
const INCIDENT_TIMELINE_ENDPOINT = '/api/management/incidents/{incidentId}/timeline';
const INCIDENT_STATUS_ENDPOINT = '/api/management/incidents/{incidentId}/status';
const INCIDENT_ASSIGNEE_CANDIDATES_ENDPOINT = '/api/management/incidents/{incidentId}/assignee-candidates';
const INCIDENT_ASSIGN_ENDPOINT = '/api/management/incidents/{incidentId}/assign';
const INCIDENT_MERGE_ENDPOINT = '/api/management/incidents/{incidentId}/merge';
const INCIDENT_REPORTS_ENDPOINT = '/api/management/incidents/{incidentId}/reports';
const INCIDENT_PROVIDER_CANDIDATES_ENDPOINT = '/api/management/incidents/{incidentId}/provider-candidates';
const INCIDENT_PROVIDER_ASSIGNMENT_ENDPOINT = '/api/management/incidents/{incidentId}/provider-assignment';
const INCIDENT_RESOLUTIONS_ENDPOINT = '/api/management/incidents/{incidentId}/resolutions';
const INCIDENT_CURRENT_RESOLUTION_ENDPOINT = '/api/management/incidents/{incidentId}/resolution';
const INCIDENT_LATEST_RESOLUTION_ENDPOINT = '/api/management/incidents/{incidentId}/resolutions/latest';
const INCIDENT_RESOLUTION_APPROVE_ENDPOINT = '/api/management/incidents/{incidentId}/resolutions/{resolutionId}/approve';
const INCIDENT_RESOLUTION_REWORK_ENDPOINT = '/api/management/incidents/{incidentId}/resolutions/{resolutionId}/need-rework';
const PROVIDER_ASSIGNMENT_ENDPOINT = '/api/management/provider-assignments/{providerAssignmentId}';

const buildIncidentDetailEndpoint = (incidentId) => {
  const normalizedIncidentId = String(incidentId ?? '').trim();

  if (!normalizedIncidentId) {
    throw new TypeError('incidentId is required');
  }

  return `/api/management/incidents/${encodeURIComponent(normalizedIncidentId)}`;
};

const readParam = (params, pascalName, camelName) => (
  params?.[pascalName] ?? params?.[camelName]
);

const assignPositiveInteger = (target, key, value) => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) target[key] = parsed;
};

const assignOptionalInteger = (target, key, value) => {
  if (value === undefined || value === null || value === '') return;
  const parsed = Number(value);
  if (Number.isInteger(parsed)) target[key] = parsed;
};

const assignOptionalString = (target, key, value) => {
  const normalized = String(value ?? '').trim();
  if (normalized) target[key] = normalized;
};

export const normalizeIncidentListParams = (params = {}) => {
  const normalized = {};

  assignPositiveInteger(normalized, 'PageNumber', readParam(params, 'PageNumber', 'pageNumber'));
  assignPositiveInteger(normalized, 'PageSize', readParam(params, 'PageSize', 'pageSize'));
  assignOptionalInteger(normalized, 'AreaId', readParam(params, 'AreaId', 'areaId'));
  assignOptionalInteger(normalized, 'CategoryId', readParam(params, 'CategoryId', 'categoryId'));
  assignOptionalString(normalized, 'Status', readParam(params, 'Status', 'status'));
  assignOptionalString(normalized, 'Priority', readParam(params, 'Priority', 'priority'));
  assignOptionalString(normalized, 'Severity', readParam(params, 'Severity', 'severity'));
  assignOptionalString(normalized, 'Search', readParam(params, 'Search', 'search'));
  assignOptionalString(
    normalized,
    'AssignedStaffUserId',
    readParam(params, 'AssignedStaffUserId', 'assignedStaffUserId'),
  );

  const includeMerged = readParam(params, 'IncludeMerged', 'includeMerged');
  if (typeof includeMerged === 'boolean') normalized.IncludeMerged = includeMerged;

  return normalized;
};

export const normalizeIncidentListResponse = (response = {}) => {
  const payload = response?.data ?? response ?? {};

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pageNumber: Number(payload?.pageNumber) || 1,
    pageSize: Number(payload?.pageSize) || 0,
    totalItems: Number(payload?.totalItems) || 0,
    totalPages: Number(payload?.totalPages) || 0,
    hasPreviousPage: Boolean(payload?.hasPreviousPage),
    hasNextPage: Boolean(payload?.hasNextPage),
  };
};

export const normalizeIncidentDetailResponse = (response = null) => {
  const payload = response?.data ?? response;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return payload;
};

export const normalizeIncidentAssigneeCandidates = (response = []) => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const normalizeAssignIncidentPayload = (payload = {}) => {
  const staffUserId = String(payload?.staffUserId ?? '').trim();
  if (!staffUserId) throw new TypeError('staffUserId is required');

  const normalized = { staffUserId };
  const reason = String(payload?.reason ?? '').trim();
  if (reason) normalized.reason = reason;
  return normalized;
};

export const normalizeStartIncidentProcessingPayload = (payload = {}) => {
  const normalized = { status: 'InProgress' };
  const note = String(payload?.note ?? '').trim();
  if (note) normalized.note = note;
  return normalized;
};

const positiveExecutionId = (value, name) => {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 2147483647) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return parsed;
};

const requiredExecutionText = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
};

const optionalExecutionText = (payload, key, result) => {
  const value = payload?.[key];
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string') throw new TypeError(`${key} must be text`);
  const normalized = value.trim();
  if (normalized) result[key] = normalized;
};

const buildProviderAssignmentEndpoint = (providerAssignmentId) => (
  `/api/management/provider-assignments/${positiveExecutionId(providerAssignmentId, 'providerAssignmentId')}`
);

export const unwrapIncidentExecutionResponse = (response) => {
  let payload = response;
  for (let level = 0; level < 3; level += 1) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) break;
    if (!Object.prototype.hasOwnProperty.call(payload, 'data')) break;
    payload = payload.data;
  }
  return payload;
};

export const normalizeIncidentExecutionCollection = (response) => {
  const payload = unwrapIncidentExecutionResponse(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new TypeError('Invalid Incident execution collection response');
};

export const normalizeIncidentProviderAssignmentResponse = (response) => {
  const payload = unwrapIncidentExecutionResponse(response);
  // axiosClient returns response.data, so a documented 204 normally arrives as ''.
  if (payload === null || payload === undefined || payload === '' || response?.status === 204) return null;
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Invalid Incident provider assignment response');
  }
  return payload;
};

export const normalizeAssignIncidentProviderPayload = (payload = {}) => {
  const normalized = { coordinatorId: positiveExecutionId(payload?.coordinatorId, 'coordinatorId') };
  optionalExecutionText(payload, 'note', normalized);
  return normalized;
};

export const normalizeProviderAssignmentContactPayload = (payload = {}) => {
  const normalized = {
    contactMethod: requiredExecutionText(payload?.contactMethod, 'contactMethod'),
    contactResult: requiredExecutionText(payload?.contactResult, 'contactResult'),
  };
  optionalExecutionText(payload, 'contactNote', normalized);
  if (payload?.contactedAt !== undefined && payload?.contactedAt !== null && payload?.contactedAt !== '') {
    const value = requiredExecutionText(payload.contactedAt, 'contactedAt');
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
      throw new TypeError('contactedAt must be a valid ISO date-time');
    }
    normalized.contactedAt = new Date(value).toISOString();
  }
  return normalized;
};

export const normalizeProviderAssignmentStatusPayload = (payload = {}) => {
  // This validates the request shape, not undocumented backend transition rules.
  const normalized = { status: requiredExecutionText(payload?.status, 'status') };
  optionalExecutionText(payload, 'note', normalized);
  return normalized;
};

export const normalizeNeedReworkResolutionPayload = (payload = {}) => {
  const reason = requiredExecutionText(payload?.reason, 'reason');
  return { reason };
};

export const normalizeResolutionDecisionResponse = (response) => {
  const payload = unwrapIncidentExecutionResponse(response);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
};

export const normalizeSubmitIncidentResolutionPayload = (payload = {}) => {
  // The Staff execution contract requires both narrative fields. The generated
  // OpenAPI schema currently omits the corresponding required array.
  const normalized = {
    resolutionSummary: requiredExecutionText(payload?.resolutionSummary, 'resolutionSummary'),
    actionTaken: requiredExecutionText(payload?.actionTaken, 'actionTaken'),
  };
  if (payload?.providerAssignmentId !== undefined && payload?.providerAssignmentId !== null) {
    normalized.providerAssignmentId = positiveExecutionId(payload.providerAssignmentId, 'providerAssignmentId');
  }
  optionalExecutionText(payload, 'resultNote', normalized);
  if (payload?.imageUrls !== undefined && payload?.imageUrls !== null) {
    if (!Array.isArray(payload.imageUrls)) throw new TypeError('imageUrls must be an array');
    normalized.imageUrls = payload.imageUrls.map((value) => {
      const url = requiredExecutionText(value, 'imageUrl');
      let parsed;
      try { parsed = new URL(url); } catch { throw new TypeError('imageUrl must be an HTTP(S) URL'); }
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new TypeError('imageUrl must be an HTTP(S) URL');
      return url;
    });
  }
  return normalized;
};

export const normalizeIncidentTimelineParams = (params = {}) => {
  const normalized = {};

  assignPositiveInteger(normalized, 'pageNumber', readParam(params, 'PageNumber', 'pageNumber'));
  assignPositiveInteger(normalized, 'pageSize', readParam(params, 'PageSize', 'pageSize'));

  return normalized;
};

export const normalizeIncidentTimelineResponse = (response = {}) => {
  const payload = response?.data ?? response ?? {};

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pageNumber: Number(payload?.pageNumber) || 1,
    pageSize: Number(payload?.pageSize) || 0,
    totalItems: Number(payload?.totalItems) || 0,
    totalPages: Number(payload?.totalPages) || 0,
    hasPreviousPage: Boolean(payload?.hasPreviousPage),
    hasNextPage: Boolean(payload?.hasNextPage),
  };
};

export const INCIDENT_MANAGEMENT_CAPABILITIES = Object.freeze({
  list: Object.freeze({
    available: true,
    endpoint: INCIDENT_LIST_ENDPOINT,
    supportedFilters: Object.freeze([
      'pageNumber',
      'pageSize',
      'areaId',
      'categoryId',
      'status',
      'priority',
      'severity',
      'search',
      'includeMerged',
      'assignedStaffUserId',
    ]),
    assignedToCurrentStaff: true,
  }),
  detail: Object.freeze({
    available: true,
    endpoint: INCIDENT_DETAIL_ENDPOINT,
    assignedStaff: true,
    incidentLevelSla: true,
    reportsEmbedded: true,
  }),
  timeline: Object.freeze({
    available: true,
    endpoint: INCIDENT_TIMELINE_ENDPOINT,
    paginated: true,
    defaultPageSize: 20,
  }),
  statusTransition: Object.freeze({
    available: true,
    endpoint: INCIDENT_STATUS_ENDPOINT,
    requestSchema: 'UpdateIncidentStatusRequest',
  }),
  staffStartProcessing: Object.freeze({
    available: true,
    scope: 'provider-assignment',
    fromStatus: 'Reported',
    toStatus: 'InProgress',
    endpoint: `${PROVIDER_ASSIGNMENT_ENDPOINT}/status`,
    requestSchema: 'UpdateProviderAssignmentStatusRequest',
    synchronizesIncident: true,
  }),
  providerAssignment: Object.freeze({
    available: true,
    scope: 'incident',
    endpoint: INCIDENT_PROVIDER_ASSIGNMENT_ENDPOINT,
    contract: 'incident-provider-assignment',
    legacyRequiresFeedbackId: false,
    authoritativeReportMapping: false,
    supportsReassignment: false,
    noAssignmentStatus: 204,
  }),
  providerCandidates: Object.freeze({
    available: true,
    endpoint: INCIDENT_PROVIDER_CANDIDATES_ENDPOINT,
    eligibility: Object.freeze(['areaId', 'categoryId']),
  }),
  providerContacts: Object.freeze({
    available: true,
    endpoint: `${PROVIDER_ASSIGNMENT_ENDPOINT}/contact-logs`,
    scope: 'provider-assignment',
  }),
  providerStatus: Object.freeze({
    available: true,
    endpoint: `${PROVIDER_ASSIGNMENT_ENDPOINT}/status`,
    transitionsConfirmed: true,
    staffTransitions: Object.freeze([
      Object.freeze({ from: 'Reported', to: 'InProgress' }),
    ]),
  }),
  completionEvidence: Object.freeze({
    available: true,
    endpoint: `${PROVIDER_ASSIGNMENT_ENDPOINT}/completion-documents`,
    scope: 'provider-assignment',
    multipartFields: Object.freeze(['Description', 'Files']),
    documentedUploadLimits: false,
    deleteOneAvailable: false,
    clearAllAvailable: true,
  }),
  resolutions: Object.freeze({
    available: true,
    endpoint: INCIDENT_RESOLUTIONS_ENDPOINT,
    currentEndpoint: INCIDENT_CURRENT_RESOLUTION_ENDPOINT,
    latestEndpoint: INCIDENT_LATEST_RESOLUTION_ENDPOINT,
    approveEndpoint: INCIDENT_RESOLUTION_APPROVE_ENDPOINT,
    needReworkEndpoint: INCIDENT_RESOLUTION_REWORK_ENDPOINT,
    scope: 'incident',
    submitAvailable: true,
    reviewAvailable: true,
    resubmitConfirmed: true,
    submitStatuses: Object.freeze(['InProgress', 'NeedRework']),
    needReworkReasonConfirmed: true,
  }),
  assigneeCandidates: Object.freeze({
    available: true,
    endpoint: INCIDENT_ASSIGNEE_CANDIDATES_ENDPOINT,
    eligibility: Object.freeze(['areaId', 'categoryId']),
  }),
  assignment: Object.freeze({
    available: true,
    endpoint: INCIDENT_ASSIGN_ENDPOINT,
    supportsReassignment: false,
  }),
  metadataUpdate: Object.freeze({
    available: true,
    endpoint: INCIDENT_DETAIL_ENDPOINT,
    method: 'PATCH',
  }),
  merge: Object.freeze({
    available: true,
    endpoint: INCIDENT_MERGE_ENDPOINT,
    requestSchema: 'MergeIncidentRequest',
  }),
  reportLinks: Object.freeze({
    available: true,
    endpoint: INCIDENT_REPORTS_ENDPOINT,
    supportsLink: true,
    supportsSoftUnlink: true,
  }),
});

export const incidentManagementApi = Object.freeze({
  capabilities: INCIDENT_MANAGEMENT_CAPABILITIES,

  async getIncidents(params = {}, options = {}) {
    const response = await axiosClient.get(INCIDENT_LIST_ENDPOINT, {
      params: normalizeIncidentListParams(params),
      signal: options?.signal,
    });

    return normalizeIncidentListResponse(response);
  },

  async getIncidentById(incidentId, options = {}) {
    const response = await axiosClient.get(buildIncidentDetailEndpoint(incidentId), {
      signal: options?.signal,
    });

    return normalizeIncidentDetailResponse(response);
  },

  async getIncidentTimeline(incidentId, params = {}, options = {}) {
    const detailEndpoint = buildIncidentDetailEndpoint(incidentId);
    const response = await axiosClient.get(`${detailEndpoint}/timeline`, {
      params: normalizeIncidentTimelineParams(params),
      signal: options?.signal,
    });

    return normalizeIncidentTimelineResponse(response);
  },

  async updateIncident(incidentId, payload = {}, options = {}) {
    const response = await axiosClient.patch(
      buildIncidentDetailEndpoint(incidentId),
      payload,
      { signal: options?.signal },
    );

    return normalizeIncidentDetailResponse(response);
  },

  async updateIncidentStatus(incidentId, payload = {}, options = {}) {
    const response = await axiosClient.patch(
      `${buildIncidentDetailEndpoint(incidentId)}/status`,
      payload,
      { signal: options?.signal },
    );

    return normalizeIncidentDetailResponse(response);
  },

  async mergeIncident(incidentId, payload = {}, options = {}) {
    const response = await axiosClient.post(
      `${buildIncidentDetailEndpoint(incidentId)}/merge`,
      payload,
      { signal: options?.signal },
    );

    return normalizeIncidentDetailResponse(response);
  },

  async linkReport(incidentId, payload = {}, options = {}) {
    const response = await axiosClient.post(
      `${buildIncidentDetailEndpoint(incidentId)}/reports`,
      payload,
      { signal: options?.signal },
    );

    return normalizeIncidentDetailResponse(response);
  },

  async unlinkReport(incidentId, feedbackId, options = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) throw new TypeError('feedbackId is required');

    const response = await axiosClient.delete(
      `${buildIncidentDetailEndpoint(incidentId)}/reports/${encodeURIComponent(normalizedFeedbackId)}`,
      { signal: options?.signal },
    );

    return normalizeIncidentDetailResponse(response);
  },

  async startIncidentProcessing(incidentId, payload = {}) {
    const detailEndpoint = buildIncidentDetailEndpoint(incidentId);
    const response = await axiosClient.patch(
      `${detailEndpoint}/status`,
      normalizeStartIncidentProcessingPayload(payload),
    );

    return normalizeIncidentDetailResponse(response);
  },

  async getIncidentAssigneeCandidates(incidentId, options = {}) {
    const detailEndpoint = buildIncidentDetailEndpoint(incidentId);
    const response = await axiosClient.get(`${detailEndpoint}/assignee-candidates`, {
      signal: options?.signal,
    });

    return normalizeIncidentAssigneeCandidates(response);
  },

  async assignIncident(incidentId, payload = {}) {
    const detailEndpoint = buildIncidentDetailEndpoint(incidentId);
    const response = await axiosClient.post(
      `${detailEndpoint}/assign`,
      normalizeAssignIncidentPayload(payload),
    );

    return normalizeIncidentDetailResponse(response);
  },

  async getIncidentProviderCandidates(incidentId, options = {}) {
    const response = await axiosClient.get(`${buildIncidentDetailEndpoint(incidentId)}/provider-candidates`, {
      signal: options?.signal,
    });
    return normalizeIncidentExecutionCollection(response);
  },

  async getIncidentProviderAssignment(incidentId, options = {}) {
    const response = await axiosClient.get(`${buildIncidentDetailEndpoint(incidentId)}/provider-assignment`, {
      signal: options?.signal,
    });
    return normalizeIncidentProviderAssignmentResponse(response);
  },

  async assignIncidentProvider(incidentId, payload = {}) {
    const response = await axiosClient.post(
      `${buildIncidentDetailEndpoint(incidentId)}/provider-assignment`,
      normalizeAssignIncidentProviderPayload(payload),
    );
    return normalizeIncidentProviderAssignmentResponse(response);
  },

  async getProviderAssignmentContactLogs(providerAssignmentId, options = {}) {
    const response = await axiosClient.get(`${buildProviderAssignmentEndpoint(providerAssignmentId)}/contact-logs`, {
      signal: options?.signal,
    });
    return normalizeIncidentExecutionCollection(response);
  },

  async createProviderAssignmentContactLog(providerAssignmentId, payload = {}) {
    const response = await axiosClient.post(
      `${buildProviderAssignmentEndpoint(providerAssignmentId)}/contact-logs`,
      normalizeProviderAssignmentContactPayload(payload),
    );
    return unwrapIncidentExecutionResponse(response);
  },

  async updateProviderAssignmentStatus(providerAssignmentId, payload = {}) {
    const response = await axiosClient.patch(
      `${buildProviderAssignmentEndpoint(providerAssignmentId)}/status`,
      normalizeProviderAssignmentStatusPayload(payload),
    );
    return normalizeIncidentProviderAssignmentResponse(response);
  },

  async getProviderAssignmentCompletionDocuments(providerAssignmentId, options = {}) {
    const response = await axiosClient.get(`${buildProviderAssignmentEndpoint(providerAssignmentId)}/completion-documents`, {
      signal: options?.signal,
    });
    return normalizeIncidentExecutionCollection(response);
  },

  async uploadProviderAssignmentCompletionDocuments(providerAssignmentId, formData) {
    const endpoint = `${buildProviderAssignmentEndpoint(providerAssignmentId)}/completion-documents`;
    if (!(formData instanceof FormData)) throw new TypeError('Completion evidence must use FormData');
    // The shared authenticated client removes its JSON header for FormData;
    // the platform must generate the multipart boundary itself.
    const response = await axiosClient.post(endpoint, formData);
    return normalizeIncidentExecutionCollection(response);
  },

  async deleteProviderAssignmentCompletionDocuments(providerAssignmentId) {
    await axiosClient.delete(
      `${buildProviderAssignmentEndpoint(providerAssignmentId)}/completion-documents`,
    );
    // Swagger documents a successful 200 without a response DTO.
  },

  async getIncidentResolution(incidentId, options = {}) {
    const response = await axiosClient.get(`${buildIncidentDetailEndpoint(incidentId)}/resolution`, {
      signal: options?.signal,
    });
    return normalizeResolutionDecisionResponse(response);
  },

  async getLatestIncidentResolution(incidentId, options = {}) {
    const response = await axiosClient.get(`${buildIncidentDetailEndpoint(incidentId)}/resolutions/latest`, {
      signal: options?.signal,
    });
    return normalizeResolutionDecisionResponse(response);
  },

  async approveIncidentResolution(incidentId, resolutionId, payload = {}, options = {}) {
    const note = String(payload?.note ?? '').trim();
    const response = await axiosClient.post(
      `${buildIncidentDetailEndpoint(incidentId)}/resolutions/${positiveExecutionId(resolutionId, 'resolutionId')}/approve`,
      undefined,
      { params: note ? { note } : undefined, signal: options?.signal },
    );
    return normalizeResolutionDecisionResponse(response);
  },

  async requestIncidentResolutionRework(incidentId, resolutionId, payload = {}, options = {}) {
    const response = await axiosClient.post(
      `${buildIncidentDetailEndpoint(incidentId)}/resolutions/${positiveExecutionId(resolutionId, 'resolutionId')}/need-rework`,
      normalizeNeedReworkResolutionPayload(payload),
      { signal: options?.signal },
    );
    return normalizeResolutionDecisionResponse(response);
  },

  async getIncidentResolutions(incidentId, options = {}) {
    const response = await axiosClient.get(`${buildIncidentDetailEndpoint(incidentId)}/resolutions`, {
      signal: options?.signal,
    });
    return normalizeIncidentExecutionCollection(response);
  },

  async submitIncidentResolution(incidentId, payload = {}) {
    await axiosClient.post(
      `${buildIncidentDetailEndpoint(incidentId)}/resolutions`,
      normalizeSubmitIncidentResolutionPayload(payload),
    );
    // The success contract is 200 without a response DTO. Refetch authoritative state.
  },
});
