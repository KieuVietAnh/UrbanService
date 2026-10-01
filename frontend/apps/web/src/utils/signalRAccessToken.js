/**
 * Lấy access token để đưa cho SignalR.
 *
 * SignalR không đi qua axios nên không dùng được interceptor gắn Authorization.
 * Token được lưu dưới nhiều khóa khác nhau tùy phiên bản của lớp lưu trữ, vì vậy
 * phải dò cả khóa trực tiếp lẫn các object JSON có bọc token bên trong.
 *
 * Trả về chuỗi rỗng khi không tìm thấy; phía gọi tự quyết định có kết nối hay không.
 */
export const getSignalRAccessToken = () => {
  if (typeof window === 'undefined') return '';

  const storages = [window.localStorage, window.sessionStorage];
  const directKeys = ['accessToken', 'access_token', 'token', 'authToken', 'jwtToken'];

  const clean = (value) => String(value).replace(/^Bearer\s+/i, '').trim();

  for (const storage of storages) {
    if (!storage) continue;

    for (const key of directKeys) {
      let value;
      try {
        value = storage.getItem(key);
      } catch {
        // Trình duyệt có thể chặn truy cập storage ở chế độ riêng tư.
        break;
      }
      if (value) return clean(value);
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;

      const raw = storage.getItem(key);
      if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) continue;

      try {
        const parsed = JSON.parse(raw);
        const candidates = [
          parsed?.accessToken,
          parsed?.access_token,
          parsed?.token,
          parsed?.authToken,
          parsed?.jwtToken,
          parsed?.state?.accessToken,
          parsed?.state?.access_token,
          parsed?.state?.token,
          parsed?.auth?.accessToken,
          parsed?.auth?.token,
          parsed?.user?.accessToken,
          parsed?.user?.token,
        ];

        const token = candidates.find(Boolean);
        if (token) return clean(token);
      } catch {
        // Bỏ qua giá trị không phải JSON hợp lệ.
      }
    }
  }

  return '';
};

/**
 * Dựng URL của một SignalR hub theo base URL của API.
 *
 * Khi không cấu hình base URL thì trả về đường dẫn tương đối để dev-proxy xử lý.
 */
export const buildHubUrl = (hubPath) => {
  const envBaseUrl = (
    import.meta.env.VITE_API_BASE_URL
    || import.meta.env.VITE_API_URL
    || import.meta.env.VITE_BACKEND_URL
    || ''
  ).replace(/\/$/, '');

  const normalizedPath = hubPath.startsWith('/') ? hubPath : `/${hubPath}`;
  return envBaseUrl ? `${envBaseUrl}${normalizedPath}` : normalizedPath;
};
