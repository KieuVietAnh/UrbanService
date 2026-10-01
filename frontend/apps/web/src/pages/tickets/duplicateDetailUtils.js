const getTextValue = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  return String(value);
};

export const resolveDuplicateCandidateId = (params = {}) => {
  const value = params?.duplicateCandidateId ?? params?.candidateId;
  return String(value ?? '').trim();
};

export const getDuplicateCandidateDecisionState = (candidate) => {
  if (!candidate) return 'unavailable';

  const status = String(candidate.status || '').trim().toLowerCase();
  if (status === 'pending') return 'pending';
  if (status === 'confirmed' || status === 'rejected') return 'processed';
  return 'unsupported';
};

const getFirstValue = (source, paths, fallback = '—') => {
  for (const path of paths) {
    let current = source;
    for (const key of path.split('.')) {
      if (current == null || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = current[key];
    }

    if (current !== null && current !== undefined && current !== '') {
      return getTextValue(current, fallback);
    }
  }

  return fallback;
};

const normalizeFeedback = (feedback = null) => {
  if (!feedback) return null;
  const collectArray = (obj, keys) => {
    for (const key of keys) {
      const val = obj?.[key];
      if (Array.isArray(val)) return val;
      if (Array.isArray(val?.items)) return val.items;
      if (Array.isArray(val?.results)) return val.results;
    }
    return [];
  };

  const imageCandidates = [
    ...collectArray(feedback, ['images', 'photos', 'attachments']),
    ...collectArray(feedback, ['media', 'files', 'imageUrls', 'pictures']),
  ];

  return {
    ...feedback,
    feedbackId: getFirstValue(feedback, ['feedbackId', 'id'], '—'),
    title: getFirstValue(feedback, ['title', 'name'], 'Không có tiêu đề'),
    description: getFirstValue(feedback, ['description', 'details', 'content', 'message'], 'Không có mô tả'),
    categoryName: getFirstValue(feedback, ['categoryName', 'category.name', 'category.categoryName', 'categoryType', 'type'], '—'),
    locationText: getFirstValue(feedback, ['locationText', 'location', 'address', 'locationName'], '—'),
    reporterName: getFirstValue(feedback, ['reporterName', 'userName', 'reporter.name', 'reportedByName', 'createdByName', 'userDisplayName'], '—'),
    areaName: getFirstValue(feedback, ['areaName', 'area.name', 'districtName', 'district'], '—'),
    priority: getFirstValue(feedback, ['priority', 'severity'], '—'),
    status: getFirstValue(feedback, ['status'], '—'),
    createdAt: getFirstValue(feedback, ['createdAt', 'createdDate', 'updatedAt'], '—'),
    images: imageCandidates,
    attachments: Array.isArray(feedback?.attachments) ? feedback.attachments : [],
    photos: Array.isArray(feedback?.photos) ? feedback.photos : [],
  };
};

export const normalizeDuplicateCandidatePayload = (candidate = {}) => {
  const primaryFeedback = normalizeFeedback(candidate?.primaryFeedback || candidate?.primary || candidate?.feedback || null);
  const duplicateFeedback = normalizeFeedback(candidate?.duplicateFeedback || candidate?.duplicate || candidate?.potentialParentFeedback || candidate?.potentialParent || null);

  return {
    ...candidate,
    primaryFeedback,
    duplicateFeedback,
  };
};

const resolveUrlFromItem = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  const candidates = [
    item.url,
    item.fileUrl,
    item.src,
    item.path,
    item.link,
    item.location,
    item.data?.url,
    item.data?.attributes?.url,
    item.attributes?.url,
    item.file?.url,
    item.file?.fileUrl,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (Array.isArray(c) && c.length && typeof c[0] === 'string') return c[0];
  }

  // try to find first string value anywhere shallow
  for (const key of Object.keys(item)) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) return v;
  }

  return null;
};

export const extractImageUrls = (feedback = {}) => {
  if (!feedback) return [];
  const collect = (obj, keys) => {
    for (const k of keys) {
      const val = obj?.[k];
      if (Array.isArray(val) && val.length) return val;
    }
    return [];
  };

  const arrays = [
    ...collect(feedback, ['images', 'photos', 'attachments']),
    ...collect(feedback, ['media', 'files', 'imageUrls', 'pictures']),
  ];

  const flattened = arrays.flat();

  const results = flattened
    .map((it) => resolveUrlFromItem(it))
    .filter(Boolean);

  if (results.length) return results;

  // Fallback: scan the feedback object shallowly for any URL-like strings
  const seen = new Set();
  const urls = [];
  const isUrlLike = (s) => typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/uploads') || s.startsWith('data:image'));

  const scan = (obj, depth = 0) => {
    if (!obj || depth > 4) return;
    if (typeof obj === 'string') {
      if (isUrlLike(obj) && !seen.has(obj)) {
        seen.add(obj);
        urls.push(obj);
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (const v of obj) scan(v, depth + 1);
      return;
    }
    if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) scan(obj[key], depth + 1);
    }
  };

  scan(feedback, 0);

  return urls;
};

export const getCandidateReasoning = (candidate = {}) => {
  const reasoningCandidates = [
    candidate?.reasoning,
    candidate?.duplicateReasoning,
    candidate?.analysis?.reasoning,
    candidate?.details?.reasoning,
    candidate?.metadata?.reasoning,
    candidate?.reason,
  ];

  return reasoningCandidates.find((value) => typeof value === 'string' && value.trim()) || '';
};
