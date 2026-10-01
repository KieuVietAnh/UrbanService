import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';

export const SessionExpiredDialog = ({ open, onLoginAgain }) => {
  const loginButtonRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    loginButtonRef.current?.focus();

    const blockEscape = (event) => {
      if (event.key === 'Escape') event.preventDefault();
    };

    document.addEventListener('keydown', blockEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', blockEscape);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-description"
        className="w-full max-w-md overflow-hidden rounded-[26px] border border-base-300 bg-base-100 text-base-content shadow-2xl"
      >
        <div className="p-6 sm:p-7">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/12 text-warning"
            aria-hidden="true"
          >
            <Lucide.ClockAlert size={27} />
          </span>

          <h2
            id="session-expired-title"
            className="mt-5 text-xl font-bold tracking-tight"
          >
            Phiên đăng nhập đã hết hạn
          </h2>

          <p
            id="session-expired-description"
            className="mt-2 text-sm leading-6 text-base-content/60"
          >
            Hệ thống không thể gia hạn phiên làm việc của bạn. Vui lòng đăng nhập
            lại để tiếp tục. Sau khi đăng nhập, bạn sẽ được đưa về đúng trang đang
            sử dụng.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-info/15 bg-info/5 px-4 py-3">
            <Lucide.ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-info"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-base-content/55">
              Đây là biện pháp bảo mật khi cả access token và refresh token không
              còn hợp lệ.
            </p>
          </div>
        </div>

        <footer className="border-t border-base-300 bg-base-200/45 px-6 py-4 sm:px-7">
          <button
            ref={loginButtonRef}
            type="button"
            onClick={onLoginAgain}
            className="btn admin-primary-action w-full rounded-xl"
          >
            <Lucide.LogIn size={17} aria-hidden="true" />
            Đăng nhập lại
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
