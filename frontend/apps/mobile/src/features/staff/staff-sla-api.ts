import { slaApi } from '@urbanmind/shared-api';
import {
  isSlaNotFoundError,
  normalizeIncidentSlaStatus,
  type StaffIncidentSlaStatus,
} from './staff-sla-models';

export const staffSlaKeys = {
  all: (userId: string) => ['staff', userId, 'sla'] as const,
  incident: (userId: string, incidentId: string) =>
    ['staff', userId, 'sla', 'incident', incidentId] as const,
};

export const staffSlaApi = {
  async incidentStatus(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<StaffIncidentSlaStatus | null> {
    const id = incidentId.trim();
    if (!id) throw new Error('Thiếu mã sự vụ để tải SLA.');

    try {
      const response = await slaApi.getIncidentSlaStatus(
        encodeURIComponent(id),
        { signal },
      );
      return normalizeIncidentSlaStatus(response, id);
    } catch (error) {
      // An Incident can legitimately have no SLA yet. Other failures stay
      // visible so authentication, authorization and network errors are not hidden.
      if (isSlaNotFoundError(error)) return null;
      throw error;
    }
  },
};
