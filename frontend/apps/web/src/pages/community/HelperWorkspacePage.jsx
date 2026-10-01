// src/pages/community/HelperWorkspacePage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { toolsApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { managementTypes } from '@urbanmind/shared-types';
import { signalrService } from '../../services/socket/signalrService';

const STATUS_META = {
  [managementTypes.feedbackStatus.ASSIGNED]: {
    label: 'Chờ tiếp nhận',
    badge: 'badge-warning',
    tone: 'text-warning',
    bg: 'bg-warning/10',
    icon: Lucide.Clock3,
  },
  [managementTypes.feedbackStatus.IN_PROGRESS]: {
    label: 'Đang xử lý',
    badge: 'badge-primary',
    tone: 'text-primary',
    bg: 'bg-primary/10',
    icon: Lucide.Wrench,
  },
  [managementTypes.feedbackStatus.RESOLVED]: {
    label: 'Chờ nghiệm thu',
    badge: 'badge-success',
    tone: 'text-success',
    bg: 'bg-success/10',
    icon: Lucide.CheckCircle2,
  },
};

const PRIORITY_META = {
  Urgent: { label: 'Rất khẩn cấp', className: 'badge-error' },
  Critical: { label: 'Rất khẩn cấp', className: 'badge-error' },
  High: { label: 'Cao', className: 'badge-error' },
  Medium: { label: 'Trung bình', className: 'badge-warning' },
  Low: { label: 'Thấp', className: 'badge-info' },
};

const STATUS_FLOW = [managementTypes.feedbackStatus.ASSIGNED, managementTypes.feedbackStatus.IN_PROGRESS, managementTypes.feedbackStatus.RESOLVED];

const getStatusMeta = status => {
  return STATUS_META[status] || {
    label: status || 'Chưa xác định',
    badge: 'badge-ghost',
    tone: 'text-base-content/60',
    bg: 'bg-base-200',
    icon: Lucide.CircleDashed,
  };
};

const getPriorityMeta = priority => {
  return PRIORITY_META[priority] || { label: priority || 'Không rõ', className: 'badge-ghost' };
};

