import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { getStatusLabel, managementTypes } from '@urbanmind/shared-types';
import PageTransition from '../../components/motion/PageTransition';
import { ErrorAlert, SuccessAlert } from '../../components/alerts/ErrorAlert';

const normalizeImageList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
};

const getAttachmentUrl = (file) => {
  if (!file) return '';
  if (typeof file === 'string') return file;
  return file.fileUrl || file.url || file.path || file.attachmentUrl || '';
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const ReworkCenterPage = () => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', locationText: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    const loadTicket = async () => {
      try {
        setLoading(true);
        setError('');
        const detail = await ticketApi.getTicketById(feedbackId, { role: 'service-user' });
        const resolvedTicket = detail?.data || detail?.item || detail?.result || detail || null;
        setTicket(resolvedTicket);
        setEditForm({
          title: resolvedTicket?.title || '',
          description: resolvedTicket?.description || '',
          locationText: resolvedTicket?.locationText || '',
        });
      } catch (err) {
        console.error('Failed to load rework center data', err);
        setError(err?.message || 'Không thể tải thông tin cần chỉnh sửa.');
      } finally {
        setLoading(false);
      }
    };

    if (feedbackId) {
      loadTicket();
    }
  }, [feedbackId]);

  const attachments = useMemo(() => {
    const list = normalizeImageList(ticket?.attachments || []).map(getAttachmentUrl).filter(Boolean);
    return list;
  }, [ticket]);

  const issues = useMemo(() => {
    const list = [];
    if (!ticket?.description?.trim()) {
      list.push({
        id: 'description',
        title: 'Thiếu mô tả',
        detail: 'Hãy mô tả rõ sự cố để đơn vị xử lý hiểu đúng vấn đề.',
      });
    }
    if (!ticket?.locationText?.trim()) {
      list.push({
        id: 'location',
        title: 'Thiếu vị trí',
        detail: 'Cung cấp địa điểm chính xác để đội xử lý đến đúng nơi.',
      });
    }
    if (attachments.length === 0) {
      list.push({
        id: 'images',
        title: 'Thiếu hình ảnh hoặc bằng chứng',
        detail: 'Đính kèm ảnh/video hỗ trợ giúp quá trình xử lý nhanh và chính xác hơn.',
      });
    }
    if (!ticket?.title?.trim()) {
      list.push({
        id: 'title',
        title: 'Thiếu tiêu đề',
        detail: 'Một tiêu đề ngắn và rõ sẽ giúp phản ánh được xử lý nhanh hơn.',
      });
    }
    return list;
  }, [attachments.length, ticket]);

  const reworkReason = ticket?.rework?.reason || ticket?.resolution?.reviewNote || ticket?.note || ticket?.statusNote || 'Đội xử lý đã yêu cầu bổ sung thông tin hoặc minh chứng để tiếp tục xử lý.';
  const requestedBy = ticket?.rework?.requestedBy || ticket?.resolution?.reviewedByName || ticket?.assignment?.assignedByName || 'Hệ thống';
  const requestedDate = ticket?.rework?.requestedAt || ticket?.updatedAt || ticket?.createdAt;

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!feedbackId || !user?.userId) return;

    setSaving(true);
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        locationText: editForm.locationText,
      };
      const updated = await ticketApi.updateTicket(feedbackId, payload, { role: 'service-user' });
      const nextTicket = updated?.data || updated?.item || updated?.result || updated || { ...ticket, ...payload };
      setTicket((prev) => ({ ...(prev || {}), ...nextTicket }));
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Đã cập nhật thông tin phản ánh của bạn.' });
    } catch (err) {
      console.error('Failed to update rework ticket', err);
      setMessage({ type: 'error', text: err?.message || 'Không thể cập nhật phản ánh lúc này.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadEvidence = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      await ticketApi.addAttachments(feedbackId, files, { role: 'service-user' });
      const refreshed = await ticketApi.getTicketById(feedbackId, { role: 'service-user' });
      const nextTicket = refreshed?.data || refreshed?.item || refreshed?.result || refreshed || ticket;
      setTicket(nextTicket);
      setSelectedFiles([]);
      setMessage({ type: 'success', text: 'Đã tải thêm bằng chứng thành công.' });
    } catch (err) {
      console.error('Failed to upload rework evidence', err);
      setMessage({ type: 'error', text: err?.message || 'Không thể tải bằng chứng lúc này.' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleResubmit = async () => {
    if (!feedbackId) return;

    setResubmitting(true);
    try {
      await ticketApi.updateTicket(feedbackId, { status: managementTypes.feedbackStatus.SUBMITTED }, { role: 'service-user' });
      setTicket((prev) => ({ ...(prev || {}), status: managementTypes.feedbackStatus.SUBMITTED }));
      setMessage({ type: 'success', text: 'Phản ánh đã được gửi lại cho đơn vị xử lý.' });
    } catch (err) {
      console.error('Failed to resubmit rework ticket', err);
      setMessage({ type: 'error', text: err?.message || 'Không thể gửi lại phản ánh lúc này.' });
    } finally {
      setResubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="page-container py-4">
          <div className="animate-pulse rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-40 rounded-full bg-slate-100" />
            <div className="mt-4 h-8 w-2/3 rounded-2xl bg-slate-100" />
            <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-100" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!ticket) {
    return (
      <PageTransition>
        <div className="page-container py-6">
          <ErrorAlert title="Không thể mở Rework Center" message={error || 'Chúng tôi không tìm thấy phản ánh này.'} />
          <button onClick={() => navigate('/tickets')} className="btn btn-primary mt-4 rounded-2xl">Quay lại danh sách</button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="page-container space-y-6 py-4 text-slate-800">
        {message.type === 'success' && <SuccessAlert message={message.text} onClose={() => setMessage({ type: '', text: '' })} />}
        {message.type === 'error' && <ErrorAlert message={message.text} onClose={() => setMessage({ type: '', text: '' })} />}

        <header className="overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500 p-6 text-white shadow-[0_24px_70px_-24px_rgba(249,115,22,0.5)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] backdrop-blur">
                <Lucide.RefreshCw size={16} />
                Rework Center
              </div>
              <div className="space-y-3">
                <h1 className="text-2xl font-black leading-tight sm:text-3xl">Chúng tôi cần thêm một chút thông tin để tiếp tục xử lý</h1>
                <p className="max-w-2xl text-sm text-amber-50/95 sm:text-base">
                  Đây là trung tâm giúp bạn hiểu rõ lý do phản ánh bị trả lại, những gì còn thiếu và cách gửi lại nhanh nhất.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/20 bg-white/15 p-4 text-sm backdrop-blur-sm sm:min-w-[260px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-amber-50">Trạng thái</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]">
                  {getStatusLabel(ticket.status, ticket.status || 'Đang cập nhật')}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-semibold text-amber-50">Yêu cầu bởi</span>
                <span className="font-semibold text-white">{requestedBy}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Lucide.AlertTriangle size={16} className="text-amber-600" />
                Lý do cần làm lại
              </div>
              <div className="mt-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                {reworkReason}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Requested by</div>
                  <div className="mt-2 font-semibold text-slate-700">{requestedBy}</div>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Requested date</div>
                  <div className="mt-2 font-semibold text-slate-700">{formatDate(requestedDate)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Lucide.ListChecks size={16} className="text-slate-700" />
                  Những mục còn thiếu
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {issues.length} mục
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {issues.length > 0 ? issues.map((issue) => (
                  <div key={issue.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
                        <Lucide.CircleAlert size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{issue.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{issue.detail}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Không còn mục nào cần bổ sung.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Lucide.UploadCloud size={16} className="text-emerald-600" />
                Tải thêm bằng chứng
              </div>
              <p className="mt-2 text-sm text-slate-600">Đính kèm ảnh/video mới để làm rõ vấn đề và giúp xử lý nhanh hơn.</p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-emerald-200 bg-emerald-50/70 p-5 text-center text-sm text-emerald-700 transition hover:bg-emerald-50">
                <Lucide.CloudUpload size={18} />
                <span className="mt-2 font-semibold">Chọn tệp ảnh hoặc video</span>
                <span className="mt-1 text-xs text-emerald-600">Hỗ trợ nhiều tệp cùng lúc</span>
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleUploadEvidence} />
              </label>
              {selectedFiles.length > 0 && (
                <div className="mt-3 text-xs text-slate-500">Đã chọn {selectedFiles.length} tệp</div>
              )}
              {attachments.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {attachments.slice(0, 3).map((url, index) => (
                    <img key={`${url}-${index}`} src={url} alt={`Evidence ${index + 1}`} className="h-32 w-full rounded-[1rem] object-cover" />
                  ))}
                </div>
              )}
              <button type="button" onClick={() => document.querySelector('input[type="file"]').click()} disabled={uploading} className="btn btn-sm mt-4 rounded-2xl border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700">
                {uploading ? <span className="loading loading-spinner loading-xs" /> : <Lucide.UploadCloud size={14} />} 
                {uploading ? 'Đang tải...' : 'Tải lên ngay'}
              </button>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Lucide.PencilLine size={16} className="text-slate-700" />
                Chỉnh sửa phản ánh
              </div>
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Tiêu đề phản ánh"
                    className="input input-bordered w-full rounded-[1rem]"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Mô tả chi tiết hơn về sự cố"
                    rows="4"
                    className="textarea textarea-bordered w-full rounded-[1rem]"
                  />
                  <input
                    value={editForm.locationText}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, locationText: event.target.value }))}
                    placeholder="Địa điểm cụ thể"
                    className="input input-bordered w-full rounded-[1rem]"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="btn btn-sm rounded-2xl bg-slate-900 text-white">
                      {saving ? <span className="loading loading-spinner loading-xs" /> : <Lucide.Save size={14} />} 
                      Lưu thay đổi
                    </button>
                    <button type="button" onClick={() => setIsEditing(false)} className="btn btn-sm rounded-2xl btn-ghost">
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="font-semibold text-slate-800">Tiêu đề hiện tại</div>
                    <div className="mt-1">{ticket.title || 'Chưa có tiêu đề'}</div>
                  </div>
                  <button type="button" onClick={() => setIsEditing(true)} className="btn btn-sm rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                    <Lucide.PencilLine size={14} />
                    Sửa phản ánh
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Lucide.Send size={16} className="text-sky-600" />
                Gửi lại phản ánh
              </div>
              <p className="mt-2 text-sm text-slate-600">Sau khi cập nhật đủ thông tin, hãy gửi lại để hệ thống tiếp tục xử lý.</p>
              <button type="button" onClick={handleResubmit} disabled={resubmitting} className="btn btn-sm mt-4 rounded-2xl bg-sky-600 text-white hover:bg-sky-700">
                {resubmitting ? <span className="loading loading-spinner loading-xs" /> : <Lucide.Send size={14} />} 
                Gửi lại ngay
              </button>
            </section>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
