const getBaseUrl = () => {
  if (import.meta.env.DEV) return '';
  const raw = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
  return raw.replace(/\/$/, '');
};

const buildApiEndpoint = (path) => {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
};

const getAuthToken = () => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('urbanmind_auth_token') || localStorage.getItem('token');
};

const COMMUNITY_PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMUNITY_FEED_PAGE_CACHE_TTL_MS = 60 * 1000;
const COMMUNITY_DETAIL_CACHE_TTL_MS = 60 * 1000;
const communityPreviewCache = new Map();
const communityPreviewRequests = new Map();
const communityFeedPageCache = new Map();
const communityFeedPageRequests = new Map();
const communityDetailCache = new Map();
const communityDetailRequests = new Map();

const getCommunityCacheKey = (incidentId) => String(incidentId || '').trim();

const COMMUNITY_ENGAGEMENT_STORAGE_PREFIX = 'urbanmind:community-incident-engagement:';
const COMMUNITY_ENGAGEMENT_EVENT = 'urbanmind:community-incident-engagement';
const communityIncidentEngagementState = new Map();

const readStoredCommunityIncidentEngagement = (incidentId) => {
  const key = getCommunityCacheKey(incidentId);
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${COMMUNITY_ENGAGEMENT_STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const getCommunityIncidentEngagementState = (incidentId) => {
  const key = getCommunityCacheKey(incidentId);
  if (!key) return null;
  const memoryState = communityIncidentEngagementState.get(key);
  if (memoryState) return memoryState;
  const storedState = readStoredCommunityIncidentEngagement(key);
  if (storedState) communityIncidentEngagementState.set(key, storedState);
  return storedState;
};

export const recordCommunityIncidentEngagement = (incidentId, patch = {}) => {
  const key = getCommunityCacheKey(incidentId);
  if (!key) return null;
  const current = getCommunityIncidentEngagementState(key) || {};
  const next = { ...current, ...patch, incidentId: key };
  communityIncidentEngagementState.set(key, next);

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        `${COMMUNITY_ENGAGEMENT_STORAGE_PREFIX}${key}`,
        JSON.stringify(next),
      );
    } catch {
      // Session storage is an optimization only.
    }
    window.dispatchEvent(new CustomEvent(COMMUNITY_ENGAGEMENT_EVENT, { detail: next }));
  }

  return next;
};

export const subscribeCommunityIncidentEngagement = (listener) => {
  if (typeof window === 'undefined' || typeof listener !== 'function') return () => {};
  const handler = (event) => listener(event?.detail || null);
  window.addEventListener(COMMUNITY_ENGAGEMENT_EVENT, handler);
  return () => window.removeEventListener(COMMUNITY_ENGAGEMENT_EVENT, handler);
};

