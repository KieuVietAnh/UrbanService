import { useCallback, useEffect, useRef, useState } from 'react';
import { incidentManagementApi } from '@urbanmind/shared-api';
import { hasStaffIncidentScopeMismatch } from './staffIncidentScope.js';

export const STAFF_INCIDENT_LIST_STATE = Object.freeze({
  API_UNAVAILABLE: 'api-unavailable',
  LOADING: 'loading',
  ERROR: 'error',
  EMPTY: 'empty',
  NO_RESULTS: 'no-results',
  READY: 'ready',
});

export const staffIncidentQueryKeys = Object.freeze({
  all: Object.freeze(['management', 'incidents']),
  list: (params = {}) => ['management', 'incidents', 'list', params],
});

/**
 * Staff Incident list state.
 *
 * No network request is made while the shared API capability is unavailable.
 * This keeps Incident as an independent domain and avoids deriving it from the
 * Feedback API. Loading, error and result handling can be connected here once a
 * documented endpoint and response contract are added to @urbanmind/shared-api.
 */
export function useStaffIncidentList(params, { enabled = true } = {}) {
  const capability = incidentManagementApi.capabilities.list;
  const activeRequestRef = useRef(null);
  const [snapshot, setSnapshot] = useState(() => ({
    error: null,
    incidents: [],
    pagination: null,
    state: capability.available
      ? STAFF_INCIDENT_LIST_STATE.LOADING
      : STAFF_INCIDENT_LIST_STATE.API_UNAVAILABLE,
  }));

  const loadIncidents = useCallback(async () => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;

    if (!capability.available || typeof incidentManagementApi.getIncidents !== 'function') {
      setSnapshot({
        error: null,
        incidents: [],
        pagination: null,
        state: STAFF_INCIDENT_LIST_STATE.API_UNAVAILABLE,
      });
      return;
    }

    if (!enabled) {
      setSnapshot({
        error: new Error('STAFF_SCOPE_UNAVAILABLE'),
        incidents: [],
        pagination: null,
        state: STAFF_INCIDENT_LIST_STATE.ERROR,
      });
      return;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;

    setSnapshot((current) => ({
      ...current,
      error: null,
      state: STAFF_INCIDENT_LIST_STATE.LOADING,
    }));

    try {
      const response = await incidentManagementApi.getIncidents(params, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const incidents = Array.isArray(response?.items) ? response.items : [];
      if (hasStaffIncidentScopeMismatch(incidents, params?.assignedStaffUserId)) {
        setSnapshot({
          error: new Error('STAFF_SCOPE_MISMATCH'),
          incidents: [],
          pagination: null,
          state: STAFF_INCIDENT_LIST_STATE.ERROR,
        });
        return;
      }

      setSnapshot({
        error: null,
        incidents,
        pagination: response,
        state: incidents.length > 0
          ? STAFF_INCIDENT_LIST_STATE.READY
          : STAFF_INCIDENT_LIST_STATE.EMPTY,
      });
    } catch (error) {
      if (controller.signal.aborted || error?.code === 'ERR_CANCELED') return;

      setSnapshot({
        error,
        incidents: [],
        pagination: null,
        state: STAFF_INCIDENT_LIST_STATE.ERROR,
      });
    }
  }, [capability.available, enabled, params]);

  useEffect(() => {
    void loadIncidents();

    return () => {
      activeRequestRef.current?.abort();
    };
  }, [loadIncidents]);

  return {
    ...snapshot,
    retry: loadIncidents,
  };
}
