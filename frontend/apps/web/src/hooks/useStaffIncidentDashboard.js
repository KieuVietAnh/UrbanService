import { useCallback, useEffect, useRef, useState } from 'react';
import { incidentManagementApi, slaApi } from '@urbanmind/shared-api';

import {
  fetchAllAssignedStaffIncidents,
  fetchAssignedIncidentSlaStatuses,
} from '../pages/staff/staffIncidentDashboard';

export const STAFF_INCIDENT_DASHBOARD_STATE = Object.freeze({
  API_UNAVAILABLE: 'api-unavailable',
  SCOPE_UNAVAILABLE: 'scope-unavailable',
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  ERROR: 'error',
});

export const staffIncidentDashboardQueryKey = (assignedStaffUserId) => [
  'management',
  'incidents',
  'staff-dashboard',
  String(assignedStaffUserId ?? '').trim(),
];

const isCanceledRequest = (error) => (
  error?.code === 'ERR_CANCELED'
  || error?.name === 'AbortError'
  || error?.name === 'CanceledError'
);

export function useStaffIncidentDashboard(assignedStaffUserId) {
  const normalizedStaffUserId = String(assignedStaffUserId ?? '').trim();
  const capability = incidentManagementApi.capabilities.list;
  const activeRequestRef = useRef(null);
  const [snapshot, setSnapshot] = useState(() => ({
    error: null,
    incidents: [],
    slaByIncidentId: {},
    slaFailedCount: 0,
    slaRequestedCount: 0,
    totalItems: 0,
    state: capability.available
      ? STAFF_INCIDENT_DASHBOARD_STATE.LOADING
      : STAFF_INCIDENT_DASHBOARD_STATE.API_UNAVAILABLE,
  }));

  const loadDashboard = useCallback(async () => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;

    if (!capability.available || typeof incidentManagementApi.getIncidents !== 'function') {
      setSnapshot({
        error: null,
        incidents: [],
        slaByIncidentId: {},
        slaFailedCount: 0,
        slaRequestedCount: 0,
        totalItems: 0,
        state: STAFF_INCIDENT_DASHBOARD_STATE.API_UNAVAILABLE,
      });
      return;
    }

    if (!capability.assignedToCurrentStaff || !normalizedStaffUserId) {
      setSnapshot({
        error: null,
        incidents: [],
        slaByIncidentId: {},
        slaFailedCount: 0,
        slaRequestedCount: 0,
        totalItems: 0,
        state: STAFF_INCIDENT_DASHBOARD_STATE.SCOPE_UNAVAILABLE,
      });
      return;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    setSnapshot((current) => ({
      ...current,
      error: null,
      state: STAFF_INCIDENT_DASHBOARD_STATE.LOADING,
    }));

    try {
      const result = await fetchAllAssignedStaffIncidents({
        getIncidents: incidentManagementApi.getIncidents,
        assignedStaffUserId: normalizedStaffUserId,
        signal: controller.signal,
      });

      const slaResult = await fetchAssignedIncidentSlaStatuses({
        incidents: result.incidents,
        getIncidentSlaStatus: slaApi.getIncidentSlaStatus,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      setSnapshot({
        error: null,
        incidents: result.incidents,
        slaByIncidentId: slaResult.slaByIncidentId,
        slaFailedCount: slaResult.failedCount,
        slaRequestedCount: slaResult.requestedCount,
        totalItems: result.totalItems,
        state: result.incidents.length > 0
          ? STAFF_INCIDENT_DASHBOARD_STATE.READY
          : STAFF_INCIDENT_DASHBOARD_STATE.EMPTY,
      });
    } catch (error) {
      if (controller.signal.aborted || isCanceledRequest(error)) return;
      setSnapshot({
        error,
        incidents: [],
        slaByIncidentId: {},
        slaFailedCount: 0,
        slaRequestedCount: 0,
        totalItems: 0,
        state: STAFF_INCIDENT_DASHBOARD_STATE.ERROR,
      });
    } finally {
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
    }
  }, [capability.assignedToCurrentStaff, capability.available, normalizedStaffUserId]);

  useEffect(() => {
    void loadDashboard();
    return () => activeRequestRef.current?.abort();
  }, [loadDashboard]);

  return {
    capability,
    queryKey: staffIncidentDashboardQueryKey(normalizedStaffUserId),
    retry: loadDashboard,
    ...snapshot,
  };
}
