const normalizeKey = (value) => String(value || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
const ENDED = new Set(['approved', 'closed', 'cancelled', 'canceled', 'rejected', 'merged']);
const HIGH_PRIORITY = new Set(['high', 'urgent', 'critical']);

const INCIDENT_STATUS_LABELS = {
  submitted: 'Đã gửi',
  aireviewed: 'AI đã xem xét',
  new: 'Mới',
  open: 'Đang mở',
  pending: 'Đang xem xét',
  verified: 'Đã xác minh',
  assigned: 'Đã phân công',
  inprogress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  submittedforapproval: 'Chờ duyệt',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  rejected: 'Đã từ chối',
  merged: 'Đã gộp',
};


export const getAdminDashboardCacheState = (cache) => {
  const incidents = Array.isArray(cache?.incidents) ? cache.incidents : [];
  const recentIncidents = Array.isArray(cache?.recentIncidents) ? cache.recentIncidents : [];
  const dashboardOverview = cache?.dashboardOverview || null;
  const statusDistribution = Array.isArray(cache?.statusDistribution) ? cache.statusDistribution : [];
  const priorityDistribution = Array.isArray(cache?.priorityDistribution) ? cache.priorityDistribution : [];
  const categoryDistribution = Array.isArray(cache?.categoryDistribution) ? cache.categoryDistribution : [];
  const areaDistribution = Array.isArray(cache?.areaDistribution) ? cache.areaDistribution : [];
  const hasData = Boolean(dashboardOverview) || incidents.length > 0 || areaDistribution.length > 0;

  return {
    incidents,
    recentIncidents,
    totalItems: Number.isFinite(Number(cache?.totalItems))
      ? Number(cache.totalItems)
      : incidents.length,
    dashboardOverview,
    statusDistribution,
    priorityDistribution,
    categoryDistribution,
    areaDistribution,
    slaOverview: cache?.slaOverview || null,
    hasData,
    shouldRevalidate: hasData && cache?.isFresh !== true,
  };
};

export const getAdminIncidentStatusLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Chưa xác định';
  return INCIDENT_STATUS_LABELS[normalizeKey(raw)] || raw;
};

const isValidCoordinatePair = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || String(latitude).trim() === '') return false;
  if (longitude === null || longitude === undefined || String(longitude).trim() === '') return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
};

const countBy = (items, keyBuilder, labelBuilder, enrich = null) => {
  const map = new Map();
  items.forEach((item) => {
    const key = String(keyBuilder(item) ?? '').trim();
    if (!key) return;
    const current = map.get(key) || { key, name: labelBuilder(item) || 'Chưa xác định', count: 0 };
    current.count += 1;
    if (enrich) enrich(current, item);
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
};


export const filterAdminDashboardMapIncidents = (items = [], areaKey = 'all') => {
  const source = Array.isArray(items) ? items : [];
  const normalizedAreaKey = String(areaKey ?? '').trim();
  if (!normalizedAreaKey || normalizedAreaKey === 'all') return source;

  return source.filter((item) => {
    const itemAreaKey = item?.areaId ?? item?.area?.areaId ?? item?.area?.id ?? item?.areaName ?? item?.wardName;
    return String(itemAreaKey ?? '').trim() === normalizedAreaKey;
  });
};

export const buildAdminDashboardMapUrl = (areaKey = 'all') => {
  const normalizedAreaKey = String(areaKey ?? '').trim();
  if (!normalizedAreaKey || normalizedAreaKey === 'all') return '/management/map';
  const params = new URLSearchParams({ areaId: normalizedAreaKey });
  return `/management/map?${params.toString()}`;
};

export const sortRecentIncidents = (items = [], limit = 5) => [...items]
  .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime())
  .slice(0, Math.max(0, limit));

export const buildAdminIncidentSummary = (items = [], totalItems = items.length) => {
  const incidents = Array.isArray(items) ? items : [];
  const areas = countBy(
    incidents,
    (item) => item?.areaId ?? item?.area?.areaId ?? item?.areaName,
    (item) => item?.areaName || item?.area?.areaName || item?.area?.name,
    (current, item) => {
      current.open = (current.open || 0) + (!ENDED.has(normalizeKey(item?.status)) ? 1 : 0);
      current.highPriority = (current.highPriority || 0) + (HIGH_PRIORITY.has(normalizeKey(item?.priority)) ? 1 : 0);
    },
  );
  const categories = countBy(
    incidents,
    (item) => item?.categoryId ?? item?.category?.categoryId ?? item?.categoryName,
    (item) => item?.categoryName || item?.category?.categoryName || item?.category?.name,
  );
  const statuses = countBy(incidents, (item) => item?.status, (item) => item?.status || 'Chưa xác định');

  return {
    total: Number.isFinite(Number(totalItems)) ? Number(totalItems) : incidents.length,
    open: incidents.filter((item) => !ENDED.has(normalizeKey(item?.status))).length,
    highPriority: incidents.filter((item) => HIGH_PRIORITY.has(normalizeKey(item?.priority))).length,
    missingCoordinates: incidents.filter((item) => !isValidCoordinatePair(
      item?.latitude ?? item?.lat ?? item?.location?.latitude,
      item?.longitude ?? item?.lng ?? item?.lon ?? item?.location?.longitude,
    )).length,
    areas,
    categories,
    statuses,
    topArea: areas[0] || null,
    topCategory: categories[0] || null,
  };
};

export const buildAdminIncidentSummaryFromDashboard = ({
  overview = null,
  statusDistribution = [],
  priorityDistribution = [],
  categoryDistribution = [],
  areaDistribution = [],
} = {}) => {
  const statuses = (Array.isArray(statusDistribution) ? statusDistribution : [])
    .map((item) => ({
      key: String(item?.status ?? 'unknown'),
      name: item?.status || 'Chưa xác định',
      count: Number(item?.count) || 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

  const priorities = Array.isArray(priorityDistribution) ? priorityDistribution : [];
  const highPriority = priorities.reduce((sum, item) => (
    HIGH_PRIORITY.has(normalizeKey(item?.priority)) ? sum + (Number(item?.count) || 0) : sum
  ), 0);

  const categories = (Array.isArray(categoryDistribution) ? categoryDistribution : [])
    .map((item) => ({
      key: String(item?.categoryId ?? item?.categoryName ?? 'unknown'),
      name: item?.categoryName || 'Chưa xác định',
      count: Number(item?.count) || 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

  const areas = (Array.isArray(areaDistribution) ? areaDistribution : [])
    .map((item) => ({
      key: String(item?.areaId ?? item?.areaName ?? 'unknown'),
      name: item?.areaName || 'Chưa xác định',
      count: Number(item?.count) || 0,
      open: Number(item?.openCount) || 0,
      completed: Number(item?.completedCount) || 0,
      mappedCount: Number(item?.mappedCount) || 0,
      centerLatitude: item?.centerLatitude ?? null,
      centerLongitude: item?.centerLongitude ?? null,
      points: Array.isArray(item?.points) ? item.points : [],
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

  const total = Number(overview?.totalIncident) || areas.reduce((sum, item) => sum + item.count, 0);
  const open = statuses.reduce((sum, item) => (
    ENDED.has(normalizeKey(item?.key)) ? sum : sum + item.count
  ), 0);
  const mappedCount = areas.reduce((sum, item) => sum + item.mappedCount, 0);

  return {
    total,
    open,
    highPriority,
    missingCoordinates: Math.max(0, total - mappedCount),
    areas,
    categories,
    statuses,
    topArea: areas[0] || null,
    topCategory: categories[0] || null,
  };
};
