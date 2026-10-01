import { asRecord, asText, normalizeKey, type DataRecord } from './staff-models';

export type ProviderCandidate = {
  coordinatorId: number; providerName: string; coordinatorName: string; phoneNumber: string;
  email: string; address: string; note: string; isPrimary: boolean; priorityOrder: number;
  contractId: number | null; contractCode: string; contractName: string; contractStatus: string;
};

export type ProviderAssignment = {
  providerAssignmentId: number; incidentId: string; coordinatorId: number;
  providerName: string; coordinatorName: string; phoneNumber: string; email: string; address: string; note: string;
  assignedByStaffUserId: string; assignedByStaffUserName: string;
  reportStatus: string; reportNote: string; dueDate: string; assignedAt: string; updatedAt: string;
  contactLogCount: number; completionDocumentCount: number;
};

export type ProviderContact = {
  contactLogId: number; providerAssignmentId: number; coordinatorId: number;
  providerName: string; coordinatorName: string; phoneNumber: string; email: string; address: string; note: string;
  contactedByUserId: string; contactedByUserName: string;
  contactMethod: string; contactResult: string; contactNote: string; contactedAt: string;
};

export type CompletionEvidence = {
  completionDocumentId: number; providerAssignmentId: number; incidentId: string; coordinatorId: number;
  providerName: string; uploadedByUserId: string; uploadedByUserName: string;
  fileUrl: string; fileType: string; description: string; receivedAt: string;
};

export type IncidentResolution = {
  resolutionId: number; incidentId: string; providerAssignmentId: number | null;
  createdByStaffUserId: string; createdByStaffUserName: string;
  resolutionSummary: string; actionTaken: string; resultNote: string; resolvedAt: string; status: string;
  completionDocuments: CompletionEvidence[];
};

export type AssignProviderPayload = { coordinatorId: number; note?: string };
export type AddProviderContactPayload = { contactMethod: string; contactResult: string; contactNote?: string; contactedAt?: string };
export type UpdateProviderStatusPayload = { status: string; note?: string };
export type StartProviderAssignmentProcessingPayload = { note?: string };
export type SubmitIncidentResolutionPayload = {
  providerAssignmentId?: number; resolutionSummary: string; actionTaken: string; resultNote?: string; imageUrls?: string[];
};
export type EvidenceUploadAsset = { uri: string; name: string; mimeType?: string; file?: Blob };

export function requireExecutionId(value: unknown, label = 'Mã dữ liệu'): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 2147483647) throw new Error(`${label} không hợp lệ.`);
  return parsed;
}

export function requireIncidentId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Thiếu mã sự vụ.');
  return value.trim();
}

const nonnegativeCount = (value: unknown) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
};
const text = (raw: DataRecord, key: string) => asText(raw[key]);
const contactDetails = (raw: DataRecord) => ({
  coordinatorId: requireExecutionId(raw.coordinatorId, 'Mã điều phối viên'),
  providerName: text(raw, 'providerName'), coordinatorName: text(raw, 'coordinatorName'),
  phoneNumber: text(raw, 'phoneNumber'), email: text(raw, 'email'), address: text(raw, 'address'), note: text(raw, 'note'),
});

export function normalizeProviderCandidate(value: unknown): ProviderCandidate {
  const raw = asRecord(value);
  return {
    ...contactDetails(raw), isPrimary: raw.isPrimary === true, priorityOrder: nonnegativeCount(raw.priorityOrder),
    contractId: raw.contractId === null || raw.contractId === undefined ? null : requireExecutionId(raw.contractId, 'Mã hợp đồng'),
    contractCode: text(raw, 'contractCode'), contractName: text(raw, 'contractName'), contractStatus: text(raw, 'contractStatus'),
  };
}

export function normalizeProviderAssignment(value: unknown): ProviderAssignment {
  const raw = asRecord(value);
  return {
    ...contactDetails(raw),
    providerAssignmentId: requireExecutionId(raw.providerAssignmentId, 'Mã phân công đơn vị'), incidentId: requireIncidentId(raw.incidentId),
    assignedByStaffUserId: text(raw, 'assignedByStaffUserId'), assignedByStaffUserName: text(raw, 'assignedByStaffUserName'),
    reportStatus: text(raw, 'reportStatus'), reportNote: text(raw, 'reportNote'), dueDate: text(raw, 'dueDate'),
    assignedAt: text(raw, 'assignedAt'), updatedAt: text(raw, 'updatedAt'),
    contactLogCount: nonnegativeCount(raw.contactLogCount), completionDocumentCount: nonnegativeCount(raw.completionDocumentCount),
  };
}

export function normalizeProviderContact(value: unknown): ProviderContact {
  const raw = asRecord(value);
  return {
    ...contactDetails(raw), contactLogId: requireExecutionId(raw.contactLogId, 'Mã lịch sử liên hệ'),
    providerAssignmentId: requireExecutionId(raw.providerAssignmentId, 'Mã phân công đơn vị'),
    contactedByUserId: text(raw, 'contactedByUserId'), contactedByUserName: text(raw, 'contactedByUserName'),
    contactMethod: text(raw, 'contactMethod'), contactResult: text(raw, 'contactResult'),
    contactNote: text(raw, 'contactNote'), contactedAt: text(raw, 'contactedAt'),
  };
}

