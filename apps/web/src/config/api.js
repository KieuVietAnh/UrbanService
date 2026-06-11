import axios from 'axios';
import { tokenStorage } from '../services/storage/tokenStorage';

export const API_URL = import.meta.env.VITE_API_URL;
export const API_BASE_URL = API_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token && config?.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response?.data,
  (error) => {
    const errData = error.response?.data;
    if (error.response?.status === 401) {
      tokenStorage.clear();
      window.location.href = '/login';
    }

    if (errData) {
      throw new Error(errData.msg || errData.message || errData.error || 'Lỗi từ máy chủ');
    }

    if (error.message === 'Network Error' || !error.response) {
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
    }

    throw new Error(error.message || 'Lỗi không xác định');
  }
);
