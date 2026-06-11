// src/components/layout/Sidebar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Import all sidebar menus
import userMenu from '../../roles/service-user/sidebarMenu';
import staffMenu from '../../roles/system-staff/sidebarMenu';
import providerMenu from '../../roles/service-provider/sidebarMenu';
import managerMenu from '../../roles/interaction-manager/sidebarMenu';
import adminMenu from '../../roles/administrator/sidebarMenu';

const menuMapping = {
  'service-user': userMenu,
  'system-staff': staffMenu,
  'service-provider': providerMenu,
  'interaction-manager': managerMenu,
  'administrator': adminMenu
};

const getRoleNameVietnamese = (role) => {
  switch (role) {
    case 'service-user': return 'Người Dân';
    case 'system-staff': return 'Nhân Viên Tiếp Nhận';
    case 'service-provider': return 'Đơn Vị Xử Lý';
    case 'interaction-manager': return 'Quản Lý Tương Tác';
    case 'administrator': return 'Quản Trị Viên';
    default: return 'Khách';
  }
};

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const menuItems = menuMapping[user.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Helper to render icon by string name
  const renderIcon = (iconName, className) => {
    const IconComponent = Lucide[iconName];
    if (IconComponent) {
      return <IconComponent className={className} size={20} />;
    }
    return <Lucide.HelpCircle className={className} size={20} />;
  };

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-base-200 border-r border-base-300 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-base-300">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary text-primary-content">
              <Lucide.Cpu size={24} className="animate-pulse" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                UrbanMind
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">ECOSYSTEM</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost lg:hidden">
            <Lucide.X size={20} />
          </button>
        </div>

        {/* User Card */}
        <div className="px-6 py-4 border-b border-base-300 bg-base-100/50 flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 rounded-full ring-2 ring-primary ring-offset-base-100 ring-offset-2">
              <img src={user.avatarUrl} alt="User Avatar" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate">{user.fullName}</h4>
            <div className="badge badge-primary badge-xs py-2 px-2 text-[10px] uppercase font-bold mt-1">
              {getRoleNameVietnamese(user.role)}
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  isActive 
                    ? 'bg-primary text-primary-content shadow-lg shadow-primary/20' 
                    : 'text-base-content/75 hover:bg-base-300/80 hover:text-base-content'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {renderIcon(item.icon, isActive ? 'text-primary-content' : 'text-gray-400 group-hover:text-primary transition-colors')}
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-base-300">
          <button 
            onClick={handleLogout}
            className="btn btn-error btn-outline w-full gap-2 rounded-xl"
          >
            <Lucide.LogOut size={18} />
            Đăng Xuất
          </button>
        </div>
      </div>
    </aside>
  );
};
