// src/pages/auth/LoginPage.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { normalizePhone } from '@urbanmind/shared-api';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api/authApi';
import { useGoogleIdentity } from '../../hooks/useGoogleIdentity';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { AuthLayout } from '../../components/auth/AuthLayout';
import * as Lucide from 'lucide-react';
import { getRoleEntryPath } from '../../utils/roleMap';
import { buildAuthPath, getSafeInternalPath } from '../../utils/authRedirect';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const FORGOT_OTP_RESEND_COOLDOWN_SECONDS = 60;

const getAuthErrorMessage = (err, mode = 'login') => {
  const status = err?.status ?? err?.response?.status;
  const rawMessage = (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    ''
  );
  const normalized = String(rawMessage).toLowerCase();

  if (mode === 'google') {
    if (status === 400 || status === 401 || status === 403) {
      return 'Không thể đăng nhập bằng Google. Tài khoản phải tồn tại và đang hoạt động.';
    }
    if (status >= 500) {
      return 'Google Login tạm thời chưa khả dụng. Vui lòng thử lại sau.';
    }
    return 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.';
  }

  if (status === 401 || normalized.includes('invalid credentials')) {
    return 'Email, số điện thoại hoặc mật khẩu không chính xác.';
  }
  if (status === 403) {
    return 'Tài khoản hiện không được phép đăng nhập. Vui lòng kiểm tra trạng thái tài khoản.';
  }
  if (status === 429) {
    return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.';
  }
  if (status >= 500) {
    return 'Hệ thống đăng nhập đang gặp sự cố. Vui lòng thử lại sau.';
  }
  return 'Đăng nhập thất bại. Vui lòng thử lại.';
};

const LOGIN_INTENT_META = {
  'messenger-link': {
    icon: Lucide.Link2,
    title: 'Đăng nhập để liên kết Messenger',
    description: 'Sau khi đăng nhập và xác thực số điện thoại, bạn sẽ quay lại bước xác nhận liên kết.',
  },
  'create-feedback': {
    icon: Lucide.MessageSquarePlus,
    title: 'Đăng nhập để gửi phản ánh',
    description: 'Sau khi đăng nhập, bạn sẽ được đưa thẳng đến biểu mẫu gửi phản ánh.',
  },
  'my-feedbacks': {
    icon: Lucide.FolderClock,
    title: 'Đăng nhập để xem phản ánh của bạn',
    description: 'UrbanMind sẽ mở danh sách phản ánh và tiến độ xử lý ngay sau khi đăng nhập.',
  },
  'community-interaction': {
    icon: Lucide.MessagesSquare,
    title: 'Đăng nhập để tham gia trao đổi',
    description: 'Bạn vẫn có thể xem thông tin công khai; đăng nhập là cần thiết khi bình luận hoặc bày tỏ quan tâm.',
  },
};

const TEST_ROLE_ACCOUNTS = [
  {
    label: 'Administrator',
    description: 'Quản trị hệ thống',
    email: 'anhkvse182347@fpt.edu.vn',
    icon: Lucide.ShieldCheck,
  },
  {
    label: 'System Staff',
    description: 'Xử lý sự vụ được giao',
    email: 'kvietanh123@gmail.com',
    icon: Lucide.UsersRound,
  },
  {
    label: 'Interaction Manager',
    description: 'Duyệt tương tác',
    email: 'xbg4623@gmail.com',
    icon: Lucide.ClipboardCheck,
  },
  {
    label: 'Service Operator',
    description: 'Xử lý dịch vụ',
    email: 'xbg4622@gmail.com',
    icon: Lucide.Wrench,
  },
];

// Test-only role shortcuts are visible only in Vite development builds.
// Production builds replace import.meta.env.DEV with false.
const SHOW_TEST_ROLE_ACCOUNTS = import.meta.env.DEV;

const GoogleLogo = () => (
  <svg aria-label="Google" width="17" height="17" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g>
      <path d="m0 0H512V512H0" fill="#fff" />
      <path fill="#34a853" d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341" />
      <path fill="#4285f4" d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57" />
      <path fill="#fbbc02" d="m90 341a208 200 0 010-171l63 49q-12 37 0 73" />
      <path fill="#ea4335" d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55" />
    </g>
  </svg>
);

