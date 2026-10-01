import test from 'node:test';
import assert from 'node:assert/strict';

import { mock } from 'node:test';

import { axiosClient } from './axiosClient.js';
import {
  INCIDENT_MANAGEMENT_CAPABILITIES,
  incidentManagementApi,
  normalizeIncidentDetailResponse,
  normalizeIncidentAssigneeCandidates,
  normalizeAssignIncidentPayload,
  normalizeStartIncidentProcessingPayload,
  normalizeIncidentListParams,
  normalizeIncidentListResponse,
  normalizeIncidentTimelineParams,
  normalizeIncidentTimelineResponse,
  normalizeAssignIncidentProviderPayload,
  normalizeProviderAssignmentContactPayload,
  normalizeProviderAssignmentStatusPayload,
  normalizeSubmitIncidentResolutionPayload,
  normalizeNeedReworkResolutionPayload,
  normalizeResolutionDecisionResponse,
  normalizeIncidentProviderAssignmentResponse,
  normalizeIncidentExecutionCollection,
} from './incidentManagementApi.js';

test('incident list capability follows the checked-in ManagementIncidents contract', () => {
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.list.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.list.endpoint, '/api/management/incidents');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.list.assignedToCurrentStaff, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.list.supportedFilters.includes('severity'), true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.list.supportedFilters.includes('assignedStaffUserId'), true);
  assert.equal(incidentManagementApi.capabilities, INCIDENT_MANAGEMENT_CAPABILITIES);
  assert.equal(typeof incidentManagementApi.getIncidents, 'function');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.detail.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.detail.endpoint, '/api/management/incidents/{incidentId}');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.detail.assignedStaff, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.detail.incidentLevelSla, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.detail.reportsEmbedded, true);
  assert.equal(typeof incidentManagementApi.getIncidentById, 'function');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.timeline.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.timeline.paginated, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.timeline.defaultPageSize, 20);
  assert.equal(typeof incidentManagementApi.getIncidentTimeline, 'function');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.statusTransition.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.statusTransition.endpoint, '/api/management/incidents/{incidentId}/status');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.scope, 'provider-assignment');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.endpoint, '/api/management/provider-assignments/{providerAssignmentId}/status');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.fromStatus, 'Reported');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.toStatus, 'InProgress');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.requestSchema, 'UpdateProviderAssignmentStatusRequest');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.synchronizesIncident, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.scope, 'incident');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.endpoint, '/api/management/incidents/{incidentId}/provider-assignment');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.legacyRequiresFeedbackId, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.authoritativeReportMapping, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.supportsReassignment, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.noAssignmentStatus, 204);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.submitAvailable, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.resubmitConfirmed, true);
  assert.deepEqual(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.submitStatuses, ['InProgress', 'NeedRework']);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.needReworkReasonConfirmed, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.reviewAvailable, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.latestEndpoint, '/api/management/incidents/{incidentId}/resolutions/latest');
  assert.equal(typeof incidentManagementApi.getLatestIncidentResolution, 'function');
  assert.equal(typeof incidentManagementApi.approveIncidentResolution, 'function');
  assert.equal(typeof incidentManagementApi.requestIncidentResolutionRework, 'function');
  assert.deepEqual(INCIDENT_MANAGEMENT_CAPABILITIES.completionEvidence.multipartFields, ['Description', 'Files']);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.completionEvidence.documentedUploadLimits, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.completionEvidence.deleteOneAvailable, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.completionEvidence.clearAllAvailable, true);
  assert.equal(typeof incidentManagementApi.deleteProviderAssignmentCompletionDocuments, 'function');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerStatus.transitionsConfirmed, true);
  assert.deepEqual(INCIDENT_MANAGEMENT_CAPABILITIES.providerStatus.staffTransitions, [
    { from: 'Reported', to: 'InProgress' },
  ]);
  assert.equal(typeof incidentManagementApi.startIncidentProcessing, 'function');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.assigneeCandidates.available, true);
  assert.deepEqual(INCIDENT_MANAGEMENT_CAPABILITIES.assigneeCandidates.eligibility, ['areaId', 'categoryId']);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.assignment.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.assignment.supportsReassignment, false);
  assert.equal(typeof incidentManagementApi.getIncidentAssigneeCandidates, 'function');
  assert.equal(typeof incidentManagementApi.assignIncident, 'function');
});

