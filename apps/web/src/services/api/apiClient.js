// src/services/api/apiClient.js
import axiosClient from '../../api/axiosClient';

export const apiClient = axiosClient;

const originalRequest = axiosClient.request.bind(axiosClient);

apiClient.request = (action) => {
  if (typeof action === 'function') {
    return new Promise((resolve, reject) => {
      try {
        resolve(action());
      } catch (error) {
        reject(error);
      }
    });
  }

  return originalRequest(action);
};

export default apiClient;
