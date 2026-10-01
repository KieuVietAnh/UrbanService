const menuItems = [
  { name: 'Dashboard', label: 'Tổng quan', path: '/dashboard', icon: 'LayoutDashboard', activePatterns: ['/dashboard'] },
  { name: 'Sự Vụ Của Tôi', label: 'Sự vụ của tôi', path: '/staff/incidents', icon: 'ClipboardList', activePatterns: ['/staff/incidents'] },
  {
    name: 'Phản Ánh',
    label: 'Phản ánh',
    path: '/staff/feedbacks',
    icon: 'MessageSquareText',
    activePatterns: ['/staff/feedbacks', '/staff/request-info', '/staff/assignment-history'],
  },
  { name: 'Trao Đổi', label: 'Trao đổi', path: '/staff/conversations', icon: 'MessageSquare', activePatterns: ['/staff/conversations'] },
  { name: 'Cảnh Báo Khu Vực', label: 'Cảnh báo khu vực', path: '/staff/area-alerts', icon: 'AlertTriangle', activePatterns: ['/staff/area-alerts'] },
  { name: 'Danh Bạ Đơn Vị Xử Lý', label: 'Danh bạ đơn vị xử lý', path: '/staff/coordinators', icon: 'Users', activePatterns: ['/staff/coordinators'] },
  { name: 'Thông Báo', label: 'Thông báo', path: '/notifications', icon: 'Bell', activePatterns: ['/notifications'] },
  { name: 'Hồ Sơ', label: 'Hồ sơ', path: '/profile', icon: 'User', activePatterns: ['/profile'] },
];

export const systemStaffSidebarSections = [
  {
    id: 'workspace',
    title: 'Công việc',
    items: menuItems.filter((item) => ['Dashboard', 'Sự Vụ Của Tôi', 'Phản Ánh'].includes(item.name)),
  },
  {
    id: 'coordination',
    title: 'Phối hợp',
    items: menuItems.filter((item) => ['Trao Đổi', 'Cảnh Báo Khu Vực', 'Danh Bạ Đơn Vị Xử Lý'].includes(item.name)),
  },
  {
    id: 'system',
    title: 'Tài khoản',
    items: menuItems.filter((item) => ['Thông Báo', 'Hồ Sơ'].includes(item.name)),
  },
];

export const isSystemStaffMenuItemActive = (item, pathname = '/') => {
  if (!item?.activePatterns?.length) return false;

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return item.activePatterns.some((pattern) => {
    const normalizedPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`);
  });
};

export default menuItems;
