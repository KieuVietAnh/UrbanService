import { axiosClient } from './axiosClient.js';
import {
  normalizeAssignmentId,
  normalizeStaffResponsibilityCollection,
  normalizeStaffResponsibilityCreatePayload,
  normalizeStaffResponsibilityFilters,
  normalizeStaffResponsibilityUpdatePayload,
} from './staffResponsibilityUtils.mjs';

const BASE = '/api/management/staff-responsibilities';

export {
  normalizeStaffResponsibilityCollection,
  normalizeStaffResponsibilityCreatePayload,
  normalizeStaffResponsibilityFilters,
  normalizeStaffResponsibilityUpdatePayload,
};

export const staffResponsibilityApi = Object.freeze({
  async getAll(filters = {}, options = {}) {
    const response = await axiosClient.get(BASE, { params: normalizeStaffResponsibilityFilters(filters), signal: options?.signal });
    return normalizeStaffResponsibilityCollection(response);
  },
  async create(payload, options = {}) {
    const response = await axiosClient.post(BASE, normalizeStaffResponsibilityCreatePayload(payload), { signal: options?.signal });
    return response?.data ?? response;
  },
  async update(assignmentId, payload, options = {}) {
    const response = await axiosClient.put(`${BASE}/${normalizeAssignmentId(assignmentId)}`, normalizeStaffResponsibilityUpdatePayload(payload), { signal: options?.signal });
    return response?.data ?? response;
  },
  async setActive(assignmentId, isActive, options = {}) {
    const response = await axiosClient.patch(`${BASE}/${normalizeAssignmentId(assignmentId)}/active`, { isActive: Boolean(isActive) }, { signal: options?.signal });
    return response?.data ?? response;
  },
});
