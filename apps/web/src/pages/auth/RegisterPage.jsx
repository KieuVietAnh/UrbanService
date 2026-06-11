// src/pages/auth/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Registration Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password || !phone) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(fullName, email, password, phone);
      // Redirect to email verification page
      navigate('/verify-email');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-base-200 via-base-300 to-primary/10 flex items-center justify-center p-6 font-sans">
      <div className="card w-full max-w-lg bg-base-100 border border-base-300 shadow-2xl p-8 rounded-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary text-primary-content">
              <Lucide.Cpu size={24} className="animate-pulse" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              UrbanMind
            </span>
          </Link>
          <h2 className="text-lg font-bold text-gray-500">ĐĂNG KÝ TÀI KHOẢN NGƯỜI DÂN</h2>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error text-xs font-semibold rounded-xl flex items-center gap-2 py-3 px-4">
            <Lucide.AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text font-bold text-xs">Họ và tên *</span>
            </label>
            <input 
              type="text" 
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input input-bordered w-full text-xs font-medium rounded-xl h-11"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold text-xs">Email liên lạc *</span>
            </label>
            <input 
              type="email" 
              placeholder="user@urbanmind.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered w-full text-xs font-medium rounded-xl h-11"
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
              className="input input-bordered w-full text-xs font-medium rounded-xl h-11"
              required
            />
          </div>

          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text font-bold text-xs">Mật khẩu bảo mật *</span>
            </label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered w-full text-xs font-medium rounded-xl h-11"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary md:col-span-2 w-full rounded-xl font-bold shadow-lg shadow-primary/20 h-11 text-xs mt-2"
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : 'ĐĂNG KÝ TÀI KHOẢN'}
          </button>
        </form>

        {/* Back to login */}
        <div className="text-center text-xs font-semibold text-gray-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-primary hover:underline font-bold">
            Đăng nhập tại đây
          </Link>
        </div>
      </div>
    </div>
  );
};
