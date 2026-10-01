import { Navigate } from 'react-router-dom';

// Trang Audit Log chưa có API quản trị chính thức trong scope Admin hiện tại.
// Giữ export tương thích cho các import cũ, nhưng không hiển thị dữ liệu giả.
export const AuditLog = () => <Navigate to="/dashboard" replace />;