test('normalizeIncidentListParams maps only supported Swagger query parameters', () => {
  assert.deepEqual(normalizeIncidentListParams({
    pageNumber: 2,
    pageSize: 20,
    areaId: '4',
    categoryId: 7,
    status: ' InProgress ',
    priority: 'High',
    severity: 'Major',
    search: ' ngập nước ',
    includeMerged: false,
    assignedStaffUserId: ' staff-1 ',
    unsupported: 'ignored',
  }), {
    PageNumber: 2,
    PageSize: 20,
    AreaId: 4,
    CategoryId: 7,
    Status: 'InProgress',
    Priority: 'High',
    Severity: 'Major',
    Search: 'ngập nước',
    IncludeMerged: false,
    AssignedStaffUserId: 'staff-1',
  });
});

test('normalizeIncidentListResponse preserves the documented paged DTO', () => {
  const item = { incidentId: 'incident-1', title: 'Ngập nước', reportCount: 3 };

  assert.deepEqual(normalizeIncidentListResponse({
    items: [item],
    pageNumber: 2,
    pageSize: 10,
    totalItems: 12,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  }), {
    items: [item],
    pageNumber: 2,
    pageSize: 10,
    totalItems: 12,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  });
});

test('getIncidents calls the real management endpoint with Staff scope', async () => {
  const getMock = mock.method(axiosClient, 'get', async () => ({
    items: [],
    pageNumber: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }));

  try {
    await incidentManagementApi.getIncidents({
      pageNumber: 1,
      pageSize: 10,
      assignedStaffUserId: 'staff-1',
      includeMerged: false,
    });

    assert.equal(getMock.mock.callCount(), 1);
    assert.equal(getMock.mock.calls[0].arguments[0], '/api/management/incidents');
    assert.deepEqual(getMock.mock.calls[0].arguments[1].params, {
      PageNumber: 1,
      PageSize: 10,
      AssignedStaffUserId: 'staff-1',
      IncludeMerged: false,
    });
  } finally {
    getMock.mock.restore();
  }
});

test('normalizeIncidentDetailResponse keeps the documented Incident detail DTO', () => {
  const incident = {
    incidentId: 'incident-1',
    title: 'Ngập nước tại đường Nguyễn Huệ',
    assignedStaffName: 'Nguyễn Văn A',
    reportCount: 3,
    reports: [{ feedbackId: 'feedback-1' }],
    events: [],
  };

  assert.equal(normalizeIncidentDetailResponse(incident), incident);
  assert.equal(normalizeIncidentDetailResponse({ data: incident }), incident);
  assert.equal(normalizeIncidentDetailResponse(null), null);
  assert.equal(normalizeIncidentDetailResponse([]), null);
});

