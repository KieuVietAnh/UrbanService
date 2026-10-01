import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileAdminFeedbackDeletion } from './adminFeedbackMetrics.js';

test('reconcileAdminFeedbackDeletion removes the row and decrements only its summary group', () => {
  const feedbacks = [
    { feedbackId: 'feedback-1', status: 'Submitted' },
    { feedbackId: 'feedback-2', status: 'Closed' },
  ];
  const summary = {
    total: 8,
    pending: 3,
    inProgress: 1,
    completed: 4,
  };

  const result = reconcileAdminFeedbackDeletion(feedbacks, summary, 'feedback-1');

  assert.deepEqual(result.feedbacks, [{ feedbackId: 'feedback-2', status: 'Closed' }]);
  assert.deepEqual(result.summary, {
    total: 7,
    pending: 2,
    inProgress: 1,
    completed: 4,
  });
});

test('reconcileAdminFeedbackDeletion does not double-decrement an already removed feedback', () => {
  const feedbacks = [{ feedbackId: 'feedback-2', status: 'Closed' }];
  const summary = {
    total: 7,
    pending: 2,
    inProgress: 1,
    completed: 4,
  };

  const result = reconcileAdminFeedbackDeletion(feedbacks, summary, 'feedback-1');

  assert.equal(result.feedbacks, feedbacks);
  assert.equal(result.summary, summary);
});
