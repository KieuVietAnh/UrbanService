import { incidentManagementApi } from '@urbanmind/shared-api';
import {
  buildEvidenceFormData, normalizeCompletionEvidence, normalizeIncidentResolution,
  normalizeProviderAssignment, normalizeProviderCandidate, normalizeProviderContact,
  requireExecutionId, requireIncidentId, sameIncident,
  type AddProviderContactPayload, type AssignProviderPayload, type CompletionEvidence,
  type EvidenceUploadAsset, type IncidentResolution, type ProviderAssignment, type ProviderCandidate,
  type ProviderContact, type StartProviderAssignmentProcessingPayload, type SubmitIncidentResolutionPayload, type UpdateProviderStatusPayload,
} from './staff-execution-models';
import { normalizeStaffRecord, type StaffRecord } from './staff-models';

export const executionKeys = {
  all: (userId: string, incidentId: string) => ['staff', userId, 'execution', incidentId] as const,
  candidates: (userId: string, incidentId: string) => [...executionKeys.all(userId, incidentId), 'candidates'] as const,
  assignment: (userId: string, incidentId: string) => [...executionKeys.all(userId, incidentId), 'assignment'] as const,
  contacts: (userId: string, incidentId: string, assignmentId: number) => [...executionKeys.all(userId, incidentId), 'contacts', assignmentId] as const,
  evidence: (userId: string, incidentId: string, assignmentId: number) => [...executionKeys.all(userId, incidentId), 'evidence', assignmentId] as const,
  resolutions: (userId: string, incidentId: string) => [...executionKeys.all(userId, incidentId), 'resolutions'] as const,
};

const assertIncident = (actual: string, expected: string) => {
  if (!sameIncident(actual, expected)) throw new Error('Dữ liệu trả về không thuộc sự vụ đang mở. Vui lòng tải lại.');
};
const assertAssignment = (actual: number, expected: number) => {
  if (actual !== expected) throw new Error('Dữ liệu trả về không thuộc phân công đơn vị đang mở. Vui lòng tải lại.');
};

/** Uses the shared authenticated client; no Feedback execution mapping or fallback endpoints. */
export const executionApi = {
  async startIncidentDirectly(incidentId: string, payload: { note?: string } = {}): Promise<StaffRecord> {
    const id = requireIncidentId(incidentId);
    const result = normalizeStaffRecord(await incidentManagementApi.startIncidentProcessing(id, payload), true);
    assertIncident(result.id, id);
    return result;
  },
  async startProcessing(providerAssignmentId: number, payload: StartProviderAssignmentProcessingPayload = {}): Promise<ProviderAssignment> {
    const id = requireExecutionId(providerAssignmentId, 'Mã phân công đơn vị');
    const result = normalizeProviderAssignment(await incidentManagementApi.updateProviderAssignmentStatus(id, {
      status: 'InProgress',
      note: payload.note,
    }));
    assertAssignment(result.providerAssignmentId, id);
    return result;
  },
  async candidates(incidentId: string, signal?: AbortSignal): Promise<ProviderCandidate[]> {
    return (await incidentManagementApi.getIncidentProviderCandidates(requireIncidentId(incidentId), { signal })).map(normalizeProviderCandidate);
  },
  async assignment(incidentId: string, signal?: AbortSignal): Promise<ProviderAssignment | null> {
    const id = requireIncidentId(incidentId);
    const result = await incidentManagementApi.getIncidentProviderAssignment(id, { signal });
    if (result === null) return null;
    const assignment = normalizeProviderAssignment(result);
    assertIncident(assignment.incidentId, id);
    return assignment;
  },
  async assign(incidentId: string, payload: AssignProviderPayload): Promise<ProviderAssignment> {
    const id = requireIncidentId(incidentId);
    const result = normalizeProviderAssignment(await incidentManagementApi.assignIncidentProvider(id, payload));
    assertIncident(result.incidentId, id);
    return result;
  },
  async contacts(assignmentId: number, signal?: AbortSignal): Promise<ProviderContact[]> {
    const id = requireExecutionId(assignmentId, 'Mã phân công đơn vị');
    return (await incidentManagementApi.getProviderAssignmentContactLogs(id, { signal })).map((value: unknown) => {
      const contact = normalizeProviderContact(value);
      assertAssignment(contact.providerAssignmentId, id);
      return contact;
    });
  },
  async addContact(assignmentId: number, payload: AddProviderContactPayload): Promise<ProviderContact> {
    const id = requireExecutionId(assignmentId, 'Mã phân công đơn vị');
    const result = normalizeProviderContact(await incidentManagementApi.createProviderAssignmentContactLog(id, payload));
    assertAssignment(result.providerAssignmentId, id);
    return result;
  },
  async updateProviderStatus(assignmentId: number, payload: UpdateProviderStatusPayload): Promise<ProviderAssignment> {
    const id = requireExecutionId(assignmentId, 'Mã phân công đơn vị');
    const result = normalizeProviderAssignment(await incidentManagementApi.updateProviderAssignmentStatus(id, payload));
    assertAssignment(result.providerAssignmentId, id);
    return result;
  },
  async evidence(assignmentId: number, signal?: AbortSignal): Promise<CompletionEvidence[]> {
    const id = requireExecutionId(assignmentId, 'Mã phân công đơn vị');
    return (await incidentManagementApi.getProviderAssignmentCompletionDocuments(id, { signal })).map((value: unknown) => {
      const evidence = normalizeCompletionEvidence(value);
      assertAssignment(evidence.providerAssignmentId, id);
      return evidence;
    });
  },
  async uploadEvidence(assignmentId: number, assets: EvidenceUploadAsset[], description = ''): Promise<CompletionEvidence[]> {
    const id = requireExecutionId(assignmentId, 'Mã phân công đơn vị');
    const form = buildEvidenceFormData(assets, description);
    return (await incidentManagementApi.uploadProviderAssignmentCompletionDocuments(id, form)).map((value: unknown) => {
      const evidence = normalizeCompletionEvidence(value);
      assertAssignment(evidence.providerAssignmentId, id);
      return evidence;
    });
  },
  async clearEvidence(assignmentId: number): Promise<void> {
    await incidentManagementApi.deleteProviderAssignmentCompletionDocuments(
      requireExecutionId(assignmentId, 'Mã phân công đơn vị'),
    );
  },
  async resolutions(incidentId: string, signal?: AbortSignal): Promise<IncidentResolution[]> {
    const id = requireIncidentId(incidentId);
    return (await incidentManagementApi.getIncidentResolutions(id, { signal })).map((value: unknown) => {
      const resolution = normalizeIncidentResolution(value);
      assertIncident(resolution.incidentId, id);
      return resolution;
    });
  },
  async submitResolution(incidentId: string, payload: SubmitIncidentResolutionPayload): Promise<void> {
    await incidentManagementApi.submitIncidentResolution(requireIncidentId(incidentId), payload);
  },
};
