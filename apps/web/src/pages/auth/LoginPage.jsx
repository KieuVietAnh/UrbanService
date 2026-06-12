// src/pages/auth/LoginPage.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';

const normalizeRole = (role) => {
  if (!role) return role;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'serviceuser' || normalized === 'service-user') return 'service-user';
  if (normalized === 'systemstaff' || normalized === 'system-staff') return 'system-staff';
  if (normalized === 'serviceprovider' || normalized === 'service-provider' || normalized === 'serviceoperator' || normalized === 'service-operator') return 'service-provider';
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
  const { login, googleLogin } = useAuth();
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
      console.log('LoginPage - login returned user', user);
      console.log('LoginPage - auth context user after login', user);
      
      // If email not verified, redirect to verification
      if (!user?.isVerified) {
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

  const handleAutofill = (autofillEmail, autofillPassword = '123456789') => {
    setEmail(autofillEmail);
    setPassword(autofillPassword);
    setError('');
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const scriptId = 'google-identity-script';
    if (document.getElementById(scriptId)) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.id = scriptId;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Google login not configured.');
      return;
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setError('Google SDK not loaded yet. Vui lòng thử lại.');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          setLoading(true);
          const idToken = response?.credential;
          if (!idToken) {
            setError('Google login failed to return credential.');
            return;
          }
          const user = await googleLogin(idToken);
          if (!user?.isVerified) {
            navigate('/verify-email');
            return;
          }
          const redirect = searchParams.get('redirect') || getRoleDashboard(user.role);
          navigate(redirect);
        } catch (err) {
          setError(err.message || 'Google đăng nhập thất bại.');
        } finally {
          setLoading(false);
        }
      },
    });

    window.google.accounts.id.prompt();
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
          onClick={handleGoogleSignIn}
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

        {/* Quick login accounts */}
        <div className="border-t border-slate-200 pt-5 space-y-2">
          <h4 className="text-[9px] uppercase font-bold text-slate-400 text-center tracking-wider mb-2">
            Đăng nhập nhanh bằng tài khoản mẫu
          </h4>
          <p className="text-[10px] text-slate-500 text-center">Mật khẩu mặc định: <span className="font-semibold">123456789</span></p>
          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
            <button onClick={() => handleAutofill('anhkvse182347@fpt.edu.vn', '123456789')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-[#0052CC]">Administrator</button>
            <button onClick={() => handleAutofill('kvietanh123@gmail.com', '123456789')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-info">System Staff</button>
            <button onClick={() => handleAutofill('xbg4623@gmail.com', '123456789')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-warning">Interaction Manager</button>
            <button onClick={() => handleAutofill('xbg4622@gmail.com', '123456789')} type="button" className="btn btn-xs btn-outline rounded-lg py-2 hover:bg-secondary">Service Operator</button>
          </div>
        </div>
      </div>
    </div>
  );
};
