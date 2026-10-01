import { notificationApi as sharedNotificationApi } from '@urbanmind/shared-api';
import type { NotificationPage } from '../types/notification.types';

export type { Notification, NotificationPage } from '../types/notification.types';

export const notificationApi = {
  /** Paginated notification list, optionally filtered by read state */
  async list(pageNumber = 1, pageSize = 20, isRead?: boolean): Promise<NotificationPage> {
    return sharedNotificationApi.getNotifications(pageNumber, pageSize, isRead) as Promise<NotificationPage>;
  },

  /** Mark a single notification as read */
  async markRead(notificationId: number): Promise<void> {
    await sharedNotificationApi.markNotificationAsRead(notificationId);
  },

  /** Mark all notifications as read */
  async markAllRead(): Promise<void> {
    await sharedNotificationApi.markAllNotificationsAsRead();
  },
};
