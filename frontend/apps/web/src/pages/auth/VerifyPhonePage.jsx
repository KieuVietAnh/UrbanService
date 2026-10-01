// src/pages/auth/VerifyPhonePage.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { formatPhone, normalizePhone } from '@urbanmind/shared-api';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorAlert, SuccessAlert } from '../../components/alerts/ErrorAlert';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase';
import { getFirebaseErrorMessage } from '../../lib/firebaseErrors';
import { getRoleEntryPath } from '../../utils/roleMap';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const readApiMessage = (error, fallback) =>
  error?.response?.data?.msg ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const readApiCode = (error) => error?.response?.data?.data?.code || null;

export const VerifyPhonePage = () => {
  const { user, requestPhoneOtp, verifyPhone, logout } = useAuth();
  const navigate = useNavigate();
  const routeLocation = useLocation();

  const [step, setStep] = useState(() => (routeLocation.state?.autoSend === true ? 'otp' : 'phone'));
  const [phoneInput, setPhoneInput] = useState('');
  const [confirmedPhone, setConfirmedPhone] = useState(
    () => normalizePhone(routeLocation.state?.phoneNumber || '') || ''
  );
  const [otpDigits, setOtpDigits] = useState(() => Array(OTP_LENGTH).fill(''));
  // Không đọc ref lúc render được, nên trạng thái 'đã gửi mã' phải là state.
  const [otpSent, setOtpSent] = useState(false);
  const [remainingToday, setRemainingToday] = useState(null);
  const [isTestNumber, setIsTestNumber] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const recaptchaHost = useRef(null);
  const recaptcha = useRef(null);
  const confirmation = useRef(null);
  const inputRefs = useRef([]);

  const redirectTo = routeLocation.state?.from || null;
  // Tới từ màn đăng ký thì số đã nhập rồi, không hỏi lại lần nữa.
  const autoSendRequested = routeLocation.state?.autoSend === true;
  const phoneFromRegister = routeLocation.state?.phoneNumber || '';
  const autoSendStarted = useRef(false);

  useEffect(() => {
    const known = phoneFromRegister || user?.phoneNumber || '';
    if (!known) return;
    setPhoneInput(formatPhone(normalizePhone(known) || known));
  }, [phoneFromRegister, user?.phoneNumber]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  // reCAPTCHA gắn vào DOM, phải dọn khi rời trang nếu không widget cũ sẽ treo lại.
  useEffect(() => () => {
    try {
      recaptcha.current?.clear();
    } catch {
      // Widget có thể đã bị gỡ cùng DOM; không có gì để dọn thêm.
    }
  }, []);

  const focusOtpInput = useCallback((index) => {
    window.setTimeout(() => inputRefs.current[index]?.focus(), 0);
  }, []);

  const run = async (task) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      const code = readApiCode(err);
      if (code === 'DAILY_OTP_LIMIT_REACHED') {
        setError({
          title: 'Hết lượt gửi mã hôm nay',
          message: readApiMessage(err, 'Hệ thống đã dùng hết lượt gửi mã OTP trong hôm nay.'),
        });
      } else if (code === 'PHONE_ALREADY_USED') {
        setError({
          title: 'Số điện thoại đã được dùng',
          message: readApiMessage(err, 'Số điện thoại này đã thuộc về một tài khoản khác.'),
        });
      } else if (err?.response) {
        setError({
          title: 'Không thực hiện được',
          message: readApiMessage(err, 'Vui lòng thử lại sau ít phút.'),
        });
      } else {
        setError({
          title: 'Không gửi được mã',
          message: getFirebaseErrorMessage(err),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Firebase bắt buộc reCAPTCHA khi gửi OTP trên web. Mỗi lần gửi phải dùng một
   * widget mới: widget đã xác minh hoặc đã lỗi không dùng lại được.
   */
  const freshRecaptcha = () => {
    try {
      recaptcha.current?.clear();
    } catch {
      // Widget cũ đã hỏng thì bỏ qua, phía dưới tạo widget mới.
    }
    const element = document.createElement('div');
    recaptchaHost.current?.replaceChildren(element);
    recaptcha.current = new RecaptchaVerifier(getFirebaseAuth(), element, { size: 'invisible' });
    return recaptcha.current;
  };

  const sendOtpTo = async (targetPhone) => {
    // Hỏi backend trước: số hợp lệ, chưa thuộc tài khoản khác, và hôm nay còn
    // hạn mức SMS. Mỗi tin nhắn là chi phí thật nên không gọi Firebase trước.
    const permission = await requestPhoneOtp(targetPhone);
    const normalized = permission?.phoneNumber || targetPhone;

    await signInWithPhoneNumber(getFirebaseAuth(), normalized, freshRecaptcha())
      .then((result) => {
        confirmation.current = result;
      });

    setOtpSent(true);
    setConfirmedPhone(normalized);
    setRemainingToday(permission?.remainingToday ?? null);
    setIsTestNumber(permission?.isTestNumber === true);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setStep('otp');
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setSuccess(`Mã xác thực đã được gửi tới ${formatPhone(normalized)}.`);
    focusOtpInput(0);
  };

  /*
   * Gửi mã ngay khi vừa đăng ký xong, đúng một lần. Bắt người dùng gõ lại chính số
   * họ vừa điền ở form đăng ký rồi mới được bấm gửi là thừa một bước.
   *
   * Chỉ chạy khi có cờ autoSend từ màn đăng ký, nên mở thẳng /verify-phone hay tải
   * lại trang đều không tự đốt thêm một tin nhắn.
   */
  useEffect(() => {
    if (!autoSendRequested || autoSendStarted.current) return;
    const target = normalizePhone(phoneFromRegister || user?.phoneNumber || '');
    if (!target) return;
    autoSendStarted.current = true;
    void run(() => sendOtpTo(target)).then(() => {
      /*
       * Gửi hỏng — hết hạn mức, số đã thuộc tài khoản khác, reCAPTCHA lỗi — thì lùi
       * về bước nhập số để người dùng sửa và thử lại, thay vì mắc kẹt ở màn nhập mã
       * mà chẳng bao giờ có mã nào tới.
       */
      if (!confirmation.current) setStep('phone');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendRequested, phoneFromRegister, user?.phoneNumber]);

  const handlePhoneSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setError({
        title: 'Số điện thoại chưa hợp lệ',
        message: 'Nhập số điện thoại Việt Nam gồm 10 chữ số, ví dụ 0901 234 567.',
      });
      return;
    }
    void run(() => sendOtpTo(normalized));
  };

  const handleResend = () => {
    if (resendIn > 0 || !confirmedPhone) return;
    void run(() => sendOtpTo(confirmedPhone));
  };

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
    const code = otpDigits.join('');
    if (code.length !== OTP_LENGTH) {
      setError({ title: 'Thiếu mã xác thực', message: `Vui lòng nhập đủ ${OTP_LENGTH} chữ số.` });
      return;
    }

    void run(async () => {
      if (!confirmation.current) {
        throw new Error('Phiên xác thực đã hết hạn. Vui lòng gửi lại mã.');
      }

      // Firebase kiểm tra mã. Đúng mã thì trả về ID token chứa số đã xác thực.
      const credential = await confirmation.current.confirm(code);
      const idToken = await credential.user.getIdToken();

      // Backend xác minh chữ ký token rồi mới đánh dấu tài khoản đã xác thực.
      await verifyPhone(idToken);

      setSuccess('Xác thực số điện thoại thành công.');
      const destination = redirectTo || getRoleEntryPath(user?.role) || '/';
      navigate(destination, { replace: true });
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!isFirebaseConfigured) {
    return (
      <AuthLayout brandTo={null} onBack={handleLogout} backLabel="Đổi tài khoản">
        <article className="rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_24px_65px_rgba(15,23,42,0.13)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
          <ErrorAlert
            title="Chưa xác thực được số điện thoại"
            message="Tính năng xác thực đang tạm thời không dùng được do thiếu cấu hình phía máy chủ. Vui lòng thử lại sau hoặc báo cho quản trị hệ thống."
          />
        </article>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      brandTo={null}
      onBack={handleLogout}
      backLabel="Đổi tài khoản"
      backLabelMobile="Đổi tài khoản"
    >
      <article className="auth-login-card relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_24px_65px_rgba(15,23,42,0.13)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
        <header className="relative z-10">
          <span className="auth-login-badge inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Lucide.ShieldCheck size={14} aria-hidden="true" />
            Xác thực tài khoản UrbanMind
          </span>
          <h1 id="auth-page-title" className="auth-login-title mt-5 text-[30px] font-bold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white">
            Xác thực số điện thoại
          </h1>
          <p className="auth-login-description mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {step === 'phone'
              ? 'Chúng tôi gửi mã OTP qua tin nhắn SMS để xác nhận số điện thoại của bạn.'
              : busy && !otpSent ? (
                <>
                  Đang gửi mã xác thực tới{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatPhone(confirmedPhone)}
                  </strong>...
                </>
              ) : (
                <>
                  Nhập mã gồm {OTP_LENGTH} chữ số vừa gửi tới{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatPhone(confirmedPhone)}
                  </strong>.
                </>
              )}
          </p>
        </header>

        <div className="relative z-10 mt-5 space-y-3">
          {error ? (
            <ErrorAlert title={error.title} message={error.message} onClose={() => setError(null)} />
          ) : null}
          {success ? (
            <SuccessAlert title="Thông báo" message={success} onClose={() => setSuccess('')} />
          ) : null}
        </div>

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="relative z-10 mt-5">
            <fieldset disabled={busy}>
              <label htmlFor="verify-phone-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Số điện thoại nhận mã
              </label>
              <input
                id="verify-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="0901 234 567"
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Nhập nhầm số lúc đăng ký thì sửa lại ngay tại đây, số mới sẽ được lưu cho tài khoản.
              </p>

              <button
                type="submit"
                disabled={busy}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                    Đang gửi mã...
                  </>
                ) : (
                  <>
                    <Lucide.Send size={16} aria-hidden="true" />
                    Gửi mã OTP
                  </>
                )}
              </button>
            </fieldset>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="relative z-10 mt-5">
            <fieldset disabled={busy}>
              <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mã xác thực gồm {OTP_LENGTH} chữ số
              </legend>
              <div className="mt-2.5 grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    // Vị trí cố định 6 ô nên dùng index làm key là an toàn.
                    key={index}
                    ref={(element) => { inputRefs.current[index] = element; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    aria-label={`Chữ số OTP thứ ${index + 1}`}
                    className="h-12 min-w-0 rounded-xl border border-slate-300 bg-white text-center text-lg font-bold text-slate-900 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:h-14 sm:rounded-2xl sm:text-xl dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                ))}
              </div>
            </fieldset>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={handleResend}
                disabled={busy || resendIn > 0}
                className="inline-flex items-center gap-1.5 font-semibold text-blue-700 transition hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-blue-300"
              >
                <Lucide.RefreshCw size={14} aria-hidden="true" />
                {resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : 'Gửi lại mã'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtpSent(false); setSuccess(''); setError(null); }}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-600 transition hover:underline dark:text-slate-300"
              >
                <Lucide.PencilLine size={14} aria-hidden="true" />
                Đổi số điện thoại
              </button>
            </div>

            {typeof remainingToday === 'number' ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Hôm nay hệ thống còn {remainingToday} lượt gửi tin nhắn.
              </p>
            ) : isTestNumber ? (
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                Số này là số thử nghiệm: dùng mã cố định và không tốn tin nhắn nào.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  <Lucide.ShieldCheck size={16} aria-hidden="true" />
                  Xác thực
                </>
              )}
            </button>
          </form>
        )}

        {/* Firebase gắn widget reCAPTCHA ẩn vào đây. */}
        <div ref={recaptchaHost} className="hidden" aria-hidden="true" />
      </article>
    </AuthLayout>
  );
};

export default VerifyPhonePage;
