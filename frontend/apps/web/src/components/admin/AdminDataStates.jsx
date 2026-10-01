import * as Lucide from 'lucide-react';

export const AdminRefreshIndicator = ({ visible, label = 'Đang cập nhật dữ liệu...' }) => {
  if (!visible) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300"
      role="status"
      aria-live="polite"
    >
      <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      {label}
    </div>
  );
};

export const AdminErrorState = ({
  title = 'Không thể tải dữ liệu',
  description = 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.',
  onRetry,
}) => (
  <div className="admin-empty-panel flex min-h-[280px] items-center justify-center p-8 text-center">
    <div className="max-w-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
        <Lucide.CircleAlert size={24} />
      </div>
      <h4 className="mt-4 text-base font-semibold text-slate-950 dark:text-slate-100">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="admin-secondary-action btn btn-sm mt-5 rounded-xl text-sm font-semibold normal-case"
        >
          <Lucide.RotateCcw size={15} />
          Thử lại
        </button>
      ) : null}
    </div>
  </div>
);

export const AdminEmptyState = ({
  icon: Icon = Lucide.Inbox,
  title = 'Không có dữ liệu',
  description = '',
  action,
}) => (
  <div className="admin-empty-panel flex min-h-[280px] items-center justify-center p-8 text-center">
    <div className="max-w-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
        <Icon size={24} />
      </div>
      <h4 className="mt-4 text-base font-semibold text-slate-950 dark:text-slate-100">{title}</h4>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  </div>
);

export const AdminCardGridSkeleton = ({ cards = 6 }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite">
    {Array.from({ length: cards }).map((_, index) => (
      <div
        key={index}
        className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-slate-900/70"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.07]" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.07]" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
            </div>
          </div>
          <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.07]" />
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.07]" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.07]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.07]" />
        </div>
        <div className="mt-5 h-24 animate-pulse rounded-2xl bg-slate-50 dark:bg-white/[0.045]" />
      </div>
    ))}
    <span className="sr-only">Đang tải dữ liệu</span>
  </div>
);
