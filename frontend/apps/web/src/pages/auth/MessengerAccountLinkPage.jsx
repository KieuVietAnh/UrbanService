import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { APP_ROLES } from '@urbanmind/shared-types';
import { messengerAccountLinkApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole } from '../../utils/roleMap';
import { buildAuthPath, getSafeInternalPath } from '../../utils/authRedirect';

const collectErrorMessage = (error) => {
  const payload = error?.response?.data ?? error?.data;
  return [
    payload?.message,
    payload?.error,
    payload?.title,
    error?.message,
  ].find((value) => typeof value === 'string' && value.trim()) || '';
};

const getConfirmError = (error) => {
  const status = Number(error?.status ?? error?.response?.status);
  const message = collectErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('số điện thoại') || normalized.includes('phone')) {
    return {
      type: 'phone',
      title: 'Cần bổ sung số điện thoại',
      message: 'Vui lòng cập nhật số điện thoại trong hồ sơ, sau đó quay lại trang này để xác nhận liên kết.',
    };
  }

  if (status === 400 || normalized.includes('hết hạn') || normalized.includes('không hợp lệ')) {
    return {
      type: 'token',
      title: 'Liên kết không còn hiệu lực',
      message: 'Mã liên kết đã hết hạn, đã được sử dụng hoặc không hợp lệ. Hãy quay lại Messenger để yêu cầu liên kết mới.',
    };
  }

  if (status === 409) {
    return {
      type: 'conflict',
      title: 'Không thể liên kết tài khoản',
      message: message || 'Messenger hoặc tài khoản này đã được liên kết trước đó. Vui lòng kiểm tra lại tài khoản đang sử dụng.',
    };
  }

  if (status === 401) {
    return {
      type: 'auth',
      title: 'Phiên đăng nhập đã hết hạn',
      message: 'Vui lòng đăng nhập lại rồi xác nhận liên kết Messenger.',
    };
  }

  if (status === 403) {
    return {
      type: 'forbidden',
      title: 'Tài khoản không đủ điều kiện',
      message: message || 'Chỉ tài khoản người dân đã xác thực số điện thoại mới có thể liên kết Messenger.',
    };
  }

  return {
    type: 'unknown',
    title: 'Chưa thể liên kết Messenger',
    message: 'Hệ thống chưa thể hoàn tất liên kết. Vui lòng kiểm tra kết nối và thử lại.',
  };
};

