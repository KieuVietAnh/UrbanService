import { axiosClient } from './axiosClient.js';

export const authApi = {
  login(email, password) {
    return axiosClient.post('/api/auth/login', { email, password });
  },

  register(fullName, email, password, phone) {
    return axiosClient.post('/api/auth/register', {
      fullName,
      email,
      password,
      phone,
    });
  },

  googleLogin(idToken) {
    return axiosClient.post('/api/auth/google-login', { idToken });
  },

  sendOtp() {
    return axiosClient.post('/api/auth/email-verification/send-otp');
  },

  verifyOtp(otp) {
    return axiosClient.post('/api/auth/email-verification/verify', { otp });
  },

  logout() {
    return axiosClient.post('/api/auth/logout');
  },
};
