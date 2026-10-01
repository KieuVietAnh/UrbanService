import { useAuthStore } from './auth.store';

export const useAuth = () => {
  const { user, isLoading, error, login, logout, clearError } = useAuthStore();

  return {
    user,
    isLoading,
    error,
    login,
    logout,
    clearError,
    isAuthenticated: !!user,
    isResident: user?.role === 'service-user',
    isStaff: user?.role === 'system-staff',
  };
};
