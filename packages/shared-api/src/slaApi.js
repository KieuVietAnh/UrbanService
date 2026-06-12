import { mockDb } from './mockStore.js';

export const slaApi = {
  async getSlaConfig() {
    return mockDb.getSlaConfig();
  },

  async updateSlaConfig(updates) {
    const current = mockDb.getSlaConfig();
    const merged = { ...current, ...updates };
    mockDb.updateSlaConfig(merged);
    return merged;
  }
};
