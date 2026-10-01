import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';

const AuthPageArtwork = () => (
  <svg
    className="auth-page-artwork pointer-events-none absolute inset-0 h-full w-full text-blue-600"
    viewBox="0 0 1600 920"
    fill="none"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <path
      d="M-80 710C190 560 320 760 575 600C790 465 905 190 1300 270C1450 300 1540 390 1680 340"
      stroke="currentColor"
      strokeWidth="1.2"
      className="opacity-[0.065]"
    />
    <path
      d="M-110 768C175 625 345 810 615 650C850 510 980 300 1680 430"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="9 14"
      className="opacity-[0.052]"
    />
    <circle cx="1410" cy="188" r="92" stroke="currentColor" className="opacity-[0.04]" />
    <circle cx="1410" cy="188" r="54" stroke="currentColor" strokeDasharray="6 10" className="opacity-[0.05]" />
    <circle cx="210" cy="175" r="7" className="fill-blue-500/10" />
    <circle cx="1295" cy="675" r="10" className="fill-emerald-500/10" />
    <rect x="1328" y="650" width="15" height="15" rx="4" className="fill-indigo-500/8" />
    <path
      d="M760 184C828 145 884 201 948 164C1002 132 1040 120 1096 142"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="5 9"
      className="opacity-[0.05]"
    />
    <circle cx="760" cy="184" r="5" className="fill-blue-500/10" />
    <circle cx="948" cy="164" r="4" className="fill-indigo-500/10" />
    <circle cx="1096" cy="142" r="7" className="fill-emerald-500/10" />
  </svg>
);

const AuthCityArtwork = () => (
  <svg
    className="auth-city-artwork pointer-events-none absolute inset-0 h-full w-full"
    viewBox="0 0 760 760"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M-54 467C84 369 173 534 310 414C434 305 500 170 804 251"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-blue-500/15"
    />
    <path
      d="M-67 525C73 431 192 584 338 455C475 334 565 244 813 312"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="8 12"
      className="text-blue-500/10"
    />
    <path
      d="M506 -70C435 86 530 151 448 271C379 373 287 388 253 527C222 655 300 731 318 806"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-indigo-500/10"
    />
    <path
      d="M39 693H94V653H126V680H164V621H205V666H249V603H297V689H340V640H386V674H435V596H481V655H530V626H571V687H632V648H688V693H735"
      stroke="currentColor"
      strokeWidth="1.2"
      className="auth-city-skyline text-blue-600/8"
    />
    <path
      d="M45 707H719"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="5 10"
      className="auth-city-skyline text-slate-500/10"
    />
    <circle cx="126" cy="430" r="7" className="fill-blue-500/10" />
    <circle cx="306" cy="416" r="9" className="fill-indigo-500/10" />
    <circle cx="451" cy="269" r="6" className="fill-blue-500/15" />
    <circle cx="625" cy="226" r="8" className="fill-emerald-500/10" />
    <circle cx="126" cy="430" r="18" stroke="currentColor" className="text-blue-500/7" />
    <circle cx="625" cy="226" r="22" stroke="currentColor" strokeDasharray="4 7" className="text-emerald-500/7" />
    <rect x="565" y="360" width="16" height="16" rx="5" className="fill-blue-500/8" />
    <path d="M570 368H576M573 365V371" stroke="currentColor" strokeWidth="1.2" className="text-blue-600/20" />
  </svg>
);

const AuthBrandContent = () => (
  <>
    <span className="auth-brand-icon flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20 transition-transform group-hover:-translate-y-0.5">
      <Lucide.MapPinned size={21} aria-hidden="true" />
    </span>
    <span>
      <strong className="auth-brand-title block text-[18px] font-bold tracking-[-0.025em] text-slate-950 dark:text-white">
        UrbanMind
      </strong>
      <span className="auth-brand-subtitle mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Cổng phản ánh đô thị
      </span>
    </span>
  </>
);

