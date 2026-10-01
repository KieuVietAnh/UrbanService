import type { CommunityIncidentParams } from '../types/community.types';

export const communityKeys = {
  all: ['community'] as const,
  feeds: () => [...communityKeys.all, 'feeds'] as const,
  feed: (params: CommunityIncidentParams = {}) => [...communityKeys.feeds(), params] as const,
  mapFeed: (params: Pick<CommunityIncidentParams, 'areaId' | 'categoryId' | 'status'> = {}) =>
    [...communityKeys.feeds(), 'map', 'infinite', params] as const,
  webMapFeed: () => [...communityKeys.feeds(), 'map', 'web'] as const,
  legacyFeed: () => [...communityKeys.feeds(), 'legacy'] as const,
  detail: (incidentId: string) => [...communityKeys.all, 'detail', incidentId] as const,
  resolution: (incidentId: string) => [...communityKeys.detail(incidentId), 'resolution'] as const,
  timeline: (incidentId: string) => [...communityKeys.detail(incidentId), 'timeline'] as const,
  comments: (incidentId: string) => [...communityKeys.detail(incidentId), 'comments'] as const,
  areas: () => [...communityKeys.all, 'areas'] as const,
  categories: () => [...communityKeys.all, 'categories'] as const,
};
