export const readNotificationTotal = (response) => {
  if (typeof response?.totalItems === 'number' && Number.isFinite(response.totalItems)) {
    return response.totalItems;
  }
  return Array.isArray(response?.items) ? response.items.length : 0;
};

export const mergeNotificationPage = (currentItems = [], nextItems = []) => {
  const byKey = new Map();
  [...currentItems, ...nextItems].forEach((item, index) => {
    const key = item?.notificationId ?? `${item?.title || 'notification'}-${item?.createdAt || index}`;
    byKey.set(String(key), item);
  });
  return [...byKey.values()];
};

export const buildRemainingNotificationPages = (totalPages) => {
  const count = Math.max(1, Number(totalPages) || 1);
  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 2);
};
