import { useCallback, useEffect, useSyncExternalStore } from 'react';
import * as signalR from '@microsoft/signalr';
import { notificationApi } from '../services/api/notificationApi';
import { buildHubUrl, getSignalRAccessToken } from '../utils/signalRAccessToken';
import { createOptionalSignalRConnection } from '../utils/optionalSignalR';
import { buildRemainingNotificationPages, mergeNotificationPage, readNotificationTotal } from './notificationStoreUtils';

const CACHE_TTL = 60_000;
const DEFAULT_PAGE_SIZE = 50;
const stores = new Map();
const realtimeSubscriptions = new Map();
const realtimeRefreshTimers = new Map();

const createStore = () => ({
  notifications: [],
  unreadCount: 0,
  totalCount: 0,
  pageNumber: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 1,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  initialized: false,
  error: '',
  lastFetchedAt: 0,
  listeners: new Set(),
  request: null,
  fullRequest: null,
  snapshot: null,
});

const getStore = (userId) => {
  const key = userId || '__anonymous__';
  if (!stores.has(key)) stores.set(key, createStore());
  return stores.get(key);
};

const emit = (store) => {
  store.snapshot = {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    totalCount: store.totalCount,
    pageNumber: store.pageNumber,
    pageSize: store.pageSize,
    totalPages: store.totalPages,
    hasNextPage: store.hasNextPage,
    loading: store.loading,
    loadingMore: store.loadingMore,
    initialized: store.initialized,
    error: store.error,
  };
  store.listeners.forEach((listener) => listener());
};

const applyItems = (store, response, { append = false, unreadTotal } = {}) => {
  const items = Array.isArray(response?.items) ? response.items : [];
  store.notifications = append
    ? mergeNotificationPage(store.notifications, items)
    : items;
  store.totalCount = readNotificationTotal(response);
  store.pageNumber = Number(response?.pageNumber) || 1;
  store.pageSize = Number(response?.pageSize) || DEFAULT_PAGE_SIZE;
  store.totalPages = Math.max(1, Number(response?.totalPages) || 1);
  store.hasNextPage = Boolean(response?.hasNextPage) || store.pageNumber < store.totalPages;
  if (Number.isFinite(Number(unreadTotal))) {
    store.unreadCount = Number(unreadTotal);
  } else if (!append) {
    store.unreadCount = store.notifications.filter((item) => item?.isRead === false).length;
  }
  store.initialized = true;
  store.lastFetchedAt = Date.now();
};


const normalizeRealtimeNotification = (payload) => {
  const candidates = [payload, payload?.notification, payload?.data, payload?.payload];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const notificationId = Number(candidate.notificationId ?? candidate.NotificationId);
    if (!Number.isInteger(notificationId) || notificationId <= 0) continue;
    return {
      ...candidate,
      notificationId,
      title: candidate.title ?? candidate.Title ?? null,
      message: candidate.message ?? candidate.Message ?? null,
      type: candidate.type ?? candidate.Type ?? null,
      isRead: Boolean(candidate.isRead ?? candidate.IsRead ?? false),
      targetUrl: candidate.targetUrl ?? candidate.TargetUrl ?? null,
      incidentId: candidate.incidentId ?? candidate.IncidentId ?? null,
      feedbackId: candidate.feedbackId ?? candidate.FeedbackId ?? null,
      targetType: candidate.targetType ?? candidate.TargetType ?? null,
      targetId: candidate.targetId ?? candidate.TargetId ?? null,
      createdAt: candidate.createdAt ?? candidate.CreatedAt ?? new Date().toISOString(),
    };
  }
  return null;
};

const upsertRealtimeNotification = (store, notification) => {
  if (!notification?.notificationId) return false;

  const existingIndex = store.notifications.findIndex(
    (item) => Number(item?.notificationId) === Number(notification.notificationId),
  );
  const existing = existingIndex >= 0 ? store.notifications[existingIndex] : null;
  const merged = existing ? { ...existing, ...notification } : notification;

  if (existingIndex >= 0) {
    store.notifications = store.notifications.map((item, index) => (
      index === existingIndex ? merged : item
    ));
  } else {
    store.notifications = [merged, ...store.notifications];
    store.totalCount += 1;
  }

  const wasUnread = existing?.isRead === false;
  const isUnread = merged?.isRead === false;
  if (!existing && isUnread) store.unreadCount += 1;
  else if (existing && !wasUnread && isUnread) store.unreadCount += 1;
  else if (existing && wasUnread && !isUnread) store.unreadCount = Math.max(0, store.unreadCount - 1);

  store.notifications = [...store.notifications].sort(
    (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0),
  );
  store.initialized = true;
  store.lastFetchedAt = Date.now();
  store.error = '';
  emit(store);
  return true;
};

