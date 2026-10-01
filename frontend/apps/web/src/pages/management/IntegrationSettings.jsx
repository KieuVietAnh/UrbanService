import { Navigate } from 'react-router-dom';

// Cấu hình tích hợp chưa nằm trong menu/route quản trị đang hỗ trợ.
// Giữ export tương thích cho các import cũ và điều hướng về dashboard thay vì hiển thị UI lỗi thời.
export const IntegrationSettings = () => <Navigate to="/dashboard" replace />;
