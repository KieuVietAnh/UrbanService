export const getHeaderBreadcrumbOverride = (pathname = '') => {
  const adminOverrides = {
    '/management/staff-responsibilities': 'Phạm vi phụ trách nhân viên',
    '/management/feedbacks': 'Quản lý phản ánh',
    '/management/map': 'Bản đồ sự vụ',
    '/management/coordinators': 'Quản lý điều phối viên',
  };
  if (adminOverrides[pathname]) {
    return [{ label: adminOverrides[pathname], href: null }];
  }
  if (pathname.startsWith('/management/feedbacks/')) {
    return [
      { label: 'Quản lý phản ánh', href: '/management/feedbacks' },
      { label: 'Chi tiết phản ánh', href: null },
    ];
  }
  if (pathname.startsWith('/management/coordinators/')) {
    return [
      { label: 'Quản lý điều phối viên', href: '/management/coordinators' },
      { label: 'Chi tiết điều phối viên', href: null },
    ];
  }
  if (pathname === '/notifications') {
    return [{ label: 'Thông báo', href: null }];
  }
  if (pathname === '/manager/reports/review') {
    return [{ label: 'Duyệt phản ánh', href: null }];
  }
  if (pathname === '/analytics/sentiment/negative') {
    return [
      { label: 'Cảm xúc người dân', href: '/analytics/sentiment' },
      { label: 'Phản ánh tiêu cực', href: null },
    ];
  }
  return null;
};
