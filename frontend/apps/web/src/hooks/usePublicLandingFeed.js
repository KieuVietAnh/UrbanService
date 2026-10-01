import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCommunityFeed } from '../services/api/feedApi';
import {
  getCommunityIncidentId,
  isCommunityEndedIncidentStatus,
  isCommunityPublicIncidentStatus,
} from '../components/community/communityPresentation.js';

const getIncidentId = (item) => getCommunityIncidentId(item);

const PREVIEW_SIZE = 4;

const getCreatedAt = (item) => (
  item?.createdAt || item?.createdDate || item?.submittedAt
);

const isPublicIncident = (item) => {
  if (!item || item?.isPublic === false) return false;

  const visibility = String(item?.visibility || item?.scope || '').toLowerCase();
  if (visibility === 'private' || visibility === 'internal') return false;

  return isCommunityPublicIncidentStatus(item?.incidentStatus || item?.status);
};

const dedupeIncidents = (feedItems = []) => {
  const seen = new Set();
  return feedItems.filter((item) => {
    const incidentId = String(getIncidentId(item) || '');
    if (!incidentId || seen.has(incidentId)) return false;
    seen.add(incidentId);
    return true;
  });
};

const usePublicLandingFeed = () => {
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getCommunityFeed({
        PageNumber: 1,
        PageSize: 8,
      });
      const publicItems = dedupeIncidents(
        (Array.isArray(response?.items) ? response.items : [])
          .filter(isPublicIncident)
      )
        .sort((firstItem, secondItem) => (
          new Date(getCreatedAt(secondItem) || 0).getTime() -
          new Date(getCreatedAt(firstItem) || 0).getTime()
        ));
      const previewItems = publicItems.slice(0, PREVIEW_SIZE);

      setItems(previewItems);
      setTotalItems(Number(response?.totalItems) || publicItems.length);
    } catch (loadError) {
      setItems([]);
      setTotalItems(0);
      setError(loadError?.message || 'Không thể tải sự vụ gần đây.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const activeCount = items.filter((item) => (
      !isCommunityEndedIncidentStatus(item?.incidentStatus || item?.status)
    )).length;
    const completedCount = items.filter((item) => (
      isCommunityEndedIncidentStatus(item?.incidentStatus || item?.status)
    )).length;
    const interactionCount = items.reduce((total, item) => (
      total +
      Number(item?.subscriberCount || 0) +
      Number(item?.reportCount || 0)
    ), 0);

    return {
      totalItems,
      activeCount,
      completedCount,
      interactionCount,
    };
  }, [items, totalItems]);

  return {
    items,
    summary,
    loading,
    error,
    reload: load,
  };
};

export default usePublicLandingFeed;
