import { useQuery } from '@tanstack/react-query';
import { staffSlaApi, staffSlaKeys } from './staff-sla-api';

export function useStaffIncidentSlaQuery({
  userId,
  incidentId,
}: {
  userId: string;
  incidentId: string;
}) {
  const enabled = Boolean(userId.trim() && incidentId.trim());

  return useQuery({
    queryKey: staffSlaKeys.incident(userId, incidentId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      staffSlaApi.incidentStatus(incidentId, signal),
    enabled,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: (failureCount: number, error: unknown) => {
      const status = Number(
        (error as { response?: { status?: number }; status?: number })?.response?.status
        ?? (error as { status?: number })?.status,
      );
      return ![400, 401, 403, 404].includes(status) && failureCount < 2;
    },
  });
}
