import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const CREATE_FEEDBACK_URL = '/login?redirect=/tickets/create&intent=create-feedback';

export const PublicFooter = () => {
  const { isAuthenticated } = useAuth();
  const createFeedbackUrl = isAuthenticated ? '/tickets/create' : CREATE_FEEDBACK_URL;

  return (
  <footer className="public-footer relative isolate w-full overflow-hidden border-t border-slate-800 text-white">
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(96,165,250,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.13)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute -left-28 -top-32 h-80 w-80 rounded-full bg-blue-500/16 blur-3xl" />
      <div className="absolute -right-24 -top-10 h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
      <svg viewBox="0 0 1600 290" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-blue-300/12" fill="none">
        <path d="M-60 190C180 120 340 240 570 160C790 84 990 220 1210 145C1370 91 1490 113 1660 175" stroke="currentColor" strokeWidth="1.5" />
        <path d="M-40 236C205 184 375 272 610 215C844 158 1033 258 1262 203C1400 170 1511 174 1650 218" stroke="currentColor" strokeWidth="1" strokeDasharray="7 10" />
      </svg>
    </div>

    <div className="public-wide-content w-full px-5 py-7 sm:px-7 lg:px-10 2xl:px-14">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.55fr)_minmax(220px,0.55fr)]">
        <section aria-labelledby="public-footer-brand">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)]">
              <Lucide.MapPinned size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="public-footer-brand" className="text-base font-semibold tracking-tight text-white">UrbanMind</h2>
              <p className="text-xs text-slate-400">Cổng thông tin phản ánh đô thị</p>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Kết nối thông tin từ cộng đồng với quy trình tiếp nhận, theo dõi và cập nhật kết quả xử lý minh bạch.
          </p>
        </section>

        <nav aria-label="Khám phá UrbanMind">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Khám phá</h2>
          <ul className="mt-4 space-y-3 text-sm font-medium text-slate-300">
            <li><Link to="/community/feed" className="transition hover:text-cyan-300">Bảng tin cộng đồng</Link></li>
            <li><Link to="/community/map" className="transition hover:text-cyan-300">Bản đồ sự vụ</Link></li>
          </ul>
        </nav>

        <nav aria-label="Thao tác tài khoản">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tài khoản</h2>
          <ul className="mt-4 space-y-3 text-sm font-medium text-slate-300">
            {isAuthenticated ? (
              <>
                <li><Link to="/tickets" className="transition hover:text-cyan-300">Phản ánh của tôi</Link></li>
                <li><Link to="/profile" className="transition hover:text-cyan-300">Trang cá nhân</Link></li>
              </>
            ) : (
              <>
                <li><Link to="/login" className="transition hover:text-cyan-300">Đăng nhập</Link></li>
                <li><Link to="/register" className="transition hover:text-cyan-300">Đăng ký tài khoản</Link></li>
              </>
            )}
            <li><Link to={createFeedbackUrl} className="transition hover:text-cyan-300">Gửi phản ánh mới</Link></li>
          </ul>
        </nav>
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} UrbanMind. Vì một đô thị dễ sống hơn.</p>
        <p className="inline-flex items-center gap-2">
          <Lucide.ShieldCheck size={14} aria-hidden="true" />
          Thông tin công khai được hiển thị theo phạm vi cho phép.
        </p>
      </div>
    </div>
  </footer>
  );
};

export default PublicFooter;
