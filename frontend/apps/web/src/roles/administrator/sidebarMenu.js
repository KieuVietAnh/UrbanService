// src/roles/administrator/sidebarMenu.js
export default [
  { name: 'Tổng quan hệ thống', path: '/dashboard', icon: 'LayoutDashboard' },
  { name: 'Quản lý người dùng', path: '/management/users', icon: 'Users2' },
  { name: 'Phạm vi phụ trách nhân viên', path: '/management/staff-responsibilities', icon: 'UserRoundCog' },
  { name: 'Quản lý điều phối viên', path: '/management/coordinators', icon: 'Network' },
  { name: 'Quản lý phản ánh', path: '/management/feedbacks', icon: 'MessageSquareText' },
  { name: 'Quản lý sự vụ', path: '/management/incidents', icon: 'Siren' },
  { name: 'Bản đồ sự vụ', path: '/management/map', icon: 'MapPinned' },
  { name: 'Danh mục phản ánh', path: '/management/categories', icon: 'FolderKanban' },
  { name: 'Chính sách SLA', path: '/management/sla', icon: 'Clock' },
];
