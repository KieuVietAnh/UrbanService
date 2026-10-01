import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import DelightToast from '../../components/delight/DelightToast';
import PageTransition from '../../components/motion/PageTransition';
import { EmptyState } from '@urbanmind/shared-ui';
import { getCategoryLabel } from '../../utils/categoryLabels';
import Button from '../../components/design-system/Button';

const TEMPLATE_OPTIONS = [
  {
    title: 'Thiếu ảnh minh chứng',
    body: 'Cảm ơn bạn. Để chúng tôi tiếp tục xử lý phản ánh này, vui lòng gửi thêm hình ảnh hoặc video minh chứng tại hiện trường để xác nhận tình trạng.',
  },
  {
    title: 'Thiếu thông tin vị trí',
    body: 'Phản ánh hiện chưa đủ thông tin về vị trí chính xác. Vui lòng cung cấp thêm địa chỉ chi tiết hoặc điểm tham chiếu gần nhất.',
  },
  {
    title: 'Cần xác nhận tình trạng',
    body: 'Chúng tôi cần xác nhận tình trạng hiện tại sau khi xử lý ban đầu. Vui lòng cho biết trạng thái hiện tại và thời điểm bạn quan sát thấy.',
  },
];

const CHECKLIST_ITEMS = [
  'Ảnh/video minh chứng',
  'Thông tin vị trí chính xác',
  'Mô tả hiện trạng mới',
  'Thông tin liên hệ bổ sung',
  'Xác nhận thời điểm xảy ra',
];

const formatHistoryTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const isStaffMessage = (entry) => {
  const role = String(entry?.userRole || '').toLowerCase();
  const senderType = String(entry?.senderType || '').toLowerCase();
  return role.includes('staff')
    || role.includes('manager')
    || role.includes('admin')
    || role.includes('system')
    || senderType.includes('staff')
    || senderType.includes('system');
};

