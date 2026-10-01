// src/pages/tickets/TicketAssignment.jsx
import { useState, useEffect } from 'react';

const FALLBACK_CATEGORIES = [
  { categoryId: 1, categoryName: 'Vệ sinh môi trường' },
  { categoryId: 2, categoryName: 'Đường sá' },
  { categoryId: 3, categoryName: 'Cấp thoát nước' },
  { categoryId: 4, categoryName: 'Điện chiếu sáng' },
  { categoryId: 5, categoryName: 'Cây xanh' },
  { categoryId: 6, categoryName: 'An toàn giao thông' },
];
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { toolsApi, managementFeedbackApi } from '@urbanmind/shared-api';
import { ErrorAlert, SuccessAlert } from '../../components/alerts/ErrorAlert';
import { signalrService } from '../../services/socket/signalrService';
import * as Lucide from 'lucide-react';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getFeedbackId = (ticket, routeId) => ticket?.feedbackId || ticket?.id || ticket?.ticketId || routeId || '';

export const TicketAssignment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [operators, setOperators] = useState([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [manualOperatorId, setManualOperatorId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [providerCandidatesLoaded, setProviderCandidatesLoaded] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const role = user?.role || 'system-staff';
        const resTicket = await ticketApi.getTicketById(id, { role });
        const providerCandidates = await managementFeedbackApi.getProviderCandidates(id);
        const categoryResponse = await toolsApi.getCategories();
        const normalizedCategories = Array.isArray(categoryResponse) && categoryResponse.length > 0
          ? categoryResponse
          : FALLBACK_CATEGORIES;
        const slaConfig = toolsApi.getSlaConfig();
        const slaHours = slaConfig[resTicket.priority]?.hours || 24;
        const normalizedOperators = Array.isArray(providerCandidates)
          ? providerCandidates.map((candidate) => ({
              coordinatorId: candidate.coordinatorId ?? candidate.operatorId ?? candidate.id,
              operatorId: candidate.coordinatorId ?? candidate.operatorId ?? candidate.id,
              operatorName: candidate.providerName || candidate.coordinatorName || candidate.name || 'Unnamed provider',
              contactPhone: candidate.phoneNumber || candidate.contactPhone || candidate.phone || candidate.contactNumber || '',
              email: candidate.email || candidate.contactEmail || '',
              coverage: candidate.address || candidate.coverage || candidate.contractName || '',
              sla: candidate.sla || `${slaHours} giờ`,
              ...candidate,
            }))
          : [];

        setTicket(resTicket);
        setOperators(normalizedOperators);
        setCategories(normalizedCategories);
        setProviderCandidatesLoaded(true);
        if (normalizedOperators.length > 0) {
          setSelectedOperatorId(normalizedOperators[0].coordinatorId ?? normalizedOperators[0].operatorId);
        }
      } catch (err) {
        console.error(err);
        navigate('/staff/queue');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role) {
      loadDetails();
    }
  }, [id, navigate, user?.role]);

  const handleAssign = async (e) => {
    e.preventDefault();
    setError('');
    const resolvedOperatorId = String(selectedOperatorId || manualOperatorId || '').trim();
    if (!resolvedOperatorId) {
      setError('Vui lòng chọn hoặc nhập mã đơn vị xử lý.');
      return;
    }

    const coordinatorId = Number(resolvedOperatorId);
    if (!Number.isInteger(coordinatorId) || coordinatorId <= 0) {
      setError('Đơn vị xử lý không hợp lệ.');
      return;
    }

    const selectedOperator = operators.find((op) => Number(op.coordinatorId ?? op.operatorId) === coordinatorId);
    const hasManualOperator = Boolean(manualOperatorId?.trim());
    if (!selectedOperator && operators.length > 0 && !hasManualOperator) {
      setError('Đơn vị xử lý đã chọn không tồn tại. Vui lòng kiểm tra lại mã hoặc tải lại trang.');
      return;
    }

    const feedbackId = getFeedbackId(ticket, id);
    if (!feedbackId) {
      setError('Không thể phân công vì thiếu mã phản ánh.');
      return;
    }

    if (!UUID_PATTERN.test(feedbackId)) {
      setError('Không thể phân công vì mã phản ánh không hợp lệ. Vui lòng tải lại và thử lại.');
      return;
    }

    if (!user?.userId) {
      setError('Thông tin người dùng không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setAssignLoading(true);
    try {
      const assignmentPayload = {
        feedbackId,
        coordinatorId,
        staffUserId: user.userId,
        note,
      };
      await managementFeedbackApi.assignToOperator(assignmentPayload);
      signalrService.notifyAssignmentUpdated(feedbackId, coordinatorId, selectedOperator?.operatorName || selectedOperator?.fullName || '', user);
      setMessage({ type: 'success', text: 'Phân công thành công. Trạng thái đã được cập nhật cho người xử lý.' });
      navigate(`/staff/feedbacks/${feedbackId}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể phân công phản ánh. Vui lòng thử lại.');
    } finally {
      setAssignLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-panel flex min-h-[320px] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Calculate projected deadline based on priority
  const slaConfig = toolsApi.getSlaConfig();
  const slaHours = slaConfig[ticket.priority]?.hours || 24;
  const projectedDeadline = new Date();
  projectedDeadline.setHours(projectedDeadline.getHours() + slaHours);
  const selectedOperator = operators.find((op) => String(op.coordinatorId ?? op.operatorId) === String(selectedOperatorId)) || null;
  const categoryName = categories.find((c) => Number(c.categoryId) === Number(ticket.categoryId))?.categoryName || 'Không rõ';

  return (
    <div className="admin-page-shell staff-assignment-page space-y-5">
      {message.type === 'success' && (
        <SuccessAlert
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}
      {message.type === 'error' && (
        <ErrorAlert
          message={message.text}
          onClose={() => setMessage({ type: '', text: '' })}
        />
      )}

      <section className="admin-page-hero">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="admin-hero-icon" aria-hidden="true">
              <Lucide.UserRoundCheck size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="admin-hero-title">Phân công xử lý</h1>
              <p className="admin-hero-description">Chọn đơn vị xử lý phù hợp và xác nhận thông tin giao việc cho phản ánh.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/staff/queue')}
            className="staff-assignment-back inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition"
          >
            <Lucide.ArrowLeft size={16} aria-hidden="true" />
            Quay lại
          </button>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24">
          <section className="admin-panel staff-assignment-summary overflow-hidden p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tóm tắt phản ánh</p>
                <h2 className="mt-2 text-base font-bold leading-6 text-slate-950">{ticket.title || 'Không có tiêu đề'}</h2>
              </div>
              <span className="admin-mini-icon staff-assignment-icon-primary h-10 w-10 shrink-0" aria-hidden="true">
                <Lucide.FileText size={18} />
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="admin-inset-panel staff-assignment-summary-tile p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Vị trí</p>
                <p className="mt-2 font-semibold leading-6 text-slate-800">{ticket.locationText || 'Chưa có vị trí'}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="admin-inset-panel staff-assignment-summary-tile p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Danh mục</p>
                  <p className="mt-2 font-semibold text-slate-800">{categoryName}</p>
                </div>
                <div className="admin-inset-panel staff-assignment-summary-tile p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mức độ ưu tiên</p>
                  <p className="mt-2 font-semibold text-slate-800">{ticket.priority || 'Medium'}</p>
                </div>
              </div>
            </div>
          </section>
        </aside>

        <div className="space-y-4">
          <form onSubmit={handleAssign} className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                {error}
              </div>
            )}

            <section className="admin-panel staff-assignment-section staff-assignment-section-primary p-5 sm:p-6">
              <header className="staff-assignment-section-head flex items-start gap-3 pb-4">
                <span className="admin-mini-icon staff-assignment-icon-primary" aria-hidden="true"><Lucide.Gauge size={17} /></span>
                <div>
                  <h2 className="admin-section-title">Thiết lập phương án xử lý</h2>
                  <p className="admin-section-description mt-1">Kiểm tra SLA và thông tin phân loại trước khi giao việc.</p>
                </div>
              </header>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="admin-inset-panel staff-assignment-metric min-h-[92px] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">SLA</p><p className="mt-2 text-lg font-bold text-slate-950">{slaHours} giờ</p></div>
                <div className="admin-inset-panel staff-assignment-metric min-h-[92px] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mức độ ưu tiên</p><p className="mt-2 text-lg font-bold text-slate-950">{ticket.priority || 'Medium'}</p></div>
                <div className="admin-inset-panel staff-assignment-metric min-h-[92px] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Danh mục</p><p className="mt-2 text-lg font-bold text-slate-950">{categoryName}</p></div>
                <div className="admin-inset-panel staff-assignment-metric min-h-[92px] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Hạn dự kiến</p><p className="mt-2 text-lg font-bold text-slate-950">{projectedDeadline.toLocaleDateString('vi-VN')}</p></div>
              </div>
            </section>

            <section className="admin-panel staff-assignment-section p-5 sm:p-6">
              <header className="staff-assignment-section-head flex items-start gap-3 pb-4">
                <span className="admin-mini-icon staff-assignment-icon-neutral" aria-hidden="true"><Lucide.Building2 size={17} /></span>
                <div>
                  <h2 className="admin-section-title">Đơn vị xử lý</h2>
                  <p className="admin-section-description mt-1">Chọn đơn vị phù hợp hoặc nhập mã đơn vị khi cần.</p>
                </div>
              </header>

              <div className={`staff-assignment-provider relative mt-4 overflow-hidden rounded-2xl border p-5 ${selectedOperator ? 'is-selected' : 'is-empty'}`}>
                {selectedOperator ? <span className="staff-assignment-provider-accent absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Đơn vị đang chọn</p>
                    <p className="mt-2 text-base font-bold text-slate-950">{selectedOperator ? selectedOperator.operatorName : 'Chưa chọn đơn vị xử lý'}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${selectedOperator ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{selectedOperator ? 'Đã chọn' : 'Chưa chọn'}</span>
                </div>

                {selectedOperator ? (
                  <div className="staff-assignment-provider-meta mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Số điện thoại</p><p className="mt-1.5 text-sm font-semibold text-slate-800">{selectedOperator.contactPhone || '-'}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Email</p><p className="mt-1.5 text-sm font-semibold text-slate-800">{selectedOperator.email || '-'}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Phạm vi phụ trách</p><p className="mt-1.5 text-sm font-semibold text-slate-800">{selectedOperator.coverage || '-'}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">SLA</p><p className="mt-1.5 text-sm font-semibold text-slate-800">{selectedOperator.sla || `${slaHours} giờ`}</p></div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Chọn đơn vị xử lý</label>
                  {providerCandidatesLoaded ? (
                    operators.length > 0 ? (
                      <select value={selectedOperatorId} onChange={(e) => { setSelectedOperatorId(e.target.value); if (e.target.value) setManualOperatorId(''); }} className="select select-bordered staff-assignment-control w-full rounded-xl text-sm font-semibold">
                        <option value="">-- Chọn đơn vị xử lý --</option>
                        {operators.map((op) => (<option key={op.operatorId} value={op.operatorId}>{op.operatorName}</option>))}
                      </select>
                    ) : (<p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">Không có đơn vị xử lý khả dụng.</p>)
                  ) : (<p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Đang tải danh sách đơn vị xử lý...</p>)}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Hoặc nhập mã đơn vị xử lý</label>
                  <input type="text" value={manualOperatorId} onChange={(e) => { setManualOperatorId(e.target.value); if (e.target.value) setSelectedOperatorId(''); }} placeholder="VD: 123" className="input input-bordered staff-assignment-control w-full rounded-xl text-sm font-semibold" />
                </div>
              </div>
            </section>

            <section className="admin-panel staff-assignment-section p-5 sm:p-6">
              <header className="staff-assignment-section-head flex items-start gap-3 pb-4">
                <span className="admin-mini-icon staff-assignment-icon-neutral" aria-hidden="true"><Lucide.NotebookPen size={17} /></span>
                <div>
                  <h2 className="admin-section-title">Ghi chú giao việc</h2>
                  <p className="admin-section-description mt-1">Bổ sung yêu cầu xử lý hoặc lưu ý cần chuyển cho đơn vị tiếp nhận.</p>
                </div>
              </header>
              <textarea rows="4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mô tả yêu cầu xử lý, lưu ý kỹ thuật, thông tin hiện trường..." className="textarea textarea-bordered staff-assignment-control staff-assignment-note mt-4 min-h-24 w-full rounded-xl text-sm leading-6" />
              <div className="mt-4 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => navigate(-1)} className="staff-assignment-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition">Hủy</button>
                <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={assignLoading || (!selectedOperatorId && !manualOperatorId)}>{assignLoading ? <span className="loading loading-spinner"></span> : 'Xác nhận phân công'}</button>
              </div>
            </section>
          </form>

          <section className="admin-panel staff-assignment-section staff-assignment-detail p-4 sm:p-5">
            <header className="staff-assignment-section-head flex items-start gap-3 pb-4">
              <span className="admin-mini-icon staff-assignment-icon-neutral" aria-hidden="true"><Lucide.FileSearch size={17} /></span>
              <div><h2 className="admin-section-title">Chi tiết phản ánh</h2><p className="admin-section-description mt-1">Thông tin tham chiếu trước khi xác nhận phân công.</p></div>
            </header>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.15fr]">
              <dl className="space-y-4 text-sm">
                <div><dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tiêu đề</dt><dd className="mt-1.5 font-semibold text-slate-800">{ticket.title || 'Không có tiêu đề'}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mã phản ánh</dt><dd className="mt-1.5 break-all font-semibold text-slate-800">{ticket.feedbackId || ticket.id || 'Không rõ'}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Người báo cáo</dt><dd className="mt-1.5 font-semibold text-slate-800">{ticket.reporterName || 'Không rõ'}</dd></div>
              </dl>
              <dl className="space-y-4 text-sm">
                <div><dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Khu vực</dt><dd className="mt-1.5 font-semibold text-slate-800">{ticket.areaName || 'Không có khu vực'}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Danh mục</dt><dd className="mt-1.5 font-semibold text-slate-800">{categoryName}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Thời gian tạo</dt><dd className="mt-1.5 font-semibold text-slate-800">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('vi-VN') : 'Không rõ'}</dd></div>
              </dl>
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Nội dung phản ánh</p><p className="admin-inset-panel mt-2 min-h-[72px] p-3.5 text-sm leading-6 text-slate-700">{ticket.description || 'Không có nội dung phản ánh.'}</p></div>
            </div>
          </section>
        </div>
      </div>

    </div>
  );
};
