// src/contexts/AuthContext.jsx
import { createContext, useContext, useState } from 'react';
import { authApi } from '../services/api/authApi';
import { tokenStorage } from '../services/storage/tokenStorage';
import { getInternalRole } from '../utils/roleMap';

const AuthContext = createContext(null);

const normalizeRole = (role) => getInternalRole(role);

const initializeUser = () => {
  const savedUser = tokenStorage.getUser();
  console.log('AuthContext initializeUser localStorage user', savedUser);
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
      console.log('AuthContext login response', res);
      const updatedUser = {
        ...res.user,
        role: normalizeRole(res.user.role),
      };
      setUser(updatedUser);
      return updatedUser;
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
      const result = await authApi.verifyOTP(otp);
      console.log('AuthContext verifyOtp result', result);
      const updatedUser = result?.user || tokenStorage.getUser();
      console.log('AuthContext verifyOtp updatedUser', updatedUser);
      if (updatedUser) {
        setUser(updatedUser);
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
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.warn('AuthContext.googleLogin error', err);
      throw err;
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
    verifyOtp,
    googleLogin,
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
