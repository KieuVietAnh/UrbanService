import { axiosClient } from './axiosClient.js';
import {
  getFeedbackBasePath,
  normalizeRoleForFeedback,
  normalizeTicketsResponse,
  normalizeCommentsResponse,
} from './ticketApiHelpers.js';
import { managementTypes } from '@urbanmind/shared-types';
import { normalizeCommentPayload } from './managementFeedbackApi.js';

const getTicketPath = (feedbackId, role) => {
  const base = getFeedbackBasePath(role);
  return `${base}/${feedbackId}`;
};

const updateFeedbackStatus = (feedbackId, statusData, options = {}) => {
  // Swagger defines the status endpoint as PATCH /api/management/feedbacks/{feedbackId}/status.
  // The previous PUT call hit the same route with an unsupported verb, which produced 405.
  return axiosClient.patch(`${getTicketPath(feedbackId, options.role)}/status`, statusData);
};

export const ticketApi = {
  async getTickets(filters = {}, options = {}) {
    const response = await axiosClient.get(getFeedbackBasePath(options.role), { params: filters });
    return normalizeTicketsResponse(response);
  },

  async getAllTickets(filters = {}, options = {}) {
    const {
      pageNumber: _ignoredPageNumber,
      pageSize: requestedPageSize,
      ...baseFilters
    } = filters || {};
    const pageSize = Math.max(1, Number(requestedPageSize) || 100);
    const allTickets = [];
    const seenTicketIds = new Set();
    let pageNumber = 1;
    let totalPages = null;

    // The user feedback endpoint is paged. Fetch every backend page so callers
    // that need client-side grouped filters/sorting do not silently stop at 100 items.
    while (totalPages === null || pageNumber <= totalPages) {
      const response = await axiosClient.get(getFeedbackBasePath(options.role), {
        params: {
          ...baseFilters,
          pageNumber,
          pageSize,
        },
      });
      const pagedPayload = (
        response?.data &&
        !Array.isArray(response.data) &&
        (Array.isArray(response.data.items) || response.data.totalPages != null)
      )
        ? response.data
        : response;
      const pageTickets = normalizeTicketsResponse(pagedPayload);

      pageTickets.forEach((ticket) => {
        const ticketId = ticket?.feedbackId || ticket?.id;
        if (!ticketId) {
          allTickets.push(ticket);
          return;
        }

        const normalizedId = String(ticketId);
        if (!seenTicketIds.has(normalizedId)) {
          seenTicketIds.add(normalizedId);
          allTickets.push(ticket);
        }
      });

      const reportedTotalPages = Number(pagedPayload?.totalPages);
      if (Number.isFinite(reportedTotalPages) && reportedTotalPages >= 0) {
        totalPages = reportedTotalPages;
      }

      if (pagedPayload?.hasNextPage === false) break;
      if (totalPages !== null && pageNumber >= totalPages) break;

      // Fallback for APIs that omit pagination metadata.
      if (totalPages === null && pageTickets.length < pageSize) break;
      if (pageTickets.length === 0) break;

      pageNumber += 1;

      // Defensive guard against malformed pagination metadata.
      if (pageNumber > 1000) {
        console.warn('ticketApi.getAllTickets stopped after 1000 pages');
        break;
      }
    }

    return allTickets;
  },

  getTicketById(feedbackId, options = {}) {
    return (async () => {
      const response = await axiosClient.get(getTicketPath(feedbackId, options.role));
      const payload = response?.data ?? response?.item ?? response?.result ?? response;
      const res = normalizeTicketsResponse([payload])[0] || payload;

      try {
        if (res && Array.isArray(res.attachments)) {
          res.attachments = res.attachments.map((a) => {
            if (!a) return a;

            if (typeof a === 'string') {
              return {
                fileUrl: a,
                url: a,
              };
            }

            return {
              ...a,
              attachmentId:
                a.attachmentId ||
                a.attachmentID ||
                a.feedbackAttachmentId ||
                a.feedbackAttachmentID ||
                a.fileId ||
                a.fileID ||
                a.id ||
                null,
              fileUrl:
                a.fileUrl ||
                a.url ||
                a.path ||
                a.attachmentUrl ||
                a.displayUrl ||
                '',
            };
          });
        }
      } catch (e) {
        console.warn('Failed to normalize attachments', e);
      }

      return res;
    })();
  },

  createTicket(_userId, _reporterName, ticketData, options = {}) {
    if (typeof FormData === 'undefined') {
      throw new Error('FormData is required to create feedback.');
    }

    const formData = new FormData();
    const swaggerFields = [
      ['AreaId', 'areaId'],
      ['CategoryId', 'categoryId'],
      ['Title', 'title'],
      ['Description', 'description'],
      ['LocationText', 'locationText'],
      ['Latitude', 'latitude'],
      ['Longitude', 'longitude'],
      ['LocationAccuracyMeters', 'locationAccuracyMeters'],
      ['GeoSource', 'geoSource'],
      ['Priority', 'priority'],
      ['DueDate', 'dueDate'],
    ];

    swaggerFields.forEach(([formKey, dataKey]) => {
      const value = ticketData?.[dataKey];
      if (value !== undefined && value !== null && value !== '') {
        formData.append(formKey, String(value));
      }
    });

    const attachments = Array.isArray(ticketData?.attachments)
      ? ticketData.attachments.filter(Boolean)
      : [];

    attachments.forEach((file) => {
      const isBlob = typeof Blob !== 'undefined' && file instanceof Blob;
      if (isBlob) {
        formData.append('Attachments', file, file?.name || 'attachment');
      } else {
        formData.append('Attachments', file);
      }
    });

    return axiosClient.post(getFeedbackBasePath(options.role), formData, {
      headers: {
        'Content-Type': undefined,
      },
    });
  },

  updateTicket(feedbackId, ticketData, options = {}) {
    return axiosClient.put(getTicketPath(feedbackId, options.role), ticketData);
  },

  deleteTicket(feedbackId, options = {}) {
    return axiosClient.delete(getTicketPath(feedbackId, options.role));
  },

  addAttachments(feedbackId, files = [], options = {}) {
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append('Files', file, file.name);
    });

    return axiosClient.post(
      `${getTicketPath(feedbackId, options.role)}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  deleteAttachment(feedbackId, attachmentId, options = {}) {
    return axiosClient.delete(
      `${getTicketPath(feedbackId, options.role)}/attachments/${attachmentId}`
    );
  },

  supportTicket(feedbackId, options = {}) {
    return axiosClient.post(`${getTicketPath(feedbackId, options.role)}/support`);
  },

  unsupportTicket(feedbackId, options = {}) {
    return axiosClient.delete(`${getTicketPath(feedbackId, options.role)}/support`);
  },

 getComments(feedbackId, options = {}) {
  return (async () => {
    try {
      const ticket = await axiosClient.get(getTicketPath(feedbackId, options.role));
      return normalizeCommentsResponse(ticket);
    } catch (err) {
      return [];
    }
  })();
},

  addComment(feedbackId, userId, userName, userRole, content, options = {}) {
    return axiosClient.post(`${getTicketPath(feedbackId, options.role)}/comments`, normalizeCommentPayload({ content }));
  },

  async verifyAndApprove(feedbackId, staffUserId, updateData = {}, options = {}) {
    const { note, status = managementTypes.feedbackStatus.VERIFIED, ...feedbackUpdates } = updateData || {};

    if (Object.keys(feedbackUpdates).length > 0) {
      await this.updateTicket(feedbackId, feedbackUpdates, options);
    }

    return updateFeedbackStatus(feedbackId, {
      status,
      note: note || 'Feedback verified after AI review.',
    }, options);
  },

  mergeTickets(masterId, duplicateIds, staffUserId, options = {}) {
    return axiosClient.post(`${getFeedbackBasePath(options.role)}/merge`, {
      masterId,
      duplicateIds,
      staffUserId,
    });
  },

  updateOperatorStatus(feedbackId, operatorUserId, status, note, files = [], options = {}) {
    return updateFeedbackStatus(feedbackId, {
      status,
      note,
    }, options);
  },

  reviewResolution(feedbackId, staffUserId, isApproved, note, options = {}) {
    return updateFeedbackStatus(feedbackId, {
      status: isApproved ? managementTypes.feedbackStatus.APPROVED : managementTypes.feedbackStatus.NEED_REWORK,
      note,
    }, options);
  },

  submitReview(feedbackId, userId, rating, isSatisfied, comment, options = {}) {
    return axiosClient.post(`${getTicketPath(feedbackId, options.role)}/resolution-review`, {
      rating: Number(rating),
      isSatisfied: Boolean(isSatisfied),
      comment: typeof comment === 'string' ? comment.trim() : String(comment ?? ''),
    });
  },

  async getResolutions(feedbackId, options = {}) {
    const response = await axiosClient.get(`${getTicketPath(feedbackId, options.role)}/resolutions`);
    const payload = response?.data ?? response?.items ?? response?.result ?? response;
    return Array.isArray(payload) ? payload.filter(Boolean) : [];
  },

  async getHistory(feedbackId, options = {}) {
    const ticket = await this.getTicketById(feedbackId, options);
    return ticket?.statusHistories || [];
  },
};
