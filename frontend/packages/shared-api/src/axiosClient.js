import axios from 'axios';

const DEFAULT_API_BASE_URL = 'https://api.urbanservice.me';

let apiBaseUrl = DEFAULT_API_BASE_URL;
let unauthorizedHandler = null;
let authSessionRefreshedHandler = null;
let refreshPromise = null;
let unauthorizedPromise = null;

const AUTH_TOKEN_KEY = 'urbanmind_auth_token';
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'urbanmind_refresh_token';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';

const AUTH_REQUEST_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google-login',
  '/api/auth/refresh-token',
  '/api/auth/forgot-password/send-otp',
  '/api/auth/forgot-password/reset',
  '/api/auth/phone-verification/request-otp',
  '/api/auth/phone-verification/verify',
];

const getPayload = (value) => value?.data ?? value;

const getErrorContext = (error) => {
  const response = error?.response || {};
  const status = response?.status ?? error?.status ?? null;
  const data = response?.data ?? error?.data ?? null;
  const requestUrl = response?.config?.url ?? error?.config?.url ?? null;
  return { status, data, requestUrl };
};

const redactSensitiveValues = (value) => {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (/token|refreshToken|accessToken|authorization|password|secret|cookie/i.test(key)) {
        return [key, '[REDACTED]'];
      }

      if (entryValue && typeof entryValue === 'object') {
        return [key, redactSensitiveValues(entryValue)];
      }

      return [key, entryValue];
    }),
  );
};

const sanitizeRequestData = (data) => {
  if (!data || typeof data !== 'object') return data;
  return redactSensitiveValues(data);
};

const logRequestDetails = (config) => {
  const fullUrl = `${config.baseURL || apiBaseUrl}${config.url || ''}`;
  const requestData = sanitizeRequestData(config?.data);
  console.log('[API req]', {
    method: (config?.method || 'unknown').toUpperCase(),
    url: fullUrl,
    timeout: config?.timeout || null,
    data: requestData,
  });
  // Log params separately for easier debugging of list endpoints
  try {
    if (config?.params) {
      console.log('[API req params]', { url: fullUrl, params: sanitizeRequestData(config.params) });
    }
  } catch (e) {
    /* ignore logging errors */
  }
};

const logResponseErrorDetails = (error, req = {}) => {
  const { status, data, requestUrl } = getErrorContext(error);
  const method = (req?.method || error?.config?.method || 'unknown').toUpperCase();
  const url = requestUrl || `${req.baseURL || apiBaseUrl}${req.url || ''}`;
  const requestData = sanitizeRequestData(req?.data || error?.config?.data);

  console.warn(`[API resp error] ${method} ${url} - Status: ${status} - Error: ${error?.message || ''}`);
  try {
    console.warn('[API resp error details]', JSON.stringify({
      method,
      url,
      status,
      code: error?.code || null,
      message: error?.message || null,
      statusText: error?.response?.statusText || null,
      responseData: sanitizeRequestData(data),
      requestData,
      timeout: req?.timeout || error?.config?.timeout || null,
    }, null, 2));
  } catch (logErr) {
    console.warn('[API resp error details logging failed]', logErr);
  }
};

const extractAccessToken = (value) => {
  const payload = getPayload(value);
  return (
    value?.token ||
    value?.accessToken ||
    value?.authToken ||
    payload?.token ||
    payload?.accessToken ||
    payload?.authToken ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.data?.authToken ||
    null
  );
};

const extractRefreshToken = (value) => {
  const payload = getPayload(value);
  return (
    value?.refreshToken ||
    payload?.refreshToken ||
    payload?.data?.refreshToken ||
    null
  );
};

const buildRefreshUrl = () => {
  const normalizedBaseUrl = String(apiBaseUrl || '').replace(/\/$/, '');
  return normalizedBaseUrl
    ? `${normalizedBaseUrl}/api/auth/refresh-token`
    : '/api/auth/refresh-token';
};

