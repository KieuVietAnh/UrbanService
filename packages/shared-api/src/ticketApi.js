import { axiosClient } from './axiosClient.js';

const FEEDBACK_ROLES_MANAGEMENT = new Set([
  'system-staff',
  'interaction-manager',
  'administrator',
  'service-provider',
]);

const getStoredUserRole = () => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('urbanmind_auth_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role || null;
  } catch {
    return null;
  }
};

const getFeedbackBasePath = (role) => {
  const resolvedRole = role || getStoredUserRole();
  if (FEEDBACK_ROLES_MANAGEMENT.has(resolvedRole)) {
    return '/api/management/feedbacks';
  }
  return '/api/user/feedbacks';
};

const getTicketPath = (feedbackId, role) => {
  const base = getFeedbackBasePath(role);
  return `${base}/${feedbackId}`;
};

const normalizeTicketsResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  if (response?.content && Array.isArray(response.content)) return response.content;
  if (response?.items && Array.isArray(response.items)) return response.items;
  return [];
};

export const ticketApi = {
  async getTickets(filters = {}, options = {}) {
    const response = await axiosClient.get(getFeedbackBasePath(options.role), { params: filters });
    return normalizeTicketsResponse(response);
  },

  getTicketById(feedbackId, options = {}) {
    return axiosClient.get(getTicketPath(feedbackId, options.role));
  },

  createTicket(userId, reporterName, ticketData, options = {}) {
    return axiosClient.post(getFeedbackBasePath(options.role), {
      userId,
      reporterName,
      ...ticketData,
    });
  },

  getComments(feedbackId, options = {}) {
    return axiosClient.get(`${getTicketPath(feedbackId, options.role)}/comments`);
  },

  addComment(feedbackId, userId, userName, userRole, content, options = {}) {
    return axiosClient.post(`${getTicketPath(feedbackId, options.role)}/comments`, {
      userId,
      userName,
      userRole,
      content,
    });
  },

  verifyAndApprove(feedbackId, staffUserId, updateData, options = {}) {
    return axiosClient.put(`${getTicketPath(feedbackId, options.role)}/status`, {
      staffUserId,
      ...updateData,
    });
  },

  mergeTickets(masterId, duplicateIds, staffUserId, options = {}) {
    return axiosClient.post(`${getFeedbackBasePath(options.role)}/merge`, {
      masterId,
      duplicateIds,
      staffUserId,
    });
  },

  updateOperatorStatus(feedbackId, operatorUserId, status, note, files = [], options = {}) {
    return axiosClient.put(`${getTicketPath(feedbackId, options.role)}/status`, {
      operatorUserId,
      status,
      note,
      files,
    });
  },

  reviewResolution(feedbackId, staffUserId, isApproved, note, options = {}) {
    return axiosClient.put(`${getTicketPath(feedbackId, options.role)}/status`, {
      staffUserId,
      isApproved,
      note,
    });
  },

  submitReview(feedbackId, userId, rating, isSatisfied, comment, options = {}) {
    return axiosClient.post(`${getTicketPath(feedbackId, options.role)}/comments`, {
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
