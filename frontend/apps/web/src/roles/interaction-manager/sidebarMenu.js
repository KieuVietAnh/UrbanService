// src/roles/interaction-manager/sidebarMenu.js
export default [
  { name: 'Tổng quan hệ thống', path: '/dashboard', icon: 'LayoutDashboard' },
  { name: 'Duyệt phản ánh', path: '/manager/reports/review', icon: 'BadgeCheck' },
  { name: 'Xử lý trùng lặp', path: '/manager/incident-matches', icon: 'GitMerge' },
  { name: 'Giám sát phản ánh', path: '/manager/interactions', icon: 'MessageSquareDashed' },
  { name: 'Quản lý sự vụ', path: '/manager/incidents', icon: 'Siren' },
  { name: 'Duyệt kết quả xử lý', path: '/manager/approvals', icon: 'GitPullRequestArrow' },
  {
    name: 'Quản lý điều phối viên',
    path: '/management/coordinators',
    icon: 'Network',
  },
  { name: 'Phân tích SLA', path: '/analytics/sla', icon: 'BarChart3' },
  { name: 'Cảm xúc người dân (AI)', path: '/analytics/sentiment', icon: 'Smile' },
  { name: 'Bản đồ điểm nóng', path: '/analytics/heatmap', icon: 'Flame' }
];
