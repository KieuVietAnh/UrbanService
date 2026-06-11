// src/pages/settings/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';

export const SettingsPage = () => {
  const [theme, setTheme] = useState('dark');
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(false);

  useEffect(() => {
    // Read theme from html document data-theme attribute
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme);
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('urbanmind_theme', newTheme);
  };

  const handleSaveSettings = () => {
    alert('Đã cập nhật cấu hình cá nhân thành công!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Cài Đặt Hệ Thống</h2>
        <p className="text-xs text-gray-500 font-semibold">Tùy biến giao diện (Theme), cài đặt kênh nhận thông báo và cấu hình riêng tư tài khoản.</p>
      </div>

      {/* Main Settings Card */}
      <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-6">
        
        {/* Themes Selection */}
        <div className="space-y-3">
          <h4 className="font-extrabold text-sm border-b border-base-300 pb-2 flex items-center gap-2">
            <Lucide.Palette size={16} className="text-primary" />
            <span>Giao diện ứng dụng (Theme)</span>
          </h4>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
            <button 
              onClick={() => handleThemeChange('corporate')}
              className={`btn btn-sm rounded-xl ${theme === 'corporate' ? 'btn-primary' : 'btn-outline'}`}
            >
              Corporate (Sáng)
            </button>
            <button 
              onClick={() => handleThemeChange('dark')}
              className={`btn btn-sm rounded-xl ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
            >
              Dark Mode (Tối)
            </button>
            <button 
              onClick={() => handleThemeChange('emerald')}
              className={`btn btn-sm rounded-xl ${theme === 'emerald' ? 'btn-primary' : 'btn-outline'}`}
            >
              Emerald (Xanh)
            </button>
            <button 
              onClick={() => handleThemeChange('synthwave')}
              className={`btn btn-sm rounded-xl ${theme === 'synthwave' ? 'btn-primary' : 'btn-outline'}`}
            >
              Synthwave (Neon)
            </button>
          </div>
        </div>

        {/* Notifications Channel Settings */}
        <div className="space-y-3">
          <h4 className="font-extrabold text-sm border-b border-base-300 pb-2 flex items-center gap-2">
            <Lucide.BellRing size={16} className="text-primary" />
            <span>Kênh nhận thông báo</span>
          </h4>

          <div className="space-y-2 text-xs">
            <label className="label cursor-pointer flex justify-between bg-base-200 p-3 rounded-xl border border-base-300">
              <div className="space-y-0.5">
                <span className="label-text font-bold text-xs block">Thông báo đẩy (Web Push)</span>
                <span className="text-[10px] text-gray-500 font-semibold block">Nhận thông báo cập nhật trạng thái sự cố trực tiếp trên trình duyệt.</span>
              </div>
              <input 
                type="checkbox" 
                checked={pushNotifs} 
                onChange={(e) => setPushNotifs(e.target.checked)}
                className="checkbox checkbox-primary checkbox-sm" 
              />
            </label>

            <label className="label cursor-pointer flex justify-between bg-base-200 p-3 rounded-xl border border-base-300">
              <div className="space-y-0.5">
                <span className="label-text font-bold text-xs block">Email thông báo</span>
                <span className="text-[10px] text-gray-500 font-semibold block">Gửi email định kỳ tóm tắt tiến trình xử lý sự cố.</span>
              </div>
              <input 
                type="checkbox" 
                checked={emailNotifs} 
                onChange={(e) => setEmailNotifs(e.target.checked)}
                className="checkbox checkbox-primary checkbox-sm" 
              />
            </label>
          </div>
        </div>

        {/* Save button */}
        <button 
          onClick={handleSaveSettings}
          className="btn btn-primary w-full rounded-xl font-bold text-xs"
        >
          Lưu cài đặt cấu hình
        </button>

      </div>
    </div>
  );
};
