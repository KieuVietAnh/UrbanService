import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findReviewReport,
  formatConfidence,
  formatReportCode,
  getAiCategoryId,
  getRelatedIncidentId,
  getReviewPriority,
  isAiReviewedStatus,
} from './managerReportReviewUtils.js';

test('formats report codes without exposing a full UUID', () => {
  assert.equal(formatReportCode('12345678-abcd-ef00-1234-567890abcdef'), 'PA-12345678');
});

test('normalizes AI urgency for editable Manager priority', () => {
  assert.equal(getReviewPriority({ analysisResult: { urgencyLevel: 'Urgent' } }), 'Critical');
  assert.equal(getReviewPriority({ priority: 'High' }), 'High');
});

test('formats confidence from fractional and percentage values', () => {
  assert.equal(formatConfidence(0.923), '92%');
  assert.equal(formatConfidence(87), '87%');
  assert.equal(formatConfidence(null), 'Chưa có dữ liệu');
});

test('reads only explicit AI category and Incident relationship fields', () => {
  const report = {
    incidentId: 'incident-1',
    parentTicketId: 'legacy-parent',
    analysisResult: { detectedCategoryId: 7 },
  };

  assert.equal(getAiCategoryId(report), 7);
  assert.equal(getRelatedIncidentId(report), 'incident-1');
  assert.equal(getRelatedIncidentId({ parentTicketId: 'legacy-parent' }), '');
});

test('finds the exact report and recognizes AI reviewed status variants', () => {
  assert.equal(findReviewReport([{ feedbackId: 'FB-1' }], 'fb-1')?.feedbackId, 'FB-1');
  assert.equal(isAiReviewedStatus('AI Reviewed'), true);
  assert.equal(isAiReviewedStatus('AiReviewed'), true);
  assert.equal(isAiReviewedStatus('Verified'), false);
});

test('builds a sentiment return action while preserving the exact filtered URL', async () => {
  const { getReviewQueueReturnContext } = await import('./managerReportReviewUtils.js');
  assert.deepEqual(
    getReviewQueueReturnContext({
      from: '/analytics/sentiment?range=30d&area=2&category=5',
      mapState: { focusFeedbackId: 'FB-1' },
    }),
    {
      href: '/analytics/sentiment?range=30d&area=2&category=5',
      label: 'Quay lại Cảm xúc người dân',
      state: null,
    },
  );
});

test('keeps the existing map return behavior', async () => {
  const { getReviewQueueReturnContext } = await import('./managerReportReviewUtils.js');
  assert.deepEqual(
    getReviewQueueReturnContext({ from: '/management/map', mapState: { zoom: 15 } }),
    {
      href: '/management/map',
      label: 'Quay lại bản đồ',
      state: { mapState: { zoom: 15 } },
    },
  );
});

test('loads every AI reviewed page using backend pagination metadata', async () => {
  const { fetchAllAiReviewedPages } = await import('./managerReportReviewUtils.js');
  const calls = [];
  const fetchPage = async ({ pageNumber, pageSize }) => {
    calls.push({ pageNumber, pageSize });
    const pages = {
      1: { items: [{ feedbackId: 'A' }, { feedbackId: 'B' }], pageNumber: 1, pageSize: 2, totalItems: 5, totalPages: 3 },
      2: { items: [{ feedbackId: 'C' }, { feedbackId: 'D' }], pageNumber: 2, pageSize: 2, totalItems: 5, totalPages: 3 },
      3: { items: [{ feedbackId: 'E' }], pageNumber: 3, pageSize: 2, totalItems: 5, totalPages: 3 },
    };
    return pages[pageNumber];
  };

  const result = await fetchAllAiReviewedPages(fetchPage, { pageSize: 2 });

  assert.deepEqual(result.items.map((item) => item.feedbackId), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(result.totalItems, 5);
  assert.equal(result.partial, false);
  assert.deepEqual(calls, [
    { pageNumber: 1, pageSize: 2 },
    { pageNumber: 2, pageSize: 2 },
    { pageNumber: 3, pageSize: 2 },
  ]);
});

test('keeps successful AI reviewed pages and reports partial data when a later page fails', async () => {
  const { fetchAllAiReviewedPages } = await import('./managerReportReviewUtils.js');
  const fetchPage = async ({ pageNumber }) => {
    if (pageNumber === 2) throw new Error('page failed');
    return {
      items: [{ feedbackId: pageNumber === 1 ? 'A' : 'C' }],
      pageNumber,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
    };
  };

  const result = await fetchAllAiReviewedPages(fetchPage, { pageSize: 1 });

  assert.deepEqual(result.items.map((item) => item.feedbackId), ['A', 'C']);
  assert.equal(result.totalItems, 3);
  assert.equal(result.partial, true);
});
