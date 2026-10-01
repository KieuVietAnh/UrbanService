// src/pages/auth/RegisterPage.jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { getRoleEntryPath } from '../../utils/roleMap';
import { buildAuthPath, getSafeInternalPath } from '../../utils/authRedirect';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^0\d{9}$/;
const MIN_PASSWORD_LENGTH = 8;
const REGISTER_DRAFT_STORAGE_KEY = 'urbanmind:registration-draft';


const readRegistrationDraft = () => {
  if (typeof window === 'undefined') return null;
  try {
    const rawValue = window.sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const writeRegistrationDraft = (draft) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(REGISTER_DRAFT_STORAGE_KEY, JSON.stringify({
    fullName: draft.fullName || '',
    email: draft.email || '',
    phone: draft.phone || '',
  }));
};

const FieldError = ({ id, message }) => {
  if (!message) return null;

  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-red-600 dark:text-red-400">
      <Lucide.CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
};

const REGISTER_FIELD_IDS = {
  fullName: 'register-fullname',
  email: 'register-email',
  phone: 'register-phone',
  password: 'register-password',
  confirmPassword: 'register-confirm-password',
};

const normalizeForMatch = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .trim();

const toMessageList = (value) => {
  if (!value) return [];
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(toMessageList);
  if (typeof value !== 'object') return [];

  const priorityKeys = ['msg', 'message', 'error', 'detail', 'title'];
  const priorityMessages = priorityKeys.flatMap((key) => toMessageList(value[key]));
  const validationMessages = value.errors && typeof value.errors === 'object'
    ? Object.values(value.errors).flatMap(toMessageList)
    : [];

  return [...priorityMessages, ...validationMessages];
};

const getServerValidationFields = (data) => {
  const errors = data?.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {};

  const mappedErrors = {};
  Object.keys(errors).forEach((key) => {
    const normalizedKey = normalizeForMatch(key).replace(/[^a-z]/g, '');
    if (normalizedKey.includes('email')) {
      mappedErrors.email = 'Địa chỉ email chưa hợp lệ.';
    } else if (normalizedKey.includes('phone')) {
      mappedErrors.phone = 'Số điện thoại chưa hợp lệ.';
    } else if (normalizedKey.includes('password')) {
      mappedErrors.password = 'Mật khẩu chưa hợp lệ.';
    } else if (normalizedKey.includes('fullname') || normalizedKey.includes('name')) {
      mappedErrors.fullName = 'Họ và tên chưa hợp lệ.';
    }
  });

  return mappedErrors;
};

const getRegisterErrorDetails = (err) => {
  const status = err?.status ?? err?.response?.status;
  const responseData = err?.response?.data;
  const messages = [
    ...toMessageList(responseData),
    ...toMessageList(err?.message),
  ].filter(Boolean);
  const combinedMessage = messages.join(' ');
  const normalizedMessage = normalizeForMatch(combinedMessage);
  const backendFieldErrors = getServerValidationFields(responseData);
  const fieldErrors = {};

  const hasEmailReference = normalizedMessage.includes('email') || normalizedMessage.includes('e-mail');
  const hasPhoneReference = (
    normalizedMessage.includes('so dien thoai') ||
    normalizedMessage.includes('phone') ||
    normalizedMessage.includes('mobile')
  );
  const isDuplicate = (
    status === 409 ||
    normalizedMessage.includes('da duoc su dung') ||
    normalizedMessage.includes('da ton tai') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('duplicate') ||
    normalizedMessage.includes('is taken') ||
    normalizedMessage.includes('has been used')
  );

  if (isDuplicate && hasEmailReference) {
    const message = 'Email này đã được sử dụng. Vui lòng dùng email khác.';
    return {
      title: 'Email đã được sử dụng',
      message,
      fieldErrors: { email: message },
    };
  }

  if (isDuplicate && hasPhoneReference) {
    const message = 'Số điện thoại này đã được sử dụng. Vui lòng dùng số điện thoại khác.';
    return {
      title: 'Số điện thoại đã được sử dụng',
      message,
      fieldErrors: { phone: message },
    };
  }

  if (isDuplicate) {
    return {
      title: 'Tài khoản đã tồn tại',
      message: 'Email hoặc số điện thoại đã được đăng ký. Vui lòng kiểm tra lại.',
      fieldErrors,
    };
  }

  if (
    normalizedMessage.includes('invalid email') ||
    normalizedMessage.includes('email is invalid') ||
    normalizedMessage.includes('email khong hop le') ||
    normalizedMessage.includes('email khong dung dinh dang')
  ) {
    const message = 'Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.';
    return {
      title: 'Email không hợp lệ',
      message,
      fieldErrors: { email: message },
    };
  }

  if (
    normalizedMessage.includes('invalid phone') ||
    normalizedMessage.includes('phone number') ||
    normalizedMessage.includes('so dien thoai khong hop le')
  ) {
    const message = 'Số điện thoại không hợp lệ. Vui lòng nhập 10 chữ số và bắt đầu bằng 0.';
    return {
      title: 'Số điện thoại không hợp lệ',
      message,
      fieldErrors: { phone: message },
    };
  }

  if (
    normalizedMessage.includes('password') ||
    normalizedMessage.includes('mat khau')
  ) {
    const message = (
      normalizedMessage.includes('uppercase') ||
      normalizedMessage.includes('lowercase') ||
      normalizedMessage.includes('digit') ||
      normalizedMessage.includes('special') ||
      normalizedMessage.includes('non alphanumeric') ||
      normalizedMessage.includes('bao mat') ||
      normalizedMessage.includes('weak')
    )
      ? 'Mật khẩu chưa đủ mạnh. Hãy thêm chữ hoa, chữ thường, số hoặc ký tự đặc biệt.'
      : 'Mật khẩu chưa đáp ứng yêu cầu của hệ thống. Vui lòng kiểm tra lại.';

    return {
      title: 'Mật khẩu chưa hợp lệ',
      message,
      fieldErrors: { password: message },
    };
  }

  if (
    normalizedMessage.includes('full name') ||
    normalizedMessage.includes('fullname') ||
    normalizedMessage.includes('ho va ten')
  ) {
    const message = 'Họ và tên chưa hợp lệ. Vui lòng kiểm tra lại.';
    return {
      title: 'Họ và tên chưa hợp lệ',
      message,
      fieldErrors: { fullName: message },
    };
  }

  if (Object.keys(backendFieldErrors).length > 0) {
    Object.entries(backendFieldErrors).forEach(([fieldName]) => {
      if (fieldName === 'email') fieldErrors.email = 'Địa chỉ email chưa hợp lệ.';
      if (fieldName === 'phone') fieldErrors.phone = 'Số điện thoại chưa hợp lệ.';
      if (fieldName === 'password') fieldErrors.password = 'Mật khẩu chưa hợp lệ.';
      if (fieldName === 'fullName') fieldErrors.fullName = 'Họ và tên chưa hợp lệ.';
    });

    return {
      title: 'Thông tin chưa hợp lệ',
      message: 'Vui lòng kiểm tra lại các trường được đánh dấu bên dưới.',
      fieldErrors,
    };
  }

  if (
    err?.code === 'ECONNABORTED' ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('timed out')
  ) {
    return {
      title: 'Yêu cầu quá thời gian',
      message: 'Hệ thống phản hồi quá chậm. Vui lòng thử đăng ký lại.',
      fieldErrors,
    };
  }

  if (
    !err?.response ||
    normalizedMessage.includes('network error') ||
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('connection') ||
    normalizedMessage.includes('khong the ket noi')
  ) {
    return {
      title: 'Không thể kết nối',
      message: 'Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại.',
      fieldErrors,
    };
  }

  if (status === 429) {
    return {
      title: 'Bạn thao tác quá nhanh',
      message: 'Có quá nhiều yêu cầu đăng ký. Vui lòng chờ một lúc rồi thử lại.',
      fieldErrors,
    };
  }

  if (status === 401 || status === 403) {
    return {
      title: 'Yêu cầu bị từ chối',
      message: 'Hệ thống chưa thể xử lý yêu cầu đăng ký. Vui lòng tải lại trang và thử lại.',
      fieldErrors,
    };
  }

  if (status >= 500) {
    return {
      title: 'Hệ thống đang gặp sự cố',
      message: 'Máy chủ chưa thể xử lý đăng ký lúc này. Vui lòng thử lại sau.',
      fieldErrors,
    };
  }

  if (status === 400 || status === 422) {
    return {
      title: 'Thông tin đăng ký chưa hợp lệ',
      message: 'Vui lòng kiểm tra lại thông tin và thử đăng ký lần nữa.',
      fieldErrors,
    };
  }

  return {
    title: 'Không thể đăng ký',
    message: 'Đã xảy ra lỗi ngoài dự kiến. Vui lòng thử lại.',
    fieldErrors,
  };
};

const getOtpSessionKey = (user, fallbackEmail = '') => {
  const identity = user?.userId || user?.email || fallbackEmail || 'current-user';
  return `urbanmind:otp-sent:${identity}`;
};

export const RegisterPage = () => {
  const {
    user,
    register,
    updatePendingRegistration,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedRedirect = (
    getSafeInternalPath(searchParams.get('redirect')) ||
    getSafeInternalPath(location.state?.from)
  );
  const isEditingRegistration = (
    searchParams.get('mode') === 'edit' &&
    Boolean(user) &&
    !user?.isVerified
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  // Đánh dấu đã tự điều hướng sau khi submit, để effect ở trên không ghi đè lên.
  const submittedRef = useRef(false);
  const draftHydratedRef = useRef(false);

  useEffect(() => {
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;

    const routeDraft = location.state?.registrationDraft;
    const storedDraft = readRegistrationDraft();
    const draft = routeDraft || storedDraft || {};

    if (isEditingRegistration && user) {
      setFullName(user?.fullName || draft.fullName || '');
      setEmail(user?.email || draft.email || '');
      setPhone(user?.phoneNumber || draft.phone || '');
      return;
    }

    setFullName(draft.fullName || user?.fullName || '');
    setEmail(draft.email || user?.email || '');
    setPhone(draft.phone || user?.phoneNumber || '');
  }, [isEditingRegistration, location.state, user]);

  useEffect(() => {
    if (!user) return;

    /*
     * Vừa bấm đăng ký xong thì hàm submit đã tự điều hướng, kèm cờ autoSend và số
     * điện thoại vừa nhập. Effect này chạy ngay sau đó vì user thay đổi, và nếu nó
     * cũng điều hướng thì lần replace của nó sẽ xoá sạch state kia — trang xác thực
     * mount lại với state rỗng nên quay về bước nhập số, đúng thứ vừa bỏ đi.
     *
     * Effect này chỉ để lo trường hợp còn lại: người đã đăng nhập mà chưa xác thực
     * tự mở /register.
     */
    if (submittedRef.current) return;

    if (user.isVerified) {
      navigate(requestedRedirect || getRoleEntryPath(user.role), { replace: true });
      return;
    }

    if (!isEditingRegistration) {
      navigate(buildAuthPath('/verify-phone', requestedRedirect), {
        replace: true,
        state: { phoneNumber: user.phoneNumber || '' },
      });
    }
  }, [isEditingRegistration, navigate, requestedRedirect, user]);

  useEffect(() => {
    if (!fullName && !email && !phone) return;
    writeRegistrationDraft({ fullName, email, phone });
  }, [email, fullName, phone]);

  const clearFieldError = (fieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
    setError(null);
  };

  const getInputClassName = (fieldName, paddingClass) => [
    'h-12 w-full rounded-2xl border bg-white text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 dark:bg-slate-950 dark:text-white',
    paddingClass,
    fieldErrors[fieldName]
      ? 'border-red-400 hover:border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-red-500/80'
      : 'border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:hover:border-slate-600',
  ].join(' ');

  const validateForm = () => {
    const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const nextErrors = {};

    if (!normalizedFullName) {
      nextErrors.fullName = 'Vui lòng nhập họ và tên.';
    } else if (normalizedFullName.length < 2) {
      nextErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Vui lòng nhập địa chỉ email.';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Địa chỉ email không đúng định dạng.';
    }

    if (!normalizedPhone) {
      nextErrors.phone = 'Vui lòng nhập số điện thoại.';
    } else if (!PHONE_PATTERN.test(normalizedPhone)) {
      nextErrors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.';
    }

    if (!isEditingRegistration || password || confirmPassword) {
      if (!password) {
        nextErrors.password = isEditingRegistration
          ? 'Vui lòng nhập mật khẩu mới.'
          : 'Vui lòng nhập mật khẩu.';
      } else if (!password.trim()) {
        nextErrors.password = 'Mật khẩu không được chỉ chứa khoảng trắng.';
      } else if (password.length < MIN_PASSWORD_LENGTH) {
        nextErrors.password = `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
      }

      if (!confirmPassword) {
        nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
      } else if (password !== confirmPassword) {
        nextErrors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
      }
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError({
        title: 'Thông tin chưa đầy đủ',
        message: 'Vui lòng kiểm tra lại các trường được đánh dấu bên dưới.',
      });
      return null;
    }

    setFullName(normalizedFullName);
    setEmail(normalizedEmail);
    setPhone(normalizedPhone);

    return {
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
    };
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (submitInFlightRef.current) return;

    const normalizedValues = validateForm();
    if (!normalizedValues) return;

    submitInFlightRef.current = true;
    setError(null);
    setLoading(true);

    try {
      if (isEditingRegistration) {
        const previousSessionKey = getOtpSessionKey(user, user?.email);

        const updatedUser = await updatePendingRegistration({
          fullName: normalizedValues.fullName,
          email: normalizedValues.email,
          phoneNumber: normalizedValues.phone,
          newPassword: password || undefined,
        });

        writeRegistrationDraft({
          fullName: normalizedValues.fullName,
          email: normalizedValues.email,
          phone: normalizedValues.phone,
        });
        setPassword('');
        setConfirmPassword('');

        void updatedUser;
        if (previousSessionKey) {
          window.sessionStorage.removeItem(previousSessionKey);
        }

        submittedRef.current = true;
        navigate(buildAuthPath('/verify-phone', requestedRedirect), {
          replace: true,
          state: { registrationUpdated: true, phoneNumber: normalizedValues.phone },
        });
        return;
      }

      const registeredUser = await register(
        normalizedValues.fullName,
        normalizedValues.email,
        password,
        normalizedValues.phone,
      );

      /*
       * Số điện thoại vừa nhập ở form này rồi, nên đưa thẳng sang bước nhập mã thay
       * vì hỏi lại số lần nữa. Trang xác thực tự gửi mã khi thấy cờ autoSend.
       */
      void registeredUser;
      submittedRef.current = true;
      navigate(buildAuthPath('/verify-phone', requestedRedirect), {
        replace: true,
        state: { autoSend: true, phoneNumber: normalizedValues.phone },
      });
    } catch (err) {
      const registerError = getRegisterErrorDetails(err);
      if (isEditingRegistration && registerError.title === 'Không thể đăng ký') {
        registerError.title = 'Không thể cập nhật thông tin';
        registerError.message = 'Hệ thống chưa thể lưu thay đổi. Vui lòng thử lại.';
      }
      setError({
        title: registerError.title,
        message: registerError.message,
      });

      if (Object.keys(registerError.fieldErrors).length > 0) {
        setFieldErrors((currentErrors) => ({
          ...currentErrors,
          ...registerError.fieldErrors,
        }));

        const firstInvalidField = Object.keys(registerError.fieldErrors)[0];
        window.requestAnimationFrame(() => {
          document.getElementById(REGISTER_FIELD_IDS[firstInvalidField])?.focus();
        });
      }
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <article className="auth-login-card auth-register-card relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_24px_65px_rgba(15,23,42,0.13)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
        <svg
          className="pointer-events-none absolute right-0 top-0 h-36 w-60 text-blue-600"
          viewBox="0 0 240 144"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 98C72 61 111 118 164 72C193 47 212 41 252 48"
            stroke="currentColor"
            strokeWidth="1.2"
            className="opacity-[0.07]"
          />
          <path
            d="M34 116C83 82 121 128 176 89C202 70 222 67 254 73"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5 8"
            className="opacity-[0.055]"
          />
          <circle cx="164" cy="72" r="5" className="fill-blue-500/10" />
          <circle cx="208" cy="48" r="7" className="fill-emerald-500/10" />
          <circle cx="208" cy="48" r="15" stroke="currentColor" className="opacity-[0.05]" />
        </svg>

        <div
          className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-blue-50/65 blur-2xl dark:bg-blue-950/20"
          aria-hidden="true"
        />

        <header className="relative z-10">
          <span className="auth-login-badge inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Lucide.UserPlus size={14} aria-hidden="true" />
            {isEditingRegistration ? 'Thông tin đăng ký UrbanMind' : 'Tài khoản người dân UrbanMind'}
          </span>
          <h1
            id="auth-page-title"
            className="auth-login-title mt-5 text-[30px] font-bold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white"
          >
            {isEditingRegistration ? 'Chỉnh sửa thông tin đăng ký' : 'Tạo tài khoản mới'}
          </h1>
          <p className="auth-login-description mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {isEditingRegistration
              ? 'Cập nhật thông tin đăng ký. Nếu đổi email, hệ thống sẽ gửi mã OTP mới.'
              : 'Đăng ký để gửi phản ánh, theo dõi tiến độ và tham gia trao đổi cùng cộng đồng.'}
          </p>
        </header>

        {isEditingRegistration ? (
          <div className="relative z-10 mt-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
            <Lucide.Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              Bạn đang chỉnh sửa tài khoản chưa xác thực. Giữ nguyên email hiện tại sẽ không tạo tài khoản mới; nếu đổi email, mã OTP mới sẽ được gửi đến địa chỉ mới sau khi lưu.
            </p>
          </div>
        ) : null}

        <div className="auth-login-alerts relative z-10 mt-6" aria-live="polite">
          {error ? (
            <ErrorAlert
              title={error.title}
              message={error.message}
              onClose={() => setError(null)}
            />
          ) : null}
        </div>

        <form
          onSubmit={handleRegister}
          noValidate
          className="auth-login-form relative z-10 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="register-fullname" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Họ và tên <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.UserRound size={17} />
              </span>
              <input
                id="register-fullname"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={fullName}
                maxLength={120}
                onChange={(event) => {
                  setFullName(event.target.value);
                  clearFieldError('fullName');
                }}
                className={getInputClassName('fullName', 'pl-11 pr-4')}
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={fieldErrors.fullName ? 'register-fullname-error' : undefined}
                required
              />
            </div>
            <FieldError id="register-fullname-error" message={fieldErrors.fullName} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email liên lạc <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.AtSign size={17} />
              </span>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@email.com"
                value={email}
                maxLength={254}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError('email');
                }}
                className={getInputClassName('email', 'pl-11 pr-4')}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                required
              />
            </div>
            <FieldError id="register-email-error" message={fieldErrors.email} />
            {isEditingRegistration ? (
              <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                Đổi email sẽ hủy mã cũ và gửi OTP mới đến địa chỉ vừa cập nhật.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Số điện thoại <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.Phone size={17} />
              </span>
              <input
                id="register-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="09xxxxxxxx"
                value={phone}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(digitsOnly);
                  clearFieldError('phone');
                }}
                className={getInputClassName('phone', 'pl-11 pr-4')}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'register-phone-error' : 'register-phone-help'}
                required
              />
            </div>
            {fieldErrors.phone ? (
              <FieldError id="register-phone-error" message={fieldErrors.phone} />
            ) : (
              <p id="register-phone-help" className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                Nhập 10 chữ số và bắt đầu bằng 0.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isEditingRegistration ? 'Mật khẩu mới' : 'Mật khẩu'}{' '}
              {!isEditingRegistration ? <span className="text-red-500" aria-hidden="true">*</span> : null}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.Lock size={17} />
              </span>
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError('password');
                  clearFieldError('confirmPassword');
                }}
                className={getInputClassName('password', 'pl-11 pr-12')}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'register-password-error' : 'register-password-help'}
                minLength={8}
                required={!isEditingRegistration}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <Lucide.EyeOff size={17} aria-hidden="true" />
                ) : (
                  <Lucide.Eye size={17} aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.password ? (
              <FieldError id="register-password-error" message={fieldErrors.password} />
            ) : (
              <p id="register-password-help" className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                {isEditingRegistration ? 'Bỏ trống nếu không muốn đổi mật khẩu.' : 'Sử dụng ít nhất 8 ký tự.'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-confirm-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isEditingRegistration ? 'Xác nhận mật khẩu mới' : 'Xác nhận mật khẩu'}{' '}
              {!isEditingRegistration ? <span className="text-red-500" aria-hidden="true">*</span> : null}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <Lucide.KeyRound size={17} />
              </span>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearFieldError('confirmPassword');
                }}
                className={getInputClassName('confirmPassword', 'pl-11 pr-12')}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-password-error' : 'register-confirm-password-help'}
                minLength={8}
                required={!isEditingRegistration}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-2xl text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40 dark:hover:text-slate-200"
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? (
                  <Lucide.EyeOff size={17} aria-hidden="true" />
                ) : (
                  <Lucide.Eye size={17} aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <FieldError id="register-confirm-password-error" message={fieldErrors.confirmPassword} />
            ) : (
              <p id="register-confirm-password-help" className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                {isEditingRegistration ? 'Chỉ cần nhập khi thay đổi mật khẩu.' : 'Nhập lại để tránh sai mật khẩu.'}
              </p>
            )}
          </div>

          <div className="auth-register-verification-note sm:col-span-2 flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/65 px-3.5 py-3 text-xs leading-5 text-slate-600 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-slate-300">
            <Lucide.MailCheck size={16} className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            <p>
              {isEditingRegistration
                ? 'Có thể sửa email và mật khẩu trước khi xác thực. Đổi email sẽ tạo mã OTP mới.'
                : 'Sau khi đăng ký, hệ thống sẽ chuyển bạn sang bước xác thực số điện thoại.'}
            </p>
          </div>

          <button
            type="submit"
            className="sm:col-span-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                {isEditingRegistration ? 'Đang lưu thay đổi...' : 'Đang tạo tài khoản...'}
              </>
            ) : (
              <>
                {isEditingRegistration ? 'Lưu thay đổi' : 'Đăng ký tài khoản'}
                <Lucide.ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="auth-login-register relative z-10 mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {isEditingRegistration ? (
            <Link to={buildAuthPath('/verify-phone', requestedRedirect)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
              Quay lại xác thực số điện thoại
            </Link>
          ) : (
            <>
              Đã có tài khoản?{' '}
              <Link to={buildAuthPath('/login', requestedRedirect)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                Đăng nhập ngay
              </Link>
            </>
          )}
        </p>
      </article>
    </AuthLayout>
  );
};
