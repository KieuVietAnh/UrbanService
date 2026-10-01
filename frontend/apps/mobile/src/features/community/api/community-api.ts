import { axiosClient, toolsApi } from '@urbanmind/shared-api';
import type {
  CommunityIncidentParams,
  CommunityIncidentResponse,
  IncidentComment,
  PublicIncidentDetail,
  PublicIncidentEvent,
  PublicIncidentItem,
  PublicIncidentMedia,
  PublicIncidentResolution,
} from '../types/community.types';

type ApiRecord = Record<string, any>;

const asRecord = (value: unknown): ApiRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : {};

const unwrap = (response: unknown): any => {
  const record = asRecord(response);
  return record.data ?? response;
};

const resolveMediaUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const url = value.trim();
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  const baseUrl = axiosClient.defaults.baseURL || 'https://api.urbanservice.me';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const normalizeMedia = (value: unknown): PublicIncidentMedia => {
  const media = asRecord(value);
  return {
    ...media,
    incidentMediaId: media.incidentMediaId ?? media.id,
    fileUrl: resolveMediaUrl(media.fileUrl ?? media.url ?? media.path),
    thumbnailUrl: resolveMediaUrl(media.thumbnailUrl ?? media.coverImageThumbnailUrl),
    mediaType: media.mediaType ?? media.type,
  };
};

const normalizeIncident = (value: unknown): PublicIncidentItem => {
  const incident = asRecord(value);
  const incidentId = String(incident.incidentId ?? incident.id ?? '');
  const media = Array.isArray(incident.media) ? incident.media.map(normalizeMedia) : [];
  const coverImageUrl = resolveMediaUrl(
    incident.coverImageUrl ?? incident.coverImageThumbnailUrl ?? media[0]?.thumbnailUrl ?? media[0]?.fileUrl
  );

  return {
    ...incident,
    incidentId,
    id: incidentId,
    areaId: incident.areaId ?? null,
    areaName: incident.areaName ?? '',
    categoryId: incident.categoryId ?? null,
    categoryName: incident.categoryName ?? '',
    title: incident.title ?? '',
    description: incident.description ?? '',
    locationText: incident.locationText ?? '',
    latitude: incident.latitude ?? null,
    longitude: incident.longitude ?? null,
    reportCount: Number(incident.reportCount ?? 0),
    subscriberCount: Number(incident.subscriberCount ?? 0),
    commentCount: Number(incident.commentCount ?? 0),
    supportCount: Number(incident.supportCount ?? 0),
    isSubscribedByCurrentUser: Boolean(incident.isSubscribedByCurrentUser),
    isSupportedByCurrentUser: Boolean(incident.isSupportedByCurrentUser),
    coverImageUrl,
    coverImageThumbnailUrl: resolveMediaUrl(incident.coverImageThumbnailUrl),
    imageUrl: coverImageUrl,
    media,
  };
};

const normalizePage = (response: unknown): CommunityIncidentResponse => {
  const payload = unwrap(response);
  const record = asRecord(payload);
  const rawItems = Array.isArray(payload) ? payload : Array.isArray(record.items) ? record.items : [];
  const items = rawItems.map(normalizeIncident).filter((item) => Boolean(item.incidentId));
  return {
    items,
    pageNumber: Number(record.pageNumber ?? 1),
    pageSize: Number(record.pageSize ?? items.length),
    totalItems: Number(record.totalItems ?? items.length),
    totalPages: Number(record.totalPages ?? 1),
    hasPreviousPage: Boolean(record.hasPreviousPage),
    hasNextPage: Boolean(record.hasNextPage),
  };
};

const normalizeParams = (params: CommunityIncidentParams = {}) => ({
  PageNumber: params.pageNumber ?? 1,
  PageSize: params.pageSize ?? 12,
  ...(params.areaId ? { AreaId: params.areaId } : {}),
  ...(params.categoryId ? { CategoryId: params.categoryId } : {}),
  ...(params.status ? { Status: params.status } : {}),
  ...(params.search?.trim() ? { Search: params.search.trim() } : {}),
  ...(params.sort ? { Sort: params.sort } : {}),
});

export const communityApi = {
  async getAreas() {
    return toolsApi.getAreas({}, { throwOnError: true });
  },

  async getCategories() {
    return toolsApi.getCategories();
  },

  async getFeed(params: CommunityIncidentParams = {}) {
    return normalizePage(await axiosClient.get('/api/public/incidents', { params: normalizeParams(params) }));
  },

  async getFeedDetail(incidentId: string): Promise<PublicIncidentDetail> {
    if (!incidentId) throw new Error('Incident ID is required.');
    return normalizeIncident(
      unwrap(await axiosClient.get(`/api/public/incidents/${encodeURIComponent(incidentId)}`))
    ) as PublicIncidentDetail;
  },

  async getResolution(incidentId: string): Promise<PublicIncidentResolution | null> {
    try {
      const payload = unwrap(await axiosClient.get(`/api/public/incidents/${encodeURIComponent(incidentId)}/resolution`));
      const resolution = asRecord(payload);
      return Object.keys(resolution).length ? {
        ...resolution,
        completionDocuments: Array.isArray(resolution.completionDocuments)
          ? resolution.completionDocuments.map((document: unknown) => {
              const item = asRecord(document);
              return {
                ...item,
                fileUrl: resolveMediaUrl(item.fileUrl ?? item.url),
                thumbnailUrl: resolveMediaUrl(item.thumbnailUrl),
              };
            })
          : [],
      } : null;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  },

  async getTimeline(incidentId: string): Promise<PublicIncidentEvent[]> {
    const payload = unwrap(await axiosClient.get(
      `/api/public/incidents/${encodeURIComponent(incidentId)}/timeline`,
      { params: { pageNumber: 1, pageSize: 50 } }
    ));
    const items = Array.isArray(payload) ? payload : asRecord(payload).items;
    return Array.isArray(items) ? items : [];
  },

  async getComments(incidentId: string): Promise<IncidentComment[]> {
    const payload = unwrap(await axiosClient.get(
      `/api/public/incidents/${encodeURIComponent(incidentId)}/comments`,
      { params: { pageNumber: 1, pageSize: 50 } }
    ));
    const items = Array.isArray(payload) ? payload : asRecord(payload).items;
    return (Array.isArray(items) ? items : []).map((value: unknown, index: number) => {
      const item = asRecord(value);
      return {
        ...item,
        id: String(item.incidentCommentId ?? item.commentId ?? item.id ?? index),
        content: String(item.content ?? item.text ?? ''),
        createdAt: String(item.createdAt ?? ''),
      };
    });
  },

  async addComment(incidentId: string, content: string) {
    return unwrap(await axiosClient.post(`/api/user/incidents/${encodeURIComponent(incidentId)}/comments`, { content }));
  },

  support(incidentId: string) {
    return axiosClient.post(`/api/user/incidents/${encodeURIComponent(incidentId)}/support`);
  },

  unsupport(incidentId: string) {
    return axiosClient.delete(`/api/user/incidents/${encodeURIComponent(incidentId)}/support`);
  },

  subscribe(incidentId: string) {
    return axiosClient.post(`/api/user/incidents/${encodeURIComponent(incidentId)}/subscribe`);
  },

  unsubscribe(incidentId: string) {
    return axiosClient.delete(`/api/user/incidents/${encodeURIComponent(incidentId)}/subscribe`);
  },
};

export default communityApi;
