import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Lucide from 'lucide-react';
import { extractApiErrorMessage, incidentManagementApi } from '@urbanmind/shared-api';

import Button from '../../components/design-system/Button';
import Textarea from '../../components/design-system/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import StaffIncidentActionDialog from './StaffIncidentActionDialog';
import {
  EMPTY_VALUE,
  formatOperationalDateTime,
} from './incidentDetailPresentation';
import { canManageIncidentExecution } from './staffIncidentProcessing';
import {
  STAFF_INCIDENT_FLOW_TARGETS,
  scrollToStaffIncidentFlowTarget,
} from './staffIncidentFlowNavigation';

const STAFF_INCIDENT_EVIDENCE_STATE = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  NO_PROVIDER: 'no-provider',
  API_UNAVAILABLE: 'api-unavailable',
  ERROR: 'error',
});

const sameIdentifier = (left, right) => (
  Boolean(String(left ?? '').trim() && String(right ?? '').trim())
  && String(left).trim().toLowerCase() === String(right).trim().toLowerCase()
);

const positiveIdentifier = (value) => {
  if (!['number', 'string'].includes(typeof value)) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeStatus = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

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

const getSafeFileUrl = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const getFileName = (document) => {
  const safeUrl = getSafeFileUrl(document?.fileUrl);
  if (safeUrl) {
    try {
      const pathName = new URL(safeUrl).pathname;
      const encodedName = pathName.split('/').filter(Boolean).at(-1);
      if (encodedName) return decodeURIComponent(encodedName);
    } catch {
      // The URL has already been validated; a malformed encoded filename may still fail decoding.
    }
  }
  return String(document?.description ?? '').trim() || EMPTY_VALUE;
};

const isImageDocument = (document) => {
  const fileType = String(document?.fileType ?? '').trim().toLowerCase();
  if (fileType.startsWith('image/')) return true;
  return /\.(avif|bmp|gif|jpe?g|png|webp)(?:$|\?)/i.test(String(document?.fileUrl ?? ''));
};

const validateEvidenceCollection = (documents, assignmentId, incidentId) => {
  if (!Array.isArray(documents)) throw new Error('Danh sách minh chứng không đúng định dạng.');
  if (documents.some((document) => (
    positiveIdentifier(document?.providerAssignmentId) !== assignmentId
    || !sameIdentifier(document?.incidentId, incidentId)
  ))) {
    throw new Error('Minh chứng trả về không thuộc sự vụ đang mở.');
  }
  return documents;
};

function EvidenceSkeleton() {
  return (
    <div className="space-y-4 p-5 sm:p-6" aria-busy="true" aria-label="Đang tải minh chứng xử lý">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </div>
  );
}

function OperationalState({ action, description, icon: Icon, title, tone = 'neutral' }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-rose-50/65 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100'
    : 'border-slate-300 bg-slate-50/65 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100';
  return (
    <div className={`flex flex-col items-center rounded-2xl border border-dashed px-5 py-10 text-center ${toneClass}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-slate-600 shadow-sm ring-1 ring-black/5 dark:bg-slate-950 dark:text-slate-300 dark:ring-white/10" aria-hidden="true">
        <Icon size={21} />
      </span>
      <h3 className="mt-4 text-sm font-black">{title}</h3>
      {description ? <p className="mt-2 max-w-lg text-sm leading-6 opacity-75">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function EvidenceItem({ document }) {
  const safeUrl = getSafeFileUrl(document?.fileUrl);
  const fileName = getFileName(document);
  const image = Boolean(safeUrl && isImageDocument(document));

  return (
    <li className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900">
      <article className="grid min-h-full grid-cols-[5.25rem_minmax(0,1fr)]">
        <div className="relative flex min-h-28 items-center justify-center overflow-hidden bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {image ? (
            <img src={safeUrl} alt={`Ảnh minh chứng: ${fileName}`} className="h-full min-h-28 w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
          ) : (
            <Lucide.FileText size={28} aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-between p-4">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-black leading-5 text-slate-950 dark:text-white">{fileName}</h3>
            <p className="mt-1 break-words text-xs font-semibold text-slate-500 dark:text-slate-400">
              {String(document?.fileType ?? '').trim() || EMPTY_VALUE}
            </p>
            {document?.description && document.description !== fileName ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{document.description}</p>
            ) : null}
          </div>
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <div className="flex min-w-0 gap-2">
              <dt className="shrink-0 font-semibold text-slate-500 dark:text-slate-400">Tải lên:</dt>
              <dd className="min-w-0 break-words font-bold text-slate-700 dark:text-slate-200">{formatOperationalDateTime(document?.receivedAt)}</dd>
            </div>
            <div className="flex min-w-0 gap-2">
              <dt className="shrink-0 font-semibold text-slate-500 dark:text-slate-400">Người tải:</dt>
              <dd className="min-w-0 break-words font-bold text-slate-700 dark:text-slate-200">{document?.uploadedByUserName || EMPTY_VALUE}</dd>
            </div>
          </dl>
          {safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-blue-300 dark:focus-visible:ring-blue-950"
              aria-label={`Mở minh chứng ${fileName} trong thẻ mới`}
            >
              <Lucide.ExternalLink size={14} aria-hidden="true" />
              Mở minh chứng
            </a>
          ) : (
            <p className="mt-3 text-xs font-semibold text-slate-400">Chưa có đường dẫn tệp</p>
          )}
        </div>
      </article>
    </li>
  );
}

export default function StaffIncidentEvidencePanel({
  incident,
  onEvidenceSnapshotChange,
  onIncidentUpdated,
  readOnly = false,
  readOnlyMessage = '',
}) {
  const { user } = useAuth();
  const assignmentCapability = incidentManagementApi.capabilities.providerAssignment;
  const evidenceCapability = incidentManagementApi.capabilities.completionEvidence;
  const incidentId = String(incident?.incidentId ?? '').trim();
  const canUpload = !readOnly && canManageIncidentExecution(incident, user);
  const fileInputRef = useRef(null);
  const [state, setState] = useState(
    assignmentCapability.available && evidenceCapability.available
      ? STAFF_INCIDENT_EVIDENCE_STATE.LOADING
      : STAFF_INCIDENT_EVIDENCE_STATE.API_UNAVAILABLE,
  );
  const [assignment, setAssignment] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const mutationBusy = uploading || clearing;

  const sortedDocuments = useMemo(() => [...documents].sort((left, right) => {
    const rightTime = Date.parse(right?.receivedAt) || 0;
    const leftTime = Date.parse(left?.receivedAt) || 0;
    return rightTime - leftTime;
  }), [documents]);
  const canClearAll = Boolean(
    !readOnly
    && evidenceCapability.clearAllAvailable
    && canManageIncidentExecution(incident, user)
    && normalizeStatus(incident?.status) === 'needrework'
    && documents.length > 0,
  );

  const loadEvidence = useCallback(async (signal) => {
    if (!assignmentCapability.available || !evidenceCapability.available || !incidentId) {
      setState(STAFF_INCIDENT_EVIDENCE_STATE.API_UNAVAILABLE);
      return;
    }

    setState(STAFF_INCIDENT_EVIDENCE_STATE.LOADING);
    setErrorMessage('');
    try {
      const currentAssignment = await incidentManagementApi.getIncidentProviderAssignment(
        incidentId,
        { signal },
      );
      if (signal?.aborted) return;
      if (!currentAssignment) {
        setAssignment(null);
        setDocuments([]);
        setState(STAFF_INCIDENT_EVIDENCE_STATE.NO_PROVIDER);
        return;
      }

      const assignmentId = positiveIdentifier(currentAssignment?.providerAssignmentId);
      if (!assignmentId || !sameIdentifier(currentAssignment?.incidentId, incidentId)) {
        throw new Error('Thông tin đơn vị xử lý không thuộc sự vụ đang mở.');
      }

      const result = await incidentManagementApi.getProviderAssignmentCompletionDocuments(
        assignmentId,
        { signal },
      );
      if (signal?.aborted) return;
      setAssignment(currentAssignment);
      setDocuments(validateEvidenceCollection(result, assignmentId, incidentId));
      setState(STAFF_INCIDENT_EVIDENCE_STATE.READY);
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setErrorMessage(getActionErrorMessage(error, 'Không thể tải minh chứng xử lý.'));
      setState(STAFF_INCIDENT_EVIDENCE_STATE.ERROR);
    }
  }, [assignmentCapability.available, evidenceCapability.available, incidentId]);

  useEffect(() => {
    const controller = new AbortController();
    loadEvidence(controller.signal);
    return () => controller.abort();
  }, [loadEvidence, refreshVersion]);

  useEffect(() => {
    onEvidenceSnapshotChange?.({
      assignment,
      documents,
      selectedFileCount: selectedFiles.length,
      state,
      uploading: mutationBusy,
    });
  }, [assignment, documents, mutationBusy, onEvidenceSnapshotChange, selectedFiles.length, state]);

  const resetSelection = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadEvidence = async (event) => {
    event.preventDefault();
    if (mutationBusy || !canUpload || selectedFiles.length === 0) return;

    const assignmentId = positiveIdentifier(assignment?.providerAssignmentId);
    if (!assignmentId || !sameIdentifier(assignment?.incidentId, incidentId)) {
      setMessage({ type: 'error', text: 'Chưa có liên kết đơn vị xử lý hợp lệ cho sự vụ.' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });
    let uploadCompleted = false;
    try {
      const [latestIncident, latestAssignment] = await Promise.all([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentProviderAssignment(incidentId),
      ]);
      if (!latestIncident || !canManageIncidentExecution(latestIncident, user)) {
        throw new Error('Bạn không còn quyền thêm minh chứng cho sự vụ này.');
      }
      if (!latestAssignment
        || !sameIdentifier(latestAssignment?.incidentId, incidentId)
        || positiveIdentifier(latestAssignment?.providerAssignmentId) !== assignmentId) {
        throw new Error('Đơn vị xử lý đã thay đổi. Vui lòng tải lại trang.');
      }

      const formData = new FormData();
      if (description.trim()) formData.append('Description', description.trim());
      selectedFiles.forEach((file) => formData.append('Files', file, file.name));

      const uploaded = await incidentManagementApi.uploadProviderAssignmentCompletionDocuments(
        assignmentId,
        formData,
      );
      uploadCompleted = true;
      const validated = validateEvidenceCollection(uploaded, assignmentId, incidentId);
      setAssignment(latestAssignment);
      setDocuments((current) => {
        const byId = new Map(current.map((document) => [document?.completionDocumentId, document]));
        validated.forEach((document) => byId.set(document?.completionDocumentId, document));
        return [...byId.values()];
      });
      onIncidentUpdated?.(latestIncident);
      setDescription('');
      resetSelection();
      setMessage({ type: 'success', text: 'Đã tải minh chứng lên.' });

      try {
        const refreshed = await incidentManagementApi.getProviderAssignmentCompletionDocuments(assignmentId);
        setDocuments(validateEvidenceCollection(refreshed, assignmentId, incidentId));
      } catch {
        setMessage({ type: 'success', text: 'Đã tải minh chứng lên. Danh sách mới nhất sẽ được cập nhật khi bạn thử lại.' });
      }
      scrollToStaffIncidentFlowTarget(STAFF_INCIDENT_FLOW_TARGETS.RESOLUTION_FORM);
    } catch (error) {
      if (uploadCompleted) {
        setDescription('');
        resetSelection();
      }
      setMessage({
        type: uploadCompleted ? 'success' : 'error',
        text: uploadCompleted
          ? 'Đã tải minh chứng lên nhưng chưa thể làm mới danh sách.'
          : getActionErrorMessage(error, 'Không thể tải minh chứng lên.'),
      });
    } finally {
      setUploading(false);
    }
  };

  const clearEvidence = async () => {
    if (mutationBusy || !canClearAll) return;

    const assignmentId = positiveIdentifier(assignment?.providerAssignmentId);
    if (!assignmentId || !sameIdentifier(assignment?.incidentId, incidentId)) {
      setClearDialogOpen(false);
      setMessage({ type: 'error', text: 'Chưa có liên kết đơn vị xử lý hợp lệ cho sự vụ.' });
      return;
    }

    setClearing(true);
    setMessage({ type: '', text: '' });
    let deleteCompleted = false;
    try {
      const [latestIncident, latestAssignment] = await Promise.all([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentProviderAssignment(incidentId),
      ]);
      if (!latestIncident
        || !canManageIncidentExecution(latestIncident, user)
        || normalizeStatus(latestIncident?.status) !== 'needrework') {
        throw new Error('Sự vụ không còn ở trạng thái Cần xử lý lại hoặc bạn không còn quyền cập nhật.');
      }
      if (!latestAssignment
        || !sameIdentifier(latestAssignment?.incidentId, incidentId)
        || positiveIdentifier(latestAssignment?.providerAssignmentId) !== assignmentId) {
        throw new Error('Đơn vị xử lý đã thay đổi. Vui lòng tải lại trang.');
      }

      await incidentManagementApi.deleteProviderAssignmentCompletionDocuments(assignmentId);
      deleteCompleted = true;
      setDocuments([]);
      setAssignment(latestAssignment);
      onIncidentUpdated?.(latestIncident);
      setClearDialogOpen(false);
      setMessage({ type: 'success', text: 'Đã xóa toàn bộ minh chứng cũ.' });

      try {
        const refreshed = await incidentManagementApi.getProviderAssignmentCompletionDocuments(assignmentId);
        setDocuments(validateEvidenceCollection(refreshed, assignmentId, incidentId));
      } catch {
        setMessage({ type: 'success', text: 'Đã xóa toàn bộ minh chứng cũ. Danh sách mới nhất sẽ được cập nhật khi bạn thử lại.' });
      }
    } catch (error) {
      setClearDialogOpen(false);
      setMessage({
        type: deleteCompleted ? 'success' : 'error',
        text: deleteCompleted
          ? 'Đã xóa minh chứng nhưng chưa thể làm mới danh sách.'
          : getActionErrorMessage(error, 'Không thể xóa minh chứng.'),
      });
    } finally {
      setClearing(false);
    }
  };

  const retry = () => setRefreshVersion((current) => current + 1);

  return (
    <>
      <section id="incident-evidence" className="admin-panel scroll-mt-4 overflow-hidden" aria-labelledby="incident-evidence-title">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/55 dark:text-violet-300" aria-hidden="true">
              <Lucide.Files size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="incident-evidence-title" className="admin-section-title">Tiếp theo · Minh chứng xử lý</h2>
              <p className="admin-section-description mt-1">Ảnh và tài liệu do Staff bổ sung cho kết quả thực hiện của sự vụ.</p>
            </div>
          </div>
          {state === STAFF_INCIDENT_EVIDENCE_STATE.READY ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700 dark:bg-violet-950/55 dark:text-violet-300">
              <Lucide.Paperclip size={13} aria-hidden="true" />
              {sortedDocuments.length.toLocaleString('vi-VN')} minh chứng
            </span>
          ) : null}
        </header>

        {state === STAFF_INCIDENT_EVIDENCE_STATE.LOADING ? <EvidenceSkeleton /> : null}

        {state === STAFF_INCIDENT_EVIDENCE_STATE.API_UNAVAILABLE ? (
          <div className="p-5 sm:p-6">
            <OperationalState icon={Lucide.FileQuestion} title="Minh chứng xử lý chưa khả dụng" description="Chưa thể tải hoặc bổ sung minh chứng cho sự vụ này." />
          </div>
        ) : null}

        {state === STAFF_INCIDENT_EVIDENCE_STATE.NO_PROVIDER ? (
          <div className="p-5 sm:p-6">
            <OperationalState icon={Lucide.Building2} title="Chưa có đơn vị xử lý" description="Sự vụ cần có đơn vị xử lý được liên kết chính thức trước khi thêm minh chứng." />
          </div>
        ) : null}

        {state === STAFF_INCIDENT_EVIDENCE_STATE.ERROR ? (
          <div className="p-5 sm:p-6">
            <OperationalState
              icon={Lucide.CircleAlert}
              title="Không thể tải minh chứng xử lý"
              description={errorMessage}
              tone="danger"
              action={<Button type="button" variant="outline" size="sm" onClick={retry}><Lucide.RefreshCw size={16} aria-hidden="true" />Thử lại</Button>}
            />
          </div>
        ) : null}

        {state === STAFF_INCIDENT_EVIDENCE_STATE.READY ? (
          <div className="space-y-6 p-5 sm:p-6">
            {message.text ? (
              <div className={`flex items-start gap-3 rounded-2xl border p-4 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100'}`} role={message.type === 'success' ? 'status' : 'alert'} aria-live="polite">
                {message.type === 'success' ? <Lucide.CircleCheckBig className="mt-0.5 shrink-0" size={18} aria-hidden="true" /> : <Lucide.CircleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />}
                <p className="text-sm font-semibold leading-6">{message.text}</p>
              </div>
            ) : null}

            {canUpload ? (
              <form onSubmit={uploadEvidence} className="rounded-2xl border border-violet-200 bg-violet-50/45 p-4 sm:p-5 dark:border-violet-900/70 dark:bg-violet-950/20">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white" aria-hidden="true"><Lucide.Upload size={16} /></span>
                  <div>
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">Thêm minh chứng</h3>
                    <p id="incident-evidence-upload-help" className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Chỉ chọn các tệp phù hợp với nội dung xử lý.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="incident-evidence-files">
                    Tệp minh chứng
                    <input
                      ref={fileInputRef}
                      id="incident-evidence-files"
                      type="file"
                      multiple
                      required={selectedFiles.length === 0}
                      disabled={mutationBusy}
                      aria-describedby="incident-evidence-upload-help"
                      onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-violet-700 hover:file:bg-violet-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:file:bg-violet-950/70 dark:file:text-violet-300 dark:focus-visible:ring-violet-950"
                    />
                  </label>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="incident-evidence-description">
                    Mô tả <span className="font-medium text-slate-400">(không bắt buộc)</span>
                    <Textarea id="incident-evidence-description" className="mt-2 min-h-[4.4rem] resize-y dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={description} onChange={(event) => setDescription(event.target.value)} disabled={mutationBusy} placeholder="Nội dung minh chứng ghi nhận..." />
                  </label>
                </div>

                {selectedFiles.length ? (
                  <div className="mt-4 rounded-xl border border-violet-200 bg-white/80 p-3 dark:border-violet-900 dark:bg-slate-950/55" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100">Đã chọn {selectedFiles.length.toLocaleString('vi-VN')} tệp</p>
                      <Button type="button" variant="ghost" size="sm" disabled={mutationBusy} onClick={resetSelection}>Bỏ chọn</Button>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {selectedFiles.map((file) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="break-all">{file.name}</li>)}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <Button type="submit" size="sm" disabled={mutationBusy || selectedFiles.length === 0}>
                    {uploading ? <Lucide.LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Lucide.Upload size={16} aria-hidden="true" />}
                    {uploading ? 'Đang tải lên...' : 'Tải minh chứng lên'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100" role="status">
                <Lucide.ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                <p className="text-sm font-semibold leading-6">{readOnlyMessage || 'Bạn không phải Staff đang phụ trách sự vụ này hoặc sự vụ không ở trạng thái cho phép cập nhật.'}</p>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-950 dark:text-white">Minh chứng đã lưu</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Các tệp mới được tải lên không thay thế minh chứng đã có.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canClearAll ? (
                    <Button type="button" variant="outline" size="sm" className="whitespace-nowrap text-rose-700 hover:text-rose-800 dark:text-rose-300" disabled={mutationBusy} onClick={() => setClearDialogOpen(true)}>
                      <Lucide.Trash2 size={15} aria-hidden="true" />
                      Xóa toàn bộ minh chứng cũ
                    </Button>
                  ) : null}
                </div>
              </div>

              {sortedDocuments.length === 0 ? (
                <div className="mt-4">
                  <OperationalState icon={Lucide.FilePlus2} title="Chưa có minh chứng xử lý" description="Minh chứng được tải lên cho đơn vị xử lý của sự vụ sẽ xuất hiện tại đây." />
                </div>
              ) : (
                <ul className="mt-4 grid gap-3 lg:grid-cols-2" aria-label="Danh sách minh chứng xử lý">
                  {sortedDocuments.map((document) => (
                    <EvidenceItem key={document?.completionDocumentId || document?.fileUrl} document={document} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <StaffIncidentActionDialog
        open={clearDialogOpen}
        busy={clearing}
        title="Xóa toàn bộ minh chứng cũ?"
        description="Thao tác này chỉ dành cho sự vụ đang Cần xử lý lại và sẽ xóa toàn bộ minh chứng đã lưu của đơn vị xử lý hiện tại. Các tệp bạn đang chọn trên máy sẽ không bị ảnh hưởng."
        confirmLabel="Xác nhận xóa toàn bộ"
        cancelLabel="Giữ lại minh chứng"
        icon={Lucide.Trash2}
        onClose={() => { if (!clearing) setClearDialogOpen(false); }}
        onConfirm={clearEvidence}
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100">
          <p className="font-black">{documents.length.toLocaleString('vi-VN')} minh chứng sẽ bị xóa.</p>
          <p className="mt-1">Toàn bộ minh chứng đã lưu sẽ bị xóa và thao tác này không thể hoàn tác.</p>
        </div>
      </StaffIncidentActionDialog>
    </>
  );
}
