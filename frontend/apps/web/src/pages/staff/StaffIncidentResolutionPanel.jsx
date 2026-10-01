import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as Lucide from 'lucide-react';
import { extractApiErrorMessage, incidentManagementApi } from '@urbanmind/shared-api';

import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import Textarea from '../../components/design-system/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import StaffIncidentActionDialog from './StaffIncidentActionDialog';
import StaffIncidentEvidencePanel from './StaffIncidentEvidencePanel';
import {
  EMPTY_VALUE,
  formatIncidentCode,
  formatOperationalDateTime,
  getIncidentStatusLabel,
} from './incidentDetailPresentation';
import {
  getIncidentResolutionSubmissionMode,
  sortIncidentResolutionsNewestFirst,
  validateIncidentResolutions,
} from './staffIncidentResolution';
import { isIncidentAssignedToCurrentStaff } from './staffIncidentProcessing';

const RESOLUTION_STATE = Object.freeze({
  API_UNAVAILABLE: 'api-unavailable',
  ERROR: 'error',
  LOADING: 'loading',
  READY: 'ready',
});

const STAFF_INCIDENT_EVIDENCE_STATE = Object.freeze({
  API_UNAVAILABLE: 'api-unavailable',
  ERROR: 'error',
  LOADING: 'loading',
  NO_PROVIDER: 'no-provider',
  READY: 'ready',
});

const EMPTY_DRAFT = Object.freeze({
  actionTaken: '',
  resolutionSummary: '',
  resultNote: '',
});

const RESOLUTION_STATUS_LABELS = Object.freeze({
  approved: 'Đã duyệt',
  closed: 'Đã đóng',
  inprogress: 'Đang xử lý',
  needrework: 'Cần xử lý lại',
  pending: 'Chờ duyệt',
  resolved: 'Đã giải quyết',
  submitted: 'Đã gửi',
  submittedforapproval: 'Chờ duyệt kết quả',
});

const normalizeKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

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

const getResolutionStatusLabel = (value) => {
  if (!String(value ?? '').trim()) return EMPTY_VALUE;
  return RESOLUTION_STATUS_LABELS[normalizeKey(value)] || 'Chưa xác định';
};

const getResolutionStatusIntent = (value) => {
  const normalized = normalizeKey(value);
  if (['approved', 'resolved', 'closed'].includes(normalized)) return 'success';
  if (normalized === 'needrework') return 'danger';
  if (['pending', 'submitted', 'submittedforapproval'].includes(normalized)) return 'warning';
  if (normalized === 'inprogress') return 'info';
  return 'neutral';
};

const getSafeHttpUrl = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const isImageEvidence = (document) => (
  String(document?.fileType ?? '').trim().toLowerCase().startsWith('image/')
  || /\.(avif|bmp|gif|jpe?g|png|webp)(?:$|\?)/i.test(String(document?.fileUrl ?? ''))
);

const getDocumentName = (document) => {
  const safeUrl = getSafeHttpUrl(document?.fileUrl);
  if (safeUrl) {
    try {
      const encodedName = new URL(safeUrl).pathname.split('/').filter(Boolean).at(-1);
      if (encodedName) return decodeURIComponent(encodedName);
    } catch {
      // A malformed encoded filename does not make the already-validated URL unsafe.
    }
  }
  return String(document?.description ?? '').trim() || EMPTY_VALUE;
};

const validateResolutionDocuments = (resolutions, incidentId) => resolutions.every((resolution) => {
  if (
    resolution?.completionDocuments !== null
    && resolution?.completionDocuments !== undefined
    && !Array.isArray(resolution.completionDocuments)
  ) return false;

  const assignmentId = resolution?.providerAssignmentId === null
    || resolution?.providerAssignmentId === undefined
    ? null
    : positiveIdentifier(resolution.providerAssignmentId);
  if (resolution?.providerAssignmentId !== null
    && resolution?.providerAssignmentId !== undefined
    && !assignmentId) return false;

  return (resolution?.completionDocuments || []).every((document) => (
    sameIdentifier(document?.incidentId, incidentId)
    && (
      assignmentId === null
      || positiveIdentifier(document?.providerAssignmentId) === assignmentId
    )
  ));
});

const validateEvidenceDocuments = (documents, assignmentId, incidentId) => {
  if (!Array.isArray(documents)) throw new Error('Danh sách minh chứng không đúng định dạng.');
  if (documents.some((document) => (
    positiveIdentifier(document?.providerAssignmentId) !== assignmentId
    || !sameIdentifier(document?.incidentId, incidentId)
  ))) {
    throw new Error('Minh chứng trả về không thuộc sự vụ đang mở.');
  }
  return documents;
};

