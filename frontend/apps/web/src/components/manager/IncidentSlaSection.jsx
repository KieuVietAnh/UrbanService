import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { extractApiErrorMessage, slaApi } from '@urbanmind/shared-api';
import { buildHubUrl, getSignalRAccessToken } from '../../utils/signalRAccessToken';
import { createOptionalSignalRConnection } from '../../utils/optionalSignalR';
import { ErrorAlert } from '../alerts/ErrorAlert';
import { ManagerSectionHeader } from './ManagerPageElements';

const SLA_PAUSE_REASONS = [
  { value: 'WaitingCitizen', label: 'Chờ phản hồi từ người dân' },
  { value: 'ForceMajeure', label: 'Sự kiện bất khả kháng' },
  { value: 'ExternalDependency', label: 'Phụ thuộc đơn vị bên ngoài' },
  { value: 'SystemMaintenance', label: 'Bảo trì hệ thống' },
  { value: 'Other', label: 'Lý do khác' },
];

const ALLOWED_PAUSE_REASONS = new Set(SLA_PAUSE_REASONS.map((reason) => reason.value));

const EVENT_LABELS = {
  started: 'Bắt đầu tính SLA',
  responded: 'Đã ghi nhận phản hồi đầu tiên',
  paused: 'Tạm dừng SLA',
  resumed: 'Tiếp tục tính SLA',
  responsewarning: 'Cảnh báo sắp trễ hạn phản hồi',
  resolutionwarning: 'Cảnh báo sắp trễ hạn hoàn thành',
  responsebreached: 'Vi phạm hạn phản hồi',
  resolutionbreached: 'Vi phạm hạn hoàn thành',
  recalculated: 'Tính lại SLA theo chính sách mới',
  completed: 'Hoàn thành SLA',
  cancelled: 'Hủy SLA',
};

const TRIGGER_LABELS = {
  user: 'Người dân',
  staff: 'Nhân viên',
  manager: 'Quản lý',
  system: 'Hệ thống',
};

const normalizeKey = (value) => String(value ?? '').replace(/[-_\s]/g, '').toLowerCase();

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};

/** Đồng hồ đếm ngược dạng HH:MM:SS, số ngày được cộng dồn vào phần giờ. */
const formatSlaCountdown = (value) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours + (days * 24)).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
};

