import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AsyncStorageService } from '@/services/storage/asyncStorage';
import { AuthService } from './auth.service';
import type { User } from '@/types';
import { extractApiErrorMessage } from '@urbanmind/shared-api';
import { queryClient } from '@/config/query-client';

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  // Actions
  login: (email: string, password: string) => Promise<User>;
  googleLogin: (idToken: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  requestPhoneOtp: (phoneNumber: string) => Promise<{
    phoneNumber: string;
    remainingToday: number | null;
    isTestNumber: boolean;
  }>;
  verifyPhoneOtp: (otp: string) => Promise<User>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

type ApiErrorDetails = Error & {
  code?: unknown;
  status?: unknown;
};

const withRequestTimeout = <T>(request: Promise<T>, timeoutMs = 60000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(`timeout of ${timeoutMs}ms exceeded`);
      (timeoutError as Error & { code?: string }).code = 'ECONNABORTED';
      if (__DEV__) {
        console.warn('[Auth request timeout]', { timeoutMs });
      }
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([
    request.then(
      (value) => {
        if (timeoutId) clearTimeout(timeoutId);
        return value;
      },
      (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
      },
    ),
    timeoutPromise,
  ]);
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isLoading: false,
        error: null,
        hasHydrated: false,

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const user = await withRequestTimeout(AuthService.login(email, password));
            set({ user, isLoading: false });
            return user;
          } catch (err: unknown) {
            const msg = extractApiErrorMessage(err, 'Đăng nhập thất bại');
            const details = err as ApiErrorDetails;
            if (__DEV__) {
              console.error('[Auth login failed]', {
                code: details?.code || null,
                message: details?.message || null,
                status: details?.status || null,
              });
            }
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          } finally {
            set({ isLoading: false });
          }
        },

        googleLogin: async (idToken: string) => {
          set({ isLoading: true, error: null });
          try {
            const user = await withRequestTimeout(AuthService.googleLogin(idToken));
            set({ user, isLoading: false });
            return user;
          } catch (err: unknown) {
            const msg = extractApiErrorMessage(err, 'Đăng nhập bằng Google thất bại');
            const details = err as ApiErrorDetails;
            if (__DEV__) {
              console.error('[Auth googleLogin failed]', {
                code: details?.code || null,
                message: details?.message || null,
                status: details?.status || null,
              });
            }
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          } finally {
            set({ isLoading: false });
          }
        },

        register: async (data: RegisterData) => {
          set({ isLoading: true, error: null });
          try {
            const user = await withRequestTimeout(AuthService.register(data));
            set({ user, isLoading: false });
            return user;
          } catch (err: unknown) {
            const msg = extractApiErrorMessage(err, 'Đăng ký thất bại');
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          } finally {
            set({ isLoading: false });
          }
        },

        requestPhoneOtp: async (phoneNumber: string) => {
          set({ isLoading: true, error: null });
          try {
            const result = await withRequestTimeout(AuthService.requestPhoneOtp(phoneNumber));
            set({ isLoading: false });
            return result;
          } catch (err: unknown) {
            const msg = extractApiErrorMessage(err);
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          } finally {
            set({ isLoading: false });
          }
        },

        verifyPhoneOtp: async (otp: string) => {
          set({ isLoading: true, error: null });
          try {
            const requestUser = get().user;
            if (!requestUser) throw new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
            const verifiedUser = await withRequestTimeout(AuthService.verifyPhoneOtp(otp));
            if (!verifiedUser.id || verifiedUser.id !== requestUser.id) {
              throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng xác thực lại bằng tài khoản hiện tại.');
            }
            set({ user: verifiedUser, isLoading: false });
            return verifiedUser;
          } catch (err: unknown) {
            const msg = extractApiErrorMessage(err);
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          } finally {
            set({ isLoading: false });
          }
        },

        logout: async () => {
          try {
            await AuthService.logout();
          } catch {
            /* silent */
          }
          queryClient.clear();
          set({ user: null, error: null });
        },

        clearError: () => set({ error: null }),

        setUser: (user: User | null) => set({ user }),
      }),
      {
        name: 'urbanmind-auth',
        storage: {
          getItem: (key) =>
            AsyncStorageService.getItem<string>(key).then((v) => (v ? JSON.parse(v) : null)),
          setItem: (key, value) =>
            AsyncStorageService.setItem<string>(key, JSON.stringify(value)),
          removeItem: (key) => AsyncStorageService.removeItem(key),
        },
        partialize: (state) => ({
          user: state.user ? { ...state.user, token: '' } : null,
        }) as AuthState,
        onRehydrateStorage: () => () => {
          useAuthStore.setState({ hasHydrated: true });
        },
      }
    )
  )
);
