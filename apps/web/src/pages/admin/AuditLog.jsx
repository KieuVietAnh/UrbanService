// src/pages/admin/AuditLog.jsx
import React, { useState, useEffect } from 'react';
import { mockDb } from '../../store/mockStore';

export const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read logs from mock DB
    setLogs(mockDb.getAuditLogs());
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Nhật Ký Hoạt Động (Audit Trail)</h2>
        <p className="text-xs text-gray-500 font-semibold">Theo dõi toàn bộ lịch sử thao tác dữ liệu, cấu hình hệ thống, đảm bảo tính minh bạch và bảo mật thông tin.</p>
      </div>

      {/* Logs Table */}
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
                  <th>Tài khoản ID / Tác nhân</th>
                  <th>Hành động</th>
                  <th>Đối tượng tác động</th>
                  <th>Tọa độ IP / User Agent</th>
                  <th className="text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {logs.map((log) => (
                  <tr key={log.auditId} className="hover:bg-base-200/50">
                    <td className="font-semibold text-primary">{log.userId}</td>
                    <td className="font-bold text-base-content">{log.action}</td>
                    <td>
                      <span className="badge badge-sm font-bold uppercase py-2">
                        {log.entityName}: {log.entityId}
                      </span>
                    </td>
                    <td className="font-medium text-gray-500">
                      <div>IP: {log.ipAddress}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5 truncate max-w-xs">{log.userAgent}</div>
                    </td>
                    <td className="text-right font-bold text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