const scheduleRealtimeRefresh = (userId) => {
  if (!userId) return;
  const currentTimer = realtimeRefreshTimers.get(userId);
  if (currentTimer) window.clearTimeout(currentTimer);
  const timer = window.setTimeout(() => {
    realtimeRefreshTimers.delete(userId);
    fetchNotifications(userId, {}, { force: true }).catch(() => {});
  }, 450);
  realtimeRefreshTimers.set(userId, timer);
};

const fetchNotifications = async (
  userId,
  options = {},
  { force = false, append = false } = {},
) => {
  const store = getStore(userId);
  if (!userId) {
    Object.assign(store, createStore(), { initialized: true, listeners: store.listeners });
    emit(store);
    return null;
  }

  const pageNumber = options.pageNumber ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const isDefaultRequest = pageNumber === 1 && pageSize === DEFAULT_PAGE_SIZE && options.isRead === undefined;
  const isFresh = store.initialized && Date.now() - store.lastFetchedAt < CACHE_TTL;
  if (!force && isDefaultRequest && isFresh) {
    return {
      items: store.notifications,
      totalItems: store.totalCount,
      pageNumber: store.pageNumber,
      pageSize: store.pageSize,
      totalPages: store.totalPages,
      hasNextPage: store.hasNextPage,
    };
  }
  if (store.request) return store.request;

  if (append) store.loadingMore = true;
  else store.loading = !store.initialized;
  store.error = '';
  emit(store);

  store.request = Promise.all([
    notificationApi.getNotifications(pageNumber, pageSize, options.isRead),
    options.isRead === undefined && !append
      ? notificationApi.getNotifications(1, 1, false)
      : Promise.resolve(null),
  ])
    .then(([response, unreadResponse]) => {
      applyItems(store, response, {
        append,
        unreadTotal: unreadResponse ? readNotificationTotal(unreadResponse) : undefined,
      });
      return response;
    })
    .catch((error) => {
      store.error = error?.message || 'Không thể tải thông báo.';
      throw error;
    })
    .finally(() => {
      store.loading = false;
      store.loadingMore = false;
      store.request = null;
      emit(store);
    });

  return store.request;
};


const retainNotificationRealtime = (userId) => {
  if (!userId || typeof window === 'undefined') return () => {};

  let entry = realtimeSubscriptions.get(userId);
  if (!entry) {
    const accessToken = getSignalRAccessToken();
    if (!accessToken) return () => {};

    const connection = createOptionalSignalRConnection({
      signalR,
      hubUrl: buildHubUrl('/hubs/notifications'),
      accessTokenFactory: () => getSignalRAccessToken(),
    });

    const handleNotification = (payload) => {
      const store = getStore(userId);
      const notification = normalizeRealtimeNotification(payload);
      if (notification) upsertRealtimeNotification(store, notification);
      // Reconcile with BE shortly after the event. This keeps paging totals and
      // unread counts authoritative without making the bell wait for another GET.
      scheduleRealtimeRefresh(userId);
    };

    connection.on('NotificationReceived', handleNotification);
    connection.onreconnected(() => {
      fetchNotifications(userId, {}, { force: true }).catch(() => {});
    });

    connection.start().catch((error) => {
      console.warn('Không thể kết nối notification SignalR.', error);
    });

    entry = { listeners: 0, connection, handleNotification };
    realtimeSubscriptions.set(userId, entry);
  }

  entry.listeners += 1;

  return () => {
    const current = realtimeSubscriptions.get(userId);
    if (!current) return;
    current.listeners -= 1;
    if (current.listeners > 0) return;

    current.connection.off('NotificationReceived', current.handleNotification);
    current.connection.stop().catch(() => {});
    realtimeSubscriptions.delete(userId);

    const timer = realtimeRefreshTimers.get(userId);
    if (timer) window.clearTimeout(timer);
    realtimeRefreshTimers.delete(userId);
  };
};

