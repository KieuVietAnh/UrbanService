// src/pages/management/RoleManagement.jsx
import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

export const RoleManagement = () => {
  // Mock permission matrix state
  const roles = [
    { key: 'service-user', name: 'Resident (Người dân)' },
    { key: 'system-staff', name: 'System Staff (Cán bộ tiếp nhận)' },
    { key: 'service-provider', name: 'Service Provider (Kỹ thuật viên)' },
    { key: 'interaction-manager', name: 'Interaction Manager (Quản lý)' },
    { key: 'administrator', name: 'Admin Hệ Thống' }
  ];

  const permissions = [
    { key: 'ticket:create', desc: 'Tạo phiếu phản ánh sự cố đô thị' },
    { key: 'ticket:view-own', desc: 'Xem danh sách phản ánh cá nhân đã gửi' },
    { key: 'ticket:view-all', desc: 'Xem toàn bộ hàng chờ phản ánh thành phố' },
    { key: 'ticket:verify', desc: 'Duyệt/Sửa phân loại danh mục tự động của AI' },
    { key: 'ticket:merge', desc: 'Gộp trùng lặp các phản ánh (Master Ticket)' },
    { key: 'ticket:assign', desc: 'Điều phối phân việc cho đơn vị kỹ thuật' },
    { key: 'ticket:update-progress', desc: 'Cập nhật tiến độ thi công (Sửa chữa)' },
    { key: 'ticket:resolve', desc: 'Báo cáo hoàn thành sự cố đính kèm ảnh bàn giao' },
    { key: 'ticket:inspect-resolution', desc: 'Nghiệm thu hoặc yêu cầu đơn vị sửa chữa lại' },
    { key: 'ticket:rate', desc: 'Citizen đánh giá chất lượng hoàn thiện (CSAT)' },
    { key: 'analytics:view', desc: 'Xem báo cáo phân tích SLA & Cảm xúc (AI)' },
    { key: 'user:manage', desc: 'Quản lý tài khoản, vai trò và phân quyền' }
  ];

  // Map showing which roles have which permissions
  const [matrix, setMatrix] = useState({
    'service-user': ['ticket:create', 'ticket:view-own', 'ticket:rate', 'ticket:chat'],
    'system-staff': ['ticket:view-all', 'ticket:verify', 'ticket:merge', 'ticket:assign', 'ticket:inspect-resolution', 'ticket:chat'],
    'service-provider': ['ticket:view-assigned', 'ticket:update-progress', 'ticket:resolve', 'ticket:chat'],
    'interaction-manager': ['analytics:view', 'ticket:chat'],
    'administrator': ['ticket:view-all', 'user:manage', 'category:manage', 'sla:manage', 'integration:manage', 'system:logs']
  });

  const handleToggle = (roleKey, permKey) => {
    const activePerms = matrix[roleKey] || [];
    const isChecked = activePerms.includes(permKey);
    let updated;
    if (isChecked) {
      updated = activePerms.filter(p => p !== permKey);
    } else {
      updated = [...activePerms, permKey];
    }
    setMatrix(prev => ({ ...prev, [roleKey]: updated }));
  };

  const handleSave = () => {
    alert('Đã cập nhật ma trận phân quyền vai trò trên hệ thống thành công!');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black">Phân Quyền Vai Trò &amp; Quyền Hạn</h2>
          <p className="text-xs text-gray-500 font-semibold">Định cấu hình chi tiết ma trận phân quyền cho các nhóm vai trò nghiệp vụ tham gia hệ thống.</p>
        </div>
        <button 
          onClick={handleSave} 
          className="btn btn-primary rounded-xl font-bold text-xs gap-2"
        >
          <Lucide.Save size={16} />
          Lưu Cấu Hình Phân Quyền
        </button>
      </div>

      {/* Grid Matrix Table */}
      <div className="card bg-base-100 border border-base-300 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="table w-full text-xs">
            <thead>
              <tr className="bg-base-200 text-gray-500 uppercase tracking-wider font-extrabold text-[10px]">
                <th>Quyền hạn hệ thống / Tính năng</th>
                {roles.map(r => (
                  <th key={r.key} className="text-center">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {permissions.map((p) => (
                <tr key={p.key} className="hover:bg-base-200/50">
                  <td className="font-semibold text-base-content py-3">
                    <div>
                      <span className="font-extrabold text-[11px] block">{p.key}</span>
                      <span className="text-[10px] text-gray-500 font-medium block mt-0.5">{p.desc}</span>
                    </div>
                  </td>
                  {roles.map((r) => {
                    const hasPerm = (matrix[r.key] || []).includes(p.key);
                    return (
                      <td key={r.key} className="text-center py-3">
                        <input 
                          type="checkbox" 
                          checked={hasPerm}
                          onChange={() => handleToggle(r.key, p.key)}
                          className="checkbox checkbox-primary checkbox-xs mx-auto" 
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
