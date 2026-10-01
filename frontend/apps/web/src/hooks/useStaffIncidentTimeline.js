import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INCIDENT_MANAGEMENT_CAPABILITIES,
  incidentManagementApi,
} from '@urbanmind/shared-api';

export const STAFF_INCIDENT_TIMELINE_STATE = Object.freeze({
  API_UNAVAILABLE: 'api-unavailable',
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  ERROR: 'error',
});

export const staffIncidentTimelineQueryKey = (incidentId, pageNumber, pageSize) => [
  'management-incidents',
  'timeline',
  String(incidentId ?? '').trim(),
  Number(pageNumber) || 1,
  Number(pageSize) || INCIDENT_MANAGEMENT_CAPABILITIES.timeline.defaultPageSize,
];

const EMPTY_PAGINATION = Object.freeze({
  pageNumber: 1,
  pageSize: INCIDENT_MANAGEMENT_CAPABILITIES.timeline.defaultPageSize,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
});

export function useStaffIncidentTimeline({ incidentId, pageNumber = 1, pageSize = 20 }) {
  const capability = INCIDENT_MANAGEMENT_CAPABILITIES.timeline;
  const normalizedIncidentId = String(incidentId ?? '').trim();
  const activeRequestRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState(
    capability.available
      ? STAFF_INCIDENT_TIMELINE_STATE.LOADING
      : STAFF_INCIDENT_TIMELINE_STATE.API_UNAVAILABLE,
  );

  const retry = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    activeRequestRef.current?.abort();

    if (!capability.available) {
      setEvents([]);
      setPagination(EMPTY_PAGINATION);
      setState(STAFF_INCIDENT_TIMELINE_STATE.API_UNAVAILABLE);
      return undefined;
    }

    if (!normalizedIncidentId) {
      setEvents([]);
      setPagination(EMPTY_PAGINATION);
      setState(STAFF_INCIDENT_TIMELINE_STATE.ERROR);
      return undefined;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    setEvents([]);
    setState(STAFF_INCIDENT_TIMELINE_STATE.LOADING);

    incidentManagementApi.getIncidentTimeline(
      normalizedIncidentId,
      { pageNumber, pageSize },
      { signal: controller.signal },
    ).then((result) => {
      if (controller.signal.aborted) return;

      setEvents(result.items);
      setPagination({
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      });
      setState(
        result.items.length > 0
          ? STAFF_INCIDENT_TIMELINE_STATE.READY
          : STAFF_INCIDENT_TIMELINE_STATE.EMPTY,
      );
    }).catch((error) => {
      if (controller.signal.aborted || error?.name === 'CanceledError') return;

      setEvents([]);
      setState(STAFF_INCIDENT_TIMELINE_STATE.ERROR);
    });

    return () => controller.abort();
  }, [capability.available, normalizedIncidentId, pageNumber, pageSize, requestVersion]);

  return {
    capability,
    events,
    pagination,
    queryKey: staffIncidentTimelineQueryKey(normalizedIncidentId, pageNumber, pageSize),
    retry,
    state,
  };
}
