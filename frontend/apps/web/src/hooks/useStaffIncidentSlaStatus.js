import { useCallback, useEffect, useRef, useState } from 'react';
import { slaApi } from '@urbanmind/shared-api';

import { validateStaffIncidentSlaStatus } from '../pages/staff/staffIncidentSla';

export const STAFF_INCIDENT_SLA_STATE = Object.freeze({
  ERROR: 'error',
  LOADING: 'loading',
  NOT_FOUND: 'not-found',
  READY: 'ready',
});

const isCanceledRequest = (error) => (
  error?.code === 'ERR_CANCELED'
  || error?.name === 'AbortError'
  || error?.name === 'CanceledError'
);

const isNotFoundError = (error) => Number(error?.response?.status ?? error?.status) === 404;

export function useStaffIncidentSlaStatus(incidentId) {
  const normalizedIncidentId = String(incidentId ?? '').trim();
  const activeRequestRef = useRef(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [snapshot, setSnapshot] = useState({
    error: null,
    sla: null,
    state: STAFF_INCIDENT_SLA_STATE.LOADING,
  });

  const retry = useCallback(() => setRequestVersion((current) => current + 1), []);

  useEffect(() => {
    activeRequestRef.current?.abort();

    if (!normalizedIncidentId) {
      setSnapshot({ error: null, sla: null, state: STAFF_INCIDENT_SLA_STATE.NOT_FOUND });
      return undefined;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    setSnapshot({ error: null, sla: null, state: STAFF_INCIDENT_SLA_STATE.LOADING });

    slaApi.getIncidentSlaStatus(normalizedIncidentId, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const sla = validateStaffIncidentSlaStatus(result, normalizedIncidentId);
        setSnapshot({
          error: null,
          sla,
          state: sla ? STAFF_INCIDENT_SLA_STATE.READY : STAFF_INCIDENT_SLA_STATE.NOT_FOUND,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || isCanceledRequest(error)) return;
        setSnapshot({
          error: isNotFoundError(error) ? null : error,
          sla: null,
          state: isNotFoundError(error)
            ? STAFF_INCIDENT_SLA_STATE.NOT_FOUND
            : STAFF_INCIDENT_SLA_STATE.ERROR,
        });
      })
      .finally(() => {
        if (activeRequestRef.current === controller) activeRequestRef.current = null;
      });

    return () => controller.abort();
  }, [normalizedIncidentId, requestVersion]);

  return { retry, ...snapshot };
}
