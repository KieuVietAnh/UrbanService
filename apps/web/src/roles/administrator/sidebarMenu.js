// src/roles/administrator/sidebarMenu.js
export default [
  { name: 'Tổng Quan Hệ Thống', path: '/dashboard', icon: 'LayoutDashboard' },
  { name: 'Quản Lý Người Dùng', path: '/management/users', icon: 'Users2' },
  { name: 'Cấu Hình Danh Mục', path: '/management/categories', icon: 'FolderKanban' },
  { name: 'Cấu Hình SLA', path: '/management/sla', icon: 'Clock' },
  { name: 'Cấu Hình Tích Hợp', path: '/management/integrations', icon: 'Link2' },
  { name: 'Nhật Ký Hệ Thống', path: '/admin/audit', icon: 'FileClock' },
  { name: 'Hiệu Năng & Logs', path: '/admin/performance', icon: 'Activity' },
  { name: 'Cài Đặt', path: '/settings', icon: 'Settings' }
];
