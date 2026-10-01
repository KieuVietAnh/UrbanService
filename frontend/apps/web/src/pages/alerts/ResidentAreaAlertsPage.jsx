import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { extractApiErrorMessage, toolsApi, userAreaAlertApi } from '@urbanmind/shared-api';
import { ManagerSelectMenu } from '../../components/manager/ManagerPageElements';

const PAGE_SIZE = 8;

const formatDateTime = (value) => {
  if (!value) return 'Không xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const severityMeta = (severity) => {
  const value = String(severity || '').toLowerCase();

  if (['critical', 'urgent', 'severe'].includes(value)) {
    return {
      label: 'Nghiêm trọng',
      icon: Lucide.Siren,
      borderClass: 'border-rose-200',
      chipClass: 'border-rose-200 bg-rose-50 text-rose-700',
      iconClass: 'bg-rose-50 text-rose-600',
    };
  }

  if (['high', 'warning'].includes(value)) {
    return {
      label: 'Cần chú ý',
      icon: Lucide.TriangleAlert,
      borderClass: 'border-amber-200',
      chipClass: 'border-amber-200 bg-amber-50 text-amber-700',
      iconClass: 'bg-amber-50 text-amber-600',
    };
  }

  if (['low', 'info', 'informational'].includes(value)) {
    return {
      label: 'Thông tin',
      icon: Lucide.Info,
      borderClass: 'border-sky-200',
      chipClass: 'border-sky-200 bg-sky-50 text-sky-700',
      iconClass: 'bg-sky-50 text-sky-600',
    };
  }

  return {
    label: 'Cảnh báo',
    icon: Lucide.BellRing,
    borderClass: 'border-blue-200',
    chipClass: 'border-blue-200 bg-blue-50 text-blue-700',
    iconClass: 'bg-blue-50 text-blue-600',
  };
};

const getAreaId = (area) => area?.areaId ?? area?.id ?? area?.areaID;
const getAreaName = (area) => area?.areaName ?? area?.name ?? `Khu vực ${getAreaId(area) ?? ''}`;

const getAlertIdentity = (alert) => (
  alert?.areaAlertId ??
  alert?.alertId ??
  alert?.id ??
  null
);

const getAlertFingerprint = (alert) => [
  String(alert?.title || '').trim().toLocaleLowerCase('vi-VN'),
  String(alert?.message || '').trim().toLocaleLowerCase('vi-VN'),
  String(alert?.areaId ?? '').trim(),
  String(alert?.areaName || '').trim().toLocaleLowerCase('vi-VN'),
  String(alert?.startAt || alert?.createdAt || '').trim(),
  normalizeToken(alert?.status),
  normalizeToken(alert?.alertType),
].join('|');

const dedupeAlerts = (items) => {
  const seenIds = new Set();
  const seenFingerprints = new Set();

  return items.filter((alert) => {
    const id = getAlertIdentity(alert);
    if (id != null && id !== '') {
      const key = String(id);
      if (seenIds.has(key)) return false;
      seenIds.add(key);
    }

    const fingerprint = getAlertFingerprint(alert);
    if (fingerprint.replace(/\|/g, '')) {
      if (seenFingerprints.has(fingerprint)) return false;
      seenFingerprints.add(fingerprint);
    }

    return true;
  });
};

const normalizeToken = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const statusLabel = (status) => {
  const token = normalizeToken(status);
  const labels = {
    active: 'Đang hiệu lực',
    published: 'Đang hiệu lực',
    ongoing: 'Đang diễn ra',
    scheduled: 'Sắp diễn ra',
    expired: 'Đã hết hiệu lực',
    inactive: 'Đã kết thúc',
    closed: 'Đã kết thúc',
    cancelled: 'Đã hủy',
  };
  return labels[token] || '';
};

const alertTypeLabel = (type) => {
  const token = normalizeToken(type);
  const labels = {
    emergency: 'Khẩn cấp',
    warning: 'Cảnh báo',
    information: 'Thông tin',
    info: 'Thông tin',
    weather: 'Thời tiết',
    traffic: 'Giao thông',
    environment: 'Môi trường',
    safety: 'An toàn',
    infrastructure: 'Hạ tầng',
  };
  return labels[token] || '';
};

const AlertSkeleton = () => (
  <div className="rounded-[20px] border border-slate-200/70 bg-white p-4 sm:p-5" aria-hidden="true">
    <div className="animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded-full bg-slate-100" />
            <div className="h-5 w-28 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 h-5 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-4 w-full rounded bg-slate-100" />
          <div className="mt-2 h-4 w-4/5 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  </div>
);