const shouldExpireSession = (error) => {
  const status = error?.response?.status;
  return (
    error?.code === 'REFRESH_TOKEN_MISSING' ||
    error?.code === 'INVALID_REFRESH_RESPONSE' ||
    status === 400 ||
    status === 401 ||
    status === 403
  );
};

export const extractApiErrorMessage = (error, fallbackMessage) => {
  const { status, data } = getErrorContext(error);
  const isTimeoutError =
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT' ||
    error?.message?.includes('timeout') ||
    error?.message?.includes('timed out');
  const isNetworkError =
    error?.code === 'ERR_NETWORK' ||
    error?.message?.includes('Network Error') ||
    error?.message?.includes('Network');
  const specificNetworkMessage = error?.message?.trim();
  const timeoutMessage = 'Máy chủ phản hồi quá chậm hoặc không phản hồi. Vui lòng thử lại sau ít phút.';
  const networkMessage = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.';
  const detailedNetworkPattern = /(unable to resolve|dns|certificate|econnrefused|econnreset|socket hang up|fetch failed|connection refused|host|timed out|timeout)/i;
  const serverMessage =
    data?.msg ||
    data?.message ||
    data?.error ||
    data?.title ||
    error?.response?.statusText ||
    null;

  if (serverMessage) return serverMessage;
  if (isTimeoutError) return timeoutMessage;
  if (isNetworkError) {
    if (specificNetworkMessage && detailedNetworkPattern.test(specificNetworkMessage)) {
      return specificNetworkMessage;
    }
    return networkMessage;
  }
  if (status === 401) return 'Phiên đăng nhập đã hết hạn.';
  return fallbackMessage || error?.message || 'Unknown API error';
};

const createApiError = (error, fallbackMessage) => {
  const { status } = getErrorContext(error);
  const message = extractApiErrorMessage(error, fallbackMessage);

  const apiError = new Error(message);
  apiError.status = status;
  apiError.code = error?.code;
  apiError.response = error?.response;
  apiError.cause = error;
  return apiError;
};

/**
 * Set the base URL for API requests.
 * Call this once during app initialization with the appropriate environment variable.
 */
export const setApiBaseUrl = (baseUrl) => {
  const normalizedBaseUrl = baseUrl === undefined || baseUrl === null
    ? ''
    : String(baseUrl).trim();
  apiBaseUrl = normalizedBaseUrl || DEFAULT_API_BASE_URL;
  axiosClient.defaults.baseURL = apiBaseUrl;
};

// Default token storage using localStorage (works for web).
let getToken = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  }
  return null;
};

let setToken = (token) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(LEGACY_TOKEN_KEY, token);
  }
};

let removeToken = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
};

let getRefreshToken = () => {
  if (typeof localStorage !== 'undefined') {
    return (
      localStorage.getItem(REFRESH_TOKEN_KEY) ||
      localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY)
    );
  }
  return null;
};

let setRefreshToken = (token) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    localStorage.setItem(LEGACY_REFRESH_TOKEN_KEY, token);
  }
};

let removeRefreshToken = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  }
};

/**
 * Allows the consuming app to override access-token storage.
 * Existing consumers can continue passing the original three functions.
 */
export const setTokenStorage = (getTokenFn, setTokenFn, removeTokenFn) => {
  if (typeof getTokenFn === 'function') getToken = getTokenFn;
  if (typeof setTokenFn === 'function') setToken = setTokenFn;
  if (typeof removeTokenFn === 'function') removeToken = removeTokenFn;
};

/**
 * Allows React Native or another consumer to override refresh-token storage.
 */
export const setRefreshTokenStorage = (
  getRefreshTokenFn,
  setRefreshTokenFn,
  removeRefreshTokenFn,
) => {
  if (typeof getRefreshTokenFn === 'function') getRefreshToken = getRefreshTokenFn;
  if (typeof setRefreshTokenFn === 'function') setRefreshToken = setRefreshTokenFn;
  if (typeof removeRefreshTokenFn === 'function') {
    removeRefreshToken = removeRefreshTokenFn;
  }
};

