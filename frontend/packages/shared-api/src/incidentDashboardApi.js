import { axiosClient } from './axiosClient.js';

const unwrap = (response) => response?.data ?? response;

const normalizeLimit = (value, fallback = 10, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
};

const normalizeMonths = (value, fallback = 12) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(24, Math.max(1, Math.trunc(parsed)));
};

const normalizeMapPoints = (value, fallback = 500) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(5000, Math.max(1, Math.trunc(parsed)));
};

/**
 * Các khoảng thời gian backend chấp nhận cho thống kê phân bố.
 * Giá trị lạ sẽ bị backend trả về 400 nên chỉ gửi đi khi hợp lệ.
 */
export const INCIDENT_DASHBOARD_RANGES = Object.freeze({
  ALL: 'all',
  LAST_7_DAYS: '7d',
  LAST_1_MONTH: '1m',
  LAST_6_MONTHS: '6m',
  LAST_1_YEAR: '1y',
});

const VALID_RANGES = new Set(Object.values(INCIDENT_DASHBOARD_RANGES));

const normalizeRange = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return VALID_RANGES.has(normalized) ? normalized : INCIDENT_DASHBOARD_RANGES.ALL;
};

const toPositiveId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
};

export const incidentDashboardApi = {
  async getOverview() {
    return unwrap(await axiosClient.get('/api/incidents/dashboard/overview'));
  },

  async getStatusDistribution() {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/status-distribution'));
    return Array.isArray(payload) ? payload : [];
  },

  async getPriorityDistribution() {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/priority-distribution'));
    return Array.isArray(payload) ? payload : [];
  },

  async getCategoryDistribution() {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/category-distribution'));
    return Array.isArray(payload) ? payload : [];
  },

  async getAreaDistribution() {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/area-distribution'));
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Phân bố sự vụ theo danh mục, tách tiếp theo từng phường, kèm tọa độ.
   *
   * Mọi tiêu chí đều tùy chọn: bỏ trống `categoryId` và `areaId` thì lấy tất cả,
   * truyền cả hai thì lọc đồng thời. Mỗi sự vụ chỉ thuộc đúng một ô
   * (danh mục, phường) nên số đếm của các ô cộng lại bằng `totalCount`.
   */
  async getDistribution({ categoryId, areaId, range, maxPointsPerArea } = {}) {
    const params = { range: normalizeRange(range) };

    const normalizedCategoryId = toPositiveId(categoryId);
    if (normalizedCategoryId !== undefined) params.categoryId = normalizedCategoryId;

    const normalizedAreaId = toPositiveId(areaId);
    if (normalizedAreaId !== undefined) params.areaId = normalizedAreaId;

    if (maxPointsPerArea !== undefined) {
      params.maxPointsPerArea = normalizeMapPoints(maxPointsPerArea);
    }

    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/distribution', { params }));

    return {
      filter: payload?.filter ?? null,
      totalCount: Number(payload?.totalCount ?? 0),
      openCount: Number(payload?.openCount ?? 0),
      completedCount: Number(payload?.completedCount ?? 0),
      mappedCount: Number(payload?.mappedCount ?? 0),
      categories: Array.isArray(payload?.categories) ? payload.categories : [],
    };
  },

  /**
   * Tình hình tiếp nhận trong hôm nay. Ranh giới ngày do backend tính theo giờ
   * Việt Nam, nên không được suy ra từ đồng hồ của trình duyệt.
   */
  async getTodaySummary() {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/today'));

    return {
      date: payload?.date ?? null,
      timeZone: payload?.timeZone ?? 'Asia/Ho_Chi_Minh',
      startOfDayUtc: payload?.startOfDayUtc ?? null,
      endOfDayUtc: payload?.endOfDayUtc ?? null,
      reportCount: Number(payload?.reportCount ?? 0),
      incidentCount: Number(payload?.incidentCount ?? 0),
      resolvedCount: Number(payload?.resolvedCount ?? 0),
      byCategory: Array.isArray(payload?.byCategory) ? payload.byCategory : [],
      byArea: Array.isArray(payload?.byArea) ? payload.byArea : [],
    };
  },

  async getMonthlyTrend(months = 12) {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/monthly-trend', {
      params: { months: normalizeMonths(months) },
    }));
    return Array.isArray(payload) ? payload : [];
  },

  async getUrgentOpen(limit = 10) {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/urgent-open', {
      params: { limit: normalizeLimit(limit) },
    }));
    return Array.isArray(payload) ? payload : [];
  },

  async getRecent(limit = 10) {
    const payload = unwrap(await axiosClient.get('/api/incidents/dashboard/recent', {
      params: { limit: normalizeLimit(limit) },
    }));
    return Array.isArray(payload) ? payload : [];
  },
};
