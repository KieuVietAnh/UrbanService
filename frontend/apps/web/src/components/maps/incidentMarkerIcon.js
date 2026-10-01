import L from 'leaflet';

const PROCESSING_STATUSES = new Set([
  'new',
  'open',
  'submitted',
  'aireviewed',
  'verified',
  'pending',
  'assigned',
  'inprogress',
  'resolved',
  'submittedforapproval',
]);

const ENDED_STATUSES = new Set(['approved', 'closed']);
const REWORK_STATUSES = new Set(['needrework', 'reworkrequested']);

export const normalizeIncidentStatus = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLocaleLowerCase('en-US');

export const getIncidentMarkerTone = (status) => {
  const normalized = normalizeIncidentStatus(status);
  if (ENDED_STATUSES.has(normalized)) return 'ended';
  if (REWORK_STATUSES.has(normalized)) return 'rework';
  if (PROCESSING_STATUSES.has(normalized)) return 'processing';
  return 'processing';
};

export const getIncidentMarkerColor = (status) => {
  const tone = getIncidentMarkerTone(status);
  if (tone === 'ended') return '#10b981';
  if (tone === 'rework') return '#f43f5e';
  return '#2563eb';
};

export const getGroupedIncidentMarkerStatus = (items = []) => {
  const statuses = items.map((item) => item?.status || item?.feedbackStatus || item?.ticketStatus || '');

  if (statuses.some((status) => getIncidentMarkerTone(status) === 'rework')) {
    return 'needrework';
  }

  if (statuses.length > 0 && statuses.every((status) => getIncidentMarkerTone(status) === 'ended')) {
    return 'closed';
  }

  if (statuses.some((status) => getIncidentMarkerTone(status) === 'processing')) {
    return 'inprogress';
  }

  return statuses[0] || 'new';
};

export const createIncidentMarkerIcon = (status, {
  count = 1,
  focused = false,
  size = 34,
} = {}) => {
  const color = getIncidentMarkerColor(status);
  const markerSize = focused ? Math.max(size, 40) : size;
  const innerDotSize = focused ? 10 : 8;
  const haloSize = focused ? 9 : 7;
  const label = count > 1 ? String(count) : '';

  return L.divIcon({
    className: '',
    html: `
      <span style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:${markerSize}px;
        height:${markerSize}px;
        border-radius:999px;
        border:3px solid rgba(255,255,255,.97);
        background:${color};
        color:#fff;
        font:700 11px/1 Inter,Segoe UI,sans-serif;
        box-shadow:0 8px 20px rgba(15,23,42,.28),0 0 0 ${haloSize}px ${color}${focused ? '33' : '24'};
        transition:transform .18s ease, box-shadow .18s ease;
      ">${label || `<span style="width:${innerDotSize}px;height:${innerDotSize}px;border-radius:999px;background:#fff;display:block"></span>`}</span>
    `,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
    popupAnchor: [0, -(markerSize / 2 + 2)],
  });
};
