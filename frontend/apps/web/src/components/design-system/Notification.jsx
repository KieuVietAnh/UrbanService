import * as Lucide from 'lucide-react';
import clsx from './clsx';

const CONFIG = {
  info: {
    icon: Lucide.Info,
    border: 'border-blue-200 dark:border-blue-900/70',
    surface: 'bg-blue-50/80 dark:bg-blue-500/10',
    iconClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  },
  success: {
    icon: Lucide.CircleCheckBig,
    border: 'border-emerald-200 dark:border-emerald-900/70',
    surface: 'bg-emerald-50/80 dark:bg-emerald-500/10',
    iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  warning: {
    icon: Lucide.TriangleAlert,
    border: 'border-amber-200 dark:border-amber-900/70',
    surface: 'bg-amber-50/80 dark:bg-amber-500/10',
    iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  danger: {
    icon: Lucide.CircleAlert,
    border: 'border-rose-200 dark:border-rose-900/70',
    surface: 'bg-rose-50/80 dark:bg-rose-500/10',
    iconClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
};

function Notification({ type = 'info', title, children, className }) {
  const config = CONFIG[type] || CONFIG.info;
  const Icon = config.icon;
  return (
    <div
      className={clsx('flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm', config.border, config.surface, className)}
      role={type === 'danger' ? 'alert' : 'status'}
    >
      <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', config.iconClass)} aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        {title ? <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div> : null}
        <div className={clsx('text-sm leading-5 text-slate-600 dark:text-slate-300', title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  );
}

export default Notification;
