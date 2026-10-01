// src/lib/firebaseErrors.js

/**
 * Firebase trả mã lỗi bằng tiếng Anh và thường rất kỹ thuật. Người dân đọc câu
 * gốc sẽ không biết phải làm gì, nên ánh xạ sang câu tiếng Việt nói rõ bước tiếp.
 */
const FIREBASE_MESSAGES = {
  'auth/invalid-phone-number': 'Số điện thoại không hợp lệ.',
  'auth/missing-phone-number': 'Vui lòng nhập số điện thoại.',
  'auth/invalid-verification-code': 'Mã OTP không đúng. Vui lòng kiểm tra lại.',
  'auth/missing-verification-code': 'Vui lòng nhập mã OTP.',
  'auth/code-expired': 'Mã OTP đã hết hạn. Vui lòng gửi lại mã.',
  'auth/session-expired': 'Phiên xác thực đã hết hạn. Vui lòng gửi lại mã.',
  'auth/too-many-requests': 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  'auth/quota-exceeded': 'Hệ thống đã hết hạn mức gửi SMS. Vui lòng thử lại sau.',
  'auth/billing-not-enabled':
    'Chưa bật gói trả phí nên không gửi được SMS tới số thật. Hãy dùng số điện thoại test.',
  'auth/operation-not-allowed': 'Phương thức xác thực bằng số điện thoại chưa được bật.',
  'auth/captcha-check-failed': 'Xác minh reCAPTCHA thất bại. Vui lòng thử lại.',
  'auth/invalid-app-credential':
    'Xác minh reCAPTCHA không hợp lệ. Hãy tải lại trang rồi thử lại.',
  'auth/unauthorized-domain': 'Tên miền này chưa được phép dùng xác thực số điện thoại.',
  'auth/invalid-api-key': 'Cấu hình Firebase của web không đúng.',
  'auth/user-disabled': 'Số điện thoại này đã bị vô hiệu hoá.',
  'auth/network-request-failed': 'Không kết nối được máy chủ xác thực. Kiểm tra kết nối mạng.',
};

export function getFirebaseErrorMessage(error, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  const code = error?.code;
  if (code && FIREBASE_MESSAGES[code]) return FIREBASE_MESSAGES[code];
  if (code) return `Lỗi xác thực: ${code}`;
  return error?.message || fallback;
}
