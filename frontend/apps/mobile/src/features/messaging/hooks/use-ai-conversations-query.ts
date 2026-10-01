import { useQuery } from '@tanstack/react-query';
import { messagingApi, messagingKeys } from '../api';

export function useAiConversationsQuery(enabled = true) {
  return useQuery({
    queryKey: messagingKeys.aiConversations(),
    queryFn: messagingApi.getAiConversations,
    retry: false,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    enabled,
  });
}
