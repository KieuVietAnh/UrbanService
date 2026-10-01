const TICKET_DETAIL_CACHE_KEY = 'urbanmind-ticket-detail-cache-v1';
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;

const getOwnerKey = (ownerId) => String(ownerId || 'anonymous');
const getFeedbackKey = (feedbackId) => String(feedbackId || '');

const readAll = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.sessionStorage.getItem(TICKET_DETAIL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeAll = (value) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(TICKET_DETAIL_CACHE_KEY, JSON.stringify(value || {}));
  } catch {
    // sessionStorage can be unavailable or full; cache is only an optimization.
  }
};

const buildKey = (feedbackId, ownerId) => `${getOwnerKey(ownerId)}:${getFeedbackKey(feedbackId)}`;

export const readTicketDetailCache = (feedbackId, ownerId) => {
  if (!feedbackId) return null;

  const cache = readAll();
  const key = buildKey(feedbackId, ownerId);
  const entry = cache[key];

  if (!entry?.ticket || !entry?.cachedAt) return null;

  if (Date.now() - Number(entry.cachedAt) > CACHE_MAX_AGE_MS) {
    const next = { ...cache };
    delete next[key];
    writeAll(next);
    return null;
  }

  return entry;
};

export const writeTicketDetailCache = (feedbackId, ownerId, ticket, resolutionError = '') => {
  if (!feedbackId || !ticket) return;

  const cache = readAll();
  const key = buildKey(feedbackId, ownerId);
  cache[key] = {
    ticket,
    resolutionError: resolutionError || '',
    cachedAt: Date.now(),
  };

  writeAll(cache);
};
