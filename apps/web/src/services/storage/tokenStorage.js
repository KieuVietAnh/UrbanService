// src/services/storage/tokenStorage.js

const KEY_TOKEN = 'token';
const KEY_LEGACY_TOKEN = 'urbanmind_auth_token';
const KEY_USER_DATA = 'urbanmind_auth_user';

export const tokenStorage = {
  getToken() {
    return localStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_LEGACY_TOKEN);
  },
  setToken(token) {
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_LEGACY_TOKEN, token);
  },
  getUser() {
    const userStr = localStorage.getItem(KEY_USER_DATA);
    return userStr ? JSON.parse(userStr) : null;
  },
  setUser(user) {
    localStorage.setItem(KEY_USER_DATA, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_LEGACY_TOKEN);
    localStorage.removeItem(KEY_USER_DATA);
  }
};
