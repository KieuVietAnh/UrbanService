// src/pages/auth/VerifyEmailPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';

export const VerifyEmailPage = () => {
  const { user, sendOtp, verifyOtp, logout } = useAuth();
  const navigate = useNavigate();
  
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Check if user is authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Countdown timer for resend OTP
  useEffect(() => {
    let interval;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleSendOtp = async () => {
    setSendingOtp(true);
    setError('');
    try {
      await sendOtp();
      setOtpSent(true);
      setCountdown(60); // 60 seconds cooldown
      setSuccess('Mã OTP đã được gửi đến email của bạn.');
    } catch (err) {
      setError(err.message || 'Không thể gửi mã OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otp);
      setSuccess('Xác thực email thành công!');
      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Mã OTP không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base-300">
        <span className="loading loading-ring loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50/40 flex items-center justify-center p-6 font-sans text-slate-800">
      <div className="card w-full max-w-[480px] bg-white border border-slate-200 shadow-2xl p-8 rounded-3xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Lucide.ShieldCheck size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900">Xác Thực Email</h2>
            <p className="text-sm text-slate-500 font-medium">
              Chúng tôi đã gửi mã xác thực tới <span className="font-bold text-slate-700">{user?.email}</span>
            </p>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="alert alert-error text-xs font-semibold py-3 px-4 rounded-xl flex items-center gap-2">
            <Lucide.AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success notification */}
        {success && (
          <div className="alert alert-success text-xs font-semibold py-3 px-4 rounded-xl flex items-center gap-2">
            <Lucide.CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Step 1: Send OTP Button */}
        {!otpSent && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-blue-900">
                Nhấn nút bên dưới để nhận mã xác thực qua email
              </p>
            </div>
            <button
              onClick={handleSendOtp}
              disabled={sendingOtp}
              className="btn w-full bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl font-bold h-12 text-sm flex gap-2 items-center justify-center shadow-lg shadow-blue-500/10"
            >
              {sendingOtp ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <Lucide.Mail size={18} />
                  <span>Gửi Mã OTP</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: OTP Input Form */}
        {otpSent && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">Nhập Mã OTP</label>
              <input
                type="text"
                maxLength="6"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="input input-bordered w-full text-center text-2xl font-black tracking-[0.3em] rounded-xl h-14 border-slate-300 focus:border-[#0052CC] focus:outline-none"
              />
              <p className="text-xs text-slate-400 font-medium text-center">
                Nhập 6 chữ số được gửi đến email của bạn
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="btn w-full bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl font-bold h-12 text-sm flex gap-2 items-center justify-center shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <Lucide.CheckCircle size={18} />
                  <span>Xác Thực OTP</span>
                </>
              )}
            </button>

            {/* Resend OTP */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-xs text-slate-500 font-semibold">
                  Gửi lại mã trong <span className="font-bold text-slate-700">{countdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="text-xs font-bold text-[#0052CC] hover:underline disabled:opacity-50"
                >
                  {sendingOtp ? 'Đang gửi...' : 'Gửi lại mã'}
                </button>
              )}
            </div>
          </form>
        )}

        {/* Divider */}
        {otpSent && <div className="divider text-[10px] font-bold text-slate-400 my-2">HOẶC</div>}

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-outline border-slate-300 hover:bg-slate-50 text-slate-700 w-full rounded-xl text-sm font-bold h-11 min-h-0"
        >
          <Lucide.LogOut size={16} />
          <span>Đăng Xuất</span>
        </button>

        {/* Help text */}
        <div className="text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p>
            Nếu không nhận được mã OTP, hãy kiểm tra thư mục Spam hoặc{' '}
            <a href="#" className="text-[#0052CC] hover:underline font-bold">
              liên hệ hỗ trợ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