const readDraft = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return { ...EMPTY_DRAFT };
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_DRAFT };
    return {
      actionTaken: typeof value.actionTaken === 'string' ? value.actionTaken : '',
      resolutionSummary: typeof value.resolutionSummary === 'string' ? value.resolutionSummary : '',
      resultNote: typeof value.resultNote === 'string' ? value.resultNote : '',
    };
  } catch {
    return { ...EMPTY_DRAFT };
  }
};

function ResolutionSkeleton() {
  return (
    <div className="space-y-4 p-5 sm:p-6" aria-busy="true" aria-label="Đang tải kết quả xử lý">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
      <span className="sr-only">Đang tải dữ liệu</span>
    </div>
  );
}

function OperationalState({ action, description, icon: Icon, title, tone = 'neutral' }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-rose-50/65 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100'
    : 'border-slate-300 bg-slate-50/65 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100';

  return (
    <div className={`flex flex-col items-center rounded-2xl border border-dashed px-5 py-9 text-center ${toneClass}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-slate-600 shadow-sm ring-1 ring-black/5 dark:bg-slate-950 dark:text-slate-300 dark:ring-white/10" aria-hidden="true">
        <Icon size={21} />
      </span>
      <h3 className="mt-4 text-sm font-black">{title}</h3>
      {description ? <p className="mt-2 max-w-xl text-sm leading-6 opacity-75">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function SummaryFact({ icon: Icon, label, value, tone = 'blue' }) {
  const toneClass = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/55 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/55 dark:text-violet-300',
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`} aria-hidden="true">
        <Icon size={17} />
      </span>
      <dl className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[0.055em] text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-black text-slate-950 dark:text-white">{value}</dd>
      </dl>
    </div>
  );
}

