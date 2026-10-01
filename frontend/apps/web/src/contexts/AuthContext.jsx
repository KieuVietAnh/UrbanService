// src/contexts/AuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authApi } from '../services/api/authApi';
import { tokenStorage } from '../services/storage/tokenStorage';
import { getInternalRole } from '../utils/roleMap';
import {
  axiosClient,
  refreshAuthSession,
  setUnauthorizedHandler,
} from '@urbanmind/shared-api';
import { SessionExpiredDialog } from '../components/auth/SessionExpiredDialog';

const AuthContext = createContext(null);
const REFRESH_EARLY_MS = 60 * 1000;
const PENDING_ACCOUNT_UPDATE_PATH = '/api/auth/pending-account';

const normalizeRole = (role) => getInternalRole(role);

const shouldExpireSession = (error) => {
  const status = error?.status ?? error?.response?.status;
  return (
    error?.code === 'REFRESH_TOKEN_MISSING' ||
    error?.code === 'INVALID_REFRESH_RESPONSE' ||
    status === 400 ||
    status === 401 ||
    status === 403
  );
};

const getJwtExpiresAt = (token) => {
  if (!token || typeof token !== 'string' || typeof atob !== 'function') return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded));
    return Number.isFinite(decoded?.exp) ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const initializeSession = () => {
  const savedUser = tokenStorage.getUser();
  const accessToken = tokenStorage.getToken();
  const refreshToken = tokenStorage.getRefreshToken();

  if (!savedUser) {
    tokenStorage.clear();
    return { user: null, needsRefresh: false };
  }

  const normalizedUser = {
    ...savedUser,
    role: normalizeRole(savedUser.role),
  };

  const expiresAt = getJwtExpiresAt(accessToken);
  const accessTokenExpired = !accessToken || (expiresAt && expiresAt <= Date.now());

  return {
    user: normalizedUser,
    needsRefresh: Boolean(accessTokenExpired || (!accessToken && refreshToken)),
  };
};

