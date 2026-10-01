import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCommunityIncidentId,
  getCommunityInteractionFeedbackId,
  getCommunityReportCount,
} from './communityPresentation.js';

test('Community identity chỉ dùng incidentId/id, không dùng feedbackId', () => {
  assert.equal(getCommunityIncidentId({ incidentId: 'incident-1', feedbackId: 'feedback-1' }), 'incident-1');
  assert.equal(getCommunityIncidentId({ id: 'incident-2', feedbackId: 'feedback-2' }), 'incident-2');
  assert.equal(getCommunityIncidentId({ feedbackId: 'feedback-only' }), '');
});

test('Community interaction không tự chọn report đầu tiên hoặc feedbackId legacy', () => {
  assert.equal(getCommunityInteractionFeedbackId({
    incidentId: 'incident-1',
    feedbackId: 'feedback-legacy',
    reports: [{ feedbackId: 'report-1' }],
  }), '');
  assert.equal(getCommunityInteractionFeedbackId({
    incidentId: 'incident-1',
    representativeFeedbackId: 'feedback-representative',
  }), 'feedback-representative');
});

test('reportCount giữ đúng 0 và chỉ fallback sang mảng reports khi field không tồn tại', () => {
  assert.equal(getCommunityReportCount({ reportCount: 0, reports: [{}, {}] }), 0);
  assert.equal(getCommunityReportCount({ reports: [{}, {}] }), 2);
  assert.equal(getCommunityReportCount({}), 0);
});
