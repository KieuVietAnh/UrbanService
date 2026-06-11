// src/contexts/AuthContext.jsx
import { createContext, useContext, useState } from 'react';
import { authApi } from '../services/api/authApi';
import { tokenStorage } from '../services/storage/tokenStorage';

const AuthContext = createContext(null);

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

const initializeUser = () => {
  const savedUser = tokenStorage.getUser();
  if (!savedUser) return null;
  return {
    ...savedUser,
    role: normalizeRole(savedUser.role),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(initializeUser);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setUser({
        ...res.user,
        role: normalizeRole(res.user.role),
      });
      return {
        ...res.user,
        role: normalizeRole(res.user.role),
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (fullName, email, password, phone) => {
    setLoading(true);
    try {
      const res = await authApi.register(fullName, email, password, phone);
      setUser({
        ...res.user,
        role: normalizeRole(res.user.role),
      });
      return {
        ...res.user,
        role: normalizeRole(res.user.role),
      };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (otp) => {
    setLoading(true);
    try {
      await authApi.verifyOTP(otp);
      // Update user's verified status
      const updatedUser = tokenStorage.getUser();
      if (updatedUser) {
        setUser(updatedUser);
      }
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setLoading(true);
    try {
      return await authApi.sendOTP();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyOtp,
    sendOtp,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
