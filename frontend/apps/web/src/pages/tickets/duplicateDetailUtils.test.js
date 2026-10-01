import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCandidateReasoning,
  getDuplicateCandidateDecisionState,
  normalizeDuplicateCandidatePayload,
  resolveDuplicateCandidateId,
} from './duplicateDetailUtils.js';

test('resolves the duplicate candidate id from Manager and legacy route params', () => {
  assert.equal(resolveDuplicateCandidateId({ candidateId: 'manager-candidate' }), 'manager-candidate');
  assert.equal(resolveDuplicateCandidateId({ duplicateCandidateId: 'legacy-candidate' }), 'legacy-candidate');
  assert.equal(resolveDuplicateCandidateId({}), '');
});

test('does not treat missing or unsupported candidate data as processed', () => {
  assert.equal(getDuplicateCandidateDecisionState(null), 'unavailable');
  assert.equal(getDuplicateCandidateDecisionState({ status: 'Pending' }), 'pending');
  assert.equal(getDuplicateCandidateDecisionState({ status: 'Confirmed' }), 'processed');
  assert.equal(getDuplicateCandidateDecisionState({ status: 'Rejected' }), 'processed');
  assert.equal(getDuplicateCandidateDecisionState({ status: 'Unexpected' }), 'unsupported');
});

test('normalizes feedback payload from API response', () => {
  const payload = {
    duplicateCandidateId: 'candidate-1',
    reason: 'Cùng chủ đề và vị trí gần nhau',
    currentIncidentId: 'incident-1',
    suggestedIncidentId: 'incident-2',
    areInSameIncident: false,
    feedback: {
      feedbackId: 'feedback-1',
      title: 'Đèn đường bị hỏng',
      description: 'Đèn không sáng',
      categoryName: 'Street Lighting',
      locationText: '12 Nguyễn Huệ, Quận 1',
      userName: 'Kieu Viet Anh',
      status: 'AiReviewed',
    },
    potentialParentFeedback: {
      feedbackId: 'feedback-2',
      title: 'Bóng đèn đường không sáng',
      description: 'Đèn ở gần đây',
      categoryName: 'Street Lighting',
      locationText: 'Gần số 12 Nguyễn Huệ, Quận 1',
      userName: 'Kieu Viet Anh',
      status: 'AiReviewed',
    },
  };

  const normalized = normalizeDuplicateCandidatePayload(payload);

  assert.equal(normalized.primaryFeedback.feedbackId, 'feedback-1');
  assert.equal(normalized.primaryFeedback.title, 'Đèn đường bị hỏng');
  assert.equal(normalized.duplicateFeedback.feedbackId, 'feedback-2');
  assert.equal(normalized.duplicateFeedback.locationText, 'Gần số 12 Nguyễn Huệ, Quận 1');
  assert.equal(normalized.currentIncidentId, 'incident-1');
  assert.equal(normalized.suggestedIncidentId, 'incident-2');
  assert.equal(normalized.areInSameIncident, false);
  assert.equal(getCandidateReasoning(normalized), 'Cùng chủ đề và vị trí gần nhau');
});
