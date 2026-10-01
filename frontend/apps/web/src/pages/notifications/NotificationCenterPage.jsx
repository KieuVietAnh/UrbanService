import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { APP_ROLES, getInternalRole } from '@urbanmind/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import {
  getNotificationDestinationEntity,
  NOTIFICATION_FALLBACK_ROUTE,
  resolveNotificationDestination,
} from '../../utils/notificationNavigation';
import { getNotificationCategory } from './notificationCenterUtils.js';

const NOTIFICATIONS_PER_VIEW = 12;

const categoryFilters = [
  { id: 'all', label: 'Tất cả', icon: Lucide.LayoutList },
  { id: 'status', label: 'Cập nhật trạng thái', icon: Lucide.RefreshCcw },
  { id: 'rework', label: 'Yêu cầu bổ sung', icon: Lucide.RotateCcw },
  { id: 'resolution', label: 'Kết quả xử lý', icon: Lucide.CircleCheckBig },
  { id: 'community', label: 'Hoạt động cộng đồng', icon: Lucide.MessageCircle },
];

const categoryStyles = {
  status: { label: 'Cập nhật trạng thái', icon: Lucide.RefreshCcw, iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  rework: { label: 'Yêu cầu bổ sung', icon: Lucide.RotateCcw, iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  resolution: { label: 'Kết quả xử lý', icon: Lucide.CircleCheckBig, iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  community: { label: 'Hoạt động cộng đồng', icon: Lucide.MessageCircle, iconClass: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
};

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

const getGroupLabel = (value) => {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return 'Trước đó';
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const days = Math.round((startNow - startTarget) / 86_400_000);
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  return 'Trước đó';
};

const groupNotifications = (items) => {
  const labels = ['Hôm nay', 'Hôm qua', 'Trước đó'];
  const groups = new Map(labels.map((label) => [label, []]));
  items.forEach((item) => groups.get(getGroupLabel(item?.createdAt)).push(item));
  return labels.map((label) => ({ label, items: groups.get(label) })).filter((group) => group.items.length > 0);
};

export const NotificationCenterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const internalRole = getInternalRole(user?.role);
  const isSystemStaff = internalRole === APP_ROLES.SYSTEM_STAFF;
  const isInteractionManager = internalRole === APP_ROLES.INTERACTION_MANAGER;
  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PER_VIEW);

  const {
    notifications,
    unreadCount,
    totalCount,
    hasNextPage,
    loading,
    initialized,
    loadingMore,
    error,
    loadAllNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications(user?.userId);

  const filteredNotifications = useMemo(() => notifications
    .filter((item) => !showUnreadOnly || item?.isRead === false)
    .filter((item) => activeCategory === 'all' || getNotificationCategory(item) === activeCategory)
    .filter((item) => {
      const term = searchQuery.trim().toLowerCase();
      if (!term) return true;
      return `${item?.title || ''} ${item?.message || ''}`.toLowerCase().includes(term);
    })
    .sort((a, b) => new Date(b?.createdAt) - new Date(a?.createdAt)), [notifications, activeCategory, showUnreadOnly, searchQuery]);

  const visibleNotifications = useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount]
  );

  const groups = useMemo(() => groupNotifications(visibleNotifications), [visibleNotifications]);
  const hasMoreLoaded = visibleCount < filteredNotifications.length;
  const hasMore = hasMoreLoaded || hasNextPage;
  const hasActiveFilters = activeCategory !== 'all' || showUnreadOnly || searchQuery.trim().length > 0;
  const refreshing = loading || loadingMore;

  const categoryCounts = useMemo(() => {
    const counts = { all: notifications.length, status: 0, rework: 0, resolution: 0, community: 0 };
    notifications.forEach((item) => {
      const category = getNotificationCategory(item);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  const loadingFullDataset = totalCount > notifications.length && (loading || loadingMore);

  useEffect(() => {
    if (!initialized || loading || loadingMore || totalCount <= notifications.length) return;
    loadAllNotifications({ force: true }).catch(() => {});
  }, [initialized, loadAllNotifications, loading, loadingMore, notifications.length, totalCount]);

  useEffect(() => {
    setVisibleCount(NOTIFICATIONS_PER_VIEW);
  }, [activeCategory, showUnreadOnly, searchQuery]);

  const handleRefresh = async () => {
    setVisibleCount(NOTIFICATIONS_PER_VIEW);
    try {
      await loadAllNotifications({ force: true });
    } catch {
      // useNotifications stores the user-facing error state.
    }
  };

  const handleLoadMore = async () => {
    if (hasMoreLoaded) {
      setVisibleCount((count) => count + NOTIFICATIONS_PER_VIEW);
      return;
    }

    if (hasNextPage) {
      const before = notifications.length;
      try {
        await loadMoreNotifications();
        setVisibleCount((count) => Math.max(count + NOTIFICATIONS_PER_VIEW, before + NOTIFICATIONS_PER_VIEW));
      } catch {
        // useNotifications stores the user-facing error state.
      }
    }
  };

  const openNotification = (notification) => {
    const destination = resolveNotificationDestination(notification, user?.role);

    if (notification?.isRead === false && notification?.notificationId) {
      markAsRead(notification.notificationId).catch(() => {});
    }

    if (destination !== NOTIFICATION_FALLBACK_ROUTE) {
      navigate(destination, {
        state: { from: '/notifications' },
      });
    }
  };

  return (
    <main className="notification-center-page text-base-content">
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="notification-center-shell relative isolate rounded-[34px] border p-4 sm:p-5 lg:p-6">
        <section className="notification-center-hero relative overflow-hidden rounded-[26px] border p-6 sm:p-8">
          <svg viewBox="0 0 1440 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-blue-500/10" fill="none" aria-hidden="true">
            <path d="M-50 222C170 140 325 244 538 161C742 82 899 220 1110 145C1251 94 1365 105 1495 160" stroke="currentColor" strokeWidth="2" />
            <path d="M-30 252C194 194 351 270 567 215C784 160 944 249 1167 197C1300 166 1391 170 1495 203" stroke="currentColor" strokeWidth="1.2" strokeDasharray="8 12" />
          </svg>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] sm:h-16 sm:w-16">
                <Lucide.BellRing size={28} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="notification-center-title text-[30px] font-bold tracking-[-0.04em] text-slate-950 sm:text-[38px] dark:text-white">Thông báo của tôi</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base lg:whitespace-nowrap dark:text-slate-300">
                {isSystemStaff
                  ? 'Theo dõi sự vụ được phân công, yêu cầu xử lý lại và các cập nhật liên quan.'
                  : isInteractionManager
                    ? 'Theo dõi cảnh báo SLA, sự vụ cần chú ý và cập nhật quan trọng.'
                    : 'Theo dõi phản ánh bạn đã gửi và các sự vụ cộng đồng bạn đang quan tâm.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 lg:ml-auto lg:flex-nowrap lg:justify-end">
              <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <Lucide.CheckCheck size={16} /> Đánh dấu tất cả đã đọc
              </button>
              <button type="button" onClick={handleRefresh} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                <Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Đang làm mới' : 'Làm mới'}
              </button>
            </div>
          </div>

          <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Chưa đọc', value: unreadCount, icon: Lucide.MailWarning, active: true },
              { label: 'Tổng thông báo', value: totalCount, icon: Lucide.Layers3 },
              { label: 'Đang hiển thị', value: visibleNotifications.length, icon: Lucide.ListFilter },
            ].map(({ label, value, icon: Icon, active }) => (
              <div key={label} className={`notification-stat-card rounded-2xl border p-4 shadow-sm ${active ? 'notification-stat-card-active' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</p>
                    <strong className={`mt-2 block text-3xl font-semibold ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-950 dark:text-white'}`}>{value}</strong>
                  </div>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}><Icon size={19} /></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="notification-center-panel mt-5 rounded-[22px] border p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {categoryFilters.map((filter) => {
                const active = activeCategory === filter.id;
                const Icon = filter.icon;
                return (
                  <button key={filter.id} type="button" onClick={() => setActiveCategory(filter.id)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>
                    <Icon size={15} /> {filter.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>{categoryCounts[filter.id] ?? 0}</span>
                  </button>
                );
              })}
            </div>
            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <input type="checkbox" checked={showUnreadOnly} onChange={(event) => setShowUnreadOnly(event.target.checked)} className="checkbox checkbox-sm border-slate-300 checked:border-blue-600 checked:bg-blue-600" />
              Chỉ chưa đọc
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div className="relative w-full sm:max-w-[460px]">
              <Lucide.Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm theo tiêu đề hoặc nội dung..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blue-500/10" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{loadingFullDataset ? 'Đang tải đầy đủ thông báo để lọc chính xác…' : `${filteredNotifications.length} thông báo phù hợp`}</p>
          </div>
        </section>

        <section className="notification-center-panel mt-5 overflow-hidden rounded-[22px] border">
          <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Danh sách thông báo</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isSystemStaff || isInteractionManager
                  ? 'Mở thông báo để đi tới đúng sự vụ hoặc phản ánh liên quan.'
                  : 'Mở thông báo để đi thẳng tới phản ánh hoặc sự vụ liên quan.'}
              </p>
            </div>
            <Lucide.BellRing size={20} className="text-blue-600 dark:text-blue-300" />
          </header>

          {error && notifications.length > 0 ? (
            <div className="mx-5 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" role="status">
              <Lucide.WifiOff size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Chưa thể cập nhật thông báo mới nhất</p>
                <p className="mt-0.5 text-xs leading-5 opacity-80">Dữ liệu đã tải vẫn được giữ lại. Bạn có thể thử làm mới lại sau.</p>
              </div>
            </div>
          ) : null}

          <div className="min-h-[260px]">
            {loading && notifications.length === 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/10" aria-busy="true" aria-label="Đang tải thông báo">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex gap-4 px-5 py-4">
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                    </div>
                    <div className="hidden h-9 w-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 sm:block" />
                  </div>
                ))}
              </div>
            ) : error && notifications.length === 0 ? (
              <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">{error}</div>
            ) : groups.length === 0 ? (
              <div className="p-12 text-center">
                <Lucide.BellOff size={30} className="mx-auto text-slate-300" />
                <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-white">
                  {notifications.length === 0 ? 'Chưa có thông báo' : 'Không có thông báo phù hợp'}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {notifications.length === 0
                    ? 'Khi phản ánh hoặc sự vụ bạn theo dõi có cập nhật, thông báo sẽ xuất hiện tại đây.'
                    : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'}
                </p>
                {hasActiveFilters && notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('all');
                      setShowUnreadOnly(false);
                      setSearchQuery('');
                    }}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    <Lucide.RotateCcw size={14} /> Xóa bộ lọc
                  </button>
                ) : null}
              </div>
            ) : groups.map((group, groupIndex) => (
              <div key={group.label} className={groupIndex > 0 ? 'border-t border-slate-100 dark:border-white/10' : ''}>
                <div className="notification-group-header flex items-center justify-between px-5 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{group.label}</h3>
                  <span className="text-xs text-slate-400">{group.items.length} thông báo</span>
                </div>
                {group.items.map((notification, index) => {
                  const category = getNotificationCategory(notification);
                  const config = categoryStyles[category];
                  const Icon = config.icon;
                  const unread = notification?.isRead === false;
                  const destinationEntity = getNotificationDestinationEntity(notification, user?.role);
                  const destination = resolveNotificationDestination(notification, user?.role);
                  const destinationLabel = destination !== NOTIFICATION_FALLBACK_ROUTE
                    ? {
                        incident: 'Mở sự vụ',
                        feedback: 'Mở phản ánh',
                        'provider-report': 'Mở tiến độ xử lý',
                      }[destinationEntity]
                    : null;
                  return (
                    <article key={notification?.notificationId ?? `${notification?.title}-${notification?.createdAt}`} className={`notification-row relative px-5 py-4 transition ${index > 0 ? 'border-t border-slate-100 dark:border-white/10' : ''} ${unread ? 'notification-row-unread' : ''}`}>
                      {unread && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-blue-600" />}
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 flex-1 gap-4">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.iconClass}`}><Icon size={18} /></span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className={`text-sm text-slate-950 dark:text-white ${unread ? 'font-semibold' : 'font-medium'}`}>{notification?.title || 'Thông báo mới'}</h4>
                              {unread && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">Mới</span>}
                            </div>
                            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">{notification?.message || 'Nội dung thông báo chưa có.'}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-medium">{config.label}</span>
                              <span aria-hidden="true">•</span>
                              <span className="inline-flex items-center gap-1"><Lucide.Clock3 size={12} />{formatRelativeTime(notification?.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          {destinationLabel ? (
                            <button type="button" onClick={() => openNotification(notification)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-900"><Lucide.ArrowUpRight size={14} />{destinationLabel}</button>
                          ) : (
                            <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400"><Lucide.Link2Off size={13} />Chưa có liên kết trực tiếp</span>
                          )}
                          {unread && <button type="button" onClick={() => markAsRead(notification?.notificationId)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><Lucide.MailCheck size={14} />Đánh dấu đã đọc</button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>

          {hasMore ? (
            <div className="border-t border-slate-100 px-5 py-4 text-center dark:border-white/10">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/60 dark:hover:bg-slate-700"
              >
                {loadingMore ? <span className="loading loading-spinner loading-xs" /> : <Lucide.ChevronDown size={16} />}
                {hasMoreLoaded
                  ? `Xem thêm ${Math.min(NOTIFICATIONS_PER_VIEW, filteredNotifications.length - visibleCount)} thông báo`
                  : 'Tải thêm thông báo'}
              </button>
              <p className="mt-2 text-xs text-slate-400">Đang hiển thị {visibleNotifications.length} · Đã tải {notifications.length}/{totalCount} thông báo</p>
            </div>
          ) : null}
        </section>
        </div>
      </div>
    </main>
  );
};

export default NotificationCenterPage;
