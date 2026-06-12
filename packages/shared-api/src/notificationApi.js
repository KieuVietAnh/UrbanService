import { mockDb } from './mockStore.js';

export const notificationApi = {
  async getNotifications(userId) {
    const notifs = mockDb.getNotifications();
    return notifs.filter((n) => n.userId === userId);
  },

  async markAsRead(notificationId) {
    const notifs = mockDb.getNotifications();
    const notif = notifs.find((n) => n.notificationId === Number(notificationId));
    if (notif) {
      notif.isRead = true;
      mockDb.updateNotifications(notifs);
    }
    return { success: true };
  },

  async markAllAsRead(userId) {
    const notifs = mockDb.getNotifications();
    notifs.forEach((n) => {
      if (n.userId === userId) n.isRead = true;
    });
    mockDb.updateNotifications(notifs);
    return { success: true };
  }
};
