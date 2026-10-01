import { axiosClient } from './axiosClient.js';

const normalizeCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

let mockDbAdapter = null;

const getMockDb = async () => {
  if (mockDbAdapter) return mockDbAdapter;
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && import.meta.env?.VITE_USE_MOCK !== 'false') {
    try {
      const mod = await import('./mockStore.js');
      mockDbAdapter = mod.mockDb;
      return mockDbAdapter;
    } catch (error) {
      console.warn('Unable to initialize mock data store', error);
    }
  }
  return null;
};

export const toolsApi = {
  async init() {
    try {
      const db = await getMockDb();
      db?.init?.();
    } catch (error) {
      console.warn('toolsApi.init failed', error);
    }
  },
  async getAreas(params = {}, options = { throwOnError: false }) {
    try {
      const response = await axiosClient.get('/api/areas', { params });
      return normalizeCollection(response);
    } catch (error) {
      console.warn('toolsApi.getAreas failed', error);
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  },
  async getCategories(params = {}) {
    try {
      const response = await axiosClient.get('/api/categories', {
        params: { includeInactive: params.includeInactive ?? false },
      });
      return normalizeCollection(response);
    } catch (error) {
      console.warn('toolsApi.getCategories failed', error);
      throw error;
    }
  },
  async getCategory(categoryId) {
    const response = await axiosClient.get(`/api/categories/${categoryId}`);
    return response?.data ?? response;
  },
  async createCategory(payload) {
    const response = await axiosClient.post('/api/categories', payload);
    return response?.data ?? response;
  },
  async updateCategory(categoryId, payload) {
    const response = await axiosClient.put(`/api/categories/${categoryId}`, payload);
    return response?.data ?? response;
  },
  async setCategoryActive(categoryId, isActive) {
    const response = await axiosClient.patch(`/api/categories/${categoryId}/active`, { isActive });
    return response?.data ?? response;
  },
  async getOperators() { const db = await getMockDb(); return db?.getOperators?.() || []; },
  async getTickets() { const db = await getMockDb(); return db?.getTickets?.() || []; },
  async getComments() { const db = await getMockDb(); return db?.getComments?.() || []; },
  async getNotifications() { const db = await getMockDb(); return db?.getNotifications?.() || []; },
  async getIntegrations() { const db = await getMockDb(); return db?.getIntegrations?.() || []; },
  async getSlaConfig() { const db = await getMockDb(); return db?.getSlaConfig?.() || {}; },
  async getAuditLogs() { const db = await getMockDb(); return db?.getAuditLogs?.() || []; },
  async getUsers() { const db = await getMockDb(); return db?.getUsers?.() || []; },
  async aiClassify(title, description) { const db = await getMockDb(); return db?.aiClassify?.(title, description) || { summary: '', confidence: 0 }; },
  async checkDuplicates(categoryId, lat, lng) { const db = await getMockDb(); return db?.checkDuplicates?.(categoryId, lat, lng) || []; },
  async getAiConversations() {
    const response = await axiosClient.get('/api/ai/conversations/me');
    return normalizeCollection(response);
  },
  async getAiConversationMessages(conversationId) {
    const response = await axiosClient.get(`/api/ai/conversations/${conversationId}/messages`);
    return normalizeCollection(response);
  },
  async deleteAiConversation(conversationId) {
    await axiosClient.delete(`/api/ai/conversations/${conversationId}`);
    return true;
  },
  async getAiChatReply(messageOrPayload) {
    const payload = typeof messageOrPayload === 'string'
      ? { message: messageOrPayload }
      : messageOrPayload;
    const response = await axiosClient.post('/api/ai/chat', payload);
    return response?.data ?? response;
  },
  async createAiFeedbackDraft(payload) {
    const response = await axiosClient.post('/api/ai/feedback-draft', payload);
    return response?.data ?? response;
  },
  async addAudit(userId, action, entityName, entityId, oldValues, newValues) { const db = await getMockDb(); return db?.addAudit?.(userId, action, entityName, entityId, oldValues, newValues); },
  async updatePosts(updated) { const db = await getMockDb(); return db?.updateTickets?.(updated); },
  async updateIntegrations(updated) { const db = await getMockDb(); return db?.updateIntegrations?.(updated); },
  async updateTickets(updated) { const db = await getMockDb(); return db?.updateTickets?.(updated); },
  async updateNotifications(notifs) { const db = await getMockDb(); return db?.updateNotifications?.(notifs); },
  async updateComments(comments) { const db = await getMockDb(); return db?.updateComments?.(comments); },
  async updateCategories(cats) { const db = await getMockDb(); return db?.updateCategories?.(cats); },
};