const fetchAllNotifications = async (userId, { force = false } = {}) => {
  const store = getStore(userId);
  if (!userId) return null;

  if (!force && store.initialized && store.notifications.length >= store.totalCount && store.totalCount > 0) {
    return {
      items: store.notifications,
      totalItems: store.totalCount,
      pageNumber: store.totalPages,
      pageSize: store.pageSize,
      totalPages: store.totalPages,
      hasNextPage: false,
    };
  }

  if (store.fullRequest) return store.fullRequest;

  store.loadingMore = store.initialized;
  store.loading = !store.initialized;
  store.error = '';
  emit(store);

  store.fullRequest = Promise.all([
    notificationApi.getNotifications(1, DEFAULT_PAGE_SIZE),
    notificationApi.getNotifications(1, 1, false),
  ])
    .then(async ([firstPage, unreadResponse]) => {
      const totalPages = Math.max(1, Number(firstPage?.totalPages) || 1);
      const remainingPages = buildRemainingNotificationPages(totalPages);
      const remainingResponses = await Promise.all(
        remainingPages.map((pageNumber) => notificationApi.getNotifications(pageNumber, DEFAULT_PAGE_SIZE)),
      );
      const items = [
        ...(Array.isArray(firstPage?.items) ? firstPage.items : []),
        ...remainingResponses.flatMap((response) => Array.isArray(response?.items) ? response.items : []),
      ];
      const merged = mergeNotificationPage([], items);
      const response = {
        ...firstPage,
        items: merged,
        pageNumber: totalPages,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages,
        hasNextPage: false,
      };

      applyItems(store, response, {
        append: false,
        unreadTotal: readNotificationTotal(unreadResponse),
      });
      store.hasNextPage = false;
      return response;
    })
    .catch((error) => {
      store.error = error?.message || 'Không thể tải đầy đủ thông báo.';
      throw error;
    })
    .finally(() => {
      store.loading = false;
      store.loadingMore = false;
      store.fullRequest = null;
      emit(store);
    });

  return store.fullRequest;
};

export function useNotifications(userId) {
  const store = getStore(userId);
  if (!store.snapshot) emit(store);

  const state = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.snapshot,
    () => store.snapshot
  );

  const loadNotifications = useCallback(
    (options = {}) => fetchNotifications(userId, options, { force: true }),
    [userId]
  );

  const loadAllNotifications = useCallback(
    (options = {}) => fetchAllNotifications(userId, { force: options.force ?? true }),
    [userId]
  );

  const loadMoreNotifications = useCallback(async () => {
    const currentStore = getStore(userId);
    if (!userId || currentStore.loadingMore || !currentStore.hasNextPage) return null;
    return fetchNotifications(
      userId,
      {
        pageNumber: currentStore.pageNumber + 1,
        pageSize: currentStore.pageSize || DEFAULT_PAGE_SIZE,
      },
      { force: true, append: true },
    );
  }, [userId]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!userId || !notificationId) return;

      const currentStore = getStore(userId);
      const target = currentStore.notifications.find(
        (item) => item?.notificationId === notificationId
      );

      if (target?.isRead === false) {
        currentStore.notifications = currentStore.notifications.map((item) => (
          item?.notificationId === notificationId
            ? { ...item, isRead: true }
            : item
        ));
        currentStore.unreadCount = Math.max(0, currentStore.unreadCount - 1);
        emit(currentStore);
      }

      try {
        await notificationApi.markNotificationAsRead(notificationId);
      } catch (error) {
        currentStore.error = error?.message || 'Không thể đánh dấu thông báo đã đọc.';
        await fetchNotifications(userId, {}, { force: true });
      }
    },
    [userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    const currentStore = getStore(userId);
    if (currentStore.unreadCount === 0) return;

    const previousItems = currentStore.notifications;
    const previousUnreadCount = currentStore.unreadCount;

    currentStore.notifications = currentStore.notifications.map((item) => ({
      ...item,
      isRead: true,
    }));
    currentStore.unreadCount = 0;
    emit(currentStore);

    try {
      await notificationApi.markAllNotificationsAsRead();
    } catch (error) {
      currentStore.notifications = previousItems;
      currentStore.unreadCount = previousUnreadCount;
      currentStore.error = error?.message || 'Không thể đánh dấu tất cả đã đọc.';
      emit(currentStore);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications(userId).catch(() => {});
  }, [userId]);

  useEffect(() => retainNotificationRealtime(userId), [userId]);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    totalCount: state.totalCount,
    pageNumber: state.pageNumber,
    pageSize: state.pageSize,
    totalPages: state.totalPages,
    hasNextPage: state.hasNextPage,
    loading: state.loading,
    loadingMore: state.loadingMore,
    initialized: state.initialized,
    error: state.error,
    loadNotifications,
    loadAllNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
  };
}

export default useNotifications;
