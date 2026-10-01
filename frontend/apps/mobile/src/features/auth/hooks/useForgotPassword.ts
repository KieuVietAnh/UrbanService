import { useState } from 'react';
import { sendForgotPasswordOtp, resetForgotPassword } from '../api/forgotPassword.api';
import { extractApiErrorMessage } from '@urbanmind/shared-api';
import { useToast } from '@/components/shared';

export const useForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const sendOtp = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await sendForgotPasswordOtp({ email });
      // Security behavior: show generic confirmation even if email does not exist.
      toast.success(
        'Nếu email được liên kết với tài khoản UrbanMind, mã OTP đã được gửi. Vui lòng kiểm tra hộp thư của bạn.'
      );
      return true;
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Không thể gửi mã OTP. Vui lòng thử lại.');
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = async (payload: { email: string; otp: string; newPassword: string }): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await resetForgotPassword(payload);
      toast.success('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.');
      return true;
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra lại.');
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await sendForgotPasswordOtp({ email });
      toast.success('Mã OTP mới đã được yêu cầu. Vui lòng kiểm tra email.');
      return true;
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    isLoading,
    error,
    sendOtp,
    reset,
    resendOtp,
    clearError,
  };
};
