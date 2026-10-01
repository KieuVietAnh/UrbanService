
const normalizeKey = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLocaleLowerCase('en-US');

const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('vi');



export const normalizeAreaBoundaryGeoJson = (boundaryGeoJson) => {
  if (!boundaryGeoJson) return null;
  if (typeof boundaryGeoJson === 'object') {
    return ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'].includes(boundaryGeoJson.type)
      ? boundaryGeoJson
      : null;
  }
  if (typeof boundaryGeoJson !== 'string') return null;

  const trimmed = boundaryGeoJson.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  const withoutWrappingQuotes = (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) ? trimmed.slice(1, -1) : trimmed;

  const candidates = [
    trimmed,
    withoutWrappingQuotes,
    trimmed.replace(/""/g, '"'),
    withoutWrappingQuotes.replace(/""/g, '"'),
    trimmed.replace(/\\"/g, '"'),
    withoutWrappingQuotes.replace(/\\"/g, '"'),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'string' && parsed !== candidate) return normalizeAreaBoundaryGeoJson(parsed);
      return parsed && ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'].includes(parsed.type)
        ? parsed
        : null;
    } catch {
      // Try the next serialized representation.
    }
  }
  return null;
};



export const normalizeMapCoordinate = (value) => {
  if (value == null) return Number.NaN;
  if (typeof value === 'string' && !value.trim()) return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const getHeatmapViewportMode = (areaFilter = 'all') => (
  String(areaFilter) === 'all' ? 'incidents' : 'area'
);

export const resolveSelectedMapArea = (areas = [], areaFilter = 'all') => {
  if (areaFilter === 'all') return null;
  const expected = String(areaFilter);
  return areas.find((area) => (
    String(area?.areaId ?? area?.id ?? '') === expected || String(area?.areaName ?? area?.name ?? '') === expected
  )) || null;
};

const AUTO_SCROLL_FILTERS = new Set(['area', 'category', 'status', 'severity', 'priority', 'coordinates']);
const AUTO_SCROLL_KPIS = new Set(['total', 'mapped', 'visible', 'priority']);

export const shouldAutoScrollMapFilter = (filterKey) => AUTO_SCROLL_FILTERS.has(String(filterKey || ''));
export const shouldAutoScrollMapKpi = (kpiKey) => AUTO_SCROLL_KPIS.has(String(kpiKey || ''));

const STATUS_GROUPS = {
  intake: new Set(['new', 'verified']),
  processing: new Set(['assigned', 'inprogress', 'needrework']),
  approval: new Set(['submittedforapproval']),
  ended: new Set(['approved', 'closed', 'cancelled', 'merged']),
};

const toOptionEntries = (items, valueGetter, labelGetter) => {
  const map = new Map();
  items.forEach((item) => {
    const value = String(valueGetter(item) ?? '').trim();
    const label = String(labelGetter(item) || '').trim();
    if (value && label && !map.has(value)) map.set(value, label);
  });
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
};

export const buildMapFilterOptions = (incidents = [], areas = []) => ({
  areas: toOptionEntries(
    areas.length ? areas : incidents,
    (item) => item?.areaId ?? item?.id ?? item?.area?.areaId ?? item?.area?.id ?? item?.areaName,
    (item) => item?.areaName || item?.name || item?.wardName || item?.area?.areaName || item?.area?.name,
  ),
  categories: toOptionEntries(
    incidents,
    (item) => item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id ?? item?.categoryName,
    (item) => item?.categoryName || item?.category?.categoryName || item?.category?.name || 'Chưa phân loại',
  ),
});

export const filterMapIncidents = (incidents = [], filters = {}) => {
  const {
    search = '', area = 'all', category = 'all', status = 'all', priority = 'all', severity = 'all', coordinates = 'all',
  } = filters;
  const searchKey = normalizeText(search);

  return incidents.filter((item) => {
    if (searchKey) {
      const haystack = [
        item?.incidentCode, item?.code, item?.incidentId, item?.title, item?.summary,
        item?.description, item?.areaName, item?.categoryName,
      ].map(normalizeText).join(' ');
      if (!haystack.includes(searchKey)) return false;
    }

    if (area !== 'all') {
      const itemArea = String(item?.areaId ?? item?.area?.areaId ?? item?.area?.id ?? item?.areaName ?? '').trim();
      if (itemArea !== String(area)) return false;
    }

    if (category !== 'all') {
      const itemCategory = String(item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id ?? item?.categoryName ?? '').trim();
      if (itemCategory !== String(category)) return false;
    }

    if (status !== 'all') {
      const statusSet = STATUS_GROUPS[status];
      if (!statusSet?.has(normalizeKey(item?.status || item?.feedbackStatus))) return false;
    }

    if (priority !== 'all') {
      const itemPriority = normalizeText(item?.priority);
      if (priority === 'highOrUrgent') {
        if (!['high', 'urgent', 'critical'].includes(itemPriority)) return false;
      } else if (priority === 'urgent') {
        if (!['urgent', 'critical'].includes(itemPriority)) return false;
      } else if (itemPriority !== priority) return false;
    }

    if (severity !== 'all' && normalizeText(item?.severity) !== severity) return false;

    if (coordinates !== 'all') {
      const hasCoordinates = Number.isFinite(Number(item?.latitude)) && Number.isFinite(Number(item?.longitude));
      if (coordinates === 'mapped' && !hasCoordinates) return false;
      if (coordinates === 'missing' && hasCoordinates) return false;
    }

    return true;
  });
};

const topCount = (items, labelGetter) => {
  const counts = new Map();
  items.forEach((item) => {
    const name = String(labelGetter(item) || '').trim();
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const [entry] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'));
  return entry ? { name: entry[0], count: entry[1] } : null;
};

export const summarizeMapIncidents = (scopedIncidents = [], mappedIncidents = []) => ({
  missingCoordinates: Math.max(0, scopedIncidents.length - mappedIncidents.length),
  topArea: topCount(scopedIncidents, (item) => item?.areaName || item?.wardName),
  topCategory: topCount(scopedIncidents, (item) => item?.categoryName),
});

