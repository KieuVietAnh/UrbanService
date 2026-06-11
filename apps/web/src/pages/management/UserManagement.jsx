// src/pages/management/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../services/api/userApi';
import * as Lucide from 'lucide-react';

export const UserManagement = () => {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states to create user
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('service-user');
  const [operatorId, setOperatorId] = useState('1');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getUsers();
      setUsers(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (userId, currentActive) => {
    try {
      await userApi.updateUserStatus(userId, !currentActive, currentAdmin.userId);
      fetchUsers();
      alert('Đã cập nhật trạng thái tài khoản thành công.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !phone) return;
    setCreateLoading(true);
    try {
      await userApi.createUser({
        fullName,
        email,
        phoneNumber: phone,
        role,
        operatorId: role === 'service-provider' ? Number(operatorId) : null
      }, currentAdmin.userId);
      
      alert('Tạo người dùng mới thành công! Mật khẩu mặc định là: 123456');
      setShowCreateModal(false);
      
      // Reset
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('service-user');
      
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Lỗi khi tạo tài khoản.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black">Quản Lý Người Dùng</h2>
          <p className="text-xs text-gray-500 font-semibold">Thêm tài khoản mới, phân chia vai trò nghiệp vụ và khóa/mở khóa tài khoản truy cập hệ thống.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn btn-primary rounded-xl font-bold text-xs gap-2"
        >
          <Lucide.UserPlus size={16} />
          Tạo Người Dùng Mới
        </button>
      </div>

      {/* Users Table */}
      <div className="card bg-base-100 border border-base-300 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="table w-full text-xs">
              <thead>
                <tr className="bg-base-200 text-gray-500 uppercase tracking-wider font-extrabold text-[10px]">
                  <th>Họ và tên / Email</th>
                  <th>Số điện thoại</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {users.map((u) => (
                  <tr key={u.userId} className="hover:bg-base-200/50">
                    <td className="font-semibold">
                      <div className="flex items-center gap-3">
                        <div className="avatar">
                          <div className="w-8 h-8 rounded-full">
                            <img src={u.avatarUrl} alt="Avatar" />
                          </div>
                        </div>
                        <div>
                          <span className="font-bold text-base-content block">{u.fullName}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="font-medium text-gray-500">{u.phoneNumber}</td>
                    <td>
                      <span className="badge badge-sm font-bold uppercase py-2 px-2.5">
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sm font-bold uppercase py-2 px-2.5 ${
                        u.isActive ? 'badge-success text-white' : 'badge-neutral'
                      }`}>
                        {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="text-right">
                      {u.userId !== currentAdmin.userId && (
                        <button 
                          onClick={() => handleToggleStatus(u.userId, u.isActive)}
                          className={`btn btn-xs rounded-lg font-bold ${
                            u.isActive ? 'btn-error btn-outline' : 'btn-primary'
                          }`}
                        >
                          {u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box rounded-3xl border border-base-300 max-w-md p-6 space-y-4">
            <h3 className="font-extrabold text-base text-primary flex items-center gap-2">
              <Lucide.UserPlus size={20} />
              Tạo Người Dùng Hệ Thống
            </h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs">Họ và tên *</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Trần Quốc Toản"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input input-bordered w-full text-xs font-semibold rounded-xl h-10"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs">Email đăng nhập *</span>
                </label>
                <input 
                  type="email" 
                  placeholder="account@urbanmind.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input input-bordered w-full text-xs font-semibold rounded-xl h-10"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs">Số điện thoại *</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="09XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input input-bordered w-full text-xs font-semibold rounded-xl h-10"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs">Vai trò phân nhiệm *</span>
                </label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="select select-bordered select-sm rounded-xl font-bold"
                  required
                >
                  <option value="service-user">Resident (Người dân)</option>
                  <option value="system-staff">System Staff (Nhân viên)</option>
                  <option value="service-provider">Service Provider (Đội kỹ thuật)</option>
                  <option value="interaction-manager">Interaction Manager (Quản lý)</option>
                  <option value="administrator">Administrator (Quản trị viên)</option>
                </select>
              </div>

              {role === 'service-provider' && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold text-xs">Gắn đơn vị vận hành công ích</span>
                  </label>
                  <select 
                    value={operatorId} 
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="select select-bordered select-sm rounded-xl font-bold"
                  >
                    <option value="1">Đơn vị Điện chiếu sáng</option>
                    <option value="2">Đơn vị Thu gom Rác thải</option>
                    <option value="3">Tổng công ty Cấp nước SAWACO</option>
                    <option value="4">Khu quản lý cầu đường bộ số 1</option>
                    <option value="5">Đơn vị Công viên Cây xanh</option>
                  </select>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-sm btn-ghost rounded-xl text-[10px]"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary rounded-xl text-[10px] font-bold animate-pulse hover:animate-none"
                  disabled={createLoading}
                >
                  {createLoading ? <span className="loading loading-spinner"></span> : 'Thêm tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