const getRequestHeaders = () => {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const readPayload = async (response) => {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
};

const unwrapData = (payload) => (
  payload?.data && !Array.isArray(payload.data) && typeof payload.data === 'object'
    ? payload.data
    : payload
);

const buildRequestError = (response, payload, fallbackMessage) => {
  const detail = typeof payload === 'string'
    ? payload.slice(0, 300)
    : payload?.message || payload?.detail || '';
  const error = new Error(detail || fallbackMessage || `Request failed with status ${response.status}`);
  error.status = response.status;
  return error;
};

const normalizeCommunityPreview = (detail = {}) => ({
  // Incident media is provided by the Incident contract. Preserve only media
  // explicitly returned for this Incident; never infer a cover from reports[0].
  attachments: Array.isArray(detail?.attachments) ? detail.attachments : [],
  description: detail?.description || '',
  imageUrl: detail?.imageUrl || '',
  coverImageThumbnailUrl: detail?.coverImageThumbnailUrl || '',
  coverImageUrl: detail?.coverImageUrl || '',
  thumbnailUrl: detail?.thumbnailUrl || '',
  mediaUrl: detail?.mediaUrl || '',
  attachmentUrl: detail?.attachmentUrl || '',
});

const normalizeFeedParams = (params = {}) => {
  const normalized = {};
  const pageNumber = Number(params?.PageNumber ?? params?.pageNumber ?? params?.page ?? 1);
  const pageSize = Number(params?.PageSize ?? params?.pageSize ?? 10);

  if (Number.isFinite(pageNumber) && pageNumber > 0) normalized.PageNumber = pageNumber;
  if (Number.isFinite(pageSize) && pageSize > 0) normalized.PageSize = pageSize;

  const passthrough = [
    ['AreaId', params?.AreaId ?? params?.areaId],
    ['CategoryId', params?.CategoryId ?? params?.categoryId],
    ['Priority', params?.Priority ?? params?.priority],
    ['Severity', params?.Severity ?? params?.severity],
    ['Search', params?.Search ?? params?.search],
    ['IncludeMerged', params?.IncludeMerged ?? params?.includeMerged],
    ['AssignedStaffUserId', params?.AssignedStaffUserId ?? params?.assignedStaffUserId],
  ];

  passthrough.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    normalized[key] = typeof value === 'string' ? value.trim() : value;
  });

  const status = params?.Status ?? params?.status ?? params?.tab;
  if (typeof status === 'string' && status.trim()) {
    const trimmed = status.trim();
    const lowered = trimmed.toLowerCase();
    if (lowered === 'resolved') normalized.Status = 'Resolved';
    else if (!['latest', 'trending', 'nearby'].includes(lowered)) normalized.Status = trimmed;
  }

  return normalized;
};

const normalizePagedPayload = (value) => {
  const unwrappedValue = unwrapData(value);

  if (Array.isArray(unwrappedValue)) {
    return {
      items: unwrappedValue,
      pageNumber: 1,
      pageSize: unwrappedValue.length,
      totalItems: unwrappedValue.length,
      totalPages: 1,
    };
  }

  if (!unwrappedValue || typeof unwrappedValue !== 'object') {
    return { items: [], pageNumber: 1, pageSize: 0, totalItems: 0, totalPages: 1 };
  }

  const items = Array.isArray(unwrappedValue.items)
    ? unwrappedValue.items
    : Array.isArray(unwrappedValue.data)
      ? unwrappedValue.data
      : Array.isArray(unwrappedValue.content)
        ? unwrappedValue.content
        : Array.isArray(unwrappedValue.incidents)
          ? unwrappedValue.incidents
          : Array.isArray(unwrappedValue.results)
            ? unwrappedValue.results
            : [];

  const pageNumber = Number(unwrappedValue.pageNumber ?? unwrappedValue.page ?? 1);
  const pageSize = Number(unwrappedValue.pageSize ?? unwrappedValue.size ?? items.length);
  const totalItems = Number(unwrappedValue.totalItems ?? unwrappedValue.totalCount ?? unwrappedValue.count ?? items.length);
  const totalPages = Number(
    unwrappedValue.totalPages ??
    unwrappedValue.pageCount ??
    (pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1)
  );

  return {
    items,
    pageNumber: Number.isFinite(pageNumber) ? pageNumber : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : items.length,
    totalItems: Number.isFinite(totalItems) ? totalItems : items.length,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
  };
};

export const getCommunityFeed = async (params = {}, { force = false } = {}) => {
  const endpoint = buildApiEndpoint('/api/public/incidents');
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  Object.entries(normalizeFeedParams(params)).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const cacheKey = url.toString();
  const cached = communityFeedPageCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.updatedAt < COMMUNITY_FEED_PAGE_CACHE_TTL_MS) {
    return cached.payload;
  }
  if (!force && communityFeedPageRequests.has(cacheKey)) return communityFeedPageRequests.get(cacheKey);

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: getRequestHeaders(),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Bảng tin sự vụ phản hồi quá lâu. Vui lòng thử lại.', { cause: error });
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    const payload = await readPayload(response);
    if (!response.ok) throw buildRequestError(response, payload, 'Không thể tải bảng tin sự vụ.');

    const normalizedPayload = normalizePagedPayload(payload);
    communityFeedPageCache.set(cacheKey, { payload: normalizedPayload, updatedAt: Date.now() });
    return normalizedPayload;
  })().finally(() => communityFeedPageRequests.delete(cacheKey));

  communityFeedPageRequests.set(cacheKey, request);
  return request;
};