test('getIncidentById calls the real management detail endpoint', async () => {
  const signal = new AbortController().signal;
  const incident = { incidentId: 'incident-1', title: 'Ngập nước' };
  const getMock = mock.method(axiosClient, 'get', async () => incident);

  try {
    const result = await incidentManagementApi.getIncidentById('incident-1', { signal });

    assert.equal(result, incident);
    assert.equal(getMock.mock.callCount(), 1);
    assert.equal(getMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1');
    assert.equal(getMock.mock.calls[0].arguments[1].signal, signal);
  } finally {
    getMock.mock.restore();
  }
});

test('getIncidentById rejects an empty Incident identifier before making a request', async () => {
  const getMock = mock.method(axiosClient, 'get', async () => null);

  try {
    await assert.rejects(
      incidentManagementApi.getIncidentById('  '),
      { name: 'TypeError', message: 'incidentId is required' },
    );
    assert.equal(getMock.mock.callCount(), 0);
  } finally {
    getMock.mock.restore();
  }
});

test('normalizes the documented assignee candidate collection', () => {
  const candidate = {
    userId: 'staff-1',
    staffName: 'Nguyễn Văn A',
    email: 'staff@example.com',
    areaId: 4,
    areaName: 'Phường 5',
    categoryId: 7,
    categoryName: 'Cây xanh',
    isPrimary: true,
  };

  assert.deepEqual(normalizeIncidentAssigneeCandidates([candidate]), [candidate]);
  assert.deepEqual(normalizeIncidentAssigneeCandidates({ data: [candidate] }), [candidate]);
  assert.deepEqual(normalizeIncidentAssigneeCandidates(null), []);
});

test('normalizes only the documented Incident assignment payload', () => {
  assert.deepEqual(normalizeAssignIncidentPayload({
    staffUserId: ' staff-1 ',
    reason: ' Phù hợp khu vực ',
    workload: 10,
  }), {
    staffUserId: 'staff-1',
    reason: 'Phù hợp khu vực',
  });
  assert.throws(() => normalizeAssignIncidentPayload({}), /staffUserId is required/);
});

test('calls real assignee candidate and assignment endpoints', async () => {
  const getMock = mock.method(axiosClient, 'get', async () => []);
  const postMock = mock.method(axiosClient, 'post', async () => ({
    incidentId: 'incident-1',
    assignedStaffUserId: 'staff-1',
  }));

  try {
    await incidentManagementApi.getIncidentAssigneeCandidates('incident-1');
    const assigned = await incidentManagementApi.assignIncident('incident-1', {
      staffUserId: 'staff-1',
    });

    assert.equal(getMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1/assignee-candidates');
    assert.equal(getMock.mock.calls[0].arguments[1].signal, undefined);
    assert.deepEqual(postMock.mock.calls[0].arguments, [
      '/api/management/incidents/incident-1/assign',
      { staffUserId: 'staff-1' },
    ]);
    assert.equal(assigned.assignedStaffUserId, 'staff-1');
  } finally {
    getMock.mock.restore();
    postMock.mock.restore();
  }
});

test('normalizes the dedicated Assigned to InProgress payload without exposing a generic status selector', () => {
  assert.deepEqual(normalizeStartIncidentProcessingPayload({
    note: ' Bắt đầu kiểm tra hiện trường ',
    status: 'Approved',
  }), {
    status: 'InProgress',
    note: 'Bắt đầu kiểm tra hiện trường',
  });
  assert.deepEqual(normalizeStartIncidentProcessingPayload(), { status: 'InProgress' });
});

test('generic Incident status wrapper still follows the separately documented endpoint', async () => {
  const incident = { incidentId: 'incident-1', status: 'InProgress' };
  const patchMock = mock.method(axiosClient, 'patch', async () => incident);

  try {
    const result = await incidentManagementApi.startIncidentProcessing('incident-1', {
      note: 'Bắt đầu xử lý',
    });

    assert.deepEqual(patchMock.mock.calls[0].arguments, [
      '/api/management/incidents/incident-1/status',
      { status: 'InProgress', note: 'Bắt đầu xử lý' },
    ]);
    assert.equal(result, incident);
  } finally {
    patchMock.mock.restore();
  }
});

test('normalizeIncidentTimelineParams follows the documented pagination query', () => {
  assert.deepEqual(normalizeIncidentTimelineParams({ pageNumber: 2, pageSize: 20 }), {
    pageNumber: 2,
    pageSize: 20,
  });
  assert.deepEqual(normalizeIncidentTimelineParams({ pageNumber: 0, pageSize: 'invalid' }), {});
});

test('normalizeIncidentTimelineResponse preserves the paged event DTO', () => {
  const event = { incidentEventId: 1, eventType: 'IncidentCreated' };

  assert.deepEqual(normalizeIncidentTimelineResponse({
    items: [event],
    pageNumber: 2,
    pageSize: 20,
    totalItems: 21,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  }), {
    items: [event],
    pageNumber: 2,
    pageSize: 20,
    totalItems: 21,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  });
});

test('getIncidentTimeline calls the paginated management timeline endpoint', async () => {
  const resultDto = {
    items: [],
    pageNumber: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };
  const getMock = mock.method(axiosClient, 'get', async () => resultDto);

  try {
    const result = await incidentManagementApi.getIncidentTimeline(
      'incident-1',
      { pageNumber: 1, pageSize: 20 },
    );

    assert.deepEqual(result, resultDto);
    assert.equal(getMock.mock.callCount(), 1);
    assert.equal(getMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1/timeline');
    assert.deepEqual(getMock.mock.calls[0].arguments[1].params, {
      pageNumber: 1,
      pageSize: 20,
    });
  } finally {
    getMock.mock.restore();
  }
});

test('Incident execution payloads whitelist the new schemas and never send Feedback or Staff identities', () => {
  assert.deepEqual(normalizeAssignIncidentProviderPayload({
    coordinatorId: '12', note: ' Phối hợp hiện trường ', feedbackId: 'report-1', staffUserId: 'other', incidentId: 'other',
  }), { coordinatorId: 12, note: 'Phối hợp hiện trường' });
  assert.deepEqual(normalizeProviderAssignmentContactPayload({
    contactMethod: ' Phone ', contactResult: ' Reached ', contactNote: ' Đã gọi ',
    contactedAt: '2026-09-01T09:00:00+07:00', staffUserId: 'other',
  }), { contactMethod: 'Phone', contactResult: 'Reached', contactNote: 'Đã gọi', contactedAt: '2026-09-01T02:00:00.000Z' });
  assert.deepEqual(normalizeProviderAssignmentStatusPayload({ status: ' InProgress ', note: ' Bắt đầu xử lý ', incidentStatus: 'Closed' }), {
    status: 'InProgress', note: 'Bắt đầu xử lý',
  });
  assert.deepEqual(normalizeSubmitIncidentResolutionPayload({
    providerAssignmentId: '7', resolutionSummary: ' Đã khắc phục ', actionTaken: ' Thay thiết bị ', resultNote: ' Hoạt động ổn định ',
    imageUrls: [' https://example.test/evidence.jpg '], feedbackId: 'report-1', staffUserId: 'other', status: 'Approved',
  }), {
    providerAssignmentId: 7, resolutionSummary: 'Đã khắc phục', actionTaken: 'Thay thiết bị', resultNote: 'Hoạt động ổn định',
    imageUrls: ['https://example.test/evidence.jpg'],
  });
  assert.deepEqual(normalizeSubmitIncidentResolutionPayload({
    resolutionSummary: 'Tự xử lý',
    actionTaken: 'Kiểm tra và khắc phục',
  }), {
    resolutionSummary: 'Tự xử lý',
    actionTaken: 'Kiểm tra và khắc phục',
  });
});

test('Incident execution payloads reject invalid IDs and malformed fields before requests', () => {
  for (const id of [0, -1, 1.5, true, 'not-id', '', 2147483648]) {
    assert.throws(() => normalizeAssignIncidentProviderPayload({ coordinatorId: id }), /coordinatorId/);
    assert.throws(() => normalizeSubmitIncidentResolutionPayload({
      providerAssignmentId: id,
      resolutionSummary: 'Done',
      actionTaken: 'Fixed',
    }), /providerAssignmentId/);
  }
  assert.throws(() => normalizeProviderAssignmentContactPayload({ contactMethod: 'Phone', contactResult: '' }), /contactResult/);
  assert.throws(() => normalizeProviderAssignmentContactPayload({ contactMethod: 'Phone', contactResult: 'Reached', contactedAt: 'yesterday' }), /ISO date-time/);
  assert.throws(() => normalizeProviderAssignmentStatusPayload({ status: '' }), /status/);
  assert.throws(() => normalizeSubmitIncidentResolutionPayload({ resolutionSummary: ' ', actionTaken: 'Fixed' }), /resolutionSummary/);
  assert.throws(() => normalizeSubmitIncidentResolutionPayload({ resolutionSummary: 'Done', actionTaken: ' ' }), /actionTaken/);
  assert.throws(() => normalizeSubmitIncidentResolutionPayload({ resolutionSummary: 42 }), /resolutionSummary/);
  assert.throws(() => normalizeSubmitIncidentResolutionPayload({ resolutionSummary: 'Done', actionTaken: 'Fixed', imageUrls: ['file:///private.jpg'] }), /HTTP/);
  assert.throws(() => normalizeSubmitIncidentResolutionPayload({ resolutionSummary: 'Done', actionTaken: 'Fixed', imageUrls: ['javascript:alert(1)'] }), /HTTP/);
  assert.throws(() => normalizeSubmitIncidentResolutionPayload({ resolutionSummary: 'Done', actionTaken: 'Fixed', imageUrls: 'https://example.test/a.jpg' }), /array/);
});

test('Incident execution unwraps DTOs and distinguishes empty assignment from malformed collections', () => {
  const assignment = { providerAssignmentId: 5, incidentId: 'incident-1' };
  assert.equal(normalizeIncidentProviderAssignmentResponse(assignment), assignment);
  assert.equal(normalizeIncidentProviderAssignmentResponse({ data: assignment }), assignment);
  assert.equal(normalizeIncidentProviderAssignmentResponse({ data: { data: assignment } }), assignment);
  for (const empty of [null, undefined, '', { status: 204, data: '' }]) {
    assert.equal(normalizeIncidentProviderAssignmentResponse(empty), null);
  }
  assert.throws(() => normalizeIncidentProviderAssignmentResponse([]), /Invalid/);
  assert.deepEqual(normalizeIncidentExecutionCollection({ data: { items: [assignment] } }), [assignment]);
  assert.deepEqual(normalizeIncidentExecutionCollection([]), []);
  assert.throws(() => normalizeIncidentExecutionCollection({ message: 'not a list' }), /Invalid/);
});

test('Incident execution GET endpoints use exact new paths and support cancellation', async () => {
  const signal = new AbortController().signal;
  const getMock = mock.method(axiosClient, 'get', async (path) => path.endsWith('/provider-assignment') ? '' : []);
  try {
    await incidentManagementApi.getIncidentProviderCandidates('incident/1', { signal });
    assert.equal(await incidentManagementApi.getIncidentProviderAssignment('incident/1', { signal }), null);
    await incidentManagementApi.getProviderAssignmentContactLogs(7, { signal });
    await incidentManagementApi.getProviderAssignmentCompletionDocuments(7, { signal });
    await incidentManagementApi.getIncidentResolutions('incident/1', { signal });
    assert.deepEqual(getMock.mock.calls.map((call) => call.arguments[0]), [
      '/api/management/incidents/incident%2F1/provider-candidates',
      '/api/management/incidents/incident%2F1/provider-assignment',
      '/api/management/provider-assignments/7/contact-logs',
      '/api/management/provider-assignments/7/completion-documents',
      '/api/management/incidents/incident%2F1/resolutions',
    ]);
    assert.ok(getMock.mock.calls.every((call) => call.arguments[1].signal === signal));
    const count = getMock.mock.callCount();
    await assert.rejects(incidentManagementApi.getIncidentResolutions('  '), /incidentId/);
    await assert.rejects(incidentManagementApi.getProviderAssignmentContactLogs(-1), /positive integer/);
    assert.equal(getMock.mock.callCount(), count);
  } finally { getMock.mock.restore(); }
});

test('Incident assignment, contact and provider status mutations never use legacy Feedback paths', async () => {
  const assignment = { providerAssignmentId: 7, incidentId: 'incident-1' };
  const postMock = mock.method(axiosClient, 'post', async (path) => path.endsWith('/contact-logs')
    ? { contactLogId: 1, providerAssignmentId: 7 } : assignment);
  const patchMock = mock.method(axiosClient, 'patch', async () => assignment);
  try {
    assert.equal(await incidentManagementApi.assignIncidentProvider('incident-1', { coordinatorId: 12, note: 'Note' }), assignment);
    await incidentManagementApi.createProviderAssignmentContactLog(7, { contactMethod: 'Phone', contactResult: 'Reached' });
    assert.equal(await incidentManagementApi.updateProviderAssignmentStatus(7, { status: 'InProgress', note: 'Bắt đầu xử lý' }), assignment);
    assert.deepEqual(postMock.mock.calls.map((call) => call.arguments), [
      ['/api/management/incidents/incident-1/provider-assignment', { coordinatorId: 12, note: 'Note' }],
      ['/api/management/provider-assignments/7/contact-logs', { contactMethod: 'Phone', contactResult: 'Reached' }],
    ]);
    assert.deepEqual(patchMock.mock.calls[0].arguments, [
      '/api/management/provider-assignments/7/status', { status: 'InProgress', note: 'Bắt đầu xử lý' },
    ]);
  } finally { postMock.mock.restore(); patchMock.mock.restore(); }
});

test('Evidence upload preserves FormData and does not set a multipart boundary', async () => {
  const document = { completionDocumentId: 1, providerAssignmentId: 7, incidentId: 'incident-1' };
  const postMock = mock.method(axiosClient, 'post', async () => [document]);
  try {
    const form = new FormData();
    form.append('Description', 'Photo');
    form.append('Files', new Blob(['fixture'], { type: 'image/png' }), 'evidence.png');
    assert.deepEqual(await incidentManagementApi.uploadProviderAssignmentCompletionDocuments(7, form), [document]);
    assert.deepEqual(postMock.mock.calls[0].arguments, ['/api/management/provider-assignments/7/completion-documents', form]);
    assert.equal(postMock.mock.calls[0].arguments.length, 2);
    await assert.rejects(incidentManagementApi.uploadProviderAssignmentCompletionDocuments(7, {}), /FormData/);
    assert.equal(postMock.mock.callCount(), 1);
  } finally { postMock.mock.restore(); }
});

test('Evidence clear-all uses the exact DELETE contract, validates IDs and preserves backend errors', async () => {
  const deleteMock = mock.method(axiosClient, 'delete', async () => undefined);
  try {
    assert.equal(await incidentManagementApi.deleteProviderAssignmentCompletionDocuments(7), undefined);
    assert.deepEqual(deleteMock.mock.calls[0].arguments, [
      '/api/management/provider-assignments/7/completion-documents',
    ]);

    const requestCount = deleteMock.mock.callCount();
    for (const invalidId of [0, -1, 1.5, true, 'not-id', '', 2147483648]) {
      await assert.rejects(
        incidentManagementApi.deleteProviderAssignmentCompletionDocuments(invalidId),
        /providerAssignmentId must be a positive integer/,
      );
    }
    assert.equal(deleteMock.mock.callCount(), requestCount);

    const forbidden = Object.assign(new Error('Evidence may only be cleared during NeedRework'), { status: 403 });
    deleteMock.mock.mockImplementation(async () => { throw forbidden; });
    await assert.rejects(
      incidentManagementApi.deleteProviderAssignmentCompletionDocuments(7),
      (error) => error === forbidden,
    );
  } finally { deleteMock.mock.restore(); }
});

test('Incident submit requires the execution narrative, supports empty 200 and preserves conflict errors', async () => {
  const conflict = Object.assign(new Error('Already submitted'), { status: 409 });
  const postMock = mock.method(axiosClient, 'post', async () => undefined);
  try {
    assert.equal(await incidentManagementApi.submitIncidentResolution('incident-1', {
      resolutionSummary: 'Done', actionTaken: 'Fixed', providerAssignmentId: 7,
    }), undefined);
    assert.deepEqual(postMock.mock.calls[0].arguments, [
      '/api/management/incidents/incident-1/resolutions', { resolutionSummary: 'Done', actionTaken: 'Fixed', providerAssignmentId: 7 },
    ]);
    await assert.rejects(
      incidentManagementApi.submitIncidentResolution('incident-2', {}),
      /resolutionSummary/,
    );
    assert.equal(postMock.mock.callCount(), 1);
    postMock.mock.mockImplementation(async () => { throw conflict; });
    await assert.rejects(incidentManagementApi.submitIncidentResolution('incident-1', {
      resolutionSummary: 'Done', actionTaken: 'Fixed',
    }), (error) => error === conflict);
  } finally { postMock.mock.restore(); }
});

test('management mutation capabilities expose update, merge, and report-link contracts', () => {
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.metadataUpdate.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.metadataUpdate.method, 'PATCH');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.merge.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.merge.endpoint, '/api/management/incidents/{incidentId}/merge');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.reportLinks.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.reportLinks.supportsSoftUnlink, true);
  assert.equal(typeof incidentManagementApi.updateIncident, 'function');
  assert.equal(typeof incidentManagementApi.updateIncidentStatus, 'function');
  assert.equal(typeof incidentManagementApi.mergeIncident, 'function');
  assert.equal(typeof incidentManagementApi.linkReport, 'function');
  assert.equal(typeof incidentManagementApi.unlinkReport, 'function');
});

