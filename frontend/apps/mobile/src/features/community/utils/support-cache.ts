import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { communityKeys } from '../api';

type SupportableIncident = {
  incidentId?: string | number;
  id?: string | number;
  isSupportedByCurrentUser?: boolean;
  supportCount?: number;
};

export type CommunityCacheSnapshot = Array<[QueryKey, unknown]>;

const updateIncident = <T extends SupportableIncident>(
  item: T,
  incidentId: string,
  supported: boolean,
): T => {
  const itemId = String(item.incidentId ?? item.id ?? '');
  if (itemId !== incidentId) return item;

  const wasSupported = Boolean(item.isSupportedByCurrentUser);
  const delta = wasSupported === supported ? 0 : supported ? 1 : -1;
  return {
    ...item,
    isSupportedByCurrentUser: supported,
    supportCount: Math.max(0, Number(item.supportCount ?? 0) + delta),
  };
};

export const updateCommunitySupportCache = (
  data: unknown,
  incidentId: string,
  supported: boolean,
): unknown => {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray((data as { pages?: unknown[] }).pages)) {
    const infiniteData = data as { pages: unknown[] };
    return {
      ...infiniteData,
      pages: infiniteData.pages.map((page) => updateCommunitySupportCache(page, incidentId, supported)),
    };
  }

  if (Array.isArray((data as { items?: SupportableIncident[] }).items)) {
    const page = data as { items: SupportableIncident[] };
    return {
      ...page,
      items: page.items.map((item) => updateIncident(item, incidentId, supported)),
    };
  }

  if ('incidentId' in data) {
    return updateIncident(data as SupportableIncident, incidentId, supported);
  }

  return data;
};

export const applyOptimisticCommunitySupport = (
  queryClient: QueryClient,
  incidentId: string,
  supported: boolean,
): CommunityCacheSnapshot => {
  const snapshot = queryClient.getQueriesData({ queryKey: communityKeys.all });
  queryClient.setQueriesData(
    { queryKey: communityKeys.all },
    (data) => updateCommunitySupportCache(data, incidentId, supported),
  );
  return snapshot;
};

export const restoreCommunityCache = (
  queryClient: QueryClient,
  snapshot: CommunityCacheSnapshot | undefined,
) => {
  snapshot?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
};
