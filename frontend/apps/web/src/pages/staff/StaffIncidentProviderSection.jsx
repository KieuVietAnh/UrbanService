import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { extractApiErrorMessage, incidentManagementApi } from '@urbanmind/shared-api';

import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import EmptyState from '../../components/design-system/EmptyState';
import StaffIncidentActionDialog from './StaffIncidentActionDialog';
import StaffIncidentProgressSection from './StaffIncidentProgressSection';
import {
  EMPTY_VALUE,
  formatOperationalDateTime,
} from './incidentDetailPresentation';
import {
  canManageIncidentExecution,
  getProviderStatusIntent,
  getProviderStatusLabel,
} from './staffIncidentProcessing';
import {
  STAFF_INCIDENT_FLOW_TARGETS,
  scrollToStaffIncidentFlowTarget,
} from './staffIncidentFlowNavigation';

const PROVIDER_STATE = Object.freeze({
  LOADING: 'loading',
  CHOICE: 'choice',
  DIRECT: 'direct',
  CANDIDATES: 'candidates',
  ASSIGNED: 'assigned',
  EMPTY: 'empty',
  RESTRICTED: 'restricted',
  API_UNAVAILABLE: 'api-unavailable',
  ERROR: 'error',
});

const sameIdentifier = (left, right) => (
  Boolean(String(left ?? '').trim() && String(right ?? '').trim())
  && String(left).trim().toLowerCase() === String(right).trim().toLowerCase()
);

const normalizeStatus = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const readExecutionMode = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'provider' || value === 'direct' ? value : null;
  } catch {
    return null;
  }
};

const readProviderDraft = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return { coordinatorId: null, note: '' };
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    const coordinatorId = Number(value?.coordinatorId);
    return {
      coordinatorId: Number.isSafeInteger(coordinatorId) && coordinatorId > 0 ? coordinatorId : null,
      note: typeof value?.note === 'string' ? value.note : '',
    };
  } catch {
    return { coordinatorId: null, note: '' };
  }
};

const getCoordinatorId = (candidate) => {
  const value = Number(candidate?.coordinatorId);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

const getCandidateName = (candidate) => (
  String(candidate?.providerName ?? '').trim()
  || String(candidate?.coordinatorName ?? '').trim()
  || 'Đơn vị chưa có tên'
);

const getActionErrorMessage = (error, fallback) => {
  if (!error?.response && !error?.status && !error?.code && String(error?.message ?? '').trim()) {
    return String(error.message).trim();
  }
  return extractApiErrorMessage(error, fallback);
};

function ProviderSkeleton() {
  return (
    <div className="space-y-3 p-5 sm:p-6" aria-busy="true" aria-label="Đang tải đơn vị xử lý">
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
        <div className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </div>
  );
}

function ProviderCandidateCard({ candidate, disabled, onSelect, selected }) {
  const coordinatorId = getCoordinatorId(candidate);
  const providerName = getCandidateName(candidate);

  return (
    <label className={`group relative block min-w-0 rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-blue-100 dark:focus-within:ring-blue-950 ${selected ? 'border-blue-400 bg-blue-50/65 shadow-[0_14px_30px_rgba(37,99,235,0.1)] dark:border-blue-700 dark:bg-blue-950/25' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/25 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900'}`}>
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${selected ? 'bg-blue-600' : 'bg-transparent'}`} aria-hidden="true" />
      <span className="flex items-start gap-3">
        <input
          type="radio"
          name="incident-provider"
          value={coordinatorId || ''}
          checked={selected}
          disabled={disabled || !coordinatorId}
          onChange={() => coordinatorId && onSelect(coordinatorId)}
          className="sr-only"
        />
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${selected ? 'bg-blue-600 text-white ring-blue-600' : 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/45 dark:text-blue-300 dark:ring-blue-900'}`} aria-hidden="true">
          <Lucide.Building2 size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <strong className="break-words text-sm leading-6 text-slate-950 dark:text-white">{providerName}</strong>
            {candidate?.isPrimary ? <Badge intent="success">Ưu tiên chính</Badge> : null}
          </span>
          <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Đầu mối: {String(candidate?.coordinatorName ?? '').trim() || EMPTY_VALUE}
          </span>
        </span>
      </span>

      <dl className="mt-4 grid gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="font-semibold text-slate-500 dark:text-slate-400">Liên hệ</dt>
          <dd className="mt-1 break-words font-bold text-slate-800 dark:text-slate-100">
            {candidate?.phoneNumber || candidate?.email || EMPTY_VALUE}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold text-slate-500 dark:text-slate-400">Hợp đồng</dt>
          <dd className="mt-1 break-words font-bold text-slate-800 dark:text-slate-100">
            {candidate?.contractName || candidate?.contractCode || EMPTY_VALUE}
          </dd>
        </div>
      </dl>
    </label>
  );
}