export const RequestInfoWorkspacePage = () => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();

  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [draftSaved, setDraftSaved] = useState(false);

  const [selectedChecklist, setSelectedChecklist] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [requestType, setRequestType] = useState('additional-info');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        setHistoryLoading(true);
        setError('');
        setHistoryError('');

        const [feedbackResult, messageResult] = await Promise.all([
          managementFeedbackApi.getFeedbackById(feedbackId),
          managementFeedbackApi.getFeedbackMessages(feedbackId, { includeInternal: false }),
        ]);

        setFeedback(feedbackResult);
        setRequestHistory(Array.isArray(messageResult) ? messageResult : []);
      } catch (err) {
        console.error('Failed to load request-info workspace', err);
        setError(err?.message || 'Không thể tải thông tin phản ánh.');
        setHistoryError(err?.message || 'Không thể tải lịch sử yêu cầu.');
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    };

    if (feedbackId) {
      loadWorkspace();
    }
  }, [feedbackId]);

  const selectedTemplate = useMemo(() => {
    const base = TEMPLATE_OPTIONS.find((option) => option.title === requestType) || TEMPLATE_OPTIONS[0];
    return base;
  }, [requestType]);

  const toggleChecklist = (item) => {
    setSelectedChecklist((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  };

  const handleApplyTemplate = (template) => {
    setRequestType(template.title);
    setMessageText(template.body);
    setDraftSaved(false);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setDraftSaved(true);
      setMessage({ type: 'success', text: 'Bản nháp đã được lưu trong phiên làm việc này.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Không thể lưu bản nháp.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendRequest = async () => {
    if (!messageText.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập nội dung yêu cầu.' });
      return;
    }

    setSending(true);
    try {
      await managementFeedbackApi.createFeedbackMessage(feedbackId, {
        messageText: messageText.trim(),
        isInternal: false,
      });

      const refreshedMessages = await managementFeedbackApi.getFeedbackMessages(feedbackId, {
        includeInternal: false,
      });
      setRequestHistory(Array.isArray(refreshedMessages) ? refreshedMessages : []);
      setMessageText('');
      setSelectedChecklist([]);
      setDraftSaved(false);
      setMessage({ type: 'success', text: 'Đã gửi yêu cầu thông tin cho người dân.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message || 'Không thể gửi yêu cầu này.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="admin-page-shell page-container space-y-4 py-4">
          <div className="admin-panel animate-pulse p-6">
            <div className="h-8 w-2/3 rounded-2xl bg-slate-100" />
            <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-100" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="admin-page-shell page-container space-y-5 py-4 text-slate-800">
        <div className="admin-page-hero p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-sm">
                <Lucide.MessageSquarePlus size={26} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <h1 className="admin-hero-title">Yêu cầu bổ sung thông tin</h1>
                <p className="admin-hero-description mt-2 max-w-3xl">
                  Soạn yêu cầu rõ ràng để người dân bổ sung đúng thông tin còn thiếu và giúp hồ sơ tiếp tục được xử lý nhanh hơn.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => navigate(`/staff/feedbacks/${feedbackId}`)}
              variant="outline"
              size="sm"
              className="shrink-0 rounded-xl border-slate-200 bg-white/90 px-4 shadow-sm hover:border-blue-200 hover:bg-blue-50"
            >
              <Lucide.ArrowLeft size={16} className="mr-2" />
              Quay lại chi tiết
            </Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <section className="admin-panel overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Lucide.FileText size={17} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Tóm tắt phản ánh</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Thông tin chính của hồ sơ đang cần bổ sung.</p>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tiêu đề</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{feedback?.title || '—'}</p>
                  <div className="my-4 h-px bg-slate-200/80" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Nội dung</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{feedback?.description || 'Không có mô tả.'}</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <Lucide.Tags size={14} />
                      Danh mục
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {getCategoryLabel(
                        feedback?.categoryName || feedback?.category?.name || feedback?.categoryType || feedback?.type,
                        '—'
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <Lucide.Building2 size={14} />
                      Đơn vị xử lý
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {feedback?.assignment?.operatorName || 'Chưa phân công'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin-panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Lucide.ListChecks size={17} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Thông tin còn thiếu</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Đánh dấu những nội dung cần người dân bổ sung.</p>
                  </div>
                </div>
                {selectedChecklist.length > 0 && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {selectedChecklist.length} mục
                  </span>
                )}
              </div>

              <div className="space-y-2 p-5 sm:p-6">
                {CHECKLIST_ITEMS.map((item) => {
                  const checked = selectedChecklist.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleChecklist(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                        checked
                          ? 'border-blue-200 bg-blue-50/80 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">{item}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        <Lucide.Check size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="admin-panel overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Lucide.LayoutTemplate size={17} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Mẫu yêu cầu</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Chọn mẫu phù hợp để điền nhanh nội dung.</p>
                </div>
              </div>

              <div className="space-y-3 p-5 sm:p-6">
                {TEMPLATE_OPTIONS.map((template) => {
                  const active = requestType === template.title;
                  return (
                    <button
                      key={template.title}
                      type="button"
                      onClick={() => handleApplyTemplate(template)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-blue-200 bg-blue-50/80 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{template.title}</div>
                          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500">{template.body}</p>
                        </div>
                        <Lucide.ChevronRight size={17} className={active ? 'text-blue-600' : 'text-slate-300'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="admin-panel overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Lucide.PenLine size={17} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Soạn yêu cầu cho người dân</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Kiểm tra nội dung trước khi gửi.</p>
                </div>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">Mẫu đang chọn</span>
                    <p className="mt-1 truncate font-semibold text-blue-900">{selectedTemplate.title}</p>
                  </div>
                  <Lucide.Sparkles size={18} className="shrink-0 text-blue-500" />
                </div>

                <textarea
                  rows="10"
                  value={messageText}
                  onChange={(event) => {
                    setMessageText(event.target.value);
                    setDraftSaved(false);
                  }}
                  placeholder="Nhập nội dung yêu cầu bổ sung thông tin cho người dân..."
                  className="textarea textarea-bordered w-full resize-y rounded-2xl border-slate-200 bg-white p-4 text-sm leading-6 focus:border-blue-300 focus:outline-none"
                />

                {selectedChecklist.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Đang yêu cầu bổ sung</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedChecklist.map((item) => (
                        <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSaveDraft} disabled={saving} variant="outline" className="rounded-xl">
                      {saving ? (
                        <span className="loading loading-spinner" />
                      ) : (
                        <>
                          <Lucide.Save size={16} className="mr-2" />
                          Lưu bản nháp
                        </>
                      )}
                    </Button>
                    <Button type="button" onClick={() => navigate(`/staff/feedbacks/${feedbackId}`)} variant="ghost" className="rounded-xl">
                      Hủy
                    </Button>
                  </div>

                  <Button type="button" onClick={handleSendRequest} disabled={sending} variant="primary" className="rounded-xl px-5">
                    {sending ? (
                      <span className="loading loading-spinner" />
                    ) : (
                      <>
                        <Lucide.Send size={16} className="mr-2" />
                        Gửi yêu cầu
                      </>
                    )}
                  </Button>
                </div>

                {draftSaved && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    <span className="inline-flex items-center gap-2">
                      <Lucide.CheckCircle2 size={16} />
                      Bản nháp đã được lưu trong phiên làm việc này.
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className="admin-panel overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Lucide.Clock3 size={17} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Lịch sử yêu cầu</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Các yêu cầu bổ sung đã gửi trước đây.</p>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                {historyLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-20 rounded-2xl bg-slate-100" />
                    <div className="h-20 rounded-2xl bg-slate-100" />
                  </div>
                ) : historyError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {historyError}
                  </div>
                ) : requestHistory.filter((entry) => !entry?.isInternal && isStaffMessage(entry)).length === 0 ? (
                  <EmptyState
                    title="Chưa có lịch sử yêu cầu"
                    description="Chưa có yêu cầu hoặc trao đổi công khai nào từ nhân viên cho phản ánh này."
                  />
                ) : (
                  <div className="space-y-3">
                    {requestHistory
                      .filter((entry) => !entry?.isInternal && isStaffMessage(entry))
                      .slice()
                      .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
                      .map((entry) => (
                        <article
                          key={entry?.interactionMessageId || entry?.id || `${entry?.createdAt}-${entry?.messageText}`}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <Lucide.Send size={15} />
                              </span>
                              {entry?.userFullName || 'Nhân viên'}
                            </div>
                            <time className="text-xs font-medium text-slate-400">
                              {formatHistoryTime(entry?.createdAt)}
                            </time>
                          </div>
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                            {entry?.messageText || '—'}
                          </p>
                        </article>
                      ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
      <DelightToast
        open={Boolean(message.type)}
        message={message.type === 'error' ? 'Không thể hoàn tất' : 'Thành công'}
        sub={message.text}
        variant={message.type === 'error' ? 'error' : 'success'}
        position="top-right"
        onClose={() => setMessage({ type: '', text: '' })}
      />
    </PageTransition>
  );
};
