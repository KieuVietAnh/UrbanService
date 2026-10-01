import { axiosClient } from './axiosClient.js';

const normalizeNotificationPagination = (data) => {
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

  return {
    items,
    pageNumber: typeof data?.pageNumber === 'number' ? data.pageNumber : 1,
    pageSize: typeof data?.pageSize === 'number' ? data.pageSize : 10,
    totalItems: typeof data?.totalItems === 'number' ? data.totalItems : items.length,
    totalPages: typeof data?.totalPages === 'number' ? data.totalPages : 1,
    hasPreviousPage: Boolean(data?.hasPreviousPage),
    hasNextPage: Boolean(data?.hasNextPage),
  };
};

export const notificationApi = {
  async getNotifications(pageNumber = 1, pageSize = 10, isRead) {
    try {
      const params = { pageNumber, pageSize };
      if (typeof isRead === 'boolean') {
        params.isRead = isRead;
      }
      const response = await axiosClient.get('/api/notifications', { params });
      return normalizeNotificationPagination(response);
    } catch (error) {
      console.error('Notification API getNotifications failed', error);
      throw error;
    }
  },

  async markNotificationAsRead(notificationId) {
    if (!Number.isInteger(notificationId) || notificationId <= 0 || notificationId > 2147483647) {
      throw new Error('notificationId must be a positive int32.');
    }
    try {
      await axiosClient.patch(`/api/notifications/${notificationId}/read`);
      return { success: true };
    } catch (error) {
      console.error('Notification API markNotificationAsRead failed', error);
      throw error;
    }
  },

  async markAllNotificationsAsRead() {
    try {
      await axiosClient.patch('/api/notifications/read-all');
      return { success: true };
    } catch (error) {
      console.error('Notification API markAllNotificationsAsRead failed', error);
      throw error;
    }
  },
};