const AuthBrandMark = ({ to = '/' }) => {
  const className = "auth-brand group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";

  if (!to) {
    return (
      <div className={className} aria-label="UrbanMind - Cổng phản ánh đô thị">
        <AuthBrandContent />
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={className}
      aria-label="Về trang chủ UrbanMind"
    >
      <AuthBrandContent />
    </Link>
  );
};

const AuthRouteDecoration = () => (
  <div className="auth-route-decoration pointer-events-none absolute right-7 top-[42%] hidden -translate-y-1/2 items-center gap-2 xl:flex" aria-hidden="true">
    <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-500/35 bg-white shadow-[0_0_0_7px_rgba(59,130,246,0.06)]" />
    <span className="h-px w-9 bg-gradient-to-r from-blue-400/35 to-indigo-400/15" />
    <span className="h-2 w-2 rounded-full bg-indigo-400/30" />
    <span className="h-px w-7 border-t border-dashed border-blue-400/25" />
    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/40 bg-white/70 text-emerald-600 shadow-sm backdrop-blur">
      <Lucide.Check size={13} />
    </span>
  </div>
);

const AuthProductionRoute = () => (
  <aside className="auth-production-route relative z-10 mt-8 rounded-2xl border border-white/80 bg-white/68 px-4 py-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/55">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Quy trình minh bạch
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Theo dõi phản ánh xuyên suốt từ lúc ghi nhận đến khi hoàn tất.
        </p>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
        <Lucide.Activity size={17} aria-hidden="true" />
      </span>
    </div>

    <ol className="mt-4 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400" aria-label="Quy trình xử lý phản ánh">
      <li className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">1</span>
        <span>Ghi nhận</span>
      </li>
      <li aria-hidden="true" className="h-px bg-gradient-to-r from-blue-500/45 to-indigo-400/25" />
      <li className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 bg-white text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">2</span>
        <span>Theo dõi</span>
      </li>
      <li aria-hidden="true" className="h-px border-t border-dashed border-emerald-400/35" />
      <li className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">3</span>
        <span>Hoàn tất</span>
      </li>
    </ol>
  </aside>
);

export const AuthLayout = ({
  children,
  quickAccess = null,
  brandTo = '/',
  backTo = '/',
  backLabel = 'Quay lại trang chủ',
  backLabelMobile = 'Quay lại',
  onBack = null,
}) => {
  const hasQuickAccess = Boolean(quickAccess);

  return (
    <main className="auth-page relative min-h-[100svh] overflow-x-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <style>{`
      @keyframes auth-panel-enter-left {
        from {
          opacity: 0;
          transform: translate3d(-20px, 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes auth-panel-enter-right {
        from {
          opacity: 0;
          transform: translate3d(20px, 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes auth-panel-enter-up {
        from {
          opacity: 0;
          transform: translate3d(0, 16px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      .auth-story-panel {
        animation: auth-panel-enter-left 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .auth-form-column {
        animation: auth-panel-enter-right 680ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .auth-header {
        position: relative;
        z-index: 20;
      }

      .auth-header::after {
        content: "";
        pointer-events: none;
        position: absolute;
        left: 50%;
        bottom: -1rem;
        width: 100vw;
        height: 1px;
        transform: translateX(-50%);
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(148, 163, 184, 0.18) 7%,
          rgba(59, 130, 246, 0.26) 28%,
          rgba(148, 163, 184, 0.28) 50%,
          rgba(59, 130, 246, 0.26) 72%,
          rgba(148, 163, 184, 0.18) 93%,
          transparent 100%
        );
        box-shadow: 0 1px 16px rgba(59, 130, 246, 0.06);
      }

      .auth-story-panel--compact {
        min-height: 585px;
      }

      .auth-story-panel--compact .auth-city-skyline {
        display: none;
      }

      .auth-story-panel--compact .auth-feature-grid {
        margin-top: 2rem;
      }

      .auth-story-panel--compact .auth-route-decoration {
        top: 48%;
      }

      @media (min-width: 1536px) {
        .auth-main-grid {
          transform: translateY(-0.5rem);
        }

        .auth-story-panel--compact {
          min-height: 600px;
        }

        .auth-form-column {
          max-width: 540px;
        }
      }

      @media (min-width: 1024px) and (max-height: 900px) {
        .auth-shell {
          padding-top: 0.75rem;
          padding-bottom: 0.75rem;
        }

        .auth-main-grid {
          gap: 2rem;
          padding-top: 0.75rem;
          padding-bottom: 0.5rem;
        }

        .auth-story-panel {
          min-height: 0;
          height: calc(100svh - 112px);
          max-height: 680px;
          padding: 1.75rem;
          border-radius: 1.75rem;
        }

        .auth-story-panel--compact {
          height: auto;
          min-height: 520px;
          max-height: 600px;
        }

        .auth-story-title {
          margin-top: 1rem;
          font-size: clamp(2rem, 2.6vw, 2.4rem);
          line-height: 1.12;
          letter-spacing: -0.025em;
        }

        .auth-story-description {
          margin-top: 0.75rem;
          line-height: 1.55;
        }

        .auth-feature-grid {
          margin-top: 1.25rem;
          gap: 0.625rem;
        }

        .auth-feature-card {
          padding: 0.75rem;
        }

        .auth-feature-card h2 {
          margin-top: 0.55rem;
        }

        .auth-feature-copy {
          line-height: 1.2rem;
        }

        .auth-quick-access-slot {
          padding-top: 1rem;
        }

        .auth-quick-access {
          padding: 0.75rem;
          border-radius: 1.25rem;
        }

        .auth-role-grid {
          margin-top: 0.75rem;
          gap: 0.5rem;
        }

        .auth-role-card {
          min-height: 52px;
          padding: 0.45rem 0.65rem;
        }

        .auth-login-card {
          padding: 1.5rem;
        }

        .auth-login-title {
          margin-top: 1rem;
          font-size: 1.75rem;
        }

        .auth-login-description {
          line-height: 1.4rem;
        }

        .auth-login-alerts,
        .auth-login-form {
          margin-top: 1rem;
        }

        .auth-login-form {
          row-gap: 0.75rem;
        }

        .auth-login-divider {
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .auth-login-register {
          margin-top: 1rem;
        }

        .auth-security-note {
          margin-top: 0.75rem;
          padding: 0.65rem 0.75rem;
        }

        .auth-footer {
          display: none;
        }
      }

      @media (min-width: 1024px) and (max-height: 760px) {
        .auth-header {
          min-height: 40px;
        }

        .auth-header::after {
          bottom: -0.7rem;
        }

        .auth-brand-icon {
          width: 2.35rem;
          height: 2.35rem;
        }

        .auth-brand-title {
          font-size: 1rem;
        }

        .auth-brand-subtitle {
          display: none;
        }

        .auth-back-link {
          height: 2.35rem;
        }

        .auth-story-panel {
          height: calc(100svh - 86px);
          padding: 1.35rem;
        }

        .auth-story-panel--compact {
          height: auto;
          min-height: 0;
          max-height: calc(100svh - 86px);
        }

        .auth-story-panel--compact .auth-production-route {
          display: none;
        }

        .auth-story-badge,
        .auth-route-decoration {
          display: none;
        }

        .auth-story-title {
          margin-top: 0;
          max-width: 19ch;
          font-size: 1.9rem;
          line-height: 1.12;
        }

        .auth-story-description {
          margin-top: 0.55rem;
          font-size: 0.8125rem;
        }

        .auth-feature-grid {
          margin-top: 0.8rem;
        }

        .auth-feature-card {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .auth-feature-card h2 {
          margin-top: 0;
        }

        .auth-feature-copy {
          display: none;
        }

        .auth-quick-access-slot {
          padding-top: 0.7rem;
        }

        .auth-role-card {
          min-height: 46px;
        }

        .auth-login-card {
          padding: 1.25rem;
        }

        .auth-login-badge {
          display: none;
        }

        .auth-login-title {
          margin-top: 0;
          font-size: 1.6rem;
        }

        .auth-login-description {
          margin-top: 0.35rem;
          font-size: 0.8125rem;
          line-height: 1.25rem;
        }

        .auth-security-note {
          display: none;
        }
      }

      @media (max-width: 1023px) {
        .auth-main-grid {
          padding-top: 2rem;
          padding-bottom: 2rem;
        }

        .auth-form-column {
          animation-name: auth-panel-enter-up;
          animation-duration: 600ms;
          animation-delay: 70ms;
        }
      }


      /*
       * Auth pages use the application's data-theme attribute instead of a
       * Tailwind .dark class. These scoped selectors prevent the global legacy
       * dark overrides from washing out the artwork and keep Login, Register
       * and OTP on the same deep-navy visual system.
       */
      html[data-theme="dark"] .auth-page {
        background:
          radial-gradient(circle at 10% 12%, rgba(37, 99, 235, 0.2), transparent 30%),
          radial-gradient(circle at 88% 82%, rgba(20, 184, 166, 0.12), transparent 28%),
          linear-gradient(135deg, #071120 0%, #09162a 48%, #07101f 100%) !important;
        color: #e8eef8 !important;
      }

      html[data-theme="dark"] .auth-page-background {
        background:
          radial-gradient(circle at 10% 15%, rgba(37, 99, 235, 0.18), transparent 34%),
          radial-gradient(circle at 88% 82%, rgba(20, 184, 166, 0.11), transparent 32%),
          radial-gradient(circle at 52% 48%, rgba(99, 102, 241, 0.07), transparent 28%),
          linear-gradient(135deg, rgba(4, 12, 27, 0.28), rgba(10, 23, 45, 0.2)) !important;
      }

      html[data-theme="dark"] .auth-page-artwork {
        color: #60a5fa !important;
        opacity: 0.78;
      }

      html[data-theme="dark"] .auth-story-panel {
        border-color: rgba(96, 165, 250, 0.2) !important;
        background:
          radial-gradient(circle at 86% 16%, rgba(56, 189, 248, 0.09), transparent 25%),
          radial-gradient(circle at 16% 84%, rgba(37, 99, 235, 0.12), transparent 32%),
          linear-gradient(145deg, rgba(15, 31, 57, 0.98), rgba(8, 20, 40, 0.98) 55%, rgba(14, 24, 52, 0.98)) !important;
        box-shadow:
          0 30px 90px rgba(0, 0, 0, 0.44),
          inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
      }

      html[data-theme="dark"] .auth-story-panel::after {
        content: "";
        pointer-events: none;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background:
          linear-gradient(rgba(96, 165, 250, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(96, 165, 250, 0.035) 1px, transparent 1px);
        background-size: 42px 42px;
        mask-image: linear-gradient(to bottom right, rgba(0, 0, 0, 0.78), transparent 82%);
      }

      html[data-theme="dark"] .auth-city-artwork {
        opacity: 1;
        filter: saturate(1.08);
      }

      html[data-theme="dark"] .auth-story-title,
      html[data-theme="dark"] .auth-brand-title,
      html[data-theme="dark"] .auth-login-title,
      html[data-theme="dark"] .auth-feature-card h2,
      html[data-theme="dark"] .auth-login-card h2,
      html[data-theme="dark"] .auth-login-card legend {
        color: #f8fafc !important;
      }

      html[data-theme="dark"] .auth-story-description,
      html[data-theme="dark"] .auth-brand-subtitle,
      html[data-theme="dark"] .auth-feature-copy,
      html[data-theme="dark"] .auth-login-description {
        color: #aebdd1 !important;
      }

      html[data-theme="dark"] .auth-story-badge,
      html[data-theme="dark"] .auth-login-badge {
        border-color: rgba(96, 165, 250, 0.24) !important;
        background: rgba(30, 64, 175, 0.24) !important;
        color: #bfdbfe !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      html[data-theme="dark"] .auth-feature-card,
      html[data-theme="dark"] .auth-production-route,
      html[data-theme="dark"] .auth-quick-access {
        border-color: rgba(148, 163, 184, 0.16) !important;
        background: rgba(15, 29, 52, 0.72) !important;
        box-shadow:
          0 14px 35px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
      }

      html[data-theme="dark"] .auth-feature-card:hover,
      html[data-theme="dark"] .auth-role-card:hover {
        border-color: rgba(96, 165, 250, 0.35) !important;
        background: rgba(19, 42, 76, 0.78) !important;
      }

      html[data-theme="dark"] .auth-route-decoration > span:first-child {
        border-color: rgba(96, 165, 250, 0.5) !important;
        background: #0b1830 !important;
        box-shadow: 0 0 0 7px rgba(59, 130, 246, 0.09) !important;
      }

      html[data-theme="dark"] .auth-route-decoration > span:last-child {
        border-color: rgba(52, 211, 153, 0.32) !important;
        background: rgba(6, 78, 59, 0.36) !important;
        color: #6ee7b7 !important;
      }

      html[data-theme="dark"] .auth-login-card {
        border-color: rgba(148, 163, 184, 0.2) !important;
        background:
          radial-gradient(circle at 95% 2%, rgba(37, 99, 235, 0.1), transparent 24%),
          linear-gradient(155deg, rgba(10, 22, 43, 0.98), rgba(6, 14, 30, 0.98)) !important;
        box-shadow:
          0 30px 85px rgba(0, 0, 0, 0.52),
          inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      }

      html[data-theme="dark"] .auth-page input,
      html[data-theme="dark"] .auth-page select,
      html[data-theme="dark"] .auth-page textarea {
        border-color: rgba(100, 116, 139, 0.5) !important;
        background: rgba(12, 25, 48, 0.9) !important;
        color: #f8fafc !important;
        caret-color: #60a5fa;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      html[data-theme="dark"] .auth-page input:hover,
      html[data-theme="dark"] .auth-page select:hover,
      html[data-theme="dark"] .auth-page textarea:hover {
        border-color: rgba(148, 163, 184, 0.66) !important;
      }

      html[data-theme="dark"] .auth-page input:focus,
      html[data-theme="dark"] .auth-page select:focus,
      html[data-theme="dark"] .auth-page textarea:focus {
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.14) !important;
      }

      html[data-theme="dark"] .auth-page input::placeholder,
      html[data-theme="dark"] .auth-page textarea::placeholder {
        color: #64748b !important;
      }

      html[data-theme="dark"] .auth-page label,
      html[data-theme="dark"] .auth-page fieldset legend {
        color: #cbd5e1 !important;
      }

      html[data-theme="dark"] .auth-login-divider > span:first-child,
      html[data-theme="dark"] .auth-login-divider > span:last-child {
        background: rgba(71, 85, 105, 0.65) !important;
      }

      html[data-theme="dark"] .auth-security-note,
      html[data-theme="dark"] .auth-login-card aside,
      html[data-theme="dark"] .auth-login-card section[aria-labelledby="send-code-title"] {
        border-color: rgba(96, 165, 250, 0.18) !important;
        background: rgba(12, 28, 54, 0.74) !important;
        color: #b7c5d8 !important;
      }

      html[data-theme="dark"] .auth-register-verification-note {
        border-color: rgba(96, 165, 250, 0.26) !important;
        background:
          linear-gradient(135deg, rgba(30, 64, 175, 0.2), rgba(12, 28, 54, 0.82)) !important;
        color: #cbd5e1 !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.035),
          0 10px 24px rgba(0, 0, 0, 0.14) !important;
      }

      html[data-theme="dark"] .auth-register-verification-note svg {
        color: #7dd3fc !important;
      }

      html[data-theme="dark"] .auth-login-card section[aria-labelledby="send-code-title"] > div > span,
      html[data-theme="dark"] .auth-security-note > span {
        background: rgba(30, 64, 175, 0.28) !important;
        color: #bfdbfe !important;
      }

      html[data-theme="dark"] .auth-page .alert {
        border: 1px solid rgba(148, 163, 184, 0.16) !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2) !important;
      }

      html[data-theme="dark"] .auth-page .alert-error {
        border-color: rgba(251, 113, 133, 0.34) !important;
        background: rgba(127, 29, 29, 0.38) !important;
        color: #fecdd3 !important;
      }

      html[data-theme="dark"] .auth-page .alert-success {
        border-color: rgba(52, 211, 153, 0.3) !important;
        background: rgba(6, 78, 59, 0.4) !important;
        color: #a7f3d0 !important;
      }

      html[data-theme="dark"] .auth-page .alert-info {
        border-color: rgba(96, 165, 250, 0.3) !important;
        background: rgba(30, 64, 175, 0.34) !important;
        color: #bfdbfe !important;
      }

      html[data-theme="dark"] .auth-page .alert-warning {
        border-color: rgba(251, 191, 36, 0.28) !important;
        background: rgba(120, 53, 15, 0.38) !important;
        color: #fde68a !important;
      }

      html[data-theme="dark"] .auth-back-link {
        border-color: rgba(148, 163, 184, 0.2) !important;
        background: rgba(9, 20, 39, 0.82) !important;
        color: #cbd5e1 !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22) !important;
      }

      html[data-theme="dark"] .auth-back-link:hover {
        border-color: rgba(96, 165, 250, 0.35) !important;
        background: rgba(15, 31, 57, 0.94) !important;
        color: #f8fafc !important;
      }

      html[data-theme="dark"] .auth-header::after {
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(51, 65, 85, 0.28) 7%,
          rgba(59, 130, 246, 0.42) 28%,
          rgba(71, 85, 105, 0.5) 50%,
          rgba(56, 189, 248, 0.34) 72%,
          rgba(51, 65, 85, 0.28) 93%,
          transparent 100%
        );
        box-shadow: 0 1px 18px rgba(59, 130, 246, 0.12);
      }

      html[data-theme="dark"] .auth-form-column::before {
        content: "";
        pointer-events: none;
        position: absolute;
        inset: -7rem -5rem;
        z-index: -1;
        background: radial-gradient(circle, rgba(37, 99, 235, 0.12), transparent 62%);
        filter: blur(8px);
      }

      html[data-theme="dark"] .auth-footer {
        border-color: rgba(51, 65, 85, 0.8) !important;
        color: #8091a7 !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .auth-story-panel,
        .auth-form-column {
          animation: none;
        }
      }

      @media (max-width: 640px) {
        .auth-shell {
          padding-left: 1rem;
          padding-right: 1rem;
          padding-top: 1rem;
          padding-bottom: 1.25rem;
        }

        .auth-header {
          align-items: center;
        }

        .auth-brand-icon {
          width: 2.5rem;
          height: 2.5rem;
        }

        .auth-brand-title {
          font-size: 1rem;
        }

        .auth-main-grid {
          padding-top: 1.5rem;
          padding-bottom: 1rem;
        }

        .auth-login-card {
          padding: 1.25rem;
          border-radius: 1.4rem;
        }
      }
    `}</style>

    <div className="auth-page-background pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(37,99,235,0.12),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(16,185,129,0.09),transparent_32%),radial-gradient(circle_at_52%_48%,rgba(99,102,241,0.035),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(239,246,255,0.38))] dark:bg-[radial-gradient(circle_at_10%_15%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(16,185,129,0.10),transparent_32%)]" />
    <AuthPageArtwork />

    <div className="auth-shell relative flex min-h-[100svh] w-full flex-col px-5 py-5 sm:px-7 lg:px-10 lg:py-6 2xl:px-14">
      <header className="auth-header flex items-center justify-between gap-4">
        <AuthBrandMark to={brandTo} />
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="auth-back-link inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            <Lucide.ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">{backLabelMobile}</span>
          </button>
        ) : (
          <Link
            to={backTo}
            className="auth-back-link inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            <Lucide.ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">{backLabelMobile}</span>
          </Link>
        )}
      </header>

      <div
        className={`auth-main-grid mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 items-center gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(450px,0.78fr)] lg:gap-10 lg:py-8 xl:gap-12 2xl:justify-center ${
          hasQuickAccess
            ? '2xl:grid-cols-[minmax(720px,820px)_minmax(490px,560px)] 2xl:gap-14'
            : '2xl:grid-cols-[minmax(690px,780px)_minmax(500px,560px)] 2xl:gap-14'
        }`}
      >
        <section
          className={`auth-story-panel relative hidden overflow-hidden rounded-[32px] border border-blue-200/70 bg-gradient-to-br from-white via-blue-50/90 to-indigo-50/80 p-9 shadow-[0_26px_70px_rgba(30,64,175,0.12)] lg:flex lg:flex-col dark:border-blue-900/50 dark:from-slate-900 dark:via-blue-950/30 dark:to-indigo-950/30 ${
            hasQuickAccess
              ? 'auth-story-panel--with-testing min-h-[610px]'
              : 'auth-story-panel--compact lg:justify-center'
          }`}
        >
          <AuthCityArtwork />
          <AuthRouteDecoration />

          <div className="auth-story-copy relative z-10 max-w-xl">
            <span className="auth-story-badge inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur dark:border-blue-800 dark:bg-slate-900/75 dark:text-blue-300">
              <Lucide.Radio size={14} aria-hidden="true" />
              Nền tảng phản ánh đô thị thông minh
            </span>

            <h2 className="auth-story-title mt-6 max-w-[18ch] text-4xl font-bold leading-[1.12] tracking-tight text-slate-950 dark:text-white xl:text-[42px] 2xl:text-[44px]">
              <span className="block">Kết nối người dân</span>
              <span className="block">với quy trình xử lý minh bạch.</span>
            </h2>
            <p className="auth-story-description mt-5 max-w-[56ch] text-[15px] leading-7 text-slate-600 dark:text-slate-300">
              Gửi phản ánh, theo dõi tiến độ và cùng cộng đồng cải thiện những vấn đề đô thị xung quanh bạn.
            </p>
          </div>

          <div className="auth-feature-grid relative z-10 mt-9 grid max-w-[590px] grid-cols-3 gap-3">
            {[
              { icon: Lucide.Camera, label: 'Ghi nhận', copy: 'Hình ảnh và vị trí' },
              { icon: Lucide.Route, label: 'Theo dõi', copy: 'Tiến độ rõ ràng' },
              { icon: Lucide.MessagesSquare, label: 'Cộng đồng', copy: 'Cùng trao đổi' },
            ].map(({ icon: Icon, label, copy }) => (
              <article
                key={label}
                className="auth-feature-card rounded-2xl border border-white/80 bg-white/72 p-4 shadow-sm backdrop-blur transition-transform duration-300 hover:-translate-y-0.5 dark:border-slate-700/70 dark:bg-slate-900/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{label}</h2>
                  <p className="auth-feature-copy mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{copy}</p>
                </div>
              </article>
            ))}
          </div>

          {hasQuickAccess ? (
            <div className="auth-quick-access-slot relative z-10 mt-auto pt-8">
              {quickAccess}
            </div>
          ) : (
            <AuthProductionRoute />
          )}
        </section>

        <section className="auth-form-column relative mx-auto w-full max-w-[520px]" aria-labelledby="auth-page-title">
          <div className="pointer-events-none absolute -left-10 top-16 hidden h-20 w-20 rounded-full border border-blue-300/25 bg-blue-100/20 shadow-[0_0_45px_rgba(59,130,246,0.08)] lg:block" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-8 bottom-16 hidden h-14 w-14 rounded-2xl border border-emerald-300/25 bg-emerald-100/20 rotate-12 lg:block" aria-hidden="true" />
          {children}
        </section>
      </div>

      <footer className="auth-footer flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>© 2026 UrbanMind · Cổng phản ánh đô thị</span>
        <span>Kết nối cộng đồng · Theo dõi minh bạch</span>
      </footer>
    </div>
    </main>
  );
};
