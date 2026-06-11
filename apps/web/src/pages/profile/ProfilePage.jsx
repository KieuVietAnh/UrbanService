// src/pages/profile/ProfilePage.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [address, setAddress] = useState(user?.address || '');

  const handleUpdate = (e) => {
    e.preventDefault();
    alert('Đã cập nhật thông tin cá nhân thành công!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Hồ Sơ Cá Nhân</h2>
        <p className="text-xs text-gray-500 font-semibold">Quản lý thông tin tài khoản cá nhân và chi tiết liên lạc định danh công dân.</p>
      </div>

      {/* Profile Card */}
      <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-base-300 pb-5">
          <div className="avatar">
            <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img src={user?.avatarUrl} alt="Avatar" />
            </div>
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h3 className="font-extrabold text-base">{user?.fullName}</h3>
            <span className="badge badge-sm font-bold uppercase tracking-wider py-2 px-2.5 badge-primary">
              Vai trò: {user?.role}
            </span>
            <p className="text-[10px] text-gray-400 font-semibold block mt-1">Hệ thống ghi nhận: {new Date(user?.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold text-xs">Email đăng nhập (Không thể thay đổi)</span>
            </label>
            <input 
              type="email" 
              value={user?.email} 
              disabled 
              className="input input-bordered w-full text-xs font-semibold rounded-xl h-10 bg-base-200" 
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold text-xs">Họ và tên</span>
            </label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input input-bordered w-full text-xs font-semibold rounded-xl h-10" 
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold text-xs">Số điện thoại</span>
            </label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input input-bordered w-full text-xs font-semibold rounded-xl h-10" 
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold text-xs">Địa chỉ thường trú</span>
            </label>
            <input 
              type="text" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input input-bordered w-full text-xs font-semibold rounded-xl h-10" 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full rounded-xl font-bold text-xs h-10"
          >
            Lưu thay đổi hồ sơ
          </button>
        </form>
      </div>
    </div>
  );
};
