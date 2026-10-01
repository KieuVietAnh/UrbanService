import { useCallback, useEffect, useRef, useState } from 'react';
import { getCommunityFeed } from '../services/api/feedApi';
import { signalrService } from '../services/socket/signalrService';

const COMMUNITY_MAP_PAGE_SIZE = 100;
const COMMUNITY_MAP_FETCH_CONCURRENCY = 3;
const COMMUNITY_MAP_BACKGROUND_REFRESH_MS = 30 * 1000;

const isValidCoordinate = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isValidLocation = (latitude, longitude) => isValidCoordinate(latitude, -90, 90) && isValidCoordinate(longitude, -180, 180);

const parseCoordinatesFromLocationText = (locationText) => {
  if (!locationText || typeof locationText !== 'string') return { latitude: NaN, longitude: NaN };
  const match = locationText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return { latitude: NaN, longitude: NaN };
  return { latitude: Number(match[1]), longitude: Number(match[2]) };
};

const normalizeIncident = (ticket) => {
  const parsedLocation = parseCoordinatesFromLocationText(ticket?.locationText);
  const latitude = Number(ticket?.latitude ?? ticket?.lat ?? ticket?.location?.latitude ?? ticket?.location?.lat ?? parsedLocation.latitude);
  const longitude = Number(ticket?.longitude ?? ticket?.lng ?? ticket?.lon ?? ticket?.location?.longitude ?? ticket?.location?.lng ?? ticket?.location?.lon ?? parsedLocation.longitude);
  const incidentId = ticket?.incidentId || ticket?.id || '';

  return {
    ...ticket,
    incidentId,
    title: ticket?.title || ticket?.summary || ticket?.description || ticket?.categoryName || 'Sự vụ đô thị',
    categoryName: ticket?.categoryName || ticket?.category?.name || ticket?.category || 'Chưa xác định',
    status: ticket?.incidentStatus || ticket?.status || 'Chưa xác định',
    priority: ticket?.priority || 'Trung bình',
    reporterUserId: ticket?.reporterUserId ?? ticket?.reporterId ?? ticket?.userId ?? ticket?.createdByUserId ?? ticket?.createdBy ?? ticket?.reporter?.userId ?? ticket?.reporter?.id ?? null,
    latitude,
    longitude,
  };
};

const unwrapItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const mergeByIncidentId = (...collections) => {
  const merged = new Map();
  collections.flat().forEach((item) => {
    const normalized = normalizeIncident(item);
    if (!normalized.incidentId || !isValidLocation(normalized.latitude, normalized.longitude)) return;
    merged.set(String(normalized.incidentId), { ...merged.get(String(normalized.incidentId)), ...normalized });
  });
  return [...merged.values()];
};

const getPageMeta = (response, fallbackPageNumber = 1) => ({
  items: unwrapItems(response),
  pageNumber: Math.max(1, Number(response?.pageNumber ?? response?.data?.pageNumber) || fallbackPageNumber),
  totalPages: Math.max(1, Number(response?.totalPages ?? response?.data?.totalPages) || 1),
});

const fetchAllCommunityMapIncidents = async () => {
  const firstResponse = await getCommunityFeed(
    { PageNumber: 1, PageSize: COMMUNITY_MAP_PAGE_SIZE },
    { force: true },
  );
  const firstPage = getPageMeta(firstResponse, 1);

  if (firstPage.totalPages <= 1) {
    return { items: firstPage.items, partial: false };
  }

  const items = [...firstPage.items];
  let partial = false;

  for (let startPage = 2; startPage <= firstPage.totalPages; startPage += COMMUNITY_MAP_FETCH_CONCURRENCY) {
    const pageNumbers = Array.from(
      { length: Math.min(COMMUNITY_MAP_FETCH_CONCURRENCY, firstPage.totalPages - startPage + 1) },
      (_, index) => startPage + index,
    );

    const results = await Promise.allSettled(
      pageNumbers.map((pageNumber) => getCommunityFeed(
        { PageNumber: pageNumber, PageSize: COMMUNITY_MAP_PAGE_SIZE },
        { force: true },
      )),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        items.push(...getPageMeta(result.value, pageNumbers[index]).items);
      } else {
        partial = true;
      }
    });
  }

  return { items, partial };
};

export function useIncidentMapData() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refreshInFlightRef = useRef(false);

  const loadIncidents = useCallback(async ({ silent = false } = {}) => {
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    if (!silent) setLoading(true);
    setError('');

    try {
      const result = await fetchAllCommunityMapIncidents();
      setIncidents(mergeByIncidentId(result.items));
      if (result.partial) {
        setError('Một phần dữ liệu bản đồ chưa tải được. Một số sự vụ có thể tạm thời chưa hiển thị.');
      }
    } catch (err) {
      setError(err?.message || 'Không thể tải dữ liệu bản đồ sự cố.');
      if (!silent) setIncidents([]);
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    const refresh = () => loadIncidents({ silent: true });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);
    const intervalId = window.setInterval(
      refresh,
      COMMUNITY_MAP_BACKGROUND_REFRESH_MS,
    );

    signalrService.start();
    const events = [
      'FeedbackCreated',
      'FeedbackStatusChanged',
      'AssignmentCreated',
      'AssignmentUpdated',
      'ResolutionSubmitted',
      'ResolutionApproved',
      'ResolutionRejected',
      'IncidentCreated',
      'IncidentUpdated',
      'IncidentStatusChanged',
      'IncidentMerged',
      'ReportLinked',
      'ReportUnlinked',
    ];
    events.forEach((eventName) => signalrService.on(eventName, refresh));

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
      events.forEach((eventName) => signalrService.off(eventName, refresh));
    };
  }, [loadIncidents]);

  return { incidents, loading, error, reloadIncidents: loadIncidents };
}

export default useIncidentMapData;
