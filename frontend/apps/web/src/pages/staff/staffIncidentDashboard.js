const normalizeEnumKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const ACTIVE_STATUS_KEYS = new Set([
  'assigned',
  'inprogress',
  'needrework',
  'submittedforapproval',
]);

const SEVERITY_ORDER = Object.freeze({
  critical: 4,
  urgent: 4,
  high: 3,
  major: 3,
  medium: 2,
  normal: 2,
  low: 1,
  minor: 1,
});

const PRIORITY_ORDER = Object.freeze({
  critical: 4,
  urgent: 4,
  high: 3,
  medium: 2,
  normal: 2,
  low: 1,
});

const STATUS_LABELS = Object.freeze({
  new: 'Mới',
  verified: 'Đã xác nhận',
  assigned: 'Được phân công',
  inprogress: 'Đang xử lý',
  submittedforapproval: 'Chờ duyệt',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  merged: 'Đã gộp',
});

const PRIORITY_LABELS = Object.freeze({
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  low: 'Thấp',
});

const SEVERITY_LABELS = Object.freeze({
  critical: 'Nghiêm trọng',
  urgent: 'Nghiêm trọng',
  high: 'Cao',
  major: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  low: 'Thấp',
  minor: 'Thấp',
});

const parseTimestamp = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const getIncidentId = (incident) => String(incident?.incidentId ?? '').trim();

const hasSlaBreach = (sla) => Boolean(
  sla?.isResponseBreached
  || sla?.isResolutionBreached
  || Number(sla?.responseRemainingSeconds) < 0
  || Number(sla?.resolutionRemainingSeconds) < 0
);

const hasSlaWarning = (sla) => Boolean(
  !hasSlaBreach(sla)
  && (sla?.isResponseWarning || sla?.isResolutionWarning)
);

const isNotFoundError = (error) => Number(error?.response?.status ?? error?.status) === 404;

const isCanceledRequest = (error) => (
  error?.code === 'ERR_CANCELED'
  || error?.name === 'AbortError'
  || error?.name === 'CanceledError'
);

export const getStaffIncidentStatusLabel = (value) => (
  STATUS_LABELS[normalizeEnumKey(value)] || 'Chưa xác định'
);

export const getStaffIncidentPriorityLabel = (value) => (
  value ? PRIORITY_LABELS[normalizeEnumKey(value)] || 'Chưa xác định' : 'Chưa có dữ liệu'
);

export const getStaffIncidentSeverityLabel = (value) => (
  value ? SEVERITY_LABELS[normalizeEnumKey(value)] || 'Chưa xác định' : 'Chưa có dữ liệu'
);

export const isActiveStaffIncident = (incident) => (
  ACTIVE_STATUS_KEYS.has(normalizeEnumKey(incident?.status))
);

export const calculateStaffIncidentKpis = (incidents = []) => {
  const counts = {
    assigned: 0,
    inProgress: 0,
    needRework: 0,
    pendingApproval: 0,
    totalActive: 0,
  };

  incidents.forEach((incident) => {
    const status = normalizeEnumKey(incident?.status);

    if (status === 'assigned') counts.assigned += 1;
    if (status === 'inprogress') counts.inProgress += 1;
    if (status === 'needrework') counts.needRework += 1;
    if (status === 'submittedforapproval') counts.pendingApproval += 1;
  });

  counts.totalActive = counts.assigned
    + counts.inProgress
    + counts.needRework
    + counts.pendingApproval;

  return counts;
};

export const calculateStaffIncidentSlaKpis = (slaByIncidentId = {}) => {
  const statuses = Object.values(slaByIncidentId).filter(Boolean);
  const breached = statuses.filter(hasSlaBreach).length;
  const nearingBreach = statuses.filter(hasSlaWarning).length;

  return {
    tracked: statuses.length,
    nearingBreach,
    breached,
    healthy: Math.max(0, statuses.length - nearingBreach - breached),
  };
};

export const getStaffIncidentSlaState = (sla) => {
  if (hasSlaBreach(sla)) return 'breached';
  if (hasSlaWarning(sla)) return 'warning';
  return sla ? 'healthy' : 'unavailable';
};

