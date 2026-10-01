import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  managementFeedbackApi,
  normalizeAiReviewedPage,
  normalizeAiReviewedPayload,
  normalizeStaffFeedbackUpdatePayload,
  normalizeFeedbackListParams,
  normalizeCommentPayload,
  normalizeProviderReportStatus,
  normalizeProviderContactLogPayload,
  canTransitionProviderReportStatus,
  resolveProviderReportById,
} from './managementFeedbackApi.js';
import { axiosClient } from './axiosClient.js';
import { normalizeCommentsResponse } from './ticketApiHelpers.js';

test('normalizeAiReviewedPayload maps ai-reviewed payloads to queue-ready items', () => {
  const normalized = normalizeAiReviewedPayload({
    items: [
      {
        feedback: {
          feedbackId: 'fb-1',
          title: 'Hố ga',
          description: 'Nước tràn ra đường',
          categoryId: 3,
          priority: 'High',
          reporterName: 'An',
          locationText: 'Quận 1',
        },
        analysisResult: {
          confidenceScore: 0.94,
          sentiment: 'Negative',
          summary: 'Sự cố hạ tầng đường',
          detectedCategoryName: 'Hạ tầng',
        },
      },
    ],
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].feedbackId, 'fb-1');
  assert.equal(normalized[0].summary, 'Sự cố hạ tầng đường');
  assert.equal(normalized[0].confidenceScore, 0.94);
  assert.equal(normalized[0].detectedCategoryName, 'Hạ tầng');
});

test('normalizeAiReviewedPayload keeps description empty when the list contract omits it', () => {
  const normalized = normalizeAiReviewedPayload({
    items: [
      {
        feedback: {
          feedbackId: 'fb-2',
          title: 'Đèn đường bị hỏng',
          categoryId: 2,
          priority: 'Medium',
          reporterName: 'Kieu Viet Anh',
          locationText: '12 Nguyễn Huệ',
        },
        analysisResult: {
          confidenceScore: 0.95,
          sentiment: 'Negative',
          summary: 'Sự cố đèn đường',
          detectedCategoryName: 'Street Lighting',
        },
      },
    ],
  });

  assert.equal(normalized[0].title, 'Đèn đường bị hỏng');
  assert.equal(normalized[0].description, '');
});

test('normalizeAiReviewedPage preserves the management pagination contract', () => {
  const normalized = normalizeAiReviewedPage({
    items: [
      {
        feedback: {
          feedbackId: 'fb-3',
          title: 'Cây xanh bị gãy',
          status: 'AiReviewed',
        },
        analysisResult: {
          confidenceScore: 0.88,
        },
      },
    ],
    pageNumber: 2,
    pageSize: 10,
    totalItems: 21,
    totalPages: 3,
    hasPreviousPage: true,
    hasNextPage: true,
  });

  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].feedbackId, 'fb-3');
  assert.equal(normalized.pageNumber, 2);
  assert.equal(normalized.pageSize, 10);
  assert.equal(normalized.totalItems, 21);
  assert.equal(normalized.totalPages, 3);
  assert.equal(normalized.hasPreviousPage, true);
  assert.equal(normalized.hasNextPage, true);
});

test('getAiReviewedFeedbackPage sends only swagger-supported filters', async () => {
  const getRequest = mock.method(axiosClient, 'get', async () => ({
    items: [],
    pageNumber: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  }));

  try {
    await managementFeedbackApi.getAiReviewedFeedbackPage({
      pageNumber: 1,
      pageSize: 20,
      search: 'ngập nước',
      categoryId: 4,
      priority: 'High',
      areaId: 2,
    });

    assert.deepEqual(getRequest.mock.calls[0].arguments, [
      '/api/management/feedbacks/ai-reviewed',
      {
        params: {
          PageNumber: 1,
          PageSize: 20,
          Search: 'ngập nước',
          CategoryId: 4,
        },
      },
    ]);
  } finally {
    getRequest.mock.restore();
  }
});

test('verifyFeedback follows the swagger endpoint without inventing a request body', async () => {
  const putRequest = mock.method(axiosClient, 'put', async () => undefined);

  try {
    await managementFeedbackApi.verifyFeedback('feedback-verify');

    assert.deepEqual(putRequest.mock.calls[0].arguments, [
      '/api/management/feedbacks/feedback-verify/verify',
    ]);
  } finally {
    putRequest.mock.restore();
  }
});

test('normalizeStaffFeedbackUpdatePayload converts edit values to backend-safe types', () => {
  const normalized = normalizeStaffFeedbackUpdatePayload({
    categoryId: '12',
    title: '  ',
    description: 'A',
    locationText: '',
    latitude: '10.5',
    longitude: '',
    priority: 'High',
    dueDate: '',
    status: 'InProgress',
    statusNote: ' ',
  });

  assert.deepEqual(normalized, {
    categoryId: 12,
    description: 'A',
    latitude: 10.5,
    priority: 'High',
    status: 'InProgress',
  });
});

