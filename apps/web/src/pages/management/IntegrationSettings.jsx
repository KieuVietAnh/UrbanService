// src/pages/management/IntegrationSettings.jsx
import React, { useState, useEffect } from 'react';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const IntegrationSettings = () => {
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read from mock DB
    setIntegrations(mockDb.getIntegrations());
    setLoading(false);
  }, []);

  const handleToggle = (key) => {
    const updated = { ...integrations };
    updated[key].enabled = !updated[key].enabled;
    mockDb.updateIntegrations(updated);
    setIntegrations(updated);
    alert('Đã cập nhật cấu hình cổng tích hợp!');
  };

  if (loading || !integrations) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Cổng Tích Hợp Đa Kênh (Omnichannel)</h2>
        <p className="text-xs text-gray-500 font-semibold">Cấu hình kết nối tiếp nhận ý kiến tự động từ các mạng xã hội, tin nhắn Zalo, Messenger và biểu mẫu hotline.</p>
      </div>

      {/* Connection grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Zalo */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                  Z
                </div>
                <h4 className="font-extrabold text-sm text-base-content">Zalo Mini App &amp; OA</h4>
              </div>
              <input 
                type="checkbox" 
                checked={integrations.zalo.enabled}
                onChange={() => handleToggle('zalo')}
                className="toggle toggle-primary toggle-sm" 
              />
            </div>
            <p className="text-xs text-gray-500 font-semibold">Tự động bắt tin nhắn báo lỗi của người dân qua Zalo OA và tạo phiếu phản ánh GPS tương ứng.</p>
          </div>
          <div className="bg-base-200 p-3 rounded-2xl border border-base-300 text-[10px] font-bold text-gray-400 space-y-1">
            <div>Webhook URL: <span className="font-mono text-primary text-[9px]">{integrations.zalo.webhookUrl}</span></div>
            <div>Trạng thái: <span className="text-success">{integrations.zalo.status}</span></div>
          </div>
        </div>

        {/* Messenger */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                  <Lucide.MessageCircle size={16} />
                </div>
                <h4 className="font-extrabold text-sm text-base-content">Facebook Messenger Bot</h4>
              </div>
              <input 
                type="checkbox" 
                checked={integrations.messenger.enabled}
                onChange={() => handleToggle('messenger')}
                className="toggle toggle-primary toggle-sm" 
              />
            </div>
            <p className="text-xs text-gray-500 font-semibold">Đồng bộ hội thoại, cho phép cư dân gửi định vị và ảnh chụp trực tiếp qua Chatbot Fanpage.</p>
          </div>
          <div className="bg-base-200 p-3 rounded-2xl border border-base-300 text-[10px] font-bold text-gray-400 space-y-1">
            <div>API Endpoint: <span className="font-mono text-primary text-[9px]">{integrations.messenger.webhookUrl}</span></div>
            <div>Trạng thái: <span className="text-success">{integrations.messenger.status}</span></div>
          </div>
        </div>

        {/* Hotline */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white">
                  <Lucide.PhoneCall size={16} />
                </div>
                <h4 className="font-extrabold text-sm text-base-content">Tổng Đài Hotline Đô Thị</h4>
              </div>
              <input 
                type="checkbox" 
                checked={integrations.hotline.enabled}
                onChange={() => handleToggle('hotline')}
                className="toggle toggle-primary toggle-sm" 
              />
            </div>
            <p className="text-xs text-gray-500 font-semibold">Nhận diện cuộc gọi ghi âm, sử dụng mô hình Speech-to-Text để chuyển hóa ý kiến thành văn bản.</p>
          </div>
          <div className="bg-base-200 p-3 rounded-2xl border border-base-300 text-[10px] font-bold text-gray-400 space-y-1">
            <div>Số điện thoại: <span className="text-primary font-bold">{integrations.hotline.phone}</span></div>
            <div>Trạng thái: <span className="text-success">{integrations.hotline.status}</span></div>
          </div>
        </div>

        {/* Web Form */}
        <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-white">
                  <Lucide.Globe size={16} />
                </div>
                <h4 className="font-extrabold text-sm text-base-content">Cổng Thông Tin Web Form</h4>
              </div>
              <input 
                type="checkbox" 
                checked={integrations.webform.enabled}
                onChange={() => handleToggle('webform')}
                className="toggle toggle-primary toggle-sm" 
              />
            </div>
            <p className="text-xs text-gray-500 font-semibold">Tích hợp form gửi ý kiến trên website chính quyền thành phố, đồng bộ trường dữ liệu UrbanMind.</p>
          </div>
          <div className="bg-base-200 p-3 rounded-2xl border border-base-300 text-[10px] font-bold text-gray-400 space-y-1">
            <div>Tích hợp: <span>Sẵn sàng kết nối qua Iframe API</span></div>
            <div>Trạng thái: <span className="text-success">{integrations.webform.status}</span></div>
          </div>
        </div>

      </div>
    </div>
  );
};
