// src/services/api/authApi.js
import { tokenStorage } from '../storage/tokenStorage';
import { getInternalRole } from '../../utils/roleMap';
import { authApi as sharedAuthApi } from '@urbanmind/shared-api';

const normalizeRole = (role) => getInternalRole(role);

const saveUserSession = (response) => {
  const payload = response?.data ?? response;
  const userPayload = response?.user ?? response?.data?.user ?? payload;
  const token = response?.token ?? payload?.token;
  const normalizedRole = normalizeRole(userPayload?.role);

  const sessionUser = {
    userId: userPayload?.userId ?? userPayload?.id,
    email: userPayload?.email,
    fullName: userPayload?.fullName,
    role: normalizedRole,
    isVerified: userPayload?.isVerified === true || userPayload?.isVerified === 'true',
  };

  console.log('authApi saveUserSession', { response, payload, userPayload, sessionUser });

  if (token) {
    tokenStorage.setToken(token);
  }

  tokenStorage.setUser(sessionUser);
  return {
    token,
    user: sessionUser,
  };
};

export const authApi = {
  async login(email, password) {
    const response = await sharedAuthApi.login(email, password);
    return saveUserSession(response);
  },

  async register(fullName, email, password, phone) {
    const response = await sharedAuthApi.register(fullName, email, password, phone);
    return saveUserSession(response);
  },

  async googleLogin(idToken) {
    const response = await sharedAuthApi.googleLogin(idToken);
    return saveUserSession(response);
  },

  async sendOTP() {
    await sharedAuthApi.sendOtp();
    return { success: true };
  },

  async verifyOTP(otp) {
    const response = await sharedAuthApi.verifyOtp(otp);
    const payload = response?.data ?? response;
    const existingUser = tokenStorage.getUser();
    const updatedUser = payload?.user ?? existingUser;

    if (updatedUser) {
      updatedUser.role = getInternalRole(updatedUser.role);
      updatedUser.isVerified = true;
      tokenStorage.setUser(updatedUser);
    }

    console.log('authApi verifyOTP success', { response, payload, updatedUser });

    return { success: true, user: updatedUser };
  },

  async logout() {
    tokenStorage.clear();
    await sharedAuthApi.logout();
    return { success: true };
  },

  async getCurrentUser() {
    return tokenStorage.getUser();
  },
};
