import { axiosClient } from './axiosClient.js';
import {
  getFeedbackBasePath,
  normalizeTicketsResponse,
  normalizeCommentsResponse,
} from './ticketApiHelpers.js';

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

const getTicketPath = (feedbackId, role) => {
  const base = getFeedbackBasePath(role, getStoredUserRole());
  return `${base}/${feedbackId}`;
};

export const ticketApi = {
  async getTickets(filters = {}, options = {}) {
    const response = await axiosClient.get(getFeedbackBasePath(options.role), { params: filters });
    return normalizeTicketsResponse(response);
  },

  getTicketById(feedbackId, options = {}) {
    return (async () => {
      const res = await axiosClient.get(getTicketPath(feedbackId, options.role));
      try {
        if (res && Array.isArray(res.attachments)) {
          res.attachments = res.attachments.map((a) => {
            if (!a) return a;
            if (typeof a === 'string') return a;
            return a.fileUrl || a.url || a.path || (a.attachmentId ? `/api/attachments/${a.attachmentId}` : (a.id ? `/api/attachments/${a.id}` : a));
          });
        }
      } catch (e) {
        console.warn('Failed to normalize attachments', e);
      }
      return res;
    })();
  },

  createTicket(userId, reporterName, ticketData, options = {}) {
    // Detect file-like attachments (browser File/Blob or RN {uri,name,type})
    const hasFileAttachments = Array.isArray(ticketData?.attachments) && ticketData.attachments.some((item) => {
      try {
        if (!item) return false;
        if (typeof File !== 'undefined' && item instanceof File) return true;
        if (typeof Blob !== 'undefined' && item instanceof Blob) return true;
        // React Native style: { uri, name }
        if (typeof item === 'object' && ('uri' in item || 'name' in item)) return true;
      } catch (e) {
        return false;
      }
      return false;
    });

    if (hasFileAttachments && typeof FormData !== 'undefined') {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('reporterName', reporterName);

      Object.entries(ticketData || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          value.forEach((item) => {
            // If it's a file-like object, append directly
            formData.append(key, item);
          });
        } else if (typeof value === 'object' && value !== null && ('uri' in value || 'name' in value)) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      });

      return axiosClient.post(getFeedbackBasePath(options.role), formData, {
        headers: {
          'Content-Type': undefined,
        },
      });
    }

    return axiosClient.post(getFeedbackBasePath(options.role), {
      userId,
      reporterName,
      ...ticketData,
    });
  },

  getComments(feedbackId, options = {}) {
    const path = `${getTicketPath(feedbackId, options.role)}/comments`;

    return (async () => {
      try {
        const res = await axiosClient.get(path);
        return normalizeCommentsResponse(res);
      } catch (err) {
        console.warn('shared-api getComments GET failed', feedbackId, err?.response?.status, err?.response?.data || err?.message || err);
      }

      try {
        const res = await axiosClient.get(path, { params: { page: 0, size: 50 } });
        return normalizeCommentsResponse(res);
      } catch (err2) {
        console.warn('shared-api getComments GET with params failed', feedbackId, err2?.response?.status, err2?.response?.data || err2?.message || err2);
      }

      try {
        const res = await axiosClient.post(path, { page: 0, size: 50 });
        return normalizeCommentsResponse(res);
      } catch (err3) {
        console.warn('shared-api getComments POST {page,size} failed', feedbackId, err3?.response?.status, err3?.response?.data || err3?.message || err3);
      }

      try {
        const res = await axiosClient.post(path);
        return normalizeCommentsResponse(res);
      } catch (err4) {
        console.warn('shared-api getComments POST empty body failed', feedbackId, err4?.response?.status, err4?.response?.data || err4?.message || err4);
      }

      try {
        const params = new URLSearchParams();
        params.append('page', '0');
        params.append('size', '50');
        const res = await axiosClient.post(path, params);
        return normalizeCommentsResponse(res);
      } catch (err5) {
        console.error('shared-api getComments all attempts failed for', feedbackId, err5?.response?.status, err5?.response?.data || err5?.message || err5);
        return [];
      }
    })();
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