export function normalizeCompletionEvidence(value: unknown): CompletionEvidence {
  const raw = asRecord(value);
  const fileUrl = text(raw, 'fileUrl');
  return {
    completionDocumentId: requireExecutionId(raw.completionDocumentId, 'Mã minh chứng'),
    providerAssignmentId: requireExecutionId(raw.providerAssignmentId, 'Mã phân công đơn vị'),
    incidentId: requireIncidentId(raw.incidentId), coordinatorId: requireExecutionId(raw.coordinatorId, 'Mã điều phối viên'),
    providerName: text(raw, 'providerName'), uploadedByUserId: text(raw, 'uploadedByUserId'), uploadedByUserName: text(raw, 'uploadedByUserName'),
    // Only trusted URL schemes may be handed to Linking or rendered as remote images.
    fileUrl: /^https?:\/\//i.test(fileUrl) ? fileUrl : '', fileType: text(raw, 'fileType'),
    description: text(raw, 'description'), receivedAt: text(raw, 'receivedAt'),
  };
}

export function normalizeIncidentResolution(value: unknown): IncidentResolution {
  const raw = asRecord(value);
  const incidentId = requireIncidentId(raw.incidentId);
  const providerAssignmentId = raw.providerAssignmentId === null || raw.providerAssignmentId === undefined
    ? null : requireExecutionId(raw.providerAssignmentId, 'Mã phân công đơn vị');
  if (raw.completionDocuments !== null && raw.completionDocuments !== undefined && !Array.isArray(raw.completionDocuments)) {
    throw new Error('Dữ liệu minh chứng của kết quả xử lý không hợp lệ.');
  }
  const completionDocuments = (Array.isArray(raw.completionDocuments) ? raw.completionDocuments : []).map(normalizeCompletionEvidence);
  if (completionDocuments.some((item) => !sameIncident(item.incidentId, incidentId)
    || (providerAssignmentId !== null && item.providerAssignmentId !== providerAssignmentId))) {
    throw new Error('Minh chứng không thuộc kết quả xử lý của sự vụ này.');
  }
  return {
    resolutionId: requireExecutionId(raw.resolutionId, 'Mã kết quả xử lý'), incidentId, providerAssignmentId,
    createdByStaffUserId: text(raw, 'createdByStaffUserId'), createdByStaffUserName: text(raw, 'createdByStaffUserName'),
    resolutionSummary: text(raw, 'resolutionSummary'), actionTaken: text(raw, 'actionTaken'), resultNote: text(raw, 'resultNote'),
    resolvedAt: text(raw, 'resolvedAt'), status: text(raw, 'status'), completionDocuments,
  };
}

export const sameIncident = (left: string, right: string) => Boolean(left.trim() && right.trim()) && left.trim().toLowerCase() === right.trim().toLowerCase();

type ExecutionIncident = { status: string; assignedStaffUserId: string };
const isCurrentAssignee = (item: ExecutionIncident, userId: string) => sameIncident(item.assignedStaffUserId, userId);

/** UI guard only: the Provider assignment status endpoint remains the authorization boundary. */
export const canStartIncidentProcessing = (item: ExecutionIncident, userId: string) => (
  isCurrentAssignee(item, userId) && normalizeKey(item.status) === 'assigned'
);

/** UI guard only: backend must enforce JWT ownership and valid state atomically. */
export const canEditIncidentExecution = (item: ExecutionIncident, userId: string) => (
  isCurrentAssignee(item, userId) && ['assigned', 'inprogress', 'needrework'].includes(normalizeKey(item.status))
);

export type IncidentResolutionSubmissionMode = 'initial' | 'resubmit' | null;

/**
 * Fail-closed UI guard. InProgress permits exactly the first result while
 * NeedRework permits a new version; the backend still validates state and
 * ownership atomically to protect against stale clients.
 */
export const incidentResolutionSubmissionMode = (
  item: ExecutionIncident,
  userId: string,
  existingResolutionCount: number,
): IncidentResolutionSubmissionMode => {
  if (!isCurrentAssignee(item, userId)
    || !Number.isSafeInteger(existingResolutionCount)
    || existingResolutionCount < 0) return null;
  const status = normalizeKey(item.status);
  if (status === 'needrework') return 'resubmit';
  if (status === 'inprogress' && existingResolutionCount === 0) return 'initial';
  return null;
};

export const canSubmitIncidentResolution = (
  item: ExecutionIncident,
  userId: string,
  existingResolutionCount: number,
) => incidentResolutionSubmissionMode(item, userId, existingResolutionCount) !== null;

export function buildEvidenceFormData(assets: EvidenceUploadAsset[], description = ''): FormData {
  if (!Array.isArray(assets) || assets.length === 0) throw new Error('Vui lòng chọn ít nhất một tệp minh chứng.');
  // Validate the whole batch before making a request or appending file objects.
  const files = assets.map((asset) => {
    const name = typeof asset.name === 'string' ? asset.name.trim() : '';
    if (!name || /[\r\n]/.test(name)) throw new Error('Tên tệp minh chứng không hợp lệ.');
    if (typeof Blob !== 'undefined' && asset.file instanceof Blob) return { name, file: asset.file };
    if (typeof asset.uri !== 'string' || !/^(file|content|ph|assets-library):\/\//i.test(asset.uri)) {
      throw new Error('Không đọc được tệp minh chứng. Vui lòng chọn lại tệp.');
    }
    return { name, uri: asset.uri, type: asset.mimeType?.trim() || 'application/octet-stream' };
  });
  const form = new FormData();
  if (description.trim()) form.append('Description', description.trim());
  for (const asset of files) {
    if ('file' in asset && asset.file) form.append('Files', asset.file, asset.name);
    else form.append('Files', { uri: asset.uri, name: asset.name, type: asset.type } as unknown as Blob);
  }
  return form;
}
