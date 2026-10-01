export interface Notification {
  notificationId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  incidentId?: string;
  targetId?: string;
  targetType?: string;
  /** Compatibility only for older API responses. */
  relatedId?: string;
  relatedType?: string;
  targetUrl?: string;
}

export interface NotificationItem {
  notificationId: number;
  id?: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  incidentId?: string;
  targetId?: string;
  targetType?: string;
  /** Compatibility only for older API responses. */
  relatedId?: string;
  relatedType?: string;
  targetUrl?: string;
}

export interface NotificationPage {
  items: Notification[];
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
