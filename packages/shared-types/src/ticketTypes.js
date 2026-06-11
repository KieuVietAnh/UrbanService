/**
 * @typedef {Object} TicketCreatePayload
 * @property {string} title
 * @property {string} description
 * @property {number} categoryId
 * @property {string} priority
 * @property {string} locationText
 * @property {number} latitude
 * @property {number} longitude
 */

/**
 * @typedef {Object} TicketStatusUpdatePayload
 * @property {string} status
 * @property {string} note
 */

export const ticketTypes = {
  create: {
    title: '',
    description: '',
    categoryId: 0,
    priority: '',
    locationText: '',
    latitude: 0,
    longitude: 0,
  },
  statusUpdate: {
    status: '',
    note: '',
  },
};
