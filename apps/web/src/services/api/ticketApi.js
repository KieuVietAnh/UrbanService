import { apiClient } from './apiClient';
import { tokenStorage } from '../storage/tokenStorage';

const FEEDBACK_ROLES_MANAGEMENT = new Set([
  'system-staff',
  'interaction-manager',
  'administrator',
  'service-provider',
]);

const getStoredUserRole = () => tokenStorage.getUser()?.role || null;

const getFeedbackBasePath = (role) => {
  const resolvedRole = role || getStoredUserRole();
  if (FEEDBACK_ROLES_MANAGEMENT.has(resolvedRole)) {
    return '/api/management/feedbacks';
  }
  return '/api/user/feedbacks';
};

const getTicketPath = (feedbackId, role) => `${getFeedbackBasePath(role)}/${feedbackId}`;

export const ticketApi = {
  getTickets(filters = {}, options = {}) {
    return apiClient.get(getFeedbackBasePath(options.role), { params: filters });
  },

  getTicketById(feedbackId, options = {}) {
    return apiClient.get(getTicketPath(feedbackId, options.role));
  },

  createTicket(userId, reporterName, ticketData, options = {}) {
    return apiClient.post(getFeedbackBasePath(options.role), {
      userId,
      reporterName,
      ...ticketData,
    });
  },

  getComments(feedbackId, options = {}) {
    return apiClient.get(`${getTicketPath(feedbackId, options.role)}/comments`);
  },

  addComment(feedbackId, userId, userName, userRole, content, options = {}) {
    return apiClient.post(`${getTicketPath(feedbackId, options.role)}/comments`, {
      userId,
      userName,
      userRole,
      content,
    });
  },

  verifyAndApprove(feedbackId, staffUserId, updateData, options = {}) {
    return apiClient.put(`${getTicketPath(feedbackId, options.role)}/status`, {
      staffUserId,
      ...updateData,
    });
  },

  mergeTickets(masterId, duplicateIds, staffUserId, options = {}) {
    return apiClient.post(`${getFeedbackBasePath(options.role)}/merge`, {
      masterId,
      duplicateIds,
      staffUserId,
    });
  },

  updateOperatorStatus(feedbackId, operatorUserId, status, note, files = [], options = {}) {
    return apiClient.put(`${getTicketPath(feedbackId, options.role)}/status`, {
      operatorUserId,
      status,
      note,
      files,
    });
  },

  reviewResolution(feedbackId, staffUserId, isApproved, note, options = {}) {
    return apiClient.put(`${getTicketPath(feedbackId, options.role)}/status`, {
      staffUserId,
      isApproved,
      note,
    });
  },

  submitReview(feedbackId, userId, rating, isSatisfied, comment, options = {}) {
    return apiClient.post(`${getTicketPath(feedbackId, options.role)}/comments`, {
      userId,
      rating,
      isSatisfied,
      comment,
    });
  },

  async getHistory(feedbackId, options = {}) {
    const ticket = await this.getTicketById(feedbackId, options);
    return ticket?.statusHistories || [];
  },
};