test('normalizeFeedbackListParams maps UI pagination to swagger query parameters', () => {
  const normalized = normalizeFeedbackListParams({
    pageIndex: 2,
    pageSize: 20,
    status: 'SubmittedForApproval',
    search: 'water',
    categoryId: 4,
  });

  assert.deepEqual(normalized, {
    PageNumber: 3,
    PageSize: 20,
    Status: 'SubmittedForApproval',
    Search: 'water',
    CategoryId: 4,
  });
});

test('normalizeFeedbackListParams converts AI Reviewed to the backend-compatible status value', () => {
  const normalized = normalizeFeedbackListParams({
    status: 'AI Reviewed',
  });

  assert.deepEqual(normalized, {
    PageNumber: 1,
    PageSize: 10,
    Status: 'AiReviewed',
  });
});

test('normalizeCommentPayload keeps only the swagger-accepted content field', () => {
  const normalized = normalizeCommentPayload({
    userId: 'u-1',
    userName: 'Ada',
    userRole: 'service-user',
    content: 'hello',
    message: 'ignored',
    rating: 5,
  });

  assert.deepEqual(normalized, { content: 'hello' });
});

test('normalizeCommentsResponse resolves comments from a ticket detail payload shape', () => {
  const normalized = normalizeCommentsResponse({
    data: {
      comments: [
        { id: 'c-1', content: 'hello' },
      ],
    },
  });

  assert.deepEqual(normalized, [{ id: 'c-1', content: 'hello' }]);
});

test('provider report status helpers enforce the Swagger-backed Reported → InProgress → terminal workflow', () => {
  assert.equal(normalizeProviderReportStatus('reported'), 'Reported');
  assert.equal(normalizeProviderReportStatus('contacted'), 'InProgress');
  assert.equal(normalizeProviderReportStatus('accepted'), 'InProgress');
  assert.equal(normalizeProviderReportStatus('in_progress'), 'InProgress');
  assert.equal(normalizeProviderReportStatus('done'), 'Done');
  assert.equal(normalizeProviderReportStatus('completed'), 'Done');
  assert.equal(normalizeProviderReportStatus('failed'), 'Failed');
  assert.equal(normalizeProviderReportStatus('cancelled'), 'Cancelled');

  assert.equal(canTransitionProviderReportStatus('Reported', 'InProgress'), true);
  assert.equal(canTransitionProviderReportStatus('InProgress', 'Done'), true);
  assert.equal(canTransitionProviderReportStatus('InProgress', 'Failed'), true);
  assert.equal(canTransitionProviderReportStatus('InProgress', 'Cancelled'), true);
  assert.equal(canTransitionProviderReportStatus('Reported', 'Done'), false);
  assert.equal(canTransitionProviderReportStatus('Done', 'InProgress'), false);
});

test('normalizeProviderContactLogPayload converts local datetime values and trims empty fields', () => {
  const normalized = normalizeProviderContactLogPayload({
    contactMethod: '  Phone  ',
    contactResult: '  Reached  ',
    contactNote: '   ',
    contactedAt: '2026-07-20T16:30',
  });

  assert.equal(normalized.contactMethod, 'Phone');
  assert.equal(normalized.contactResult, 'Reached');
  assert.equal(Object.hasOwn(normalized, 'contactNote'), false);
  assert.equal(normalized.contactedAt, new Date('2026-07-20T16:30').toISOString());
});

test('resolveProviderReportById finds the matching report from feedback-level payloads', () => {
  const payload = {
    items: [
      { providerReportId: 7, feedbackId: 'fb-1', reportStatus: 'Assigned' },
      { providerReportId: 8, feedbackId: 'fb-1', reportStatus: 'InProgress' },
    ],
  };

  assert.equal(resolveProviderReportById(payload, 8)?.providerReportId, 8);
  assert.equal(resolveProviderReportById(payload, '7')?.reportStatus, 'Assigned');
  assert.equal(resolveProviderReportById([], 8), null);
});

test('deleteFeedback uses the management DELETE contract and accepts a 204 response body', async () => {
  const deleteRequest = mock.method(axiosClient, 'delete', async () => undefined);

  try {
    const result = await managementFeedbackApi.deleteFeedback('  feedback-123  ');

    assert.equal(result, undefined);
    assert.equal(deleteRequest.mock.callCount(), 1);
    assert.deepEqual(deleteRequest.mock.calls[0].arguments, [
      '/api/management/feedbacks/feedback-123',
    ]);

    await assert.rejects(
      () => managementFeedbackApi.deleteFeedback('   '),
      /feedbackId/
    );
    assert.equal(deleteRequest.mock.callCount(), 1);
  } finally {
    deleteRequest.mock.restore();
  }
});