function CurrentProvider({ assignment }) {
  return (
    <div className="p-5 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <article className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/65 p-5 dark:border-emerald-900/70 dark:bg-emerald-950/25">
          <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_10px_22px_rgba(5,150,105,0.2)]" aria-hidden="true">
              <Lucide.Building2 size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">Đơn vị đang xử lý</p>
              <h3 className="mt-1 break-words text-base font-black leading-6 text-slate-950 dark:text-white">
                {assignment?.providerName || 'Đơn vị chưa có tên'}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Đầu mối: {assignment?.coordinatorName || EMPTY_VALUE}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Badge intent={getProviderStatusIntent(assignment?.reportStatus)}>
              Trạng thái đơn vị: {getProviderStatusLabel(assignment?.reportStatus)}
            </Badge>
          </div>
        </article>

        <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
          {[
            ['Điện thoại', assignment?.phoneNumber],
            ['Email', assignment?.email],
            ['Địa chỉ', assignment?.address],
            ['Người phân công', assignment?.assignedByStaffUserName],
            ['Phân công lúc', formatOperationalDateTime(assignment?.assignedAt)],
            ['Cập nhật gần nhất', formatOperationalDateTime(assignment?.updatedAt)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/65">
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="mt-1 break-words font-bold leading-5 text-slate-900 dark:text-slate-100">{value || EMPTY_VALUE}</dd>
            </div>
          ))}
        </dl>
      </div>

      {assignment?.note ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/55 p-4 text-sm leading-6 text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-slate-200">
          <Lucide.NotebookPen className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300" size={17} aria-hidden="true" />
          <p><strong>Ghi chú phân công:</strong> {assignment.note}</p>
        </div>
      ) : null}

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        <Lucide.LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Mỗi sự vụ chỉ có một đơn vị xử lý và không thể thay đổi sau khi phân công.
      </p>
    </div>
  );
}

function ExecutionModeCard({ description, details, icon: Icon, onSelect, selected, title }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`min-h-40 rounded-2xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-950 ${selected ? 'border-blue-500 bg-blue-50 shadow-[0_14px_30px_rgba(37,99,235,0.1)] dark:border-blue-700 dark:bg-blue-950/30' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800'}`}
    >
      <span className="flex items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`} aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="min-w-0">
          <strong className="block text-base font-black text-slate-950 dark:text-white">{title}</strong>
          <span className="mt-1.5 block text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</span>
          <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{details}</span>
        </span>
      </span>
    </button>
  );
}

