// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';

const normalizeRole = (role) => {
  if (!role) return role;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'serviceuser' || normalized === 'service-user') return 'service-user';
  if (normalized === 'systemstaff' || normalized === 'system-staff') return 'system-staff';
  if (normalized === 'serviceprovider' || normalized === 'service-provider') return 'service-provider';
  if (normalized === 'interactionmanager' || normalized === 'interaction-manager') return 'interaction-manager';
  if (normalized === 'systemadmin' || normalized === 'admin' || normalized === 'administrator') return 'administrator';
  return normalized;
};

const getRoleDashboard = (role) => {
  const normalizedRole = normalizeRole(role);
  const roleMap = {
    'service-user': '/dashboard',
    'system-staff': '/staff/queue',
    'service-provider': '/provider/tasks',
    'interaction-manager': '/manager/interactions',
    'administrator': '/admin/audit',
  };
  return roleMap[normalizedRole] || '/dashboard';
};

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin đăng nhập.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      
      // If email not verified, redirect to verification
      if (!user.isVerified) {
        navigate('/verify-email');
        return;
      }
      
      // Redirect to appropriate dashboard based on role
      const redirect = searchParams.get('redirect') || getRoleDashboard(user.role);
      navigate(redirect);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutofill = (autofillEmail) => {
    setEmail(autofillEmail);
    setPassword('123456');
    setError('');
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50/40 flex items-center justify-center p-6 font-sans text-slate-800">
      <div className="card w-full max-w-[420px] bg-white border border-slate-200 shadow-2xl p-8 rounded-3xl space-y-6">
        
        {/* Logo and title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#0052CC] text-white flex items-center justify-center">
            <Lucide.Building size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-[#0052CC]">UrbanMind</h3>
            <h2 className="text-lg font-black text-slate-900">Đăng nhập UrbanMind</h2>
            <p className="text-xs text-slate-400 font-semibold">Kết nối cộng đồng, kiến tạo tương lai đô thị.</p>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="alert alert-error text-xs font-semibold py-3 px-4 rounded-xl flex items-center gap-2">
            <Lucide.AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Inputs form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="form-control space-y-1">
            <label className="text-xs font-bold text-slate-500">Email hoặc số điện thoại</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lucide.AtSign size={16} />
              </span>
              <input 
                type="text" 
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full pl-10 text-xs font-medium rounded-xl h-11 border-slate-300 focus:border-[#0052CC] focus:outline-none"
              />
            </div>
          </div>

          <div className="form-control space-y-1">
            <label className="text-xs font-bold text-slate-500">Mật khẩu</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lucide.Lock size={16} />
              </span>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered w-full pl-10 pr-10 text-xs font-medium rounded-xl h-11 border-slate-300 focus:border-[#0052CC] focus:outline-none"
              />
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 cursor-pointer">
                <Lucide.Eye size={16} />
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-500">
              <input type="checkbox" className="checkbox checkbox-primary checkbox-xs rounded" />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" className="text-[#0052CC] hover:underline">Quên mật khẩu?</a>
          </div>

          <button 
            type="submit" 
            className="btn w-full bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl font-bold h-11 text-xs mt-2 flex gap-1 items-center justify-center shadow-lg shadow-blue-500/10"
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : (
              <>
                <span>Đăng nhập</span>
                <Lucide.ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="divider text-[10px] font-bold text-slate-400 my-4">HOẶC</div>

        {/* OAuth Buttons */}
        <button 
          type="button"
          className="btn btn-outline border-slate-300 hover:bg-slate-50 text-slate-700 w-full rounded-xl text-xs font-bold h-11 min-h-0 flex gap-2 justify-center items-center"
        >
          <img src="https://docs.kodular.io/guides/component-examples/google-sign-in/google.png" alt="Google logo" className="w-4 h-4 object-contain" />
          <span>Tiếp tục với Google</span>
        </button>

        {/* Registration Link */}
        <div className="text-center text-xs font-semibold text-slate-500">
          Bạn chưa có tài khoản?{' '}
          <Link to="/register" className="text-[#0052CC] hover:underline font-bold">
            Đăng ký ngay
          </Link>
        </div>

        {/* Quick entry for demo walk-through */}
        <div className="border-t border-slate-200 pt-5 space-y-2">
          <h4 className="text-[9px] uppercase font-bold text-slate-400 text-center tracking-wider mb-2">
            Đăng Nhập Nhanh Trải Nghiệm 14 Luồng
          </h4>
          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
            <button onClick={() => handleAutofill('user@urbanmind.vn')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-[#0052CC]">Người Dân (Resident)</button>
            <button onClick={() => handleAutofill('staff@urbanmind.vn')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-info">Nhân Viên (Staff)</button>
            <button onClick={() => handleAutofill('operator@urbanmind.vn')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-warning">Kỹ Thuật (Operator)</button>
            <button onClick={() => handleAutofill('manager@urbanmind.vn')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-secondary">Quản Lý (Manager)</button>
          </div>
        </div>
      </div>
    </div>
  );
};
