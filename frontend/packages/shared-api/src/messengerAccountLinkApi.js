import { axiosClient } from './axiosClient.js';

const unwrap = response => response?.data ?? response;

export const messengerAccountLinkApi = {
  async getLinks() {
    const response = await axiosClient.get('/api/user/messenger-links');
    const payload = unwrap(response);
    return Array.isArray(payload) ? payload : [];
  },

  async confirm(token) {
    const response = await axiosClient.post('/api/user/messenger-links/confirm', {
      token: String(token || '').trim(),
    });
    return unwrap(response);
  },

  revoke(linkId) {
    return axiosClient.delete(`/api/user/messenger-links/${linkId}`);
  },
};