export const getCommunityFeedDetail = async (incidentId, { signal, force = false } = {}) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) throw new Error('Community incident ID is required.');

  const cachedDetail = communityDetailCache.get(normalizedIncidentId);
  if (!force && cachedDetail && Date.now() - cachedDetail.updatedAt < COMMUNITY_DETAIL_CACHE_TTL_MS) {
    return cachedDetail.detail;
  }
  if (!force && !signal && communityDetailRequests.has(normalizedIncidentId)) {
    return communityDetailRequests.get(normalizedIncidentId);
  }

  const request = (async () => {
    const endpoint = buildApiEndpoint(`/api/public/incidents/${encodeURIComponent(normalizedIncidentId)}`);
    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      headers: getRequestHeaders(),
      signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) throw buildRequestError(response, payload, 'Không thể tải chi tiết sự vụ cộng đồng.');

    const detail = unwrapData(payload);
    communityDetailCache.set(normalizedIncidentId, { detail, updatedAt: Date.now() });
    communityPreviewCache.set(normalizedIncidentId, {
      preview: normalizeCommunityPreview(detail),
      updatedAt: Date.now(),
    });
    return detail;
  })().finally(() => {
    if (!signal) communityDetailRequests.delete(normalizedIncidentId);
  });

  if (!signal) communityDetailRequests.set(normalizedIncidentId, request);
  return request;
};

export const getCommunityIncidentResolution = async (incidentId, { signal } = {}) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) return null;

  const response = await fetch(
    buildApiEndpoint(`/api/public/incidents/${encodeURIComponent(normalizedIncidentId)}/resolution`),
    { method: 'GET', credentials: 'include', headers: getRequestHeaders(), signal },
  );
  const payload = await readPayload(response);
  if (response.status === 404) return null;
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể tải kết quả xử lý của sự vụ.');
  return unwrapData(payload);
};

export const getCommunityIncidentReports = async (incidentId, { signal } = {}) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) return [];
  const response = await fetch(
    buildApiEndpoint(`/api/public/incidents/${encodeURIComponent(normalizedIncidentId)}/reports`),
    { method: 'GET', credentials: 'include', headers: getRequestHeaders(), signal },
  );
  const payload = await readPayload(response);
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể tải phản ánh liên quan.');
  const unwrapped = unwrapData(payload);
  return Array.isArray(unwrapped) ? unwrapped : [];
};

export const getCommunityIncidentTimeline = async (
  incidentId,
  { pageNumber = 1, pageSize = 20, signal } = {},
) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) return normalizePagedPayload(null);
  const endpoint = buildApiEndpoint(`/api/public/incidents/${encodeURIComponent(normalizedIncidentId)}/timeline`);
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.searchParams.set('pageNumber', String(pageNumber));
  url.searchParams.set('pageSize', String(pageSize));
  const response = await fetch(url.toString(), {
    method: 'GET', credentials: 'include', headers: getRequestHeaders(), signal,
  });
  const payload = await readPayload(response);
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể tải tiến trình sự vụ.');
  return normalizePagedPayload(payload);
};