const StatusCard = ({ icon: Icon, tone = 'blue', title, children }) => {
  const toneClasses = {
    blue: 'border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
    green: 'border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    red: 'border-red-100 bg-red-50/70 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
    amber: 'border-amber-100 bg-amber-50/70 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  };

  return (
    <section className={`rounded-2xl border px-4 py-4 ${toneClasses[tone]}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-slate-950/55">
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</div>
        </div>
      </div>
    </section>
  );
};

export const MessengerAccountLinkPage = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const token = String(searchParams.get('token') || '').trim();
  const returnPath = useMemo(
    () => getSafeInternalPath(`${location.pathname}${location.search}`),
    [location.pathname, location.search],
  );
  const loginPath = buildAuthPath('/login', returnPath, { intent: 'messenger-link' });
  const registerPath = buildAuthPath('/register', returnPath);
  const verifyPath = buildAuthPath('/verify-phone', returnPath);
  const currentRole = normalizeRole(user?.role);
  const isCitizen = currentRole === APP_ROLES.SERVICE_USER;

  const handleSwitchAccount = async () => {
    await logout();
    navigate(loginPath, { replace: true });
  };

  const handleConfirm = async () => {
    if (!token || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await messengerAccountLinkApi.confirm(token);
      setSuccess(true);
    } catch (confirmError) {
      setError(getConfirmError(confirmError));
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    if (!token) {
      return (
        <StatusCard icon={Lucide.Link2Off} tone="red" title="Thiếu mã liên kết">
          Liên kết này không đầy đủ. Hãy quay lại cuộc trò chuyện Messenger và yêu cầu tạo liên kết mới.
        </StatusCard>
      );
    }

    if (authLoading && !user) {
      return (
        <StatusCard icon={Lucide.LoaderCircle} title="Đang kiểm tra tài khoản">
          <span className="inline-flex items-center gap-2">
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
            Vui lòng chờ trong giây lát.
          </span>
        </StatusCard>
      );
    }

    if (!user) {
      return (
        <>
          <StatusCard icon={Lucide.ShieldCheck} title="Đăng nhập để xác định người gửi">
            UrbanMind dùng tài khoản đã xác thực và số điện thoại trong hồ sơ để gắn phản ánh Messenger với đúng người dân.
          </StatusCard>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to={loginPath} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
              <Lucide.LogIn size={17} aria-hidden="true" />
              Đăng nhập
            </Link>
            <Link to={registerPath} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
              <Lucide.UserPlus size={17} aria-hidden="true" />
              Tạo tài khoản
            </Link>
          </div>
        </>
      );
    }

    if (!user.isVerified) {
      return (
        <>
          <StatusCard icon={Lucide.ShieldCheck} tone="amber" title="Cần xác thực số điện thoại">
            Hoàn tất xác thực số điện thoại của tài khoản <strong>{user.email}</strong> trước khi liên kết Messenger.
          </StatusCard>
          <Link to={verifyPath} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
            Tiếp tục xác thực số điện thoại
            <Lucide.ArrowRight size={17} aria-hidden="true" />
          </Link>
        </>
      );
    }

    if (!isCitizen) {
      return (
        <>
          <StatusCard icon={Lucide.UserRoundX} tone="amber" title="Cần tài khoản người dân">
            Tài khoản hiện tại không phải tài khoản người dân. Hãy đổi sang tài khoản dùng để gửi và theo dõi phản ánh.
          </StatusCard>
          <button type="button" onClick={handleSwitchAccount} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
            <Lucide.RefreshCw size={17} aria-hidden="true" />
            Đổi tài khoản
          </button>
        </>
      );
    }

    if (success) {
      return (
        <StatusCard icon={Lucide.BadgeCheck} tone="green" title="Liên kết thành công">
          Tài khoản Messenger đã được gắn với hồ sơ UrbanMind của bạn. Hãy quay lại Messenger và nhấn <strong>“Xác nhận”</strong> để gửi phản ánh đang soạn.
        </StatusCard>
      );
    }

    return (
      <>
        <StatusCard icon={Lucide.UserCheck} title="Sẵn sàng liên kết">
          Bạn đang liên kết Messenger với tài khoản <strong>{user.email}</strong>. Sau khi liên kết, phản ánh gửi từ cuộc trò chuyện này sẽ thuộc về tài khoản trên.
        </StatusCard>

        {error ? (
          <div className="mt-4">
            <StatusCard icon={Lucide.CircleAlert} tone={error.type === 'phone' ? 'amber' : 'red'} title={error.title}>
              <p>{error.message}</p>
              {error.type === 'phone' ? (
                <Link to="/profile" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  Cập nhật hồ sơ
                  <Lucide.ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : null}
              {error.type === 'auth' ? (
                <Link to={loginPath} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  Đăng nhập lại
                  <Lucide.ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : null}
            </StatusCard>
          </div>
        ) : null}

        <button type="button" onClick={handleConfirm} disabled={submitting} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? (
            <>
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
              Đang liên kết...
            </>
          ) : (
            <>
              <Lucide.Link2 size={17} aria-hidden="true" />
              Xác nhận liên kết
            </>
          )}
        </button>
      </>
    );
  };

  return (
    <AuthLayout backTo="/" backLabel="Về trang chủ" backLabelMobile="Trang chủ">
      <article className="auth-login-card relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_24px_65px_rgba(15,23,42,0.13)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Lucide.MessageCircleMore size={15} aria-hidden="true" />
            Liên kết Messenger
          </span>
          <h1 id="auth-page-title" className="mt-5 text-[30px] font-bold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white">
            Xác nhận tài khoản gửi phản ánh
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Bước này giúp UrbanMind xác định đúng người gửi và đồng bộ tiến độ xử lý giữa Messenger với web app.
          </p>
        </div>

        <div className="relative z-10 mt-6">{renderContent()}</div>

        <aside className="relative z-10 mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/75 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-400">
          <Lucide.LockKeyhole size={17} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <p>Mã liên kết chỉ dùng một lần. UrbanMind không yêu cầu bạn gửi mật khẩu hoặc mã OTP qua Messenger.</p>
        </aside>
      </article>
    </AuthLayout>
  );
};
