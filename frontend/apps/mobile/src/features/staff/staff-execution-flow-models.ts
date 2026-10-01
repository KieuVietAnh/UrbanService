import { normalizeKey } from './staff-models';

export type ExecutionMode = 'provider' | 'direct';
export type ExecutionStepId = 'provider' | 'start' | 'contact' | 'evidence' | 'resolution';
export type ExecutionStepState = 'done' | 'current' | 'upcoming' | 'skipped';

export type ExecutionDraft = {
  mode: ExecutionMode | null;
  activeStep: ExecutionStepId | null;
  selectedCoordinator: number | null;
  assignNote: string;
  contactMethod: string;
  contactResult: string;
  contactNote: string;
  contactedAt: string;
  evidenceDescription: string;
  resolutionSummary: string;
  actionTaken: string;
  resultNote: string;
  evidenceSkipped: boolean;
  updatedAt: string;
};

export type ExecutionStep = {
  id: ExecutionStepId;
  label: string;
  description: string;
  state: ExecutionStepState;
};

export const firstRouteParam = (value: string | string[] | undefined): string => (
  (Array.isArray(value) ? value[0] : value || '').trim()
);

export const emptyExecutionDraft = (): ExecutionDraft => ({
  mode: null,
  activeStep: null,
  selectedCoordinator: null,
  assignNote: '',
  contactMethod: '',
  contactResult: '',
  contactNote: '',
  contactedAt: '',
  evidenceDescription: '',
  resolutionSummary: '',
  actionTaken: '',
  resultNote: '',
  evidenceSkipped: false,
  updatedAt: '',
});

export const executionDraftKey = (userId: string, incidentId: string) => (
  `urbanmind:staff-execution:${userId.trim().toLowerCase()}:${incidentId.trim().toLowerCase()}`
);

export function parseExecutionDraft(value: string | null): ExecutionDraft {
  if (!value) return emptyExecutionDraft();
  try {
    const raw = JSON.parse(value) as Partial<ExecutionDraft>;
    const mode = raw.mode === 'provider' || raw.mode === 'direct' ? raw.mode : null;
    const validSteps: ExecutionStepId[] = ['provider', 'start', 'contact', 'evidence', 'resolution'];
    return {
      ...emptyExecutionDraft(),
      ...raw,
      mode,
      activeStep: validSteps.includes(raw.activeStep as ExecutionStepId) ? raw.activeStep as ExecutionStepId : null,
      selectedCoordinator: Number.isSafeInteger(raw.selectedCoordinator) && Number(raw.selectedCoordinator) > 0
        ? Number(raw.selectedCoordinator) : null,
      evidenceSkipped: raw.evidenceSkipped === true,
    };
  } catch {
    return emptyExecutionDraft();
  }
}

export function resolveExecutionMode(input: {
  hasAssignment: boolean;
  status: string;
  draftMode?: ExecutionMode | null;
}): ExecutionMode | null {
  if (input.hasAssignment) return 'provider';
  if (input.draftMode) return input.draftMode;
  return normalizeKey(input.status) === 'assigned' ? null : 'direct';
}

const stateFor = (index: number, currentIndex: number, skipped: boolean): ExecutionStepState => {
  if (skipped) return 'skipped';
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return 'current';
  return 'upcoming';
};

export function buildExecutionSteps(input: {
  mode: ExecutionMode;
  status: string;
  hasAssignment: boolean;
  contactCount: number;
  evidenceCount: number;
  resolutionCount: number;
  activeStep?: ExecutionStepId | null;
  evidenceSkipped?: boolean;
}): ExecutionStep[] {
  const status = normalizeKey(input.status);
  const isRework = status === 'needrework';
  const isSubmitted = ['submittedforapproval', 'resolved', 'closed'].includes(status);
  const ids: ExecutionStepId[] = input.mode === 'provider'
    ? ['provider', 'contact', 'evidence', 'resolution']
    : ['start', 'evidence', 'resolution'];
  let current: ExecutionStepId = input.mode === 'provider' ? 'provider' : 'start';
  if (isSubmitted || (input.resolutionCount > 0 && !isRework)) current = 'resolution';
  else if (isRework) current = input.activeStep === 'resolution' ? 'resolution' : 'evidence';
  else if (input.mode === 'provider') {
    if (!input.hasAssignment || status === 'assigned') current = 'provider';
    else if (input.contactCount === 0) current = 'contact';
    else if (input.evidenceCount === 0 && !input.evidenceSkipped) current = 'evidence';
    else current = 'resolution';
  } else if (status === 'assigned') current = 'start';
  else if (input.activeStep === 'resolution' || input.evidenceSkipped) current = 'resolution';
  else current = 'evidence';
  if (input.activeStep && ids.includes(input.activeStep)) {
    const inferred = ids.indexOf(current);
    const saved = ids.indexOf(input.activeStep);
    if (saved > inferred || isRework) current = input.activeStep;
  }
  const currentIndex = ids.indexOf(current);
  const copy: Record<ExecutionStepId, [string, string]> = {
    provider: ['Phân công & bắt đầu', 'Chọn đúng đơn vị và chuyển sự vụ sang đang xử lý'],
    start: ['Xác nhận tự xử lý', 'Nhận xử lý trực tiếp tại hiện trường hoặc trên hệ thống'],
    contact: ['Liên hệ đơn vị', 'Ghi lại phương thức và kết quả trao đổi'],
    evidence: ['Minh chứng', input.mode === 'provider' ? 'Tải ảnh hoặc tài liệu; có thể bỏ qua' : 'Tùy chọn khi tự xử lý'],
    resolution: ['Gửi kết quả', 'Tóm tắt công việc để Manager xem xét'],
  };
  return ids.map((id, index) => ({
    id,
    label: copy[id][0],
    description: copy[id][1],
    state: isSubmitted && id === 'resolution' ? 'done' : stateFor(index, currentIndex, id === 'evidence' && !!input.evidenceSkipped),
  }));
}

export const currentExecutionStep = (steps: ExecutionStep[]) => (
  steps.find((step) => step.state === 'current')?.id || steps.at(-1)?.id || 'resolution'
);