export const LoginPage = () => {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const loginIntent = LOGIN_INTENT_META[searchParams.get('intent')];
  const LoginIntentIcon = loginIntent?.icon;
  const requestedRedirect = (
    getSafeInternalPath(searchParams.get('redirect')) ||
    getSafeInternalPath(location.state?.from)
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotResendCountdown, setForgotResendCountdown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);
  const forgotOtpRefs = useRef([]);

  useEffect(() => {
    if (forgotResendCountdown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setForgotResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [forgotResendCountdown]);

  const resolveRedirect = (role) => requestedRedirect || getRoleEntryPath(role);

  const handleLogin = async (event) => {
    event?.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError('Vui lòng nhập email hoặc số điện thoại.');
      return;
    }

    /*
     * Chấp nhận cả email lẫn số điện thoại: người dùng đăng ký bằng cả hai nên nhớ
     * cái nào thì cho dùng cái đó. Backend tự nhận dạng, ở đây chỉ chặn chuỗi không
     * ra hình dạng nào cả.
     */
    if (!EMAIL_PATTERN.test(normalizedEmail) && !normalizePhone(normalizedEmail)) {
      setError('Nhập email hợp lệ hoặc số điện thoại 10 chữ số.');
      return;
    }

    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const user = await login(normalizedEmail, password);

      /*
       * Chưa xác thực số điện thoại vẫn vào thẳng trang chính. Ràng buộc chỉ áp khi
       * gửi phản ánh, nên chặn ngay ở cửa đăng nhập là chặn thừa: người chỉ muốn
       * xem bảng tin hay bản đồ sự cố không có lý do gì phải nhận một tin SMS.
       */
      navigate(resolveRedirect(user?.role), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAutofill = (autofillEmail, autofillPassword = '123456789') => {
    setEmail(autofillEmail);
    setPassword(autofillPassword);
    setError('');
  };

  const openForgotPassword = () => {
    setForgotMode(true);
    setForgotStep('request');
    setForgotEmail(email.trim());
    setForgotOtp('');
    setForgotPassword('');
    setForgotConfirmPassword('');
    setShowForgotPassword(false);
    setShowForgotConfirmPassword(false);
    setForgotError('');
    setForgotMessage('');
    setForgotSuccess(false);
    setForgotResendCountdown(0);
  };

  const closeForgotPassword = () => {
    setForgotMode(false);
    setForgotStep('request');
    setForgotOtp('');
    setForgotPassword('');
    setForgotConfirmPassword('');
    setShowForgotPassword(false);
    setShowForgotConfirmPassword(false);
    setForgotError('');
    setForgotMessage('');
    setForgotSuccess(false);
    setForgotResendCountdown(0);
  };


  const updateForgotOtpDigit = (index, rawValue) => {
    const digit = String(rawValue || '').replace(/\D/g, '').slice(-1);
    const digits = Array.from({ length: 6 }, (_, digitIndex) => forgotOtp[digitIndex] || '');
    digits[index] = digit;
    setForgotOtp(digits.join(''));
    setForgotError('');

    if (digit && index < 5) {
      forgotOtpRefs.current[index + 1]?.focus();
    }
  };

  const handleForgotOtpKeyDown = (index, event) => {
    if (event.key !== 'Backspace') return;

    if (forgotOtp[index]) {
      const digits = Array.from({ length: 6 }, (_, digitIndex) => forgotOtp[digitIndex] || '');
      digits[index] = '';
      setForgotOtp(digits.join(''));
      return;
    }

    if (index > 0) {
      forgotOtpRefs.current[index - 1]?.focus();
    }
  };

  const handleForgotOtpPaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    event.preventDefault();
    setForgotOtp(pasted);
    setForgotError('');
    forgotOtpRefs.current[Math.max(0, Math.min(pasted.length, 6) - 1)]?.focus();
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    if (forgotLoading) return;

    const normalizedEmail = forgotEmail.trim();
    setForgotError('');
    setForgotMessage('');

    if (!normalizedEmail) {
      setForgotError('Vui lòng nhập email tài khoản.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setForgotError('Địa chỉ email không đúng định dạng.');
      return;
    }

    if (forgotStep === 'request') {
      setForgotLoading(true);
      try {
        await authApi.requestForgotPasswordOtp(normalizedEmail);
        setForgotStep('verify');
        setForgotResendCountdown(FORGOT_OTP_RESEND_COOLDOWN_SECONDS);
        setForgotMessage('Nếu email hợp lệ, mã OTP đã được gửi. Mã có hiệu lực trong 5 phút.');
      } catch {
        setForgotError('Không thể gửi mã OTP. Vui lòng thử lại.');
      } finally {
        setForgotLoading(false);
      }
      return;
    }

    const normalizedOtp = forgotOtp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setForgotError('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }

    if (forgotStep === 'verify') {
      setForgotLoading(true);
      try {
        await authApi.verifyForgotPasswordOtp(normalizedEmail, normalizedOtp);
        setForgotStep('reset');
        setForgotMessage('');
      } catch (verifyError) {
        const apiMessage = verifyError?.response?.data?.msg;
        setForgotError(apiMessage || 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng kiểm tra và thử lại.');
      } finally {
        setForgotLoading(false);
      }
      return;
    }

    if (!forgotPassword.trim()) {
      setForgotError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (forgotPassword.length < MIN_PASSWORD_LENGTH) {
      setForgotError(`Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }

    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setForgotLoading(true);
    try {
      await authApi.resetForgottenPassword(
        normalizedEmail,
        normalizedOtp,
        forgotPassword
      );
      setEmail(normalizedEmail);
      setForgotStep('success');
      setForgotMessage('');
      setForgotSuccess(true);
      setForgotOtp('');
      setForgotPassword('');
      setForgotConfirmPassword('');
    } catch {
      setForgotError('Không thể đổi mật khẩu. Vui lòng kiểm tra mã OTP và thử lại.');
    } finally {
      setForgotLoading(false);
    }
  };
  const handleGoogleLoginCallback = useCallback(
    async (response) => {
      try {
        setLoading(true);
        const idToken = response?.credential;
        if (!idToken) {
          setError('Google không trả về thông tin xác thực. Vui lòng thử lại.');
          return;
        }

        const user = await googleLogin(idToken);

        // Cùng lý do với đăng nhập bằng mật khẩu: không ép xác thực ngay ở cửa vào.
        const redirect = requestedRedirect || getRoleEntryPath(user?.role);
        navigate(redirect, { replace: true });
      } catch (err) {
        setError(getAuthErrorMessage(err, 'google'));
      } finally {
        setLoading(false);
      }
    },
    [googleLogin, navigate, requestedRedirect],
  );

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  useGoogleIdentity(googleClientId, handleGoogleLoginCallback);

  const handleGoogleSignIn = () => {
    if (!googleClientId) {
      setError('Đăng nhập bằng Google chưa được cấu hình.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setError('Dịch vụ đăng nhập Google chưa tải xong. Vui lòng thử lại.');
      return;
    }

    window.google.accounts.id.prompt();
  };

  const quickRoleAccess = SHOW_TEST_ROLE_ACCOUNTS ? (
    <aside
      className="auth-quick-access rounded-3xl border border-white/80 bg-white/76 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/65"
      aria-labelledby="test-role-accounts-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Kiểm thử giao diện
          </p>
          <h2 id="test-role-accounts-title" className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            Đăng nhập nhanh theo role
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Mật khẩu: 123456789
        </span>
      </div>

      {/* TEST-ONLY QUICK ROLE ACCOUNTS. Hidden automatically in production. */}
      <div className="auth-role-grid mt-4 grid grid-cols-2 gap-2.5">
        {TEST_ROLE_ACCOUNTS.map(({ label, description, email: accountEmail, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleAutofill(accountEmail)}
            className="auth-role-card group flex min-h-[62px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900/75 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-300">
              <Icon size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">
                {label}
              </strong>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-400">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  ) : null;

  return (
    <AuthLayout quickAccess={forgotMode ? null : quickRoleAccess}>
      <article className={`auth-login-card relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_65px_rgba(15,23,42,0.13)] dark:border-slate-700 dark:bg-slate-900 ${forgotMode ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}`}>
        <svg
          className="pointer-events-none absolute right-0 top-0 h-36 w-60 text-blue-600"
          viewBox="0 0 240 144"
          fill="none"
          aria-hidden="true"
        >
          <path d="M20 98C72 61 111 118 164 72C193 47 212 41 252 48" stroke="currentColor" strokeWidth="1.2" className="opacity-[0.07]" />
          <path d="M34 116C83 82 121 128 176 89C202 70 222 67 254 73" stroke="currentColor" strokeWidth="1" strokeDasharray="5 8" className="opacity-[0.055]" />
          <circle cx="164" cy="72" r="5" className="fill-blue-500/10" />
          <circle cx="208" cy="48" r="7" className="fill-emerald-500/10" />
          <circle cx="208" cy="48" r="15" stroke="currentColor" className="opacity-[0.05]" />
        </svg>

        <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-blue-50/65 blur-2xl dark:bg-blue-950/20" aria-hidden="true" />
        <header className="relative z-10">
          <span className="auth-login-badge inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {forgotMode ? <Lucide.KeyRound size={14} aria-hidden="true" /> : <Lucide.LogIn size={14} aria-hidden="true" />}
            {forgotMode ? 'Khôi phục tài khoản UrbanMind' : 'Cổng tài khoản UrbanMind'}
          </span>
          <h1 id="auth-page-title" className={`auth-login-title font-bold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white ${forgotMode ? 'mt-4 text-[28px]' : 'mt-5 text-[30px]'}`}>
            {forgotMode
              ? forgotSuccess
                ? 'Đổi mật khẩu thành công'
                : forgotStep === 'request'
                  ? 'Quên mật khẩu'
                  : forgotStep === 'verify'
                    ? 'Xác thực mã OTP'
                    : 'Tạo mật khẩu mới'
              : 'Chào mừng bạn trở lại'}
          </h1>
          <p className="auth-login-description mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {forgotMode
              ? (forgotSuccess
                ? 'Mật khẩu của bạn đã được cập nhật. Hãy quay lại đăng nhập bằng mật khẩu mới.'
                : forgotStep === 'request'
                  ? 'Nhập email tài khoản để nhận mã xác thực.'
                  : forgotStep === 'verify'
                    ? 'Nhập mã OTP 6 chữ số đã được gửi tới email của bạn.'
                    : 'Tạo mật khẩu mới sau khi mã OTP đã được xác thực.')
              : 'Đăng nhập để theo dõi phản ánh, cập nhật tiến độ và tham gia trao đổi cùng cộng đồng.'}
          </p>
        </header>

        {!forgotMode ? (
          <div className="auth-login-alerts relative z-10 mt-6 space-y-4">
          {loginIntent && !error ? (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-100">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-200">
                <LoginIntentIcon size={16} aria-hidden="true" />
              </span>
              <div>
                <strong className="block font-bold">{loginIntent.title}</strong>
                <p className="mt-1 leading-5 text-blue-800/75 dark:text-blue-200/75">
                  {loginIntent.description}
                </p>
              </div>
            </div>
          ) : null}

          {sessionExpired && !error ? (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
              <Lucide.ClockAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.</p>
            </div>
          ) : null}

          {error ? (
            <ErrorAlert
              title="Lỗi đăng nhập"
              message={error}
              onClose={() => setError('')}
            />
          ) : null}
          </div>
        ) : null}

        {!forgotMode ? (
          <form onSubmit={handleLogin} className="auth-login-form relative z-10 mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email hoặc số điện thoại
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.AtSign size={17} />
              </span>
              <input
                id="login-email"
                name="email"
                type="text"
                autoComplete="username"
                placeholder="name@email.com hoặc 0901 234 567"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError('');
                }}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mật khẩu
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.Lock size={17} />
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError('');
                }}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-12 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                {showPassword ? <Lucide.EyeOff size={17} aria-hidden="true" /> : <Lucide.Eye size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                Đang đăng nhập...
              </>
            ) : (
              <>
                Đăng nhập
                <Lucide.ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
          <button type="button" onClick={openForgotPassword} className="w-full text-center text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
            Quên mật khẩu?
          </button>
          </form>
        ) : null}

        {forgotMode ? (
          forgotSuccess ? (
            <section className="relative z-10 mt-6 text-center" aria-live="polite">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Lucide.CircleCheckBig size={32} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                Mật khẩu đã được cập nhật
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                Bạn có thể đăng nhập lại bằng mật khẩu mới vừa tạo.
              </p>
              <button
                type="button"
                onClick={closeForgotPassword}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Lucide.ArrowLeft size={17} aria-hidden="true" />
                Quay lại đăng nhập
              </button>
            </section>
          ) : (
          <section className="relative z-10 mt-5" aria-labelledby="forgot-password-title">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/55">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {forgotStep === 'request'
                  ? <Lucide.Mail size={17} aria-hidden="true" />
                  : forgotStep === 'verify'
                    ? <Lucide.ShieldCheck size={17} aria-hidden="true" />
                    : <Lucide.KeyRound size={17} aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <h2 id="forgot-password-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  {forgotStep === 'request'
                    ? 'Nhận mã xác thực'
                    : forgotStep === 'verify'
                      ? 'Xác thực OTP'
                      : 'Đặt mật khẩu mới'}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {forgotStep === 'request'
                    ? 'UrbanMind sẽ gửi mã OTP đến email đã đăng ký.'
                    : forgotStep === 'verify'
                      ? 'OTP gồm đúng 6 chữ số · hiệu lực 5 phút · tối đa 5 lần nhập sai.'
                      : `Mật khẩu mới phải có tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`}
                </p>
              </div>
            </div>

            {forgotError ? (
              <div className="mt-3">
                <ErrorAlert title="Không thể khôi phục mật khẩu" message={forgotError} onClose={() => setForgotError('')} />
              </div>
            ) : null}

            {forgotMessage ? (
              <div role="status" className="mt-3 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                <Lucide.CircleCheck size={16} className="shrink-0" aria-hidden="true" />
                <p className="leading-5">{forgotMessage}</p>
              </div>
            ) : null}

            <form onSubmit={handleForgotPassword} className="mt-4 space-y-3.5">
              {forgotStep === 'request' ? (
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email tài khoản</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true"><Lucide.AtSign size={17} /></span>
                    <input id="forgot-email" aria-label="Email khôi phục" type="email" autoComplete="email" inputMode="email" value={forgotEmail}
                      onChange={(event) => { setForgotEmail(event.target.value); setForgotError(''); }} placeholder="name@email.com"
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-950">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Email xác minh</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{forgotEmail}</p>
                    </div>
                    {forgotStep === 'verify' ? (
                      <button type="button" onClick={() => { setForgotStep('request'); setForgotOtp(''); setForgotPassword(''); setForgotConfirmPassword(''); setForgotMessage(''); setForgotError(''); setForgotResendCountdown(0); }}
                        className="shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Đổi email</button>
                    ) : null}
                  </div>

                  {forgotStep === 'verify' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mã OTP</label>
                      <span className="text-[11px] text-slate-400">6 chữ số</span>
                    </div>
                    <div className="grid grid-cols-6 gap-2" onPaste={handleForgotOtpPaste}>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <input
                          key={index}
                          ref={(node) => { forgotOtpRefs.current[index] = node; }}
                          aria-label={`Chữ số OTP ${index + 1}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          maxLength={1}
                          value={forgotOtp[index] || ''}
                          onBeforeInput={(event) => {
                            if (event.data && !/^[0-9]$/.test(event.data)) {
                              event.preventDefault();
                            }
                          }}
                          onChange={(event) => updateForgotOtpDigit(index, event.target.value)}
                          onKeyDown={(event) => {
                            const allowedControlKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                            if (
                              event.key.length === 1 &&
                              !/^[0-9]$/.test(event.key) &&
                              !event.ctrlKey &&
                              !event.metaKey
                            ) {
                              event.preventDefault();
                              return;
                            }
                            if (allowedControlKeys.includes(event.key) || /^[0-9]$/.test(event.key)) {
                              handleForgotOtpKeyDown(index, event);
                            }
                          }}
                          className="h-12 min-w-0 rounded-xl border border-slate-300 bg-white text-center text-lg font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      ))}
                    </div>
                  </div>
                  ) : null}

                  {forgotStep === 'reset' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="forgot-new-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mật khẩu mới</label>
                      <div className="relative">
                        <input id="forgot-new-password" aria-label="Mật khẩu mới" type={showForgotPassword ? 'text' : 'password'} autoComplete="new-password" value={forgotPassword}
                          onChange={(event) => { setForgotPassword(event.target.value); setForgotError(''); }} placeholder={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`}
                          className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 pr-11 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword((value) => !value)}
                          aria-label={showForgotPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                          aria-pressed={showForgotPassword}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-blue-600 focus:outline-none dark:text-slate-500 dark:hover:text-blue-300"
                        >
                          {showForgotPassword ? <Lucide.EyeOff size={17} aria-hidden="true" /> : <Lucide.Eye size={17} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="forgot-confirm-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Xác nhận mật khẩu</label>
                      <div className="relative">
                        <input id="forgot-confirm-password" aria-label="Xác nhận mật khẩu mới" type={showForgotConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={forgotConfirmPassword}
                          onChange={(event) => { setForgotConfirmPassword(event.target.value); setForgotError(''); }} placeholder="Nhập lại mật khẩu"
                          className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 pr-11 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword((value) => !value)}
                          aria-label={showForgotConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                          aria-pressed={showForgotConfirmPassword}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-blue-600 focus:outline-none dark:text-slate-500 dark:hover:text-blue-300"
                        >
                          {showForgotConfirmPassword ? <Lucide.EyeOff size={17} aria-hidden="true" /> : <Lucide.Eye size={17} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  ) : null}
                </>
              )}

              <button type="submit" disabled={forgotLoading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {forgotLoading
                  ? <><span className="loading loading-spinner loading-sm" aria-hidden="true" />Đang xử lý...</>
                  : forgotStep === 'request'
                    ? <>Gửi mã OTP<Lucide.Send size={16} aria-hidden="true" /></>
                    : forgotStep === 'verify'
                      ? <>Xác thực OTP<Lucide.ShieldCheck size={16} aria-hidden="true" /></>
                      : <>Đổi mật khẩu<Lucide.Check size={16} aria-hidden="true" /></>}
              </button>

              {forgotStep === 'verify' ? (
                <button
                  type="button"
                  disabled={forgotLoading || forgotResendCountdown > 0}
                  onClick={async () => {
                    if (forgotLoading || forgotResendCountdown > 0) return;
                    setForgotLoading(true);
                    setForgotError('');
                    setForgotMessage('');
                    try {
                      await authApi.requestForgotPasswordOtp(forgotEmail.trim());
                      setForgotOtp('');
                      setForgotResendCountdown(FORGOT_OTP_RESEND_COOLDOWN_SECONDS);
                      setForgotMessage('Nếu email hợp lệ, mã OTP mới đã được gửi.');
                    } catch (resendError) {
                      const apiMessage = resendError?.response?.data?.msg;
                      setForgotError(apiMessage || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  className="w-full text-center text-xs font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-blue-300 dark:disabled:text-slate-500"
                >
                  {forgotResendCountdown > 0
                    ? `Gửi lại mã sau ${forgotResendCountdown}s`
                    : 'Gửi lại mã OTP'}
                </button>
              ) : null}
            </form>

            <button type="button" onClick={closeForgotPassword} className="mt-3 inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
              <Lucide.ArrowLeft size={16} aria-hidden="true" />Quay lại đăng nhập
            </button>
          </section>
          )
        ) : null}

        {!forgotMode ? (
          <>
        <div className="auth-login-divider relative z-10 my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Hoặc</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="relative z-10 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          <GoogleLogo />
          Đăng nhập với Google
        </button>

        <p className="auth-login-register relative z-10 mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Bạn chưa có tài khoản?{' '}
          <Link to={buildAuthPath('/register', requestedRedirect)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
            Đăng ký ngay
          </Link>
        </p>

        <aside
          className="auth-security-note relative z-10 mt-5 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/65 px-4 py-2.5 text-xs leading-5 text-slate-600 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-slate-300"
          aria-label="Bảo mật đăng nhập"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
            aria-hidden="true"
          >
            <Lucide.ShieldCheck size={16} />
          </span>
          <p className="flex-1 font-medium">
            Đăng nhập an toàn, đúng quyền truy cập.
          </p>
        </aside>

        {SHOW_TEST_ROLE_ACCOUNTS ? (
          <details className="relative z-10 mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 lg:hidden dark:border-slate-700 dark:bg-slate-950/60">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tài khoản mẫu để test role
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TEST_ROLE_ACCOUNTS.map(({ label, email: accountEmail }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleAutofill(accountEmail)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Mật khẩu mặc định: 123456789</p>
          </details>
        ) : null}
          </>
        ) : null}
      </article>
    </AuthLayout>
  );
};
