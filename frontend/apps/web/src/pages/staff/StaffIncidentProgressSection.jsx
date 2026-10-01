import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { extractApiErrorMessage, incidentManagementApi } from '@urbanmind/shared-api';

import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import Input from '../../components/design-system/Input';
import Textarea from '../../components/design-system/Textarea';
import {
  EMPTY_VALUE,
  formatOperationalDateTime,
} from './incidentDetailPresentation';
import StaffIncidentActionDialog from './StaffIncidentActionDialog';
import {
  canManageIncidentExecution,
  canStartProviderAssignmentProcessing,
  getProviderStatusIntent,
  getProviderStatusLabel,
} from './staffIncidentProcessing';
import {
  STAFF_INCIDENT_FLOW_TARGETS,
  scrollToStaffIncidentFlowTarget,
} from './staffIncidentFlowNavigation';

const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const sameIdentifier = (left, right) => (
  Boolean(String(left ?? '').trim() && String(right ?? '').trim())
  && String(left).trim().toLowerCase() === String(right).trim().toLowerCase()
);

const positiveIdentifier = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const isRequestCancelled = (error) => (
  error?.name === 'AbortError'
  || error?.name === 'CanceledError'
  || error?.code === 'ERR_CANCELED'
);

const getActionErrorMessage = (error, fallback) => {
  if (!error?.response && !error?.status && !error?.code && String(error?.message ?? '').trim()) {
    return String(error.message).trim();
  }
  return extractApiErrorMessage(error, fallback);
};

const EMPTY_CONTACT_DRAFT = Object.freeze({
  contactMethod: '',
  contactResult: '',
  contactNote: '',
  contactedAt: '',
});

const readContactDraft = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return { ...EMPTY_CONTACT_DRAFT };
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_CONTACT_DRAFT };
    return Object.fromEntries(Object.keys(EMPTY_CONTACT_DRAFT).map((key) => [
      key,
      typeof value[key] === 'string' ? value[key] : '',
    ]));
  } catch {
    return { ...EMPTY_CONTACT_DRAFT };
  }
};

const CONTACT_METHOD_LABELS = Object.freeze({
  phone: 'Điện thoại',
  call: 'Điện thoại',
  email: 'Email',
  sms: 'Tin nhắn',
  message: 'Tin nhắn',
  chat: 'Tin nhắn',
  inperson: 'Gặp trực tiếp',
  meeting: 'Gặp trực tiếp',
  other: 'Khác',
});

const formatContactMethod = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return EMPTY_VALUE;
  return CONTACT_METHOD_LABELS[normalizeKey(normalized)] || normalized;
};

