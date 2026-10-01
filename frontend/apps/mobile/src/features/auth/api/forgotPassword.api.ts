import { authApi } from '@urbanmind/shared-api';
import { ForgotPasswordRequest, ResetPasswordRequest } from '../types/forgotPassword.types';

export const sendForgotPasswordOtp = async (payload: ForgotPasswordRequest): Promise<void> => {
  await authApi.sendForgotPasswordOtp(payload.email);
};

export const resetForgotPassword = async (payload: ResetPasswordRequest): Promise<void> => {
  await authApi.resetForgottenPassword(payload.email, payload.otp, payload.newPassword);
};
