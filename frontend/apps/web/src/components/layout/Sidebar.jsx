
// src/components/layout/Sidebar.jsx

import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { APP_ROLES } from '@urbanmind/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole } from '../../utils/roleMap';

// Import all sidebar menus
import userMenu from '../../roles/service-user/sidebarMenu';
import staffMenu, { isSystemStaffMenuItemActive, systemStaffSidebarSections } from '../../roles/system-staff/sidebarMenu';
import providerMenu from '../../roles/service-provider/sidebarMenu';
import managerMenu from '../../roles/interaction-manager/sidebarMenu';
import adminMenu from '../../roles/administrator/sidebarMenu';

const menuMapping = {
  [APP_ROLES.SERVICE_USER]: userMenu,
  [APP_ROLES.SYSTEM_STAFF]: staffMenu,
  [APP_ROLES.SERVICE_PROVIDER]: providerMenu,
  [APP_ROLES.INTERACTION_MANAGER]: managerMenu,
  [APP_ROLES.ADMINISTRATOR]: adminMenu
};

const getRoleNameVietnamese = (role) => {
  switch (role) {
    case APP_ROLES.SERVICE_USER: return 'Người Dân';
    case APP_ROLES.SYSTEM_STAFF: return 'Nhân viên xử lý sự vụ';
    case APP_ROLES.SERVICE_PROVIDER: return 'Đơn Vị Xử Lý';
    case APP_ROLES.INTERACTION_MANAGER: return 'Quản Lý Tương Tác';
    case APP_ROLES.ADMINISTRATOR: return 'Quản Trị Viên';
    default: return 'Khách';
  }
};