export const sortStaffIncidentsForAttention = (incidents = [], slaByIncidentId = {}) => (
  incidents
    .filter(isActiveStaffIncident)
    .slice()
    .sort((left, right) => {
      const slaRank = (incident) => {
        const state = getStaffIncidentSlaState(slaByIncidentId[getIncidentId(incident)]);
        if (state === 'breached') return 2;
        if (state === 'warning') return 1;
        return 0;
      };
      const slaDifference = slaRank(right) - slaRank(left);
      if (slaDifference !== 0) return slaDifference;

      const leftNeedsRework = normalizeEnumKey(left?.status) === 'needrework' ? 1 : 0;
      const rightNeedsRework = normalizeEnumKey(right?.status) === 'needrework' ? 1 : 0;
      if (leftNeedsRework !== rightNeedsRework) return rightNeedsRework - leftNeedsRework;

      const severityDifference = (SEVERITY_ORDER[normalizeEnumKey(right?.severity)] || 0)
        - (SEVERITY_ORDER[normalizeEnumKey(left?.severity)] || 0);
      if (severityDifference !== 0) return severityDifference;

      const priorityDifference = (PRIORITY_ORDER[normalizeEnumKey(right?.priority)] || 0)
        - (PRIORITY_ORDER[normalizeEnumKey(left?.priority)] || 0);
      if (priorityDifference !== 0) return priorityDifference;

      return parseTimestamp(right?.updatedAt || right?.createdAt)
        - parseTimestamp(left?.updatedAt || left?.createdAt);
    })
);

const deduplicateIncidents = (incidents) => {
  const byId = new Map();

  incidents.forEach((incident) => {
    const incidentId = getIncidentId(incident);
    if (!incidentId) throw new TypeError('Incident list item is missing incidentId');

    const current = byId.get(incidentId);
    if (
      !current
      || parseTimestamp(incident?.updatedAt || incident?.createdAt)
        >= parseTimestamp(current?.updatedAt || current?.createdAt)
    ) {
      byId.set(incidentId, incident);
    }
  });

  return Array.from(byId.values());
};

export const fetchAllAssignedStaffIncidents = async ({
  getIncidents,
  assignedStaffUserId,
  signal,
  pageSize = 100,
}) => {
  const normalizedStaffUserId = String(assignedStaffUserId ?? '').trim();
  if (!normalizedStaffUserId) throw new TypeError('assignedStaffUserId is required');
  if (typeof getIncidents !== 'function') throw new TypeError('getIncidents is required');

  const requestPage = (pageNumber) => getIncidents({
    pageNumber,
    pageSize,
    assignedStaffUserId: normalizedStaffUserId,
    includeMerged: false,
  }, { signal });

  const firstPage = await requestPage(1);
  const firstItems = Array.isArray(firstPage?.items) ? firstPage.items : [];
  const totalItems = Number(firstPage?.totalItems);
  const totalPages = Number(firstPage?.totalPages);

  if (!Number.isInteger(totalItems) || totalItems < 0) {
    throw new TypeError('Incident pagination is missing totalItems');
  }

  if (totalItems === 0) return { incidents: [], totalItems: 0 };
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new TypeError('Incident pagination is missing totalPages');
  }

  const pages = [firstPage];
  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);

  for (let index = 0; index < pageNumbers.length; index += 4) {
    const batch = pageNumbers.slice(index, index + 4);
    const batchResults = await Promise.all(batch.map(requestPage));
    pages.push(...batchResults);
  }

  const incidents = deduplicateIncidents(
    pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : [])),
  );

  if (incidents.length < totalItems || firstItems.length === 0) {
    throw new Error('INCOMPLETE_STAFF_INCIDENT_DATA');
  }

  return { incidents, totalItems };
};

export const fetchAssignedIncidentSlaStatuses = async ({
  incidents,
  getIncidentSlaStatus,
  signal,
  batchSize = 4,
}) => {
  if (!Array.isArray(incidents)) throw new TypeError('incidents is required');
  if (typeof getIncidentSlaStatus !== 'function') throw new TypeError('getIncidentSlaStatus is required');
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new TypeError('batchSize must be a positive integer');

  const targets = incidents.filter(isActiveStaffIncident);
  const slaByIncidentId = {};
  let failedCount = 0;

  for (let index = 0; index < targets.length; index += batchSize) {
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const batch = targets.slice(index, index + batchSize);
    const results = await Promise.allSettled(batch.map((incident) => {
      const incidentId = getIncidentId(incident);
      if (!incidentId) throw new TypeError('Incident list item is missing incidentId');
      return getIncidentSlaStatus(incidentId, { signal });
    }));

    results.forEach((result, resultIndex) => {
      const incidentId = getIncidentId(batch[resultIndex]);
      if (result.status === 'rejected') {
        if (isCanceledRequest(result.reason)) throw result.reason;
        if (!isNotFoundError(result.reason)) failedCount += 1;
        return;
      }

      const sla = result.value;
      if (!sla) return;
      const returnedIncidentId = String(sla?.incidentId ?? '').trim();
      if (!returnedIncidentId || returnedIncidentId.toLowerCase() !== incidentId.toLowerCase()) {
        failedCount += 1;
        return;
      }
      slaByIncidentId[incidentId] = sla;
    });
  }

  return {
    slaByIncidentId,
    failedCount,
    requestedCount: targets.length,
  };
};

export { normalizeEnumKey as normalizeStaffIncidentDashboardKey };
