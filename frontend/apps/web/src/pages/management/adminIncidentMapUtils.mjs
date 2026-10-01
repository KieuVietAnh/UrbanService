const normalizeStatus = (value) => String(value || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
const normalizeSimple = (value) => String(value || '').trim().toLocaleLowerCase('en-US');
const PROCESSING = new Set(['new', 'open', 'pending', 'verified', 'assigned', 'inprogress', 'submittedforapproval', 'needrework']);
const ENDED = new Set(['approved', 'closed', 'cancelled', 'canceled', 'rejected', 'merged']);
const HIGH_ATTENTION_LEVELS = new Set(['high', 'critical']);
const STATUS_GROUPS = {
  intake: new Set(['new', 'open', 'pending', 'verified']),
  processing: new Set(['assigned', 'inprogress', 'needrework']),
  approval: new Set(['submittedforapproval']),
  ended: ENDED,
};

const parseLocationText = (value) => {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return match ? { latitude: Number(match[1]), longitude: Number(match[2]) } : { latitude: Number.NaN, longitude: Number.NaN };
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

export const normalizeAdminMapIncident = (item = {}) => {
  const parsed = parseLocationText(item?.locationText);
  return {
    ...item,
    incidentId: item?.incidentId || item?.id,
    title: item?.title || item?.summary || item?.description || 'Sự vụ đô thị',
    areaId: item?.areaId ?? item?.area?.areaId ?? item?.area?.id ?? '',
    areaName: item?.areaName || item?.area?.areaName || item?.area?.name,
    categoryId: item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id ?? '',
    categoryName: item?.categoryName || item?.category?.categoryName || item?.category?.name,
    severity: item?.severity ?? item?.aiSeverity ?? '',
    priority: item?.priority ?? '',
    latitude: Number(item?.latitude ?? item?.lat ?? item?.location?.latitude ?? parsed.latitude),
    longitude: Number(item?.longitude ?? item?.lng ?? item?.lon ?? item?.location?.longitude ?? parsed.longitude),
  };
};

export const hasAdminMapCoordinates = (item) => Number.isFinite(item?.latitude)
  && Number.isFinite(item?.longitude)
  && Math.abs(item.latitude) <= 90
  && Math.abs(item.longitude) <= 180;

export const isHighAttentionIncident = (item = {}) => HIGH_ATTENTION_LEVELS.has(normalizeSimple(item?.severity));

export const filterAdminMapIncidents = (items = [], filter = 'all') => {
  if (filter === 'coordinates') return items.filter(hasAdminMapCoordinates);
  if (filter === 'new') return items.filter((item) => normalizeStatus(item?.status) === 'new');
  if (filter === 'processing') return items.filter((item) => PROCESSING.has(normalizeStatus(item?.status)));
  if (filter === 'ended') return items.filter((item) => ENDED.has(normalizeStatus(item?.status)));
  return items;
};

export const normalizeAreaBoundaryGeoJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'].includes(value?.type) ? value : null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const withoutWrappingQuotes = trimmed.replace(/^"|"$/g, '');
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

export const resolveAdminMapArea = (areas = [], areaFilter = 'all') => {
  if (String(areaFilter) === 'all') return null;
  const expected = String(areaFilter);
  return areas.find((area) => (
    String(area?.areaId ?? area?.id ?? '') === expected
    || String(area?.areaName ?? area?.name ?? '') === expected
  )) || null;
};

export const buildAdminMapFilterOptions = (incidents = [], areas = []) => ({
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

const matchesStatusGroup = (item, status) => {
  if (!status || status === 'all') return true;
  const normalized = normalizeStatus(item?.status);
  const group = STATUS_GROUPS[status];
  return group ? group.has(normalized) : normalized === normalizeStatus(status);
};

export const filterAdminMapIncidentsByFilters = (items = [], filters = {}) => {
  const search = String(filters?.search || '').trim().toLocaleLowerCase('vi-VN');
  const area = String(filters?.area || 'all');
  const category = String(filters?.category || 'all');
  const status = String(filters?.status || 'all');
  const severity = normalizeSimple(filters?.severity || 'all');
  const priority = normalizeSimple(filters?.priority || 'all');

  return items.filter((item) => {
    if (area !== 'all') {
      const itemArea = String(item?.areaId ?? item?.area?.areaId ?? item?.area?.id ?? item?.areaName ?? '');
      if (itemArea !== area) return false;
    }
    if (category !== 'all') {
      const itemCategory = String(item?.categoryId ?? item?.category?.categoryId ?? item?.category?.id ?? item?.categoryName ?? '');
      if (itemCategory !== category) return false;
    }
    if (!matchesStatusGroup(item, status)) return false;
    if (severity === 'high-critical') {
      if (!isHighAttentionIncident(item)) return false;
    } else if (severity !== 'all' && normalizeSimple(item?.severity) !== severity) return false;
    if (priority !== 'all' && normalizeSimple(item?.priority) !== priority) return false;
    if (search) {
      const haystack = [
        item?.incidentCode,
        item?.title,
        item?.summary,
        item?.areaName,
        item?.categoryName,
      ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
};

const topCount = (items = [], labelGetter) => {
  const counts = new Map();
  items.forEach((item) => {
    const label = String(labelGetter(item) || '').trim();
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const [entry] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'));
  return entry ? { name: entry[0], count: entry[1] } : null;
};

export const summarizeAdminMapIncidents = (items = []) => ({
  topArea: topCount(items, (item) => item?.areaName || item?.wardName),
  topCategory: topCount(items, (item) => item?.categoryName),
  missingCoordinates: items.filter((item) => !hasAdminMapCoordinates(item)).length,
});
