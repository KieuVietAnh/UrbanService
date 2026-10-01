const CACHE_KEY = 'urbanmind:admin:user-management:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

export const readAdminUserManagementCache = () => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const isFresh = Number(parsed?.savedAt) > 0
      && Date.now() - Number(parsed.savedAt) <= CACHE_TTL_MS;

    if (!isFresh || !Array.isArray(parsed?.users)) {
      storage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    storage.removeItem(CACHE_KEY);
    return null;
  }
};

export const writeAdminUserManagementCache = (users) => {
  const storage = getStorage();
  if (!storage || !Array.isArray(users)) return;

  try {
    storage.setItem(CACHE_KEY, JSON.stringify({
      users,
      savedAt: Date.now(),
    }));
  } catch {
    // sessionStorage may be unavailable or full. The page still works without cache.
  }
};

export const clearAdminUserManagementCache = () => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(CACHE_KEY);
};