export const ResidentAreaAlertsPage = () => {
  const [areas, setAreas] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [onlySubscribedAreas, setOnlySubscribedAreas] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [alertsPage, setAlertsPage] = useState({ items: [], totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [actionAreaId, setActionAreaId] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [alertsError, setAlertsError] = useState('');

  const subscribedAreaIds = useMemo(
    () => new Set(subscriptions.map((item) => Number(item.areaId))),
    [subscriptions]
  );

  const availableAreas = useMemo(
    () => areas.filter((area) => !subscribedAreaIds.has(Number(getAreaId(area)))),
    [areas, subscribedAreaIds]
  );

  const loadSubscriptionsAndAreas = useCallback(async () => {
    setLoading(true);
    setSubscriptionError('');

    try {
      const [areaList, subscriptionList] = await Promise.all([
        toolsApi.getAreas({}, { throwOnError: true }),
        userAreaAlertApi.getSubscriptions(),
      ]);

      setAreas(Array.isArray(areaList) ? areaList : []);
      setSubscriptions(Array.isArray(subscriptionList) ? subscriptionList : []);
    } catch (requestError) {
      setSubscriptionError(
        extractApiErrorMessage(requestError, 'Không thể tải danh sách khu vực đang theo dõi.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError('');

    try {
      const payload = await userAreaAlertApi.getAlerts({
        OnlySubscribedAreas: onlySubscribedAreas,
        PageNumber: pageNumber,
        PageSize: PAGE_SIZE,
      });

      setAlertsPage(payload);
    } catch (requestError) {
      setAlertsError(
        extractApiErrorMessage(requestError, 'Không thể tải cảnh báo khu vực.')
      );
      setAlertsPage({ items: [], totalItems: 0, totalPages: 0 });
    } finally {
      setAlertsLoading(false);
    }
  }, [onlySubscribedAreas, pageNumber]);

  useEffect(() => {
    loadSubscriptionsAndAreas();
  }, [loadSubscriptionsAndAreas]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleSubscribe = async () => {
    const areaId = Number(selectedAreaId);
    if (!areaId) return;

    setActionAreaId(areaId);
    setSubscriptionError('');

    try {
      await userAreaAlertApi.subscribe(areaId, {
        receiveAlerts: true,
        isPrimaryArea: false,
      });

      setSelectedAreaId('');
      await loadSubscriptionsAndAreas();
      setPageNumber(1);
      await loadAlerts();
    } catch (requestError) {
      setSubscriptionError(
        extractApiErrorMessage(requestError, 'Không thể theo dõi khu vực này.')
      );
    } finally {
      setActionAreaId(null);
    }
  };

  const handleUnsubscribe = async (areaId) => {
    setActionAreaId(areaId);
    setSubscriptionError('');

    try {
      await userAreaAlertApi.unsubscribe(areaId);
      await loadSubscriptionsAndAreas();
      setPageNumber(1);
      await loadAlerts();
    } catch (requestError) {
      setSubscriptionError(
        extractApiErrorMessage(requestError, 'Không thể bỏ theo dõi khu vực này.')
      );
    } finally {
      setActionAreaId(null);
    }
  };

  const alerts = useMemo(
    () => dedupeAlerts(Array.isArray(alertsPage.items) ? alertsPage.items : []),
    [alertsPage.items]
  );
  const totalPages = Math.max(0, Number(alertsPage.totalPages) || 0);
  const totalItems = Number(alertsPage.totalItems) || alerts.length;

  const areaSelectPlaceholder = subscriptionError && areas.length === 0
    ? 'Không tải được khu vực'
    : areas.length === 0
      ? 'Chưa có khu vực khả dụng'
      : availableAreas.length === 0
        ? 'Đã theo dõi tất cả khu vực'
        : 'Chọn khu vực';

  return (
    <main className="space-y-4">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-[var(--public-border)] bg-[var(--public-surface)] px-5 py-5 shadow-[0_18px_52px_rgba(15,23,42,0.06)] sm:px-7 sm:py-6">
        <div
          className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full border-[32px] border-blue-100/55 dark:border-blue-500/5"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-[44%] h-44 w-44 rounded-full bg-cyan-200/15 blur-3xl dark:bg-cyan-500/5"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_26px_rgba(37,99,235,0.20)]">
              <Lucide.BellRing size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--public-title)] sm:text-[30px]">
                Cảnh báo khu vực
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--public-copy)]">
                Theo dõi phường bạn quan tâm và nhận các cảnh báo đô thị đang có hiệu lực tại khu vực đó.
              </p>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
              <div className="text-[11px] font-semibold text-slate-500">Đang theo dõi</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-xl font-bold text-blue-700">{loading ? '—' : subscriptions.length}</span>
                <span className="text-xs font-medium text-slate-500">khu vực</span>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <div className="text-[11px] font-semibold text-slate-500">Cảnh báo hiển thị</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-xl font-bold text-emerald-700">{alertsLoading ? '—' : totalItems}</span>
                <span className="text-xs font-medium text-slate-500">cảnh báo</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3 xl:sticky xl:top-24">
          <div className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 shadow-[0_14px_38px_rgba(15,23,42,0.055)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">
                  Khu vực quan tâm
                </p>
                <h2 className="mt-1.5 text-lg font-bold text-[var(--public-title)]">
                  Quản lý theo dõi
                </h2>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Lucide.RadioTower size={17} aria-hidden="true" />
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-[var(--public-muted)]">
              Thêm một phường để cảnh báo của khu vực đó được ưu tiên trong danh sách.
            </p>

            <div className="mt-4 space-y-2">
              <ManagerSelectMenu
                value={selectedAreaId}
                onChange={setSelectedAreaId}
                disabled={loading || availableAreas.length === 0}
                ariaLabel="Chọn khu vực để theo dõi"
                className="h-11"
                options={[
                  {
                    value: '',
                    label: areaSelectPlaceholder,
                  },
                  ...availableAreas.map((area) => ({
                    value: getAreaId(area),
                    label: getAreaName(area),
                  })),
                ]}
              />

              <button
                type="button"
                onClick={handleSubscribe}
                disabled={!selectedAreaId || actionAreaId !== null}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {actionAreaId && Number(selectedAreaId) === actionAreaId ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Lucide.Plus size={15} aria-hidden="true" />
                )}
                Theo dõi khu vực
              </button>
            </div>

            {subscriptionError ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700">
                <Lucide.CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{subscriptionError}</span>
              </div>
            ) : null}

            <div className="mt-5 border-t border-[var(--public-border-soft)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[var(--public-title)]">Đang theo dõi</h3>
                <span className="text-[11px] font-medium text-[var(--public-muted)]">
                  {loading ? '...' : subscriptions.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {loading ? (
                  [1, 2].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                  ))
                ) : subscriptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--public-border)] bg-[var(--public-surface-soft)] px-4 py-5 text-center">
                    <Lucide.MapPinned size={22} className="mx-auto text-[var(--public-muted)]" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold text-[var(--public-title)]">
                      Chưa theo dõi khu vực nào
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">
                      Chọn một phường phía trên để bắt đầu.
                    </p>
                  </div>
                ) : (
                  subscriptions.map((subscription) => (
                    <div
                      key={subscription.subscriptionId ?? subscription.areaId}
                      className="group flex items-center gap-3 rounded-2xl border border-[var(--public-border-soft)] bg-[var(--public-surface-soft)] px-3.5 py-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Lucide.MapPin size={16} aria-hidden="true" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-[var(--public-title)]">
                          {subscription.areaName || `Khu vực ${subscription.areaId}`}
                        </strong>
                        <p className="mt-0.5 text-[11px] text-emerald-600">
                          {subscription.receiveAlerts ? 'Đang nhận cảnh báo' : 'Đã tắt cảnh báo'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnsubscribe(subscription.areaId)}
                        disabled={actionAreaId !== null}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        aria-label={`Bỏ theo dõi ${subscription.areaName || `khu vực ${subscription.areaId}`}`}
                        title="Bỏ theo dõi"
                      >
                        {actionAreaId === subscription.areaId ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Lucide.X size={15} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 shadow-[0_14px_38px_rgba(15,23,42,0.055)] sm:p-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">
                Dành cho cư dân
              </p>
              <h2 className="mt-1.5 text-xl font-bold tracking-[-0.02em] text-[var(--public-title)]">
                Cảnh báo mới nhất
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--public-copy)]">
                {onlySubscribedAreas
                  ? 'Đang ưu tiên cảnh báo từ các khu vực bạn theo dõi.'
                  : 'Đang hiển thị cảnh báo từ tất cả khu vực công khai.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOnlySubscribedAreas((current) => !current);
                setPageNumber(1);
              }}
              aria-pressed={onlySubscribedAreas}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${
                onlySubscribedAreas
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-[var(--public-border)] bg-[var(--public-surface-strong)] text-[var(--public-copy)] hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <Lucide.MapPinCheck size={15} aria-hidden="true" />
              {onlySubscribedAreas ? 'Khu vực đang theo dõi' : 'Tất cả khu vực'}
            </button>
          </header>

          {alertsError ? (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex min-w-0 items-start gap-2.5">
                <Lucide.CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{alertsError}</span>
              </div>
              <button
                type="button"
                onClick={loadAlerts}
                className="shrink-0 text-xs font-bold text-rose-700 underline underline-offset-2"
              >
                Thử lại
              </button>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {alertsLoading ? (
              [1, 2, 3].map((item) => <AlertSkeleton key={item} />)
            ) : alerts.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[var(--public-border)] bg-[var(--public-surface-soft)] px-5 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Lucide.BellOff size={22} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-[var(--public-title)]">
                  Chưa có cảnh báo phù hợp
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--public-muted)]">
                  {onlySubscribedAreas
                    ? 'Khu vực bạn đang theo dõi hiện chưa có cảnh báo mới. Bạn có thể xem tất cả khu vực để kiểm tra thêm.'
                    : 'Khi có cảnh báo đô thị mới, nội dung sẽ xuất hiện tại đây.'}
                </p>
                {onlySubscribedAreas ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOnlySubscribedAreas(false);
                      setPageNumber(1);
                    }}
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                  >
                    Xem tất cả khu vực
                    <Lucide.ArrowRight size={13} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : (
              alerts.map((alert) => {
                const severity = severityMeta(alert.severity);
                const SeverityIcon = severity.icon;
                const readableStatus = statusLabel(alert.status);
                const readableType = alertTypeLabel(alert.alertType);

                return (
                  <article
                    key={getAlertIdentity(alert) ?? getAlertFingerprint(alert)}
                    className={`rounded-[20px] border bg-[var(--public-surface-strong)] p-4 transition hover:shadow-[0_12px_30px_rgba(15,23,42,0.055)] sm:p-5 ${severity.borderClass}`}
                  >
                    <div className="flex items-start gap-3.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${severity.iconClass}`}>
                        <SeverityIcon size={18} aria-hidden="true" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${severity.chipClass}`}>
                                {severity.label}
                              </span>

                              {alert.areaName ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                                  <Lucide.MapPin size={11} aria-hidden="true" />
                                  {alert.areaName}
                                </span>
                              ) : null}

                              {alert.isSubscribedArea ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                                  <Lucide.Radio size={11} aria-hidden="true" />
                                  Đang theo dõi
                                </span>
                              ) : null}
                            </div>

                            <h3 className="mt-2.5 text-[15px] font-bold leading-6 text-[var(--public-title)]">
                              {alert.title || 'Cảnh báo khu vực'}
                            </h3>
                          </div>

                          <time className="shrink-0 text-[11px] font-medium text-[var(--public-muted)]">
                            {formatDateTime(alert.startAt || alert.createdAt)}
                          </time>
                        </div>

                        <p className="mt-1.5 text-sm leading-6 text-[var(--public-copy)]">
                          {alert.message || 'Không có mô tả bổ sung.'}
                        </p>

                        {(readableType || readableStatus || alert.categoryName) ? (
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--public-border-soft)] pt-3 text-[11px] text-[var(--public-muted)]">
                            {readableType ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Lucide.TriangleAlert size={12} aria-hidden="true" />
                                {readableType}
                              </span>
                            ) : null}

                            {readableStatus ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Lucide.Activity size={12} aria-hidden="true" />
                                {readableStatus}
                              </span>
                            ) : null}

                            {alert.categoryName ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Lucide.Tag size={12} aria-hidden="true" />
                                {alert.categoryName}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--public-border-soft)] pt-4">
              <button
                type="button"
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                disabled={pageNumber <= 1 || alertsLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3 text-xs font-semibold text-[var(--public-title)] transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-45"
              >
                <Lucide.ChevronLeft size={14} aria-hidden="true" />
                Trước
              </button>

              <span className="text-xs font-medium text-[var(--public-copy)]">
                Trang {pageNumber}/{totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))}
                disabled={pageNumber >= totalPages || alertsLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3 text-xs font-semibold text-[var(--public-title)] transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-45"
              >
                Sau
                <Lucide.ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
};
