// src/components/layout/Header.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { APP_ROLES } from '@urbanmind/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { ThemeToggle } from '../../components/design-system';
import { normalizeRole } from '../../utils/roleMap';
import { getHeaderBreadcrumbOverride } from './headerBreadcrumbs';

const citizenNavigation = [
  { label: 'Trang chủ', to: '/', end: true },
  { label: 'Phản ánh của tôi', to: '/tickets', end: true },
  { label: 'Bảng tin', to: '/community/feed' },
  { label: 'Bản đồ sự cố', to: '/community/map' },
  { label: 'Cảnh báo', to: '/area-alerts' },
];

const isCitizenNavigationActive = (targetPath, pathname) => {
  if (targetPath === '/') {
    return pathname === '/' || pathname === '/dashboard';
  }

  if (targetPath === '/tickets') {
    return (
      pathname === '/tickets' ||
      (
        pathname.startsWith('/tickets/') &&
        pathname !== '/tickets/create'
      )
    );
  }

  if (targetPath === '/community/feed') {
    return pathname.startsWith('/community/feed');
  }

  if (targetPath === '/community/map') {
    return pathname.startsWith('/community/map');
  }

  return pathname === targetPath;
};

const getInitials = (fullName) => {
  const normalizedName = String(fullName || '').trim();
  if (!normalizedName) return 'UM';

  return normalizedName
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const CitizenAvatar = ({ user }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = user?.avatarUrl;
  const initials = useMemo(() => getInitials(user?.fullName), [user?.fullName]);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  if (!avatarUrl || imageFailed) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-blue-600 text-xs font-bold text-white">
        {initials}
      </span>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={`Ảnh đại diện của ${user?.fullName || 'người dùng'}`}
      className="h-full w-full object-cover"
      onError={() => setImageFailed(true)}
    />
  );
};

