// src/services/api/notificationApi.js
import { apiClient } from './apiClient';
import { mockDb } from '../../store/mockStore';

export const notificationApi = {
  getNotifications(userId) {
    return apiClient.request(() => {
      const notifs = mockDb.getNotifications();
      return notifs.filter(n => n.userId === userId);
    });
  },

  markAsRead(notificationId) {
    return apiClient.request(() => {
      const notifs = mockDb.getNotifications();
      const notif = notifs.find(n => n.notificationId === Number(notificationId));
      if (notif) {
        notif.isRead = true;
        mockDb.updateNotifications(notifs);
      }
      return { success: true };
    });
  },

  markAllAsRead(userId) {
    return apiClient.request(() => {
      const notifs = mockDb.getNotifications();
      notifs.forEach(n => {
        if (n.userId === userId) n.isRead = true;
      });
      mockDb.updateNotifications(notifs);
      return { success: true };
    });
  }
};
