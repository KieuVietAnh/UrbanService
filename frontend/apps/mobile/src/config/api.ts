import Constants from 'expo-constants';
import {
  setApiBaseUrl,
  setAuthSessionRefreshedHandler,
  clearAuthTokens,
  setUnauthorizedHandler,
  setTokenStorage,
  setRefreshTokenStorage,
} from '@urbanmind/shared-api';
import { AsyncStorageService } from '@/services/storage/asyncStorage';
import { queryClient } from '@/config/query-client';
import { useAuthStore } from '@/features/auth/auth.store';
import { mergeRefreshedAuthUser } from '@/features/auth/auth.service';

let isInitialized = false;

// Shared Backend Target API URL (matching web app target https://api.urbanservice.me)
export const DEFAULT_API_URL = 'https://api.urbanservice.me';

export const getEffectiveApiUrl = () => {
  const configuredTargetUrl = String(
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
    ''
  ).trim();
  return configuredTargetUrl || DEFAULT_API_URL;
};

export const initApi = () => {
  if (isInitialized) return;

  const apiUrl = getEffectiveApiUrl();
  setApiBaseUrl(apiUrl);

  setTokenStorage(
    async () => {
      return await AsyncStorageService.getItem<string>('urbanmind_auth_token');
    },
    async (token: string) => {
      await AsyncStorageService.setItem('urbanmind_auth_token', token);
    },
    async () => {
      await AsyncStorageService.removeItem('urbanmind_auth_token');
    }
  );

  setRefreshTokenStorage(
    async () => {
      return await AsyncStorageService.getItem<string>('urbanmind_refresh_token');
    },
    async (token: string) => {
      await AsyncStorageService.setItem('urbanmind_refresh_token', token);
    },
    async () => {
      await AsyncStorageService.removeItem('urbanmind_refresh_token');
    }
  );

  setUnauthorizedHandler(async () => {
    queryClient.clear();
    useAuthStore.getState().setUser(null);
    useAuthStore.getState().clearError();
  });

  setAuthSessionRefreshedHandler(async (response: unknown) => {
    try {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) throw new Error('Không còn phiên người dùng để làm mới.');
      const refreshedUser = mergeRefreshedAuthUser(currentUser, response);
      if (refreshedUser.role !== currentUser.role || refreshedUser.isVerified !== currentUser.isVerified) {
        queryClient.clear();
      }
      useAuthStore.getState().setUser(refreshedUser);
    } catch (error) {
      await clearAuthTokens();
      queryClient.clear();
      useAuthStore.getState().setUser(null);
      throw error;
    }
  });

  isInitialized = true;
};