const CitizenHeader = ({ user, logout, navigate, pathname }) => {
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="public-header sticky top-0 z-[2000] w-full shrink-0 border-b shadow-[0_8px_30px_rgba(15,23,42,0.055)] backdrop-blur-xl">
      <nav
        className="public-wide-content flex h-[72px] w-full items-center justify-between gap-3 px-5 sm:px-7 lg:px-10 2xl:px-14"
        aria-label="Điều hướng người dân"
      >
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          aria-label="UrbanMind - Trang chủ"
        >
          <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.26)] transition-transform group-hover:-translate-y-0.5">
            <Lucide.MapPinned size={21} aria-hidden="true" />
            <span className="absolute -bottom-3 -right-3 h-8 w-8 rounded-full bg-white/15" aria-hidden="true" />
          </span>
          <span className="hidden sm:block">
            <strong className="public-header-brand-title block text-[18px] font-bold tracking-[-0.025em]">
              UrbanMind
            </strong>
            <span className="public-header-brand-subtitle mt-0.5 block text-[11px] font-medium">
              Cổng phản ánh đô thị
            </span>
          </span>
        </Link>

        <ul className="hidden min-w-0 items-center justify-center gap-1 lg:flex">
          {citizenNavigation.map((item) => {
            const isActive = isCitizenNavigationActive(item.to, pathname);

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`public-nav-link inline-flex h-10 items-center rounded-xl border px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 ${
                    isActive
                      ? 'public-nav-link-active border-blue-200/80 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-transparent hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex min-w-fit items-center justify-end gap-1.5 sm:gap-2">
          <NavLink
            to="/tickets/create"
            className={({ isActive }) => (
              `hidden h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 xl:inline-flex ${
                isActive ? 'bg-blue-700' : 'bg-blue-600'
              }`
            )}
          >
            <Lucide.Plus size={16} aria-hidden="true" />
            Gửi phản ánh
          </NavLink>

          <ThemeToggle className="public-theme-button h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" />
          <NotificationBell />

          <div className="dropdown dropdown-end hidden sm:block">
            <button
              type="button"
              tabIndex={0}
              className="public-login-button flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2.5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              aria-label="Mở menu tài khoản"
              title="Tài khoản"
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                <CitizenAvatar user={user} />
              </span>
              <span className="hidden max-w-[132px] truncate text-sm font-semibold text-[var(--public-title)] 2xl:block">
                {user?.fullName || 'Tài khoản'}
              </span>
              <Lucide.ChevronDown size={14} className="hidden text-[var(--public-muted)] 2xl:block" aria-hidden="true" />
            </button>

            <ul
              tabIndex={0}
              className="dropdown-content menu z-[2100] mt-2 w-64 translate-x-2 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] p-2 text-[var(--public-title)] shadow-[0_22px_55px_rgba(15,23,42,0.16)]"
            >
              <li className="mb-1 border-b border-[var(--public-border)] px-3 py-3">
                <span className="block p-0 hover:bg-transparent focus:bg-transparent active:bg-transparent">
                  <strong className="block truncate text-sm font-semibold">
                    {user?.fullName || 'Người dùng UrbanMind'}
                  </strong>
                  <small className="mt-1 block truncate text-xs font-normal text-[var(--public-muted)]">
                    {user?.email || 'Tài khoản người dân'}
                  </small>
                </span>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/profile')} className="gap-3 rounded-xl py-2.5 text-sm font-medium">
                  <Lucide.UserRound size={16} aria-hidden="true" />
                  Trang cá nhân
                </button>
              </li>
              <li className="mt-1 border-t border-[var(--public-border)] pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="gap-3 rounded-xl py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Lucide.LogOut size={16} aria-hidden="true" />
                  Đăng xuất
                </button>
              </li>
            </ul>
          </div>

          <details className="dropdown dropdown-end sm:hidden">
            <summary
              className="public-mobile-menu-button flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
              aria-label="Mở menu người dân"
            >
              <Lucide.Menu size={19} aria-hidden="true" />
            </summary>

            <div className="dropdown-content z-[2100] mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] p-3 text-[var(--public-title)] shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
              <div className="mb-3 flex items-center gap-3 border-b border-[var(--public-border)] pb-3">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                  <CitizenAvatar user={user} />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold">
                    {user?.fullName || 'Người dùng UrbanMind'}
                  </strong>
                  <span className="mt-0.5 block truncate text-xs text-[var(--public-muted)]">
                    {user?.email || 'Tài khoản người dân'}
                  </span>
                </div>
              </div>

              <ul className="space-y-1">
                {citizenNavigation.map((item) => {
                  const isActive = isCitizenNavigationActive(item.to, pathname);

                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        aria-current={isActive ? 'page' : undefined}
                        className={`public-nav-link flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium transition ${
                          isActive
                            ? 'public-nav-link-active border-blue-200/80 bg-blue-50 text-blue-700'
                            : 'border-transparent hover:bg-blue-50 hover:text-blue-700'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    to="/tickets/create"
                    className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white"
                  >
                    <Lucide.Plus size={16} aria-hidden="true" />
                    Gửi phản ánh
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/profile')} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-blue-50 hover:text-blue-700">
                    <Lucide.UserRound size={16} aria-hidden="true" />
                    Trang cá nhân
                  </button>
                </li>
                <li className="mt-2 border-t border-[var(--public-border)] pt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <Lucide.LogOut size={16} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </nav>
      <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" aria-hidden="true" />
    </header>
  );
};

export const Header = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedUserRole = normalizeRole(user?.role);
  const isCitizen = normalizedUserRole === APP_ROLES.SERVICE_USER;
  const dashboardLabel = normalizedUserRole === APP_ROLES.SYSTEM_STAFF
    ? 'Tổng quan công việc'
    : 'Tổng quan hệ thống';

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);

    const labelMap = {
      dashboard: dashboardLabel,
      admin: 'Quản trị hệ thống',
      management: 'Quản trị vận hành',
      users: 'Quản lý người dùng',
      coordinators: 'Danh bạ điều phối viên',
      feedbacks: 'Quản lý phản ánh',
      categories: 'Danh mục phản ánh',
      sla: 'Chính sách SLA',
      analytics: 'Báo cáo phân tích',
      sentiment: 'Cảm xúc người dân',
      heatmap: 'Bản đồ điểm nóng',
      manager: 'Quản lý tương tác',
      interactions: 'Giám sát phản ánh',
      approvals: 'Duyệt kết quả xử lý',
      provider: 'Đơn vị xử lý',
      tasks: 'Nhiệm vụ được giao',
      tickets: 'Phản ánh',
      create: 'Gửi phản ánh mới',
      queue: 'Hàng chờ kiểm duyệt AI',
      conversations: 'Quản lý trao đổi',
      'area-alerts': 'Quản lý cảnh báo khu vực',
      duplicates: 'Xử lý trùng lặp',
      'incident-matches': 'Đề xuất cùng sự vụ',
      incidents: (location.pathname.startsWith('/manager/incidents') || location.pathname.startsWith('/management/incidents')) ? 'Quản lý sự vụ' : 'Sự vụ của tôi',
      review: 'Duyệt kết quả',
      community: 'Cộng đồng',
      feed: 'Bảng tin',
      map: 'Bản đồ sự vụ',
      profile: 'Hồ sơ',
      settings: 'Cài đặt',
      new: 'Thêm điều phối viên',
      'request-info': 'Yêu cầu bổ sung thông tin',
      history: 'Lịch sử phân công',
      'provider-reports': 'Báo cáo xử lý',
    };

    if (location.pathname === '/dashboard') {
      return <span className="font-semibold text-slate-950">{dashboardLabel}</span>;
    }

    const breadcrumbOverride = getHeaderBreadcrumbOverride(location.pathname);
    if (breadcrumbOverride) {
      return (
        <div className="flex items-center gap-1.5">
          <Link to="/dashboard" className="font-medium text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
            {dashboardLabel}
          </Link>
          {breadcrumbOverride.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              <Lucide.ChevronRight size={14} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
              {item.href ? (
                <Link to={item.href} className="font-semibold text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-slate-950 dark:text-slate-100">{item.label}</span>
              )}
            </span>
          ))}
        </div>
      );
    }

    if (location.pathname.startsWith('/tickets/assign/')) {
      return (
        <div className="flex items-center gap-1.5">
          <Link to="/dashboard" className="font-medium text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
            {dashboardLabel}
          </Link>
          <Lucide.ChevronRight size={14} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
          <Link to="/staff/incidents" className="font-semibold text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
            Sự vụ của tôi
          </Link>
          <Lucide.ChevronRight size={14} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
          <span className="font-semibold text-slate-950 dark:text-slate-100">Phân công xử lý</span>
        </div>
      );
    }

    const hiddenBreadcrumbSegments = new Set([
      'admin',
      'management',
      'analytics',
      'provider',
      'tickets',
      'community',
      'manager',
      'staff',
    ]);

    const visiblePaths = paths.filter((path) => !hiddenBreadcrumbSegments.has(path));

    return (
      <div className="flex items-center gap-1.5">
        <Link to="/dashboard" className="font-medium text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
          {dashboardLabel}
        </Link>

        {visiblePaths.map((path, index) => {
          if (index === 0 && path === 'dashboard') return null;

          const isFeedbackId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(path);
          const isIncidentMatchCandidateId = isFeedbackId && location.pathname.startsWith('/manager/incident-matches/');
          const isIncidentId = isFeedbackId && (
            location.pathname.startsWith('/manager/incidents/')
            || location.pathname.startsWith('/management/incidents/')
            || location.pathname.startsWith('/staff/incidents/')
            || location.pathname.startsWith('/manager/approvals/')
          );
          const isCoordinatorId = /^\d+$/.test(path) && (location.pathname.startsWith('/management/coordinators/') || location.pathname.startsWith('/staff/coordinators/'));
          const isProviderReportId = /^\d+$/.test(path) && location.pathname.startsWith('/staff/provider-reports/');
          const segmentName = isIncidentMatchCandidateId
            ? 'Chi tiết đề xuất'
            : isIncidentId
              ? 'Chi tiết sự vụ'
            : index > 0 && location.pathname.startsWith('/staff/duplicates/')
            ? 'Chi tiết trường hợp nghi trùng'
            : isFeedbackId
              ? 'Chi tiết phản ánh'
            : isProviderReportId
              ? `Báo cáo #${path}`
            : isCoordinatorId
              ? 'Chi tiết điều phối viên'
            : path === 'feedbacks' && location.state?.fromStaffConversations
              ? 'Quản lý trao đổi'
            : path === 'create' && location.pathname.startsWith('/staff/area-alerts/')
              ? 'Tạo cảnh báo'
            : path === 'sla' && location.pathname.startsWith('/analytics/')
              ? 'Phân tích SLA'
              : labelMap[path] || path;
          const isLast = index === visiblePaths.length - 1;

          const breadcrumbLinkMap = {
            interactions: '/manager/interactions',
            approvals: '/manager/approvals',
            heatmap: '/analytics/heatmap',
            sentiment: '/analytics/sentiment',
            settings: '/settings',
            coordinators: location.pathname.startsWith('/staff/coordinators') ? '/staff/coordinators' : '/management/coordinators',
            feedbacks: location.pathname.startsWith('/staff/feedbacks') ? '/staff/feedbacks' : '/management/feedbacks',
            'area-alerts': '/staff/area-alerts',
            duplicates: '/staff/duplicates',
            'incident-matches': '/manager/incident-matches',
            incidents: location.pathname.startsWith('/management/incidents')
              ? '/management/incidents'
              : location.pathname.startsWith('/manager/incidents')
                ? '/manager/incidents'
                : '/staff/incidents',
            'provider-reports': '/staff/feedbacks',
          };

          const breadcrumbLink = path === 'feedbacks' && location.state?.fromStaffConversations
            ? '/staff/conversations'
            : isFeedbackId && location.pathname.startsWith('/staff/feedbacks/')
              ? `/staff/feedbacks/${path}`
            : path === 'sla' && location.pathname.startsWith('/analytics/')
              ? '/analytics/sla'
              : breadcrumbLinkMap[path];

          return (
            <span key={`${path}-${index}`} className="flex items-center gap-1.5">
              <Lucide.ChevronRight size={14} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
              {!isLast && breadcrumbLink ? (
                <Link to={breadcrumbLink} className="font-semibold text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
                  {segmentName}
                </Link>
              ) : (
                <span className="font-semibold text-slate-950 dark:text-slate-100">{segmentName}</span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  if (isCitizen) {
    return (
      <CitizenHeader
        user={user}
        logout={logout}
        navigate={navigate}
        pathname={location.pathname}
      />
    );
  }

  return (
    <header className="admin-topbar navbar sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.045)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-slate-800 dark:bg-slate-950/85 sm:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Mở menu"
          title="Mở menu"
          onClick={onMenuToggle}
          className="btn btn-ghost btn-square lg:hidden"
        >
          <Lucide.Menu size={20} aria-hidden="true" />
        </button>
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-sm font-medium sm:flex">
          {getBreadcrumbs()}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle className="mr-2" />
        <NotificationBell />
      </div>
    </header>
  );
};
