/**
 * @typedef {Object} ChatbotMessageRequest
 * @property {string} message
 */

/**
 * @typedef {Object} TicketStatusRequest
 * @property {string} ticketId
 */

export const chatbotTypes = {
  message: {
    message: '',
  },
  ticketStatus: {
    ticketId: '',
  },
};
