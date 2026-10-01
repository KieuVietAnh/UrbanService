import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { axiosClient } from './axiosClient.js';
import {
  duplicateManagementApi,
  incidentMatchApi,
  normalizeIncidentMatchPage,
  normalizeIncidentMatchParams,
  normalizeIncidentMatchSummary,
} from './duplicateManagementApi.js';

test('normalizes only swagger-supported Incident Match list parameters', () => {
  assert.deepEqual(normalizeIncidentMatchParams({
    status: 'Pending',
    page: '2',
    pageSize: 10,
    search: 'không được hỗ trợ',
  }), {
    Status: 'Pending',
    Page: 2,
    PageSize: 10,
  });
});

test('normalizes the Incident Match summary contract', () => {
  assert.deepEqual(normalizeIncidentMatchSummary({
    pendingCount: 4,
    confirmedCount: 3,
    rejectedCount: 2,
    totalCount: 9,
  }), {
    pending: 4,
    confirmed: 3,
    rejected: 2,
    total: 9,
  });
});

test('normalizes the real paged candidate response', () => {
  assert.deepEqual(normalizeIncidentMatchPage({
    items: [{ duplicateCandidateId: 'candidate-1' }],
    pageNumber: 2,
    pageSize: 10,
    totalItems: 12,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  }), {
    items: [{ duplicateCandidateId: 'candidate-1' }],
    pageNumber: 2,
    pageSize: 10,
    totalItems: 12,
    totalPages: 2,
    hasPreviousPage: true,
    hasNextPage: false,
  });
});

test('getCandidates sends the documented Status, Page and PageSize query', async () => {
  const getRequest = mock.method(axiosClient, 'get', async () => ({
    items: [],
    pageNumber: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  }));

  try {
    await incidentMatchApi.getCandidates({
      status: 'Confirmed',
      page: 1,
      pageSize: 10,
      search: 'không gửi',
    });

    assert.deepEqual(getRequest.mock.calls[0].arguments, [
      '/api/management/incident-match-candidates',
      {
        params: {
          Status: 'Confirmed',
          Page: 1,
          PageSize: 10,
        },
        signal: undefined,
      },
    ]);
  } finally {
    getRequest.mock.restore();
  }
});

test('confirm and reject follow swagger endpoints without invented request bodies', async () => {
  const postRequest = mock.method(axiosClient, 'post', async () => ({}));

  try {
    await incidentMatchApi.confirmCandidate('candidate-confirm');
    await incidentMatchApi.rejectCandidate('candidate-reject');

    assert.deepEqual(postRequest.mock.calls[0].arguments, [
      '/api/management/incident-match-candidates/candidate-confirm/confirm',
    ]);
    assert.deepEqual(postRequest.mock.calls[1].arguments, [
      '/api/management/incident-match-candidates/candidate-reject/reject',
    ]);
  } finally {
    postRequest.mock.restore();
  }
});

test('legacy duplicate API delegates to the Incident Match implementation', async () => {
  const getRequest = mock.method(axiosClient, 'get', async () => ({
    pendingCount: 1,
    confirmedCount: 0,
    rejectedCount: 0,
    totalCount: 1,
  }));

  try {
    const result = await duplicateManagementApi.getDuplicateSummary();
    assert.equal(result.pending, 1);
    assert.equal(getRequest.mock.calls[0].arguments[0], '/api/management/incident-match-candidates/summary');
  } finally {
    getRequest.mock.restore();
  }
});
