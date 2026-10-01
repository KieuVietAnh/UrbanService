import { axiosClient } from './axiosClient.js';
import { toolsApi } from './toolsApi.js';

const unwrap = (response) => response?.data ?? response;
const unwrapApiData = (response) => {
  const payload = unwrap(response);
  return payload?.data ?? payload;
};

const toQueryParams = (params = {}) => {
  const next = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') next[key] = value;
  });
  return next;
};

export const slaApi = {
  async getPolicies(params = {}) {
    const response = await axiosClient.get('/api/sla-policies', {
      params: toQueryParams({
        Search: params.search,
        AreaId: params.areaId,
        CategoryId: params.categoryId,
        Priority: params.priority,
        IsActive: params.isActive,
        IsCurrentlyEffective: params.isCurrentlyEffective,
        PageNumber: params.pageNumber ?? 1,
        PageSize: params.pageSize ?? 10,
      }),
    });
    return unwrapApiData(response) || { items: [], pageNumber: 1, pageSize: 10, totalItems: 0, totalPages: 0 };
  },

  async getPolicy(policyId) {
    const response = await axiosClient.get(`/api/sla-policies/${policyId}`);
    return unwrapApiData(response);
  },

  async createPolicy(payload) {
    const response = await axiosClient.post('/api/sla-policies', payload);
    return unwrapApiData(response);
  },

  async updatePolicy(policyId, payload) {
    const response = await axiosClient.put(`/api/sla-policies/${policyId}`, payload);
    return unwrapApiData(response);
  },

  async setPolicyActive(policyId, isActive) {
    const response = await axiosClient.patch(`/api/sla-policies/${policyId}/active`, { isActive });
    return unwrapApiData(response);
  },

  async deletePolicy(policyId) {
    const response = await axiosClient.delete(`/api/sla-policies/${policyId}`);
    return unwrapApiData(response);
  },

  // ---------------------------------------------------------------------------
  // Vòng đời SLA của sự vụ.
  //
  // SLA đã chuyển hẳn từ Feedback sang Incident ở backend, nên mọi thao tác dưới
  // đây nhận incidentId. Các hàm *FeedbackSla cũ đã bị gỡ vì route
  // /api/slas/feedback/... không còn tồn tại và chỉ trả về 404.
  // ---------------------------------------------------------------------------

  async startIncidentSla(incidentId) {
    const response = await axiosClient.post(`/api/slas/incident/${incidentId}/start`);
    return unwrapApiData(response);
  },

  async getCurrentIncidentSla(incidentId, requestConfig = {}) {
    const response = await axiosClient.get(`/api/slas/incident/${incidentId}`, requestConfig);
    return unwrapApiData(response);
  },

  async getIncidentSlaStatus(incidentId, requestConfig = {}) {
    const response = await axiosClient.get(`/api/slas/incident/${incidentId}/status`, requestConfig);
    return unwrapApiData(response);
  },

  async getIncidentSlaTimeline(incidentId, requestConfig = {}) {
    const response = await axiosClient.get(`/api/slas/incident/${incidentId}/timeline`, requestConfig);
    return unwrapApiData(response);
  },

  // Backend nhận ghi chú dưới dạng một chuỗi JSON trần, không bọc trong object.
  async markIncidentResponded(incidentId, note = null) {
    const response = await axiosClient.patch(
      `/api/slas/incident/${incidentId}/responded`,
      JSON.stringify(note),
      { headers: { 'Content-Type': 'application/json' } },
    );
    return unwrapApiData(response);
  },

  async pauseIncidentSla(incidentId, payload) {
    const response = await axiosClient.post(`/api/slas/incident/${incidentId}/pause`, payload);
    return unwrapApiData(response);
  },

  async resumeIncidentSla(incidentId, payload) {
    const response = await axiosClient.post(`/api/slas/incident/${incidentId}/resume`, payload);
    return unwrapApiData(response);
  },

  async completeIncidentSla(incidentId, payload) {
    const response = await axiosClient.post(`/api/slas/incident/${incidentId}/complete`, payload);
    return unwrapApiData(response);
  },

  async recalculateIncidentSla(incidentId, payload) {
    const response = await axiosClient.post(`/api/slas/incident/${incidentId}/recalculate`, payload);
    return unwrapApiData(response);
  },

  async cancelIncidentSla(incidentId, note = null) {
    const response = await axiosClient.post(`/api/slas/incident/${incidentId}/cancel`, note);
    return unwrapApiData(response);
  },

  // Nhận id của bản ghi SLA, không phải id của sự vụ.
  async checkIncidentSlaViolation(incidentSlaId) {
    const response = await axiosClient.post(`/api/slas/${incidentSlaId}/check`);
    return unwrapApiData(response);
  },

  async getDashboardOverview() {
    const response = await axiosClient.get('/api/slas/dashboard/overview');
    return unwrapApiData(response);
  },

  async getDashboardCompliance() {
    const response = await axiosClient.get('/api/slas/dashboard/compliance');
    return unwrapApiData(response);
  },

  async getDashboardPerformance() {
    const response = await axiosClient.get('/api/slas/dashboard/performance');
    return unwrapApiData(response);
  },

  async getDashboardViolationsChart() {
    const response = await axiosClient.get('/api/slas/dashboard/violations/chart');
    return unwrapApiData(response);
  },

  async getDashboardNearingBreach(limit = 10) {
    const response = await axiosClient.get('/api/slas/dashboard/nearing-breach', {
      params: toQueryParams({ limit }),
    });
    return unwrapApiData(response);
  },

  async getDashboardRecentBreach(limit = 10) {
    const response = await axiosClient.get('/api/slas/dashboard/recent-breach', {
      params: toQueryParams({ limit }),
    });
    return unwrapApiData(response);
  },

  async getAreas() {
    return toolsApi.getAreas({ includeInactive: false });
  },

  async getCategories() {
    return toolsApi.getCategories();
  },
};
