import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeLinkedFeedbacksPayload,
  normalizeRelatedFeedbacksPayload,
} from './feedbackRelations.js';

test('normalizes linked duplicate feedbacks from a list payload', () => {
  const linkedFeedbacks = [
    { feedbackId: 'child-1', parentTicketId: 'master-1' },
    { feedbackId: 'child-2', parentTicketId: 'master-1' },
  ];

  assert.deepEqual(normalizeLinkedFeedbacksPayload(linkedFeedbacks), linkedFeedbacks);
});

test('returns the existing master feedback for a confirmed duplicate', () => {
  const result = normalizeRelatedFeedbacksPayload({
    feedbackId: 'child-1',
    masterFeedbackId: 'master-1',
    masterFeedback: {
      feedbackId: 'master-1',
      title: 'Phản ánh đã có',
    },
    linkedFeedbacks: [],
  }, 'child-1');

  assert.deepEqual(result, [{
    feedbackId: 'master-1',
    title: 'Phản ánh đã có',
    relationType: 'master',
  }]);
});

test('does not repeat the current master and returns its linked children', () => {
  const result = normalizeRelatedFeedbacksPayload({
    feedbackId: 'master-1',
    masterFeedbackId: 'master-1',
    masterFeedback: { feedbackId: 'master-1' },
    linkedFeedbacks: [{ feedbackId: 'child-1' }],
  }, 'master-1');

  assert.deepEqual(result, [{
    feedbackId: 'child-1',
    relationType: 'linked',
  }]);
});

test('returns the master and sibling duplicates while excluding the current child', () => {
  const result = normalizeRelatedFeedbacksPayload({
    feedbackId: 'child-1',
    masterFeedbackId: 'master-1',
    masterFeedback: { feedbackId: 'master-1' },
    linkedFeedbacks: [
      { feedbackId: 'child-1' },
      { feedbackId: 'child-2' },
    ],
  }, 'child-1');

  assert.deepEqual(result, [
    { feedbackId: 'master-1', relationType: 'master' },
    { feedbackId: 'child-2', relationType: 'linked' },
  ]);
});
