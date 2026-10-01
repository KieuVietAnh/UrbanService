import {
  authApi,
  normalizePhone,
  setAuthToken,
  setAuthRefreshToken,
  clearAuthTokens,
} from '@urbanmind/shared-api';
import { getInternalRole } from '@urbanmind/shared-types';
import type { User } from '@/types';
import {
  assertFirebasePhoneAuthAvailable,
  clearFirebasePhoneSession,
  confirmFirebasePhoneOtp,
  sendFirebasePhoneOtp,
} from './firebase-phone.service';

type ApiRecord = Record<string, unknown>;

const isApiRecord = (value: unknown): value is ApiRecord =>
  typeof value === 'object' && value !== null;

const extractData = (response: unknown): unknown => {
  if (typeof response === 'string') {
    if (response.includes('<!DOCTYPE html>') || response.includes('<html')) {
      throw new Error('Không thể kết nối đến máy chủ API (phản hồi trang HTML 404/500). Vui lòng kiểm tra cấu hình EXPO_PUBLIC_API_URL.');
    }
    try {
      return JSON.parse(response);
    } catch {
      throw new Error('Máy chủ phản hồi định dạng dữ liệu không hợp lệ.');
    }
  }

  if (isApiRecord(response)) {
    if (isApiRecord(response.data)) {
      return response.data;
    }
    return response;
  }

  return response;
};

const buildUser = (rawResponse: unknown): User => {
  const extracted = extractData(rawResponse);
  const data = isApiRecord(extracted) ? extracted : {};
  const userPayload = isApiRecord(data.user) ? data.user : data;
  const token =
    data.token ||
    data.accessToken ||
    data.authToken ||
    data.access_token ||
    userPayload.token ||
    userPayload.accessToken ||
    userPayload.authToken ||
    userPayload.access_token;

  return {
    id: (userPayload.userId ?? userPayload.id ?? data.userId ?? data.id ?? '') as string,
    email: (userPayload.email ?? data.email ?? '') as string,
    role: getInternalRole((userPayload.role ?? data.role ?? 'service-user') as string),
    token: (token || '') as string,
    fullName: (userPayload.name ?? userPayload.fullName ?? data.name ?? data.fullName ?? '') as string,
    isVerified: Boolean(userPayload.isVerified ?? data.isVerified ?? false),
    phone: (userPayload.phoneNumber ?? userPayload.phone ?? data.phoneNumber ?? data.phone ?? '') as string,
    avatarUrl: (userPayload.avatarUrl ?? data.avatarUrl ?? null) as string | null,
  };
};

const persistAuthenticatedSession = async (response: unknown, user: User): Promise<User> => {
  const refreshToken = extractRefreshToken(response);
  if (!user.token || !refreshToken) {
    await clearAuthTokens();
    throw new Error('Máy chủ không trả về phiên đăng nhập hợp lệ. Vui lòng thử lại.');
  }

  try {
    await Promise.all([
      setAuthToken(user.token),
      setAuthRefreshToken(refreshToken),
    ]);
  } catch (error) {
    await clearAuthTokens();
    throw error;
  }

  return user;
};

export const mergeRefreshedAuthUser = (currentUser: User, response: unknown): User => {
  const refreshedUser = buildUser(response);
  if (!refreshedUser.id || refreshedUser.id !== currentUser.id || !refreshedUser.token) {
    throw new Error('Phiên làm mới không khớp với tài khoản hiện tại.');
  }
  return {
    ...currentUser,
    id: refreshedUser.id,
    email: refreshedUser.email || currentUser.email,
    fullName: refreshedUser.fullName || currentUser.fullName,
    role: refreshedUser.role,
    isVerified: refreshedUser.isVerified,
    token: refreshedUser.token,
  };
};

const extractRefreshToken = (response: unknown): string | null => {
  if (typeof response === 'string') {
    try {
      response = JSON.parse(response);
    } catch {
      return null;
    }
  }

  const data = isApiRecord(response)
    ? (isApiRecord(response.data) ? response.data : response)
    : {};

  return (data.refreshToken || data.refresh_token || null) as string | null;
};

export class AuthService {
  static async login(email: string, password: string): Promise<User> {
    const response = await authApi.login(email, password);
    const user = buildUser(response);
    return persistAuthenticatedSession(response, user);
  }

  static async register(payload: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
  }): Promise<User> {
    const response = await authApi.register(
      payload.fullName.trim(),
      payload.email.trim(),
      payload.password,
      payload.phone.trim()
    );
    const user = buildUser(response);
    return persistAuthenticatedSession(response, user);
  }

  static async googleLogin(idToken: string): Promise<User> {
    const response = await authApi.googleLogin(idToken);
    const user = buildUser(response);
    return persistAuthenticatedSession(response, user);
  }

  static async requestPhoneOtp(phoneNumber: string): Promise<{
    phoneNumber: string;
    remainingToday: number | null;
    isTestNumber: boolean;
  }> {
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      throw new Error('Số điện thoại chưa hợp lệ. Vui lòng nhập 10 chữ số, ví dụ 0901 234 567.');
    }

    await assertFirebasePhoneAuthAvailable();
    const response = await authApi.requestPhoneOtp(normalized);
    const extracted = extractData(response);
    const payload = isApiRecord(extracted) ? extracted : {};
    const approvedPhone = String(payload.phoneNumber || normalized);

    await sendFirebasePhoneOtp(approvedPhone);
    return {
      phoneNumber: approvedPhone,
      remainingToday: typeof payload.remainingToday === 'number' ? payload.remainingToday : null,
      isTestNumber: payload.isTestNumber === true,
    };
  }

  static async verifyPhoneOtp(otp: string): Promise<User> {
    const idToken = await confirmFirebasePhoneOtp(otp);
    const response = await authApi.verifyPhone(idToken);
    const user = buildUser(response);
    const authenticatedUser = await persistAuthenticatedSession(response, user);
    clearFirebasePhoneSession();
    return authenticatedUser;
  }

  static async logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      /* silent */
    }

    await clearAuthTokens();
    clearFirebasePhoneSession();
  }
}