function ResolutionHistoryItem({ resolution }) {
  const documents = Array.isArray(resolution?.completionDocuments)
    ? resolution.completionDocuments
    : [];
  const resolvedAt = String(resolution?.resolvedAt ?? '').trim();

  return (
    <li>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950/55">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.055em] text-slate-500 dark:text-slate-400">
              Kết quả #{positiveIdentifier(resolution?.resolutionId) || EMPTY_VALUE}
            </p>
            <h3 className="mt-2 break-words text-base font-black leading-6 text-slate-950 dark:text-white">
              {String(resolution?.resolutionSummary ?? '').trim() || EMPTY_VALUE}
            </h3>
          </div>
          <Badge intent={getResolutionStatusIntent(resolution?.status)}>
            {getResolutionStatusLabel(resolution?.status)}
          </Badge>
        </header>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-y border-slate-100 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Lucide.UserRound size={14} aria-hidden="true" />
            <strong className="font-bold text-slate-700 dark:text-slate-200">{resolution?.createdByStaffUserName || EMPTY_VALUE}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lucide.Clock3 size={14} aria-hidden="true" />
            <time dateTime={resolvedAt || undefined}>{formatOperationalDateTime(resolvedAt)}</time>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lucide.Paperclip size={14} aria-hidden="true" />
            {documents.length.toLocaleString('vi-VN')} minh chứng
          </span>
        </div>

        {resolution?.actionTaken || resolution?.resultNote ? (
          <dl className="mt-4 grid gap-4 lg:grid-cols-2">
            {resolution?.actionTaken ? (
              <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                <dt className="text-xs font-bold text-slate-500 dark:text-slate-400">Công việc đã thực hiện</dt>
                <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-200">{resolution.actionTaken}</dd>
              </div>
            ) : null}
            {resolution?.resultNote ? (
              <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                <dt className="text-xs font-bold text-slate-500 dark:text-slate-400">Ghi chú cho Manager</dt>
                <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-200">{resolution.resultNote}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {documents.length ? (
          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 open:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:open:bg-slate-950">
            <summary className="cursor-pointer rounded-lg text-sm font-bold text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-blue-300 dark:focus-visible:ring-blue-950">
              Xem minh chứng của kết quả
            </summary>
            <ul className="mt-3 space-y-2" aria-label={`Minh chứng của kết quả ${resolution?.resolutionId || ''}`}>
              {documents.map((document) => {
                const safeUrl = getSafeHttpUrl(document?.fileUrl);
                const name = getDocumentName(document);
                return (
                  <li key={document?.completionDocumentId || document?.fileUrl} className="flex min-w-0 items-center gap-2 text-sm">
                    <Lucide.FileText size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                    {safeUrl ? (
                      <a href={safeUrl} target="_blank" rel="noreferrer" className="min-w-0 break-all font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-blue-300 dark:focus-visible:ring-blue-950">
                        {name}
                      </a>
                    ) : (
                      <span className="min-w-0 break-all text-slate-600 dark:text-slate-300">{name}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </article>
    </li>
  );
}

export default function StaffIncidentResolutionPanel({
  embedded = false,
  incident,
  onIncidentUpdated,
  readOnly = false,
}) {
  const { user } = useAuth();
  const capability = incidentManagementApi.capabilities.resolutions;
  const incidentId = String(incident?.incidentId ?? '').trim();
  const staffUserId = String(user?.userId ?? user?.id ?? '').trim().toLowerCase();
  const draftStorageKey = incidentId && staffUserId
    ? `urbanmind:staff-incident-resolution-draft:${staffUserId}:${incidentId}`
    : '';
  const seededResolutionRef = useRef('');
  const [state, setState] = useState(
    capability.available ? RESOLUTION_STATE.LOADING : RESOLUTION_STATE.API_UNAVAILABLE,
  );
  const [resolutions, setResolutions] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [evidenceRefreshVersion, setEvidenceRefreshVersion] = useState(0);
  const [evidenceSnapshot, setEvidenceSnapshot] = useState({
    assignment: null,
    documents: [],
    selectedFileCount: 0,
    state: STAFF_INCIDENT_EVIDENCE_STATE.LOADING,
    uploading: false,
  });
  const [draft, setDraft] = useState(() => readDraft(draftStorageKey));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const sortedResolutions = useMemo(
    () => sortIncidentResolutionsNewestFirst(resolutions),
    [resolutions],
  );
  const currentStatus = normalizeKey(incident?.status);
  const baseSubmissionMode = state === RESOLUTION_STATE.READY
    ? getIncidentResolutionSubmissionMode(incident, user, resolutions.length)
    : null;
  const submissionMode = submittedStatus && submittedStatus === currentStatus
    ? null
    : baseSubmissionMode;
  const currentAssignment = evidenceSnapshot.assignment;
  const currentDocuments = Array.isArray(evidenceSnapshot.documents)
    ? evidenceSnapshot.documents
    : [];
  const evidenceReady = [
    STAFF_INCIDENT_EVIDENCE_STATE.NO_PROVIDER,
    STAFF_INCIDENT_EVIDENCE_STATE.READY,
  ].includes(evidenceSnapshot.state);
  const providerSummary = evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.READY
    ? currentAssignment?.providerName || 'Chưa có dữ liệu'
    : evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.NO_PROVIDER
      ? 'Gửi trực tiếp theo sự vụ'
      : 'Chưa xác minh';
  const evidenceSummary = evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.READY
    ? `${currentDocuments.length.toLocaleString('vi-VN')} tệp đã lưu`
    : evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.NO_PROVIDER
      ? 'Chưa có minh chứng'
      : 'Chưa xác minh';
  const hasRequiredResolutionContent = Boolean(
    draft.resolutionSummary.trim()
    && draft.actionTaken.trim(),
  );
  const maySubmit = Boolean(
    submissionMode
    && hasRequiredResolutionContent
    && !evidenceSnapshot.uploading
    && evidenceSnapshot.selectedFileCount === 0,
  );
  const evidenceReadOnly = Boolean(
    (submittedStatus && submittedStatus === currentStatus)
    || (currentStatus === 'inprogress' && resolutions.length > 0),
  );

  const applyValidatedHistory = useCallback((result) => {
    if (
      !validateIncidentResolutions(result, incidentId)
      || !validateResolutionDocuments(result, incidentId)
    ) {
      throw new Error('Kết quả xử lý trả về không thuộc sự vụ đang mở.');
    }
    setResolutions(result);
    setState(RESOLUTION_STATE.READY);
    return result;
  }, [incidentId]);

  const loadHistory = useCallback(async (signal) => {
    if (!capability.available || !incidentId) {
      setState(RESOLUTION_STATE.API_UNAVAILABLE);
      return;
    }
    setState(RESOLUTION_STATE.LOADING);
    setHistoryError('');
    try {
      const result = await incidentManagementApi.getIncidentResolutions(incidentId, { signal });
      if (signal?.aborted) return;
      applyValidatedHistory(result);
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setHistoryError(getActionErrorMessage(error, 'Không thể tải kết quả xử lý.'));
      setState(RESOLUTION_STATE.ERROR);
    }
  }, [applyValidatedHistory, capability.available, incidentId]);

  useEffect(() => {
    const controller = new AbortController();
    loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory, refreshVersion]);

  useEffect(() => {
    setDraft(readDraft(draftStorageKey));
    setMessage({ type: '', text: '' });
    setSubmittedStatus('');
    seededResolutionRef.current = '';
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || typeof window === 'undefined') return;
    try {
      if (draft.resolutionSummary || draft.actionTaken || draft.resultNote) {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } else {
        window.localStorage.removeItem(draftStorageKey);
      }
    } catch {
      // Draft persistence is a convenience; the visible form remains usable without it.
    }
  }, [draft, draftStorageKey]);

  useEffect(() => {
    if (submittedStatus || currentStatus !== 'needrework' || !sortedResolutions.length) return;
    const latest = sortedResolutions[0];
    const seedKey = `${incidentId}:${latest?.resolutionId ?? latest?.resolvedAt ?? 'latest'}`;
    if (seededResolutionRef.current === seedKey) return;
    seededResolutionRef.current = seedKey;
    setDraft((current) => {
      if (current.resolutionSummary || current.actionTaken || current.resultNote) return current;
      return {
        resolutionSummary: String(latest?.resolutionSummary ?? ''),
        actionTaken: String(latest?.actionTaken ?? ''),
        resultNote: String(latest?.resultNote ?? ''),
      };
    });
  }, [currentStatus, incidentId, sortedResolutions, submittedStatus]);

  useEffect(() => {
    if (submittedStatus && submittedStatus !== currentStatus) setSubmittedStatus('');
  }, [currentStatus, submittedStatus]);

  const handleEvidenceSnapshot = useCallback((snapshot) => {
    setEvidenceSnapshot(snapshot);
  }, []);

  const updateDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  const openConfirmation = (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });
    if (evidenceSnapshot.selectedFileCount > 0) {
      setMessage({ type: 'error', text: 'Bạn còn tệp minh chứng chưa tải lên. Hãy tải lên hoặc bỏ chọn trước khi gửi kết quả.' });
      return;
    }
    if (!hasRequiredResolutionContent) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tóm tắt kết quả và công việc đã thực hiện.' });
      return;
    }
    if (!maySubmit) return;
    setDialogOpen(true);
  };

  const submitResolution = async () => {
    if (submitting || !submissionMode) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    let requestCompleted = false;

    try {
      const [latestIncident, latestHistory] = await Promise.all([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentResolutions(incidentId),
      ]);

      if (!latestIncident || !sameIdentifier(latestIncident?.incidentId, incidentId)) {
        throw new Error('Không thể xác minh sự vụ trước khi gửi kết quả.');
      }
      if (
        !validateIncidentResolutions(latestHistory, incidentId)
        || !validateResolutionDocuments(latestHistory, incidentId)
      ) {
        throw new Error('Lịch sử kết quả không thuộc sự vụ đang mở.');
      }

      const latestMode = getIncidentResolutionSubmissionMode(
        latestIncident,
        user,
        latestHistory.length,
      );
      if (!latestMode || latestMode !== submissionMode) {
        throw new Error('Trạng thái sự vụ đã thay đổi và không còn cho phép thao tác gửi hiện tại.');
      }

      let latestAssignmentId = null;
      let latestDocuments = [];
      if (evidenceReady) {
        const latestAssignment = await incidentManagementApi.getIncidentProviderAssignment(incidentId);
        const fetchedAssignmentId = positiveIdentifier(latestAssignment?.providerAssignmentId);
        const shownAssignmentId = positiveIdentifier(currentAssignment?.providerAssignmentId);

        if (evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.READY) {
          if (
            !latestAssignment
            || !fetchedAssignmentId
            || shownAssignmentId !== fetchedAssignmentId
            || !sameIdentifier(latestAssignment?.incidentId, incidentId)
          ) {
            throw new Error('Đơn vị xử lý đã thay đổi. Vui lòng tải lại trước khi gửi kết quả.');
          }
          latestAssignmentId = fetchedAssignmentId;
          latestDocuments = validateEvidenceDocuments(
            await incidentManagementApi.getProviderAssignmentCompletionDocuments(fetchedAssignmentId),
            fetchedAssignmentId,
            incidentId,
          );
        } else if (latestAssignment) {
          throw new Error('Sự vụ vừa có đơn vị xử lý. Vui lòng tải lại trước khi gửi kết quả.');
        }
      }
      const imageUrls = latestDocuments
        .filter(isImageEvidence)
        .map((document) => getSafeHttpUrl(document?.fileUrl))
        .filter(Boolean);

      const payload = {
        ...(latestAssignmentId ? { providerAssignmentId: latestAssignmentId } : {}),
        resolutionSummary: draft.resolutionSummary.trim(),
        actionTaken: draft.actionTaken.trim(),
        ...(draft.resultNote.trim() ? { resultNote: draft.resultNote.trim() } : {}),
        ...(imageUrls.length ? { imageUrls } : {}),
      };

      await incidentManagementApi.submitIncidentResolution(incidentId, payload);
      requestCompleted = true;
      setSubmittedStatus(normalizeKey(latestIncident.status));
      setDialogOpen(false);
      setDraft({ ...EMPTY_DRAFT });
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // The successful request is authoritative even when browser storage is unavailable.
      }
      setMessage({
        type: 'success',
        text: latestMode === 'resubmit'
          ? 'Đã gửi lại kết quả xử lý.'
          : 'Đã gửi kết quả xử lý cho Manager.',
      });

      const refreshResults = await Promise.allSettled([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentResolutions(incidentId),
        incidentManagementApi.getIncidentTimeline(incidentId, { pageNumber: 1, pageSize: 20 }),
        incidentManagementApi.getIncidentProviderAssignment(incidentId),
        incidentManagementApi.getIncidents({
          pageNumber: 1,
          pageSize: 1,
          assignedStaffUserId: staffUserId,
        }),
      ]);
      const [incidentResult, historyResult] = refreshResults;

      if (incidentResult.status === 'fulfilled' && incidentResult.value) {
        onIncidentUpdated?.(incidentResult.value);
      }
      if (
        historyResult.status === 'fulfilled'
        && validateIncidentResolutions(historyResult.value, incidentId)
        && validateResolutionDocuments(historyResult.value, incidentId)
      ) {
        setResolutions(historyResult.value);
        setState(RESOLUTION_STATE.READY);
      }
      setEvidenceRefreshVersion((current) => current + 1);
    } catch (error) {
      setDialogOpen(false);
      if (requestCompleted) {
        setMessage({
          type: 'success',
          text: 'Đã gửi kết quả xử lý. Dữ liệu mới nhất sẽ được cập nhật khi bạn thử lại.',
        });
      } else {
        setMessage({
          type: 'error',
          text: `${getActionErrorMessage(error, submissionMode === 'resubmit' ? 'Không thể gửi lại kết quả xử lý.' : 'Không thể gửi kết quả xử lý.')} Nội dung bạn nhập vẫn được giữ.`,
        });
        setRefreshVersion((current) => current + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getUnavailableCopy = () => {
    if (!isIncidentAssignedToCurrentStaff(incident, user)) {
      return 'Bạn không phải Staff đang phụ trách sự vụ này. Bạn vẫn có thể xem minh chứng và lịch sử kết quả.';
    }
    if (submittedStatus && submittedStatus === currentStatus) {
      return 'Kết quả vừa gửi đang được cập nhật. Vui lòng chờ trạng thái mới nhất.';
    }
    if (currentStatus === 'assigned') {
      return 'Hãy bắt đầu xử lý sự vụ trước khi gửi kết quả.';
    }
    if (currentStatus === 'inprogress' && resolutions.length > 0) {
      return 'Kết quả đã được gửi. Hãy chờ Manager duyệt hoặc yêu cầu xử lý lại.';
    }
    if (currentStatus === 'submittedforapproval') {
      return 'Kết quả xử lý đang chờ Manager xem xét.';
    }
    if (['approved', 'resolved', 'closed'].includes(currentStatus)) {
      return 'Sự vụ đã hoàn tất bước gửi kết quả và hiện chỉ có thể xem.';
    }
    if (currentStatus === 'merged') {
      return 'Sự vụ đã được gộp và không còn là đầu việc xử lý độc lập.';
    }
    return 'Trạng thái hiện tại không cho phép gửi kết quả xử lý.';
  };

  return (
    <div
      id={embedded ? 'incident-execution-resolution' : 'incident-panel-resolution'}
      role={embedded ? undefined : 'tabpanel'}
      aria-labelledby={embedded ? undefined : 'incident-tab-resolution'}
      tabIndex={embedded ? undefined : 0}
      className="scroll-mt-4 space-y-5 focus-visible:outline-none"
    >
      {!readOnly ? (
      <section className="admin-panel overflow-hidden" aria-labelledby="incident-resolution-workspace-title">
        <header className="border-b border-blue-100 bg-blue-50/65 px-5 py-5 sm:px-6 dark:border-blue-950 dark:bg-blue-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)]" aria-hidden="true">
                <Lucide.ClipboardCheck size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.07em] text-blue-700 dark:text-blue-300">{formatIncidentCode(incidentId)}</p>
                <h2 id="incident-resolution-workspace-title" className="mt-1 text-lg font-black text-slate-950 dark:text-white">Hoàn tất xử lý</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Tải minh chứng trước, sau đó ghi nhận công việc đã thực hiện và gửi kết quả cho Manager trong cùng một flow.</p>
              </div>
            </div>
            <Badge intent={currentStatus === 'needrework' ? 'danger' : 'info'}>{getIncidentStatusLabel(incident?.status)}</Badge>
          </div>
        </header>
        <div className="grid gap-3 bg-slate-50/55 p-4 sm:grid-cols-3 sm:p-5 dark:bg-slate-950/25">
          <SummaryFact icon={Lucide.Activity} label="Trạng thái sự vụ" value={getIncidentStatusLabel(incident?.status)} />
          <SummaryFact icon={Lucide.Paperclip} label="Minh chứng đã lưu" value={evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.READY ? currentDocuments.length.toLocaleString('vi-VN') : evidenceSnapshot.state === STAFF_INCIDENT_EVIDENCE_STATE.NO_PROVIDER ? 'Chưa có đơn vị xử lý' : 'Đang kiểm tra'} tone="violet" />
          <SummaryFact icon={Lucide.History} label="Kết quả đã gửi" value={state === RESOLUTION_STATE.READY ? resolutions.length.toLocaleString('vi-VN') : 'Đang kiểm tra'} tone="amber" />
        </div>
      </section>
      ) : null}

      {!readOnly && currentStatus === 'needrework' ? (
        <section className="overflow-hidden rounded-[1.35rem] border border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25" aria-labelledby="manager-rework-request-title">
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white" aria-hidden="true"><Lucide.RotateCcw size={19} /></span>
            <div className="min-w-0">
              <Badge intent="danger">Cần xử lý lại</Badge>
              <h2 id="manager-rework-request-title" className="mt-3 text-base font-black text-amber-950 dark:text-amber-100">Yêu cầu từ Manager</h2>
              <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">Sự vụ cần được cập nhật kết quả trước khi gửi lại cho Manager duyệt.</p>
            </div>
          </div>
        </section>
      ) : null}

      {!readOnly ? <StaffIncidentEvidencePanel
        key={`${incidentId}:${evidenceRefreshVersion}`}
        incident={incident}
        onEvidenceSnapshotChange={handleEvidenceSnapshot}
        onIncidentUpdated={onIncidentUpdated}
        readOnly={evidenceReadOnly}
        readOnlyMessage="Kết quả đã được gửi. Minh chứng tạm thời ở chế độ chỉ xem trong khi chờ Manager duyệt hoặc yêu cầu xử lý lại."
      /> : null}

      {!readOnly ? (
      <section id="incident-resolution-submit" className="admin-panel scroll-mt-4 overflow-hidden" aria-labelledby="incident-resolution-submit-title">
        <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-5 sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300" aria-hidden="true">
            {submissionMode === 'resubmit' ? <Lucide.RotateCcw size={20} /> : <Lucide.Send size={20} />}
          </span>
          <div className="min-w-0">
            <h2 id="incident-resolution-submit-title" className="admin-section-title">{submissionMode === 'resubmit' ? 'Cuối cùng · Gửi lại kết quả' : 'Cuối cùng · Gửi kết quả'}</h2>
            <p className="admin-section-description mt-1">Nhân viên gửi nội dung thực hiện cho Manager duyệt; thao tác này không tự phê duyệt hoặc đóng sự vụ.</p>
          </div>
        </header>

        {state === RESOLUTION_STATE.API_UNAVAILABLE ? (
          <div className="p-5 sm:p-6"><OperationalState icon={Lucide.ClipboardList} title="Chức năng gửi kết quả chưa khả dụng" description="Chưa thể gửi kết quả xử lý cho sự vụ này." /></div>
        ) : null}
        {state === RESOLUTION_STATE.LOADING ? <ResolutionSkeleton /> : null}
        {state === RESOLUTION_STATE.ERROR ? (
          <div className="p-5 sm:p-6">
            <OperationalState
              icon={Lucide.CircleAlert}
              title="Không thể tải thông tin gửi kết quả"
              description={historyError}
              tone="danger"
              action={<Button type="button" variant="outline" size="sm" onClick={() => setRefreshVersion((current) => current + 1)}><Lucide.RefreshCw size={16} aria-hidden="true" />Thử lại</Button>}
            />
          </div>
        ) : null}
        {state === RESOLUTION_STATE.READY ? (
          <div className="p-5 sm:p-6">
            {message.text ? (
              <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100'}`} role={message.type === 'success' ? 'status' : 'alert'} aria-live="polite">
                {message.type === 'success' ? <Lucide.CircleCheckBig className="mt-0.5 shrink-0" size={18} aria-hidden="true" /> : <Lucide.CircleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />}
                <p className="text-sm font-semibold leading-6">{message.text}</p>
              </div>
            ) : null}

            {submissionMode ? (
              <form onSubmit={openConfirmation} noValidate>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_minmax(18rem,0.58fr)]">
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="incident-resolution-summary">
                      Tóm tắt kết quả <span aria-hidden="true" className="text-rose-600">*</span>
                      <Textarea
                        id="incident-resolution-summary"
                        className="mt-2 min-h-28 resize-y dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.resolutionSummary}
                        onChange={updateDraft('resolutionSummary')}
                        disabled={submitting}
                        required
                        aria-describedby="incident-resolution-summary-help"
                        placeholder="Tóm tắt kết quả xử lý sự vụ..."
                      />
                      <span id="incident-resolution-summary-help" className="mt-1.5 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Nội dung chính để Manager xem xét kết quả.</span>
                    </label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="incident-resolution-actions">
                      Công việc đã thực hiện <span aria-hidden="true" className="text-rose-600">*</span>
                      <Textarea id="incident-resolution-actions" className="mt-2 min-h-28 resize-y dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={draft.actionTaken} onChange={updateDraft('actionTaken')} disabled={submitting} required placeholder="Các bước kiểm tra, sửa chữa hoặc phối hợp đã thực hiện..." />
                    </label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="incident-resolution-note">
                      Ghi chú cho Manager <span className="font-medium text-slate-400">(không bắt buộc)</span>
                      <Textarea id="incident-resolution-note" className="mt-2 min-h-24 resize-y dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={draft.resultNote} onChange={updateDraft('resultNote')} disabled={submitting} placeholder="Thông tin bổ sung cần Manager lưu ý..." />
                    </label>
                  </div>

                  <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5 dark:border-blue-900 dark:bg-blue-950/25" aria-label="Tóm tắt trước khi gửi">
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">Trước khi gửi</h3>
                    <dl className="mt-4 divide-y divide-blue-100 text-sm dark:divide-blue-900/60">
                      <div className="flex items-start justify-between gap-3 py-3 first:pt-0">
                        <dt className="text-slate-500 dark:text-slate-400">Hình thức</dt>
                        <dd className="text-right font-bold text-slate-900 dark:text-slate-100">{submissionMode === 'resubmit' ? 'Gửi lại để duyệt' : 'Gửi lần đầu'}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3 py-3">
                        <dt className="text-slate-500 dark:text-slate-400">Đơn vị xử lý</dt>
                        <dd className="max-w-[12rem] text-right font-bold text-slate-900 dark:text-slate-100">{providerSummary}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3 py-3 last:pb-0">
                        <dt className="text-slate-500 dark:text-slate-400">Minh chứng</dt>
                        <dd className="text-right font-bold text-slate-900 dark:text-slate-100">{evidenceSummary}</dd>
                      </div>
                    </dl>
                    {!evidenceReady ? (
                      <p className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs font-semibold leading-5 text-amber-900 dark:border-amber-900 dark:bg-slate-950/40 dark:text-amber-200">Chưa thể xác minh minh chứng hiện có. Bạn vẫn có thể gửi nội dung ở cấp sự vụ; minh chứng chưa xác minh sẽ không được đính kèm vào yêu cầu gửi.</p>
                    ) : null}
                    {evidenceSnapshot.selectedFileCount > 0 ? (
                      <p className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs font-semibold leading-5 text-amber-900 dark:border-amber-900 dark:bg-slate-950/40 dark:text-amber-200">Có {evidenceSnapshot.selectedFileCount.toLocaleString('vi-VN')} tệp chưa tải lên.</p>
                    ) : null}
                    <Button type="submit" className="mt-5 w-full justify-center" disabled={!maySubmit || submitting}>
                      {submitting ? <Lucide.LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Lucide.Send size={16} aria-hidden="true" />}
                      {submissionMode === 'resubmit' ? 'Gửi lại kết quả' : 'Gửi kết quả duyệt'}
                    </Button>
                  </aside>
                </div>
              </form>
            ) : (
              <OperationalState icon={Lucide.LockKeyhole} title="Chưa thể gửi kết quả" description={getUnavailableCopy()} />
            )}
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="admin-panel overflow-hidden" aria-labelledby="incident-resolution-history-title">
        <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-5 sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/55 dark:text-amber-300" aria-hidden="true"><Lucide.History size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="incident-resolution-history-title" className="admin-section-title">{readOnly ? 'Kết quả đã nhận' : currentStatus === 'needrework' ? 'Kết quả đã gửi trước đó' : 'Lịch sử gửi kết quả'}</h2>
            <p className="admin-section-description mt-1">{readOnly ? 'Khu vực này chỉ dùng để xem các kết quả đã gửi và minh chứng đi kèm. Mọi thao tác xử lý được thực hiện trong tab Xử lý.' : 'Các lần gửi luôn được giữ lại để đối chiếu.'}</p>
          </div>
          {state === RESOLUTION_STATE.READY ? <Badge intent="neutral">{resolutions.length.toLocaleString('vi-VN')} kết quả</Badge> : null}
        </header>
        {state === RESOLUTION_STATE.LOADING ? <ResolutionSkeleton /> : null}
        {state === RESOLUTION_STATE.API_UNAVAILABLE ? (
          <div className="p-5 sm:p-6"><OperationalState icon={Lucide.History} title="Lịch sử kết quả chưa khả dụng" /></div>
        ) : null}
        {state === RESOLUTION_STATE.ERROR ? (
          <div className="p-5 sm:p-6"><OperationalState icon={Lucide.CircleAlert} title="Không thể tải lịch sử kết quả" description={historyError} tone="danger" action={<Button type="button" variant="outline" size="sm" onClick={() => setRefreshVersion((current) => current + 1)}><Lucide.RefreshCw size={16} aria-hidden="true" />Thử lại</Button>} /></div>
        ) : null}
        {state === RESOLUTION_STATE.READY ? (
          <div className="p-5 sm:p-6">
            {sortedResolutions.length ? (
              <ol className="space-y-3" aria-label="Lịch sử kết quả xử lý">
                {sortedResolutions.map((resolution) => <ResolutionHistoryItem key={resolution?.resolutionId || resolution?.resolvedAt} resolution={resolution} />)}
              </ol>
            ) : (
              <OperationalState icon={Lucide.ClipboardList} title="Chưa có kết quả xử lý" description="Kết quả nhân viên gửi cho Manager sẽ xuất hiện tại đây." />
            )}
          </div>
        ) : null}
      </section>

      {!readOnly ? <StaffIncidentActionDialog
        open={dialogOpen}
        busy={submitting}
        title={submissionMode === 'resubmit' ? 'Gửi lại kết quả cho Manager?' : 'Gửi kết quả xử lý cho Manager?'}
        description={submissionMode === 'resubmit' ? 'Các cập nhật mới sẽ được gửi để Manager kiểm tra lại.' : 'Sau khi gửi, kết quả sẽ chuyển sang bước chờ Manager kiểm tra và phê duyệt.'}
        confirmLabel={submissionMode === 'resubmit' ? 'Gửi lại kết quả' : 'Gửi kết quả duyệt'}
        cancelLabel="Tiếp tục chỉnh sửa"
        icon={submissionMode === 'resubmit' ? Lucide.RotateCcw : Lucide.Send}
        onClose={() => { if (!submitting) setDialogOpen(false); }}
        onConfirm={submitResolution}
      >
        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"><dt className="font-semibold text-slate-500 dark:text-slate-400">Sự vụ</dt><dd className="break-words font-bold text-slate-900 dark:text-slate-100">{incident?.title || formatIncidentCode(incidentId)}</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"><dt className="font-semibold text-slate-500 dark:text-slate-400">Tóm tắt</dt><dd className="whitespace-pre-wrap break-words font-bold text-slate-900 dark:text-slate-100">{draft.resolutionSummary.trim() || EMPTY_VALUE}</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"><dt className="font-semibold text-slate-500 dark:text-slate-400">Đơn vị xử lý</dt><dd className="break-words font-bold text-slate-900 dark:text-slate-100">{providerSummary}</dd></div>
          <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"><dt className="font-semibold text-slate-500 dark:text-slate-400">Minh chứng</dt><dd className="font-bold text-slate-900 dark:text-slate-100">{evidenceSummary}</dd></div>
        </dl>
      </StaffIncidentActionDialog> : null}
    </div>
  );
}
