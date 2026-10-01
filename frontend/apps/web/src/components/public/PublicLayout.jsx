import PublicFooter from './PublicFooter';
import PublicHeader from './PublicHeader';
import CitizenAiCopilot from './CitizenAiCopilot';

export const PublicThemeStyles = () => (
  <style>{`
    .public-page {
      --public-page-bg: #f5f8fc;
      --public-surface: rgba(255, 255, 255, 0.92);
      --public-surface-soft: rgba(248, 251, 255, 0.9);
      --public-surface-strong: #ffffff;
      --public-border: rgba(203, 213, 225, 0.82);
      --public-border-soft: rgba(219, 234, 254, 0.9);
      --public-title: #0f172a;
      --public-copy: #5b6b82;
      --public-muted: #8796aa;
      --public-header-bg: rgba(255, 255, 255, 0.9);
      --public-header-border: rgba(203, 213, 225, 0.76);
      --public-footer-bg: #071426;
      --public-shadow: 0 24px 68px rgba(15, 23, 42, 0.1);
      min-height: 100vh;
      background:
        radial-gradient(circle at 8% 10%, rgba(59, 130, 246, 0.08), transparent 24%),
        radial-gradient(circle at 92% 20%, rgba(34, 211, 238, 0.08), transparent 26%),
        var(--public-page-bg);
      color: var(--public-title);
    }

    /* Authenticated resident workspace owns one page background.
       Global index.css has a broad main background rule with !important;
       without this scoped reset, nested page <main> elements render as visible
       rectangular gradient layers behind cards. Keep the marketing/public
       landing surface unchanged and reset only the resident dashboard shell. */
    html:not([data-theme="dark"]) .public-page.citizen-dashboard-shell {
      background: #f6f8fb !important;
      background-image: none !important;
    }

    html:not([data-theme="dark"]) .public-page.citizen-dashboard-shell main,
    html:not([data-theme="dark"]) .public-page.citizen-dashboard-shell .citizen-content-shell {
      background: transparent !important;
      background-image: none !important;
    }

    html[data-theme="dark"] .public-page.citizen-dashboard-shell {
      background: #050d1b !important;
      background-image: none !important;
    }

    html[data-theme="dark"] .public-page.citizen-dashboard-shell main,
    html[data-theme="dark"] .public-page.citizen-dashboard-shell .citizen-content-shell {
      background: transparent !important;
      background-image: none !important;
    }

    /* Public community pages use the same clean content canvas as the
       authenticated resident view. Keep LandingPage marketing gradients intact. */
    html:not([data-theme="dark"]) .public-page.public-community-shell {
      background: #f6f8fb !important;
      background-image: none !important;
    }

    html:not([data-theme="dark"]) .public-page.public-community-shell main,
    html:not([data-theme="dark"]) .public-page.public-community-shell .public-community-content {
      background: transparent !important;
      background-image: none !important;
    }

    html[data-theme="dark"] .public-page.public-community-shell {
      background: #050d1b !important;
      background-image: none !important;
    }

    html[data-theme="dark"] .public-page.public-community-shell main,
    html[data-theme="dark"] .public-page.public-community-shell .public-community-content {
      background: transparent !important;
      background-image: none !important;
    }

    html[data-theme="dark"] .public-page {
      --public-page-bg: #050d1b;
      --public-surface: rgba(12, 27, 50, 0.92);
      --public-surface-soft: rgba(10, 24, 46, 0.88);
      --public-surface-strong: #0b1830;
      --public-border: rgba(96, 165, 250, 0.18);
      --public-border-soft: rgba(71, 85, 105, 0.56);
      --public-title: #f8fafc;
      --public-copy: #afbdd0;
      --public-muted: #7f90a8;
      --public-header-bg: rgba(5, 14, 30, 0.92);
      --public-header-border: rgba(51, 65, 85, 0.72);
      --public-footer-bg: #030a17;
      --public-shadow: 0 28px 82px rgba(0, 0, 0, 0.38);
      background:
        radial-gradient(circle at 8% 10%, rgba(37, 99, 235, 0.18), transparent 28%),
        radial-gradient(circle at 92% 18%, rgba(20, 184, 166, 0.11), transparent 26%),
        linear-gradient(135deg, #050d1b 0%, #071426 50%, #061321 100%);
      color: var(--public-title);
    }

    .public-header {
      background: var(--public-header-bg) !important;
      border-color: var(--public-header-border) !important;
      color: var(--public-title);
    }

    .public-header-brand-title,
    .public-heading,
    .public-page .public-nav-link,
    .public-page .public-account-link {
      color: var(--public-title) !important;
    }

    .public-header-brand-subtitle,
    .public-copy,
    .public-page .public-muted {
      color: var(--public-copy) !important;
    }

    html[data-theme="dark"] .public-theme-button,
    html[data-theme="dark"] .public-login-button,
    html[data-theme="dark"] .public-mobile-menu-button {
      border-color: rgba(96, 165, 250, 0.2) !important;
      background: rgba(11, 24, 48, 0.9) !important;
      color: #d9e6f7 !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }

    html[data-theme="dark"] .public-theme-button:hover,
    html[data-theme="dark"] .public-login-button:hover,
    html[data-theme="dark"] .public-mobile-menu-button:hover,
    html[data-theme="dark"] .public-nav-link:hover,
    html[data-theme="dark"] .public-account-link:hover {
      border-color: rgba(56, 189, 248, 0.34) !important;
      background: rgba(17, 38, 70, 0.92) !important;
      color: #f8fafc !important;
    }

    .public-page .public-nav-link-active {
      border-color: rgba(147, 197, 253, 0.8) !important;
      background: linear-gradient(
        145deg,
        rgba(239, 246, 255, 0.98),
        rgba(224, 242, 254, 0.88)
      ) !important;
      color: #1d4ed8 !important;
      box-shadow:
        0 8px 20px rgba(37, 99, 235, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.82);
    }

    html[data-theme="dark"] .public-page .public-nav-link-active,
    html[data-theme="dark"] .public-page .public-nav-link-active:hover {
      border-color: rgba(56, 189, 248, 0.34) !important;
      background: linear-gradient(
        145deg,
        rgba(30, 64, 175, 0.3),
        rgba(8, 47, 73, 0.42)
      ) !important;
      color: #dbeafe !important;
      box-shadow:
        0 10px 24px rgba(2, 8, 23, 0.24),
        inset 0 1px 0 rgba(255, 255, 255, 0.055);
    }

    .public-hero,
    .public-quick-section,
    .public-recent-section,
    .public-tools-section,
    .public-process-section {
      color: var(--public-title);
    }

    html[data-theme="dark"] .public-hero {
      background: linear-gradient(180deg, #071426 0%, #06101f 100%) !important;
      border-color: rgba(51, 65, 85, 0.78) !important;
    }

    html[data-theme="dark"] .public-hero-backdrop {
      background:
        radial-gradient(circle at 12% 18%, rgba(37, 99, 235, 0.23), transparent 31%),
        radial-gradient(circle at 88% 15%, rgba(8, 145, 178, 0.16), transparent 29%),
        radial-gradient(circle at 68% 88%, rgba(99, 102, 241, 0.08), transparent 34%),
        linear-gradient(145deg, #071426 0%, #050d1b 54%, #071624 100%) !important;
    }

    html[data-theme="dark"] .public-badge {
      border-color: rgba(96, 165, 250, 0.24) !important;
      background: rgba(30, 64, 175, 0.24) !important;
      color: #bfdbfe !important;
    }

    .public-overview-panel,
    .public-recent-shell,
    .public-quick-card,
    .public-tool-card,
    .public-process-card {
      border-color: var(--public-border) !important;
      background: var(--public-surface) !important;
      box-shadow: var(--public-shadow) !important;
    }

    html[data-theme="dark"] .public-overview-panel,
    html[data-theme="dark"] .public-recent-shell,
    html[data-theme="dark"] .public-quick-card,
    html[data-theme="dark"] .public-tool-card,
    html[data-theme="dark"] .public-process-card {
      background:
        radial-gradient(circle at 92% 2%, rgba(37, 99, 235, 0.08), transparent 24%),
        linear-gradient(145deg, rgba(13, 29, 54, 0.98), rgba(8, 20, 40, 0.98)) !important;
      border-color: rgba(96, 165, 250, 0.19) !important;
      box-shadow:
        0 26px 72px rgba(0, 0, 0, 0.32),
        inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
    }

    html[data-theme="dark"] .public-overview-divider {
      border-color: rgba(71, 85, 105, 0.6) !important;
    }

    html[data-theme="dark"] .public-live-badge {
      background: rgba(6, 78, 59, 0.4) !important;
      color: #a7f3d0 !important;
    }

    html[data-theme="dark"] .public-overview-list,
    html[data-theme="dark"] .public-overview-item,
    html[data-theme="dark"] .public-overview-empty {
      border-color: rgba(71, 85, 105, 0.58) !important;
      background: rgba(7, 17, 35, 0.72) !important;
      color: #e8eef8 !important;
    }

    html[data-theme="dark"] .public-overview-panel h2,
    html[data-theme="dark"] .public-overview-panel h3,
    html[data-theme="dark"] .public-overview-panel strong,
    html[data-theme="dark"] .public-overview-list > div > span {
      color: #f8fafc !important;
    }

    html[data-theme="dark"] .public-overview-panel p,
    html[data-theme="dark"] .public-overview-panel time {
      color: #93a4bc !important;
    }

    html[data-theme="dark"] .public-quick-card > span:first-of-type,
    html[data-theme="dark"] .public-tool-card > span:first-of-type,
    html[data-theme="dark"] .public-process-card > div span:first-child {
      border-color: rgba(96, 165, 250, 0.22) !important;
      background: rgba(30, 64, 175, 0.2) !important;
      color: #93c5fd !important;
    }

    html[data-theme="dark"] .public-quick-card > span[aria-hidden="true"],
    html[data-theme="dark"] .public-recent-shell > span[aria-hidden="true"],
    html[data-theme="dark"] .public-process-card > span[aria-hidden="true"] {
      border-color: rgba(59, 130, 246, 0.07) !important;
    }

    html[data-theme="dark"] .public-quick-section,
    html[data-theme="dark"] .public-recent-section,
    html[data-theme="dark"] .public-tools-section,
    html[data-theme="dark"] .public-process-section {
      background:
        radial-gradient(circle at 10% 18%, rgba(37, 99, 235, 0.11), transparent 27%),
        radial-gradient(circle at 90% 20%, rgba(8, 145, 178, 0.08), transparent 25%),
        linear-gradient(180deg, #071426 0%, #050d1b 100%) !important;
      border-color: rgba(51, 65, 85, 0.72) !important;
    }

    html[data-theme="dark"] .public-secondary-button,
    html[data-theme="dark"] .public-section-button {
      border-color: rgba(96, 165, 250, 0.2) !important;
      background: rgba(10, 23, 44, 0.92) !important;
      color: #dbeafe !important;
    }

    html[data-theme="dark"] .public-secondary-button:hover,
    html[data-theme="dark"] .public-section-button:hover {
      border-color: rgba(56, 189, 248, 0.35) !important;
      background: rgba(17, 38, 70, 0.94) !important;
      color: #ffffff !important;
    }

    html[data-theme="dark"] .public-feedback-card {
      border-color: rgba(96, 165, 250, 0.18) !important;
      background: linear-gradient(155deg, #0d1d36, #081426) !important;
      box-shadow: 0 22px 58px rgba(0, 0, 0, 0.3) !important;
    }

    html[data-theme="dark"] .public-feedback-card:hover {
      border-color: rgba(56, 189, 248, 0.34) !important;
      box-shadow: 0 28px 72px rgba(0, 0, 0, 0.4) !important;
    }

    html[data-theme="dark"] .public-feedback-title {
      color: #f8fafc !important;
    }

    html[data-theme="dark"] .public-feedback-copy,
    html[data-theme="dark"] .public-feedback-meta {
      color: #9fb0c7 !important;
    }

    html[data-theme="dark"] .public-process-line {
      background: rgba(71, 85, 105, 0.72) !important;
    }

    .public-footer {
      background: var(--public-footer-bg) !important;
    }



    .public-page-motion {
      opacity: 0;
      transform: translateY(10px);
      filter: blur(4px);
      transition:
        opacity 460ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
        filter 460ms ease;
    }

    .public-page-motion.is-ready {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }

    [data-public-reveal] {
      opacity: 0;
      transform: translateY(24px) scale(0.992);
      transition:
        opacity 520ms cubic-bezier(0.22, 1, 0.36, 1) var(--public-reveal-delay, 0ms),
        transform 580ms cubic-bezier(0.22, 1, 0.36, 1) var(--public-reveal-delay, 0ms);
      will-change: opacity, transform;
    }

    [data-public-reveal].is-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .public-loading-surface {
      position: relative;
      overflow: hidden;
    }

    .public-loading-surface::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-120%);
      background: linear-gradient(
        105deg,
        transparent 20%,
        rgba(255, 255, 255, 0.5) 44%,
        transparent 68%
      );
      animation: public-loading-sweep 1.55s ease-in-out infinite;
      pointer-events: none;
    }

    html[data-theme="dark"] .public-loading-surface::after {
      background: linear-gradient(
        105deg,
        transparent 20%,
        rgba(148, 163, 184, 0.09) 44%,
        transparent 68%
      );
    }

    .public-map-stack {
      position: relative;
      isolation: isolate;
      z-index: 0;
    }

    .public-map-stack .leaflet-container {
      position: relative;
      z-index: 0;
    }

    @keyframes public-loading-sweep {
      100% { transform: translateX(120%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .public-page-motion,
      [data-public-reveal] {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
        transition: none !important;
      }

      .public-loading-surface::after {
        animation: none !important;
      }
    }

    @media (min-width: 1536px) {
      .public-page .public-wide-content {
        padding-left: 3.5rem;
        padding-right: 3.5rem;
      }
    }
  `}</style>
);

export const PublicLayout = ({ children, className = '' }) => (
  <div className={`public-page min-h-screen overflow-x-clip text-slate-900 ${className}`.trim()}>
    <PublicThemeStyles />
    <PublicHeader />
    <div className="relative z-0">{children}</div>
    <PublicFooter />
    <CitizenAiCopilot />
  </div>
);

export default PublicLayout;
