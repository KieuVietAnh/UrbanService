// src/services/storage/tokenStorage.js

const KEY_TOKEN = 'token';
const KEY_LEGACY_TOKEN = 'urbanmind_auth_token';
const KEY_REFRESH_TOKEN = 'urbanmind_refresh_token';
const KEY_LEGACY_REFRESH_TOKEN = 'refreshToken';
const KEY_USER_DATA = 'urbanmind_auth_user';

export const tokenStorage = {
  getToken() {
    return localStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_LEGACY_TOKEN);
  },

  setToken(token) {
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_LEGACY_TOKEN, token);
  },

  removeToken() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_LEGACY_TOKEN);
  },

  getRefreshToken() {
    return (
      localStorage.getItem(KEY_REFRESH_TOKEN) ||
      localStorage.getItem(KEY_LEGACY_REFRESH_TOKEN)
    );
  },

  setRefreshToken(token) {
    localStorage.setItem(KEY_REFRESH_TOKEN, token);
    localStorage.setItem(KEY_LEGACY_REFRESH_TOKEN, token);
  },

  removeRefreshToken() {
    localStorage.removeItem(KEY_REFRESH_TOKEN);
    localStorage.removeItem(KEY_LEGACY_REFRESH_TOKEN);
  },

  getUser() {
    const userStr = localStorage.getItem(KEY_USER_DATA);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      localStorage.removeItem(KEY_USER_DATA);
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem(KEY_USER_DATA, JSON.stringify(user));
  },

  clear() {
    this.removeToken();
    this.removeRefreshToken();
    localStorage.removeItem(KEY_USER_DATA);
  },
};
