import * as Lucide from 'lucide-react';

const ALERT_CONFIG = {
  error: {
    icon: Lucide.CircleAlert,
    border: 'border-rose-200 dark:border-rose-900/70',
    surface: 'bg-rose-50/80 dark:bg-rose-500/10',
    iconClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    titleClass: 'text-rose-900 dark:text-rose-200',
  },
  warning: {
    icon: Lucide.TriangleAlert,
    border: 'border-amber-200 dark:border-amber-900/70',
    surface: 'bg-amber-50/80 dark:bg-amber-500/10',
    iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    titleClass: 'text-amber-900 dark:text-amber-200',
  },
  info: {
    icon: Lucide.Info,
    border: 'border-blue-200 dark:border-blue-900/70',
    surface: 'bg-blue-50/80 dark:bg-blue-500/10',
    iconClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    titleClass: 'text-blue-900 dark:text-blue-200',
  },
  success: {
    icon: Lucide.CircleCheckBig,
    border: 'border-emerald-200 dark:border-emerald-900/70',
    surface: 'bg-emerald-50/80 dark:bg-emerald-500/10',
    iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    titleClass: 'text-emerald-900 dark:text-emerald-200',
  },
};

const SemanticAlert = ({ type, message, title, onClose, icon = true }) => {
  const config = ALERT_CONFIG[type];
  const Icon = config.icon;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm ${config.border} ${config.surface}`} role={type === 'error' ? 'alert' : 'status'}>
      {icon ? (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.iconClass}`} aria-hidden="true">
          <Icon size={18} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1 pt-0.5">
        {title ? <h4 className={`text-sm font-semibold ${config.titleClass}`}>{title}</h4> : null}
        {message ? <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{message}</p> : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          title="Đóng"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/70 hover:text-slate-700 dark:hover:bg-slate-900/70 dark:hover:text-slate-200"
        >
          <Lucide.X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
};

export const ErrorAlert = ({ message, title = 'Không thể hoàn tất', onClose, icon = true }) => (
  <SemanticAlert type="error" message={message} title={title} onClose={onClose} icon={icon} />
);

export const WarningAlert = ({ message, title = 'Cần chú ý', onClose, icon = true }) => (
  <SemanticAlert type="warning" message={message} title={title} onClose={onClose} icon={icon} />
);

export const InfoAlert = ({ message, title = 'Thông tin', onClose, icon = true }) => (
  <SemanticAlert type="info" message={message} title={title} onClose={onClose} icon={icon} />
);

export const SuccessAlert = ({ message, title = 'Hoàn tất', onClose, icon = true }) => (
  <SemanticAlert type="success" message={message} title={title} onClose={onClose} icon={icon} />
);
