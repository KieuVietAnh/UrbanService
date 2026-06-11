// src/services/api/authApi.js
import { apiClient } from './apiClient';
import { tokenStorage } from '../storage/tokenStorage';

const normalizeRole = (role) => {
  if (!role) return role;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'serviceuser' || normalized === 'service-user') return 'service-user';
  if (normalized === 'systemstaff' || normalized === 'system-staff') return 'system-staff';
  if (normalized === 'serviceprovider' || normalized === 'service-provider') return 'service-provider';
  if (normalized === 'interactionmanager' || normalized === 'interaction-manager') return 'interaction-manager';
  if (normalized === 'systemadmin' || normalized === 'admin' || normalized === 'administrator') return 'administrator';
  return normalized;
};

const saveUserSession = (response) => {
  const token = response.token || response.data?.token;
  const user = response.user || response.data || {};
  const normalizedRole = normalizeRole(user.role);

  if (token) {
    tokenStorage.setToken(token);
  }

  const sessionUser = {
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    role: normalizedRole,
    isVerified: user.isVerified,
  };

  tokenStorage.setUser(sessionUser);
  return {
    token,
    user: sessionUser,
  };
};

export const authApi = {
  async login(email, password) {
    const response = await apiClient.post('/api/auth/login', { email, password });
    return saveUserSession(response);
  },

  async register(fullName, email, password, phone) {
    const response = await apiClient.post('/api/auth/register', {
      fullName,
      email,
      password,
      phone,
    });
    return saveUserSession(response);
  },

  async googleLogin(idToken) {
    const response = await apiClient.post('/api/auth/google-login', { idToken });
    return saveUserSession(response);
  },

  async sendOTP() {
    await apiClient.post('/api/auth/email-verification/send-otp');
    return { success: true };
  },

  async verifyOTP(otp) {
    await apiClient.post('/api/auth/email-verification/verify', { otp });

    const user = tokenStorage.getUser();
    if (user) {
      user.isVerified = true;
      tokenStorage.setUser(user);
    }

    return { success: true };
  },

  async logout() {
    tokenStorage.clear();
    await apiClient.post('/api/auth/logout');
    return { success: true };
  },

  async getCurrentUser() {
    return tokenStorage.getUser();
  },
};
