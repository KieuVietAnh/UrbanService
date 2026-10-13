// src/services/api/authApi.js
import { tokenStorage } from '../storage/tokenStorage';
import { getInternalRole } from '../../utils/roleMap';
import { authApi as sharedAuthApi } from '@urbanmind/shared-api';

const normalizeRole = (role) => getInternalRole(role);

const extractToken = (response) => {
  const payload = response?.data ?? response;
  return (
    response?.token ||
    response?.accessToken ||
    response?.authToken ||
    payload?.token ||
    payload?.accessToken ||
    payload?.authToken ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.data?.authToken ||
    null
  );
};

const extractRefreshToken = (response) => {
  const payload = response?.data ?? response;
  return (
    response?.refreshToken ||
    payload?.refreshToken ||
    payload?.data?.refreshToken ||
    null
  );
};

const saveUserSession = (response) => {
  const payload = response?.data ?? response;
  const userPayload = response?.user ?? response?.data?.user ?? payload;
  const token = extractToken(response);
  const refreshToken = extractRefreshToken(response);
  // Mã nghiệp vụ backend trả kèm, ví dụ EMAIL_NOT_VERIFIED. Client dùng để rẽ nhánh
  // giao diện; không dùng để đoán role nữa vì backend đã trả role thật, mà đoán
  // SERVICEUSER thì sẽ dựng nhầm menu người dân cho một tài khoản staff.
  const responseCode = response?.code ?? payload?.code ?? null;
  const normalizedRole = normalizeRole(userPayload?.role);

  const sessionUser = {
    userId: userPayload?.userId ?? userPayload?.id,
    email: userPayload?.email,
    fullName: userPayload?.fullName,
    // Màn xác thực điền sẵn số này. Không lưu lại thì ô số luôn trống, người dùng
    // phải gõ lại chính số họ vừa đăng ký.
    phoneNumber: userPayload?.phoneNumber ?? null,
    role: normalizedRole,
    isVerified: userPayload?.isVerified === true || userPayload?.isVerified === 'true',
  };

  if (token) tokenStorage.setToken(token);

  if (refreshToken) {
    tokenStorage.setRefreshToken(refreshToken);
  } else {
    tokenStorage.removeRefreshToken();
  }

  tokenStorage.setUser(sessionUser);

  return {
    token,
    refreshToken,
    user: sessionUser,
    code: responseCode,
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

  async requestForgotPasswordOtp(email) {
    await sharedAuthApi.sendForgotPasswordOtp(email);
    return { success: true };
  },

  async verifyForgotPasswordOtp(email, otp) {
    await sharedAuthApi.verifyForgotPasswordOtp(email, otp);
    return { success: true };
  },

  async resetForgottenPassword(email, otp, newPassword) {
    await sharedAuthApi.resetForgottenPassword(email, otp, newPassword);
    return { success: true };
  },

  async requestEmailVerificationOtp() {
    await sharedAuthApi.sendEmailVerificationOtp();
    return { success: true };
  },

  async verifyEmail(otp) {
    const response = await sharedAuthApi.verifyEmail(otp);
    return saveUserSession(response);
  },

  async logout() {
    tokenStorage.clear();
    try {
      await sharedAuthApi.logout();
    } catch (err) {
      console.warn('authApi.logout: logout request failed, cleared local session anyway', err);
    }
    return { success: true };
  },

  async getCurrentUser() {
    return tokenStorage.getUser();
  },
};
