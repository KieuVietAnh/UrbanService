import { useQuery } from '@tanstack/react-query';
import { feedbackApi, reportingKeys, type FeedbackFilters } from '@/features/reporting/api';
import { communityApi, communityKeys } from '@/features/community/api';
import type { TicketLike } from '../types';

export function useHomeData() {
  const filters: FeedbackFilters = { pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' };
  const ownedQuery = useQuery({
    queryKey: reportingKeys.list(filters),
    queryFn: () => feedbackApi.list(filters),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const communityParams = { pageNumber: 1, pageSize: 8 };
  const communityQuery = useQuery({
    queryKey: communityKeys.feed(communityParams),
    queryFn: () => communityApi.getFeed(communityParams),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  const tickets = (Array.isArray(ownedQuery.data) ? ownedQuery.data : (ownedQuery.data?.items ?? [])) as TicketLike[];
  const communityItems = (communityQuery.data?.items ?? []) as TicketLike[];

  return {
    tickets,
    nearby: communityItems.slice(0, 5),
    isLoading: ownedQuery.isLoading,
    nearbyLoading: communityQuery.isLoading,
    refetch: async () => {
      await Promise.all([ownedQuery.refetch(), communityQuery.refetch()]);
    },
    isRefetching: ownedQuery.isRefetching || communityQuery.isRefetching,
  };
}
