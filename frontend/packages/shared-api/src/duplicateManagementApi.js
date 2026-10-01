import { axiosClient } from './axiosClient.js';

const INCIDENT_MATCH_BASE_PATH = '/api/management/incident-match-candidates';

const requireCandidateId = (candidateId) => {
  const normalized = String(candidateId ?? '').trim();
  if (!normalized) throw new TypeError('candidateId is required');
  return encodeURIComponent(normalized);
};

const unwrapPayload = (response, fallback = {}) => (
  response?.data ?? response?.item ?? response?.result ?? response ?? fallback
);

export const normalizeIncidentMatchParams = (params = {}) => {
  const normalized = {};
  const status = String(params?.Status ?? params?.status ?? '').trim();
  const page = Number(params?.Page ?? params?.page);
  const pageSize = Number(params?.PageSize ?? params?.pageSize);

  if (status) normalized.Status = status;
  if (Number.isInteger(page) && page > 0) normalized.Page = page;
  if (Number.isInteger(pageSize) && pageSize > 0) normalized.PageSize = pageSize;

  return normalized;
};

export const normalizeIncidentMatchSummary = (response = {}) => {
  const payload = unwrapPayload(response);
  const summary = payload?.summary ?? payload;

  return {
    pending: Number(summary?.pendingCount ?? summary?.pending ?? 0) || 0,
    confirmed: Number(summary?.confirmedCount ?? summary?.confirmed ?? 0) || 0,
    rejected: Number(summary?.rejectedCount ?? summary?.rejected ?? 0) || 0,
    total: Number(summary?.totalCount ?? summary?.total ?? 0) || 0,
  };
};

export const normalizeIncidentMatchPage = (response = {}) => {
  const payload = unwrapPayload(response);

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pageNumber: Number(payload?.pageNumber ?? payload?.page) || 1,
    pageSize: Number(payload?.pageSize) || 0,
    totalItems: Number(payload?.totalItems ?? payload?.totalCount) || 0,
    totalPages: Number(payload?.totalPages) || 0,
    hasPreviousPage: Boolean(payload?.hasPreviousPage),
    hasNextPage: Boolean(payload?.hasNextPage),
  };
};

export const incidentMatchApi = Object.freeze({
  async getSummary(options = {}) {
    const response = await axiosClient.get(`${INCIDENT_MATCH_BASE_PATH}/summary`, {
      signal: options?.signal,
    });
    return normalizeIncidentMatchSummary(response);
  },

  async getCandidates(params = {}, options = {}) {
    const response = await axiosClient.get(INCIDENT_MATCH_BASE_PATH, {
      params: normalizeIncidentMatchParams(params),
      signal: options?.signal,
    });
    return normalizeIncidentMatchPage(response);
  },

  async getCandidate(candidateId, options = {}) {
    const response = await axiosClient.get(
      `${INCIDENT_MATCH_BASE_PATH}/${requireCandidateId(candidateId)}`,
      { signal: options?.signal },
    );
    return unwrapPayload(response, null);
  },

  async confirmCandidate(candidateId) {
    const response = await axiosClient.post(
      `${INCIDENT_MATCH_BASE_PATH}/${requireCandidateId(candidateId)}/confirm`,
    );
    return unwrapPayload(response, null);
  },

  async rejectCandidate(candidateId) {
    const response = await axiosClient.post(
      `${INCIDENT_MATCH_BASE_PATH}/${requireCandidateId(candidateId)}/reject`,
    );
    return unwrapPayload(response, null);
  },
});

// Compatibility layer for the legacy Staff routes. New Manager code uses the
// Incident vocabulary while existing imports keep working during migration.
export const duplicateManagementApi = Object.freeze({
  getDuplicateSummary: (...args) => incidentMatchApi.getSummary(...args),
  getDuplicateCandidates: (...args) => incidentMatchApi.getCandidates(...args),
  getDuplicateById: (...args) => incidentMatchApi.getCandidate(...args),
  confirmDuplicateCandidate: (...args) => incidentMatchApi.confirmCandidate(...args),
  rejectDuplicateCandidate: (...args) => incidentMatchApi.rejectCandidate(...args),
});