test('incident management mutations call the documented endpoints', async () => {
  const patchMock = mock.method(axiosClient, 'patch', async () => ({ incidentId: 'incident-1' }));
  const postMock = mock.method(axiosClient, 'post', async () => ({ incidentId: 'incident-1' }));
  const deleteMock = mock.method(axiosClient, 'delete', async () => null);

  try {
    await incidentManagementApi.updateIncident('incident-1', { priority: 'High' });
    await incidentManagementApi.updateIncidentStatus('incident-1', { status: 'Closed' });
    await incidentManagementApi.mergeIncident('incident-1', { targetIncidentId: 'incident-2', reason: null });
    await incidentManagementApi.linkReport('incident-1', { feedbackId: 'feedback-1', linkMethod: 'Manual' });
    await incidentManagementApi.unlinkReport('incident-1', 'feedback-1');

    assert.equal(patchMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1');
    assert.equal(patchMock.mock.calls[1].arguments[0], '/api/management/incidents/incident-1/status');
    assert.equal(postMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1/merge');
    assert.equal(postMock.mock.calls[1].arguments[0], '/api/management/incidents/incident-1/reports');
    assert.equal(deleteMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1/reports/feedback-1');
  } finally {
    patchMock.mock.restore();
    postMock.mock.restore();
    deleteMock.mock.restore();
  }
});

test('unlinkReport validates feedbackId before making a request', async () => {
  const deleteMock = mock.method(axiosClient, 'delete', async () => null);

  try {
    await assert.rejects(
      incidentManagementApi.unlinkReport('incident-1', '  '),
      { name: 'TypeError', message: 'feedbackId is required' },
    );
    assert.equal(deleteMock.mock.callCount(), 0);
  } finally {
    deleteMock.mock.restore();
  }
});


test('resolution review payload requires a concrete rework reason', () => {
  assert.deepEqual(normalizeNeedReworkResolutionPayload({ reason: '  Bổ sung ảnh minh chứng  ' }), {
    reason: 'Bổ sung ảnh minh chứng',
  });
  assert.throws(() => normalizeNeedReworkResolutionPayload({ reason: '   ' }), /reason is required/);
});

test('resolution decision normalizer accepts the documented DTO and no-content safely', () => {
  const resolution = { resolutionId: 9, incidentId: 'incident-1', status: 'SubmittedForApproval' };
  assert.equal(normalizeResolutionDecisionResponse(resolution), resolution);
  assert.equal(normalizeResolutionDecisionResponse({ data: resolution }), resolution);
  assert.equal(normalizeResolutionDecisionResponse(null), null);
});

test('resolution review methods call Incident-first endpoints', async () => {
  const resolution = { resolutionId: 9, incidentId: 'incident-1', status: 'SubmittedForApproval' };
  const getMock = mock.method(axiosClient, 'get', async () => resolution);
  const postMock = mock.method(axiosClient, 'post', async () => resolution);
  try {
    const signal = new AbortController().signal;
    assert.equal(await incidentManagementApi.getLatestIncidentResolution('incident-1', { signal }), resolution);
    assert.equal(getMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1/resolutions/latest');
    assert.equal(getMock.mock.calls[0].arguments[1].signal, signal);

    await incidentManagementApi.approveIncidentResolution('incident-1', 9, { note: ' Đạt yêu cầu ' });
    assert.equal(postMock.mock.calls[0].arguments[0], '/api/management/incidents/incident-1/resolutions/9/approve');
    assert.equal(postMock.mock.calls[0].arguments[1], undefined);
    assert.deepEqual(postMock.mock.calls[0].arguments[2].params, { note: 'Đạt yêu cầu' });

    await incidentManagementApi.requestIncidentResolutionRework('incident-1', 9, { reason: ' Thiếu minh chứng ' });
    assert.equal(postMock.mock.calls[1].arguments[0], '/api/management/incidents/incident-1/resolutions/9/need-rework');
    assert.deepEqual(postMock.mock.calls[1].arguments[1], { reason: 'Thiếu minh chứng' });
  } finally {
    getMock.mock.restore();
    postMock.mock.restore();
  }
});