export const setAuthToken = async (token) => {
  await setToken(token);
};

export const removeAuthToken = async () => {
  await removeToken();
};

export const setAuthRefreshToken = async (token) => {
  await setRefreshToken(token);
};

export const removeAuthRefreshToken = async () => {
  await removeRefreshToken();
};

export const clearAuthTokens = async () => {
  await Promise.all([removeToken(), removeRefreshToken()]);
};

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

export const setAuthSessionRefreshedHandler = (handler) => {
  authSessionRefreshedHandler = typeof handler === 'function' ? handler : null;
};

/**
 * Refreshes the access token once and shares that promise between concurrent 401 responses.
 * The backend rotates refresh tokens, so the returned refresh token is persisted immediately.
 */
export const refreshAuthSession = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const currentRefreshToken = await getRefreshToken();
    if (!currentRefreshToken) {
      const missingTokenError = new Error('Không tìm thấy refresh token.');
      missingTokenError.code = 'REFRESH_TOKEN_MISSING';
      throw missingTokenError;
    }

    const response = await axios.post(
      buildRefreshUrl(),
      { refreshToken: currentRefreshToken },
      {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const accessToken = extractAccessToken(response);
    const rotatedRefreshToken = extractRefreshToken(response);

    if (!accessToken) {
      const invalidResponseError = new Error(
        'Máy chủ không trả về access token mới.',
      );
      invalidResponseError.code = 'INVALID_REFRESH_RESPONSE';
      throw invalidResponseError;
    }

    await setToken(accessToken);

    if (rotatedRefreshToken) {
      await setRefreshToken(rotatedRefreshToken);
    }

    await authSessionRefreshedHandler?.(response?.data);

    return {
      accessToken,
      refreshToken: rotatedRefreshToken || currentRefreshToken,
      data: response?.data,
    };
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

const notifyUnauthorized = async (error) => {
  if (unauthorizedPromise) return unauthorizedPromise;

  unauthorizedPromise = (async () => {
    await clearAuthTokens();
    await unauthorizedHandler?.(error);
  })().finally(() => {
    setTimeout(() => {
      unauthorizedPromise = null;
    }, 500);
  });

  return unauthorizedPromise;
};

export const axiosClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use(
  async (config) => {
    try {
      logRequestDetails(config);
    } catch (e) {
      /* ignore logging errors */
    }
    const token = await getToken();
    if (config.headers) {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }

      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosClient.interceptors.response.use(
  (response) => {
    try {
      console.log('[API resp success]', {
        url: response?.config?.url || null,
        status: response?.status || null,
      });
    } catch (e) {
      /* ignore logging errors */
    }
    return response.data;
  },
  async (error) => {
    try {
      const req = error?.config || {};
      const { status } = getErrorContext(error);
      // Silence expected 404 responses (resource not found) at warn level
      if (status === 404) {
        console.debug('[API resp error]', { url: `${req.baseURL || apiBaseUrl}${req.url || ''}`, status, data: getErrorContext(error).data });
      } else {
        logResponseErrorDetails(error, req);
      }
    } catch (e) {
      /* ignore logging errors */
    }
    const { status } = getErrorContext(error);
    const originalRequest = error?.config;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthRequest = AUTH_REQUEST_PATHS.some((path) => requestUrl.includes(path));

    if (status === 401 && !isAuthRequest && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { accessToken } = await refreshAuthSession();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        if (shouldExpireSession(refreshError)) {
          await notifyUnauthorized(refreshError);
          return Promise.reject(
            createApiError(refreshError, 'Phiên đăng nhập đã hết hạn.'),
          );
        }

        return Promise.reject(
          createApiError(
            refreshError,
            'Không thể gia hạn phiên đăng nhập. Vui lòng kiểm tra kết nối và thử lại.',
          ),
        );
      }
    }

    if (status === 401 && !isAuthRequest && originalRequest?._retry) {
      await notifyUnauthorized(error);
    }

    return Promise.reject(createApiError(error));
  },
);
