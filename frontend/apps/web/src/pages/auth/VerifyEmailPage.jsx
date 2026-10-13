import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorAlert, SuccessAlert } from '../../components/alerts/ErrorAlert';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getRoleEntryPath } from '../../utils/roleMap';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const readApiMessage = (error, fallback) =>
  error?.response?.data?.msg ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export const VerifyEmailPage = () => {
  const { user, requestEmailVerificationOtp, verifyEmail, logout } = useAuth();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const [otpDigits, setOtpDigits] = useState(() => Array(OTP_LENGTH).fill(''));
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const inputRefs = useRef([]);
  const autoSendStarted = useRef(false);
  const redirectTo = routeLocation.state?.from || null;
  const autoSendRequested = routeLocation.state?.autoSend === true;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const focusOtpInput = useCallback((index) => {
    window.setTimeout(() => inputRefs.current[index]?.focus(), 0);
  }, []);

  const run = async (task) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError({
        title: 'Không thực hiện được',
        message: readApiMessage(err, 'Vui lòng thử lại sau ít phút.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    await requestEmailVerificationOtp();
    setOtpSent(true);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setSuccess('Mã xác thực đã được gửi tới ' + (user?.email || 'email của bạn') + '.');
    focusOtpInput(0);
  };

  useEffect(() => {
    if (!autoSendRequested || autoSendStarted.current || !user?.email) return;
    autoSendStarted.current = true;
    void run(sendOtp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendRequested, user?.email]);

  const handleOtpChange = (index, rawValue) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) focusOtpInput(index + 1);
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      focusOtpInput(index - 1);
    }
  };

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((char, position) => {
      next[position] = char;
    });
    setOtpDigits(next);
    focusOtpInput(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const handleVerify = (event) => {
    event.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== OTP_LENGTH) {
      setError({ title: 'Thiếu mã xác thực', message: 'Vui lòng nhập đủ ' + OTP_LENGTH + ' chữ số.' });
      return;
    }

    void run(async () => {
      await verifyEmail(otp);
      setSuccess('Xác thực email thành công.');
      navigate(redirectTo || getRoleEntryPath(user?.role) || '/', { replace: true });
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout brandTo={null} onBack={handleLogout} backLabel="Đổi tài khoản">
      <article className="relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_24px_65px_rgba(15,23,42,0.13)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
        <header className="relative z-10 text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Lucide.MailCheck size={27} aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-[30px] font-bold tracking-[-0.035em] text-slate-950 dark:text-white">Xác thực email</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Nhận mã OTP gồm 6 chữ số tại <strong className="text-slate-700 dark:text-slate-200">{user?.email}</strong> để hoàn tất xác thực tài khoản.
          </p>
        </header>

        {error ? <ErrorAlert title={error.title} message={error.message} className="mt-5" /> : null}
        {success ? <SuccessAlert message={success} className="mt-5" /> : null}

        {!otpSent ? (
          <button type="button" onClick={() => void run(sendOtp)} disabled={busy} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <span className="loading loading-spinner loading-sm" aria-hidden="true" /> : <Lucide.Send size={16} aria-hidden="true" />}
            {busy ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
          </button>
        ) : (
          <form onSubmit={handleVerify} className="mt-6">
            <fieldset disabled={busy}>
              <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mã xác thực</legend>
              <div className="mt-2.5 grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input key={index} ref={(element) => { inputRefs.current[index] = element; }} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} value={digit} onChange={(event) => handleOtpChange(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} aria-label={'Chữ số OTP thứ ' + (index + 1)} className="h-12 min-w-0 rounded-xl border border-slate-300 bg-white text-center text-lg font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:h-14 sm:rounded-2xl sm:text-xl dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                ))}
              </div>
            </fieldset>

            <button type="button" onClick={() => void run(sendOtp)} disabled={busy || resendIn > 0} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 transition hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-blue-300">
              <Lucide.RefreshCw size={14} aria-hidden="true" />
              {resendIn > 0 ? 'Gửi lại mã sau ' + resendIn + 's' : 'Gửi lại mã'}
            </button>

            <button type="submit" disabled={busy || otpDigits.join('').length !== OTP_LENGTH} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <span className="loading loading-spinner loading-sm" aria-hidden="true" /> : <Lucide.ShieldCheck size={16} aria-hidden="true" />}
              {busy ? 'Đang xác thực...' : 'Xác thực email'}
            </button>
          </form>
        )}
      </article>
    </AuthLayout>
  );
};

export default VerifyEmailPage;

