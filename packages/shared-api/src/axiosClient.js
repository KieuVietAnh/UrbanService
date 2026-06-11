import axios from 'axios';

const getEnvValue = (name) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }

  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }

  return null;
};

const getBaseUrl = () => {
  return getEnvValue('VITE_API_URL') || getEnvValue('EXPO_PUBLIC_API_URL') || getEnvValue('API_URL') || '';
};

const AUTH_TOKEN_KEY = 'urbanmind_auth_token';

const getToken = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem('token');
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem('token');
  }

  return null;
};

export const axiosClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const data = error?.response?.data;
    const message =
      data?.msg ||
      data?.message ||
      data?.error ||
      error?.message ||
      'Unknown API error';
    return Promise.reject(new Error(message));
  }
);
