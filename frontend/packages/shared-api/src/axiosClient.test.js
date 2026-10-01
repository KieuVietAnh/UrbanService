import test from 'node:test';
import assert from 'node:assert/strict';
import { axiosClient, extractApiErrorMessage, setApiBaseUrl } from './axiosClient.js';

test('prefers the backend message over the timeout fallback', () => {
  const error = {
    code: 'ECONNABORTED',
    message: 'timeout of 15000ms exceeded',
    response: {
      status: 400,
      data: {
        msg: 'Email hoặc mật khẩu không đúng',
      },
    },
  };

  assert.equal(
    extractApiErrorMessage(error, 'Máy chủ không phản hồi kịp thời. Vui lòng kiểm tra mạng và thử lại.'),
    'Email hoặc mật khẩu không đúng',
  );
});

test('uses a longer timeout for API requests to avoid premature auth failures', () => {
  assert.equal(axiosClient.defaults.timeout, 60000);
});

test('returns a clear timeout fallback message when the request times out', () => {
  const error = {
    code: 'ECONNABORTED',
    message: 'timeout of 30000ms exceeded',
  };

  assert.equal(
    extractApiErrorMessage(error, 'Đăng nhập thất bại'),
    'Máy chủ phản hồi quá chậm hoặc không phản hồi. Vui lòng thử lại sau ít phút.',
  );
});

test('returns a clear network error message for connection failures', () => {
  const error = {
    code: 'ERR_NETWORK',
    message: 'Network Error',
  };

  assert.equal(
    extractApiErrorMessage(error, 'Máy chủ không phản hồi kịp thời. Vui lòng kiểm tra mạng và thử lại.'),
    'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.',
  );
});

test('falls back to the default API host when no base URL has been initialized', () => {
  const previousEnv = process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_API_URL;

  setApiBaseUrl('');
  assert.equal(axiosClient.defaults.baseURL, 'https://api.urbanservice.me');

  if (previousEnv === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = previousEnv;
  }
});

test('preserves specific network error details when available', () => {
  const error = {
    code: 'ERR_NETWORK',
    message: 'Unable to resolve host: api.urbanservice.me',
  };

  assert.equal(
    extractApiErrorMessage(error, 'Đăng nhập thất bại'),
    'Unable to resolve host: api.urbanservice.me',
  );
});
