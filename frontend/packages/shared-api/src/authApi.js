import { axiosClient } from './axiosClient.js';

export const authApi = {
  login(email, password) {
    return axiosClient.post('/api/auth/login', {
      email,
      password,
    });
  },

  register(fullName, email, password, phone) {
    return axiosClient.post('/api/auth/register', {
      fullname: fullName,
      email,
      password,
      phone,
    });
  },

  googleLogin(idToken) {
    return axiosClient.post('/api/auth/google-login', { idToken });
  },

  refreshToken(refreshToken) {
    return axiosClient.post('/api/auth/refresh-token', { refreshToken });
  },

  sendForgotPasswordOtp(email) {
    return axiosClient.post('/api/auth/forgot-password/send-otp', { email });
  },

  /** Kiểm tra OTP quên mật khẩu mà không tiêu thụ nó; vẫn phải gửi lại otp ở bước reset. */
  verifyForgotPasswordOtp(email, otp) {
    return axiosClient.post('/api/auth/forgot-password/verify-otp', { email, otp });
  },

  resetForgottenPassword(email, otp, newPassword) {
    return axiosClient.post('/api/auth/forgot-password/reset', {
      email,
      otp,
      newPassword,
    });
  },

  /**
   * Xin phép gửi SMS OTP. Backend kiểm tra hạn mức rồi mới cho phép; chỉ gọi
   * Firebase sau khi hàm này trả về thành công, vì mỗi tin SMS là chi phí thật.
   * Bỏ trống phoneNumber để dùng số đã lưu trên tài khoản.
   */
  requestPhoneOtp(phoneNumber) {
    return axiosClient.post('/api/auth/phone-verification/request-otp', { phoneNumber });
  },

  /** idToken: Firebase ID token lấy được sau khi người dùng nhập đúng OTP. */
  verifyPhone(idToken) {
    return axiosClient.post('/api/auth/phone-verification/verify', { idToken });
  },

  logout() {
    // Backend does not provide a logout endpoint, so just resolve here.
    return Promise.resolve({ success: true });
  },
};
