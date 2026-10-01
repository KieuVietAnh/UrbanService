export const COMMUNITY_FEED_CACHE_TTL_MS = 5 * 60 * 1000;

const snapshotsByOwner = new Map();

const normalizeOwnerKey = (ownerKey) => (
  String(ownerKey || 'anonymous')
);

const getCommunityId = (item) => (
  item?.incidentId || item?.id || item?.feedbackId || item?.ticketId
);

export const readCommunityFeedCache = (
  ownerKey,
  { allowStale = false } = {}
) => {
  const snapshot = snapshotsByOwner.get(normalizeOwnerKey(ownerKey));

  if (!snapshot || !Array.isArray(snapshot.items)) {
    return null;
  }

  if (
    !allowStale &&
    Date.now() - Number(snapshot.updatedAt || 0) > COMMUNITY_FEED_CACHE_TTL_MS
  ) {
    return null;
  }

  return snapshot;
};

export const writeCommunityFeedCache = (ownerKey, snapshotOrItems) => {
  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const currentSnapshot = snapshotsByOwner.get(normalizedOwnerKey) || {};
  const incomingSnapshot = Array.isArray(snapshotOrItems)
    ? { items: snapshotOrItems }
    : (snapshotOrItems || {});

  const nextSnapshot = {
    ...currentSnapshot,
    ...incomingSnapshot,
    items: Array.isArray(incomingSnapshot.items)
      ? incomingSnapshot.items
      : Array.isArray(currentSnapshot.items)
        ? currentSnapshot.items
        : [],
    updatedAt: Date.now(),
  };

  snapshotsByOwner.set(normalizedOwnerKey, nextSnapshot);
  return nextSnapshot;
};

export const patchCommunityFeedCacheItem = (
  ownerKey,
  communityId,
  patchOrUpdater
) => {
  if (!communityId) return null;

  const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
  const currentSnapshot = snapshotsByOwner.get(normalizedOwnerKey);

  if (!currentSnapshot || !Array.isArray(currentSnapshot.items)) {
    return null;
  }

  let changed = false;
  const nextItems = currentSnapshot.items.map((item) => {
    if (String(getCommunityId(item)) !== String(communityId)) {
      return item;
    }

    const patch = typeof patchOrUpdater === 'function'
      ? patchOrUpdater(item)
      : patchOrUpdater;

    if (!patch || typeof patch !== 'object') {
      return item;
    }

    changed = true;
    return {
      ...item,
      ...patch,
    };
  });

  if (!changed) return currentSnapshot;

  const nextSnapshot = {
    ...currentSnapshot,
    items: nextItems,
    updatedAt: Date.now(),
  };

  snapshotsByOwner.set(normalizedOwnerKey, nextSnapshot);
  return nextSnapshot;
};

export const clearCommunityFeedCache = (ownerKey) => {
  if (ownerKey !== undefined && ownerKey !== null) {
    snapshotsByOwner.delete(normalizeOwnerKey(ownerKey));
    return;
  }

  snapshotsByOwner.clear();
};