const formatPauseDuration = (pause) => {
  const pausedAtMs = pause?.pausedAt ? new Date(pause.pausedAt).getTime() : NaN;
  const resumedAtMs = pause?.resumedAt ? new Date(pause.resumedAt).getTime() : NaN;

  if (!Number.isFinite(pausedAtMs)) return '—';

  // Chưa có mốc tiếp tục nghĩa là lần tạm dừng này vẫn đang diễn ra.
  if (!Number.isFinite(resumedAtMs)) return 'Đang tạm dừng';

  const totalSeconds = Math.max(0, Math.round((resumedAtMs - pausedAtMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} giây`);

  return parts.join(' ');
};

const getSlaBadgeClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value.includes('breach')) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value.includes('met') || value.includes('completed')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value.includes('warning')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value.includes('paused')) return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
};

const getSlaStatusLabel = (status) => {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'running') return 'Đang chạy';
  if (value === 'paused') return 'Tạm dừng';
  if (value === 'completed') return 'Đã hoàn thành';
  if (value === 'cancelled' || value === 'canceled') return 'Đã hủy';
  if (value === 'met') return 'Đạt SLA';
  if (value === 'pending') return 'Đang theo dõi';
  if (value === 'warning') return 'Sắp đến hạn';
  if (value === 'breached') return 'Vi phạm SLA';

  return status || 'Chưa xác định';
};

const MetaItem = ({ label, children, wide = false }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
    <dd className="mt-1.5 break-words text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
      {children || '—'}
    </dd>
  </div>
);

/**
 * Khối SLA của một sự vụ.
 *
 * Giữ nguyên bố cục của khối SLA cũ gắn với phản ánh: bốn thẻ tóm tắt, hai khối
 * thời hạn có đồng hồ đếm ngược, hai cột lịch sử, và hộp thoại riêng cho từng
 * thao tác. Khác biệt là mọi lời gọi đều theo incidentId, và có thêm những thao
 * tác mà vòng đời SLA của sự vụ hỗ trợ nhưng bản cũ không có.
 */
export const IncidentSlaSection = ({ incidentId, incidentStatus, canManage = false, onChanged }) => {
  const requestIdRef = useRef(0);

  const [slaDetail, setSlaDetail] = useState(null);
  const [slaStatus, setSlaStatus] = useState(null);
  const [slaTimeline, setSlaTimeline] = useState([]);
  const [slaClock, setSlaClock] = useState({
    responseSeconds: 0,
    resolutionSeconds: 0,
    syncedAt: 0,
    status: '',
  });
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [slaError, setSlaError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [slaActionLoading, setSlaActionLoading] = useState('');
  const [slaModal, setSlaModal] = useState(null);
  const [pauseReasonOpen, setPauseReasonOpen] = useState(false);
  const [slaModalForm, setSlaModalForm] = useState({ reasonCode: 'WaitingCitizen', note: '' });
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const refreshSlaData = useCallback(async () => {
    if (!incidentId) return;
    const requestId = ++requestIdRef.current;

    const [detailResult, statusResult, timelineResult] = await Promise.allSettled([
      slaApi.getCurrentIncidentSla(incidentId),
      slaApi.getIncidentSlaStatus(incidentId),
      slaApi.getIncidentSlaTimeline(incidentId),
    ]);

    if (requestId !== requestIdRef.current) return;

    if (detailResult.status === 'fulfilled') setSlaDetail(detailResult.value ?? null);
    if (timelineResult.status === 'fulfilled') {
      setSlaTimeline(Array.isArray(timelineResult.value) ? timelineResult.value : []);
    }

    if (statusResult.status === 'fulfilled' && statusResult.value) {
      const nextStatus = statusResult.value;
      setSlaStatus(nextStatus);

      /*
       * Số giây còn lại lấy từ máy chủ, mốc đồng bộ lấy lúc nhận phản hồi. Nhờ
       * vậy đếm ngược không lệch khi đồng hồ máy người dùng sai giờ.
       */
      setSlaClock({
        responseSeconds: Math.max(0, Number(nextStatus.responseRemainingSeconds) || 0),
        resolutionSeconds: Math.max(0, Number(nextStatus.resolutionRemainingSeconds) || 0),
        syncedAt: Date.now(),
        status: String(nextStatus.status || ''),
      });
      setClockTick(Date.now());
    }

    /*
     * Sự vụ chưa khởi động SLA là trạng thái hợp lệ chứ không phải lỗi, nên chỉ
     * báo lỗi khi cả hai lời gọi chính đều hỏng và không phải 404.
     */
    if (detailResult.status === 'rejected' && statusResult.status === 'rejected') {
      const notFound = Number(detailResult.reason?.response?.status) === 404;
      setSlaDetail(null);
      setSlaStatus(null);
      setSlaError(notFound ? '' : extractApiErrorMessage(detailResult.reason, 'Không thể tải dữ liệu SLA của sự vụ.'));
    } else {
      setSlaError('');
    }

    setLoaded(true);
  }, [incidentId]);

  useEffect(() => {
    setSlaDetail(null);
    setSlaStatus(null);
    setSlaTimeline([]);
    setLoaded(false);
    void refreshSlaData();
    return () => { requestIdRef.current += 1; };
  }, [refreshSlaData]);

  const isSlaRunning = String(slaClock.status || '').toLowerCase() === 'running';

  useEffect(() => {
    if (!isSlaRunning) return undefined;
    const timerId = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [isSlaRunning, slaClock.syncedAt]);

  /*
   * Backend phát `SlaUpdated` cho mọi client kèm IncidentId nên phải tự lọc theo
   * sự vụ đang mở. Mất kết nối chỉ tắt chỉ báo trực tiếp chứ không báo lỗi, vì
   * số liệu vẫn đúng tới lần tải gần nhất.
   */
  useEffect(() => {
    if (!incidentId || !getSignalRAccessToken()) return undefined;

    const connection = createOptionalSignalRConnection({
      signalR,
      hubUrl: buildHubUrl('/hubs/sla'),
      accessTokenFactory: () => getSignalRAccessToken(),
    });

    let disposed = false;
    const mark = (connected) => { if (!disposed) setRealtimeConnected(connected); };

    connection.on('SlaUpdated', (payload) => {
      const updatedIncidentId = String(payload?.incidentId ?? payload?.IncidentId ?? '');
      if (!updatedIncidentId) return;
      if (updatedIncidentId.toLowerCase() !== String(incidentId).toLowerCase()) return;
      void refreshSlaData();
    });

    connection.onreconnected(() => mark(true));
    connection.onreconnecting(() => mark(false));
    connection.onclose(() => mark(false));
    connection.start().then(() => mark(true)).catch(() => mark(false));

    return () => { disposed = true; void connection.stop(); };
  }, [incidentId, refreshSlaData]);

  const runSlaAction = async (key, action, successText) => {
    setSlaActionLoading(key);
    setMessage({ type: '', text: '' });
    try {
      await action();
      await refreshSlaData();
      setMessage({ type: 'success', text: successText });
      if (typeof onChanged === 'function') onChanged(successText);
    } catch (err) {
      setMessage({ type: 'error', text: extractApiErrorMessage(err, 'Không thể cập nhật SLA.') });
    } finally {
      setSlaActionLoading('');
    }
  };

  const openSlaModal = (type) => {
    setMessage({ type: '', text: '' });
    setPauseReasonOpen(false);
    setSlaModalForm({ reasonCode: type === 'pause' ? 'WaitingCitizen' : 'Other', note: '' });
    setSlaModal(type);
  };

  const closeSlaModal = () => {
    if (slaActionLoading) return;
    setPauseReasonOpen(false);
    setSlaModal(null);
    setSlaModalForm({ reasonCode: 'WaitingCitizen', note: '' });
  };

  const handleSubmitSlaModal = async () => {
    const noteValue = String(slaModalForm.note || '').trim();

    if (slaModal === 'pause') {
      if (!ALLOWED_PAUSE_REASONS.has(slaModalForm.reasonCode)) {
        setMessage({ type: 'error', text: 'Vui lòng chọn lý do tạm dừng hợp lệ.' });
        return;
      }
      await runSlaAction('pause', () => slaApi.pauseIncidentSla(incidentId, {
        reasonCode: slaModalForm.reasonCode,
        reasonNote: noteValue || null,
      }), 'Đã tạm dừng SLA.');
      setSlaModal(null);
      return;
    }

    if (slaModal === 'resume') {
      await runSlaAction('resume', () => slaApi.resumeIncidentSla(incidentId, {
        note: noteValue || null,
      }), 'Đã tiếp tục SLA.');
      setSlaModal(null);
      return;
    }

    if (slaModal === 'complete') {
      await runSlaAction('complete', () => slaApi.completeIncidentSla(incidentId, {
        note: noteValue || null,
      }), 'Đã đóng SLA của sự vụ.');
      setSlaModal(null);
      return;
    }

    if (slaModal === 'recalculate') {
      await runSlaAction('recalculate', () => slaApi.recalculateIncidentSla(incidentId, {
        note: noteValue || null,
      }), 'Đã tính lại SLA theo chính sách hiện hành.');
      setSlaModal(null);
      return;
    }

    if (slaModal === 'cancel') {
      if (!noteValue) {
        setMessage({ type: 'error', text: 'Vui lòng nhập lý do hủy SLA.' });
        return;
      }
      await runSlaAction('cancel', () => slaApi.cancelIncidentSla(incidentId, noteValue), 'Đã hủy SLA.');
      setSlaModal(null);
    }
  };

  const handleCheckSlaViolation = async () => {
    const incidentSlaId = slaDetail?.incidentSlaId;
    if (!incidentSlaId) {
      setMessage({ type: 'error', text: 'Không tìm thấy mã SLA của sự vụ.' });
      return;
    }
    await runSlaAction('check', () => slaApi.checkIncidentSlaViolation(incidentSlaId), 'Đã kiểm tra vi phạm SLA.');
  };

  const handleStartSla = async () => {
    await runSlaAction('start', () => slaApi.startIncidentSla(incidentId), 'Đã khởi động SLA cho sự vụ.');
  };

  // Đồng hồ chỉ trôi khi SLA đang chạy; lúc tạm dừng thì giữ nguyên số đã đồng bộ.
  const elapsedSeconds = isSlaRunning && slaClock.syncedAt
    ? Math.max(0, Math.floor((clockTick - slaClock.syncedAt) / 1000))
    : 0;

  const responseCountdownSeconds = String(slaStatus?.responseStatus || '').toLowerCase() === 'pending'
    ? Math.max(0, slaClock.responseSeconds - elapsedSeconds)
    : 0;

  const resolutionCountdownSeconds = String(slaStatus?.resolutionStatus || '').toLowerCase() === 'pending'
    ? Math.max(0, slaClock.resolutionSeconds - elapsedSeconds)
    : 0;

  const currentStatus = slaStatus?.status || slaDetail?.status || '';
  const isRunning = String(currentStatus).toLowerCase() === 'running';
  const isPaused = String(currentStatus).toLowerCase() === 'paused';
  const isActive = isRunning || isPaused;
  const hasSla = Boolean(slaDetail || slaStatus);
  const pauseHistories = Array.isArray(slaDetail?.pauseHistories) ? slaDetail.pauseHistories : [];

  /*
   * Backend còn ràng buộc ở cấp sự vụ chứ không chỉ ở trạng thái SLA: chỉ đóng
   * SLA sau khi kết quả đã được duyệt, và chỉ hủy SLA sau khi sự vụ bị hủy.
   * Nút vẫn hiện nhưng bị khóa kèm lý do, để người dùng biết còn thiếu điều
   * kiện gì thay vì bấm rồi nhận lỗi 400.
   */
  const incidentStatusKey = normalizeKey(incidentStatus);
  const canCompleteSla = isRunning && incidentStatusKey === 'approved';
  const canCancelSla = isActive && incidentStatusKey === 'cancelled';

  const completeBlockedReason = !isRunning
    ? 'Chỉ đóng được SLA đang chạy.'
    : 'Chỉ hoàn thành SLA sau khi Manager đã duyệt kết quả sự vụ.';
  const cancelBlockedReason = 'Chỉ hủy SLA sau khi sự vụ đã được hủy.';

  const slaModalConfig = (() => {
    if (slaModal === 'pause') {
      return {
        title: 'Tạm dừng SLA',
        description: 'Đồng hồ SLA sẽ ngừng tính trong thời gian tạm dừng.',
        icon: <Lucide.PauseCircle size={21} />,
        iconClass: 'bg-amber-50 text-amber-700',
        confirmLabel: 'Tạm dừng SLA',
        confirmClass: 'bg-amber-600 hover:bg-amber-700',
        noteLabel: 'Ghi chú',
        noteRequired: false,
      };
    }
    if (slaModal === 'resume') {
      return {
        title: 'Tiếp tục SLA',
        description: 'Đồng hồ SLA sẽ chạy trở lại từ thời điểm hiện tại.',
        icon: <Lucide.PlayCircle size={21} />,
        iconClass: 'bg-blue-50 text-blue-700',
        confirmLabel: 'Tiếp tục SLA',
        confirmClass: 'bg-blue-600 hover:bg-blue-700',
        noteLabel: 'Ghi chú',
        noteRequired: false,
      };
    }
    if (slaModal === 'complete') {
      return {
        title: 'Hoàn thành SLA',
        description: 'SLA được ghi nhận là hoàn thành và ngừng theo dõi. Trạng thái của sự vụ không thay đổi.',
        icon: <Lucide.BadgeCheck size={21} />,
        iconClass: 'bg-emerald-50 text-emerald-700',
        confirmLabel: 'Hoàn thành SLA',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
        noteLabel: 'Ghi chú',
        noteRequired: false,
      };
    }
    if (slaModal === 'recalculate') {
      return {
        title: 'Tính lại SLA',
        description: 'Áp lại chính sách SLA hiện hành theo phường, danh mục và mức ưu tiên mới nhất của sự vụ. Các mốc hạn có thể thay đổi.',
        icon: <Lucide.RefreshCw size={21} />,
        iconClass: 'bg-blue-50 text-blue-700',
        confirmLabel: 'Tính lại SLA',
        confirmClass: 'bg-blue-600 hover:bg-blue-700',
        noteLabel: 'Ghi chú',
        noteRequired: false,
      };
    }
    if (slaModal === 'cancel') {
      return {
        title: 'Hủy SLA',
        description: 'SLA sẽ ngừng theo dõi và được đánh dấu là đã hủy.',
        icon: <Lucide.XCircle size={21} />,
        iconClass: 'bg-rose-50 text-rose-700',
        confirmLabel: 'Hủy SLA',
        confirmClass: 'bg-rose-600 hover:bg-rose-700',
        noteLabel: 'Lý do hủy',
        noteRequired: true,
      };
    }
    return null;
  })();

  if (!loaded) {
    return (
      <section className="admin-panel overflow-hidden">
        <ManagerSectionHeader id="incident-sla-title" title="SLA của sự vụ" description="Đang tải dữ liệu SLA…" icon={Lucide.TimerReset} />
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="incident-sla-title">
      <ManagerSectionHeader
        id="incident-sla-title"
        title="SLA của sự vụ"
        description="Theo dõi chính sách, thời hạn phản hồi, thời hạn hoàn thành, cảnh báo, vi phạm và lịch sử SLA."
        icon={Lucide.TimerReset}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {realtimeConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20" title="Đang nhận cập nhật SLA theo thời gian thực">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Trực tiếp
              </span>
            ) : null}

            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSlaBadgeClass(currentStatus)}`}>
              {getSlaStatusLabel(currentStatus || 'Chưa có SLA')}
            </span>

            {canManage && !hasSla ? (
              <button type="button" className="btn rounded-xl border-0 bg-blue-600 text-white hover:bg-blue-700" onClick={handleStartSla} disabled={Boolean(slaActionLoading)}>
                <Lucide.Play size={15} /> {slaActionLoading === 'start' ? 'Đang khởi động...' : 'Khởi động SLA'}
              </button>
            ) : null}

            {canManage && isActive ? (
              <>
                {isPaused ? (
                  <button type="button" className="btn admin-secondary-action rounded-xl" onClick={() => openSlaModal('resume')} disabled={Boolean(slaActionLoading)}>
                    <Lucide.Play size={15} /> {slaActionLoading === 'resume' ? 'Đang tiếp tục...' : 'Tiếp tục SLA'}
                  </button>
                ) : (
                  <button type="button" className="btn admin-secondary-action rounded-xl" onClick={() => openSlaModal('pause')} disabled={Boolean(slaActionLoading) || !slaDetail?.incidentSlaId}>
                    <Lucide.Pause size={15} /> {slaActionLoading === 'pause' ? 'Đang tạm dừng...' : 'Tạm dừng SLA'}
                  </button>
                )}

                <button
                  type="button"
                  className="btn admin-secondary-action rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => openSlaModal('recalculate')}
                  disabled={Boolean(slaActionLoading) || !slaDetail?.incidentSlaId || isPaused}
                  title={isPaused ? 'Hãy tiếp tục SLA trước khi tính lại.' : undefined}
                >
                  <Lucide.RefreshCw size={15} /> {slaActionLoading === 'recalculate' ? 'Đang tính lại...' : 'Tính lại SLA'}
                </button>

                <button
                  type="button"
                  className="btn admin-secondary-action rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => openSlaModal('complete')}
                  disabled={Boolean(slaActionLoading) || !slaDetail?.incidentSlaId || !canCompleteSla}
                  title={canCompleteSla ? undefined : completeBlockedReason}
                >
                  <Lucide.BadgeCheck size={15} /> {slaActionLoading === 'complete' ? 'Đang đóng...' : 'Hoàn thành SLA'}
                </button>
              </>
            ) : null}

            {canManage && hasSla ? (
              <>
                <button
                  type="button"
                  className="btn admin-secondary-action rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleCheckSlaViolation}
                  disabled={Boolean(slaActionLoading) || !slaDetail?.incidentSlaId || !isRunning}
                  title={isRunning ? undefined : 'Chỉ rà được vi phạm khi SLA đang chạy.'}
                >
                  <Lucide.ShieldCheck size={15} /> {slaActionLoading === 'check' ? 'Đang kiểm tra...' : 'Kiểm tra vi phạm'}
                </button>
                {isActive ? (
                  <button
                    type="button"
                    className="btn rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => openSlaModal('cancel')}
                    disabled={Boolean(slaActionLoading) || !slaDetail?.incidentSlaId || !canCancelSla}
                    title={canCancelSla ? undefined : cancelBlockedReason}
                  >
                    <Lucide.XCircle size={15} /> {slaActionLoading === 'cancel' ? 'Đang hủy...' : 'Hủy SLA'}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      />

      {message.text && !slaModal ? (
        <div className="px-5 pt-5 sm:px-6">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${message.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
            role="status"
          >
            {message.text}
          </div>
        </div>
      ) : null}

      {slaError && !slaDetail && !slaStatus ? (
        <div className="p-5 sm:p-6">
          <ErrorAlert title="Không có dữ liệu SLA" message={slaError} onClose={() => setSlaError('')} />
        </div>
      ) : !hasSla ? (
        <div className="p-5 sm:p-6">
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center dark:border-slate-700">
            <Lucide.TimerOff size={28} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Sự vụ chưa được tính SLA</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
              {canManage
                ? 'Khởi động SLA để bắt đầu đếm hạn phản hồi và hạn hoàn thành theo chính sách của phường và danh mục.'
                : 'SLA sẽ xuất hiện tại đây sau khi Interaction Manager khởi động theo dõi cho sự vụ.'}
            </p>
          </div>
        </div>
      ) : (
        <section className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Chính sách SLA</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{slaDetail?.policyName || '—'}</h3>
              <p className="mt-2 text-xs text-slate-500">{slaDetail?.priority || '—'} · {slaDetail?.categoryName || '—'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mã SLA</p>
              <h3 className="mt-2 font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">{slaDetail?.incidentSlaId || '—'}</h3>
              <p className="mt-2 text-xs text-slate-500">{slaDetail?.isCurrent === false ? 'SLA lịch sử' : 'SLA hiện tại'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Bắt đầu</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatDateTime(slaDetail?.startedAt || slaStatus?.startedAt)}</h3>
              <p className="mt-2 text-xs text-slate-500">{slaDetail?.startedByUserName || 'Hệ thống / không xác định'}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tổng thời gian tạm dừng</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{Number(slaDetail?.totalPausedMinutes || 0)} phút</h3>
              <p className="mt-2 text-xs text-slate-500">{pauseHistories.length} lần tạm dừng</p>
            </article>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Phản hồi đầu tiên</p>
                  <h3 className="mt-1 text-base font-semibold">Thời hạn phản hồi</h3>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSlaBadgeClass(slaStatus?.responseStatus || slaDetail?.responseStatus)}`}>
                  {getSlaStatusLabel(slaStatus?.responseStatus || slaDetail?.responseStatus || 'Pending')}
                </span>
              </header>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <MetaItem label="Hạn xử lý">{formatDateTime(slaDetail?.responseDueAt || slaStatus?.responseDueAt)}</MetaItem>
                <MetaItem label="Thời điểm phản hồi">{formatDateTime(slaDetail?.respondedAt)}</MetaItem>
                <MetaItem label="Còn lại">
                  <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatSlaCountdown(responseCountdownSeconds)}
                  </span>
                </MetaItem>
                <MetaItem label="Vi phạm">{slaStatus?.isResponseBreached || slaDetail?.isResponseBreached ? 'Có' : 'Không'}</MetaItem>
              </dl>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Hoàn thành xử lý</p>
                  <h3 className="mt-1 text-base font-semibold">Thời hạn hoàn thành</h3>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSlaBadgeClass(slaStatus?.resolutionStatus || slaDetail?.resolutionStatus)}`}>
                  {getSlaStatusLabel(slaStatus?.resolutionStatus || slaDetail?.resolutionStatus || 'Pending')}
                </span>
              </header>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <MetaItem label="Hạn xử lý">{formatDateTime(slaDetail?.resolutionDueAt || slaStatus?.resolutionDueAt)}</MetaItem>
                <MetaItem label="Thời điểm hoàn thành">{formatDateTime(slaDetail?.resolvedAt)}</MetaItem>
                <MetaItem label="Còn lại">
                  <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatSlaCountdown(resolutionCountdownSeconds)}
                  </span>
                </MetaItem>
                <MetaItem label="Vi phạm">{slaStatus?.isResolutionBreached || slaDetail?.isResolutionBreached ? 'Có' : 'Không'}</MetaItem>
              </dl>
            </article>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <article>
              <div className="flex items-center gap-2">
                <Lucide.History size={17} className="text-blue-600" />
                <h3 className="text-sm font-semibold">Lịch sử SLA</h3>
              </div>
              {slaTimeline.length > 0 ? (
                <div className="mt-4 max-h-[410px] overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                  <ol className="space-y-3">
                    {slaTimeline.map((event, index) => (
                      <li key={event.slaEventId || `${event.eventType}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm">{EVENT_LABELS[normalizeKey(event.eventType)] || event.eventType || 'Sự kiện SLA'}</strong>
                          <time className="text-[11px] text-slate-400">{formatDateTime(event.createdAt)}</time>
                        </div>
                        {event.note ? <p className="mt-2 text-xs leading-5 text-slate-500">{event.note}</p> : null}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {event.triggeredByUserName || TRIGGER_LABELS[normalizeKey(event.triggerSource)] || 'Hệ thống'}
                          {event.oldStatus && event.newStatus ? ` · ${getSlaStatusLabel(event.oldStatus)} → ${getSlaStatusLabel(event.newStatus)}` : ''}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Chưa có sự kiện SLA.</p>}
            </article>

            <article>
              <div className="flex items-center gap-2">
                <Lucide.PauseCircle size={17} className="text-amber-600" />
                <h3 className="text-sm font-semibold">Lịch sử tạm dừng</h3>
              </div>
              {pauseHistories.length > 0 ? (
                <div className="mt-4 max-h-[410px] overflow-y-auto pr-2 [scrollbar-gutter:stable]">
                  <ul className="space-y-3">
                    {pauseHistories.map((pause, index) => (
                      <li key={pause.slaPauseHistoryId || index} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <MetaItem label="Thời điểm tạm dừng">{formatDateTime(pause.pausedAt)}</MetaItem>
                          <MetaItem label="Thời điểm tiếp tục">{formatDateTime(pause.resumedAt)}</MetaItem>
                          <MetaItem label="Thời gian tạm dừng">{formatPauseDuration(pause)}</MetaItem>
                          <MetaItem label="Lý do">
                            {SLA_PAUSE_REASONS.find((reason) => reason.value === pause.reasonCode)?.label
                              || pause.reasonCode
                              || 'Không xác định'}
                          </MetaItem>
                          {pause.reasonNote ? <MetaItem label="Ghi chú" wide>{pause.reasonNote}</MetaItem> : null}
                          <MetaItem label="Người tạm dừng">{pause.pausedByUserName}</MetaItem>
                          <MetaItem label="Người tiếp tục">{pause.resumedByUserName}</MetaItem>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">SLA chưa từng được tạm dừng.</p>}
            </article>
          </div>
        </section>
      )}

      {slaModal && slaModalConfig && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget) closeSlaModal(); }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="incident-sla-action-dialog-title"
              className="w-full max-w-xl overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <header className="flex items-start gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${slaModalConfig.iconClass}`} aria-hidden="true">
                  {slaModalConfig.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 id="incident-sla-action-dialog-title" className="text-xl font-semibold text-slate-950 dark:text-white">{slaModalConfig.title}</h2>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{slaModalConfig.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeSlaModal}
                      disabled={Boolean(slaActionLoading)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
                      aria-label="Đóng"
                    >
                      <Lucide.X size={19} />
                    </button>
                  </div>
                </div>
              </header>

              <form onSubmit={(event) => { event.preventDefault(); void handleSubmitSlaModal(); }}>
                <div className="space-y-5 px-6 py-5">
                  {slaModal === 'pause' ? (
                    <div className="relative">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Lý do tạm dừng <span className="text-rose-600">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPauseReasonOpen((open) => !open)}
                        className="mt-2 flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3.5 text-left text-sm font-medium text-slate-800 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        aria-expanded={pauseReasonOpen}
                      >
                        <span className="min-w-0 truncate">
                          {SLA_PAUSE_REASONS.find((reason) => reason.value === slaModalForm.reasonCode)?.label || 'Chọn lý do tạm dừng'}
                        </span>
                        <Lucide.ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${pauseReasonOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>

                      {pauseReasonOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          {SLA_PAUSE_REASONS.map((reason) => {
                            const selected = reason.value === slaModalForm.reasonCode;
                            return (
                              <button
                                key={reason.value}
                                type="button"
                                onClick={() => { setSlaModalForm((current) => ({ ...current, reasonCode: reason.value })); setPauseReasonOpen(false); }}
                                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${selected ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                              >
                                <span>{reason.label}</span>
                                {selected ? <Lucide.Check size={15} aria-hidden="true" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {slaModalConfig.noteLabel}
                      {slaModalConfig.noteRequired
                        ? <span className="text-rose-600"> *</span>
                        : <span className="font-normal text-slate-400"> (không bắt buộc)</span>}
                    </span>
                    <textarea
                      value={slaModalForm.note}
                      onChange={(event) => setSlaModalForm((current) => ({ ...current, note: event.target.value }))}
                      rows={4}
                      placeholder={slaModal === 'pause'
                        ? 'Ví dụ: đang chờ người dân bổ sung hình ảnh hiện trường.'
                        : 'Nội dung này được lưu vào lịch sử SLA.'}
                      className="mt-2 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>

                  {message.type === 'error' && message.text ? (
                    <p className="text-sm font-medium text-rose-600">{message.text}</p>
                  ) : null}
                </div>

                <footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                  <button type="button" onClick={closeSlaModal} disabled={Boolean(slaActionLoading)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
                    Hủy
                  </button>
                  <button type="submit" disabled={Boolean(slaActionLoading)} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition disabled:opacity-60 ${slaModalConfig.confirmClass}`}>
                    {slaActionLoading ? <Lucide.LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : null}
                    {slaModalConfig.confirmLabel}
                  </button>
                </footer>
              </form>
            </section>
          </div>,
          document.body,
        )
        : null}
    </section>
  );
};

export default IncidentSlaSection;
