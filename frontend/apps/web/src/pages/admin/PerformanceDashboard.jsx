import { Navigate } from 'react-router-dom';

// Trang hiệu năng hệ thống chưa có API health/performance chính thức trong scope Admin hiện tại.
// Giữ export tương thích cho các import cũ, nhưng không hiển thị số liệu hard-code.
export const PerformanceDashboard = () => <Navigate to="/dashboard" replace />;
