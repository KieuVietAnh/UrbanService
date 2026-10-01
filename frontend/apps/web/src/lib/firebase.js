// src/lib/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, initializeAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let auth = null;

/**
 * Firebase chỉ dùng để chứng minh người dùng đang giữ số điện thoại đó. Phiên đăng
 * nhập của hệ thống vẫn là JWT do backend cấp, nên phiên Firebase không cần sống
 * qua lần tải lại trang — giữ nó lại chỉ làm lẫn hai khái niệm "đăng nhập".
 */
export function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Chưa cấu hình Firebase cho web. Hãy điền các biến VITE_FIREBASE_* trong apps/web/.env.local rồi chạy lại.'
    );
  }

  if (!auth) {
    const app = initializeApp(firebaseConfig);
    try {
      auth = initializeAuth(app, { persistence: inMemoryPersistence });
    } catch {
      // initializeAuth ném lỗi nếu đã được gọi trước đó (ví dụ sau hot reload).
      auth = getAuth(app);
    }
    auth.languageCode = 'vi';
  }

  return auth;
}