export const AuthProvider = ({ children }) => {
  const [initialSession] = useState(initializeSession);
  const [user, setUser] = useState(initialSession.user);
  const [loading, setLoading] = useState(initialSession.needsRefresh);
  const [tokenRevision, setTokenRevision] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionRedirect, setSessionRedirect] = useState('/dashboard');

  const showSessionExpired = useCallback(() => {
    tokenStorage.removeToken();
    tokenStorage.removeRefreshToken();
    setLoading(false);

    if (typeof window === 'undefined') return;

    const savedUser = user || tokenStorage.getUser();
    if (!savedUser || window.location.pathname.startsWith('/login')) {
      tokenStorage.clear();
      setUser(null);
      return;
    }

    const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setSessionRedirect(redirect || '/dashboard');
    setSessionExpired(true);
  }, [user]);

  const handleLoginAgain = useCallback(() => {
    tokenStorage.clear();
    setSessionExpired(false);

    if (typeof window === 'undefined') return;

    const params = new URLSearchParams({
      reason: 'session-expired',
      redirect: sessionRedirect || '/dashboard',
    });
    window.location.replace(`/login?${params.toString()}`);
  }, [sessionRedirect]);

  useEffect(() => {
    setUnauthorizedHandler(showSessionExpired);
    return () => setUnauthorizedHandler(null);
  }, [showSessionExpired]);

  useEffect(() => {
    if (!initialSession.needsRefresh || !initialSession.user) return undefined;

    let active = true;

    const restoreSession = async () => {
      try {
        await refreshAuthSession();
        if (!active) return;
        setTokenRevision((current) => current + 1);
        setLoading(false);
      } catch (error) {
        if (!active) return;

        setLoading(false);
        if (shouldExpireSession(error)) {
          showSessionExpired();
        }
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, [initialSession, showSessionExpired]);

  useEffect(() => {
    if (!user || sessionExpired || typeof window === 'undefined') return undefined;

    const expiresAt = getJwtExpiresAt(tokenStorage.getToken());
    if (!expiresAt) return undefined;

    const delay = Math.max(expiresAt - Date.now() - REFRESH_EARLY_MS, 0);
    const timer = window.setTimeout(async () => {
      try {
        await refreshAuthSession();
        setTokenRevision((current) => current + 1);
      } catch (error) {
        if (shouldExpireSession(error)) {
          showSessionExpired();
          return;
        }

        window.setTimeout(() => {
          setTokenRevision((current) => current + 1);
        }, 15000);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [sessionExpired, showSessionExpired, tokenRevision, user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const updatedUser = {
        ...res.user,
        role: normalizeRole(res.user.role),
      };
      setSessionExpired(false);
      setTokenRevision((current) => current + 1);
      setUser(updatedUser);
      return { ...updatedUser, authCode: res?.code || null };
    } finally {
      setLoading(false);
    }
  };

  const register = async (fullName, email, password, phone) => {
    setLoading(true);
    try {
      const res = await authApi.register(fullName, email, password, phone);
      const updatedUser = {
        ...res.user,
        role: normalizeRole(res.user.role),
      };
      setSessionExpired(false);
      setTokenRevision((current) => current + 1);
      setUser(updatedUser);
      return updatedUser;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gửi Firebase ID token lên backend để đánh dấu tài khoản đã xác thực số điện
   * thoại. Backend trả JWT mới vì trạng thái xác thực nằm trong claim của token.
   */
  const verifyPhone = async (idToken) => {
    setLoading(true);
    try {
      const result = await authApi.verifyPhone(idToken);
      const updatedUser = result?.user || tokenStorage.getUser();
      if (updatedUser) {
        setTokenRevision((current) => current + 1);
        setUser({
          ...updatedUser,
          role: normalizeRole(updatedUser.role),
          isVerified: true,
        });
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (idToken) => {
    setLoading(true);
    try {
      const res = await authApi.googleLogin(idToken);
      const updatedUser = {
        ...res.user,
        role: normalizeRole(res.user.role),
      };
      setSessionExpired(false);
      setTokenRevision((current) => current + 1);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.warn('AuthContext.googleLogin error', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /** Xin phép gửi SMS OTP; bỏ trống phoneNumber để dùng số đã lưu trên tài khoản. */
  const requestPhoneOtp = async (phoneNumber) => {
    setLoading(true);
    try {
      return await authApi.requestPhoneOtp(phoneNumber);
    } finally {
      setLoading(false);
    }
  };

  const updatePendingRegistration = async ({
    fullName,
    email,
    phoneNumber,
    newPassword,
  }) => {
    setLoading(true);
    try {
      const response = await axiosClient.patch(PENDING_ACCOUNT_UPDATE_PATH, {
        fullName,
        email,
        phoneNumber,
        ...(newPassword ? { newPassword } : {}),
      });
      const payload = response?.data ?? response;
      const responseUser = payload?.user ?? payload;
      const accessToken = (
        response?.accessToken ||
        response?.token ||
        payload?.accessToken ||
        payload?.token ||
        payload?.data?.accessToken ||
        payload?.data?.token
      );
      const refreshToken = (
        response?.refreshToken ||
        payload?.refreshToken ||
        payload?.data?.refreshToken
      );

      if (accessToken) tokenStorage.setToken(accessToken);
      if (refreshToken) tokenStorage.setRefreshToken(refreshToken);

      const updatedUser = {
        ...user,
        fullName: responseUser?.fullName ?? fullName,
        email: responseUser?.email ?? email,
        phoneNumber: responseUser?.phoneNumber ?? phoneNumber,
        role: normalizeRole(responseUser?.roleName ?? responseUser?.role ?? user?.role),
        isVerified: responseUser?.isVerified ?? user?.isVerified ?? false,
      };

      tokenStorage.setUser(updatedUser);
      setTokenRevision((current) => current + 1);
      setUser(updatedUser);
      return updatedUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setSessionExpired(false);
    setUser(null);
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('AuthContext.logout: error during logout', err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyPhone,
    googleLogin,
    requestPhoneOtp,
    updatePendingRegistration,
    logout,
    isAuthenticated: Boolean(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredDialog
        open={sessionExpired}
        onLoginAgain={handleLoginAgain}
      />
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
