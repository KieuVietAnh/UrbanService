import { axiosClient } from './axiosClient.js';

const unwrap = (response) => response?.data ?? response;

export const userAreaAlertApi = {
  async getSubscriptions() {
    const response = await axiosClient.get('/api/user/area-subscriptions');
    const payload = unwrap(response);
    return Array.isArray(payload) ? payload : [];
  },

  async subscribe(areaId, options = {}) {
    const payload = {
      areaId: Number(areaId),
      isPrimaryArea: Boolean(options.isPrimaryArea),
      receiveAlerts: options.receiveAlerts !== false,
    };

    const response = await axiosClient.post('/api/user/area-subscriptions', payload);
    return unwrap(response);
  },

  unsubscribe(areaId) {
    return axiosClient.delete(`/api/user/area-subscriptions/${areaId}`);
  },

  async getAlerts(params = {}) {
    const response = await axiosClient.get('/api/user/area-alerts', { params });
    const payload = unwrap(response) || {};

    if (Array.isArray(payload)) {
      return {
        items: payload,
        pageNumber: 1,
        pageSize: payload.length,
        totalItems: payload.length,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };
    }

    return {
      ...payload,
      items: Array.isArray(payload.items) ? payload.items : [],
    };
  },
};
