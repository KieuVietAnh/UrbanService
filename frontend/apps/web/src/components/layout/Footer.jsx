// src/components/layout/Footer.jsx
import * as Lucide from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-10 shrink-0 border-t border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-copy)]">
      <div className="mx-auto flex min-h-[84px] w-full max-w-[1440px] flex-col gap-4 px-4 py-5 pb-7 sm:px-6 md:flex-row md:items-center md:justify-between md:pb-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300"
            aria-hidden="true"
          >
            <Lucide.MapPinned size={16} />
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--public-title)]">
              UrbanMind
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--public-muted)]">
              © {currentYear} Cổng phản ánh đô thị
            </p>
          </div>
        </div>

        <nav
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[var(--public-muted)]"
          aria-label="Thông tin pháp lý và hỗ trợ"
        >
          <a href="#privacy" className="transition-colors hover:text-blue-700 dark:hover:text-blue-300">
            Chính sách riêng tư
          </a>
          <a href="#terms" className="transition-colors hover:text-blue-700 dark:hover:text-blue-300">
            Điều khoản sử dụng
          </a>
          <a
            href="mailto:support@urbanmind.vn"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
          >
            <Lucide.LifeBuoy size={13} aria-hidden="true" />
            Hỗ trợ
          </a>
        </nav>
      </div>
    </footer>
  );
};
