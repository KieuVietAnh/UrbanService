import type { ConfirmationResult, UserCredential } from '@react-native-firebase/auth';

type FirebasePhoneModule = typeof import('@react-native-firebase/auth');

let confirmation: ConfirmationResult | null = null;

const unavailableMessage =
  'Bản cài đặt hiện tại chưa có cấu hình xác thực số điện thoại. Vui lòng cập nhật APK UrbanMind mới nhất hoặc liên hệ quản trị hệ thống.';

const firebaseErrorMessage = (error: unknown, fallback: string): string => {
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  if (code.includes('invalid-phone-number')) return 'Số điện thoại không hợp lệ.';
  if (code.includes('invalid-verification-code')) return 'Mã OTP không chính xác.';
  if (code.includes('session-expired')) return 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.';
  if (code.includes('too-many-requests')) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.';
  if (code.includes('quota-exceeded')) return 'Hệ thống tạm hết hạn mức gửi SMS. Vui lòng thử lại sau.';
  if (code.includes('app-not-authorized') || code.includes('missing-client-identifier')) {
    return unavailableMessage;
  }
  return fallback;
};

const loadFirebasePhoneAuth = async (): Promise<FirebasePhoneModule> => {
  try {
    const firebaseAuth = await import('@react-native-firebase/auth');
    // getAuth also verifies that the native default Firebase app exists. Doing
    // this before asking the backend for an SMS quota avoids consuming a send
    // allowance when this APK was built without google-services.json.
    firebaseAuth.getAuth();
    return firebaseAuth;
  } catch (error) {
    if (__DEV__) console.warn('[Firebase phone auth unavailable]', error);
    throw new Error(unavailableMessage);
  }
};

export const sendFirebasePhoneOtp = async (phoneNumber: string): Promise<void> => {
  const firebaseAuth = await loadFirebasePhoneAuth();
  try {
    const auth = firebaseAuth.getAuth();
    auth.languageCode = 'vi';
    confirmation = await firebaseAuth.signInWithPhoneNumber(auth, phoneNumber);
  } catch (error) {
    confirmation = null;
    throw new Error(firebaseErrorMessage(error, 'Firebase không thể gửi mã OTP. Vui lòng thử lại.'));
  }
};

export const assertFirebasePhoneAuthAvailable = async (): Promise<void> => {
  await loadFirebasePhoneAuth();
};

export const confirmFirebasePhoneOtp = async (otp: string): Promise<string> => {
  if (!confirmation) {
    throw new Error('Phiên xác thực đã hết hạn. Vui lòng gửi lại mã OTP.');
  }

  let credential: UserCredential;
  try {
    credential = await confirmation.confirm(otp);
  } catch (error) {
    throw new Error(firebaseErrorMessage(error, 'Không thể xác thực mã OTP. Vui lòng thử lại.'));
  }
  if (!credential?.user) {
    throw new Error('Firebase không trả về người dùng đã xác thực. Vui lòng gửi lại mã OTP.');
  }

  return credential.user.getIdToken(true);
};

export const clearFirebasePhoneSession = (): void => {
  confirmation = null;
};
