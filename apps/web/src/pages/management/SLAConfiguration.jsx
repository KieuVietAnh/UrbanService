// src/pages/management/SLAConfiguration.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { slaApi } from '../../services/api/slaApi';
import * as Lucide from 'lucide-react';

export const SLAConfiguration = () => {
  const { user } = useAuth();
  const [slaConfig, setSlaConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Input states
  const [criticalHours, setCriticalHours] = useState('');
  const [highHours, setHighHours] = useState('');
  const [mediumHours, setMediumHours] = useState('');
  const [lowHours, setLowHours] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchSla = async () => {
    setLoading(true);
    try {
      const res = await slaApi.getSlaConfig();
      setSlaConfig(res);
      setCriticalHours(res.Critical.hours);
      setHighHours(res.High.hours);
      setMediumHours(res.Medium.hours);
      setLowHours(res.Low.hours);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSla();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await slaApi.updateSlaConfig('Critical', criticalHours, user.userId);
      await slaApi.updateSlaConfig('High', highHours, user.userId);
      await slaApi.updateSlaConfig('Medium', mediumHours, user.userId);
      await slaApi.updateSlaConfig('Low', lowHours, user.userId);
      alert('Đã cập nhật cấu hình thời hạn SLA thành công!');
      fetchSla();
    } catch (err) {
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Cấu Hình Thời Hạn SLA</h2>
        <p className="text-xs text-gray-500 font-semibold">Quy định số giờ khắc phục sự cố cam kết tương ứng với từng mức độ khẩn cấp tự động trên hệ thống.</p>
      </div>

      <div className="card bg-base-100 border border-base-300 p-6 rounded-3xl shadow-sm">
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs text-error flex items-center gap-1.5">
                    <Lucide.AlertCircle size={14} />
                    Khẩn cấp (Critical) *
                  </span>
                </label>
                <div className="join">
                  <input 
                    type="number" 
                    value={criticalHours}
                    onChange={(e) => setCriticalHours(e.target.value)}
                    className="input input-bordered join-item w-full text-xs font-bold"
                    required
                  />
                  <span className="btn btn-neutral join-item font-bold text-xs">Giờ</span>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs text-warning flex items-center gap-1.5">
                    <Lucide.AlertTriangle size={14} />
                    Cao (High) *
                  </span>
                </label>
                <div className="join">
                  <input 
                    type="number" 
                    value={highHours}
                    onChange={(e) => setHighHours(e.target.value)}
                    className="input input-bordered join-item w-full text-xs font-bold"
                    required
                  />
                  <span className="btn btn-neutral join-item font-bold text-xs">Giờ</span>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs text-info flex items-center gap-1.5">
                    <Lucide.Info size={14} />
                    Trung bình (Medium) *
                  </span>
                </label>
                <div className="join">
                  <input 
                    type="number" 
                    value={mediumHours}
                    onChange={(e) => setMediumHours(e.target.value)}
                    className="input input-bordered join-item w-full text-xs font-bold"
                    required
                  />
                  <span className="btn btn-neutral join-item font-bold text-xs">Giờ</span>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs text-slate-400 flex items-center gap-1.5">
                    <Lucide.Compass size={14} />
                    Thấp (Low) *
                  </span>
                </label>
                <div className="join">
                  <input 
                    type="number" 
                    value={lowHours}
                    onChange={(e) => setLowHours(e.target.value)}
                    className="input input-bordered join-item w-full text-xs font-bold"
                    required
                  />
                  <span className="btn btn-neutral join-item font-bold text-xs">Giờ</span>
                </div>
              </div>
            </div>

            <div className="alert alert-info text-[11px] font-semibold rounded-2xl flex gap-2 mt-4">
              <Lucide.Info size={16} />
              <span>Khi người dân gửi phản ánh mới, thời hạn giải quyết tự động (`dueDate`) sẽ được cộng dồn theo cấu hình giờ ở trên.</span>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full rounded-xl font-bold text-xs mt-2"
              disabled={saveLoading}
            >
              {saveLoading ? <span className="loading loading-spinner"></span> : 'Lưu Thay Đổi SLA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
