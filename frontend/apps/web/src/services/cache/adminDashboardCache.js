const ADMIN_DASHBOARD_CACHE_KEY = 'urbanmind-admin-dashboard-cache-v1';
const ADMIN_MAP_VIEW_KEY = 'urbanmind-admin-map-view-v1';
const CACHE_TTL_MS = 3 * 60 * 1000;

const safeParse = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const readAdminDashboardCache = () => {
  if (typeof window === 'undefined') return null;

  const cached = safeParse(window.sessionStorage.getItem(ADMIN_DASHBOARD_CACHE_KEY));
  if (!cached) return null;

  const updatedAt = Number(cached.updatedAt || 0);
  return {
    ...cached,
    updatedAt,
    isFresh: updatedAt > 0 && Date.now() - updatedAt < CACHE_TTL_MS,
  };
};

export const writeAdminDashboardCache = (patch) => {
  if (typeof window === 'undefined') return;

  try {
    const current = readAdminDashboardCache() || {};
    window.sessionStorage.setItem(
      ADMIN_DASHBOARD_CACHE_KEY,
      JSON.stringify({
        ...current,
        ...patch,
        updatedAt: Date.now(),
        isFresh: undefined,
      })
    );
  } catch {
    // sessionStorage can be unavailable in private mode.
  }
};

export const readAdminMapViewState = () => {
  if (typeof window === 'undefined') return null;
  return safeParse(window.sessionStorage.getItem(ADMIN_MAP_VIEW_KEY));
};

export const writeAdminMapViewState = (patch) => {
  if (typeof window === 'undefined') return;

  try {
    const current = readAdminMapViewState() || {};
    window.sessionStorage.setItem(
      ADMIN_MAP_VIEW_KEY,
      JSON.stringify({ ...current, ...patch })
    );
  } catch {
    // sessionStorage can be unavailable in private mode.
  }
};
