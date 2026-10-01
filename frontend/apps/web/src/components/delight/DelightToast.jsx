import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';

const CONFIG = {
  success: {
    icon: Lucide.CircleCheckBig,
    border: 'border-emerald-200',
    iconClass: 'bg-emerald-50 text-emerald-700',
    accent: 'bg-emerald-500',
  },
  error: {
    icon: Lucide.CircleAlert,
    border: 'border-rose-200',
    iconClass: 'bg-rose-50 text-rose-700',
    accent: 'bg-rose-500',
  },
  warning: {
    icon: Lucide.TriangleAlert,
    border: 'border-amber-200',
    iconClass: 'bg-amber-50 text-amber-700',
    accent: 'bg-amber-500',
  },
  info: {
    icon: Lucide.Info,
    border: 'border-blue-200',
    iconClass: 'bg-blue-50 text-blue-700',
    accent: 'bg-blue-500',
  },
};

export default function DelightToast({
  message = 'Hoàn tất',
  sub = '',
  open = false,
  onClose = () => {},
  position = 'bottom-right',
  variant = 'success',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(onClose, 3800);
    return () => clearTimeout(timer);
  }, [open, onClose, message, sub]);

  if (!open) return null;

  const config = CONFIG[variant] || CONFIG.success;
  const Icon = config.icon;
  const positionClass = position === 'top-right' ? 'top-4' : 'bottom-6';
  const isError = variant === 'error';

  const toast = (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`pointer-events-auto fixed right-4 ${positionClass} z-[99999] w-[calc(100vw-2rem)] max-w-sm`}
    >
      <div className={`relative flex items-start gap-3 overflow-hidden rounded-[20px] border bg-white p-3.5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ${config.border}`}>
        <span className={`absolute inset-y-0 left-0 w-1 ${config.accent}`} aria-hidden="true" />
        <span className={`ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${config.iconClass}`} aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-sm font-semibold text-slate-900">{message}</div>
          {sub ? <div className="mt-0.5 text-xs leading-5 text-slate-500">{sub}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          title="Đóng"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Lucide.X size={15} />
        </button>
      </div>
    </div>
  );

  try {
    return createPortal(toast, document.body);
  } catch {
    return toast;
  }
}
