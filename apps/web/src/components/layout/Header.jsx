// src/components/layout/Header.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api/notificationApi';

export const Header = ({ onMenuToggle }) => {
  const { user, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await notificationApi.getNotifications(user.userId);
      setNotifications(res);
      setUnreadCount(res.filter(n => !n.isRead).length);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Set up polling simulation for demo real-time notifications
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = async (id) => {
    await notificationApi.markAsRead(id);
    fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await notificationApi.markAllAsRead(user.userId);
    fetchNotifications();
  };

  // Switch role helper for Capstone evaluation
  const handleRoleSwitch = async (email) => {
    try {
      await login(email, '123456');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  // Convert pathname to readable breadcrumbs
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(p => p);
    if (paths.length === 0) return 'Tổng Quan';
    
    return paths.map((path, idx) => {
      let segmentName = path;
      if (path === 'tickets') segmentName = 'Phản Ánh';
      else if (path === 'create') segmentName = 'Gửi Phản Ánh Mới';
      else if (path === 'queue') segmentName = 'Hàng Chờ Kiểm Duyệt';
      else if (path === 'duplicates') segmentName = 'Hộp Thư Trùng Lặp';
      else if (path === 'review') segmentName = 'Duyệt Kết Quả';
      else if (path === 'community') segmentName = 'Cộng Đồng';
      else if (path === 'feed') segmentName = 'Bảng Tin';
      else if (path === 'map') segmentName = 'Bản Đồ Sự Cố';
      else if (path === 'analytics') segmentName = 'Báo Cáo Phân Tích';
      else if (path === 'sla') segmentName = 'Chỉ Số SLA';
      else if (path === 'sentiment') segmentName = 'Ý Kiến Cư Dân (AI)';
      else if (path === 'heatmap') segmentName = 'Bản Đồ Nhiệt';
      else if (path === 'management') segmentName = 'Cấu Hình';
      else if (path === 'users') segmentName = 'Quản Lý Người Dùng';
      else if (path === 'categories') segmentName = 'Quản Lý Danh Mục';
      else if (path === 'integrations') segmentName = 'Kênh Tích Hợp';
      else if (path === 'profile') segmentName = 'Hồ Sơ';
      else if (path === 'settings') segmentName = 'Cài Đặt';
      
      return (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && <Lucide.ChevronRight size={14} className="text-gray-400" />}
          <span className={idx === paths.length - 1 ? 'font-bold text-base-content' : 'text-gray-400'}>
            {segmentName}
          </span>
        </span>
      );
    });
  };

  const isCitizen = user?.role === 'service-user';

  return (
    <header className="navbar bg-base-100 border-b border-base-300 px-6 py-3 h-16 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left section: Brand Logo for Citizen or Hamburger for Staff */}
      <div className="flex items-center gap-4">
        {isCitizen ? (
          <div className="flex items-center gap-2 mr-6 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="p-1.5 rounded-lg bg-primary text-primary-content">
              <Lucide.Cpu size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent leading-none">
                UrbanMind
              </h1>
              <p className="text-[8px] text-gray-500 uppercase tracking-widest font-semibold mt-0.5">CITIZEN PORTAL</p>
            </div>
          </div>
        ) : (
          <>
            <button onClick={onMenuToggle} className="btn btn-ghost btn-square lg:hidden">
              <Lucide.Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-1 text-sm font-semibold">
              {getBreadcrumbs()}
            </div>
          </>
        )}
      </div>

      {/* Middle section: Navigation links for Citizen */}
      {isCitizen && (
        <div className="hidden md:flex items-center gap-1.5">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            Trang chủ
          </NavLink>
          <NavLink
            to="/tickets/create"
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            Gửi phản ánh
          </NavLink>
          <NavLink
            to="/tickets"
            end
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            Phản ánh của tôi
          </NavLink>
          <NavLink
            to="/community/feed"
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            Bảng tin
          </NavLink>
          <NavLink
            to="/community/map"
            className={({ isActive }) =>
              `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            Bản đồ sự cố
          </NavLink>
        </div>
      )}

      {/* Right section: Walkthrough Switcher, Notification, User Profile */}
      <div className="flex items-center gap-3">
        {/* WALKTHROUGH SWITCHER */}
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-warning btn-sm gap-2 rounded-xl text-xs uppercase font-bold animate-bounce hover:animate-none">
            <Lucide.Shuffle size={16} />
            Đổi Vai Trò Demo
          </label>
          <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-72 mt-2 border border-base-300 z-50">
            <li className="menu-title px-4 py-2 text-xs font-bold text-center text-primary border-b border-base-200">
              WALKTHROUGH ROLES SWITCHER
            </li>
            <li>
              <button onClick={() => handleRoleSwitch('user@urbanmind.vn')} className="flex justify-between items-center py-3">
                <span className="font-semibold text-xs">Resident (Người Dân)</span>
                <span className="badge badge-sm badge-accent">Citizen</span>
              </button>
            </li>
            <li>
              <button onClick={() => handleRoleSwitch('staff@urbanmind.vn')} className="flex justify-between items-center py-3">
                <span className="font-semibold text-xs">System Staff (Nhân Viên)</span>
                <span className="badge badge-sm badge-info">Frontdesk</span>
              </button>
            </li>
            <li>
              <button onClick={() => handleRoleSwitch('operator@urbanmind.vn')} className="flex justify-between items-center py-3">
                <span className="font-semibold text-xs">Service Provider (Đội Kỹ Thuật)</span>
                <span className="badge badge-sm badge-warning">Operator</span>
              </button>
            </li>
            <li>
              <button onClick={() => handleRoleSwitch('manager@urbanmind.vn')} className="flex justify-between items-center py-3">
                <span className="font-semibold text-xs">Interaction Manager (Quản Lý)</span>
                <span className="badge badge-sm badge-secondary">Analyst</span>
              </button>
            </li>
            <li>
              <button onClick={() => handleRoleSwitch('admin@urbanmind.vn')} className="flex justify-between items-center py-3">
                <span className="font-semibold text-xs">Administrator (Quản Trị)</span>
                <span className="badge badge-sm badge-error">Admin</span>
              </button>
            </li>
          </ul>
        </div>

        {/* NOTIFICATION CENTER */}
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle relative">
            <div className="indicator">
              <Lucide.Bell size={20} />
              {unreadCount > 0 && (
                <span className="badge badge-xs badge-error indicator-item font-extrabold text-[8px] p-1">
                  {unreadCount}
                </span>
              )}
            </div>
          </label>
          <div tabIndex={0} className="dropdown-content card card-compact w-80 shadow bg-base-100 border border-base-300 mt-2 z-50">
            <div className="card-body p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                <h3 className="font-bold text-sm">Thông Báo</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="text-xs text-primary font-semibold hover:underline">
                    Đọc tất cả
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-base-300">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500 text-xs">Không có thông báo mới nào</div>
                ) : (
                  notifications.map((notif, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        handleMarkAsRead(notif.notificationId);
                        navigate(notif.targetUrl);
                      }}
                      className={`p-3 hover:bg-base-200 cursor-pointer flex gap-3 transition-colors ${
                        !notif.isRead ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="p-2 h-fit rounded-lg bg-base-300 text-primary">
                        <Lucide.AlertCircle size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className={`text-xs truncate ${!notif.isRead ? 'font-bold' : ''}`}>{notif.title}</h5>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <span className="text-[8px] text-gray-400 mt-1 block">
                          {new Date(notif.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User avatar dropdown (specifically for Citizen role since they have no sidebar) */}
        {isCitizen && (
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar ring-2 ring-primary ring-offset-base-100 ring-offset-2">
              <div className="w-8 rounded-full animate-fade-in">
                <img src={user.avatarUrl} alt="User Avatar" />
              </div>
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2 border border-base-300 z-50">
              <li className="menu-title px-4 py-2 text-xs font-bold text-slate-400 border-b border-slate-100">
                {user.fullName}
              </li>
              <li>
                <button onClick={() => navigate('/profile')} className="py-2.5 text-xs font-bold flex gap-2 items-center">
                  <Lucide.User size={14} />
                  Trang cá nhân
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/settings')} className="py-2.5 text-xs font-bold flex gap-2 items-center">
                  <Lucide.Settings size={14} />
                  Cài đặt
                </button>
              </li>
              <div className="divider my-0"></div>
              <li>
                <button onClick={async () => { await logout(); navigate('/login'); }} className="py-2.5 text-xs font-bold text-error flex gap-2 items-center">
                  <Lucide.LogOut size={14} />
                  Đăng xuất
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};