const getContactTimestamp = (log) => {
  const value = log?.contactedAt;
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getProviderProgress = (status) => {
  const normalized = normalizeKey(status);
  const indexByStatus = { reported: 0, inprogress: 1, done: 2 };
  const currentIndex = indexByStatus[normalized];
  if (currentIndex === undefined) return [];

  return [
    { id: 'reported', label: 'Đã gửi yêu cầu' },
    { id: 'in-progress', label: 'Đang xử lý' },
    { id: 'done', label: 'Đã hoàn thành' },
  ].map((step, index) => ({
    ...step,
    state: normalized === 'done' || index < currentIndex
      ? 'complete'
      : index === currentIndex
        ? 'current'
        : 'pending',
  }));
};

function ProgressSkeleton() {
  return (
    <div className="space-y-4 p-5 sm:p-6" aria-busy="true" aria-label="Đang tải tiến độ xử lý">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </div>
  );
}

function ProviderProgress({ assignment }) {
  const steps = getProviderProgress(assignment?.reportStatus);
  const interrupted = ['failed', 'cancelled'].includes(normalizeKey(assignment?.reportStatus));

  return (
    <div className="border-b border-slate-200 p-5 sm:p-6 dark:border-slate-800">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)] lg:items-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/65 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/25">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Trạng thái đơn vị xử lý</p>
              <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white">
                {assignment?.providerName || 'Đơn vị chưa có tên'}
              </p>
            </div>
            <Badge intent={getProviderStatusIntent(assignment?.reportStatus)} className="shrink-0">
              {getProviderStatusLabel(assignment?.reportStatus)}
            </Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hạn dự kiến</dt>
              <dd className="mt-1 break-words font-bold text-slate-900 dark:text-slate-100">{formatOperationalDateTime(assignment?.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cập nhật gần nhất</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-slate-100">{formatOperationalDateTime(assignment?.updatedAt)}</dd>
            </div>
          </dl>
          {assignment?.reportNote ? (
            <p className="mt-3 border-t border-emerald-200 pt-3 text-xs leading-5 text-slate-700 dark:border-emerald-900 dark:text-slate-200">
              <strong>Ghi chú tiến độ:</strong> {assignment.reportNote}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          {steps.length ? (
            <ol className="flex flex-col gap-3 sm:flex-row sm:gap-0" aria-label="Các mốc trạng thái của đơn vị xử lý">
              {steps.map((step, index) => {
                const stateClass = {
                  complete: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-300',
                  current: 'border-blue-600 bg-blue-600 text-white',
                  pending: 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500',
                }[step.state];
                const stateLabel = {
                  complete: 'Đã hoàn tất',
                  current: 'Bước hiện tại',
                  pending: 'Chưa đến bước',
                }[step.state];
                return (
                  <li key={step.id} className="relative flex min-w-0 flex-1 items-center gap-3 sm:flex-col sm:text-center">
                    {index < steps.length - 1 ? (
                      <span className={`absolute left-[1.1rem] top-9 h-[calc(100%+0.75rem)] w-px sm:left-[calc(50%+1.1rem)] sm:top-[1.1rem] sm:h-px sm:w-[calc(100%-2.2rem)] ${step.state === 'complete' ? 'bg-emerald-300 dark:bg-emerald-800' : 'bg-slate-200 dark:bg-slate-800'}`} aria-hidden="true" />
                    ) : null}
                    <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${stateClass}`} aria-hidden="true">
                      {step.state === 'complete' ? <Lucide.Check size={16} /> : index + 1}
                    </span>
                    <span className="min-w-0 pb-3 sm:px-1 sm:pb-0">
                      <strong className="block text-sm font-bold text-slate-800 dark:text-slate-100">{step.label}</strong>
                      <span className={`mt-0.5 block text-xs font-semibold ${step.state === 'current' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{stateLabel}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${interrupted ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100' : 'border-dashed border-slate-300 bg-slate-50/70 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200'}`} role="status">
              <Lucide.Activity className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">{interrupted ? 'Tiến trình hiện không tiếp tục' : 'Chưa xác định được tiến trình'}</p>
                <p className="mt-1 text-xs leading-5 opacity-75">Trạng thái hiện tại: {getProviderStatusLabel(assignment?.reportStatus)}.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactLogItem({ log, isLast }) {
  const timestamp = log?.contactedAt;
  return (
    <li className="relative grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      {!isLast ? <span className="absolute bottom-0 left-[1.08rem] top-9 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" /> : null}
      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 ring-4 ring-white dark:bg-blue-950/55 dark:text-blue-300 dark:ring-slate-950" aria-hidden="true">
        <Lucide.PhoneCall size={16} />
      </span>
      <article className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/55 p-4 dark:border-slate-800 dark:bg-slate-900/55">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h4 className="break-words text-sm font-black text-slate-950 dark:text-white">{formatContactMethod(log?.contactMethod)}</h4>
            <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{log?.contactResult || EMPTY_VALUE}</p>
          </div>
          <time dateTime={timestamp || undefined} className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {formatOperationalDateTime(timestamp)}
          </time>
        </div>
        <dl className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Người liên hệ</dt>
            <dd className="mt-1 break-words font-bold text-slate-800 dark:text-slate-100">{log?.contactedByUserName || EMPTY_VALUE}</dd>
          </div>
          {log?.contactNote ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Ghi chú</dt>
              <dd className="mt-1 whitespace-pre-line break-words leading-5 text-slate-700 dark:text-slate-200">{log.contactNote}</dd>
            </div>
          ) : null}
        </dl>
      </article>
    </li>
  );
}

export default function StaffIncidentProgressSection({
  assignment,
  incident,
  onAssignmentUpdated,
  onIncidentUpdated,
  user,
}) {
  const capability = incidentManagementApi.capabilities.providerContacts;
  const statusCapability = incidentManagementApi.capabilities.staffStartProcessing;
  const incidentId = String(incident?.incidentId ?? '').trim();
  const assignmentId = positiveIdentifier(assignment?.providerAssignmentId);
  const currentUserId = String(user?.userId ?? user?.id ?? '').trim().toLowerCase();
  const contactDraftKey = assignmentId && currentUserId
    ? `urbanmind:staff-contact-draft:${currentUserId}:${incidentId.toLowerCase()}:${assignmentId}`
    : '';
  const relationshipValid = Boolean(
    assignmentId
    && sameIdentifier(assignment?.incidentId, incidentId),
  );
  const canWrite = canManageIncidentExecution(incident, user);
  const canStartProcessing = statusCapability.available
    && canStartProviderAssignmentProcessing(incident, assignment, user);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(capability.available && relationshipValid);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState(() => readContactDraft(contactDraftKey));
  const mutationBusy = submitting || statusSubmitting;

  const sortedLogs = useMemo(
    () => [...logs].sort((left, right) => getContactTimestamp(right) - getContactTimestamp(left)),
    [logs],
  );

  const loadLogs = useCallback(async (signal) => {
    if (!capability.available || !relationshipValid || !assignmentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const result = await incidentManagementApi.getProviderAssignmentContactLogs(
        assignmentId,
        { signal },
      );
      if (signal?.aborted) return;
      if (result.some((log) => positiveIdentifier(log?.providerAssignmentId) !== assignmentId)) {
        throw new Error('Nhật ký liên hệ không thuộc đơn vị xử lý của sự vụ đang mở.');
      }
      setLogs(result);
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setLoadError(getActionErrorMessage(error, 'Không thể tải tiến độ xử lý.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [assignmentId, capability.available, relationshipValid]);

  useEffect(() => {
    const controller = new AbortController();
    loadLogs(controller.signal);
    return () => controller.abort();
  }, [loadLogs]);

  useEffect(() => {
    const savedDraft = readContactDraft(contactDraftKey);
    setForm(savedDraft);
    if (Object.values(savedDraft).some((value) => value.trim())) setFormOpen(true);
  }, [contactDraftKey]);

  useEffect(() => {
    if (!contactDraftKey || typeof window === 'undefined') return;
    try {
      if (Object.values(form).some((value) => value.trim())) {
        window.localStorage.setItem(contactDraftKey, JSON.stringify(form));
      } else {
        window.localStorage.removeItem(contactDraftKey);
      }
    } catch {
      // Draft persistence is optional; the form remains usable without storage.
    }
  }, [contactDraftKey, form]);

  useEffect(() => {
    if (!loading && !loadError && logs.length === 0 && canWrite
      && normalizeKey(assignment?.reportStatus) === 'inprogress') {
      setFormOpen(true);
    }
  }, [assignment?.reportStatus, canWrite, loadError, loading, logs.length]);

  const retry = () => loadLogs();

  const updateForm = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const startProcessing = async () => {
    if (statusSubmitting || !canStartProcessing || !assignmentId || !relationshipValid) return;

    setStatusSubmitting(true);
    setMessage({ type: '', text: '' });
    let statusUpdated = false;
    try {
      const [latestIncident, latestAssignment] = await Promise.all([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentProviderAssignment(incidentId),
      ]);
      if (!latestIncident || !latestAssignment
        || !sameIdentifier(latestAssignment?.incidentId, incidentId)
        || positiveIdentifier(latestAssignment?.providerAssignmentId) !== assignmentId
        || !canStartProviderAssignmentProcessing(latestIncident, latestAssignment, user)) {
        throw new Error('Sự vụ hoặc phân công đơn vị đã thay đổi. Vui lòng tải lại trang.');
      }

      const updatedAssignment = await incidentManagementApi.updateProviderAssignmentStatus(
        assignmentId,
        { status: 'InProgress', note: 'Staff bắt đầu xử lý sự vụ.' },
      );
      statusUpdated = true;
      if (!updatedAssignment
        || !sameIdentifier(updatedAssignment?.incidentId, incidentId)
        || positiveIdentifier(updatedAssignment?.providerAssignmentId) !== assignmentId
        || normalizeKey(updatedAssignment?.reportStatus) !== 'inprogress') {
        throw new Error('Không thể xác nhận trạng thái phân công đơn vị sau khi cập nhật.');
      }

      onAssignmentUpdated?.(updatedAssignment);
      setStatusDialogOpen(false);
      setMessage({ type: 'success', text: 'Đã bắt đầu xử lý sự vụ.' });

      try {
        const refreshedIncident = await incidentManagementApi.getIncidentById(incidentId);
        if (refreshedIncident && sameIdentifier(refreshedIncident?.incidentId, incidentId)) {
          onIncidentUpdated?.(refreshedIncident);
        }
      } catch {
        setMessage({ type: 'success', text: 'Đã bắt đầu xử lý. Trạng thái sự vụ mới nhất sẽ được cập nhật khi bạn tải lại.' });
      }
      scrollToStaffIncidentFlowTarget(STAFF_INCIDENT_FLOW_TARGETS.CONTACT);
    } catch (error) {
      setStatusDialogOpen(false);
      setMessage({
        type: statusUpdated ? 'success' : 'error',
        text: statusUpdated
          ? 'Đã cập nhật trạng thái đơn vị. Dữ liệu sự vụ mới nhất sẽ được cập nhật khi bạn tải lại.'
          : getActionErrorMessage(error, 'Không thể bắt đầu xử lý sự vụ.'),
      });
    } finally {
      setStatusSubmitting(false);
    }
  };

  const submitContactLog = async (event) => {
    event.preventDefault();
    if (mutationBusy || !assignmentId || !relationshipValid || !canWrite) return;

    const contactMethod = form.contactMethod.trim();
    const contactResult = form.contactResult.trim();
    if (!contactMethod || !contactResult) {
      setMessage({ type: 'error', text: 'Vui lòng nhập phương thức liên hệ và kết quả liên hệ.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const [latestIncident, latestAssignment] = await Promise.all([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentProviderAssignment(incidentId),
      ]);
      if (!latestIncident || !canManageIncidentExecution(latestIncident, user)) {
        throw new Error('Bạn không còn quyền cập nhật tiến độ của sự vụ này.');
      }
      if (!latestAssignment
        || !sameIdentifier(latestAssignment?.incidentId, incidentId)
        || positiveIdentifier(latestAssignment?.providerAssignmentId) !== assignmentId) {
        throw new Error('Đơn vị xử lý đã thay đổi. Vui lòng tải lại trang.');
      }

      const payload = { contactMethod, contactResult };
      if (form.contactNote.trim()) payload.contactNote = form.contactNote.trim();
      if (form.contactedAt) payload.contactedAt = new Date(form.contactedAt).toISOString();

      const created = await incidentManagementApi.createProviderAssignmentContactLog(
        assignmentId,
        payload,
      );
      if (positiveIdentifier(created?.providerAssignmentId) !== assignmentId) {
        throw new Error('Nhật ký liên hệ không thuộc đơn vị xử lý đang mở.');
      }

      setLogs((current) => [
        created,
        ...current.filter((log) => positiveIdentifier(log?.contactLogId) !== positiveIdentifier(created?.contactLogId)),
      ]);
      setForm({ ...EMPTY_CONTACT_DRAFT });
      setFormOpen(false);
      setMessage({ type: 'success', text: 'Đã lưu liên hệ. Tiếp theo, hãy bổ sung minh chứng và hoàn tất kết quả ở bước bên dưới.' });

      try {
        const [refreshedAssignment, refreshedIncident] = await Promise.all([
          incidentManagementApi.getIncidentProviderAssignment(incidentId),
          incidentManagementApi.getIncidentById(incidentId),
        ]);
        if (refreshedAssignment
          && sameIdentifier(refreshedAssignment?.incidentId, incidentId)
          && positiveIdentifier(refreshedAssignment?.providerAssignmentId) === assignmentId) {
          onAssignmentUpdated?.(refreshedAssignment);
        }
        if (refreshedIncident && sameIdentifier(refreshedIncident?.incidentId, incidentId)) {
          onIncidentUpdated?.(refreshedIncident);
        }
        await loadLogs();
      } catch {
        setMessage({ type: 'success', text: 'Đã thêm nhật ký liên hệ. Dữ liệu mới nhất sẽ được cập nhật khi bạn thử lại.' });
      }
      scrollToStaffIncidentFlowTarget(STAFF_INCIDENT_FLOW_TARGETS.EVIDENCE);
    } catch (error) {
      setMessage({ type: 'error', text: getActionErrorMessage(error, 'Không thể thêm nhật ký liên hệ.') });
    } finally {
      setSubmitting(false);
    }
  };

  if (!capability.available || !relationshipValid) return null;

  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="incident-provider-progress-title">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/55 dark:text-indigo-300" aria-hidden="true">
            <Lucide.Activity size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="incident-provider-progress-title" className="admin-section-title">Tiếp theo · Liên hệ đơn vị</h2>
            <p className="admin-section-description mt-1">Ghi lại phương thức và kết quả trao đổi; sau khi lưu, tiếp tục xuống bước minh chứng và gửi kết quả.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 whitespace-nowrap"
          disabled={!canWrite || mutationBusy}
          onClick={() => setFormOpen((current) => !current)}
          aria-expanded={formOpen}
          aria-controls="provider-contact-log-form"
        >
          {formOpen ? <Lucide.X size={16} aria-hidden="true" /> : <Lucide.Plus size={16} aria-hidden="true" />}
          {formOpen ? 'Đóng biểu mẫu' : 'Thêm nhật ký liên hệ'}
        </Button>
      </header>

      <ProviderProgress assignment={assignment} />

      {normalizeKey(assignment?.reportStatus) === 'reported' ? (
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/70 dark:bg-amber-950/25">
            <div className="flex min-w-0 items-start gap-3">
              <Lucide.PlayCircle className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" size={19} aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-100">Đơn vị đã sẵn sàng nhận xử lý</h3>
                <p className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-100/75">Thao tác này chuyển phân công đơn vị và sự vụ sang trạng thái Đang xử lý.</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              disabled={!canStartProcessing || statusSubmitting}
              onClick={() => setStatusDialogOpen(true)}
            >
              <Lucide.Play size={16} aria-hidden="true" />
              Bắt đầu xử lý
            </Button>
          </div>
        </div>
      ) : null}

      <div className="p-5 sm:p-6">
        {message.text ? (
          <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100'}`} role={message.type === 'success' ? 'status' : 'alert'} aria-live="polite">
            {message.type === 'success' ? <Lucide.CircleCheckBig className="mt-0.5 shrink-0" size={18} aria-hidden="true" /> : <Lucide.CircleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />}
            <p className="text-sm font-semibold leading-6">{message.text}</p>
          </div>
        ) : null}

        {!canWrite ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100" role="status">
            <Lucide.ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            <p className="text-sm font-semibold leading-6">Bạn không phải Staff đang phụ trách sự vụ này hoặc sự vụ không ở trạng thái cho phép cập nhật.</p>
          </div>
        ) : null}

        {formOpen && canWrite ? (
          <form id="provider-contact-log-form" className="mb-6 scroll-mt-4 rounded-2xl border border-blue-200 bg-blue-50/45 p-4 sm:p-5 dark:border-blue-900/70 dark:bg-blue-950/20" onSubmit={submitContactLog}>
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden="true"><Lucide.NotebookPen size={16} /></span>
              <div>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">Thêm nhật ký liên hệ</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Ghi đúng nội dung đã trao đổi với đơn vị xử lý.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="provider-contact-method">
                Phương thức liên hệ <span aria-hidden="true" className="text-rose-600">*</span>
                <Input id="provider-contact-method" className="mt-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={form.contactMethod} onChange={updateForm('contactMethod')} placeholder="Ví dụ: Điện thoại, email" required disabled={mutationBusy} />
              </label>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="provider-contacted-at">
                Thời gian liên hệ <span className="font-medium text-slate-400">(không bắt buộc)</span>
                <Input id="provider-contacted-at" className="mt-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" type="datetime-local" value={form.contactedAt} onChange={updateForm('contactedAt')} disabled={mutationBusy} />
              </label>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200 md:col-span-2" htmlFor="provider-contact-result">
                Kết quả liên hệ <span aria-hidden="true" className="text-rose-600">*</span>
                <Input id="provider-contact-result" className="mt-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={form.contactResult} onChange={updateForm('contactResult')} placeholder="Kết quả trao đổi với đơn vị xử lý" required disabled={mutationBusy} />
              </label>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200 md:col-span-2" htmlFor="provider-contact-note">
                Ghi chú <span className="font-medium text-slate-400">(không bắt buộc)</span>
                <Textarea id="provider-contact-note" className="mt-2 min-h-24 resize-y dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={form.contactNote} onChange={updateForm('contactNote')} placeholder="Thông tin bổ sung cần lưu lại..." disabled={mutationBusy} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={mutationBusy} onClick={() => setFormOpen(false)}>Hủy</Button>
              <Button type="submit" size="sm" disabled={mutationBusy || !form.contactMethod.trim() || !form.contactResult.trim()}>
                {submitting ? <Lucide.LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Lucide.Send size={16} aria-hidden="true" />}
                {submitting ? 'Đang lưu...' : 'Lưu nhật ký'}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950 dark:text-white">Nhật ký liên hệ</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mới nhất được hiển thị trước.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {sortedLogs.length.toLocaleString('vi-VN')} lần liên hệ
          </span>
        </div>

        {loading ? <ProgressSkeleton /> : null}
        {!loading && loadError ? (
          <div className="mt-5 flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100" role="alert">
            <div className="flex items-start gap-3"><Lucide.CircleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" /><p className="text-sm font-semibold leading-6">Không thể tải tiến độ xử lý. {loadError}</p></div>
            <Button type="button" variant="outline" size="sm" onClick={retry}><Lucide.RefreshCw size={16} aria-hidden="true" />Thử lại</Button>
          </div>
        ) : null}
        {!loading && !loadError && sortedLogs.length === 0 ? (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-9 text-center dark:border-slate-700 dark:bg-slate-900/45" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700" aria-hidden="true"><Lucide.PhoneOff size={21} /></span>
            <h4 className="mt-4 text-sm font-black text-slate-900 dark:text-slate-100">Chưa có nhật ký liên hệ</h4>
            <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Các lần liên hệ với đơn vị xử lý sẽ xuất hiện tại đây.</p>
          </div>
        ) : null}
        {!loading && !loadError && sortedLogs.length > 0 ? (
          <ol className="mt-5" aria-label="Nhật ký liên hệ với đơn vị xử lý">
            {sortedLogs.map((log, index) => (
              <ContactLogItem key={log?.contactLogId || `${log?.contactedAt}-${index}`} log={log} isLast={index === sortedLogs.length - 1} />
            ))}
          </ol>
        ) : null}
      </div>

      <StaffIncidentActionDialog
        open={statusDialogOpen}
        busy={statusSubmitting}
        title="Bắt đầu xử lý sự vụ này?"
        description="Phân công đơn vị, sự vụ và các phản ánh liên quan sẽ chuyển sang trạng thái xử lý tương ứng."
        confirmLabel="Xác nhận bắt đầu"
        icon={Lucide.Play}
        onClose={() => {
          if (!statusSubmitting) setStatusDialogOpen(false);
        }}
        onConfirm={startProcessing}
      >
        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/45">
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Sự vụ</dt>
            <dd className="break-words font-bold text-slate-900 dark:text-slate-100">{incident?.title || incident?.incidentCode || incidentId}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Đơn vị xử lý</dt>
            <dd className="break-words font-bold text-slate-900 dark:text-slate-100">{assignment?.providerName || 'Chưa có dữ liệu'}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Trạng thái hiện tại</dt>
            <dd className="font-bold text-slate-900 dark:text-slate-100">{getProviderStatusLabel(assignment?.reportStatus)}</dd>
          </div>
        </dl>
      </StaffIncidentActionDialog>
    </section>
  );
}
