import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { resolveNotificationDestination } from '../../utils/notificationNavigation';

const formatRelativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  return `${days} ngày trước`;
};

const getIcon = (notification) => {
  const text = `${notification?.title || ''} ${notification?.type || ''}`.toLowerCase();
  if (text.includes('hoàn') || text.includes('result') || text.includes('resolved')) return Lucide.CircleCheckBig;
  if (text.includes('làm lại') || text.includes('rework') || text.includes('bổ sung')) return Lucide.RotateCcw;
  if (text.includes('comment') || text.includes('bình luận')) return Lucide.MessageCircle;
  if (text.includes('subscribe') || text.includes('follow') || text.includes('theo dõi')) return Lucide.BellRing;
  return Lucide.RefreshCcw;
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, totalCount, loading, error, markAsRead, markAllAsRead } = useNotifications(user?.userId);
  const visibleNotifications = useMemo(() => [...notifications]
    .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
    .slice(0, 5), [notifications]);

  const openNotification = (notification) => {
    const destination = resolveNotificationDestination(notification, user?.role);
    if (notification?.isRead === false && notification?.notificationId) {
      markAsRead(notification.notificationId).catch(() => {});
    }
    navigate(destination);
  };

  return (
    <div className="dropdown dropdown-end">
      <button
        aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ''}`}
        title="Thông báo"
        tabIndex={0}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
      >
        <Lucide.Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold leading-none text-white dark:border-slate-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <div tabIndex={0} className="dropdown-content z-[80] mt-3 w-[min(410px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">Thông báo</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{unreadCount} chưa đọc · {totalCount} thông báo</p>
          </div>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={loading || unreadCount === 0}
            className="text-xs font-semibold text-blue-700 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-blue-300"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </header>

        <div className="p-2">
          {loading && notifications.length === 0 ? (
            <div className="space-y-1" aria-busy="true" aria-label="Đang tải thông báo">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl px-3 py-3">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : error && notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-rose-600">{error}</div>
          ) : visibleNotifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Lucide.BellOff size={24} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">Chưa có thông báo</p>
            </div>
          ) : visibleNotifications.map((notification) => {
            const Icon = getIcon(notification);
            const unread = notification?.isRead === false;
            return (
              <button
                type="button"
                key={notification?.notificationId ?? `${notification?.title}-${notification?.createdAt}`}
                onClick={() => openNotification(notification)}
                className={`group flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition ${unread ? 'bg-blue-50/80 hover:bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <strong className={`line-clamp-1 text-sm ${unread ? 'font-semibold text-slate-950 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                      {notification?.title || 'Thông báo mới'}
                    </strong>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatRelativeTime(notification?.createdAt)}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{notification?.message || 'Không có nội dung thông báo.'}</span>
                </span>
                {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Chưa đọc" />}
              </button>
            );
          })}
        </div>

        <footer className="border-t border-slate-100 p-3 dark:border-white/10">
          <button type="button" onClick={() => navigate('/notifications')} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10">
            Xem tất cả thông báo
            <Lucide.ArrowRight size={15} />
          </button>
        </footer>
      </div>
    </div>
  );
};

export default NotificationBell;
