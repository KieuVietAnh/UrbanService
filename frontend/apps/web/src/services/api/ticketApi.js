import { ticketApi as sharedTicketApi } from '@urbanmind/shared-api';

const getRequestStatus = (error) => {
  const rawStatus = error?.status ?? error?.response?.status;
  const status = Number(rawStatus);
  return Number.isFinite(status) ? status : null;
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const getResolutions = async (feedbackId, options = {}) => {
  try {
    return await sharedTicketApi.getResolutions(feedbackId, options);
  } catch (error) {
    const role = normalizeRole(options?.role);

    // A resident can still view their Feedback even when the resolution is not
    // public/eligible yet. Treat that resolution-only 400 as "no public
    // resolution available" instead of failing the entire Ticket Detail flow.
    if (role === 'service-user' && getRequestStatus(error) === 400) {
      return [];
    }

    throw error;
  }
};

// Keep the shared API as the source of truth while allowing resident-specific
// behavior for optional resolution data.
export const ticketApi = {
  ...sharedTicketApi,
  getResolutions,
};
