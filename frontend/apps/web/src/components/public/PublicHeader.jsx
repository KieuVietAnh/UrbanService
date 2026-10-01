import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';

const CREATE_FEEDBACK_URL = '/login?redirect=/tickets/create&intent=create-feedback';
const MY_FEEDBACKS_URL = '/login?redirect=/tickets&intent=my-feedbacks';
const AREA_ALERTS_URL = '/login?redirect=/area-alerts&intent=area-alerts';

const getNavigationItems = ({ isAuthenticated, myFeedbacksUrl, areaAlertsUrl }) => [
  { label: 'Trang chủ', to: '/' },
  ...(isAuthenticated ? [{ label: 'Phản ánh của tôi', to: myFeedbacksUrl }] : []),
  { label: 'Bảng tin', to: '/community/feed' },
  { label: 'Bản đồ sự cố', to: '/community/map' },
  { label: 'Cảnh báo', to: areaAlertsUrl },
];

const isNavigationItemActive = (pathname, item) => {
  if (item.to === '/') {
    return pathname === '/';
  }

  if (item.to === '/community/feed') {
    return (
      pathname === '/community/feed' ||
      pathname.startsWith('/community/feed/')
    );
  }

  if (item.to === '/tickets') {
    return pathname === '/tickets' || pathname.startsWith('/tickets/');
  }

  return (
    pathname === item.to ||
    pathname.startsWith(`${item.to}/`)
  );
};

const NavigationItem = ({ item, className, isActive }) => (
  <Link
    to={item.to}
    className={className}
    aria-current={isActive ? 'page' : undefined}
  >
    {item.label}
  </Link>
);

export const PublicHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const createFeedbackUrl = isAuthenticated ? '/tickets/create' : CREATE_FEEDBACK_URL;
  const myFeedbacksUrl = isAuthenticated ? '/tickets' : MY_FEEDBACKS_URL;
  const areaAlertsUrl = isAuthenticated ? '/area-alerts' : AREA_ALERTS_URL;
  const displayName = user?.fullName || user?.name || 'Tài khoản';
  const navigationItems = getNavigationItems({ isAuthenticated, myFeedbacksUrl, areaAlertsUrl });

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="public-header sticky top-0 z-[2000] w-full border-b shadow-[0_8px_30px_rgba(15,23,42,0.055)] backdrop-blur-xl">
      <nav
        className="public-wide-content flex h-[72px] w-full items-center justify-between gap-5 px-5 sm:px-7 lg:px-10 2xl:px-14"
        aria-label="Điều hướng UrbanMind"
      >
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          aria-label="UrbanMind - Trang chủ"
        >
          <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.26)]">
            <Lucide.MapPinned size={21} aria-hidden="true" />
            <span className="absolute -bottom-3 -right-3 h-8 w-8 rounded-full bg-white/15" aria-hidden="true" />
          </span>
          <span>
            <strong className="public-header-brand-title block text-[18px] font-bold tracking-[-0.025em]">
              UrbanMind
            </strong>
            <span className="public-header-brand-subtitle mt-0.5 hidden text-[11px] font-medium sm:block">
              Cổng phản ánh đô thị
            </span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {navigationItems.map((item) => (
            <li key={item.to}>
              <NavigationItem
                item={item}
                isActive={isNavigationItemActive(
                  location.pathname,
                  item
                )}
                className={`public-nav-link inline-flex h-10 items-center rounded-xl border px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 ${isNavigationItemActive(location.pathname, item)
                    ? 'public-nav-link-active border-blue-200/80 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-transparent hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700'
                  }`}
              />
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to={createFeedbackUrl}
            className="hidden h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 xl:inline-flex"
          >
            <Lucide.Plus size={16} aria-hidden="true" />
            Gửi phản ánh
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="public-theme-button inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
          >
            {theme === 'dark' ? <Lucide.Sun size={16} aria-hidden="true" /> : <Lucide.Moon size={16} aria-hidden="true" />}
          </button>
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <details className="dropdown dropdown-end">
                <summary
                  className="public-login-button inline-flex h-10 max-w-48 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  title={displayName}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-600 text-xs font-bold text-white">
                    {displayName.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate">{displayName}</span>
                  <Lucide.ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                </summary>
                <div className="dropdown-content z-[2100] mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_22px_55px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-1 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
                    <strong className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</strong>
                    <small className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || 'Tài khoản người dân'}</small>
                  </div>
                  <Link to="/profile" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900">
                    <Lucide.UserRound size={16} aria-hidden="true" />
                    Trang cá nhân
                  </Link>
                  <button type="button" onClick={handleLogout} className="mt-1 flex min-h-10 w-full items-center gap-3 border-t border-slate-200 px-3 pt-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-slate-800 dark:text-rose-300 dark:hover:bg-rose-500/10">
                    <Lucide.LogOut size={16} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              </details>
            </>
          ) : (
            <Link
              to="/login"
              className="public-login-button inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              Đăng nhập
            </Link>
          )}
        </div>

        <details className="dropdown dropdown-end lg:hidden">
          <summary
            className="public-mobile-menu-button flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            aria-label="Mở menu"
          >
            <Lucide.Menu size={19} aria-hidden="true" />
          </summary>

          <div className="dropdown-content z-[80] mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_22px_55px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950">
            <ul className="space-y-1" aria-label="Điều hướng trên thiết bị di động">
              {navigationItems.map((item) => (
                <li key={item.to}>
                  <NavigationItem
                    item={item}
                    isActive={isNavigationItemActive(
                      location.pathname,
                      item
                    )}
                    className={`public-nav-link flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium transition ${isNavigationItemActive(location.pathname, item)
                        ? 'public-nav-link-active border-blue-200/80 bg-blue-50 text-blue-700'
                        : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-900'
                      }`}
                  />
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              >
                {theme === 'dark' ? <Lucide.Sun size={17} /> : <Lucide.Moon size={17} />}
              </button>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <Lucide.LogOut size={15} aria-hidden="true" />
                  Đăng xuất
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Đăng nhập
                </Link>
              )}
              <Link
                to={createFeedbackUrl}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white"
              >
                Gửi phản ánh
              </Link>
            </div>
          </div>
        </details>
      </nav>
      <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" aria-hidden="true" />
    </header>
  );
};

export default PublicHeader;