export default function StaffIncidentProviderSection({ incident, onIncidentUpdated, user }) {
  const incidentId = String(incident?.incidentId ?? '').trim();
  const currentUserId = String(user?.userId ?? user?.id ?? '').trim().toLowerCase();
  const modeStorageKey = incidentId && currentUserId
    ? `urbanmind:staff-execution-mode:${currentUserId}:${incidentId.toLowerCase()}`
    : '';
  const providerDraftKey = incidentId && currentUserId
    ? `urbanmind:staff-provider-draft:${currentUserId}:${incidentId.toLowerCase()}`
    : '';
  const capability = incidentManagementApi.capabilities.providerAssignment;
  const canManage = canManageIncidentExecution(incident, user);
  const [executionMode, setExecutionMode] = useState(() => readExecutionMode(modeStorageKey));
  const [flowOpen, setFlowOpen] = useState(() => Boolean(readExecutionMode(modeStorageKey)));
  const [state, setState] = useState(capability.available ? PROVIDER_STATE.LOADING : PROVIDER_STATE.API_UNAVAILABLE);
  const [assignment, setAssignment] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState(
    () => readProviderDraft(providerDraftKey).coordinatorId,
  );
  const [assignmentNote, setAssignmentNote] = useState(
    () => readProviderDraft(providerDraftKey).note,
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [directDialogOpen, setDirectDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const sortedCandidates = useMemo(() => [...candidates].sort((left, right) => {
    if (Boolean(left?.isPrimary) !== Boolean(right?.isPrimary)) return left?.isPrimary ? -1 : 1;
    return Number(left?.priorityOrder || 0) - Number(right?.priorityOrder || 0);
  }), [candidates]);
  const selectedCandidate = useMemo(
    () => sortedCandidates.find((candidate) => getCoordinatorId(candidate) === selectedCoordinatorId) || null,
    [selectedCoordinatorId, sortedCandidates],
  );

  useEffect(() => {
    const savedMode = readExecutionMode(modeStorageKey);
    setExecutionMode(savedMode);
    setFlowOpen(Boolean(savedMode) || normalizeStatus(incident?.status) !== 'assigned');
  }, [incident?.status, incidentId, modeStorageKey]);

  useEffect(() => {
    const savedDraft = readProviderDraft(providerDraftKey);
    setSelectedCoordinatorId(savedDraft.coordinatorId);
    setAssignmentNote(savedDraft.note);
  }, [providerDraftKey]);

  useEffect(() => {
    if (!providerDraftKey || typeof window === 'undefined') return;
    try {
      if (selectedCoordinatorId || assignmentNote.trim()) {
        window.localStorage.setItem(providerDraftKey, JSON.stringify({
          coordinatorId: selectedCoordinatorId,
          note: assignmentNote,
        }));
      } else {
        window.localStorage.removeItem(providerDraftKey);
      }
    } catch {
      // Draft persistence is optional; the selection remains available in memory.
    }
  }, [assignmentNote, providerDraftKey, selectedCoordinatorId]);

  const chooseExecutionMode = useCallback((mode) => {
    setExecutionMode(mode);
    setFlowOpen(true);
    setMessage({ type: '', text: '' });
    try {
      if (modeStorageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(modeStorageKey, mode);
      }
    } catch {
      // The flow still works when browser storage is unavailable.
    }
  }, [modeStorageKey]);

  const resetExecutionMode = useCallback(() => {
    setExecutionMode(null);
    setFlowOpen(true);
    setAssignment(null);
    setCandidates([]);
    setState(PROVIDER_STATE.CHOICE);
    setMessage({ type: '', text: '' });
    try {
      if (modeStorageKey && typeof window !== 'undefined') {
        window.localStorage.removeItem(modeStorageKey);
      }
    } catch {
      // The visible choice remains available when browser storage is unavailable.
    }
  }, [modeStorageKey]);

  useEffect(() => {
    if (!capability.available || !incidentId) {
      setState(PROVIDER_STATE.API_UNAVAILABLE);
      return undefined;
    }

    const controller = new AbortController();
    const load = async () => {
      setState(PROVIDER_STATE.LOADING);
      setMessage({ type: '', text: '' });
      try {
        const currentAssignment = await incidentManagementApi.getIncidentProviderAssignment(
          incidentId,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;

        if (currentAssignment) {
          if (!sameIdentifier(currentAssignment?.incidentId, incidentId)) {
            throw new Error('Dữ liệu đơn vị xử lý không thuộc sự vụ đang mở.');
          }
          setAssignment(currentAssignment);
          setCandidates([]);
          setState(PROVIDER_STATE.ASSIGNED);
          return;
        }

        setAssignment(null);
        const incidentStatus = normalizeStatus(incident?.status);
        if (!canManage && ['submittedforapproval', 'approved', 'resolved', 'closed'].includes(incidentStatus)) {
          setCandidates([]);
          setState(PROVIDER_STATE.DIRECT);
          return;
        }
        if (!canManage) {
          setCandidates([]);
          setState(PROVIDER_STATE.RESTRICTED);
          return;
        }

        const resolvedMode = executionMode || (incidentStatus === 'assigned' ? null : 'direct');
        if (!resolvedMode) {
          setCandidates([]);
          setState(PROVIDER_STATE.CHOICE);
          return;
        }
        if (resolvedMode === 'direct') {
          setCandidates([]);
          setState(PROVIDER_STATE.DIRECT);
          return;
        }

        const result = await incidentManagementApi.getIncidentProviderCandidates(
          incidentId,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setCandidates(result);
        setSelectedCoordinatorId((current) => (
          result.some((candidate) => getCoordinatorId(candidate) === current) ? current : null
        ));
        setState(result.length > 0 ? PROVIDER_STATE.CANDIDATES : PROVIDER_STATE.EMPTY);
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') return;
        setAssignment(null);
        setCandidates([]);
        const status = Number(error?.status ?? error?.response?.status);
        setState([404, 405].includes(status) ? PROVIDER_STATE.API_UNAVAILABLE : PROVIDER_STATE.ERROR);
        setMessage({
          type: 'error',
          text: getActionErrorMessage(error, 'Không thể tải thông tin đơn vị xử lý.'),
        });
      }
    };

    void load();
    return () => controller.abort();
  }, [canManage, capability.available, executionMode, incident?.status, incidentId, refreshVersion]);

  const retry = useCallback(() => setRefreshVersion((current) => current + 1), []);
  const closeDialog = useCallback(() => {
    if (!submitting) setDialogOpen(false);
  }, [submitting]);

  const assignProvider = async () => {
    if (!selectedCandidate || submitting) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const latestIncident = await incidentManagementApi.getIncidentById(incidentId);
      if (!latestIncident || !canManageIncidentExecution(latestIncident, user)) {
        throw new Error('Sự vụ không còn được phân công cho bạn hoặc không còn ở trạng thái cho phép phân công đơn vị.');
      }

      const existingAssignment = await incidentManagementApi.getIncidentProviderAssignment(incidentId);
      if (existingAssignment) {
        setAssignment(existingAssignment);
        setCandidates([]);
        setState(PROVIDER_STATE.ASSIGNED);
        throw new Error('Sự vụ đã có đơn vị xử lý. Dữ liệu mới nhất đã được tải lại.');
      }

      const createdAssignment = await incidentManagementApi.assignIncidentProvider(incidentId, {
        coordinatorId: getCoordinatorId(selectedCandidate),
        note: assignmentNote,
      });
      if (!createdAssignment || !sameIdentifier(createdAssignment?.incidentId, incidentId)) {
        throw new Error('Dữ liệu phân công không thuộc sự vụ đang mở.');
      }

      let activeAssignment = createdAssignment;
      if (normalizeStatus(latestIncident?.status) === 'assigned') {
        activeAssignment = await incidentManagementApi.updateProviderAssignmentStatus(
          createdAssignment.providerAssignmentId,
          { status: 'InProgress', note: 'Staff bắt đầu xử lý theo flow hướng dẫn.' },
        );
      }
      if (!activeAssignment || !sameIdentifier(activeAssignment?.incidentId, incidentId)) {
        throw new Error('Chưa thể xác nhận trạng thái bắt đầu xử lý của đơn vị.');
      }

      setAssignment(activeAssignment);
      setCandidates([]);
      setSelectedCoordinatorId(null);
      setAssignmentNote('');
      try {
        if (providerDraftKey && typeof window !== 'undefined') {
          window.localStorage.removeItem(providerDraftKey);
        }
      } catch {
        // The successful backend mutation is authoritative even if local cleanup fails.
      }
      setState(PROVIDER_STATE.ASSIGNED);
      setDialogOpen(false);
      setMessage({ type: 'success', text: 'Đã phân công và bắt đầu xử lý. Tiếp theo, hãy ghi lại lần liên hệ với đơn vị.' });
      const refreshedIncident = await incidentManagementApi.getIncidentById(incidentId);
      if (refreshedIncident && sameIdentifier(refreshedIncident?.incidentId, incidentId)) {
        onIncidentUpdated?.(refreshedIncident);
      }
      scrollToStaffIncidentFlowTarget(STAFF_INCIDENT_FLOW_TARGETS.CONTACT);
    } catch (error) {
      setDialogOpen(false);
      setMessage({
        type: 'error',
        text: getActionErrorMessage(error, 'Không thể phân công đơn vị xử lý.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startDirectProcessing = async () => {
    if (submitting || executionMode !== 'direct') return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const [latestIncident, existingAssignment] = await Promise.all([
        incidentManagementApi.getIncidentById(incidentId),
        incidentManagementApi.getIncidentProviderAssignment(incidentId),
      ]);
      if (existingAssignment) {
        chooseExecutionMode('provider');
        setAssignment(existingAssignment);
        setState(PROVIDER_STATE.ASSIGNED);
        throw new Error('Sự vụ đã có đơn vị xử lý. Flow đã chuyển sang phối hợp đơn vị.');
      }
      if (!latestIncident || !canManageIncidentExecution(latestIncident, user)
        || normalizeStatus(latestIncident?.status) !== 'assigned') {
        throw new Error('Sự vụ không còn ở trạng thái cho phép bắt đầu tự xử lý.');
      }
      const updatedIncident = await incidentManagementApi.startIncidentProcessing(incidentId, {
        note: 'Staff xác nhận tự xử lý sự vụ.',
      });
      if (!updatedIncident || !sameIdentifier(updatedIncident?.incidentId, incidentId)) {
        throw new Error('Chưa thể xác nhận trạng thái bắt đầu xử lý.');
      }
      setDirectDialogOpen(false);
      setState(PROVIDER_STATE.DIRECT);
      setMessage({ type: 'success', text: 'Đã bắt đầu tự xử lý. Tiếp theo, hãy bổ sung minh chứng (nếu có) và gửi kết quả.' });
      onIncidentUpdated?.(updatedIncident);
      scrollToStaffIncidentFlowTarget(STAFF_INCIDENT_FLOW_TARGETS.RESOLUTION);
    } catch (error) {
      setDirectDialogOpen(false);
      setMessage({ type: 'error', text: getActionErrorMessage(error, 'Không thể bắt đầu tự xử lý sự vụ.') });
    } finally {
      setSubmitting(false);
    }
  };

  const stateContent = {
    [PROVIDER_STATE.EMPTY]: {
      icon: Lucide.Building2,
      title: 'Không có đơn vị xử lý phù hợp',
      description: 'Hiện chưa có đơn vị nào phù hợp với khu vực và danh mục của sự vụ.',
    },
    [PROVIDER_STATE.RESTRICTED]: {
      icon: Lucide.ShieldAlert,
      title: 'Bạn không thể phân công đơn vị xử lý',
      description: 'Chỉ Staff đang phụ trách mới có thể chọn đơn vị cho sự vụ ở trạng thái xử lý phù hợp.',
    },
    [PROVIDER_STATE.API_UNAVAILABLE]: {
      icon: Lucide.Building2,
      title: 'Danh sách đơn vị xử lý chưa khả dụng',
      description: 'Chưa thể tải các đơn vị xử lý phù hợp lúc này.',
    },
    [PROVIDER_STATE.ERROR]: {
      icon: Lucide.TriangleAlert,
      title: 'Không thể tải danh sách đơn vị xử lý',
      description: message.text || 'Không thể tải danh sách đơn vị xử lý.',
      action: (
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          <Lucide.RefreshCw size={16} aria-hidden="true" />
          Thử lại
        </Button>
      ),
    },
  }[state];

  return (
    <>
      <section className="admin-panel overflow-hidden" aria-labelledby="incident-provider-title">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-300" aria-hidden="true">
            <Lucide.Building2 size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="incident-provider-title" className="admin-section-title">Bắt đầu · Chọn cách xử lý</h2>
            <p className="admin-section-description mt-1">Chọn cách xử lý một lần; hệ thống sẽ dẫn tiếp qua liên hệ, minh chứng và gửi kết quả.</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Lucide.UserRoundCheck size={13} aria-hidden="true" />
          Staff phụ trách: {incident?.assignedStaffName || EMPTY_VALUE}
        </span>
      </header>

      {message.text && state !== PROVIDER_STATE.ERROR ? (
        <div className={`mx-5 mt-5 flex items-start gap-3 rounded-2xl border p-4 sm:mx-6 ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100'}`} role={message.type === 'success' ? 'status' : 'alert'}>
          {message.type === 'success' ? <Lucide.CircleCheckBig className="mt-0.5 shrink-0" size={18} aria-hidden="true" /> : <Lucide.CircleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />}
          <p className="text-sm font-bold leading-6">{message.text}</p>
        </div>
      ) : null}

      {state === PROVIDER_STATE.LOADING ? <ProviderSkeleton /> : null}
      {state === PROVIDER_STATE.ASSIGNED ? <CurrentProvider assignment={assignment} /> : null}
      {stateContent ? <div className="p-5 sm:p-6"><EmptyState {...stateContent} /></div> : null}

      {state === PROVIDER_STATE.CHOICE && !flowOpen ? (
        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/65 p-5 dark:border-blue-900 dark:bg-blue-950/25 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="flex min-w-0 items-start gap-3">
              <Lucide.Route className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300" size={20} aria-hidden="true" />
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white">Sẵn sàng xử lý sự vụ?</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Bạn sẽ chọn phối hợp đơn vị hoặc tự xử lý, rồi tiếp tục trong một flow duy nhất.</p>
              </div>
            </div>
            <Button type="button" className="mt-4 w-full justify-center sm:mt-0 sm:w-auto" onClick={() => setFlowOpen(true)}>
              <Lucide.Play size={16} aria-hidden="true" />
              Bắt đầu xử lý
            </Button>
          </div>
        </div>
      ) : null}

      {state === PROVIDER_STATE.CHOICE && flowOpen ? (
        <div className="p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-950 dark:text-white">Bạn sẽ xử lý theo cách nào?</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Lựa chọn này được lưu để khi rời trang, bạn có thể quay lại đúng flow đang làm dở.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2" role="radiogroup" aria-label="Chọn cách xử lý sự vụ">
            <ExecutionModeCard
              title="Phối hợp đơn vị"
              description="Phân công đơn vị phù hợp, bắt đầu xử lý và ghi lại lần liên hệ."
              details="Phù hợp khi cần nhà cung cấp, đội kỹ thuật hoặc đầu mối bên ngoài."
              icon={Lucide.Building2}
              selected={executionMode === 'provider'}
              onSelect={() => chooseExecutionMode('provider')}
            />
            <ExecutionModeCard
              title="Tự xử lý"
              description="Staff trực tiếp tiếp nhận và xử lý mà không cần phân công đơn vị."
              details="Phù hợp với tác vụ nghiệp vụ, xác minh hoặc khắc phục trong phạm vi của Staff."
              icon={Lucide.UserRoundCheck}
              selected={executionMode === 'direct'}
              onSelect={() => chooseExecutionMode('direct')}
            />
          </div>
        </div>
      ) : null}

      {state === PROVIDER_STATE.DIRECT ? (
        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/65 p-5 dark:border-violet-900 dark:bg-violet-950/25">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white" aria-hidden="true"><Lucide.UserRoundCheck size={20} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-950 dark:text-white">Staff tự xử lý trực tiếp</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{normalizeStatus(incident?.status) === 'assigned' ? 'Không tạo phân công đơn vị. Sau khi bắt đầu, bạn tiếp tục ngay tới minh chứng và gửi kết quả.' : 'Sự vụ được Staff xử lý trực tiếp, không thông qua phân công đơn vị.'}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {normalizeStatus(incident?.status) === 'assigned' ? (
                <Button type="button" variant="outline" disabled={submitting} onClick={resetExecutionMode}>Đổi cách xử lý</Button>
              ) : null}
              {normalizeStatus(incident?.status) === 'assigned' ? (
                <Button type="button" disabled={submitting} onClick={() => setDirectDialogOpen(true)}>
                  <Lucide.Play size={16} aria-hidden="true" />
                  Xác nhận tự xử lý
                </Button>
              ) : (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-100 px-3.5 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200">
                  <Lucide.CircleCheckBig size={16} aria-hidden="true" /> Đã bắt đầu tự xử lý
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {state === PROVIDER_STATE.CANDIDATES ? (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/55 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
            <Lucide.ScanSearch className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300" size={18} aria-hidden="true" />
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white">Chưa có đơn vị xử lý</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Các đơn vị dưới đây phù hợp với {incident?.areaName || EMPTY_VALUE} · {incident?.categoryName || EMPTY_VALUE}.
              </p>
            </div>
          </div>

          <div className="mb-4 flex justify-end">
            <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={resetExecutionMode}>
              <Lucide.ArrowLeftRight size={16} aria-hidden="true" />
              Đổi cách xử lý
            </Button>
          </div>

          <fieldset className="grid gap-3 lg:grid-cols-2" disabled={submitting}>
            <legend className="sr-only">Chọn đơn vị xử lý sự vụ</legend>
            {sortedCandidates.map((candidate) => {
              const coordinatorId = getCoordinatorId(candidate);
              return (
                <ProviderCandidateCard
                  key={coordinatorId || `${candidate?.providerName}-${candidate?.coordinatorName}`}
                  candidate={candidate}
                  disabled={submitting}
                  selected={selectedCoordinatorId === coordinatorId}
                  onSelect={setSelectedCoordinatorId}
                />
              );
            })}
          </fieldset>

          <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/65 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end dark:border-slate-800 dark:bg-slate-950/30">
            <label className="min-w-0 text-sm font-bold text-slate-700 dark:text-slate-200" htmlFor="incident-provider-note">
              Ghi chú phân công <span className="font-medium text-slate-400">(không bắt buộc)</span>
              <textarea
                id="incident-provider-note"
                value={assignmentNote}
                onChange={(event) => setAssignmentNote(event.target.value)}
                rows={2}
                placeholder="Thông tin cần lưu ý khi phối hợp xử lý..."
                className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-blue-950"
              />
            </label>
            <Button
              type="button"
              className="min-h-11 shrink-0 whitespace-nowrap"
              disabled={!selectedCandidate || submitting}
              onClick={() => setDialogOpen(true)}
            >
              <Lucide.Play size={16} aria-hidden="true" />
              Phân công &amp; bắt đầu
            </Button>
          </div>
        </div>
      ) : null}

        <StaffIncidentActionDialog
          open={dialogOpen}
          busy={submitting}
          title="Phân công và bắt đầu xử lý?"
          description="Hệ thống sẽ phân công đơn vị đã chọn và chuyển ngay sự vụ sang Đang xử lý. Sau đó bạn tiếp tục ghi nhận liên hệ trong cùng flow."
          icon={Lucide.Building2}
          confirmLabel="Phân công & bắt đầu"
          onClose={closeDialog}
          onConfirm={assignProvider}
        >
          <dl className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/65">
            {[
              ['Sự vụ', incident?.title || incidentId],
              ['Đơn vị', selectedCandidate ? getCandidateName(selectedCandidate) : EMPTY_VALUE],
              ['Phường / Khu vực', incident?.areaName || EMPTY_VALUE],
              ['Danh mục', incident?.categoryName || EMPTY_VALUE],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                <dt className="font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="break-words font-bold text-slate-900 dark:text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </StaffIncidentActionDialog>

        <StaffIncidentActionDialog
          open={directDialogOpen}
          busy={submitting}
          title="Xác nhận tự xử lý sự vụ?"
          description="Sự vụ sẽ chuyển sang Đang xử lý mà không tạo phân công đơn vị. Bạn sẽ tiếp tục tới minh chứng và gửi kết quả."
          icon={Lucide.UserRoundCheck}
          confirmLabel="Bắt đầu tự xử lý"
          onClose={() => { if (!submitting) setDirectDialogOpen(false); }}
          onConfirm={startDirectProcessing}
        >
          <div className="rounded-2xl border border-violet-200 bg-violet-50/65 p-4 text-sm leading-6 text-slate-700 dark:border-violet-900 dark:bg-violet-950/25 dark:text-slate-200">
            <strong className="block text-slate-950 dark:text-white">{incident?.title || incidentId}</strong>
            Staff hiện tại chịu trách nhiệm xử lý và gửi kết quả trực tiếp cho Manager.
          </div>
        </StaffIncidentActionDialog>
      </section>

      {state === PROVIDER_STATE.ASSIGNED ? (
        <StaffIncidentProgressSection
          assignment={assignment}
          incident={incident}
          onAssignmentUpdated={setAssignment}
          onIncidentUpdated={onIncidentUpdated}
          user={user}
        />
      ) : null}
    </>
  );
}