export const setCommunityIncidentSubscription = async (incidentId, shouldSubscribe) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) throw new Error('Community incident ID is required.');
  if (!getAuthToken()) {
    const error = new Error('Bạn cần đăng nhập để theo dõi sự vụ.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    buildApiEndpoint(`/api/user/incidents/${encodeURIComponent(normalizedIncidentId)}/subscribe`),
    {
      method: shouldSubscribe ? 'POST' : 'DELETE',
      credentials: 'include',
      headers: getRequestHeaders(),
    },
  );
  const payload = await readPayload(response);
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể cập nhật trạng thái theo dõi sự vụ.');

  const responseData = unwrapData(payload) || {};
  const cached = communityDetailCache.get(normalizedIncidentId);
  const currentCount = Number(cached?.detail?.subscriberCount) || 0;
  const wasSubscribed = Boolean(cached?.detail?.isSubscribedByCurrentUser);
  const serverCount = Number(
    responseData?.subscriberCount ?? responseData?.subscribersCount ?? responseData?.count,
  );
  const serverSubscribed = [
    responseData?.isSubscribedByCurrentUser,
    responseData?.isSubscribed,
    responseData?.subscribed,
  ].find((value) => typeof value === 'boolean');
  const resolvedSubscribed = typeof serverSubscribed === 'boolean'
    ? serverSubscribed
    : shouldSubscribe;
  const nextCount = Number.isFinite(serverCount)
    ? Math.max(0, serverCount)
    : shouldSubscribe === wasSubscribed
      ? currentCount
      : Math.max(0, currentCount + (shouldSubscribe ? 1 : -1));

  if (cached?.detail) {
    communityDetailCache.set(normalizedIncidentId, {
      detail: {
        ...cached.detail,
        subscriberCount: nextCount,
        isSubscribedByCurrentUser: resolvedSubscribed,
      },
      updatedAt: Date.now(),
    });
  }

  recordCommunityIncidentEngagement(normalizedIncidentId, {
    subscriberCount: nextCount,
    isSubscribedByCurrentUser: resolvedSubscribed,
  });
  clearCommunityFeedPageCache();
  return {
    ...responseData,
    subscriberCount: nextCount,
    isSubscribedByCurrentUser: resolvedSubscribed,
  };
};


export const setCommunityIncidentSupport = async (incidentId, shouldSupport) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) throw new Error('Community incident ID is required.');
  if (!getAuthToken()) {
    const error = new Error('Bạn cần đăng nhập để đồng tình với sự vụ.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    buildApiEndpoint(`/api/user/incidents/${encodeURIComponent(normalizedIncidentId)}/support`),
    {
      method: shouldSupport ? 'POST' : 'DELETE',
      credentials: 'include',
      headers: getRequestHeaders(),
    },
  );
  const payload = await readPayload(response);
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể cập nhật lượt đồng tình cho sự vụ.');

  const responseData = unwrapData(payload) || {};
  const cached = communityDetailCache.get(normalizedIncidentId);
  const engagement = getCommunityIncidentEngagementState(normalizedIncidentId);
  const currentCount = Number(cached?.detail?.supportCount ?? engagement?.supportCount) || 0;
  const wasSupported = Boolean(
    cached?.detail?.isSupportedByCurrentUser ?? engagement?.isSupportedByCurrentUser,
  );
  const serverCount = Number(responseData?.supportCount ?? responseData?.supports ?? responseData?.count);
  const serverSupported = [
    responseData?.isSupportedByCurrentUser,
    responseData?.isSupported,
    responseData?.supported,
  ].find((value) => typeof value === 'boolean');
  const resolvedSupported = typeof serverSupported === 'boolean' ? serverSupported : shouldSupport;
  const nextCount = Number.isFinite(serverCount)
    ? Math.max(0, serverCount)
    : shouldSupport === wasSupported
      ? currentCount
      : Math.max(0, currentCount + (shouldSupport ? 1 : -1));

  if (cached?.detail) {
    communityDetailCache.set(normalizedIncidentId, {
      detail: {
        ...cached.detail,
        supportCount: nextCount,
        isSupportedByCurrentUser: resolvedSupported,
      },
      updatedAt: Date.now(),
    });
  }
  recordCommunityIncidentEngagement(normalizedIncidentId, {
    supportCount: nextCount,
    isSupportedByCurrentUser: resolvedSupported,
  });
  clearCommunityFeedPageCache();
  return {
    ...responseData,
    supportCount: nextCount,
    isSupportedByCurrentUser: resolvedSupported,
  };
};

