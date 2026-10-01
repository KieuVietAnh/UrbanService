/**
 * @typedef {Object} Notification
 * @property {number} notificationId
 * @property {string} userId
 * @property {string} title
 * @property {string} message
 * @property {string} type
 * @property {boolean} isRead
 * @property {string} targetUrl
 * @property {string | null} incidentId
 * @property {string | null} targetType
 * @property {string | null} targetId
 * @property {string} createdAt
 */

/**
 * @typedef {Object} NotificationPagination
 * @property {Notification[]} items
 * @property {number} pageNumber
 * @property {number} pageSize
 * @property {number} totalItems
 * @property {number} totalPages
 * @property {boolean} hasPreviousPage
 * @property {boolean} hasNextPage
 */

export const notificationTypes = {
  notification: {
    notificationId: 0,
    userId: '',
    title: '',
    message: '',
    type: '',
    isRead: false,
    targetUrl: '',
    incidentId: null,
    targetType: null,
    targetId: null,
    createdAt: '',
  },
  pagination: {
    items: [],
    pageNumber: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  },
};