const formatDateTime = value => {
  if (!value) return 'Chưa có thời gian';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const getTicketCategory = ticket => {
  return ticket?.categoryName || ticket?.category?.name || ticket?.category || 'Chưa phân loại';
};

export const HelperWorkspacePage = () => {
  const { user } = useAuth();
  const operatorId = user?.operatorId;
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resSummary, setResSummary] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const operatorName = useMemo(() => {
    return (
      toolsApi.getOperators().find(operator => operator.operatorId === operatorId)?.operatorName ||
      'Đơn vị xử lý'
    );
  }, [operatorId]);

  const fetchTasks = useCallback(async () => {
    if (!operatorId) return;

    try {
      const res = await ticketApi.getTickets({ operatorId }, { role: 'service-provider' });
      const active = Array.isArray(res) ? res.filter(ticket => ticket.status !== managementTypes.feedbackStatus.CLOSED) : [];

      setTickets(active);
      setSelectedTicket(currentTicket => {
        if (active.length === 0) return null;

        const existingTicket = active.find(ticket => ticket.feedbackId === currentTicket?.feedbackId);
        return existingTicket || active[0];
      });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'Không thể tải danh sách nhiệm vụ. Vui lòng thử lại.' });
    }
  }, [operatorId]);

  useEffect(() => {
    if (!operatorId) return;

    fetchTasks();
  }, [fetchTasks, operatorId]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const taskStats = useMemo(() => {
    return tickets.reduce(
      (acc, ticket) => {
        acc.total += 1;
        if (ticket.status === managementTypes.feedbackStatus.ASSIGNED) acc.waiting += 1;
        if (ticket.status === managementTypes.feedbackStatus.IN_PROGRESS) {
          acc.processing += 1;
        }
        if (ticket.status === managementTypes.feedbackStatus.RESOLVED) acc.resolved += 1;
        return acc;
      },
      { total: 0, waiting: 0, processing: 0, resolved: 0 }
    );
  }, [tickets]);

  const selectedStatusIndex = Math.max(STATUS_FLOW.indexOf(selectedTicket?.status), 0);
  const selectedStatusMeta = getStatusMeta(selectedTicket?.status);
  const SelectedStatusIcon = selectedStatusMeta.icon;
  const selectedPriorityMeta = getPriorityMeta(selectedTicket?.priority);

  const canAccept = selectedTicket?.status === managementTypes.feedbackStatus.ASSIGNED;
  const canMove = selectedTicket?.status === managementTypes.feedbackStatus.ASSIGNED;
  const canStart = selectedTicket?.status === managementTypes.feedbackStatus.IN_PROGRESS;
  const canComplete = selectedTicket?.status === managementTypes.feedbackStatus.IN_PROGRESS;

  const handleUpdateStatus = async status => {
    if (!selectedTicket || !user?.userId) return;

    setLoading(true);
    try {
      await ticketApi.updateOperatorStatus(selectedTicket.feedbackId, user.userId, status, '');
      try {
        signalrService.notifyStatusChanged(selectedTicket.feedbackId, selectedTicket.status, status, user);
      } catch (e) {
        console.warn('SignalR notify failed', e);
      }
      await fetchTasks();
      setNotice({ type: 'success', message: `Đã cập nhật trạng thái: ${getStatusMeta(status).label}` });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'Cập nhật trạng thái thất bại. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompletionSubmit = async e => {
    e.preventDefault();
    if (!selectedTicket || !resSummary.trim() || !user?.userId) return;

    setLoading(true);
    try {
      // Mock Base64 Resolution Image
      const resolutionPhoto = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80';

      await ticketApi.updateOperatorStatus(selectedTicket.feedbackId, user.userId, managementTypes.feedbackStatus.RESOLVED, resSummary, [resolutionPhoto]);
      try {
        signalrService.notifyStatusChanged(selectedTicket.feedbackId, selectedTicket.status, managementTypes.feedbackStatus.RESOLVED, user);
      } catch (e) {
        console.warn('SignalR notify failed', e);
      }
      setShowCompletionModal(false);
      setResSummary('');
      await fetchTasks();
      setNotice({ type: 'success', message: 'Đã gửi báo cáo hoàn thành. Vui lòng chờ cán bộ nghiệm thu.' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'Không thể gửi báo cáo hoàn thành. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-28 h-28 w-28 rounded-full bg-secondary/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
                <Lucide.ClipboardList size={14} />
                Điều phối thi công
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-base-content sm:text-3xl">
                  Nhiệm vụ được giao
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-base-content/60">
                  Theo dõi phản ánh đã được phân công, cập nhật tiến độ xử lý và gửi báo cáo hoàn thành cho đơn vị {operatorName}.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchTasks}
              disabled={loading}
              className="btn btn-primary rounded-2xl px-5 text-xs font-black shadow-lg shadow-primary/20"
            >
              {loading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.RefreshCw size={17} />}
              Làm mới
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-base-content/40">Tổng nhiệm vụ</p>
            <div className="rounded-2xl bg-primary/10 p-2 text-primary">
              <Lucide.Inbox size={18} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-base-content">{taskStats.total}</p>
          <p className="mt-1 text-xs font-semibold text-base-content/50">Đang mở trong hệ thống</p>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-base-content/40">Chờ tiếp nhận</p>
            <div className="rounded-2xl bg-warning/10 p-2 text-warning">
              <Lucide.Clock3 size={18} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-base-content">{taskStats.waiting}</p>
          <p className="mt-1 text-xs font-semibold text-base-content/50">Cần xác nhận xử lý</p>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-base-content/40">Đang xử lý</p>
            <div className="rounded-2xl bg-info/10 p-2 text-info">
              <Lucide.Wrench size={18} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-base-content">{taskStats.processing}</p>
          <p className="mt-1 text-xs font-semibold text-base-content/50">Đang thực hiện ngoài hiện trường</p>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-base-content/40">Chờ nghiệm thu</p>
            <div className="rounded-2xl bg-success/10 p-2 text-success">
              <Lucide.CheckCircle2 size={18} />
            </div>
          </div>
          <p className="mt-4 text-3xl font-black text-base-content">{taskStats.resolved}</p>
          <p className="mt-1 text-xs font-semibold text-base-content/50">Đã báo hoàn thành</p>
        </div>
      </section>

      {tickets.length === 0 ? (
        <section className="rounded-[2rem] border border-base-300 bg-base-100 p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-success/10 text-success">
            <Lucide.CheckCircle2 size={32} />
          </div>
          <h3 className="mt-5 text-base font-black text-base-content">Không có nhiệm vụ đang mở</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-base-content/60">
            Hệ thống hiện chưa ghi nhận phản ánh nào được phân công cho đơn vị của bạn. Khi có nhiệm vụ mới, danh sách sẽ hiển thị tại đây.
          </p>
          <button type="button" onClick={fetchTasks} className="btn btn-outline btn-sm mt-5 rounded-2xl">
            <Lucide.RefreshCw size={15} />
            Kiểm tra lại
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
          <div className="rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
            <div className="border-b border-base-300 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-base-content/40">Hộp thư công việc</p>
                  <h3 className="mt-1 text-lg font-black text-base-content">{tickets.length} nhiệm vụ</h3>
                </div>
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Lucide.ClipboardList size={20} />
                </div>
              </div>
            </div>

            <div className="max-h-[680px] space-y-3 overflow-y-auto p-4">
              {tickets.map(ticket => {
                const statusMeta = getStatusMeta(ticket.status);
                const priorityMeta = getPriorityMeta(ticket.priority);
                const StatusIcon = statusMeta.icon;
                const isSelected = selectedTicket?.feedbackId === ticket.feedbackId;

                return (
                  <button
                    key={ticket.feedbackId}
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full rounded-3xl border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-base-300 bg-base-100 hover:border-primary/30 hover:bg-base-200/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-base-content/35">
                          {ticket.feedbackId}
                        </p>
                        <h4 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-base-content">
                          {ticket.title || 'Phản ánh chưa có tiêu đề'}
                        </h4>
                      </div>
                      <span className={`badge badge-xs ${priorityMeta.className} shrink-0 font-black uppercase`}>
                        {priorityMeta.label}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-base-content/55">
                      <Lucide.MapPin size={14} className="shrink-0 text-base-content/35" />
                      <span className="truncate">{ticket.locationText || 'Chưa có địa chỉ'}</span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${statusMeta.bg} ${statusMeta.tone}`}>
                        <StatusIcon size={13} />
                        {statusMeta.label}
                      </span>
                      <span className="text-[11px] font-bold text-base-content/40">
                        {formatDateTime(ticket.updatedAt || ticket.createdAt || ticket.submittedAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedTicket && (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
                <div className="border-b border-base-300 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-base-200 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-base-content/45">
                          {selectedTicket.feedbackId}
                        </span>
                        <span className={`badge ${selectedStatusMeta.badge} badge-sm font-black uppercase`}>
                          {selectedStatusMeta.label}
                        </span>
                        <span className={`badge ${selectedPriorityMeta.className} badge-sm font-black uppercase`}>
                          {selectedPriorityMeta.label}
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black leading-tight text-base-content">
                        {selectedTicket.title || 'Phản ánh chưa có tiêu đề'}
                      </h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-base-content/60">
                        {selectedTicket.description || 'Chưa có mô tả chi tiết từ người gửi phản ánh.'}
                      </p>
                    </div>

                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${selectedStatusMeta.bg} ${selectedStatusMeta.tone}`}>
                      <SelectedStatusIcon size={26} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-6 md:grid-cols-3">
                  <div className="rounded-3xl border border-base-300 bg-base-200/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-base-content/40">
                      <Lucide.MapPin size={15} />
                      Địa điểm
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-base-content">
                      {selectedTicket.locationText || 'Chưa có địa chỉ'}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-base-300 bg-base-200/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-base-content/40">
                      <Lucide.FolderKanban size={15} />
                      Danh mục
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-base-content">
                      {getTicketCategory(selectedTicket)}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-base-300 bg-base-200/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-base-content/40">
                      <Lucide.CalendarClock size={15} />
                      Cập nhật gần nhất
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-base-content">
                      {formatDateTime(selectedTicket.updatedAt || selectedTicket.createdAt || selectedTicket.submittedAt)}
                    </p>
                  </div>
                </div>

                {selectedTicket.assignment?.note && (
                  <div className="px-6 pb-6">
                    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 text-primary">
                      <div className="flex items-start gap-3">
                        <Lucide.MessageSquareText size={18} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em]">Chỉ thị điều phối</p>
                          <p className="mt-1 text-sm font-bold leading-6">{selectedTicket.assignment.note}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTicket.attachments?.length > 0 && (
                  <div className="border-t border-base-300 p-6">
                    <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-base-content/40">
                      <Lucide.Image size={15} />
                      Ảnh hiện trường
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedTicket.attachments.map((imageUrl, index) => (
                        <img
                          key={`${imageUrl}-${index}`}
                          src={imageUrl}
                          alt={`Ảnh hiện trường ${index + 1}`}
                          className="aspect-video w-full rounded-3xl border border-base-300 object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-base-content/40">Tiến độ xử lý</p>
                    <h3 className="mt-1 text-lg font-black text-base-content">Cập nhật trạng thái hiện trường</h3>
                  </div>
                  <span className="rounded-full bg-base-200 px-3 py-1 text-xs font-bold text-base-content/50">
                    Thực hiện theo đúng thứ tự xử lý
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-5">
                  {STATUS_FLOW.map((status, index) => {
                    const meta = getStatusMeta(status);
                    const StepIcon = meta.icon;
                    const isDone = index <= selectedStatusIndex;

                    return (
                      <div
                        key={status}
                        className={`rounded-3xl border p-4 ${
                          isDone ? 'border-primary/20 bg-primary/5 text-primary' : 'border-base-300 bg-base-200/50 text-base-content/45'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <StepIcon size={18} />
                          <span className="text-xs font-black">0{index + 1}</span>
                        </div>
                        <p className="mt-3 text-sm font-black">{meta.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(managementTypes.feedbackStatus.IN_PROGRESS)}
                    disabled={!canAccept || loading}
                    className="btn btn-outline rounded-2xl"
                  >
                    <Lucide.Handshake size={17} />
                    Tiếp nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(managementTypes.feedbackStatus.IN_PROGRESS)}
                    disabled={!canMove || loading}
                    className="btn btn-outline rounded-2xl"
                  >
                    <Lucide.Truck size={17} />
                    Di chuyển
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(managementTypes.feedbackStatus.IN_PROGRESS)}
                    disabled={!canStart || loading}
                    className="btn btn-outline rounded-2xl"
                  >
                    <Lucide.Wrench size={17} />
                    Đang xử lý
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCompletionModal(true)}
                    disabled={!canComplete || loading}
                    className="btn btn-primary rounded-2xl"
                  >
                    <Lucide.CheckCircle2 size={17} />
                    Báo hoàn thành
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {showCompletionModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xl rounded-[2rem] border border-base-300 bg-base-100 p-0 shadow-2xl">
            <div className="border-b border-base-300 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
                  <Lucide.CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-base-content">Báo cáo hoàn thành công việc</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-base-content/60">
                    Nhập tóm tắt hành động đã xử lý để gửi cán bộ tiếp nhận nghiệm thu kết quả.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCompletionSubmit} className="space-y-5 p-6">
              <label className="form-control">
                <span className="label-text mb-2 text-xs font-black uppercase tracking-[0.16em] text-base-content/45">
                  Tóm tắt xử lý
                </span>
                <textarea
                  rows="5"
                  placeholder="Ví dụ: Đã thay thế bóng đèn LED mới, kiểm tra nguồn điện và cố định lại cáp an toàn..."
                  value={resSummary}
                  onChange={e => setResSummary(e.target.value)}
                  className="textarea textarea-bordered rounded-2xl text-sm font-medium leading-6"
                  required
                />
              </label>

              <div className="rounded-3xl border border-base-300 bg-base-200/70 p-4 text-sm font-medium leading-6 text-base-content/60">
                <div className="flex items-start gap-3">
                  <Lucide.Info size={18} className="mt-0.5 shrink-0 text-primary" />
                  <p>Hệ thống đang dùng ảnh nghiệm thu mẫu để mô phỏng bằng chứng hoàn thành. Khi API hoàn thiện có thể thay bằng upload ảnh thật.</p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCompletionModal(false)}
                  className="btn btn-ghost rounded-2xl"
                  disabled={loading}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rounded-2xl"
                  disabled={loading || !resSummary.trim()}
                >
                  {loading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.SendHorizontal size={17} />}
                  Gửi nghiệm thu
                </button>
              </div>
            </form>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => setShowCompletionModal(false)}
            aria-label="Đóng báo cáo hoàn thành"
          />
        </div>
      )}

      {notice && (
        <div className="toast toast-end toast-bottom z-50">
          <div className={`alert ${notice.type === 'error' ? 'alert-error' : 'alert-success'} rounded-2xl shadow-lg`}>
            {notice.type === 'error' ? <Lucide.AlertTriangle size={18} /> : <Lucide.CheckCircle2 size={18} />}
            <span className="text-sm font-bold">{notice.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
