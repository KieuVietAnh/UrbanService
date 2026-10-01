import { axiosClient, extractApiErrorMessage, incidentManagementApi, managementFeedbackApi, normalizeFeedbackListParams } from '@urbanmind/shared-api';
import { asRecord, asText, itemsFrom, normalizeEvent, normalizeMessage, normalizePage, normalizeStaffRecord, unwrap } from './staff-models';

export type StaffListParams = { pageNumber: number; search?: string; status?: string; priority?: string; severity?: string; areaId?: string | number; categoryId?: string | number };

export const staffKeys = {
  all: ['staff'] as const,
  lookups: (userId: string) => ['staff', userId, 'lookups'] as const,
  feedbacks: (userId: string, params: object) => ['staff', userId, 'feedbacks', params] as const,
  feedback: (userId: string, id: string) => ['staff', userId, 'feedback', id] as const,
  incidents: (userId: string, params: object) => ['staff', userId, 'incidents', params] as const,
  incident: (userId: string, id: string) => ['staff', userId, 'incident', id] as const,
  timeline: (userId: string, id: string, page: number) => ['staff', userId, 'timeline', id, page] as const,
  messages: (userId: string, id: string) => ['staff', userId, 'messages', id] as const,
};

export function staffError(error: unknown) {
  const record = asRecord(error);
  const status = Number(asRecord(record.response).status ?? record.status);
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này hoặc hồ sơ không còn được phân công cho bạn.';
  if (status === 404) return 'Không tìm thấy hồ sơ. Hồ sơ có thể đã được chuyển hoặc không còn khả dụng.';
  if (status === 409) return 'Hồ sơ vừa được cập nhật. Hãy làm mới để xem trạng thái mới nhất.';
  return extractApiErrorMessage(error, 'Không thể kết nối máy chủ. Vui lòng thử lại.');
}

export const staffApi = {
  async lookups(signal?: AbortSignal) {
    const [areas, categories] = await Promise.all([
      axiosClient.get('/api/areas', { params: { includeInactive: false }, signal }),
      axiosClient.get('/api/categories', { params: { includeInactive: false }, signal }),
    ]);
    const options = (response: unknown, key: string) => {
      const payload = unwrap(response);
      if (!Array.isArray(payload) && !Array.isArray(asRecord(payload).items)) throw new Error('Không tải được danh mục bộ lọc. Vui lòng thử lại.');
      return itemsFrom(response).map((value) => {
        const item = asRecord(value);
        return { id: asText(item[key] ?? item.id), name: asText(item.name ?? item[`${key.replace(/Id$/, '')}Name`]) };
      }).filter((item) => item.id && item.name);
    };
    return { areas: options(areas, 'areaId'), categories: options(categories, 'categoryId') };
  },
  async feedbacks(params: { pageNumber: number; search?: string; status?: string }, signal?: AbortSignal) {
    const response = await axiosClient.get('/api/management/feedbacks', {
      params: normalizeFeedbackListParams({ pageNumber: params.pageNumber, search: params.search, status: params.status, pageSize: 20 }), signal,
    });
    return normalizePage(response, (item) => normalizeStaffRecord(item), params.pageNumber);
  },
  async feedback(id: string, signal?: AbortSignal) {
    if (!id.trim()) throw new Error('Thiếu mã phản ánh.');
    const response = await axiosClient.get(`/api/management/feedbacks/${encodeURIComponent(id)}`, { signal });
    const item = normalizeStaffRecord(unwrap(response));
    if (!item.id) throw new Error('Không tìm thấy phản ánh.');
    return item;
  },
  async incidents(userId: string, params: StaffListParams, signal?: AbortSignal) {
    if (!userId.trim()) throw new Error('Không xác định được nhân viên phụ trách. Vui lòng đăng nhập lại.');
    const response = await incidentManagementApi.getIncidents({ pageNumber: params.pageNumber, search: params.search, status: params.status, priority: params.priority, severity: params.severity, areaId: params.areaId, categoryId: params.categoryId, pageSize: 20, assignedStaffUserId: userId, includeMerged: false }, { signal });
    return normalizePage(response, (item) => normalizeStaffRecord(item, true), params.pageNumber);
  },
  async incident(id: string, signal?: AbortSignal) {
    const response = await incidentManagementApi.getIncidentById(id, { signal });
    const item = normalizeStaffRecord(response, true);
    if (!item.id) throw new Error('Không tìm thấy sự vụ.');
    return item;
  },
  async timeline(id: string, pageNumber: number, signal?: AbortSignal) {
    const response = await incidentManagementApi.getIncidentTimeline(id, { pageNumber, pageSize: 20 }, { signal });
    return normalizePage(response, normalizeEvent, pageNumber);
  },
  async messages(id: string, signal?: AbortSignal) {
    if (!id.trim()) throw new Error('Thiếu mã phản ánh.');
    const response = await axiosClient.get(`/api/feedbacks/${encodeURIComponent(id)}/messages`, { params: { includeInternal: true }, signal });
    return itemsFrom(response).map(normalizeMessage).sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  },
  async sendMessage(id: string, text: string, internal: boolean) {
    const messageText = text.trim();
    if (!id.trim() || !messageText) throw new Error('Vui lòng nhập nội dung tin nhắn.');
    return managementFeedbackApi.createFeedbackMessage(encodeURIComponent(id), { messageText, isInternal: internal });
  },
};