export const getCommunityIncidentComments = async (
  incidentId,
  { pageNumber = 1, pageSize = 50, signal } = {},
) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  if (!normalizedIncidentId) return normalizePagedPayload(null);

  const endpoint = buildApiEndpoint(`/api/public/incidents/${encodeURIComponent(normalizedIncidentId)}/comments`);
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.searchParams.set('pageNumber', String(pageNumber));
  url.searchParams.set('pageSize', String(pageSize));

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
    headers: getRequestHeaders(),
    signal,
  });
  const payload = await readPayload(response);
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể tải bình luận của sự vụ.');
  return normalizePagedPayload(payload);
};

export const postCommunityIncidentComment = async (incidentId, content) => {
  const normalizedIncidentId = getCommunityCacheKey(incidentId);
  const normalizedContent = String(content || '').trim();
  if (!normalizedIncidentId) throw new Error('Community incident ID is required.');
  if (!normalizedContent) throw new Error('Nội dung bình luận không được để trống.');
  if (!getAuthToken()) {
    const error = new Error('Bạn cần đăng nhập để bình luận về sự vụ.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    buildApiEndpoint(`/api/user/incidents/${encodeURIComponent(normalizedIncidentId)}/comments`),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getRequestHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: normalizedContent }),
    },
  );
  const payload = await readPayload(response);
  if (!response.ok) throw buildRequestError(response, payload, 'Không thể gửi bình luận cho sự vụ.');

  const responseData = unwrapData(payload) || null;
  const cached = communityDetailCache.get(normalizedIncidentId);
  if (cached?.detail) {
    const currentCount = Number(cached.detail.commentCount) || 0;
    communityDetailCache.set(normalizedIncidentId, {
      detail: {
        ...cached.detail,
        commentCount: currentCount + 1,
      },
      updatedAt: Date.now(),
    });
  }
  const engagement = getCommunityIncidentEngagementState(normalizedIncidentId);
  const cachedCommentCount = Number(cached?.detail?.commentCount);
  const previousCommentCount = Number.isFinite(cachedCommentCount)
    ? cachedCommentCount
    : Number(engagement?.commentCount) || 0;
  recordCommunityIncidentEngagement(normalizedIncidentId, {
    commentCount: previousCommentCount + 1,
  });
  clearCommunityFeedPageCache();
  return responseData;
};

export const getCommunityFeedPreview = async (incidentId, { force = false } = {}) => {
  const cacheKey = getCommunityCacheKey(incidentId);
  if (!cacheKey) throw new Error('Community incident ID is required.');

  const cached = communityPreviewCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.updatedAt < COMMUNITY_PREVIEW_CACHE_TTL_MS) {
    return cached.preview;
  }
  if (!force && communityPreviewRequests.has(cacheKey)) return communityPreviewRequests.get(cacheKey);

  const request = getCommunityFeedDetail(cacheKey, { force })
    .then((detail) => {
      const preview = normalizeCommunityPreview(detail);
      communityPreviewCache.set(cacheKey, { preview, updatedAt: Date.now() });
      return preview;
    })
    .finally(() => communityPreviewRequests.delete(cacheKey));

  communityPreviewRequests.set(cacheKey, request);
  return request;
};

export const clearCommunityFeedPreviewCache = (incidentId) => {
  if (incidentId) {
    const key = getCommunityCacheKey(incidentId);
    communityPreviewCache.delete(key);
    communityPreviewRequests.delete(key);
    communityDetailCache.delete(key);
    communityDetailRequests.delete(key);
    return;
  }
  communityPreviewCache.clear();
  communityPreviewRequests.clear();
  communityDetailCache.clear();
  communityDetailRequests.clear();
};

export const clearCommunityFeedPageCache = () => {
  communityFeedPageCache.clear();
  communityFeedPageRequests.clear();
};
