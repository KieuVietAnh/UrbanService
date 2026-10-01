import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INCIDENT_MANAGEMENT_CAPABILITIES,
  incidentManagementApi,
} from '@urbanmind/shared-api';

export const STAFF_INCIDENT_DETAIL_STATE = Object.freeze({
  API_UNAVAILABLE: 'api-unavailable',
  LOADING: 'loading',
  READY: 'ready',
  NOT_FOUND: 'not-found',
  ERROR: 'error',
});

export const staffIncidentDetailQueryKey = (incidentId) => [
  'management-incidents',
  'detail',
  String(incidentId ?? '').trim(),
];

export function useStaffIncidentDetail(incidentId) {
  const normalizedIncidentId = String(incidentId ?? '').trim();
  const capability = INCIDENT_MANAGEMENT_CAPABILITIES.detail;
  const activeRequestRef = useRef(null);
  const [state, setState] = useState(
    capability.available
      ? STAFF_INCIDENT_DETAIL_STATE.LOADING
      : STAFF_INCIDENT_DETAIL_STATE.API_UNAVAILABLE,
  );
  const [incident, setIncident] = useState(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  const updateIncident = useCallback((nextIncident) => {
    const nextIncidentId = String(nextIncident?.incidentId ?? '').trim();
    if (
      !nextIncident
      || !nextIncidentId
      || nextIncidentId.toLowerCase() !== normalizedIncidentId.toLowerCase()
    ) {
      return false;
    }

    setIncident(nextIncident);
    setState(STAFF_INCIDENT_DETAIL_STATE.READY);
    return true;
  }, [normalizedIncidentId]);

  useEffect(() => {
    activeRequestRef.current?.abort();

    if (!capability.available) {
      setIncident(null);
      setState(STAFF_INCIDENT_DETAIL_STATE.API_UNAVAILABLE);
      return undefined;
    }

    if (!normalizedIncidentId) {
      setIncident(null);
      setState(STAFF_INCIDENT_DETAIL_STATE.NOT_FOUND);
      return undefined;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    setIncident(null);
    setState(STAFF_INCIDENT_DETAIL_STATE.LOADING);

    incidentManagementApi.getIncidentById(normalizedIncidentId, {
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;

      if (!result) {
        setState(STAFF_INCIDENT_DETAIL_STATE.NOT_FOUND);
        return;
      }

      setIncident(result);
      setState(STAFF_INCIDENT_DETAIL_STATE.READY);
    }).catch((error) => {
      if (controller.signal.aborted || error?.name === 'CanceledError') return;

      setIncident(null);
      setState(
        error?.status === 404
          ? STAFF_INCIDENT_DETAIL_STATE.NOT_FOUND
          : STAFF_INCIDENT_DETAIL_STATE.ERROR,
      );
    });

    return () => controller.abort();
  }, [capability.available, normalizedIncidentId, requestVersion]);

  return {
    capability,
    incident,
    queryKey: staffIncidentDetailQueryKey(normalizedIncidentId),
    retry,
    state,
    updateIncident,
  };
}