const getUserInitials = (value = '') => {
  const normalizedValue = value.trim();

  if (!normalizedValue) return 'U';

  const parts = normalizedValue.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return normalizedValue.slice(0, 2).toUpperCase();
};

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarError, setAvatarError] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    workspace: true,
    coordination: true,
    system: true
  });

  if (!user) return null;

  const currentRole = normalizeRole(user?.role);
  const menuItems = menuMapping[currentRole] || [];
  const displayName = user.fullName || user.email || 'Người dùng';
  const userInitials = getUserInitials(displayName);
  const showAvatarImage = Boolean(user.avatarUrl) && !avatarError;
  const currentPathname = location.pathname;

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleLogoutCancel = () => {
    setIsLogoutModalOpen(false);
  };

  const handleLogoutConfirm = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Helper to render icon by string name
  const renderIcon = (iconName, className) => {
    const IconComponent = Lucide[iconName];
    if (IconComponent) {
      return <IconComponent className={className} size={20} />;
    }
    return <Lucide.HelpCircle className={className} size={20} />;
  };

  const renderSidebarLink = (item, isActive, compact = false) => (
    <NavLink
      key={item.name}
      to={item.path}
      onClick={onClose}
      title={compact ? (item.label || item.name) : undefined}
      className={`group relative flex items-center rounded-xl border px-2.5 py-2 text-[13px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:outline-none active:outline-none ${compact ? 'justify-center px-2.5 py-2' : 'gap-3 px-2.5 py-2'} ${isActive
        ? 'admin-sidebar-link-active border-blue-200/70 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/70'
        : 'admin-sidebar-link border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white/75 hover:text-slate-950 hover:shadow-sm hover:shadow-blue-100/40'
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full transition-opacity ${isActive ? 'bg-blue-600 opacity-100' : 'opacity-0'}`}
        aria-hidden
      />
      <span className={`admin-sidebar-link-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-transparent text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-700'}`}>
        {renderIcon(item.icon, 'h-[18px] w-[18px]')}
      </span>
      {!compact && <span className="min-w-0 truncate">{item.label || item.name}</span>}
    </NavLink>
  );

  return (
    <>
      <aside
      className={`admin-sidebar fixed inset-y-0 left-0 z-40 h-screen w-64 flex-shrink-0 transform border-r border-slate-200/70 bg-sky-50/90 shadow-[14px_0_38px_rgba(30,64,175,0.05)] backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:self-start lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Logo Section */}
        <div className="admin-sidebar-logo flex items-center justify-between border-b border-slate-200/70 bg-sky-50/55 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.26)]">
              <Lucide.MapPinned size={20} aria-hidden="true" />
              <span className="absolute -bottom-3 -right-3 h-8 w-8 rounded-full bg-white/15" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-[-0.025em] text-slate-950">
                UrbanMind
              </h1>
              <p className="text-[11px] font-medium text-slate-500">Cổng phản ánh đô thị</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng thanh điều hướng" title="Đóng menu" className="btn btn-sm btn-ghost lg:hidden">
            <Lucide.X size={20} aria-hidden />
          </button>
        </div>

        {/* User Card */}
        <div className="border-b border-slate-200/80 px-3 py-3">
          <div className="admin-sidebar-user-card flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/65 p-2.5 shadow-sm shadow-blue-100/50">
            <div className={showAvatarImage ? 'avatar shrink-0' : 'avatar placeholder shrink-0'}>
              {showAvatarImage ? (
                <div className="w-10 rounded-2xl ring-2 ring-blue-200 ring-offset-2 ring-offset-white">
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    onError={() => setAvatarError(true)}
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <span className="text-sm font-extrabold leading-none tracking-tight">{userInitials}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-bold text-slate-950">{displayName}</h4>
              <div className="mt-0.5 inline-flex max-w-full rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
                <span className="truncate">{getRoleNameVietnamese(currentRole)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className={`admin-sidebar-nav min-h-0 flex-1 overflow-x-hidden px-2.5 py-2 ${currentRole === APP_ROLES.ADMINISTRATOR ? 'space-y-1 overflow-y-hidden' : 'space-y-1.5 overflow-y-auto'}`}>
          {currentRole === APP_ROLES.SYSTEM_STAFF ? (
            systemStaffSidebarSections.map((section) => {
              const visibleItems = section.items;
              const isSectionActive = visibleItems.some((item) => isSystemStaffMenuItemActive(item, currentPathname));
              const isExpanded = expandedSections[section.id] ?? true;

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.id} className="rounded-xl border border-transparent px-1 py-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${isSectionActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <span>{section.title}</span>
                    <Lucide.ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>

                  {isExpanded ? (
                    <div className="mt-1 space-y-1">
                      {visibleItems.map((item) => {
                        const isActive = isSystemStaffMenuItemActive(item, currentPathname);
                        return renderSidebarLink(item, isActive);
                      })}
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-col gap-1">
                      {visibleItems.map((item) => {
                        const isActive = isSystemStaffMenuItemActive(item, currentPathname);
                        return renderSidebarLink(item, isActive, true);
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            menuItems.map((item) => {
              const isActive = currentPathname === item.path || currentPathname.startsWith(`${item.path}/`);
              return renderSidebarLink(item, isActive);
            })
          )}
        </nav>

        {/* Footer Actions */}
        <div className="admin-sidebar-footer shrink-0 border-t border-slate-200/80 bg-white/55 p-3 backdrop-blur">
          <button
            type="button"
            onClick={handleLogoutClick}
            className="admin-sidebar-logout btn btn-outline w-full min-h-0 gap-2 rounded-xl border-slate-200 bg-white/60 py-2 text-slate-700 shadow-sm shadow-blue-100/40 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:outline-none active:outline-none"
          >
            <Lucide.LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </div>
      </aside>

      {isLogoutModalOpen && (
        <div className="modal modal-open">
          <div
            className="modal-box w-full max-w-[420px] rounded-[28px] border border-slate-200/90 bg-white p-0 shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
          >
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <Lucide.LogOut size={22} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 id="logout-dialog-title" className="text-xl font-bold tracking-[-0.02em] text-slate-950">Xác nhận đăng xuất</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Bạn sẽ kết thúc phiên làm việc hiện tại và cần đăng nhập lại để tiếp tục sử dụng UrbanMind.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleLogoutCancel}
                className="btn admin-secondary-action h-11 rounded-xl px-5 text-sm font-semibold normal-case"
                disabled={isLoggingOut}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Lucide.LogOut size={17} />
                )}
                Đăng xuất
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={handleLogoutCancel}
            aria-label="Đóng hộp thoại đăng xuất"
          />
        </div>
      )}
    </>
  );
};
